# Current Development Status

Updated October 4, 2026. This document describes the current implementation; historical progress logs have been removed.

## Data and Delivery

- 27,805 official traffic reports from UTC January 2023 through retrieval time; local dates 2022-12-31 to 2026-10-03. 9,661 road/grid locations. Latest day and 2026 are incomplete.
- 32,922 ECCC hourly observations over 2023–2026. UTC-hour joins, America/Edmonton display/filtering and explicit missing measurements.
- Gzip deployment snapshots: approximately 3.56 MB traffic and 0.45 MB weather. Browser native decompression with lazy fallback; uncompressed JSON stays in source for processing. Compression does not reduce decoded memory.
- Vercel builds include the compression script and separately emitted analysis workers; MapLibre loads on demand.

## Historical Workflow

Draft Evidence scope with Apply/Reset; linked map and shortlist; evidence search and charts; spatial ambiguity review; playback/looping/fullscreen; persistent saved plans and JSON export.

Ranking combines frequency, 30-day growth and recurring dates. Equal event weights use raw report counts. Learned type weights are optional: import a collision-related forecast's type coefficients, average the two bins, retain positive contributions and normalize to mean 1. Only frequency changes; raw counts, growth and recurrence remain unchanged. This adaptation is unvalidated, not full predictive inference or severity weighting. Imported weights remain available when switching back to equal mode. Applying a 2025-trained model to earlier history is retrospective exploration, not an independent backtest.

Automatic priority-mix search uses six 2023–2025 windows and independently checks July 2026 outcomes. Historical evaluation uses March/May/July 2026 cutoffs.

## Seven-day Poisson Workflow

Separate historical backtest and future forecast modes. Targets: all reports or collision-related reports. Weighting: equal event types or learned type contributions (experimental). Equal mode pools temporal count features; learned mode uses ten log-count features across five categories and two history bins. Coefficients are predictive associations, not per-event importance or causal effects.

Ridge Poisson regression with L2 search .001/.01/.1/1. Expanding-year cross-validation: 2023→2024 and 2023–2024→2025, four windows per validation year. Select by equal-fold mean per-window Poisson deviance; refit on quarterly 2023–2025 windows. 2026 outcomes never select parameters. This simulates rolling next-7/30-day forecasts, not a one-shot annual forecast. Candidates are limited to locations observed by each cutoff. Future mode has null observed outcomes/evaluation, independent map preview and separate export. Future weather is excluded.

Training can reach its 600-iteration limit; diagnostics remain visible. No model consistently beats simple historical baselines. Independent evaluation remains experimental.

## Retained Evidence

| File | Purpose |
|---|---|
| forecast-cv-7.json / forecast-cv-30.json | Cross-validation trials for equal-type all-report models |
| forecast-cv-2026-evaluation.json | Independent 2026 evaluation of the equal-type all-report model |
| collision-forecast-evaluation.json | Independent 2026 evaluation of learned-type collision model |
| data-audit.json / spatial-audit.json / weather-audit.json | Current snapshot audits |
| starter-official-comparison.json | Original 2025 starter/official comparison, retained for provenance |

Recorded next30 Top20 coverage: all-report model/rate baseline at Mar31 23/28, Jun30 36/42, Aug31 38/37; learned collision model/collision-rate/equal-count shortlist at Mar31 12/13/10, Jun30 23/28/25, Aug31 20/16/18. These are report-coverage proxies, not safety benefits. Only these recorded combinations have multi-window evaluation artifacts; availability of other target/weighting combinations does not imply recorded validation for them.

## Verification and Remaining Work

38 unit tests pass. Production build and related browser checks passed for scope drafts, gzip decoding, forecast objectives, learned effects and mode isolation; historical import/comparison/restore interactions were checked during implementation. Legacy browser assertions have been updated for the current snapshot, draft scope controls and multi-month default. Do not treat passing tests as validation of operational usefulness.

Future research: confirmed crashes/severity, verified traffic exposure, reviewed junction assignments, convergence/calibration improvements and independent prospective validation with operations feedback. Snow-route references, voice, LLM integration and live ingestion remain unimplemented.

README.md, DATA_SOURCES.md and the English DEVELOPMENT_PLAN.md provide usage, provenance and the full original development plan. Latest local changes require a push before appearing in the linked Vercel deployment.


Full regression rerun: 38 unit tests, production build, all 14 browser suites and production gzip/forecast-worker smoke check passed. `npm run test:browser` now runs the complete suite. Generated screenshots/downloads use temporary paths rather than maintained reports. Tests check application behavior; they do not establish model accuracy or operational safety.

## Annual research integration

Annual planning mode loads precomputed EB forecast through gzip, with intervals, source samples, independent units and dashboard associations based on common record IDs. No cross-unit overlap percentage is claimed. Python environment installed; full archive preparation and annual backtest/export reproduced. Leap-year ridge targets corrected, data fingerprint guards exports, simple yearly-count/rate baselines added. Five Python tests pass; Node suite remains 38 passing. Annual browser loading/source evidence/navigation check passes.

## Same-unit short-model experiment

Six 2026 next30 windows compared recent count rate, 3-year EB, converged pooled temporal Poisson and EB+recent+seasonal Poisson on 166,574 identical annual units. Expanding 2023→2024 / 2023–2024→2025 CV selects alpha; final training uses 2023–2025. Mean Top20 33.0/36.7/32.8/35.7; mean Top100 70.7/85.3/67.8/73.2. Mean deviance .1020/.0222/.0427/.0420. Hybrid improves over Poisson in 5/6 Top20 windows but does not improve over pure EB overall. Python fits converge without warnings (2/3 final iterations). Full results and tuning folds: short-model-comparison.json.

This is an exploratory offline experiment on annual units, not an exact replica of browser solver/regularization or direct evidence to replace its default. All-report targets only, 3-year EB history fixed, seasonal features limited, current geometry/publication caveats persist. Nine Python tests pass. Browser behavior was unchanged in this experiment. Further untouched evaluation and consistent location units are required before default replacement.

## PR #1 closeout verification

Annual integration and export corrections complete. Verification: 38 Node tests, nine Python tests, production build, and all 14 browser suites pass (the dashboard mobile case passed after correcting sidebar overflow). Production preview confirms native and fallback annual gzip decoding, JSON export, four-model backtest columns and gzip-only data delivery. MapLibre remains a separately loaded large chunk and produces a non-failing size warning.

Python dependencies are pinned to the reproduced environment. Stale preliminary short-comparison output was removed in favour of the six-window report. Annual mode shows scored-through dates and last-year/historical-rate baselines. Data provenance documents current-geometry, volume release-date and junction-assignment limitations; these require external/manual validation and are not marked resolved.

Pure EB remains the annual method. The short-term default is retained: EB wins several exploratory aggregate metrics but not every window or active-site error, and the Python comparison is not an exact browser-model replication. Seven-day evaluation, tuned EB history, consistent units and later uninspected validation remain explicit research gates before replacement.

## Seven-day EB validation

Same units, cutoffs and expanding-year CV as the 30-day experiment; report `short-model-comparison-7.json`. Mean Top20 rate/EB/Poisson/hybrid: 6.17/5.83/5.83/6.00; Top100: 14.17/18.33/13.17/15.00. EB has lowest deviance (0.00790), but does not win Top20 and underpredicts totals by approximately 11%. Active-site MAE favours recent rate (0.981 vs EB 1.002). Both fitted models converge with alpha 0.001. Ten Python tests pass, including seven-day outcome boundaries and rate scaling. No frontend/default-model change; these are exploratory windows, not exact browser-model predictions or prospective validation.

## Thirty-day EB default (supersedes earlier replacement gate)

The dashboard's next30 outlook now uses pure EB, precomputed by `analysis/export_short.py` on the same full-inventory road/intersection units as the comparison. Three-year history is fixed, not tuned; all report types are pooled. Six historical cutoffs and a latest-complete-date future forecast are exported to `public/data/forecast-eb30.json.gz`. Future outcomes are null. Refresh the offline pipeline to add cutoffs or newer data.

Seven-day forecasts retain browser Ridge Poisson, collision targets and experimental learned-type options. These controls do not apply to EB30. EB unit evidence is displayed independently; reactive Top20 overlap and learned-weight imports are not calculated across different unit definitions. The 30-day choice follows exploratory average gains, not uniform superiority or operational validation.

EB30 integration verification: 38 Node tests, 11 Python tests, production build and all 15 browser suites passed (the general browser suite was rerun after narrowing its duplicate-date locator). Production preview also passed EB30 fallback gzip decoding. Exported backtest Top20/deviance matches the same-unit comparison; future rows and evaluation remain null. No change to seven-day or historical ranking algorithms.

## PR #2 integration

Traffic control/crosswalk SPF features integrated, with asset arrays included in fingerprints, default-empty synthetic test inputs and empty-asset geometry handling. Preserve v2 annual export evidence/baselines and regenerate predictions from prepared assets. Monthly future evidence now includes research treatment candidates and CMF source links. Crash CMFs are not applied to all-report forecast counts; Skeletal Road class alone no longer triggers ramp-meter suggestions. The old dashboard-keyed site-controls snapshot is superseded by per-EB-unit controls embedded at each cutoff. Undated/current asset and removal-history limitations remain.

Recomputed asset-aware results: annual mean EB/ridge deviance 0.097/0.203, Top20 oracle coverage 83%/81%. Next30 mean Top20 rate/EB/Poisson/hybrid 33.0/36.83/32.83/35.33; next7 6.17/5.83/5.83/6.00. Monthly choice and seven-day retention remain unchanged. New snapshots/experiment reports share the asset-aware fingerprint.

PR #2 closeout verification: 38 Node tests, 13 Python tests, production build and all 15 browser suites pass. Production asset-aware EB/CMF evidence also passed. Synthetic CMF checks confirm no report-reduction output and no ramp inference; all replay/future snapshots regenerated against the asset-aware fingerprint.

Inspection workflow extension: monthly EB evidence shows mapped facilities and association caveats, context-aware checklist, review decision and notes. Explicit save uses local storage isolated by fingerprint/mode/cutoff/end/location; forecast export includes saved reviews. Browser verification covers save/reload/export and cutoff isolation. No shared backend or operational benefit claim. The browser runner now includes 16 suites.

Monthly map/evidence linkage and review overview: map selection opens the same EB evidence, table selection recentres an open map. Review-status badges, reviewed-count indicator and Top20-only filters preserve full map/evaluation. Filtered inspection export includes coordinates, expected counts, facilities and saved reviews. Production build and targeted review/EB/map/export regressions pass; shared map also checked for annual and seven-day workflows. Browser runner now contains 17 suites.

Demo closeout: production EB/review/filter/inspection-export smoke passed on calgary-road-intelligence.vercel.app. Top10 desk sample audit records 30/30 source-ID matches and in-history sample dates; geometric/field control validity is not established. DEMO_GUIDE.md fixes June winner/August loser windows and a signalized-site review example. Unsaved review navigation/refresh prompts added; cancel/discard browser checks pass. Browser suite runner now lists 18 suites; this closeout used targeted checks, not a new full-suite run.

Annual replay selection added: draft month-end cutoff selection with explicit Apply, separate gzip loading, fixed five-year replay history, observed-through/full-vs-partial labels and explicit outcome reveal. The global annual research table remains separate from rolling-window observation counts.

Annual replay verification: 21 month-end snapshots (2025-01-31 through 2026-09-30). 14 Python tests pass, annual draft/apply/full-partial/outcome-reset browser checks pass, production build and per-cutoff gzip smoke pass. Plain replay JSON is removed from production output; index stays plain JSON. Global annual table is not selected-window scoring.
