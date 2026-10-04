"""Annual backtest: empirical Bayes vs the ridge baseline.

For each target year N = 2018..current, both models predict each unit's reports in year N from
data through Dec 31 of N-1. The current year is scored from Jan 1 to the last complete date, with
annual predictions scaled by the share of a year's reports that past full years logged in that
span. EB's history window H is chosen for each target year by mean deviance over earlier complete
target years only; ridge trains on earlier complete target years (from 2019, so every training
cutoff has earlier history). The final H for export is chosen over all complete years.

Writes ../reports/forecast-annual-backtest.json. Usage: .venv/bin/python backtest.py
"""

import json
from datetime import date

import numpy as np
from scipy import stats

import model

REPORT = model.DATA.parent.parent / "reports/forecast-annual-backtest.json"
FIRST_TARGET = 2018
FIRST_RIDGE_TRAINING = 2019
TOP = (20, 100, 500)


def seasonal_share(inputs, end):
    """Mean share of a full year's reports falling on or before end's month/day."""
    shares = []
    for year in range(model.FIRST_DATE.year, end.year):
        full = inputs.counts(date(year, 1, 1), date(year, 12, 31)).sum()
        shares.append(inputs.counts(date(year, 1, 1), end.replace(year=year)).sum() / full)
    return float(np.mean(shares))


def target_window(inputs, year):
    end = min(date(year, 12, 31), inputs.last_complete)
    complete = end == date(year, 12, 31)
    days = (date(year, 12, 31) - date(year, 1, 1)).days + 1
    return end, complete, days, 1.0 if complete else seasonal_share(inputs, end)


def score(actual, predicted, ids, never_reported):
    order = model.rank(predicted, ids)
    oracle = np.sort(actual)[::-1]
    result = {"expected": float(predicted.sum()), "deviance": model.deviance(actual, predicted)}
    for k in TOP:
        result[f"top{k}"] = int(actual[order[:k]].sum())
        result[f"top{k}OfOracle"] = float(actual[order[:k]].sum() / oracle[:k].sum())
    new = order[never_reported[order]][:500]
    result["neverReportedTop500"] = int(actual[new].sum())
    return result


def main():
    inputs = model.load()
    ids = inputs.units.unit_id.to_numpy()
    years = range(FIRST_TARGET, inputs.last_complete.year + 1)
    windows = {y: target_window(inputs, y) for y in years}
    actual = {y: inputs.counts(date(y, 1, 1), windows[y][0]) for y in years}
    complete = [y for y in years if windows[y][1]]

    eb = {}  # (year, H) -> forecast
    for year in years:
        _, _, days, scale = windows[year]
        for h in model.HISTORY_YEARS:
            eb[year, h] = model.eb_forecast(inputs, date(year - 1, 12, 31), h, days, scale)
            print(f"  fitted {year} H={h}")

    def mean_deviance(h, targets):
        return np.mean([model.deviance(actual[y], eb[y, h]["expected"]) for y in targets])

    results = []
    for year in years:
        cutoff = date(year - 1, 12, 31)
        end, is_complete, days, scale = windows[year]
        earlier = [y for y in complete if y < year]
        h = min(model.HISTORY_YEARS, key=lambda h: mean_deviance(h, earlier)) if earlier else None
        forecast = eb[year, h]
        never_reported = inputs.counts(model.FIRST_DATE, cutoff) == 0
        row = {
            "year": year,
            "scoredThrough": end.isoformat(),
            "seasonalScale": scale,
            "total": int(actual[year].sum()),
            "atNeverReportedUnits": int(actual[year][never_reported].sum()),
            "historyYears": h or "all",
            "k": forecast["k"],
            "eb": score(actual[year], forecast["expected"], ids, never_reported),
        }
        # Uncertainty check on the 500 highest forecasts (most units are 0, so all-unit coverage is uninformative).
        top = model.rank(forecast["expected"], ids)[:500]
        a = actual[year][top]
        p = forecast["shape"][top] / (forecast["shape"][top] + forecast["expected"][top])
        row["eb"]["interval90CoverageTop500"] = float(np.mean((a >= forecast["low90"][top]) & (a <= forecast["high90"][top])))
        row["eb"]["logScoreTop500"] = float(stats.nbinom.logpmf(a, forecast["shape"][top], p).mean())
        training = [date(y - 1, 12, 31) for y in complete if FIRST_RIDGE_TRAINING <= y < year]
        if training:
            ridge = model.fit_ridge(inputs, training)
            row["ridge"] = score(actual[year], model.ridge_forecast(ridge, inputs, cutoff, days, scale), ids,
                                 never_reported)
        results.append(row)

    selected = min(model.HISTORY_YEARS, key=lambda h: mean_deviance(h, complete))
    compared = [r for r in results if "ridge" in r]
    summary = {
        name: {key: float(np.mean([r[name][key] for r in compared]))
               for key in ("deviance", "top20OfOracle", "top100OfOracle", "top500OfOracle", "neverReportedTop500")}
        for name in ("eb", "ridge")
    }
    report = {
        "version": "eb-annual-v1",
        "dataThrough": inputs.last_complete.isoformat(),
        "units": {kind: int((inputs.units.kind == kind).sum()) for kind in ("segment", "intersection")},
        "selectedHistoryYears": selected or "all",
        "summaryYears": [r["year"] for r in compared],
        "summary": summary,
        "years": results,
    }
    REPORT.write_text(json.dumps(report, indent=2))
    print_report(report)


def print_report(report):
    print(f"\n{'year':<6}{'actual':>7}{'H':>5}   {'deviance EB/ridge':>18}{'top20 % oracle':>18}{'top100 % oracle':>18}"
          f"{'top500 % oracle':>18}{'never-reported top500':>24}")
    for r in report["years"]:
        eb, ridge = r["eb"], r.get("ridge")
        pair = lambda key, fmt: f"{eb[key]:{fmt}} / " + (f"{ridge[key]:{fmt}}" if ridge else "-")
        print(f"{r['year']:<6}{r['total']:>7}{str(r['historyYears']):>5}   {pair('deviance', '.3f'):>18}"
              f"{pair('top20OfOracle', '.0%'):>18}{pair('top100OfOracle', '.0%'):>18}{pair('top500OfOracle', '.0%'):>18}"
              f"{pair('neverReportedTop500', 'd'):>24}")
    s = report["summary"]
    print(f"\nMean {report['summaryYears'][0]}–{report['summaryYears'][-1]} (EB / ridge): "
          f"deviance {s['eb']['deviance']:.3f} / {s['ridge']['deviance']:.3f}, "
          f"top20 {s['eb']['top20OfOracle']:.0%} / {s['ridge']['top20OfOracle']:.0%}, "
          f"top100 {s['eb']['top100OfOracle']:.0%} / {s['ridge']['top100OfOracle']:.0%}")
    print(f"History window for export: {report['selectedHistoryYears']} years. Wrote {REPORT.name}")


if __name__ == "__main__":
    main()
