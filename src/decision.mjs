import { rank, selectEvents, compare } from "./analysis.mjs";
const DAY = 86400000;
export const SEARCH_ENDS = [
  "2023-06-30",
  "2023-11-30",
  "2024-06-30",
  "2024-11-30",
  "2025-04-30",
  "2025-07-31",
];
export const TEST_END = "2026-06-30";
export function scoreWindow(events, locations, config, end) {
  const cutoff = Date.parse(end + "T00:00:00Z");
  const date = (offset) =>
    new Date(cutoff + offset * DAY).toISOString().slice(0, 10);
  const plan = rank(events, locations, { ...config, start: date(-89), end });
  const future = selectEvents(events, {
    ...config,
    start: date(1),
    end: date(30),
  });
  const count = (rows) => {
    const ids = new Set(rows.map((r) => r.id));
    return future.filter((e) => ids.has(e.location)).length;
  };
  return {
    end,
    start: date(-89),
    futureStart: date(1),
    futureEnd: date(30),
    total: future.length,
    candidate: count(plan.top),
    baseline: count(plan.baselineTop),
    size: plan.top.length,
  };
}
export function optimize(events, locations, config) {
  const candidates = [];
  // Deterministic simplex grid; count-only wins ties, so complexity needs evidence.
  for (let frequency = 5; frequency >= 0; frequency--)
    for (let growth = 0; growth <= 5 - frequency; growth++) {
      const weights = [frequency / 5, growth / 5, (5 - frequency - growth) / 5];
      const windows = SEARCH_ENDS.map((end) =>
        scoreWindow(events, locations, { ...config, weights }, end),
      );
      candidates.push({
        weights,
        windows,
        covered: windows.reduce((s, w) => s + w.candidate, 0),
      });
    }
  candidates.sort(
    (a, b) =>
      b.covered - a.covered ||
      b.weights[0] - a.weights[0] ||
      a.weights[1] - b.weights[1],
  );
  const winner = candidates[0];
  // Final window is evaluated only after the search has selected and frozen weights.
  const validation = scoreWindow(
    events,
    locations,
    { ...config, weights: winner.weights },
    TEST_END,
  );
  return {
    weights: winner.weights,
    candidates,
    validation,
    filters: {
      period: config.period,
      category: config.category,
      weather: config.weather,
      capacity: config.capacity,
      typeWeights: config.typeWeights ?? null,
      typeWeightMode: config.typeWeightMode ?? null,
    },
    tuningTotal: winner.windows.reduce((s, w) => s + w.total, 0),
    version: "bounded-search-v2",
  };
}
const signals = ["frequency", "recent growth", "recurring dates"];
export function explain(row) {
  const dominant = row.contributions.indexOf(Math.max(...row.contributions));
  return `${row.count} events on ${row.days} dates; last 30 days ${row.recent} vs ${row.previous} in the preceding 30. ${signals[dominant]} contributes most (${row.contributions[dominant].toFixed(1)} points).${row.lowEvidence ? " Limited evidence: fewer than 3 events." : ""}`;
}
export function describeComparison(before, after) {
  const membership = compare(before, after),
    previous = new Map(before.rows.map((r) => [r.id, r]));
  const retained = after.top
    .filter((r) => previous.has(r.id) && before.top.some((x) => x.id === r.id))
    .map((row) => ({
      row,
      previous: previous.get(row.id),
      status: "retained",
      delta: previous.get(row.id).position - row.position,
    }));
  return {
    ...membership,
    overlap:
      before.top.length === after.top.length && after.top.length
        ? membership.retained / after.top.length
        : null,
    changes: [
      ...membership.entered.map((row) => ({
        row,
        previous: previous.get(row.id),
        status: "entered",
        delta: previous.has(row.id)
          ? previous.get(row.id).position - row.position
          : null,
      })),
      ...membership.exited.map((row) => ({
        row: after.rows.find((x) => x.id === row.id) ?? row,
        outsideScope: !after.rows.some((x) => x.id === row.id),
        previous: row,
        status: "exited",
        delta: after.rows.some((x) => x.id === row.id)
          ? row.position - after.rows.find((x) => x.id === row.id).position
          : null,
      })),
      ...retained.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    ],
  };
}
