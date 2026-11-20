"""Regenerate tests/fixtures.json: reference p-values from SciPy. Run: python tools/make_fixtures.py"""
import json
import os

from scipy import stats

out = {"t": [], "F": [], "chi2": [], "z": []}
for df in (1, 2, 3, 5, 10, 28, 59, 120, 500):
    for t in (0.05, 0.5, 1.0, 1.96, 2.2, 3.1, 5.0, 9.5):
        out["t"].append([t, df, float(2 * stats.t.sf(t, df))])
for d1, d2 in ((1, 10), (1, 58), (2, 27), (3, 96), (5, 200), (10, 15)):
    for f in (0.1, 1.0, 2.5, 4.0, 7.3, 15.0, 40.0):
        out["F"].append([f, d1, d2, float(stats.f.sf(f, d1, d2))])
for df in (1, 2, 3, 6, 10, 30, 100):
    for x in (0.2, 1.0, 3.84, 6.5, 12.0, 25.0, 60.0):
        out["chi2"].append([x, df, float(stats.chi2.sf(x, df))])
for z in (0.0, 0.5, 1.0, 1.96, 2.58, 4.0, 6.0):
    out["z"].append([z, float(2 * stats.norm.sf(z))])
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "..", "tests", "fixtures.json"), "w") as fh:
    json.dump(out, fh)
print({k: len(v) for k, v in out.items()})
