// 95% intervals and tests for the betting figures. The server ranks lists with
// the same formulas (server/routes.js), so displayed intervals match the order.

export const Z = 1.959963984540054;

// Two-sided 95% critical values of Student's t for 1..30 degrees of freedom.
const T975 = [12.7062, 4.3027, 3.1824, 2.7764, 2.5706, 2.4469, 2.3646, 2.3060, 2.2622, 2.2281, 2.2010, 2.1788,
  2.1604, 2.1448, 2.1314, 2.1199, 2.1098, 2.1009, 2.0930, 2.0860, 2.0796, 2.0739, 2.0687, 2.0639, 2.0595, 2.0555,
  2.0518, 2.0484, 2.0452, 2.0423];

/** t(0.975, df); past 30 degrees of freedom 1.96 + 2.5/df is within 0.002. */
export const tCritical = df => (df <= 30 ? T975[df - 1] : Z + 2.5 / df);

/** Wilson 95% interval for k successes in n trials: [low, high]. */
export function wilson(k, n) {
  if (!n) return [null, null];
  const p = k / n;
  const z2 = Z * Z;
  const centre = p + z2 / (2 * n);
  const spread = Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const scale = 1 + z2 / n;
  return [(centre - spread) / scale, (centre + spread) / scale];
}

/**
 * 95% t interval for a mean from n values, their sum and their sum of squares:
 * { mean, low, high }. Returns nulls below two values.
 */
export function meanInterval(n, sum, sumSq) {
  if (!n || n < 2) return { mean: n ? sum / n : null, low: null, high: null };
  const mean = sum / n;
  const variance = Math.max(sumSq - (sum * sum) / n, 0) / (n - 1);
  const half = tCritical(n - 1) * Math.sqrt(variance / n);
  return { mean, low: mean - half, high: mean + half };
}

const logFactorials = [0];
const logFactorial = n => {
  for (let i = logFactorials.length; i <= n; i += 1) logFactorials[i] = logFactorials[i - 1] + Math.log(i);
  return logFactorials[n];
};

/**
 * Exact two-sided binomial test of k successes in n trials against success
 * probability p: the probability of a result no more likely than k.
 */
export function binomialTest(k, n, p) {
  if (!n) return null;
  const logPmf = i => logFactorial(n) - logFactorial(i) - logFactorial(n - i) + i * Math.log(p) + (n - i) * Math.log(1 - p);
  const observed = logPmf(k);
  let total = 0;
  for (let i = 0; i <= n; i += 1) {
    const lp = logPmf(i);
    if (lp <= observed + 1e-7) total += Math.exp(lp);
  }
  return Math.min(1, total);
}
