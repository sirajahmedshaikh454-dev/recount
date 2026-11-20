(function () {
  const $ = (id) => document.getElementById(id);
  const src = $('src'), out = $('out');

  // Invented numbers: the first test is fine, the next three are deliberately wrong.
  const EXAMPLE =
    'Participants who slept longer scored higher on the memory task (M = 5.19, n = 28) than controls (M = 4.60, n = 30). ' +
    'The difference was significant, t(56) = 2.10, p = .040. A second comparison was also significant, t(28) = 1.20, p = .03. ' +
    'The effect of condition on recall was reliable, F(2, 27) = 4.00, p = .003, and 12 of 40 (35%) participants reported a nap. ' +
    'Anxiety and score were correlated, r(28) = .45, p = .013, and the groups differed in gender, χ²(1) = 3.84, p = .05.';

  const BADGE = { ok: 'Matches', inconsistent: 'Does not match', decision: 'Changes the conclusion', skip: "Can't be tested" };
  let timer = 0;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render() {
    const text = src.value;
    out.textContent = '';
    if (!text.trim()) { out.appendChild(el('p', 'empty', 'Results appear here as you type or paste.')); return; }
    const alpha = parseFloat($('alpha').value) || 0.05, items = parseInt($('items').value, 10) || 1;
    const { results, summary } = window.Recount.analyze(text, { alpha, items });
    if (!results.length) {
      out.appendChild(el('p', 'empty', 'No statistics found. Recount reads patterns like t(28) = 2.20, p = .036, F(2, 27) = 4.00, p < .05, χ²(1) = 3.84, p = .05, r(28) = .45, p = .013, M = 5.19, n = 28 and 12/40 (30%).'));
      return;
    }
    const bad = summary.inconsistent + summary.decision;
    out.appendChild(el('p', 'verdict', bad
      ? `${bad} of ${summary.total} numbers do not match when recomputed.`
      : `All ${summary.total - summary.skip} testable numbers match when recomputed.`));
    const chips = el('div', 'summary');
    for (const k of ['ok', 'inconsistent', 'decision', 'skip']) if (summary[k]) chips.appendChild(el('span', 'chip ' + k, `${summary[k]} ${BADGE[k].toLowerCase()}`));
    out.appendChild(chips);

    const ann = el('div', 'annot');
    ann.setAttribute('aria-label', 'Your text with every checked number highlighted');
    let pos = 0;
    results.forEach((r, i) => {
      ann.appendChild(document.createTextNode(text.slice(pos, r.start)));
      const m = el('mark', r.status, text.slice(r.start, r.end));
      m.title = BADGE[r.status];
      m.tabIndex = 0;
      const jump = () => { const c = $('c' + i); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1200); };
      m.addEventListener('click', jump);
      m.addEventListener('keydown', (e) => { if (e.key === 'Enter') jump(); });
      ann.appendChild(m);
      pos = r.end;
    });
    ann.appendChild(document.createTextNode(text.slice(pos)));
    out.appendChild(ann);

    const list = el('ol', 'cards');
    results.forEach((r, i) => {
      const li = el('li', 'card ' + r.status);
      li.id = 'c' + i;
      li.appendChild(el('div', 'badge', BADGE[r.status]));
      li.appendChild(el('div', 't', r.title));
      li.appendChild(el('p', '', r.detail));
      for (const h of r.hints) li.appendChild(el('p', 'hint', h));
      li.appendChild(el('div', 'src', r.text));
      list.appendChild(li);
    });
    out.appendChild(list);

    const copy = el('button', '', 'Copy report');
    copy.type = 'button';
    copy.style.marginTop = '12px';
    copy.addEventListener('click', () => {
      const lines = results.map((r) => `[${BADGE[r.status]}] ${r.text}\n    ${r.detail}`);
      const body = `Recount: ${summary.total} numbers checked, ${bad} do not match.\n\n` + lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(body) : Promise.reject()).then(() => { copy.textContent = 'Copied'; }, () => { copy.textContent = 'Copy failed: select the text instead'; });
    });
    out.appendChild(copy);
  }

  const later = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  src.addEventListener('input', later);
  $('alpha').addEventListener('input', later);
  $('items').addEventListener('input', later);
  $('go').addEventListener('click', render);
  $('demo').addEventListener('click', () => { src.value = EXAMPLE; render(); });
  $('clear').addEventListener('click', () => { src.value = ''; render(); src.focus(); });
  render();
})();
