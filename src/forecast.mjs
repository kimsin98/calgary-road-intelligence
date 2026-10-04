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
export const EVENT_TYPES = [
  "Collision-related",
  "Road conditions",
  "Signals",
  "Stalled vehicle",
  "Other / unverified",
];
const TYPE_FEATURES = EVENT_TYPES.flatMap((type) => [
  type + " · past 30 days",
  type + " · days 31–90",
]);
function examples(
  events,
  locations,
  cutoff,
  horizon,
  outcomes = true,
  objective = "all",
  weighting = "equal",
) {
  const known = new Set(
    events.filter((e) => e.date <= cutoff).map((e) => e.location),
  );
  const groups = new Map(
    locations
      .filter((l) => known.has(l.id))
      .map((l) => [
        l.id,
        {
          location: l,
          bins: [0, 0, 0, 0],
          types: Array(10).fill(0),
          collisionCount: 0,
          days: new Set(),
          target: 0,
        },
      ]),
  );
  for (const e of events) {
    const g = groups.get(e.location);
    if (!g) continue;
    const ago = (Date.parse(cutoff) - Date.parse(e.date)) / DAY;
    if (ago >= 0 && ago < 90) {
      g.bins[ago < 7 ? 0 : ago < 14 ? 1 : ago < 30 ? 2 : 3]++;
      g.days.add(e.date);
      const type = EVENT_TYPES.indexOf(e.category);
      if (type >= 0) g.types[type * 2 + (ago < 30 ? 0 : 1)]++;
      if (e.category === "Collision-related") g.collisionCount++;
    } else if (
      outcomes &&
      ago < 0 &&
      ago >= -horizon &&
      (objective === "all" || e.category === "Collision-related")
    )
      g.target++;
  }
  return [...groups.values()].map((g) => {
    const total = g.bins.reduce((a, b) => a + b, 0);
    return {
      id: g.location.id,
      name: g.location.name,
      lon: g.location.lon,
      lat: g.location.lat,
      x:
        weighting === "learned"
          ? g.types.map(Math.log1p)
          : g.bins
              .map(Math.log1p)
              .concat(g.days.size / 90, total ? g.bins[0] / total : 0),
      count: total,
      recent: g.bins[0],
      days: g.days.size,
      target: g.target,
      collisionCount: g.collisionCount,
      allRate: (horizon * total) / 90,
      baseline:
        (horizon * (objective === "collision" ? g.collisionCount : total)) / 90,
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
    equalWeightCoverage: [...sorted]
      .sort((a, b) => b.allRate - a.allRate || a.id.localeCompare(b.id))
      .slice(0, k)
      .reduce((sum, r) => sum + r.target, 0),
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
  features = FEATURES,
  objective = "all",
) {
  const start = dateShift(cutoff, -89);
  const reactive = rank(events, locations, {
    ...defaults,
    category: objective === "collision" ? "Collision-related" : "All types",
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
      .map((v, i) => ({ label: features[i], value: v * coefficients[i + 1] }))
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
    cutoff = "2026-06-30",
    horizon = 30,
    capacity = 20,
    mode = "backtest",
    dataEnd,
    objective = "all",
    weighting = "equal",
  } = {},
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(cutoff) ||
    !Number.isFinite(Date.parse(cutoff)) ||
    dateShift(cutoff, 0) !== cutoff
  )
    throw Error("Invalid forecast cutoff date");
  if (!["all", "collision"].includes(objective))
    throw Error("Unknown forecast objective");
  if (!["equal", "learned"].includes(weighting))
    throw Error("Unknown weighting mode");
  const featureNames = weighting === "learned" ? TYPE_FEATURES : FEATURES;
  if (![7, 30].includes(horizon))
    throw Error("Forecast horizon must be 7 or 30 days");
  if (!["backtest", "future"].includes(mode))
    throw Error("Invalid forecast mode");
  const latest =
    dataEnd ?? events.reduce((end, e) => (e.date > end ? e.date : end), "");
  if (
    mode === "backtest" &&
    (cutoff < "2026-01-01" || dateShift(cutoff, horizon) > latest)
  )
    throw Error(
      "Choose a 2026 backtest cutoff with a complete observed forecast window",
    );
  if (mode === "future" && (cutoff !== latest || cutoff < "2026-01-01"))
    throw Error(
      "Future forecast must start at the latest dataset date after the training period",
    );
  if (dataEnd && mode === "backtest" && dateShift(cutoff, horizon) > dataEnd)
    throw Error(
      "Backtest requires observations through the entire forecast window",
    );
  const yearWindows = (year) =>
    ["03-31", "06-30", "09-30", "11-30"].map((day) => year + "-" + day);
  const trainEnds = [2023, 2024, 2025].flatMap(yearWindows);
  const folds = [
    { trainYears: [2023], validationYear: 2024 },
    { trainYears: [2023, 2024], validationYear: 2025 },
  ];
  const cache = new Map(
    trainEnds.map((end) => [
      end,
      examples(events, locations, end, horizon, true, objective, weighting),
    ]),
  );
  const trials = [0.001, 0.01, 0.1, 1]
    .map((lambda) => {
      const scores = folds.map((fold) => {
        const fitted = fitPoisson(
          fold.trainYears.flatMap(yearWindows).flatMap((end) => cache.get(end)),
          lambda,
        );
        const windows = yearWindows(fold.validationYear).map((end) => {
          const m = metric(cache.get(end), fitted.coefficients, capacity);
          return {
            cutoff: end,
            end: dateShift(end, horizon),
            modelDeviance: m.modelDeviance,
            baselineDeviance: m.baselineDeviance,
            modelCoverage: m.modelCoverage,
            baselineCoverage: m.baselineCoverage,
            modelMAE: m.modelMAE,
          };
        });
        return {
          ...fold,
          diagnostics: fitted.diagnostics,
          windows,
          deviance:
            windows.reduce((sum, w) => sum + w.modelDeviance, 0) /
            windows.length,
        };
      });
      return {
        lambda,
        folds: scores,
        validationDeviance:
          scores.reduce((sum, f) => sum + f.deviance, 0) / scores.length,
      };
    })
    .sort(
      (a, b) =>
        a.validationDeviance - b.validationDeviance || b.lambda - a.lambda,
    );
  const selected = trials[0];
  // Freeze CV-selected regularization, then fit the final model on 2023–2025 only.
  const finalFit = fitPoisson(
    trainEnds.flatMap((end) => cache.get(end)),
    selected.lambda,
  );
  const chosen = { lambda: selected.lambda, ...finalFit };
  const validationEnds = [2024, 2025].flatMap(yearWindows);
  const validationEnd = validationEnds.at(-1);
  const rows = examples(
    events,
    locations,
    cutoff,
    horizon,
    mode === "backtest",
    objective,
    weighting,
  );
  const evaluation = metric(rows, chosen.coefficients, capacity);
  const comparison = compareForecast(
    events,
    locations,
    cutoff,
    capacity,
    evaluation.rows,
    chosen.coefficients,
    featureNames,
    objective,
  );
  const actual = new Map(rows.map((r) => [r.id, r.target]));
  evaluation.reactiveCoverage = comparison.reactiveTop.reduce(
    (sum, r) => sum + (actual.get(r.id) || 0),
    0,
  );
  return {
    comparison,
    weighting,
    objective,
    learnedEffects: featureNames.map((name, i) => ({
      name,
      coefficient: chosen.coefficients[i + 1],
      rateMultiplier: Math.exp(chosen.coefficients[i + 1]),
    })),
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
    features: featureNames,
    coefficients: chosen.coefficients,
    lambda: chosen.lambda,
    diagnostics: chosen.diagnostics,
    trials,
    trainEnds,
    validationEnd,
    validationEnds,
    crossValidation: {
      strategy: "expanding-year",
      folds,
      selectedLambda: selected.lambda,
      selectionMetric: "mean per-window Poisson deviance, equal fold weights",
      trials,
    },
    evaluation: mode === "backtest" ? evaluation : null,
    top: evaluation.rows
      .slice(0, capacity)
      .map((r) => ({ ...r, target: mode === "future" ? null : r.target })),
    unseenFutureEvents:
      mode === "future"
        ? null
        : events.filter(
            (e) =>
              (objective === "all" || e.category === "Collision-related") &&
              e.date > cutoff &&
              e.date <= dateShift(cutoff, horizon) &&
              !rows.some((r) => r.id === e.location),
          ).length,
    version: "poisson-ridge-v7",
  };
}
