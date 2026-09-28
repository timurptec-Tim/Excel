// M2 approved snapshot vs working plot; L2 CT alignment protection; BH same-row-count data; export after pressure change.
const L = require('./lib');
const fs = require('fs'); const path = require('path');
// Convert the "KM dP Sim" polyline (colour #b1902e) back to psi using the SVG pressure-axis tick labels.
const dpFromSvg = (page, sel) => page.$eval(sel, (host) => {
  const svg = host.querySelector('svg'); if (!svg) return null;
  const ticks = [...svg.querySelectorAll('text')].filter((t) => t.getAttribute('text-anchor') === 'end' && /^-?\d+(\.\d+)?$/.test(t.textContent) && Number(t.getAttribute('x')) < 110).map((t) => [Number(t.textContent), Number(t.getAttribute('y')) - 5]);
  ticks.sort((a, b) => a[0] - b[0]); const [p0, y0] = ticks[0], [p1, y1] = ticks[ticks.length - 1];
  const toP = (y) => p0 + (y - y0) * (p1 - p0) / (y1 - y0);
  const pl = [...svg.querySelectorAll('polyline')].find((p) => p.getAttribute('stroke') === '#b1902e'); if (!pl) return { none: true };
  const ys = pl.getAttribute('points').split(' ').map((s) => Number(s.split(',')[1]));
  const label = [...svg.querySelectorAll('text')].map((t) => t.textContent).find((t) => /Probe Res P/.test(t));
  return { firstDp: Math.round(toP(ys[0]) * 10) / 10, label };
});
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p11');
  const open = async () => { await L.nav(page, 'matching'); await page.waitForTimeout(400); await page.evaluate(() => { ['ctm85-setup-panel', 'bhm85-setup-panel'].forEach((id) => { const d = document.getElementById(id); if (d && !d.open) d.querySelector('summary').click(); }); }); };
  await open();
  // ---- M2 ----
  const base = { snap: await dpFromSvg(page, '#bh-approved-chart170'), work: await dpFromSvg(page, '#bhm123-case1-slot .bhm59-plot-chart'), head: await page.$eval('#bhm123-case1-slot .bhm59-plot-head', (e) => e.innerText.replace(/\s+/g, ' ')) };
  await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3600'); await open();
  const after = { snap: await dpFromSvg(page, '#bh-approved-chart170'), work: await dpFromSvg(page, '#bhm123-case1-slot .bhm59-plot-chart'), head: await page.$eval('#bhm123-case1-slot .bhm59-plot-head', (e) => e.innerText.replace(/\s+/g, ' ')), snapText: await page.$eval('#bh-approved-chart170 p', (e) => e.innerText), badge: await page.textContent('#bhm61-approved-badge'), tabs: await page.$$eval('.bhm59-case-tab', (t) => t.map((x) => x.innerText.replace(/\s+/g, ' '))) };
  const s = await L.lsState(page);
  L.record({ id: 'M2-snapshot-pressure', area: 'Matching/M2', title: 'Approve at 3450, change to 3600: snapshot keeps 3450', expected: 'snapshot dP=BHP-3450, label 3450; working dP=BHP-3600; working labelled NOT APPROVED; explanation shown', actual: { base, after, statePressure: s.pressure.formationPressure, approvedP: s.matching.bh.approved.reservoirPressure }, status: after.snap.label.includes('3450') && after.work.label.includes('3600') && Math.abs((base.snap.firstDp - after.snap.firstDp)) < 1 && Math.abs(after.work.firstDp - (after.snap.firstDp - 150)) < 2 && /NOT APPROVED/.test(after.head) && /differs/.test(after.snapText) && s.pressure.formationPressure === '3600' ? 'PASS' : 'FAIL' });
  const d1 = await L.download(page, '#matching-export-xlsx', 'M2_matching_after_3600.xlsx'); await L.waitIdle(page);
  L.record({ id: 'M2-export-after-change', area: 'Matching/M2', title: 'Matching export after pressure change', expected: 'Summary shows current 3600 and approved 3450; approved image at 3450', actual: d1.path, status: 'SEE-EXPORT' });
  // re-approval is explicit
  const s2 = await L.lsState(page);
  L.record({ id: 'M2-no-implicit-reapproval', area: 'Matching/M2', title: 'No implicit re-approval after pressure change', expected: 'approved.reservoirPressure stays 3450 until explicit approve', actual: s2.matching.bh.approved.reservoirPressure, status: s2.matching.bh.approved.reservoirPressure === 3450 ? 'PASS' : 'FAIL' });
  await page.click('#bhm61-approve-final'); await page.waitForTimeout(500);
  const s3 = await L.lsState(page); const snapTxt = await page.$eval('#bh-approved-chart170 p', (e) => e.innerText);
  L.record({ id: 'M2-explicit-reapproval', area: 'Matching/M2', title: 'Explicit re-approval at 3600 replaces snapshot', expected: 'approved pressure 3600, no "differs" note', actual: { p: s3.matching.bh.approved.reservoirPressure, snapTxt }, status: s3.matching.bh.approved.reservoirPressure === 3600 && !/differs/.test(snapTxt) ? 'PASS' : 'FAIL' });
  await ctx.close();

  // ---- M2 fault injection: corrupt snapshot actualRows -> rendering throws; state must not keep snapshot pressure ----
  ({ ctx, page, log } = await L.launchClone('golden', 'p11b'));
  await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3600');
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('ProjectA_Zonation_LocalDB'); r.onsuccess = () => { const db = r.result, tx = db.transaction('matchingData', 'readwrite'), st = tx.objectStore('matchingData'); const q = st.getAll(); q.onsuccess = () => { const rec = q.result.find((x) => x.kind === 'bhApproved'); rec.actualRows = [null, null, null]; st.put(rec); }; tx.oncomplete = () => { db.close(); res(); }; }; }));
  await L.reload(page); await page.waitForTimeout(1500);
  await L.nav(page, 'matching'); await page.waitForTimeout(800);
  const sF = await L.lsState(page);
  L.record({ id: 'M2-render-failure-restore', area: 'Matching/M2', title: 'Snapshot render failure (injected corrupt actualRows)', expected: 'working pressure/axes/stageInputs unchanged (3600), error contained', actual: { pressure: sF.pressure.formationPressure, axes: sF.matching.bh.chart.axes, pageErrors: log.errors.slice(-3).map((e) => e.slice(0, 160)), exportBtnTitle: await page.getAttribute('#matching-export-xlsx', 'title') }, status: sF.pressure.formationPressure === '3600' && sF.matching.bh.chart.axes.xMax == null ? 'PASS' : 'FAIL' });
  await ctx.close();

  // ---- L2 CT saved alignment protection ----
  ({ ctx, page, log } = await L.launchClone('golden', 'p11c'));
  await open();
  const dis = await page.evaluate(() => ['ctm58-shift-range', 'ctm58-shift-number', 'ctm58-shift-reset'].map((i) => [i, document.getElementById(i).disabled]).concat([...document.querySelectorAll('[data-ctm-nudge]')].map((b) => ['nudge' + b.getAttribute('data-ctm-nudge'), b.disabled])));
  L.record({ id: 'L2-controls-disabled', area: 'Matching/L2', title: 'Saved CT alignment disables slider/number/nudges/reset', expected: 'all disabled', actual: dis, status: dis.every((d) => d[1]) ? 'PASS' : 'FAIL' });
  // attempt keyboard change on disabled number (force)
  await page.$eval('#ctm58-shift-number', (e) => { e.value = '99'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  let sc = await L.lsState(page);
  L.record({ id: 'L2-forced-input-ignored', area: 'Matching/L2', title: 'Scripted input event on locked shift box', expected: 'shift unchanged -12.5, lock kept', actual: { shift: sc.matching.ct.shift, locked: sc.matching.ct.locked, toasts: await L.toasts(page) }, status: sc.matching.ct.shift === -12.5 && sc.matching.ct.locked ? 'PASS' : 'FAIL' });
  page.__dialogPolicy = 'dismiss'; await page.click('#ct-edit170'); await page.waitForTimeout(300);
  sc = await L.lsState(page);
  L.record({ id: 'L2-unlock-cancel', area: 'Matching/L2', title: 'Cancel "Edit saved alignment" confirmation', expected: 'match stays locked', actual: { locked: sc.matching.ct.locked, dialog: log.dialogs.slice(-1) }, status: sc.matching.ct.locked ? 'PASS' : 'FAIL' });
  page.__dialogPolicy = 'accept'; await page.click('#ct-edit170'); await page.waitForTimeout(300);
  sc = await L.lsState(page);
  const exportAfterUnlock = await page.getAttribute('#matching-export-xlsx', 'title');
  L.record({ id: 'L2-unlock-confirm', area: 'Matching/L2', title: 'Confirm unlock', expected: 'unlocked, shift kept; CT excluded from export readiness', actual: { locked: sc.matching.ct.locked, shift: sc.matching.ct.shift, exportTitle: exportAfterUnlock }, status: !sc.matching.ct.locked && sc.matching.ct.shift === -12.5 ? 'PASS' : 'FAIL' });
  await L.typeInto(page, '#ctm58-shift-number', '-12.5'); sc = await L.lsState(page);
  L.record({ id: 'L2-unchanged-shift', area: 'Matching/L2', title: 'Entering the same shift value', expected: 'no change', actual: { shift: sc.matching.ct.shift, locked: sc.matching.ct.locked }, status: sc.matching.ct.shift === -12.5 ? 'PASS' : 'FAIL' });
  await page.click('[data-ctm-nudge="1"]').catch(() => {}); await page.waitForTimeout(200);
  await L.typeInto(page, '#ctm58-shift-number', '-8.3'); await page.click('#ctm58-lock-match'); await page.waitForTimeout(300);
  await L.reload(page); await page.waitForTimeout(1500); sc = await L.lsState(page);
  L.record({ id: 'L2-resave-persist', area: 'Matching/L2', title: 'Save new shift and reload', expected: 'locked -8.3 after reload', actual: { shift: sc.matching.ct.shift, locked: sc.matching.ct.locked }, status: sc.matching.ct.shift === -8.3 && sc.matching.ct.locked ? 'PASS' : 'FAIL' });
  // pasting a new CT KM table while locked
  await open(); await page.fill('#ctm58-km-paste', fs.readFileSync(path.join(L.DATA, 'CT_matching.tsv'), 'utf8')); await page.click('#ctm58-km-load'); await page.waitForTimeout(400); sc = await L.lsState(page);
  L.record({ id: 'L2-new-km-table-unlocks', area: 'Matching/L2', title: 'Re-pasting CT KM output while a match is saved', expected: 'REQUIREMENT CLARIFICATION: saved match should not change without explicit action', actual: { locked: sc.matching.ct.locked, shift: sc.matching.ct.shift, dialogs: log.dialogs.slice(-1), toasts: await L.toasts(page) }, status: sc.matching.ct.locked ? 'PASS' : 'REQUIREMENT CLARIFICATION' });
  await ctx.close();

  // ---- BH same row count, changed values; approval replacement; case 2 ----
  ({ ctx, page, log } = await L.launchClone('golden', 'p11d'));
  await open();
  await page.fill('#bhm59-km-paste', fs.readFileSync(path.join(L.DATA, 'BH_matching_case1_samecount_changed.tsv'), 'utf8')); await page.click('#bhm59-km-load'); await page.waitForTimeout(600);
  const head = await page.$eval('#bhm123-case1-slot .bhm59-plot-head', (e) => e.innerText.replace(/\s+/g, ' ')); const badge = await page.textContent('#bhm61-approved-badge');
  L.record({ id: 'BHM-samecount-changed', area: 'Matching/BH', title: 'Replace Case 1 KM data with same row count, different BHP', expected: 'working plot not labelled approved; approval snapshot preserved', actual: { head, badge, tab: await page.$eval('.bhm59-case-tab', (e) => e.innerText.replace(/\s+/g, ' ')) }, status: /NOT APPROVED/.test(head) && /FINAL APPROVED/.test(badge) ? 'PASS' : 'FAIL' });
  await page.click('#bhm59-add-case'); await page.waitForTimeout(300);
  await page.fill('#bhm59-km-paste', fs.readFileSync(path.join(L.DATA, 'BH_matching_case1.tsv'), 'utf8')); await page.click('#bhm59-km-load'); await page.waitForTimeout(500);
  const dis2 = await page.evaluate(() => ({ num: document.getElementById('bhm59-shift-number').disabled, save: document.getElementById('bhm59-save-match').textContent, fib: [...document.querySelectorAll('#bhm85-stage-tbody input')].every((i) => i.disabled) }));
  await page.click('#bhm61-approve-final'); await page.waitForTimeout(500);
  const s4 = await L.lsState(page);
  L.record({ id: 'BHM-case2-shared-alignment', area: 'Matching/BH', title: 'Match Case 2 inherits Case 1 alignment/stages; approval replaced by Case 2', expected: 'Case 2 controls read-only; approval replaced with Case 2 at shared shift', actual: { dis2, approved: [s4.matching.bh.approved.caseName, s4.matching.bh.approved.shift] }, status: dis2.num && dis2.fib && s4.matching.bh.approved.caseName === 'Match Case 2' && s4.matching.bh.approved.shift === 5 ? 'PASS' : 'FAIL' });
  L.save('t11_log.json', log);
  await ctx.close(); L.stopServer();
})();
