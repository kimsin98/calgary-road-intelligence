import { useMemo } from "react";
import { describeComparison, explain } from "./decision.mjs";
type Props = any;
export function ComparisonPanel({
  saved,
  plan,
  savedConfig,
  config,
  onSelect,
}: Props) {
  const result = useMemo(
    () => (saved ? describeComparison(saved, plan) : null),
    [saved, plan],
  );
  if (!result)
    return (
      <div className="decision-panel">
        <h2>Compare inspection plans</h2>
        <p>
          Open Analysis controls above and select “Save current plan for
          comparison”. Then adjust weights, inspection capacity, or filters to
          see which locations change. Your saved ranking and evidence remain
          available for comparison.
        </p>
      </div>
    );
  const scopeChanged = ["start", "end", "period", "category", "weather"].some(
    (key) => savedConfig[key] !== config[key],
  );
  return (
    <div className="decision-panel">
      <div className="decision-heading">
        <h2>What changed?</h2>
        <span>
          {result.entered.length} entered · {result.exited.length} exited ·{" "}
          {result.retained} retained
        </span>
      </div>
      <p>
        Saved: {savedConfig.start} ~ {savedConfig.end} · {savedConfig.period} ·{" "}
        {savedConfig.category} · {savedConfig.weather} · K=
        {savedConfig.capacity}
        <br />
        Current: {config.start} ~ {config.end} · {config.period} ·{" "}
        {config.category} · {config.weather} · K={config.capacity}
      </p>
      <p>
        {scopeChanged
          ? "Analysis scope changed: membership differences can come from the filters as well as scoring."
          : "Same analysis scope: compare the effects of scoring and inspection capacity."}{" "}
        {result.overlap !== null
          ? `Shortlist overlap: ${Math.round(result.overlap * 100)}%.`
          : "Shortlist sizes differ or are empty; an overlap percentage is not shown."}
      </p>
      <div className="change-grid">
        {result.changes.slice(0, 9).map((item: any) => (
          <button
            className="change-card"
            key={item.row.id}
            onClick={() => onSelect(item.row.id)}
          >
            <span className={`change-status ${item.status}`}>
              {item.status} · #{item.previous?.position ?? "—"} →{" "}
              {plan.rows.some((r: any) => r.id === item.row.id)
                ? `#${item.row.position}`
                : "outside scope"}
            </span>
            <strong>{item.row.name}</strong>
            <small>{item.row.id}</small>
            <p>
              {item.outsideScope
                ? "No matching records in the current analysis scope. The saved evidence is retained for reference."
                : explain(item.row)}
            </p>
            {item.previous && !item.outsideScope && (
              <p>
                {["Frequency", "Growth", "Recurrence"]
                  .map(
                    (label, i) =>
                      `${label}: ${item.previous.contributions[i].toFixed(1)} → ${item.row.contributions[i].toFixed(1)} pts`,
                  )
                  .join(" · ")}
              </p>
            )}
            {item.previous && (
              <p className="change-context">
                Score {item.previous.score.toFixed(1)} →{" "}
                {item.row.score.toFixed(1)} · Events {item.previous.count} →{" "}
                {item.row.count}
              </p>
            )}
          </button>
        ))}
      </div>
      {result.changes.length === 0 && (
        <p>No matching locations in either plan.</p>
      )}
    </div>
  );
}
export function OptimizationPanel({
  result,
  busy,
  error,
  onRun,
  onApply,
  config,
}: Props) {
  const stale =
    result &&
    ["period", "category", "weather", "capacity"].some(
      (key) => result.filters[key] !== config[key],
    );
  return (
    <div className="decision-panel">
      <div className="decision-heading">
        <h2>Automatic plan evaluation</h2>
        <button className="primary" onClick={onRun} disabled={busy}>
          {busy ? "Evaluating 21 plans…" : "Evaluate candidate plans"}
        </button>
      </div>
      <p>
        Search 21 weight combinations across six 90-day windows in 2023–2025.
        Freeze the winner, then independently check July 1–30, 2026 events using
        history ending June 30, 2026. The selected date window is used when
        applying the result, not for the historical search.
      </p>
      <p className="hint">
        Objective: cover more subsequent recorded events at the same inspection
        capacity. Ties favour event frequency. This is retrospective evidence,
        not a safety prediction; repeated experiments on this validation window
        are exploratory.
      </p>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <div className="optimization-summary">
            <div>
              <span>Selected frequency / growth / recurrence</span>
              <strong>
                {result.weights
                  .map((w: number) => Math.round(w * 100) + "%")
                  .join(" / ")}
              </strong>
            </div>
            <div>
              <span>Search-window event coverage</span>
              <strong>
                {result.candidates[0].covered} / {result.tuningTotal}
              </strong>
            </div>
            <div>
              <span>Validation coverage · model vs baseline</span>
              <strong>
                {result.validation.candidate} vs {result.validation.baseline}
              </strong>
            </div>
          </div>
          <p className="notice">
            {result.validation.total === 0
              ? "No validation events match these filters; there is no evidence to compare."
              : result.validation.candidate > result.validation.baseline
                ? "Selected weights cover more recorded events in this single validation window. More independent periods are needed to establish a stable benefit."
                : result.validation.candidate === result.validation.baseline
                  ? "The selected plan ties the count baseline in validation. This result does not establish an improvement."
                  : "The selected plan performs worse than the count baseline in validation. Keep the baseline as a serious alternative."}
          </p>
          <p>
            Evaluated for {result.filters.period} · {result.filters.category} ·{" "}
            {result.filters.weather} · K={result.filters.capacity}.{" "}
            {stale ? "Controls have changed. Run again before applying." : ""}
          </p>
          <button disabled={stale || busy} onClick={onApply}>
            Save current plan & apply selected weights
          </button>
          <details>
            <summary>Inspect all 21 candidates and search evidence</summary>
            <table>
              <thead>
                <tr>
                  <th>Weights F / G / R</th>
                  <th>May coverage</th>
                  <th>August coverage</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((c: any) => (
                  <tr key={c.weights.join(",")}>
                    <td>
                      {c.weights
                        .map((w: number) => Math.round(w * 100))
                        .join(" / ")}
                    </td>
                    {c.windows.map((w: any) => (
                      <td key={w.end}>
                        {w.candidate} / {w.total}{" "}
                        <small>(count {w.baseline})</small>
                      </td>
                    ))}
                    <td>{c.covered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
export function LocationCharts({ row, start, end }: Props) {
  const stats = useMemo(() => {
    const months = new Map<string, number>();
    for (let t = start.slice(0, 7); t <= end.slice(0, 7);) {
      months.set(t, 0);
      const [y, m] = t.split("-").map(Number);
      t = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
    }
    const categories = new Map<string, number>();
    for (const record of row.records) {
      const month = record.date.slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + 1);
      categories.set(
        record.category,
        (categories.get(record.category) ?? 0) + 1,
      );
    }
    return {
      months: [...months],
      categories: [...categories].sort((a, b) => b[1] - a[1]),
    };
  }, [row, start, end]);
  const max = Math.max(1, ...stats.months.map((m) => m[1]));
  return (
    <div className="location-charts">
      <div>
        <h3>Monthly event pattern</h3>
        <p className="hint">
          Within the selected window; edge months may be partial.
        </p>
        <div
          className="monthly-bars"
          role="img"
          aria-label={stats.months
            .map(([m, n]) => `${m}: ${n} events`)
            .join(", ")}
        >
          {stats.months.map(([month, count]) => (
            <div
              className="month-column"
              key={month}
              title={`${month}: ${count} events`}
            >
              <span>{count}</span>
              <div className="month-track">
                <i style={{ height: `${(count / max) * 100}%` }} />
              </div>
              <small>{month.slice(5)}</small>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3>Event categories</h3>
        {stats.categories.map(([category, count]) => (
          <div className="category-row" key={category}>
            <span>{category}</span>
            <strong>{count}</strong>
            <div>
              <i style={{ width: `${(count / row.count) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
