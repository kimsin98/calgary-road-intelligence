# Current development status

Updated 2026-10-03. The authorized refactor and proactive workflow batch is complete.

- Reactive workflow: explicit analysis scope, ranked inspection shortlist, evidence search/review, optimized weights, plan comparison and versioned JSON report.
- Proactive workflow: ridge Poisson model, cutoff-known candidates, training/tuning/test separation, count-rate baseline, zero-reference MAE, deviance, totals and Top20 coverage. Same-cutoff 90-day historical ranking comparison, shortlist membership changes and fitted feature explanations. Independent on-demand map preview excludes future outcomes; forecast export remains separate. Later outcomes require explicit reveal in the interface.
- Architecture: dataset/config validation, graceful weather fallback and retry, request-sequenced workers, persistent saved-plan configuration with dataset-version guard, page routing, extracted pages/controls/map/playback hooks. Traffic events, road locations, ranked plans, dataset, forecast worker/results and map motion state have explicit TypeScript contracts. Flexible audit metadata and some legacy presentation boundaries remain permissive; this is not a claim of complete any elimination.
- Styles: removed 223 superseded exact-selector/property declarations within matching conditional scope, preserving surviving rule order. App CSS build: 56.85 KB, separate MapLibre CSS: 69.94 KB. Existing dashboard interactions retained.
- Delivery: production build includes separately emitted worker assets and dynamically loaded map engine. MapLibre's 1.06 MB engine produces the expected advisory warning; analysis-only navigation does not load the engine.

## Verification

30 unit tests pass, including forecast comparison outcome independence. Browser checks pass for navigation/deep links, evidence, preview/fullscreen/mobile, persistent saved-plan restore/clear, lazy map initialization, optimization/comparison/export/stale controls, and forecast generation/map opening/outcome reveal. See reports/forecast-v3-evaluation.json for freshly generated four-window results. Older forecast-v1/v2 files are historical artifacts, not current evidence.

## Evaluation limits

Top20 later report coverage (model / rate / historical): Oct31 next7 = 6/5/5; Oct31 next30 = 21/20/23; Nov30 next7 = 6/6/8; Nov30 next30 = 20/21/23. The model does not consistently outperform simple priorities. These are event reports, not verified crash or safety probabilities. Current geometry and event-derived candidates constrain prospective interpretation; unseen future locations are reported separately. Feature contributions describe the fitted model, not causal effects. Repeated demo-window exploration is not independent validation.

## Future research, outside this completed batch

Independent road/junction candidate inventory; reviewed spatial associations; more years and genuinely prospective holdouts; verified exposure and confirmed crash severity; model calibration and overdispersion assessment. Weather scenarios, snow routes and voice narration require a concrete decision use before implementation.

## Forecast modes — 2026-10-04

Forward outlook now separates Historical backtest and Future forecast. Backtest preserves historical cutoff controls and explicit later-outcome reveal; the supplied snapshot end must cover the whole test horizon. Future forecast fixes the cutoff to the snapshot's latest date (currently 2025-12-31), predicting through 2026-01-07 or 2026-01-30. It is not a live October 2026 forecast. Future reports export mode/dataEnd and null outcome/evaluation fields, rather than implying missing future records are zeros. The independent map and historical shortlist comparison work in both modes. The fitted training/tuning schedule remains fixed in 2025; updating data does not automatically retrain that schedule. Unit suite: 31 passing tests; production build passes.

## Expanded official snapshot — 2026-10-04

Supersedes previous single-year snapshot/model schedule. 27,805 reports, 9,661 road/grid locations, local dates 2022-12-31 through 2026-10-03 (UTC query January 2023 through download time). 2026 is incomplete, including the latest reporting day. No rejected/duplicate records. Full JSON 24.72 MB, gzip 3.65 MB. Default reactive/map window is latest 90 days; controls expose the entire snapshot. UTC joins and America/Edmonton display/filter rules are retained. Weather coverage remains 2025 only and is disclosed; other years have missing observations, not assumed clear conditions.

Forecast v5: fit on quarterly 2023–2024 windows and March/June 2025; internally tune regularization on Aug/Sep/Nov 2025. Training/tuning outcomes end within 2025. 2026 windows are evaluated only after parameter selection, never used to select coefficients. Backtest date limit is January 1, 2026 through latest data date minus selected horizon. Future cutoff is latest local data date (Oct3) predicting through Oct10/Nov2. Shared feature-vector Poisson sufficient-statistic aggregation preserves the count objective and regularization while reducing repeated sparse-location computation; Node forecast ~1 second per request on this machine. Convergence still reaches 600 iterations, explicitly reported.

Independent next30 Top20 coverage (model / frequency baseline / historical priorities): Mar31 28/28/26; Jun30 36/42/36; Aug31 38/37/28. No consistent superiority; calibration/MAE also remain limitations. See forecast-2026-evaluation.json. Automatic reactive weight search now uses six 2023–2025 windows, with June30 2026 independent check; historical evaluation uses March/May/July 2026 windows. All older numerical reports and browser fixtures with fixed 2025 counts refer to the prior snapshot.

## Multi-year weather and gzip deployment — 2026-10-04

Supersedes 2025-only weather limitations. ECCC station 50430 monthly downloads cover January 2023 through October 2026; future rows in the current month are excluded. 32,922 unique UTC hours; 54 missing temperature/visibility readings remain null. Every traffic record with local year 2023–2026 joins a station hour (not necessarily a complete measurement). Seven retained local-2022 UTC-boundary events have no station hour. Airport context is not road-surface evidence; future weather is still excluded from the forecast model.

Build generates level-9 gzip snapshots and removes uncompressed copies from dist. Deployment traffic data 3.56 MB (24.72 MB JSON), weather 0.45 MB (5.45 MB JSON); combined ~4.01 MB. Browser loads .json.gz assets, detects gzip magic bytes, uses native DecompressionStream or lazy fflate fallback; already HTTP-decoded JSON is accepted without double decompression. Compression reduces transfer/storage, not parsed JavaScript memory. Vercel must receive pipelines/compress-data.mjs, explicitly included by .vercelignore. No Content-Encoding header is forced on opaque gzip assets.

Build and 33 unit tests pass; native/fallback gzip browser loading and weather page pass. Source JSON remains available to offline pipelines and tests. Earlier reports/documentation refer to prior snapshots.

## Expanding-year parameter cross-validation — 2026-10-04

Forecast v6 supersedes the earlier fixed late-2025 tuning schedule. Fold 1 fits quarterly 2023 windows and evaluates quarterly 2024 windows; fold 2 fits quarterly 2023–2024 windows and evaluates quarterly 2025 windows. Cutoffs Mar31/Jun30/Sep30/Nov30 ensure targets end inside their year. Known candidates and input features are reconstructed at each cutoff. Later validation-year reports may become inputs for subsequent cutoffs, explicitly simulating rolling 7/30-day forecasting, not one-shot annual prediction. Select L2 strength among .001/.01/.1/1 using equal-fold mean per-window Poisson deviance. Freeze selected lambda and refit on all 12 quarterly 2023–2025 windows; 2026 outcomes cannot select parameters. UI and exports show folds/trials, and independent 2026 results remain separate.

Both horizons selected .001. Independent Top20 coverage model/rate: next7 Mar31 3/6, Jun30 10/10, Aug31 4/4; next30 Mar31 23/28, Jun30 36/42, Aug31 38/37. No consistent improvement. Node request ~1.4–1.5 seconds. Reports: forecast-cv-7.json, forecast-cv-30.json, forecast-cv-2026-evaluation.json. Convergence limitations remain disclosed. Build, 34 unit tests (including fold chronology and outcome independence), and forecast browser generation/reveal checks pass.
