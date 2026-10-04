export function fitPoisson(
  rows,
  lambda,
  { maxIterations = 600, tolerance = 1e-5 } = {},
) {
  if (!rows.length) throw Error("No training locations available");
  // Identical feature vectors share a Poisson sufficient statistic; preserve
  // sample weights while avoiding repeated work at sparse zero-history sites.
  const sampleCount = rows.length;
  const grouped = new Map();
  for (const r of rows) {
    const key = JSON.stringify(r.x);
    const g = grouped.get(key);
    if (g) {
      g.weight++;
      g.target += r.target;
    } else grouped.set(key, { x: r.x, weight: 1, target: r.target });
  }
  rows = [...grouped.values()];
  const n = rows[0].x.length + 1,
    b = Array(n).fill(0);
  b[0] = Math.log(
    Math.max(0.001, rows.reduce((s, r) => s + r.target, 0) / sampleCount),
  );
  let loss = Infinity,
    gradientNorm = Infinity,
    iteration = 0;
  const objective = (coeff) => {
    let value = 0;
    for (const r of rows) {
      const eta = Math.max(
        -12,
        Math.min(
          6,
          coeff[0] + r.x.reduce((s, v, i) => s + v * coeff[i + 1], 0),
        ),
      );
      value += (r.weight * Math.exp(eta) - r.target * eta) / sampleCount;
    }
    return value + (lambda * coeff.slice(1).reduce((s, v) => s + v * v, 0)) / 2;
  };
  const initialLoss = objective(b);
  for (; iteration < maxIterations; iteration++) {
    const gradient = Array(n).fill(0);
    for (const r of rows) {
      let eta = b[0];
      for (let i = 0; i < r.x.length; i++) eta += r.x[i] * b[i + 1];
      const residual =
        (r.weight * Math.exp(Math.max(-12, Math.min(6, eta))) - r.target) /
        sampleCount;
      gradient[0] += residual;
      for (let i = 1; i < n; i++) gradient[i] += residual * r.x[i - 1];
    }
    for (let i = 1; i < n; i++) gradient[i] += lambda * b[i];
    gradientNorm = Math.hypot(...gradient);
    loss = objective(b);
    if (gradientNorm < tolerance) break;
    let step = 0.15,
      proposal;
    for (let tries = 0; tries < 12; tries++) {
      proposal = b.map((v, i) => v - step * gradient[i]);
      if (objective(proposal) <= loss) break;
      step /= 2;
    }
    if (objective(proposal) > loss) break;
    for (let i = 0; i < n; i++) b[i] = proposal[i];
  }
  return {
    coefficients: b,
    diagnostics: {
      iterations: iteration,
      converged: gradientNorm < tolerance,
      gradientNorm,
      loss: objective(b),
      initialLoss,
      tolerance,
    },
  };
}
