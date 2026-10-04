"""Export the 12-month forward forecast for the dashboard's Forward outlook.

Fits EB at the latest complete date with the history window selected by backtest.py, predicts
the next 365 days, and adds the ridge baseline (trained on all complete calendar years) for
comparison. Writes the top units with geometry to ../public/data/forecast-annual.json and .json.gz.
The schema is documented in README.md.

Run backtest.py first. Usage: .venv/bin/python export.py [--top 1000]
"""

import argparse
import gzip
import json
from datetime import date, datetime, timedelta, timezone

import numpy as np

import model
from backtest import FIRST_RIDGE_TRAINING, REPORT
from prepare import INTERSECTION_METRES

OUT = model.DATA.parent.parent / "public/data/forecast-annual.json"
HORIZON_DAYS = 365
CAVEATS = [
    "Counts are City traffic incident reports (including stalls and signal faults), not confirmed collisions.",
    "Expected reports assume each site's rate is stable; road works, new roads and policy changes are not modelled.",
    "Site characteristics use the current road inventory and mean weekday volume over 2016–2024 counts "
    "(2020–2021 unpublished; counts cover a minority of segments, mostly major roads).",
    "Incident geocoding changed in December 2025; intersection units (76 m) absorb most but not all of the shift.",
    "Historical road geometry and actual publication dates of volume counts are unverified; cutoff-year filtering is not a complete point-in-time guarantee.",
    "Weather, time of day, incident category and spatial spillover are not used.",
    "Traffic-control assets are filtered by installation date where recorded; undated assets and current crosswalks are treated as present historically. Removed assets are not reconstructed.",
    "Expected reports describe where reports concentrate, not causes or the effect of an inspection.",
]


def rounded_geometry(text):
    geometry = json.loads(text)
    rnd = lambda c: [round(c[0], 6), round(c[1], 6)]
    if geometry["type"] == "Point":
        geometry["coordinates"] = rnd(geometry["coordinates"])
    else:
        geometry["coordinates"] = [[rnd(c) for c in line] for line in geometry["coordinates"]]
    return geometry


def validate_backtest(backtest, inputs):
    if backtest.get("dataFingerprint") != inputs.fingerprint():
        raise ValueError("Data differs from backtest; rerun backtest.py before exporting")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=1000, help="number of highest-forecast units to export")
    parser.add_argument("--cutoff", type=date.fromisoformat)
    parser.add_argument("--output", type=type(OUT))
    args = parser.parse_args()
    backtest = json.loads(REPORT.read_text())
    history_years = None if backtest["selectedHistoryYears"] == "all" else backtest["selectedHistoryYears"]

    inputs = model.load()
    validate_backtest(backtest, inputs)
    cutoff = args.cutoff or inputs.last_complete
    if cutoff > inputs.last_complete:
        raise ValueError("Cutoff exceeds complete data")
    if args.cutoff:
        history_years = 5  # fixed replay setting, not selected using later targets
    output = args.output or OUT
    output.parent.mkdir(parents=True, exist_ok=True)
    units, ids = inputs.units, inputs.units.unit_id.to_numpy()
    eb = model.eb_forecast(inputs, cutoff, history_years, HORIZON_DAYS)
    training = [date(y - 1, 12, 31) for y in range(FIRST_RIDGE_TRAINING, cutoff.year)
                if date(y, 12, 31) <= cutoff]
    ridge = model.ridge_forecast(model.fit_ridge(inputs, training), inputs, cutoff, HORIZON_DAYS)
    ridge_rank = np.empty(len(ids), int)
    ridge_rank[model.rank(ridge, ids)] = np.arange(1, len(ids) + 1)
    recent = inputs.counts(cutoff - timedelta(days=364), cutoff)
    assets = {name: inputs.assets_at(name, cutoff) for name in ("signal", "pedestrian_signal", "stop_sign", "yield_sign", "crosswalk", "school_crosswalk")}

    import pandas as pd
    records = pd.read_parquet(model.DATA / "events.parquet")
    records = records[(records.date >= model.history_start(cutoff, history_years).isoformat()) & (records.date <= cutoff.isoformat())]
    dashboard_path = model.DATA.parent.parent / "public/data/dataset.json"
    dashboard = json.loads(dashboard_path.read_text())
    reactive_location = {e["id"]: e["location"] for e in dashboard["events"]}
    export_ids = set(ids[model.rank(eb["expected"], ids)[:args.top]])
    records = records[records.unit_id.isin(export_ids)]
    associations = {uid: sorted({reactive_location[eid] for eid in g.id if eid in reactive_location}) for uid,g in records.groupby("unit_id")}
    evidence = {uid:list(g.sort_values("date",ascending=False).head(5).itertuples()) for uid,g in records.groupby("unit_id")}
    observed_end = min(cutoff + timedelta(days=365), inputs.last_complete)
    observed = inputs.counts(cutoff + timedelta(days=1), observed_end) if args.cutoff else None
    rows = []
    for position, i in enumerate(model.rank(eb["expected"], ids)[: args.top], start=1):
        u = units.iloc[i]
        segment = u.kind == "segment"
        rows.append(
            {
                "observedReports": int(observed[i]) if observed is not None else None,
                "rank": position,
                "id": u.unit_id,
                "kind": u.kind,
                "name": u["name"] if isinstance(u["name"], str) else None,
                "roadClass": u.road_class if segment else u.major,
                "minorRoadClass": None if segment else u.minor,
                "lon": round(float(u.lon), 6),
                "lat": round(float(u.lat), 6),
                "geometry": rounded_geometry(u.geometry),
                "expected": round(float(eb["expected"][i]), 3),
                "sd": round(float(eb["sd"][i]), 3),
                "low90": int(eb["low90"][i]),
                "high90": int(eb["high90"][i]),
                "historyReports": int(eb["history"][i]),
                "last365Reports": int(recent[i]),
                "spfExpected": round(float(eb["spfExpected"][i]), 3),
                "priorWeight": round(float(eb["priorWeight"][i]), 3),
                "ridgeExpected": round(float(ridge[i]), 3),
                "ridgeRank": int(ridge_rank[i]),
                "signalized": bool(assets["signal"][i]),
                "pedestrianSignal": bool(assets["pedestrian_signal"][i]),
                "stopSigns": int(assets["stop_sign"][i]), "yieldSigns": int(assets["yield_sign"][i]),
                "crosswalks": int(assets["crosswalk"][i]), "schoolCrosswalk": bool(assets["school_crosswalk"][i]),
                "relatedDashboardLocationIds": associations.get(u.unit_id, []),
                "reportEvidence": [{"id": str(e.id), "date": str(e.date), "description": str(e.description)} for e in evidence.get(u.unit_id, [])],
            }
        )

    history_start = model.history_start(cutoff, history_years)
    export = {
        "mode": "backtest" if args.cutoff else "future",
        "historySelection": "Fixed five-year replay setting; not independently tuned" if args.cutoff else "Annual backtest-selected history",
        "observation": {"through": min(cutoff + timedelta(days=365), inputs.last_complete).isoformat(), "complete": cutoff + timedelta(days=365) <= inputs.last_complete, "totalReports": int(observed.sum()), "top20Reports": int(observed[model.rank(eb["expected"], ids)[:20]].sum())} if args.cutoff else None,
        "version": backtest["version"],
        "dataFingerprint": inputs.fingerprint(),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataThrough": cutoff.isoformat(),
        "horizon": {"start": (cutoff + timedelta(days=1)).isoformat(),
                    "end": (cutoff + timedelta(days=HORIZON_DAYS)).isoformat(), "days": HORIZON_DAYS},
        "history": {"start": history_start.isoformat(), "end": cutoff.isoformat(), "years": history_years or "all"},
        "model": {
            "method": "Empirical Bayes (Hauer): w * SPF + (1 - w) * history, w = k / (k + SPF); "
                      "Poisson SPF on site characteristics, negative binomial shape k per unit kind",
            "k": eb["k"],
            "intersectionRadiusM": INTERSECTION_METRES,
            "units": backtest["units"],
        },
        "baseline": {
            "method": "Ridge Poisson on own history (last 365 days, last 92 days, earlier yearly mean, active days)",
            "trainingCutoffs": [c.isoformat() for c in training],
        },
        "totals": {"expected": round(float(eb["expected"].sum()), 1), "ridgeExpected": round(float(ridge.sum()), 1),
                   "last365Reports": int(recent.sum())},
        "backtest": {
            "summaryYears": backtest["summaryYears"],
            "summary": backtest["summary"],
            "years": [{"year": r["year"], "total": r["total"], "scoredThrough": r["scoredThrough"],
                       "lastYear": r["lastYear"], "historicalRate": r["historicalRate"],
                       "eb": {k: r["eb"][k] for k in ("deviance", "top20OfOracle", "top100OfOracle")},
                       "ridge": {k: r["ridge"][k] for k in ("deviance", "top20OfOracle", "top100OfOracle")}}
                      for r in backtest["years"] if "ridge" in r],
        },
        "caveats": CAVEATS,
        "units": rows,
    }
    text = json.dumps(export, separators=(",", ":"))
    output.write_text(text)
    output.with_suffix(".json.gz").write_bytes(gzip.compress(text.encode(), compresslevel=9))
    print(f"Wrote {output.name}: {len(rows)} units, {len(text) / 1e6:.2f} MB "
          f"({len(gzip.compress(text.encode())) / 1e6:.2f} MB gzipped); horizon {export['horizon']['start']} to "
          f"{export['horizon']['end']}, expected {export['totals']['expected']:.0f} reports "
          f"(last 365 days: {export['totals']['last365Reports']})")
    for r in rows[:5]:
        print(f"  {r['rank']:>2}. {r['name']} ({r['kind']}): {r['expected']:.1f} [{r['low90']}-{r['high90']}], "
              f"history {r['historyReports']}, ridge rank {r['ridgeRank']}")


if __name__ == "__main__":
    main()
