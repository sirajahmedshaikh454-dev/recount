// Probability distributions from scratch (no dependencies): enough to turn a reported test statistic back into its p-value.
// Algorithms: Lanczos log-gamma, continued-fraction incomplete beta (Lentz), series / continued-fraction incomplete gamma.
// Verified against SciPy in tests/dist.test.js (tools/make_fixtures.py generates the reference values).
(function (root) {
  const G = 7;
  const C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const TINY = 1e-300, EPS = 3e-16;

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = C[0];
    const t = x + G + 0.5;
    for (let i = 1; i < G + 2; i++) a += C[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function betacf(a, b, x) {
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 500; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  // Regularised incomplete beta I_x(a, b)
  function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }

  // Regularised upper incomplete gamma Q(a, x)
  function gammq(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let n = 0; n < 2000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
    for (let i = 1; i < 2000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
      c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }

  // Two-tailed p-values, as papers report them
  const pT = (t, df) => betai(df / 2, 0.5, df / (df + t * t));
  const pF = (f, df1, df2) => (f <= 0 ? 1 : betai(df2 / 2, df1 / 2, df2 / (df2 + df1 * f)));
  const pChi2 = (x, df) => gammq(df / 2, x / 2);
  const pZ = (z) => gammq(0.5, z * z / 2);
  // r(df) -> t with df degrees of freedom
  const tFromR = (r, df) => r * Math.sqrt(df / (1 - r * r));

  const api = { lgamma, betai, gammq, pT, pF, pChi2, pZ, tFromR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RecountDist = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
