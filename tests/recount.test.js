const test = require('node:test');
const assert = require('node:assert');
const { analyze, grim } = require('../src/recount.js');

const one = (text, opts) => { const r = analyze(text, opts); assert.strictEqual(r.results.length, 1, JSON.stringify(r.results.map((x) => x.text))); return r.results[0]; };

test('t: consistent p, rounded either way', () => {
  assert.strictEqual(one('t(28) = 2.20, p = .036').status, 'ok');
  assert.strictEqual(one('t(28) = 2.20, p = .04').status, 'ok');           // .036 rounds to .04
  assert.strictEqual(one('t(28) = 2.2, p < .05').status, 'ok');
});
test('t: wrong p is inconsistent', () => {
  assert.strictEqual(one('t(28) = 2.20, p = .01').status, 'inconsistent');
});
test('t: a p that flips significance is a decision error', () => {
  const r = one('The effect was significant, t(28) = 1.20, p = .03.');
  assert.strictEqual(r.status, 'decision');
  assert.match(r.detail, /not significant/);
});
test('t: the rounding of the statistic itself is respected', () => {
  // t(10)=2.23 gives p=.0497 while t(10)=2.22 gives p=.0504: "2.2" spans both, so p = .05 is possible
  assert.strictEqual(one('t(10) = 2.2, p = .05').status, 'ok');
});
test('one-tailed hint', () => {
  const r = one('t(28) = 2.20, p = .018');
  assert.strictEqual(r.status, 'inconsistent');
  assert.ok(r.hints.some((h) => /one-tailed/.test(h)));
});
test('p = .000 is flagged as a style problem', () => {
  assert.ok(one('t(120) = 9.50, p = .000').hints.some((h) => /never be exactly 0/.test(h)));
});
test('F, chi-square, r and z are recomputed', () => {
  assert.strictEqual(one('F(2, 27) = 4.00, p = .030').status, 'ok');
  assert.strictEqual(one('F(2, 27) = 4.00, p = .003').status, 'inconsistent');
  assert.strictEqual(one('F(2, 27) = 4.00, p = .30').status, 'decision');          // true p is .030: significant, the text says not
  assert.strictEqual(one('χ²(2) = 6.50, p = .039').status, 'ok');
  assert.strictEqual(one('chi2(1) = 3.84, p = .05').status, 'ok');
  assert.strictEqual(one('r(28) = .45, p = .013').status, 'ok');
  assert.strictEqual(one('r(28) = .45, p = .004').status, 'inconsistent');
  assert.strictEqual(one('z = 1.96, p = .05').status, 'ok');
});
test('unicode minus and spacing variants parse', () => {
  assert.strictEqual(one('t (28) = −2.20 ; p=.036').status, 'ok');
});
test('several statistics in one paragraph keep their order and positions', () => {
  const text = 'First t(28) = 2.20, p = .036. Then F(2, 27) = 4.00, p = .003.';
  const r = analyze(text);
  assert.deepStrictEqual(r.results.map((x) => x.status), ['ok', 'inconsistent']);
  assert.strictEqual(text.slice(r.results[1].start, r.results[1].end), 'F(2, 27) = 4.00, p = .003');
  assert.deepStrictEqual(r.summary, { total: 2, ok: 1, inconsistent: 1, decision: 0, skip: 0 });
});

test('GRIM: impossible and possible means', () => {
  assert.strictEqual(grim(5.19, 2, 28).ok, false);                           // the classic example from Brown & Heathers
  assert.strictEqual(grim(5.18, 2, 28).ok, true);                            // 145/28 = 5.1786
  assert.strictEqual(one('(M = 5.19, n = 28)').status, 'inconsistent');
  assert.strictEqual(one('(M = 5.18, n = 28)').status, 'ok');
  assert.strictEqual(one('n = 28, M = 5.19').status, 'inconsistent');        // either order
});
test('GRIM: large samples cannot be tested and say so', () => {
  assert.strictEqual(one('M = 3.45, N = 500').status, 'skip');
});
test('GRIM: scale items widen what is possible', () => {
  assert.strictEqual(one('M = 5.19, n = 28', { items: 4 }).status, 'skip');
});
test('GRIM gives the nearest possible means', () => {
  assert.deepStrictEqual(grim(5.19, 2, 28).near, ['5.18', '5.21']);
});
test('a mean is not paired with the n of the next sentence', () => {
  const r = analyze('The mean was M = 3.5. Later we recruited n = 20 people.');
  assert.strictEqual(r.results.length, 0);
});

test('percentages', () => {
  assert.strictEqual(one('12/40 (30%)').status, 'ok');
  assert.strictEqual(one('12 of 40 (35%)').status, 'inconsistent');
  assert.strictEqual(one('35% (n = 14/40)').status, 'ok');
  assert.strictEqual(one('45/40 (112.5%)').status, 'inconsistent');
  assert.strictEqual(one('1/3 (33.3%)').status, 'ok');
});

test('text with no statistics yields nothing', () => {
  assert.strictEqual(analyze('Hello world. This has no numbers.').results.length, 0);
});
test('the pattern engine survives long hostile input quickly', () => {
  const t0 = Date.now();
  analyze('M = 1.5 ' + 'x'.repeat(200000) + ' t(' + '9'.repeat(100000));
  assert.ok(Date.now() - t0 < 2000);
});

// ---- found by an independent review ----
test('long digit runs are linear, not quadratic', () => {
  for (const pre of ['t(30) = ', 'M = ', 'z = ', 'r(3) = ', 'χ(1) = ']) {
    const t0 = Date.now();
    analyze(pre + '1'.repeat(100000));
    assert.ok(Date.now() - t0 < 1500, pre);
  }
});
test('a mean and n around a test do not swallow the test', () => {
  const r = analyze('M = 5.2, SD = 1.1, t(28) = 2.20, p = .9, n = 30');
  assert.ok(r.results.some((x) => x.kind === 't' && x.status !== 'ok'), JSON.stringify(r.results.map((x) => [x.kind, x.status])));
});
test('a mean is not paired with another group\'s n', () => {
  assert.strictEqual(analyze('Group A (M = 3.47, SD = 1.1) and group B (n = 25)').results.length, 0);
  assert.strictEqual(one('M = 5.19 (SD = 1.2), n = 28').status, 'inconsistent');            // SD bracket before n still pairs
});
test('a season is not a fraction', () => {
  assert.strictEqual(analyze('in the 2019/20 (45%) season').results.length, 0);
});
test('zero degrees of freedom or n never print NaN', () => {
  for (const s of ['t(0) = 0, p = .05', 'r(0) = .5, p = .5', 'F(1, 0) = 2, p = .1', 'M = 3.47, n = 0']) {
    const r = analyze(s);
    assert.ok(!JSON.stringify(r).includes('NaN'), s);
  }
  assert.strictEqual(one('t(0) = 2.0, p = .05').status, 'skip');
});
test('more notations parse', () => {
  assert.strictEqual(one('χ²(3, N = 1,200) = 8.10, p = .044').status, 'ok');
  assert.strictEqual(one('Χ²(3) = 8.10, p = .044').status, 'ok');
  assert.strictEqual(one('X2(3) = 8.10, p = .044').status, 'ok');
  assert.strictEqual(one('t(60) = 2.00 (p = .05)').status, 'ok');
});
