# Recount

**Paste a results section. Recount recomputes every p-value, GRIM-checks every mean and checks every percentage it can find, and shows you which numbers do not add up.**

It runs entirely in your browser tab. Nothing is uploaded, there is no account, and there are no dependencies. Double-click `index.html` to use it.

```text
The difference was significant, t(28) = 1.20, p = .03.
  -> CHANGES THE CONCLUSION: t(28) = 1.20 gives p = .240, not .03. The text says significant; the numbers say not.
(M = 5.19, n = 28)
  -> DOES NOT MATCH: no set of 28 whole-number scores averages 5.19. Nearest possible means: 5.18 and 5.21.
12 of 40 (35%)
  -> DOES NOT MATCH: 12/40 is 30.0%.
```

## Why this exists

Typos and copy errors in the numbers of a results section are common, and they are the kind of thing a reviewer or examiner checks with a calculator. The statcheck study of more than 250,000 p-values in psychology papers (Nuijten et al., 2016, 1985 to 2013) found that about half of the papers that use significance tests contain at least one p-value that does not match its test statistic and degrees of freedom, and about one paper in eight has an error that changes the statistical conclusion. The GRIM test (Brown & Heathers) showed that many reported means are arithmetically impossible for the stated sample size.

Those tools exist, but statcheck needs R and a PDF pipeline, and GRIM calculators check one number at a time. Recount lets you paste your own results section and see every checkable number at once, with the reason, before someone else does. It is aimed at students writing a thesis, final-year project or paper, and at anyone reading one.

## What it checks

| Pattern in your text | Check |
|---|---|
| `t(28) = 2.20, p = .036` | Recompute the two-tailed p from t and the degrees of freedom |
| `F(2, 27) = 4.00, p = .03` | Same, from the F distribution |
| `χ²(2) = 6.50, p = .039` (also `chi2`, `chi-square`) | Same, from the chi-square distribution |
| `r(28) = .45, p = .013` | Convert r to t, then recompute |
| `z = 1.96, p = .05` | Same, from the normal distribution |
| `M = 5.19, n = 28` (either order) | **GRIM**: is this mean possible for whole-number data? |
| `12/40 (35%)`, `35% (n = 14/40)` | Is the percentage the rounded ratio? |

Each result is one of: **Matches**, **Does not match**, **Changes the conclusion** (the mismatch flips significance at your α), or **Can't be tested** (for example, GRIM cannot test a large sample).

Details that matter:

- **Rounding is respected.** A reported statistic is itself rounded, so the p it implies is a range. `t(10) = 2.2, p = .05` is accepted because 2.2 stands for anything from 2.15 to 2.25.
- **One-sided hint.** If the reported p matches half the computed p, Recount says it may be a one-tailed test and asks you to state that.
- **`p = .000`** is flagged: p cannot be exactly zero, write `p < .001`.
- **Items per scale** lets GRIM handle a mean of several items (n times items possible totals).

## How correct is it? (measured)

The distributions (t, F, chi-square, normal) are implemented from scratch, with no libraries: a Lanczos log-gamma, a continued-fraction incomplete beta and a series and continued-fraction incomplete gamma. They are checked against SciPy:

- `tools/make_fixtures.py` generates **170 reference p-values** from SciPy over a grid of statistics and degrees of freedom.
- `tests/dist.test.js` requires agreement to **1e-8 relative error**, including very small p-values.
- `tests/recount.test.js` has 23 behaviour tests: rounding intervals, decision errors, one-tailed hint, either-order GRIM, the classic Brown and Heathers example (5.19 with n = 28 is impossible), percentages, odd spacing and unicode minus, zero degrees of freedom, and speed checks on 300 KB to 500 KB hostile inputs. An independent review also ran about 130 correct APA-style sentences (including Welch df, negative t, large t) through it with no false alarms.

Run them: `npm test` (Node 18 or newer, uses the built-in test runner).

## Honest limits

- It reads **common APA-style patterns only**. Statistics written as prose, in tables, or in unusual layouts are not seen. Absence of a flag means "not checked", never "verified". The summary counts what was checked.
- A mismatch is **not proof of an error or of misconduct**. Typos, one-tailed tests, corrections (Welch, Greenhouse-Geisser), and rounding inside software all produce mismatches. It tells you where to look.
- **GRIM only applies to whole-number data** (counts, single Likert items) and small samples. Averaged or decimal scores will raise false alarms; use *items per scale* or ignore those.
- The two-tailed p is assumed. Other tails appear as a hint, not a verdict.
- The prevalence figures above come from the cited studies as summarised by their authors and by the search results I read; I did not re-derive them.

## Layout

```
index.html        the page (no build step)
src/dist.js       t, F, chi-square, normal from scratch
src/recount.js    pattern extraction and the checks (usable from Node too)
src/app.js        the page logic (builds the DOM from text nodes; pasted text is never inserted as HTML)
tests/            node:test suites and SciPy reference values
tools/            fixture generator and a tiny static server (npm run serve)
```

## Skills & methodology

**Method.** Research first: I surveyed existing tools and surveys before choosing the idea, and dropped my first candidate (a subscription detector for bank statements) when the search showed that space was already crowded. Then bottom-up: the mathematics first, proven against an independent implementation (SciPy), then the extraction and checks, then the page. Every step was committed and pushed after the tests passed. Bugs found by testing rather than by luck: a quadratic-time percentage pattern (hostile-input speed test), my own wrong test expectations about decision errors (the engine was right), and, from the review, a number pattern that froze the page for minutes on a long run of digits, a mean-and-n match that swallowed a test sitting between them, a mean paired with another group's n, a season (`2019/20`) read as a fraction, and NaN output for zero degrees of freedom. All six are fixed with regression tests.

**Skills and tools.** Claude Code with web search for the literature and the competing tools; SciPy as the independent oracle for the numerics; the built-in browser to verify desktop and phone widths, dark and light colour schemes, and a script-injection attempt in the pasted text; an independent read-only review subagent that tried to break the checker with realistic correct and incorrect sentences and adversarial input; the `ponytail` style (no dependencies, no build step, smallest working design).

**Choices worth defending.** Pure client-side so sensitive drafts never leave the machine. Rounding-aware comparison so correct numbers are not flagged. Every status is labelled in words as well as colour. The DOM is built from text nodes only.

## License

MIT.
