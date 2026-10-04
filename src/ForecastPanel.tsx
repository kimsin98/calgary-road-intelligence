import type { Dataset, ForecastInput, ForecastResult } from "./domain/types";
import { ForecastMap } from "./components/ForecastMap";
import { downloadJson } from "./domain/download";
import { useState } from "react";
import { useWorkerTask } from "./hooks/useWorkerTask";
export function ForecastPanel({
  data,
  onSelect,
}: {
  data: Dataset;
  onSelect: (id: string) => void;
}) {
  const [mode, setMode] = useState<"backtest" | "future">("backtest");
  const [cutoff, setCutoff] = useState("2026-06-30"),
    [horizon, setHorizon] = useState(30),
    [revealed, setRevealed] = useState(false);
  const {
    result,
    busy,
    error,
    run: runTask,
  } = useWorkerTask<ForecastInput, ForecastResult>(
    () =>
      new Worker(new URL("./forecast-worker.ts", import.meta.url), {
        type: "module",
      }),
  );
  const effectiveCutoff = mode === "future" ? data.audit.last : cutoff;
  const stale =
    result &&
    (result.cutoff !== effectiveCutoff ||
      result.horizon !== horizon ||
      result.mode !== mode);
  function run() {
    setRevealed(false);
    runTask({
      events: data.events,
      locations: data.locations,
      config: {
        cutoff: effectiveCutoff,
        horizon,
        capacity: 20,
        mode,
        dataEnd: data.audit.last,
      },
    });
  }
  return (
    <div className="decision-panel">
      <div className="decision-heading">
        <h2>Forward outlook</h2>
        <span>EXPERIMENTAL / POISSON MODEL</span>
      </div>
      <p>
        Estimate future traffic-event reports at known locations using only
        evidence available at the cutoff. This demo uses all event types and all
        hours, independently of the reactive analysis filters.
      </p>
      <div
        className="notice"
        role="note"
        aria-label="Experimental forecast limitation"
      >
        <strong>Experimental demo</strong>
        <p>
          The expanded model has not consistently outperformed simple historical
          baselines in independent 2026 backtests. Use it to explore possible
          priorities; it is not validated for operational decisions or
          crash-risk prediction.
        </p>
      </div>
      <div className="forecast-modes" role="group" aria-label="Forecast mode">
        <button
          aria-pressed={mode === "backtest"}
          onClick={() => {
            setMode("backtest");
            setRevealed(false);
          }}
        >
          Historical backtest
        </button>
        <button
          aria-pressed={mode === "future"}
          onClick={() => {
            setMode("future");
            setRevealed(false);
          }}
        >
          Future forecast
        </button>
      </div>
      <p className="notice">
        {mode === "backtest"
          ? "Replay a historical cutoff, then reveal later observations to evaluate the prediction."
          : "Predict from the latest dataset date: " +
            data.audit.last +
            ". This snapshot is not live; future outcomes are unavailable, so accuracy and coverage cannot yet be evaluated."}
      </p>
      <div className="forecast-controls">
        <label>
          {mode === "backtest" ? "Historical cutoff" : "Latest data cutoff"}
          <input
            aria-label="Forecast cutoff"
            type="date"
            min="2026-01-01"
            max={new Date(
              Date.parse(data.audit.last + "T00:00:00Z") - horizon * 86400000,
            )
              .toISOString()
              .slice(0, 10)}
            value={effectiveCutoff}
            disabled={mode === "future"}
            onChange={(e) => setCutoff(e.target.value)}
          />
        </label>
        <label>
          Forecast window
          <select
            aria-label="Forecast horizon"
            value={horizon}
            onChange={(e) => setHorizon(+e.target.value)}
          >
            <option value={7}>Next 7 days</option>
            <option value={30}>Next 30 days</option>
          </select>
        </label>
        <button disabled={busy} onClick={run}>
          {busy ? "Training & predicting…" : "Generate forecast"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {stale && (
        <p className="notice">Settings changed. Generate a new forecast.</p>
      )}
      {result && !stale && (
        <>
          <button
            onClick={() =>
              downloadJson(
                {
                  version: result.version,
                  createdAt: new Date().toISOString(),
                  datasetAudit: data.audit,
                  forecast: result,
                },
                "calgary-forecast-report.json",
              )
            }
          >
            Export forecast report
          </button>
          <p>
            Forecast period: day after {result.cutoff} through {result.end}.
            Fractional counts are expected report activity, not guaranteed
            events or crash probabilities.
          </p>
          <div className="optimization-summary">
            <div>
              <span>Expected reports at model Top 20</span>
              <strong>
                {result.top.reduce((s, r) => s + r.predicted, 0).toFixed(1)}
              </strong>
            </div>
            <div>
              <span>Training / tuning</span>
              <strong>2023–25 / rolling CV</strong>
            </div>
            <div>
              <span>Selected regularization</span>
              <strong>{result.lambda}</strong>
            </div>
          </div>
          <section
            className="forecast-comparison"
            aria-label="Forecast comparison"
          >
            <h3>What changes from historical priorities?</h3>
            <p>
              Same 90-day evidence: {result.comparison.start} ~ {result.cutoff},
              all hours and types. Historical weights: frequency 50%, growth
              30%, recurring dates 20%. Later outcomes do not determine either
              ranking.
            </p>
            <div className="optimization-summary">
              <div>
                <span>Shared with historical Top 20</span>
                <strong>
                  {result.comparison.retained} / {result.top.length}
                </strong>
              </div>
              <div>
                <span>Shared with rate Top 20</span>
                <strong>
                  {result.comparison.rateRetained} / {result.top.length}
                </strong>
              </div>
              <div>
                <span>New model priorities</span>
                <strong>
                  {
                    result.comparison.changes.filter(
                      (r) => r.direction === "entered",
                    ).length
                  }
                </strong>
              </div>
            </div>
            {result.comparison.changes.length === 0 && (
              <p>The two shortlists contain the same locations.</p>
            )}
            <details>
              <summary>
                Explain shortlist changes ({result.comparison.changes.length})
              </summary>
              {result.comparison.changes.map((r) => (
                <article key={r.id} className="forecast-change">
                  <strong>
                    {r.direction === "entered" ? "Added" : "Removed"} · {r.name}
                  </strong>
                  <p>
                    Historical rank {r.reactiveRank ?? "outside active history"}{" "}
                    → forecast rank {r.forecastRank ?? "not available"}.{" "}
                    {r.explanation}
                  </p>
                </article>
              ))}
            </details>
          </section>
          <ForecastMap result={result} />
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Past 90 days</th>
                <th>Expected reports</th>
                <th>Rate baseline</th>
                {revealed && <th>Actual reports</th>}
              </tr>
            </thead>
            <tbody>
              {result.top.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="forecast-location"
                      onClick={() => onSelect(r.id)}
                    >
                      {r.name}
                    </button>
                    <small>{r.id}</small>
                  </td>
                  <td>{r.count}</td>
                  <td>{r.predicted.toFixed(2)}</td>
                  <td>{r.baseline.toFixed(2)}</td>
                  {revealed && <td>{r.target}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {result.evaluation && (
            <button onClick={() => setRevealed((v) => !v)}>
              {revealed ? "Hide later outcomes" : "Reveal what happened next"}
            </button>
          )}
          {revealed && result.evaluation && (
            <div className="notice">
              <p>
                Later reports: {result.evaluation.total}. Model Top 20 coverage:{" "}
                {result.evaluation.modelCoverage}; rate-baseline Top 20:{" "}
                {result.evaluation.baselineCoverage}; historical Top 20:{" "}
                {result.evaluation.reactiveCoverage}.
              </p>
              <p>
                Known locations: {result.evaluation.knownLocations}. Later
                reports at unseen locations: {result.unseenFutureEvents}.
                Expected / observed reports at known locations:{" "}
                {result.evaluation.modelExpected.toFixed(1)} /{" "}
                {result.evaluation.total}.
              </p>
              <p>
                Poisson deviance: model{" "}
                {result.evaluation.modelDeviance.toFixed(3)} vs rate baseline{" "}
                {result.evaluation.baselineDeviance.toFixed(3)}. Lower is
                better. All-zero reference MAE:{" "}
                {result.evaluation.zeroMAE.toFixed(3)}.
              </p>
              <p>
                Mean absolute count error across known locations: model{" "}
                {result.evaluation.modelMAE.toFixed(3)} vs baseline{" "}
                {result.evaluation.baselineMAE.toFixed(3)}. Lower is better.
                Sparse zero-event locations dominate this metric; interpret it
                alongside shortlist coverage.
              </p>
              <p>
                {result.evaluation.modelCoverage >
                result.evaluation.baselineCoverage
                  ? "The model covers more later reports in this window."
                  : "The model does not beat the baseline on shortlist coverage in this window."}{" "}
                One period does not establish reliable improvement.
              </p>
            </div>
          )}
          <details>
            <summary>Time-based cross-validation results</summary>
            <p>
              Train 2023 → validate 2024; train 2023–2024 → validate 2025. Four
              historical forecast windows per validation year. Select
              regularization by mean Poisson deviance, then refit on 2023–2025.
              The 2026 test year is excluded from parameter selection.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Regularization</th>
                  <th>2024 fold deviance</th>
                  <th>2025 fold deviance</th>
                  <th>Mean deviance</th>
                </tr>
              </thead>
              <tbody>
                {result.crossValidation.trials.map((t) => (
                  <tr key={t.lambda}>
                    <td>
                      {t.lambda}
                      {t.lambda === result.lambda ? " · selected" : ""}
                    </td>
                    {t.folds.map((f) => (
                      <td key={f.validationYear}>{f.deviance.toFixed(3)}</td>
                    ))}
                    <td>{t.validationDeviance.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Lower deviance is better. Inputs at each validation cutoff may use
              earlier reports from that validation year, simulating rolling
              7/30-day forecasts rather than a one-shot annual forecast.
            </p>
          </details>
          <details>
            <summary>Model and validation details</summary>
            <p>
              Training: {result.diagnostics.iterations} iterations ·{" "}
              {result.diagnostics.converged
                ? "converged"
                : "iteration limit or numerical stop reached"}{" "}
              · gradient norm {result.diagnostics.gradientNorm.toExponential(2)}
              . Regularization selected by validation Poisson deviance.
            </p>
            <p>
              Shared ridge-regularized Poisson regression; inputs are log event
              counts over 1–7, 8–14, 15–30 and 31–90 days, recurring dates, and
              recent share. Expanding-year cross-validation selects
              regularization using 2024 and 2025 only. The final model fits
              quarterly 2023–2025 windows and stays frozen for independent 2026
              backtests. Future weather is excluded.
            </p>
            <p>
              Baseline: 90-day count × horizon / 90. No pseudo-count smoothing
              is applied. Candidate locations are limited to those observed by
              each historical cutoff. Later events at unseen locations are
              reported separately; current road geometry remains a historical
              limitation. Repeated test-window exploration is not independent
              validation.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
