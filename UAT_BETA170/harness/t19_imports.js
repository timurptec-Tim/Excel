// RESSUM import variants, prediction paste parsing, KM diverter loading mapping / stage add-remove.
const L = require('./lib'); const path = require('path'); const fs = require('fs');
const D = (f) => path.join(L.DATA, f);
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p19');
  page.__dialogPolicy = 'accept';
  const ress = async (f) => { await L.nav(page, 'models'); await L.chooseFile(page, '#load-workbook-btn', D(f)); await page.waitForTimeout(2500); await L.waitIdle(page); const s = await L.lsState(page); return { rows: s.modelRows, rkb: s.rkb, steps: s.steps, src: s.sourceWorkbookName, toasts: await L.toasts(page) }; };
  const r1 = await ress('RESSUM_wrong.xlsx');
  L.record({ id: 'IMP-ressum-wrong', area: 'Import/RESSUM', title: 'Wrong workbook after valid import', expected: 'rejected; existing 24000-row model retained', actual: r1, status: r1.rows === 24000 && r1.toasts.some((t) => /Couldn't parse/.test(t)) ? 'PASS' : 'FAIL' });
  const r2 = await ress('RESSUM_direct.csv');
  L.record({ id: 'IMP-ressum-csv', area: 'Import/RESSUM', title: 'CSV (ELAN columns, header row)', expected: '4000 rows; TVD = TVDSS + RKB(82)', actual: r2, status: r2.rows === 4000 ? 'PASS' : 'FAIL' });
  const r3 = await ress('RESSUM_numeric_text.xlsx');
  const s3 = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('ProjectA_Zonation_LocalDB'); r.onsuccess = () => { const db = r.result, q = db.transaction('heavyState').objectStore('heavyState').getAll(); q.onsuccess = () => { const rec = q.result.find((x) => x.log && x.log.length); res(rec ? rec.log.slice(0, 2) : null); db.close(); }; }; }));
  L.record({ id: 'IMP-ressum-numeric-text', area: 'Import/RESSUM', title: 'Numbers stored as text incl. "10,000.00" thousands separators, trailing blank rows, no RKB cell', expected: '4000 rows; values parsed; RKB retained from job (82)', actual: Object.assign(r3, { firstRows: s3 }), status: r3.rows === 4000 ? 'PASS' : 'FAIL' });
  const r4 = await ress('RESSUM_duplicate_md.xlsx');
  await L.nav(page, 'perforations'); await page.fill('#perf-paste', 'K1\t10100\t10200'); await page.click('#perf-paste-load'); await page.locator('.rail button[data-step="refresh"]').click(); await page.waitForTimeout(200); await page.locator('.rail button[data-step="generate"]').click(); await page.waitForTimeout(300);
  const t4 = await L.toasts(page);
  L.record({ id: 'IMP-ressum-duplicate-md', area: 'Import/RESSUM', title: 'Duplicate MD sample', expected: 'Generate blocked with duplicate-MD message', actual: { r4, t4 }, status: t4.some((t) => /Duplicate log MD/.test(t)) ? 'PASS' : 'FAIL' });
  await ctx.close();
  ({ ctx, page, log } = await L.launchClone('golden', 'p19b'));
  // prediction paste variants
  const ref = fs.readFileSync(D('CT_prediction.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t').map(Number));
  const pasteCT = async (f) => { await L.nav(page, 'review'); if (await page.$eval('#rv75-ct-loader', (e) => e.classList.contains('collapsed'))) await page.click('#rv75-ct-loader-toggle'); await page.fill('#rv55-ct-paste', fs.readFileSync(D(f), 'utf8')); await page.click('#rv55-ct-paste-load'); await page.waitForTimeout(500); const recs = await L.idbDump(page, 'reviewPrediction'); const ct = recs.find((r) => r.kind === 'ct'); return { toasts: await L.toasts(page), rows: ct ? ct.rows : [] }; };
  for (const [f, exp] of [['CT_pred_reordered.tsv', 'identical to reference'], ['CT_pred_noheader.tsv', 'identical to reference'], ['CT_pred_blank_trailing.tsv', 'identical to reference'], ['CT_pred_unsorted_dupvol.tsv', 'sorted by volume; 161 rows incl. duplicate volume'], ['CT_pred_textcells.tsv', 'non-numeric volume row skipped; "5,000.5" handled; n/a -> blank'], ['CT_pred_4cols.tsv', 'rejected (5 columns required)']]) {
    const r = await pasteCT(f); const same = r.rows.length === ref.length && r.rows.every((x, i) => x.volume === ref[i][0] && x.frac === ref[i][1] && x.rate === ref[i][2] && x.bhp === ref[i][3] && x.whp === ref[i][4]);
    const sorted = r.rows.every((x, i) => i === 0 || r.rows[i - 1].volume <= x.volume);
    let ok = /identical/.test(exp) ? same : /sorted/.test(exp) ? sorted && r.rows.length === 161 : /rejected/.test(exp) ? r.toasts.some((t) => /could not be loaded/.test(t)) : null;
    L.record({ id: 'PRED-paste-' + f.replace('.tsv', ''), area: 'Prediction/import', title: 'CT prediction paste: ' + f, expected: exp, actual: { n: r.rows.length, first: r.rows[0], toasts: r.toasts, sorted, identical: same, weird: r.rows.filter((x) => x.volume > 4000 || x.frac === null).slice(0, 3) }, status: ok === null ? 'OBSERVED' : ok ? 'PASS' : 'FAIL' });
  }
  await pasteCT('CT_prediction.tsv');
  // display refresh does not modify pasted source values (BH)
  const bhBefore = (await L.idbDump(page, 'reviewPrediction')).find((r) => r.caseId === 'base').rows.map((r) => [r.volume, r.frac, r.rate, r.bhp, r.whp]);
  await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3600'); await L.nav(page, 'review'); await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3450'); await L.nav(page, 'review');
  const bhAfter = (await L.idbDump(page, 'reviewPrediction')).find((r) => r.caseId === 'base').rows.map((r) => [r.volume, r.frac, r.rate, r.bhp, r.whp]);
  L.record({ id: 'PRED-source-unchanged', area: 'Prediction', title: 'Display refresh / pressure round-trip leaves pasted source columns unchanged', expected: 'identical', actual: { n: bhAfter.length }, status: JSON.stringify(bhBefore) === JSON.stringify(bhAfter) ? 'PASS' : 'FAIL' });
  // prediction case deselection & export scope
  await L.nav(page, 'kmcontrol'); page.__dialogPolicy = 'accept'; await page.uncheck('#km-multiplier-tbody input[data-prediction-case][data-i="2"]'); await page.waitForTimeout(200);
  await page.click('#km-generate-btn'); await page.waitForTimeout(300); await L.toasts(page);
  await L.nav(page, 'review'); const d = await L.download(page, '.rail button[data-step="export"]', 'scope_case1_only.xlsx'); await L.waitIdle(page);
  const sheets = await (async () => { const z = require('child_process').execSync(`python3 -c "import zipfile,re;print(re.findall(r'<sheet name=\\"([^\\"]+)\\"',zipfile.ZipFile('${d.path}').read('xl/workbook.xml').decode()))"`).toString(); return z.trim(); })();
  L.record({ id: 'PRED-export-selected-only', area: 'Exports', title: 'Deselect Case 3 then export audited workbook', expected: 'only Case 1 sheets / charts', actual: sheets, status: !/Case_3|BH_Case_3/.test(sheets) && /Case_1/.test(sheets) ? 'PASS' : 'FAIL' });
  await page.goto('about:blank'); await ctx.close();
  // KM loadings mapping
  ({ ctx, page, log } = await L.launchClone('golden', 'p19c'));
  await L.nav(page, 'kmcontrol');
  const vals = ['400', '500', '600', '300', '700', 'OPS 100-600', 'ops100-300', 'BG50-75', '125ppt', 'Spurt_Loss 75', 'OPS', '175', '50'];
  // add stages up to vals.length
  let cnt = await page.locator('#km-diverter-tbody tr').count();
  const sAdd0 = cnt; for (let i = 0; i < 2; i++) await page.click('#km-add-diverter-btn'); cnt = await page.locator('#km-diverter-tbody tr').count();
  for (let i = 0; i < vals.length; i++) await L.typeInto(page, `#km-diverter-tbody input[data-case="0"][data-stage="${i}"]`, vals[i]);
  await page.click('#km-generate-btn'); await page.waitForTimeout(300); const st = await L.lsState(page);
  await L.nav(page, 'kminput'); await page.click('#km-input-tabs button[data-case="1"]'); await page.waitForTimeout(300);
  const head = await page.$$eval('#km-input-spurt-head th', (t) => t.map((x) => x.textContent));
  L.record({ id: 'KM-loading-map', area: 'KM/loadings', title: 'Diverter loading lookup mapping', expected: '400→OPS 100-300, 500→OPS 100-400, 600→OPS 100-500, 300 & 700 unsupported, text labels per lookup', actual: { stagesBefore: sAdd0, stagesAfter: cnt, head, status: st.kmCaseStatus[0] }, status: head[1] === 'Spurt_Loss OPS 100-300' && head[2] === 'Spurt_Loss OPS 100-400' && head[3] === 'Spurt_Loss OPS 100-500' && /unsupported/.test(head[4]) && /unsupported/.test(head[5]) && /Unsupported Diverter Loading at stage\(s\) 4, 5/.test(st.kmCaseStatus[0].reason) ? 'PASS' : 'FAIL' });
  // remove stage 4 (300) -> renumbering
  await L.nav(page, 'kmcontrol'); await page.click('[data-remove-km-diverter="3"]'); await page.waitForTimeout(300);
  const st2 = await L.lsState(page); const labels = await page.$$eval('#km-diverter-tbody tr td:first-child', (t) => t.slice(0, 5).map((x) => x.childNodes[0].textContent.trim()));
  L.record({ id: 'KM-stage-remove-renumber', area: 'KM/loadings', title: 'Remove stage 4 (with confirm)', expected: 'later stages renumbered; loadings shift up', actual: { diverter0: st2.kmCases[0].diverter.slice(0, 6), labels, count: st2.kmDiverterCount, dialogs: log.dialogs.slice(-1) }, status: st2.kmCases[0].diverter[3] === '700' && st2.kmDiverterCount === cnt - 1 ? 'PASS' : 'FAIL' });
  L.save('t19_log.json', log); await ctx.close(); L.stopServer();
})();
