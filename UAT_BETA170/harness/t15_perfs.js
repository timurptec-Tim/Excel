// Perforation input validation, zonation coverage, split/merge corrections, repeat Generate/Update.
const L = require('./lib'); const path = require('path'); const fs = require('fs');
const perfs = JSON.parse(fs.readFileSync(path.join(L.DATA, 'perforations.json')));
const tsv = (rows) => rows.map((r) => r.join('\t')).join('\n');
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p15');
  const paste = async (text) => { await L.nav(page, 'perforations'); await page.fill('#perf-paste', text); await page.click('#perf-paste-load'); await page.waitForTimeout(200); return L.toasts(page); };
  const step = async (n) => { const b = page.locator('.rail button[data-step="' + n + '"]'); if (await b.isEnabled()) { await b.click(); await page.waitForTimeout(350); return true; } return false; };
  const gen = async () => { await step('refresh'); await step('generate'); const t = await L.toasts(page); await step('update'); return t.concat(await L.toasts(page)); };
  const finalZones = async () => { await L.nav(page, 'kminput'); await page.click('#km-input-tabs button[data-case="1"]'); await L.nav(page, 'kmcontrol'); await page.click('#km-generate-btn'); await page.waitForTimeout(300); await L.toasts(page); await L.nav(page, 'kminput'); await page.evaluate(() => navigator.clipboard.writeText('')); await page.click('#km-input-copy-btn'); await page.waitForTimeout(200); const c = await L.clipboard(page); return c ? c.split('\n').map((l) => { const x = l.split('\t'); return [x[1], Number(x[2]), Number(x[3])]; }) : []; };
  const cases = [
    ['no-header', tsv(perfs), /22 interval/, true],
    ['empty-depth', tsv([['K1', 10350.25, ''], ...perfs.slice(1)]), /Correct invalid perforation row 1/, false],
    ['non-numeric', tsv([['K1', 'abc', 10390.25], ...perfs.slice(1)]), /Correct invalid perforation row 1/, false],
    ['bottom-eq-top', tsv([['K1', 10350.25, 10350.25], ...perfs.slice(1)]), /row 1/, false],
    ['bottom-above-top', tsv([['K1', 10390.25, 10350.25], ...perfs.slice(1)]), /row 1/, false],
    ['overlap', tsv([['K1', 10350.25, 10390.25], ['K1', 10380.25, 10400.25], ...perfs.slice(1)]), /Overlapping/, false],
    ['duplicate', tsv([perfs[0], perfs[0], ...perfs.slice(1)]), /Overlapping/, false],
    ['wrong-layer', tsv([['K2', 10350.25, 10390.25], ...perfs.slice(1)]), /does not match job layer/, false],
    ['outside-coverage', tsv([['K1', 9990, 10010], ...perfs.slice(1)]), /coverage/, false],
    ['partly-outside-bottom', tsv([...perfs, ['K1', 21990, 22010]]), /coverage/, false],
    ['first-last-sample', tsv([['K1', 10000, 10020], ['K1', 21979.5, 21999.5]]), null, true],
    ['unsorted', tsv(perfs.slice().reverse()), null, true],
    ['formatted-thousands', tsv(perfs.map((p) => [p[0], p[1].toLocaleString('en-US', { minimumFractionDigits: 2 }), p[2].toLocaleString('en-US', { minimumFractionDigits: 2 })])), null, true],
  ];
  let sortedZones = null;
  for (const [name, text, errRe, ok] of cases) {
    page.__dialogPolicy = 'accept';
    const pt = await paste(text); const tbl = await page.$$eval('#perf-tbody tr', (t) => t.map((r) => [...r.querySelectorAll('input')].map((i) => i.value)));
    const t = await gen(); const s = await L.lsState(page);
    let extra = {};
    if (ok) { const z = await finalZones(); extra = { zones: z.length, first: z[0], last: z[z.length - 1], contiguous: z.every((x, i) => i === 0 || Math.abs(z[i - 1][2] - x[1]) < 1e-9), uniqueNames: new Set(z.map((x) => x[0])).size === z.length };
      if (name === 'no-header') sortedZones = z; if (name === 'unsorted' || name === 'formatted-thousands') extra.sameAsSorted = JSON.stringify(z) === JSON.stringify(sortedZones); }
    const pass = ok ? (s.steps.update && extra.contiguous && extra.uniqueNames && (extra.sameAsSorted !== false)) : (!s.steps.generate && t.some((x) => errRe.test(x)));
    L.record({ id: 'PERF-' + name, area: 'Perforations', title: 'Perforation input: ' + name, expected: ok ? 'zonation built; contiguous; unique names' : 'Generate blocked with message ' + errRe, actual: Object.assign({ pasteToast: pt, table: tbl.slice(0, 2), genToasts: t, steps: s.steps }, extra), status: pass ? 'PASS' : 'FAIL' });
  }
  // restore baseline perforations
  await paste(tsv(perfs)); await gen();
  // manual add / edit / delete
  await L.nav(page, 'perforations'); await page.click('#add-perf-btn'); await page.waitForTimeout(200);
  let s = await L.lsState(page); const nAdd = s.perforations.length;
  const last = await page.locator('#perf-tbody tr').count();
  await L.typeInto(page, `#perf-tbody input[data-i="${last - 1}"][data-f="top"]`, '17000'); await L.typeInto(page, `#perf-tbody input[data-i="${last - 1}"][data-f="bottom"]`, '17010');
  s = await L.lsState(page); const edited = s.perforations[last - 1];
  await page.click(`#perf-tbody .row-del[data-i="${last - 1}"]`); await page.waitForTimeout(200); s = await L.lsState(page);
  L.record({ id: 'PERF-manual-add-edit-delete', area: 'Perforations', title: 'Manual add, edit, delete row', expected: 'row added (23), edited, deleted (22); invalidation of zonation', actual: { nAdd, edited, nAfterDelete: s.perforations.length, steps: s.steps }, status: nAdd === 23 && String(edited.top) === '17000' && s.perforations.length === 22 && !s.steps.generate ? 'PASS' : 'FAIL' });
  await gen();
  // ---- split / merge ----
  const addCorr = async (action, top, bottom) => { await L.nav(page, 'perforations'); await page.click('#add-splitmerge-btn'); await page.waitForTimeout(150); const n = await page.locator('#splitmerge-tbody tr').count(); const i = n - 1; await page.selectOption(`#splitmerge-tbody select[data-i="${i}"]`, action); await page.waitForTimeout(150); await L.typeInto(page, `#splitmerge-tbody input[data-i="${i}"][data-f="top"]`, top); await L.typeInto(page, `#splitmerge-tbody input[data-i="${i}"][data-f="bottom"]`, bottom); };
  const z0 = await finalZones();
  await addCorr('SPLIT', 10360.37, 10371.11);        // inside perf 1, off-sample depths
  await addCorr('MERGE', 10510.25, 10565.25);        // whole perf 2 -> one zone
  await addCorr('SPLIT', 10390.0, 10520.0);          // crosses perforation boundary -> must be rejected
  await L.nav(page, 'perforations'); await step('update'); await page.waitForTimeout(400); let t = await L.toasts(page); s = await L.lsState(page);
  const warn = await page.$eval('#correction-validation', (e) => e.hidden ? '' : e.innerText);
  L.record({ id: 'SM-cross-perf-rejected', area: 'Split/Merge', title: 'SPLIT crossing perforation boundary', expected: 'row flagged; Update blocked with message', actual: { toasts: t, warn, update: s.steps.update }, status: /Keep the interval inside one perforation/.test(warn + t.join()) && !s.steps.update ? 'PASS' : 'FAIL' });
  await page.click('#splitmerge-tbody .row-del[data-i="2"]'); await page.waitForTimeout(200);
  await step('update'); await page.waitForTimeout(400); t = await L.toasts(page);
  const z1 = await finalZones();
  const has = (v) => z1.some((z) => Math.abs(z[1] - v) < 1e-9 || Math.abs(z[2] - v) < 1e-9);
  const p2 = z1.filter((z) => z[1] >= 10510.25 - 1e-9 && z[2] <= 10565.25 + 1e-9);
  L.record({ id: 'SM-split-merge-exact', area: 'Split/Merge', title: 'Manual SPLIT at 10360.37/10371.11 and MERGE of perf 2', expected: 'exact manual boundaries retained (no snapping); perf 2 = one zone; contiguous; unique names; thin-zone warning if <8 ft', actual: { toasts: t, zonesBefore: z0.length, zonesAfter: z1.length, splitKept: [has(10360.37), has(10371.11)], perf2Zones: p2, contiguous: z1.every((x, i) => i === 0 || Math.abs(z1[i - 1][2] - x[1]) < 1e-9), unique: new Set(z1.map((x) => x[0])).size === z1.length }, status: has(10360.37) && has(10371.11) && p2.length === 1 && z1.every((x, i) => i === 0 || Math.abs(z1[i - 1][2] - x[1]) < 1e-9) ? 'PASS' : 'FAIL' });
  // near zone end split creating thin zone
  await addCorr('SPLIT', 10388.0, 10390.0); await step('update'); await page.waitForTimeout(400); t = await L.toasts(page);
  const z2 = await finalZones(); const thin = z2.filter((z) => !/Blank/.test(z[0]) && z[2] - z[1] < 8);
  L.record({ id: 'SM-thin-zone', area: 'Split/Merge', title: 'SPLIT 10388–10390 at perforation end (2 ft zone)', expected: 'boundary retained; thin-zone warning; not silently moved', actual: { toasts: t, thin }, status: thin.some((z) => Math.abs(z[1] - 10388) < 1e-9 && Math.abs(z[2] - 10390) < 1e-9) && t.some((x) => /thinner/.test(x)) ? 'PASS' : 'FAIL' });
  // drag on the correction chart (split mode) inside perf 5
  await L.nav(page, 'perforations'); await page.click('#perf-mode-split'); await page.selectOption('#perf-correction-focus', '4'); await page.waitForTimeout(300);
  const box = await page.locator('#perf-hit-area').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
  s = await L.lsState(page); const drag = s.splitMerge[s.splitMerge.length - 1]; const fb = await page.textContent('#perf-correction-feedback');
  const sampleSnapped = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;  // RESSUM samples every 0.5 ft
  L.record({ id: 'SM-drag-split', area: 'Split/Merge', title: 'Drag SPLIT on correction chart (perf 5 focus)', expected: 'row captured, snapped to log samples, inside perf 5 (11125.25–11160.25)', actual: { drag, fb }, status: drag && drag.action === 'SPLIT' && sampleSnapped(drag.top) && sampleSnapped(drag.bottom) && drag.top >= perfs[4][1] && drag.bottom <= perfs[4][2] ? 'PASS' : 'FAIL' });
  // cross-perf drag in FULL view
  await page.selectOption('#perf-correction-focus', 'FULL'); await page.waitForTimeout(300); const b2 = await page.locator('#perf-hit-area').boundingBox(); const n0 = (await L.lsState(page)).splitMerge.length;
  await page.mouse.move(b2.x + b2.width * 0.05, b2.y + 100); await page.mouse.down(); await page.mouse.move(b2.x + b2.width * 0.6, b2.y + 100, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
  L.record({ id: 'SM-drag-cross-rejected', area: 'Split/Merge', title: 'Drag across several perforations', expected: 'rejected with message; no row added', actual: { fb: await page.textContent('#perf-correction-feedback'), n: (await L.lsState(page)).splitMerge.length, n0 }, status: (await L.lsState(page)).splitMerge.length === n0 ? 'PASS' : 'FAIL' });
  // repeat Generate / Update unchanged
  await step('update'); await page.waitForTimeout(300); await L.toasts(page);
  await L.nav(page, 'kmcontrol'); await page.click('#km-generate-btn'); await page.waitForTimeout(300); await L.toasts(page);
  await L.nav(page, 'perforations'); const before = await L.lsState(page);
  await step('generate').catch(() => {}); await page.waitForTimeout(200); const tg = await L.toasts(page);
  await step('update'); await page.waitForTimeout(200); const tu = await L.toasts(page); const after = await L.lsState(page);
  L.record({ id: 'ZON-repeat-unchanged', area: 'Zonation', title: 'Repeat Generate and Update with unchanged inputs', expected: 'already-current message; cases/template/prediction status preserved', actual: { tg, tu, casesBefore: before.casesGenerated, casesAfter: after.casesGenerated, stale: after.reviewPrediction.bh.cases.map((c) => c.designStale) }, status: after.casesGenerated === before.casesGenerated && tu.some((x) => /already current/.test(x)) ? 'PASS' : 'FAIL' });
  L.save('t15_log.json', log);
  await ctx.close(); L.stopServer();
})();
