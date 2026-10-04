# Annual incident forecast (empirical Bayes)

Predicts each Calgary road segment's and intersection's traffic incident reports over the next
12 months, and exports the result for the dashboard's Forward outlook. It sits alongside the
dashboard's 7/30-day ridge Poisson model (`src/forecast.mjs`) and does not change it.

## Quick start

```sh
cd analysis
uv venv .venv && VIRTUAL_ENV=.venv uv pip install -r requirements.txt
.venv/bin/python fetch.py      # City open data → data/raw/ (~70 MB, gitignored)
.venv/bin/python prepare.py    # units, incident and asset assignment → data/*.parquet
.venv/bin/python backtest.py   # EB vs ridge, 2018–present → ../reports/forecast-annual-backtest.json (~1 min)
.venv/bin/python export.py     # 12-month forecast → ../public/data/forecast-annual.json(.gz)
.venv/bin/python -m pytest
```

| File | Purpose |
|---|---|
| `fetch.py` | Full incident archive (Dec 2016 onward, ~65k records), road inventory (120,567 segments), yearly traffic volumes, Traffic Signals, Traffic Signs, Crosswalks (`--assets-only` refreshes these and keeps the incident snapshot) |
| `prepare.py` | Builds units and assigns each incident and asset to one |
| `model.py` | EB model, ridge baseline, metrics |
| `backtest.py` | Year-by-year comparison; picks the EB history window |
| `export.py` | Forward forecast for the app |

## Data and units

- **Incidents:** the City traffic incident archive. These are reports, including stalls and signal faults, not confirmed collisions. Local (America/Edmonton) dates from 2017-01-01; the latest, partial day is excluded.
- **Units:**
  - **Segments:** every segment in the road inventory, including the ~107k with no reports.
  - **Intersections:** nodes where 3+ non-alley segments share an endpoint (46,007).
- **Assignment:** an incident goes to the nearest intersection within **76 m** (250 ft, the usual intersection influence area); otherwise to the nearest segment within 50 m, as in `pipelines/prepare.mjs`. That puts 87% of incidents at intersections.
- **Traffic volume:** the City's yearly Traffic Volumes datasets (average weekday traffic, both directions) for 2016–2019 and 2022–2024; 2020 and 2021 were not published. Each segment takes the count section within 30 m of its midpoint, and each intersection takes its busiest counted leg. The model uses the mean `log1p(volume)` over the count years up to the forecast cutoff, with no imputation for unpublished years or uncounted sites (those get a has-volume flag of 0). Coverage: 23% of segments and 33% of intersections. Most of it comes from the 2016–2019 datasets; later years count far fewer sections.
- **Traffic control and crossings:** the City's Traffic Signals (full and partial signals, plus pedestrian RRFBs and overhead flashers), the Stop and Yield blades from Traffic Signs, and Crosswalks. Each asset goes to the intersection within 40 m; pedestrian signals and crosswalks away from intersections go to the segment within 30 m. Signals and signs carry install dates, so a forecast only uses those installed by its cutoff. Crosswalks have no dates, so backtests use today's crosswalks.

## Final model

Hauer's empirical Bayes method (Hauer et al., 2002), fitted separately for segments and intersections at each cutoff, using only data up to that cutoff:

1. **Safety performance function (SPF).** A Poisson GLM (`sklearn.PoissonRegressor`) of each unit's history count on site characteristics only:
   - **Segments:** road class (`ctp_class`), log length, mean log weekday volume plus a has-volume flag, traffic control and crossings (below), lon/lat splines.
   - **Intersections:** highest and second-highest leg road class, number of legs, mean log volume of the busiest counted leg, traffic control and crossings, lon/lat splines.
   - **Traffic control and crossings (both kinds):** signalized (yes/no), pedestrian signal (RRFB or overhead flasher), log number of stop signs, log number of yield signs, log number of crosswalks, school crosswalk (yes/no).
2. **Overdispersion.** A negative binomial shape `k`, from marginal maximum likelihood with the SPF held fixed. Currently about 0.54 for segments and 0.36 for intersections, so counts are strongly overdispersed.
3. **Shrinkage.** `EB = w·SPF + (1 − w)·history`, with `w = k / (k + SPF)`. Sites with long or busy histories rely on their own counts; quiet sites lean on similar sites.
4. **Forecast.** `EB × horizon / history length`. The uncertainty is Eq. 3, `SD = √((1 − w)·EB)`, plus a 90% interval from the negative binomial posterior predictive (shape `k + history`).

**History window:** 5 years, chosen in the backtest from {1, 2, 3, 5, all} using only years before each target.

## Ridge baseline

A Poisson GLM with a small ridge penalty (α = 0.001) on each unit's own history only:
- log reports in the last 365 days;
- log reports in the last 92 days;
- log mean yearly reports before that;
- active days in the last year.

It is trained on earlier (Dec 31 cutoff, next calendar year) pairs. It is the annual analogue of the dashboard's 7/30-day model.

## Backtest

Each year N is predicted from data through Dec 31 of N−1. 2026 is scored through the latest complete date, with predictions scaled by the seasonal share of that span. Mean over 2020–2026 (`../reports/forecast-annual-backtest.json`):

| | EB | Ridge |
|---|---|---|
| Poisson deviance per unit | **0.097** | 0.203 |
| Top20 coverage, % of best possible | **83%** | 81% |
| Top100 coverage, % of best possible | **77%** | 75% |
| Top500 coverage, % of best possible | **75%** | 73% |
| Next-year reports caught by top 500 never-reported units | **113** | 6 |

- **Accuracy:** EB halves the deviance and ranks about as well or slightly better.
- **Never-reported sites:** these get 15–40% of each year's reports. Only EB can rank them, because they have no history.
- **Intervals:** 90% intervals cover 89–92% of outcomes for the 500 highest forecasts in 2024–2026.

## Export: `public/data/forecast-annual.json`

A rolling 12-month forecast from the day after `dataThrough`, with the top 1,000 units (about 80 KB gzipped). Load the `.gz` the same way `useDataset.ts` loads `dataset.json.gz`. `export.py --top N` changes the count. Re-run the pipeline to refresh it; nothing in the app retrains.

```ts
interface AnnualForecast {
  version: string;
  generatedAt: string;                      // ISO timestamp
  dataThrough: string;                      // last complete local date used
  horizon: { start: string; end: string; days: number };
  history: { start: string; end: string; years: number | "all" };
  model: { method: string; k: { segment: number; intersection: number };
           intersectionRadiusM: number; units: { segment: number; intersection: number } };
  baseline: { method: string; trainingCutoffs: string[] };
  totals: { expected: number; ridgeExpected: number; last365Reports: number };  // over all units
  backtest: {
    summaryYears: number[];
    summary: Record<"eb" | "ridge", { deviance: number; top20OfOracle: number; top100OfOracle: number;
                                      top500OfOracle: number; neverReportedTop500: number }>;
    years: { year: number; total: number;
             eb: { deviance: number; top20OfOracle: number; top100OfOracle: number };
             ridge: { deviance: number; top20OfOracle: number; top100OfOracle: number } }[];
  };
  caveats: string[];
  units: {
    rank: number;                           // 1 = highest expected reports
    id: string;                             // "road:<segment_id>" or "node:<x>:<y>"
    kind: "segment" | "intersection";
    name: string | null;                    // street, or "A & B" for intersections
    roadClass: string;                      // segment class, or highest leg class
    minorRoadClass: string | null;          // intersections: second leg class
    lon: number; lat: number;
    geometry: GeoJSON.MultiLineString | GeoJSON.Point;
    expected: number;                       // expected reports over the horizon
    sd: number;                             // Eq. 3 SD of the expected value
    low90: number; high90: number;          // 90% predictive interval for the actual count
    historyReports: number;                 // reports in the history window
    last365Reports: number;
    spfExpected: number;                    // what similar sites would expect, same horizon
    priorWeight: number;                    // w: 0 = own history only, 1 = similar sites only
    ridgeExpected: number; ridgeRank: number;
    signalized: boolean; pedestrianSignal: boolean;   // at the forecast start
    stopSigns: number; yieldSigns: number;
    crosswalks: number; schoolCrosswalk: boolean;
  }[];
}
```

Segment ids match `road:<segment_id>` in `dataset.json`. Intersection units are new to the app and come with point geometry.

**Display suggestions:**
- Show `expected` with `low90`–`high90`.
- Explain a site with `priorWeight`: "mostly its own history" versus "similar to other <roadClass> sites".
- Flag where `rank` and `ridgeRank` disagree.
- Describe the site with its control: "signalized", "stop-controlled" (`stopSigns > 0`) or "yield", plus crosswalks.

## Alternatives tried

All were evaluated with the same yearly backtest unless noted.

| Tried | Result |
|---|---|
| EB on 7/30-day horizons (2023+ data) | Similar deviance to ridge, worse Top20; short windows are too sparse and seasonal |
| Units limited to locations with past reports | Zero-truncated sample inflated the prior; EB overpredicted totals by ~50% |
| Zero-truncated NB fit on those units | Fixed calibration, but the prior collapsed to `k → 0` (not identifiable); motivated using the full road inventory |
| Full inventory, segments only | Good deviance, but per-segment ranking broke on the Dec 2025 geocoding change (2026 Top100 45% of best) |
| Hauer's overdispersion per km (`k = n·L`), joint NB SPF with length offset | Slightly worse on every metric than one `k` per unit kind |
| Year-specific µ / citywide trend projection | Changes totals only (static site covariates); negligible gain, trend overshot 2025 |
| Intersection radius 20–130 m, node clustering 0–50 m | No unit-free optimum: road-length budgets favour 20 m, site-count budgets favour large clustered units; 45–110 m is flat, so 76 m (convention) with no clustering |
| 2024 volume only (4% of segments), applied to every backtest year | Same ranking and slightly higher deviance (0.0980 vs 0.0976) than mean volume over 2016–2024 up to each cutoff; replaced because it also used volumes from after the cutoff |

## Limitations

- **Rates are assumed stable over the 5-year history.** The forecast (about 7,500 reports) is below the last 365 days (8,300), so a recent citywide rise is not carried forward.
- **Partial exposure data.** Volume counts cover 23% of segments and 33% of intersections, mostly major roads. Roads built after 2017 appear in history with zero reports.
- **The December 2025 geocoding change** (incidents snapped to road centrelines) still lowers 2026 Top100 slightly.
- **Weather, time of day, incident category and spatial spillover are not used.**

## References

Hauer, E., Harwood, D. W., Council, F. M., & Griffith, M. S. (2002). Estimating Safety by the Empirical Bayes Method: A Tutorial. *Transportation Research Record: Journal of the Transportation Research Board*, 1784(1), 126–131. https://doi.org/10.3141/1784-16
