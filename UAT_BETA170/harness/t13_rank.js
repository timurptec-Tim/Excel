// Analogue screening/best-three selection vs independent ranking; renames; manual edits; transfer.
const L = require('./lib'); const path = require('path'); const fs = require('fs');
const EXP = JSON.parse(fs.readFileSync(path.join(L.DATA, 'rank_expected.json')));
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p13');
  const load = async (f) => { await L.nav(page, 'analogue'); await page.selectOption('#analogue-lith-units', 'auto'); await L.chooseFile(page, '#connect-analogue-btn', path.join(L.DATA, f)); await page.waitForTimeout(600); await L.toasts(page); };
  for (const [k, exp] of Object.entries(EXP)) {
    await load('rank_' + k + '.xlsx'); await page.click('#select-cases-btn'); await page.waitForTimeout(400);
    const s = await L.lsState(page); const got = s.suggestedCases.map((c) => [c.targetCase, c.sourceIndex, Math.round(Number(c.multiplier) * 1e9) / 1e9]);
    const cards = await page.$$eval('.analogue-compare-card', (c) => c.map((x) => x.querySelector('.well').textContent));
    const hl = await page.$$eval('#analogue-db-tbody tr', (t) => t.map((r, i) => r.classList.contains('selected-source') ? i : -1).filter((i) => i >= 0));
    const consistent = JSON.stringify(cards) === JSON.stringify(s.suggestedCases.map((c) => c.well)) && JSON.stringify(hl.sort()) === JSON.stringify(s.suggestedCases.map((c) => c.sourceIndex).sort());
    const ok = JSON.stringify(got) === JSON.stringify(exp) && consistent;
    L.record({ id: 'AN-rank-' + k, area: 'Analogue/ranking', title: 'Best-three selection: ' + k, expected: exp, actual: { got, cards, highlighted: hl, toasts: await L.toasts(page) }, status: ok ? 'PASS' : 'FAIL' });
  }
  // manual edits
  await load('analogue_main.xlsx'); await page.click('#select-cases-btn'); await page.waitForTimeout(400);
  const edit = async (i, v) => { await L.typeInto(page, `.analogue-compare-card input[data-i="${i}"]`, v); };
  await edit(0, ''); let s = await L.lsState(page); const btn1 = await page.$eval('#transfer-cases-btn', (b) => b.disabled);
  await edit(2, '0'); await page.click('#transfer-cases-btn'); await page.waitForTimeout(300); s = await L.lsState(page);
  L.record({ id: 'AN-manual-edits', area: 'Analogue/ranking', title: 'Blank Case-2 multiplier + zero Case-4 multiplier then transfer', expected: 'Case 2 keeps existing (incomplete), Case 3 = 1.99995…, Case 4 = 0 (zero allowed)', actual: { kmCases: s.kmCases.map((c) => [c.dolomite, c.limestone]), transferDisabledAfterBlank: btn1, toasts: await L.toasts(page) }, status: s.kmCases[1].dolomite === '1.19997304467' && s.kmCases[3].dolomite === '0' && s.kmCases[2].dolomite === '1.99995507446' ? 'PASS' : 'FAIL' });
  // rename well within platform then other platform
  const rename = async (name) => { await page.click('#hdr-well'); await page.keyboard.press('Control+A'); await page.keyboard.type(name); await page.keyboard.press('Enter'); await page.waitForTimeout(400); };
  await rename('NFQ22-9'); s = await L.lsState(page);
  L.record({ id: 'AN-rename-same-platform', area: 'Analogue/ranking', title: 'Rename NFQ22-4 → NFQ22-9', expected: 'suggestions kept; datasets linked', actual: { n: s.suggestedCases.length, well: s.well, toasts: await L.toasts(page) }, status: s.suggestedCases.length === 3 ? 'PASS' : 'FAIL' });
  await rename('NFQ30-4'); s = await L.lsState(page); const sugg = await page.$eval('#suggested-cases-dashboard', (e) => e.innerText.slice(0, 80));
  L.record({ id: 'AN-rename-other-platform', area: 'Analogue/ranking', title: 'Rename to other platform NFQ30-4', expected: 'suggestions cleared, prompt to reselect; case inputs kept', actual: { n: s.suggestedCases.length, sugg, kmCase3: s.kmCases[2].dolomite, toasts: await L.toasts(page) }, status: s.suggestedCases.length === 0 && s.kmCases[2].dolomite === '1.99995507446' ? 'PASS' : 'FAIL' });
  await page.click('#select-cases-btn'); await page.waitForTimeout(400); s = await L.lsState(page);
  L.record({ id: 'AN-other-platform-fallback', area: 'Analogue/ranking', title: 'NFQ30-4 has only one same-platform (NFQ30-2) candidate', expected: 'same-platform pool (NFQ30-2) only → BEST only', actual: s.suggestedCases.map((c) => [c.targetCase, c.well, c.samePlatform]), status: s.suggestedCases.length === 1 && s.suggestedCases[0].well === 'NFQ30-2' ? 'PASS' : 'FAIL' });
  // reload keeps renamed well bound to datasets
  await L.reload(page); await page.waitForTimeout(1500); s = await L.lsState(page);
  L.record({ id: 'PERS-rename-reload', area: 'Persistence', title: 'Reload after header rename', expected: 'well name kept; RESSUM/raw data still restored', actual: { well: s.well, modelRows: s.modelRows, toasts: await L.toasts(page), rows: await page.textContent('#model-rows-count') }, status: s.well === 'NFQ30-4' && s.modelRows === 24000 ? 'PASS' : 'FAIL' });
  await ctx.close(); L.stopServer();
})();
