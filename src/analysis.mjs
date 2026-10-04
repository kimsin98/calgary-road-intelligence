import { validateConfig } from "./domain/config.mjs";
import { effectiveWeights } from "./domain/scope.mjs";
import { weatherMatches } from "./weather-match.mjs";
const day = 86400000;
const locationIndexes = new WeakMap();
const dateNumbers = new Map();
const dateNumber = (date) => {
  let value = dateNumbers.get(date);
  if (value === undefined) {
    value = Date.parse(date + "T00:00:00Z");
    dateNumbers.set(date, value);
  }
  return value;
};
export const defaults = {
  start: "2025-01-01",
  end: "2025-12-31",
  period: "All hours",
  category: "All types",
  weather: "All weather",
  capacity: 20,
  weights: [0.5, 0.3, 0.2],
};
export function selectEvents(events, c) {
  return events.filter(
    (e) =>
      e.date >= c.start &&
      e.date <= c.end &&
      weatherMatches(e.weather, c.weather) &&
      (c.category === "All types" || e.category === c.category) &&
      (c.period === "All hours" ||
        (c.period === "Morning peak" &&
          e.hour >= 7 &&
          e.hour < 10 &&
          !e.weekend) ||
        (c.period === "Evening peak" &&
          e.hour >= 16 &&
          e.hour < 19 &&
          !e.weekend) ||
        (c.period === "Night" && (e.hour >= 22 || e.hour < 6)) ||
        (c.period === "Weekend" && e.weekend)),
  );
}
export function rank(events, locations, c) {
  validateConfig(c);
  const chosen = selectEvents(events, c),
    groups = new Map();
  const cutoff = Date.parse(c.end + "T00:00:00Z");
  const complete = Date.parse(c.start + "T00:00:00Z") <= cutoff - 59 * day;
  for (const e of chosen) {
    if (!groups.has(e.location))
      groups.set(e.location, {
        id: e.location,
        count: 0,
        recent: 0,
        previous: 0,
        days: new Set(),
        records: [],
      });
    const g = groups.get(e.location);
    g.count++;
    g.days.add(e.date);
    g.records.push(e);
    const ago = (cutoff - dateNumber(e.date)) / day;
    if (ago >= 0 && ago < 30) g.recent++;
    else if (ago >= 30 && ago < 60) g.previous++;
  }
  let index = locationIndexes.get(locations);
  if (!index) {
    index = new Map(locations.map((l) => [l.id, l]));
    locationIndexes.set(locations, index);
  }
  const rows = [...groups.values()].map((g) => ({
    ...index.get(g.id),
    ...g,
    days: g.days.size,
    growth: complete ? (g.recent - g.previous) / (g.previous + 3) : 0,
  }));
  const maxLog = Math.max(1, ...rows.map((r) => Math.log1p(r.count))),
    maxDays = Math.max(1, ...rows.map((r) => r.days));
  const effective = effectiveWeights(c.weights, complete),
    w = effective.weights,
    sum = w.reduce((a, b) => a + b, 0);
  for (const r of rows) {
    r.features = [
      Math.log1p(r.count) / maxLog,
      complete ? Math.max(0, Math.min(1, r.growth / 2)) : 0,
      r.days / maxDays,
    ];
    r.contributions = r.features.map((v, i) => (100 * v * w[i]) / sum);
    r.score = r.contributions.reduce((a, b) => a + b, 0);
    r.lowEvidence = r.count < 3;
  }
  const baseline = [...rows].sort(
    (a, b) => b.count - a.count || a.id.localeCompare(b.id),
  );
  baseline.forEach((r, i) => (r.baseline = i + 1));
  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  rows.forEach((r, i) => (r.position = i + 1));
  return {
    rows,
    baseline,
    selected: chosen.length,
    complete,
    weightFallback: effective.fallback,
    top: rows.slice(0, c.capacity),
    baselineTop: baseline.slice(0, c.capacity),
  };
}
export function compare(a, b) {
  const x = new Set(a.top.map((r) => r.id)),
    y = new Set(b.top.map((r) => r.id));
  return {
    entered: b.top.filter((r) => !x.has(r.id)),
    exited: a.top.filter((r) => !y.has(r.id)),
    retained: b.top.filter((r) => x.has(r.id)).length,
  };
}
export function evaluate(events, locations, c) {
  const windows = ["2026-03-31", "2026-05-31", "2026-07-31"];
  return windows.map((end) => {
    const cutoff = Date.parse(end + "T00:00:00Z");
    const start = new Date(cutoff - 89 * day).toISOString().slice(0, 10),
      futureEnd = new Date(cutoff + 30 * day).toISOString().slice(0, 10);
    const plan = rank(events, locations, { ...c, start, end });
    const future = selectEvents(events, {
      ...c,
      start: new Date(cutoff + day).toISOString().slice(0, 10),
      end: futureEnd,
    });
    const ids = new Set(plan.top.map((r) => r.id)),
      base = new Set(plan.baselineTop.map((r) => r.id));
    return {
      end,
      total: future.length,
      candidate: future.filter((e) => ids.has(e.location)).length,
      baseline: future.filter((e) => base.has(e.location)).length,
    };
  });
}
