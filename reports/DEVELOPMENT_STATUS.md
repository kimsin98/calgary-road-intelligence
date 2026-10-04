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
