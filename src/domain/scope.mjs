export function analysisScope(config, page, playDate) {
  return page === "Map preview" && playDate
    ? { ...config, end: playDate }
    : config;
}
export function resolveFocus(rows, selected) {
  return selected
    ? (rows.find((row) => row.id === selected) ?? null)
    : (rows[0] ?? null);
}
export function effectiveWeights(weights, complete) {
  if (
    !Array.isArray(weights) ||
    weights.length !== 3 ||
    weights.some((w) => !Number.isFinite(w) || w < 0)
  )
    throw Error("Weights must be three finite non-negative values");
  const effective = weights.map((w, i) => (i === 1 && !complete ? 0 : w));
  return effective.some((w) => w > 0)
    ? { weights: effective, fallback: false }
    : { weights: [1, 0, 0], fallback: true };
}
