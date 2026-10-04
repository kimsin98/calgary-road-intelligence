export function fitPoisson(
  rows,
  lambda,
  { maxIterations = 600, tolerance = 1e-5 } = {},
) {
  if (!rows.length) throw Error("No training locations available");
  const n = rows[0].x.length + 1,
    b = Array(n).fill(0);
  b[0] = Math.log(
    Math.max(0.001, rows.reduce((s, r) => s + r.target, 0) / rows.length),
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
      value += (Math.exp(eta) - r.target * eta) / rows.length;
    }
    return value + (lambda * coeff.slice(1).reduce((s, v) => s + v * v, 0)) / 2;
  };
  const initialLoss = objective(b);
  for (; iteration < maxIterations; iteration++) {
    const gradient = Array(n).fill(0);
    for (const r of rows) {
      const x = [1, ...r.x],
        eta = Math.max(
          -12,
          Math.min(
            6,
            x.reduce((s, v, i) => s + v * b[i], 0),
          ),
        ),
        mu = Math.exp(eta);
      for (let i = 0; i < n; i++)
        gradient[i] += ((mu - r.target) * x[i]) / rows.length;
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
