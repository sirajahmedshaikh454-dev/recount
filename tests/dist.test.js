const test = require('node:test');
const assert = require('node:assert');
const d = require('../src/dist.js');
const fx = require('./fixtures.json');

// relative error, with a floor so p-values near zero are compared sensibly
const close = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-12) + 1e-14;

test('t p-values match SciPy', () => {
  for (const [t, df, p] of fx.t) assert.ok(close(d.pT(t, df), p), `t=${t} df=${df}: got ${d.pT(t, df)} want ${p}`);
});
test('F p-values match SciPy', () => {
  for (const [f, a, b, p] of fx.F) assert.ok(close(d.pF(f, a, b), p), `F(${a},${b})=${f}: got ${d.pF(f, a, b)} want ${p}`);
});
test('chi-square p-values match SciPy', () => {
  for (const [x, df, p] of fx.chi2) assert.ok(close(d.pChi2(x, df), p), `chi2(${df})=${x}: got ${d.pChi2(x, df)} want ${p}`);
});
test('z p-values match SciPy', () => {
  for (const [z, p] of fx.z) assert.ok(close(d.pZ(z), p), `z=${z}: got ${d.pZ(z)} want ${p}`);
});
test('known textbook values', () => {
  assert.ok(Math.abs(d.pT(2.2, 28) - 0.0362) < 5e-4);
  assert.ok(Math.abs(d.pZ(1.96) - 0.05) < 1e-3);
  assert.ok(Math.abs(d.lgamma(5) - Math.log(24)) < 1e-12);
});
test('r converts to t', () => {
  assert.ok(Math.abs(d.tFromR(0.5, 28) - 0.5 * Math.sqrt(28 / 0.75)) < 1e-12);
});
