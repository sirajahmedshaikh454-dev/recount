// Recount: find reported statistics in a text and recompute what can be recomputed.
//   t / F / chi-square / r / z tests  -> recompute p from the statistic and degrees of freedom (statcheck-style, with rounding intervals)
//   means with a sample size           -> GRIM test (Brown & Heathers 2017): is the mean possible for whole-number data?
//   "12/40 (35%)"                      -> is the percentage the rounded ratio?
// Nothing is sent anywhere; this file has no dependencies besides dist.js.
(function (root) {
  const D = typeof require !== 'undefined' ? require('./dist.js') : root.RecountDist;

  // \d+(?:\.\d*)? has exactly one way to match a digit run (the older \d+\.?\d* had many, which made long digit runs quadratic)
  const NUM = '[-−]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const PNUM = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const PTAIL = '\\s*[,;(]?\\s*[pP](?:-value)?\\s*([<>=≤≥])\\s*(' + PNUM + ')';

  const TESTS = [
    { kind: 't', re: new RegExp('\\b[tT]\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s*\\)\\s*=\\s*(' + NUM + ')' + PTAIL, 'g'), pick: (m) => ({ df1: +m[1], stat: m[2], op: m[3], p: m[4] }) },
    { kind: 'F', re: new RegExp('\\bF\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+(?:\\.\\d+)?)\\s*\\)\\s*=\\s*(' + NUM + ')' + PTAIL, 'g'), pick: (m) => ({ df1: +m[1], df2: +m[2], stat: m[3], op: m[4], p: m[5] }) },
    { kind: 'chi2', re: new RegExp('(?:[χΧ]\\s*-?\\s*(?:[²2]|squared?)?|\\b[xX]\\s*[²2]|\\bchi\\s*-?\\s*(?:[²2]|squared?)?)\\s*\\(\\s*(\\d+)(?:\\s*,\\s*[Nn]\\s*=\\s*[\\d,]+)?\\s*\\)\\s*=\\s*(' + NUM + ')' + PTAIL, 'g'), pick: (m) => ({ df1: +m[1], stat: m[2], op: m[3], p: m[4] }) },
    { kind: 'r', re: new RegExp('\\br\\s*\\(\\s*(\\d+)\\s*\\)\\s*=\\s*(' + NUM + ')' + PTAIL, 'g'), pick: (m) => ({ df1: +m[1], stat: m[2], op: m[3], p: m[4] }) },
    { kind: 'z', re: new RegExp('\\b[zZ]\\s*=\\s*(' + NUM + ')' + PTAIL, 'g'), pick: (m) => ({ stat: m[1], op: m[2], p: m[3] }) },
  ];

  const MEAN = '(?:M|[Mm]ean)';
  // between a mean and its n: no sentence end, no other mean or n, no test statistic, and no closing bracket (that ends the group the mean belongs to)
  const GAP = '(?:(?!\\b' + MEAN + '\\s*=)(?!\\b[nN]\\s*=)(?!\\b[tFrz]\\s*[(=])(?!χ)(?:[^;.)]|\\.\\d|\\)(?=\\s*,))){0,80}?';
  const GRIM_A = new RegExp('\\b' + MEAN + '\\s*=\\s*(' + NUM + ')' + GAP + '\\b[nN]\\s*=\\s*(\\d+)', 'g');
  const GRIM_B = new RegExp('\\b[nN]\\s*=\\s*(\\d+)' + GAP + '\\b' + MEAN + '\\s*=\\s*(' + NUM + ')', 'g');
  const PCT_A = /(?<![\d.])(\d{1,9})\s*(?:\/|of|out of)\s*(\d{1,9})\s*\(\s*(\d{1,9}(?:\.\d{1,9})?)\s*%\s*\)/g;
  const PCT_B = /(?<![\d.])(\d{1,9}(?:\.\d{1,9})?)\s*%\s*\(\s*(?:[nN]\s*=\s*)?(\d{1,9})\s*(?:\/|of|out of)\s*(\d{1,9})\s*\)/g;

  const num = (s) => parseFloat(String(s).replace('−', '-'));
  const decimals = (s) => { const i = String(s).indexOf('.'); return i < 0 ? 0 : String(s).length - i - 1; };
  const fmtP = (p) => (p < 0.001 ? '< .001' : p.toFixed(3).replace(/^0/, ''));
  const EPS = 1e-9;

  function pAt(kind, s, t) {
    switch (kind) {
      case 't': return D.pT(s, t.df1);
      case 'F': return D.pF(s, t.df1, t.df2);
      case 'chi2': return D.pChi2(s, t.df1);
      case 'r': return D.pT(D.tFromR(Math.min(s, 1 - 1e-12), t.df1), t.df1);
      default: return D.pZ(s);
    }
  }

  // The statistic is itself rounded, so the p-value it implies is a range, not a point.
  function pRange(kind, t) {
    const a = Math.abs(num(t.stat)), half = 0.5 * Math.pow(10, -decimals(t.stat));
    const p1 = pAt(kind, Math.max(0, a - half), t), p2 = pAt(kind, a + half, t);
    return { pmin: Math.min(p1, p2), pmax: Math.max(p1, p2), pmid: pAt(kind, a, t) };
  }

  function pConsistent(op, prep, dp, r) {
    const h = 0.5 * Math.pow(10, -dp);
    if (op === '=') return r.pmax >= prep - h - EPS && r.pmin <= prep + h + EPS;
    if (op === '<' || op === '≤') return r.pmin < prep + EPS;
    return r.pmax > prep - EPS;
  }

  const label = (kind, t) => {
    const s = t.stat;
    return { t: `t(${t.df1}) = ${s}`, F: `F(${t.df1}, ${t.df2}) = ${s}`, chi2: `χ²(${t.df1}) = ${s}`, r: `r(${t.df1}) = ${s}`, z: `z = ${s}` }[kind];
  };

  function checkTest(kind, t, alpha) {
    if (!(t.df1 > 0) && kind !== 'z' || (kind === 'F' && !(t.df2 > 0)))
      return { kind, status: 'skip', title: label(kind, t), detail: 'Degrees of freedom must be above 0, so this cannot be recomputed.', hints: [] };
    const prep = num(t.p), dp = decimals(t.p), r = pRange(kind, t), ok = pConsistent(t.op, prep, dp, r);
    const sigRep = t.op === '>' || t.op === '≥' ? false : (t.op === '=' ? prep < alpha : prep <= alpha);
    const sigComp = r.pmid < alpha;
    const hints = [];
    if (t.op === '=' && prep === 0) hints.push('p can never be exactly 0: write p < .001 instead.');
    let status = 'ok';
    let title = `${label(kind, t)} gives p ${r.pmid < 0.001 ? '< .001' : '= ' + fmtP(r.pmid)}`;
    let detail = `The text says p ${t.op} ${t.p}. That fits.`;
    if (!ok) {
      status = sigRep !== sigComp ? 'decision' : 'inconsistent';
      detail = `The text says p ${t.op} ${t.p}, but this statistic and these degrees of freedom give p ${r.pmid < 0.001 ? '< .001' : '= ' + fmtP(r.pmid)}.`;
      if (status === 'decision') detail += ` That changes the conclusion at α = ${alpha}: the text says ${sigRep ? 'significant' : 'not significant'}, the numbers say ${sigComp ? 'significant' : 'not significant'}.`;
      if (t.op === '=' && r.pmax / 2 >= prep - 0.5 * Math.pow(10, -dp) - EPS && r.pmin / 2 <= prep + 0.5 * Math.pow(10, -dp) + EPS)
        hints.push('The reported p matches a one-tailed test. If that is what was done, say so in the text.');
    }
    return { kind, status, title, detail, hints, recomputed: { p: r.pmid, pmin: r.pmin, pmax: r.pmax }, reported: { stat: t.stat, op: t.op, p: t.p } };
  }

  // GRIM: with n whole-number scores the mean is k/n for some integer k.
  function grim(mean, dp, n) {
    const tol = 0.5 * Math.pow(10, -dp) + EPS, k0 = Math.floor(mean * n);
    for (let k = k0 - 1; k <= k0 + 2; k++) if (Math.abs(k / n - mean) <= tol) return { ok: true };
    const lo = Math.floor(mean * n) / n, hi = Math.ceil(mean * n) / n;
    return { ok: false, near: [lo.toFixed(dp), hi.toFixed(dp)] };
  }

  function checkMean(meanStr, n, items) {
    const dp = decimals(meanStr), m = num(meanStr), neff = n * items;
    if (dp < 1 || !(n > 0)) return null;
    const label2 = `M = ${meanStr}, n = ${n}` + (items > 1 ? ` (${items} items)` : '');
    if (neff >= Math.pow(10, dp)) {
      return { kind: 'grim', status: 'skip', title: label2, detail: `GRIM cannot test this: with ${neff} whole-number scores, every ${dp}-decimal mean is possible.`, hints: [] };
    }
    const g = grim(m, dp, neff);
    if (g.ok) return { kind: 'grim', status: 'ok', title: label2, detail: 'A mean of ' + meanStr + ' is possible for ' + neff + ' whole-number scores.', hints: [] };
    return { kind: 'grim', status: 'inconsistent', title: label2,
      detail: `No set of ${neff} whole-number scores averages ${meanStr}. The nearest possible means are ${g.near[0]} and ${g.near[1]}.`,
      hints: ['GRIM assumes whole-number data (counts, single Likert items). If the scores are averages or decimals, ignore this.', 'Wrong n, a typo, or a mean of several items are the usual causes.'] };
  }

  function checkPct(x, y, pctStr) {
    const dp = decimals(pctStr), pct = num(pctStr), label2 = `${x}/${y} = ${pctStr}%`;
    if (y === 0 || x > y) return { kind: 'pct', status: 'inconsistent', title: label2, detail: x > y ? `${x} is larger than ${y}, so it cannot be a share of it.` : 'The denominator is 0.', hints: [] };
    const real = (x / y) * 100;
    if (Math.abs(real - pct) <= 0.5 * Math.pow(10, -dp) + EPS) return { kind: 'pct', status: 'ok', title: label2, detail: `${x}/${y} is ${real.toFixed(dp)}%. That fits.`, hints: [] };
    return { kind: 'pct', status: 'inconsistent', title: label2, detail: `${x}/${y} is ${real.toFixed(Math.max(dp, 1))}%, not ${pctStr}%.`, hints: [] };
  }

  function analyze(text, opts) {
    opts = opts || {};
    const alpha = opts.alpha || 0.05, items = Math.max(1, opts.items || 1);
    const found = [];
    const add = (m, res) => found.push(Object.assign({ start: m.index, end: m.index + m[0].length, text: m[0] }, res));
    for (const { kind, re, pick } of TESTS) { re.lastIndex = 0; let m; while ((m = re.exec(text))) { const t = pick(m); add(m, checkTest(kind, t, alpha)); } }
    for (const re of [GRIM_A, GRIM_B]) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(text))) {
        const a = re === GRIM_A;
        const r = checkMean(a ? m[1] : m[2], parseInt(a ? m[2] : m[1], 10), items);
        if (r) add(m, r);
      }
    }
    for (const [re, fn] of [[PCT_A, (m) => [+m[1], +m[2], m[3]]], [PCT_B, (m) => [+m[2], +m[3], m[1]]]]) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(text))) {
        const [x, y, p] = fn(m);
        if (/^(19|20)\d\d$/.test(String(x)) && String(y).length === 2) continue;       // "2019/20 (45%)" is a season, not a fraction
        add(m, checkPct(x, y, p));
      }
    }
    // overlapping matches: a significance test wins over a mean or percentage, otherwise the earlier one
    const rank = (f) => (f.kind === 'grim' || f.kind === 'pct' ? 1 : 0);
    found.sort((a, b) => rank(a) - rank(b) || a.start - b.start || b.end - a.end);
    const results = [];
    for (const f of found) if (!results.some((r) => f.start < r.end && r.start < f.end)) results.push(f);
    results.sort((a, b) => a.start - b.start);
    const summary = { total: results.length, ok: 0, inconsistent: 0, decision: 0, skip: 0 };
    for (const r of results) summary[r.status]++;
    return { results, summary };
  }

  const api = { analyze, grim, pRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Recount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
