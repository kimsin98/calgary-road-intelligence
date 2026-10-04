# Product and Architecture Review

Reviewed against the reactive/proactive development plan and current source on October 3, 2026. This is an audit and proposed sequence; no application behavior was changed. All 20 current unit tests pass. Passing tests do not cover the findings below.

## First principles

The product exists to help choose a limited number of locations for investigation. Correct evidence, an explicit decision objective, reproducible scope, and reviewable uncertainty matter more than additional dashboard pages or model complexity. Separate observed history, predictions, and later outcomes. Interface changes must never silently change analysis scope.

## High-priority correctness findings

1. Playback scope crosses page boundaries (`src/main.tsx`, activeConfig/page-change effect). Leaving Map preview stops playing but retains playDate. Every reactive page continues ranking against that playback date. Evidence date controls still show config.end, making displayed controls and actual scope disagree. Separate preview cutoff from analysis configuration; analysis pages must use explicit config. Test play/scrub → navigate → compare/export.
2. Async optimizer application race (`main.tsx`, runOptimization/OptimizationPanel). Result staleness checks current controls, but the Apply handler copies the render's config. If controls change while the worker runs, the render generally protects against mismatched filters; however the request/result identity is not formalized and dataset versions are not checked. Use request IDs, dataset versions and immutable request configs rather than relying on render timing. Forecast errors can leave an older same-config result visible; invalidate or explicitly mark the retained result.
3. Forecast evaluation is insufficient (`forecast.mjs`). All four recorded windows have a zero-count forecast MAE lower than model MAE. November30 next30: model .262, smoothed rate .439, zero .201. Sparse zeros explain this; lower MAE versus the current comparator does not establish useful count prediction. Add unsmoothed rate, zero-reference MAE, Poisson deviance/log score, predicted-versus-observed totals, active-location metrics and TopK coverage. Do not use zero predictions as an arbitrary TopK ranking. The +.5 per-location pseudo-count adds ~684 expected reports over 30 days across 4,105 locations, so smoothing needs training-only calibration.
4. Forecast candidate inventory uses full-year event-derived locations (`forecast.mjs`, examples). Locations not yet observed at a historical cutoff are already in training/evaluation. This is documented but prevents clean prospective interpretation. Use a independently defined full-road inventory or a candidate set known at each cutoff; report events at unseen future locations separately. Future-outcome tests currently keep locations fixed and miss this selection leakage.
5. Poisson training has no convergence diagnostics (`forecast.mjs`, fit). Fixed 350 steps, fixed learning rate and clipped linear predictor provide no evidence optimization converged. Report penalized loss/gradient convergence and verify on synthetic known-parameter counts. Tune with count-distribution metrics and assess overdispersion before switching model families.
6. All-zero ranking weights are accepted (`analysis.mjs`, rank). Scores become zero and TopK is decided by ID. Growth-only weights on a short window produce the same issue after growth is disabled. Reject invalid effective weights or explicitly fall back to the count baseline. Validate dates, capacity, enums and finite weights at one boundary.
7. Animation state can miss count/flash updates (`main.tsx`, point-motion RAF). The RAF skip condition considers visibility/priority/flash but not a new flashAt or changed count. An already settled point can fail to brighten or refresh its feature-state count. Keep explicit dirty/version flags and schedule work only for dirty IDs. Also ensure removed motion state is cleaned after fades, without waiting for another plan update.
8. Comparison explanations for locations outside the new scope reuse old rows (`decision.mjs`, describeComparison). The UI can show unchanged score/count beside 'outside scope', which suggests a new measured value exists. Represent before/after separately with nullable after data and explain filter exclusion. All-zero contributions must not be described as frequency contributing most.
9. Navigation from forecast to Evidence uses current reactive filters (`main.tsx`, onSelect/focus). If a forecast location is outside current filters, focus falls back to another location silently. Use explicit evidence scope or a 'not in current view' state; preserve selected ID and show why it has no records.
10. Data integrity is not validated at load. JSON parsing succeeds without checking schema, date range, references or matching weather version. Fetch failure has no retry/partial-data fallback. Validate inputs; weather failure should permit core traffic analysis with an explicit availability state.

## Architecture findings and targeted refactor

`main.tsx` is ~34 KB despite only 79 lines: most JSX and effects are compressed. It owns data loading, routing, filters, summaries, workers, exports, map layers, animation, playback, fullscreen and shell rendering. This couples unrelated updates and makes tests/reviews difficult. Strict TypeScript is enabled but pervasive `any`, unchecked JS, and untyped worker messages bypass most protection.

CSS is ~63 KB with extensive appended selectors and media overrides. Layout intent is encoded in cascade order, including superseded hero and sidebar rules. This caused repeated alignment regressions. A deleted hero component and `.brand` pointer effect remain unused. MapLibre is eagerly loaded on every page; hidden-map RAF still scans all point states at 20 Hz. Forecast retrains on every cutoff request and loses page-local results when unmounted.

Recommended structure, without adding a backend/global-state dependency:

- app/: DashboardShell, page registry (ID/title/control capabilities/summary contract), navigation hook.
- pages/: MapPreview, Evidence, PlanComparison, AutomaticEvaluation, ForwardOutlook, Weather, DataMethod.
- domain/: typed Event/Location/AnalysisConfig/SavedPlan/DatasetVersion and pure scope/ranking/comparison functions.
- hooks/: dataset loading, reactive plan, persistent forecast session, typed worker task, playback, fullscreen.
- map/: MapPreview component, layer setup, feature animation controller with explicit dirty state.
- forecast/: feature construction, model fit/predict, tuning and evaluation as separate pure functions; cached fitted artifacts per dataset/horizon/training configuration.
- styles/: tokens, shell, controls, map, page components. Remove old rules only after preserving reviewed visual snapshots.

Use one immutable saved-plan object containing configuration, dataset version and results rather than separate saved/savedConfig state. Version report exports. Make export page-aware; current header export on Forward outlook exports the reactive plan rather than the visible forecast.

Do not migrate to Redux, add a database/API, or replace MapLibre solely for cleanup. Dynamic-import map code and lazy-mount it when preview first opens; pause animation when hidden. Keep local snapshots and existing fast playback behavior.

## Product additions worth doing

1. Complete the proactive decision loop: prediction explanations, model versus rate/reactive Top20 overlap and three change examples, selection in a forecast map preview, forecast-specific report export. Predictions currently live only in a table.
2. Build an honest validation page: fixed multiple historical cutoffs, candidate-universe disclosure, stronger baselines, coverage/total calibration/probabilistic metrics, and uncertainty backed by evaluation rather than arbitrary labels. Model does not consistently win Top20 coverage.
3. Reproducible analyst workflow: named saved plans, data/config version, stable export/import and concise human-readable brief. Current saved plans disappear on refresh.
4. Improve location unit before adding more features: human review of representative junction/parallel flags, then test junction/grid aggregation against road segments. 5,560/7,015 records have review or unmatched flags; flags are not confirmed errors.
5. Delivery: fixed demo scenarios, reactive→proactive narrative, current screenshots, backup video, attribution and clear future-data requirements.

Weather scenarios, snow-clearing reference, ElevenLabs and LLM remain optional. They should follow evidence/state fixes, not obscure model limitations. Additional data should be justified by a measurable decision need.

## Execution order

A. Fix scope/selection/export correctness and baseline/evaluation issues; add regression tests.
B. Format source, introduce domain types, consolidate saved plans and typed worker requests.
C. Extract shell/pages/controls; isolate map/playback. Preserve visual and interaction behavior.
D. Consolidate CSS and pause/lazy-load inactive work; validate performance with actual profiling.
E. Add forecast comparison/explanations/export and finalize demo evidence.

Unit verification: boundaries, effective weights, candidate inventory, outcome separation, known synthetic model, outside-scope comparison. Browser verification: playback→page→export, search selection under filters, forecast navigation, worker stale results/errors, collapsed sidebar, fullscreen and mobile. Existing tests assume some superseded controls/copy and must be updated to the page capability contract. Current unit results are evidence for covered behavior only, not proof all browser paths pass today.

## Final batch, 2026-10-03

The remaining CSS/types/proactive workflow items have been delivered. See DEVELOPMENT_STATUS.md for the current implementation and verification, and forecast-v3-evaluation.json for refreshed numerical evidence. Original findings above describe the pre-refactor state; they should not be read as an assertion that every original issue is still present. Further model/data research remains necessary before operational use.
