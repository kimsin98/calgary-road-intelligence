import { rank, defaults } from "./analysis.mjs";
import { fitPoisson } from "./poisson.mjs";
const DAY = 86400000;
export const dateShift = (date, n) =>
  new Date(Date.parse(date + "T00:00:00Z") + n * DAY)
    .toISOString()
    .slice(0, 10);
const FEATURES = [
  "Recent 7 days",
  "Previous 7 days",
  "Days 15–30",
  "Days 31–90",
  "Recurring days / 90",
  "Recent share",
];
function examples(events, locations, cutoff, horizon, outcomes = true) {
  const known = new Set(
    events.filter((e) => e.date <= cutoff).map((e) => e.location),
  );
  const groups = new Map(
    locations
      .filter((l) => known.has(l.id))
      .map((l) => [
        l.id,
        { location: l, bins: [0, 0, 0, 0], days: new Set(), target: 0 },
      ]),
  );
  for (const e of events) {
    const g = groups.get(e.location);
    if (!g) continue;
    const ago = (Date.parse(cutoff) - Date.parse(e.date)) / DAY;
    if (ago >= 0 && ago < 90) {
      g.bins[ago < 7 ? 0 : ago < 14 ? 1 : ago < 30 ? 2 : 3]++;
      g.days.add(e.date);
    } else if (outcomes && ago < 0 && ago >= -horizon) g.target++;
  }
  return [...groups.values()].map((g) => {
    const total = g.bins.reduce((a, b) => a + b, 0);
    return {
      id: g.location.id,
      name: g.location.name,
      lon: g.location.lon,
      lat: g.location.lat,
      x: g.bins
        .map(Math.log1p)
        .concat(g.days.size / 90, total ? g.bins[0] / total : 0),
      count: total,
      recent: g.bins[0],
      days: g.days.size,
      target: g.target,
      baseline: (horizon * total) / 90,
    };
  });
}
const predict = (r, b) =>
  Math.exp(
    Math.max(
      -12,
      Math.min(6, b[0] + r.x.reduce((s, v, i) => s + v * b[i + 1], 0)),
    ),
  );
function metric(rows, coefficients, k) {
  const sorted = rows
    .map((r) => ({ ...r, predicted: predict(r, coefficients) }))
    .sort((a, b) => b.predicted - a.predicted || a.id.localeCompare(b.id));
  const baseline = [...sorted].sort(
    (a, b) => b.baseline - a.baseline || a.id.localeCompare(b.id),
  );
  const total = rows.reduce((s, r) => s + r.target, 0);
  const deviance = (actual, expected) =>
    2 *
    (actual
      ? actual * Math.log(actual / Math.max(1e-9, expected)) - actual + expected
      : expected);
  return {
    total,
    knownLocations: rows.length,
    zeroMAE: total / (rows.length || 1),
    modelExpected: sorted.reduce((s, r) => s + r.predicted, 0),
    baselineExpected: sorted.reduce((s, r) => s + r.baseline, 0),
    modelDeviance:
      sorted.reduce((s, r) => s + deviance(r.target, r.predicted), 0) /
      (rows.length || 1),
    baselineDeviance:
      sorted.reduce((s, r) => s + deviance(r.target, r.baseline), 0) /
      (rows.length || 1),
    modelMAE:
      sorted.reduce((s, r) => s + Math.abs(r.predicted - r.target), 0) /
      Math.max(1, rows.length),
    baselineMAE:
      sorted.reduce((s, r) => s + Math.abs(r.baseline - r.target), 0) /
      rows.length,
    modelCoverage: sorted.slice(0, k).reduce((s, r) => s + r.target, 0),
    baselineCoverage: baseline.slice(0, k).reduce((s, r) => s + r.target, 0),
    rows: sorted,
  };
}
export function compareForecast(
  events,
  locations,
  cutoff,
  capacity,
  rows,
  coefficients,
) {
  const start = dateShift(cutoff, -89);
  const reactive = rank(events, locations, {
    ...defaults,
    start,
    end: cutoff,
    capacity,
  });
  const top = rows.slice(0, capacity);
  const forecastIds = new Set(top.map((r) => r.id));
  const reactiveIds = new Set(reactive.top.map((r) => r.id));
  const rateIds = new Set(
    [...rows]
      .sort((a, b) => b.baseline - a.baseline || a.id.localeCompare(b.id))
      .slice(0, capacity)
      .map((r) => r.id),
  );
  const explain = (row) => {
    const terms = row.x
      .map((v, i) => ({ label: FEATURES[i], value: v * coefficients[i + 1] }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const term = terms[0];
    return term && Math.abs(term.value) > 1e-8
      ? term.label +
          (term.value >= 0 ? " raises" : " lowers") +
          " the model log expected count (" +
          (term.value >= 0 ? "+" : "") +
          term.value.toFixed(2) +
          "). Historical ranking uses frequency, 30-day growth and recurring dates."
      : "The fitted intercept dominates this low-activity location; historical ranking uses frequency, growth and recurring dates.";
  };
  const allForecastRanks = new Map(rows.map((r, i) => [r.id, i + 1]));
  const allReactiveRanks = new Map(
    reactive.rows.map((r) => [r.id, r.position]),
  );
  const changed = (r, direction) => ({
    id: r.id,
    name: r.name,
    direction,
    forecastRank: allForecastRanks.get(r.id) ?? null,
    reactiveRank: allReactiveRanks.get(r.id) ?? null,
    explanation: explain(rows.find((x) => x.id === r.id)),
  });
  return {
    start,
    retained: top.filter((r) => reactiveIds.has(r.id)).length,
    rateRetained: top.filter((r) => rateIds.has(r.id)).length,
    changes: [
      ...top
        .filter((r) => !reactiveIds.has(r.id))
        .map((r) => changed(r, "entered")),
      ...reactive.top
        .filter((r) => !forecastIds.has(r.id))
        .map((r) => changed(r, "exited")),
    ],
    reactiveTop: reactive.top,
  };
}
export function forecast(
  events,
  locations,
  {
    cutoff = "2025-11-30",
    horizon = 30,
    capacity = 20,
    mode = "backtest",
    dataEnd,
  } = {},
) {
  if (![7, 30].includes(horizon))
    throw Error("Forecast horizon must be 7 or 30 days");
  if (!["backtest", "future"].includes(mode))
    throw Error("Invalid forecast mode");
  const latest =
    dataEnd ?? events.reduce((end, e) => (e.date > end ? e.date : end), "");
  if (mode === "backtest" && (cutoff < "2025-10-31" || cutoff > "2025-12-01"))
    throw Error("Backtest cutoff must be between October 31 and December 1");
  if (mode === "future" && (cutoff !== latest || cutoff < "2025-10-31"))
    throw Error(
      "Future forecast must start at the latest dataset date after the training period",
    );
  if (dataEnd && mode === "backtest" && dateShift(cutoff, horizon) > dataEnd)
    throw Error(
      "Backtest requires observations through the entire forecast window",
    );
  const trainEnds = ["2025-03-31", "2025-04-30", "2025-05-31", "2025-06-30"];
  const validationEnd = "2025-08-31";
  const training = trainEnds.flatMap((end) =>
    examples(events, locations, end, horizon),
  );
  const validation = examples(events, locations, validationEnd, horizon);
  const trials = [0.001, 0.01, 0.1]
    .map((lambda) => {
      const fitted = fitPoisson(training, lambda),
        coefficients = fitted.coefficients,
        metrics = metric(validation, coefficients, capacity);
      return {
        lambda,
        coefficients,
        diagnostics: fitted.diagnostics,
        validationMAE: metrics.modelMAE,
        validationDeviance: metrics.modelDeviance,
      };
    })
    .sort((a, b) => a.validationDeviance - b.validationDeviance);
  const chosen = trials[0];
  const rows = examples(
    events,
    locations,
    cutoff,
    horizon,
    mode === "backtest",
  );
  const evaluation = metric(rows, chosen.coefficients, capacity);
  const comparison = compareForecast(
    events,
    locations,
    cutoff,
    capacity,
    evaluation.rows,
    chosen.coefficients,
  );
  const actual = new Map(rows.map((r) => [r.id, r.target]));
  evaluation.reactiveCoverage = comparison.reactiveTop.reduce(
    (sum, r) => sum + (actual.get(r.id) || 0),
    0,
  );
  return {
    comparison,
    mode,
    dataEnd: latest,
    rows: evaluation.rows.map((r) => ({
      ...r,
      target: mode === "future" ? null : r.target,
    })),
    cutoff,
    horizon,
    end: dateShift(cutoff, horizon),
    capacity,
    features: FEATURES,
    coefficients: chosen.coefficients,
    lambda: chosen.lambda,
    diagnostics: chosen.diagnostics,
    trials,
    trainEnds,
    validationEnd,
    evaluation: mode === "backtest" ? evaluation : null,
    top: evaluation.rows
      .slice(0, capacity)
      .map((r) => ({ ...r, target: mode === "future" ? null : r.target })),
    unseenFutureEvents:
      mode === "future"
        ? null
        : events.filter(
            (e) =>
              e.date > cutoff &&
              e.date <= dateShift(cutoff, horizon) &&
              !rows.some((r) => r.id === e.location),
          ).length,
    version: "poisson-ridge-v4",
  };
}
