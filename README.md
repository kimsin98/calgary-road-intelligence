# Calgary Road Disruption Intelligence

A browser dashboard for historical road-inspection priorities and experimental traffic-report forecasting, developed for IEEE Industry Hackathon Option B, Energy & Infrastructure Case 5.

## Run

Node.js 22+ is required. No API keys or backend are needed.

```sh
npm ci
npm run compress:data
npm run dev
```

Open http://localhost:5173. Traffic and weather snapshots are bundled locally; OpenFreeMap vector tiles and optional Google Fonts require network access.

```sh
npm test
npm run build
npm run preview
```

## Data

The current fixed snapshot contains **27,805 traffic reports** from UTC January 2023 through October 2026, aggregated into **9,661 road/grid locations**. Calgary local dates span December 31, 2022 through October 3, 2026; boundary records are retained and the latest day/year is incomplete. The default analysis covers the latest 90 days.

**32,922 ECCC hourly weather observations** cover January 2023 through the latest available October 2026 hour. Events join weather by UTC hour; display, dates, peak periods and weekends use `America/Edmonton`, including daylight saving. Missing measurements remain unavailable. Airport weather is context, not road-surface evidence.

Sources and processing details: [DATA_SOURCES.md](DATA_SOURCES.md). Current audits and evaluations are in `reports/`.

## Historical analysis

- Map preview, linked Top 20 shortlist, evidence search, original reports, charts and geometric road-association review.
- Date, time-of-day, event-type and weather filters are drafts until **Apply evidence scope** is clicked. **Reset changes** discards edits.
- Frequency, recent growth and recurring-date scoring, adjustable capacity and a raw-count baseline.
- Persistent saved-plan comparison, ranking explanations and JSON report export.
- Automatic search over 21 priority mixes using six 2023–2025 windows; independent July 2026 outcome check. Historical evaluation uses separate 2026 windows.
- Timeline playback with looping, webpage expansion and browser fullscreen.

### Event-type weighting

Historical analysis provides **Equal event weights** and **Learned type weights · experimental**. Equal mode counts every report once. Learned mode applies imported type weights to the frequency signal only; raw counts, growth and recurrence retain their definitions.

To import weights: open Forward outlook, choose **Collision-related report hotspots** and **Learned type weights · experimental**, generate a forecast, expand **Learned event-type effects**, then click **Try learned type weights in historical ranking**. The original plan is saved and comparison opens. Switch back to equal weights without losing the imported weights.

Historical weights use the positive part of each type's average coefficient across the two history bins, normalized to mean 1. This is an **unvalidated adaptation**, not the full forecast model or severity weighting. Applying a model fitted through 2025 to earlier history is retrospective exploration, not an independent backtest.

## Experimental forecasting

Forward outlook has two independent controls:

| Control | Options |
|---|---|
| Target | All report hotspots / Collision-related report hotspots |
| Event-type weighting | Equal event weights / Learned type weights · experimental |

Equal mode pools report types in historical temporal features. Learned mode fits ten type-specific features: `log(1 + count)` for five categories over days 1–30 and 31–90. Both predict the selected target; a collision-related target does not imply confirmed crashes or injury risk.

The ridge-regularized Poisson model predicts expected report counts for the next **7 or 30 days**, then ranks locations. Learned coefficients and transformed-input rate multipliers describe predictive associations, not per-event importance or causal effects.

- **Historical backtest:** choose a 2026 cutoff with a fully observed forecast window. Later outcomes are revealed explicitly.
- **Future forecast:** cutoff is fixed to the latest dataset date, currently October 3, 2026. No future observed counts or accuracy metrics are fabricated.
- **Time cross-validation:** train 2023 → validate 2024; train 2023–2024 → validate 2025. Each validation year has four rolling forecast windows. Select L2 strength from 0.001, 0.01, 0.1 and 1 using mean Poisson deviance, then refit on quarterly 2023–2025 windows. **2026 never selects parameters.**
- Forecast map, historical shortlist comparison, separate JSON export, rate baseline, equal-weight shortlist coverage, MAE, deviance and calibration totals.

This is rolling next-week/next-month prediction within the next year, **not a one-shot annual forecast**. Future weather is excluded. Models can reach the 600-iteration limit; diagnostics remain visible. Neither model has demonstrated consistent superiority over simple historical baselines. See [current status](reports/DEVELOPMENT_STATUS.md) for evaluation files and limits.

## Deployment

Vercel is configured to build `npm run build` and serve `dist`. Build produces gzip snapshots and removes uncompressed JSON from the output: approximately **3.56 MB traffic + 0.45 MB weather**. The browser uses native decompression or a lazy fallback. Compression reduces transfer/storage, not parsed memory.

GitHub-linked deployments run after pushes; local CLI deployment is also supported. To deploy locally, run `npx vercel` for a preview or `npx vercel --prod` for production. Source packages must include `pipelines/compress-data.mjs`, source JSON, the lockfile and Vite/Vercel configuration.

## Rebuild and verify

```sh
npm run fetch:data
npm run prepare:data
npm run fetch:weather
npm run prepare:weather
npm run compress:data
```

Raw downloads are ignored by Git. Refreshing snapshots changes the dataset version and invalidates saved comparison plans. Forecast training years remain explicitly fixed; refreshing data does not silently change the evaluation protocol.

Unit tests: `npm test`. Browser checks require Playwright Chromium and OS dependencies; relevant scripts include `tests/dashboard-browser.mjs`, `tests/evidence-scope-browser.mjs`, `tests/compressed-data-browser.mjs`, `tests/forecast-browser.mjs`, `tests/forecast-modes-browser.mjs`, and `tests/collision-forecast-browser.mjs`. Run `npm run test:browser` for all 13 browser suites; start the development server on port 5173 first. Test artifacts are written to temporary paths.

## Interpretation and attribution

This prioritizes reported disruptions for review. It does not establish fewer crashes, verified severity, road safety or causal weather effects. Text-derived categories, incomplete reporting, current road geometry, ambiguous junction/parallel matches and unverified traffic exposure limit conclusions. Candidate locations must be known at each forecast cutoff; later reports at unseen locations are reported separately.

Sources: City of Calgary Traffic Incidents, Street Centreline and Traffic Volumes 2024; ECCC CALGARY INTL A; OpenFreeMap/OpenMapTiles/OpenStreetMap; optional Google Fonts. Hackathon context comes from [industry-hackathon-lab](https://github.com/nagusubra/industry-hackathon-lab). Snow-route reference, voice narration, LLM integration and live ingestion remain future work.
