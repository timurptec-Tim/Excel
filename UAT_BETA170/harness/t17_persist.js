// Persistence, job lifecycle, storage failure, simulated BETA169-revision upgrade.
const L = require('./lib'); const path = require('path');
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p17');
  const snap = async () => { const s = await L.lsState(page); return { well: s.well, layer: s.layer, project: s.project, rows: s.modelRows, perfs: s.perforations.length, steps: s.steps, cases: s.casesGenerated, ctOut: s.actual.ct.output.length, bhOut: s.actual.bh.output.length, ctLock: s.matching.ct.locked, ctShift: s.matching.ct.shift, approved: s.matching.bh.approved.caseId, approvedP: s.matching.bh.approved.reservoirPressure, fi: s.matching.finalInterpretation.length, pressure: s.pressure, analogue: s.analogueDb.length, axes: s.matching.bh.chart.axes }; };
  const ui = async () => { await L.nav(page, 'matching'); await page.waitForTimeout(800); return { ctLock: await page.textContent('#ctm58-lock-status'), badge: await page.textContent('#bhm61-approved-badge'), ctRows: await page.textContent('#ctm58-km-badge'), bhRows: await page.textContent('#bhm59-km-badge'), exportDisabled: await page.$eval('#matching-export-xlsx', (b) => b.disabled), ctActual: await page.textContent('#ctm58-actual-name'), bhActual: await page.textContent('#bhm59-actual-name') }; };
  const s0 = await snap(), u0 = await ui();
  // exit and continue same job
  await page.click('#exit-link'); await page.waitForTimeout(200); await page.click('#landing-start'); await page.waitForTimeout(800);
  const s1 = await snap();
  L.record({ id: 'PERS-exit-continue', area: 'Persistence', title: 'Exit then continue same job', expected: 'no data loss, no confirm', actual: { same: JSON.stringify(s0) === JSON.stringify(s1), dialogs: log.dialogs.length }, status: JSON.stringify(s0) === JSON.stringify(s1) && log.dialogs.length === 0 ? 'PASS' : 'FAIL' });
  // cancelled new job
  await page.click('#exit-link'); await page.fill('#landing-well', 'OTHER-1'); page.__dialogPolicy = 'dismiss'; await page.click('#landing-start'); await page.waitForTimeout(500);
  const s2 = await snap(), onLanding = await page.getAttribute('#screen-app', 'data-active');
  L.record({ id: 'PERS-new-job-cancel', area: 'Persistence', title: 'Change well on landing, cancel confirmation', expected: 'previous job intact', actual: { well: s2.well, same: JSON.stringify(s0) === JSON.stringify(s2), appActive: onLanding, dialog: log.dialogs.slice(-1) }, status: JSON.stringify(s0) === JSON.stringify(s2) ? 'PASS' : 'FAIL' });
  // full reload of the completed job
  await page.fill('#landing-well', s0.well); page.__dialogPolicy = 'accept'; await page.click('#landing-start'); await page.waitForTimeout(500);
  await L.reload(page); await page.waitForTimeout(2000); const s3 = await snap(), u3 = await ui();
  L.record({ id: 'PERS-reload-complete-job', area: 'Persistence', title: 'Reload completed job', expected: 'all state + raw/KM/snapshot data restored; export ready', actual: { stateSame: JSON.stringify(s0) === JSON.stringify(s3), u0, u3 }, status: JSON.stringify(s0) === JSON.stringify(s3) && JSON.stringify(u0) === JSON.stringify(u3) ? 'PASS' : 'FAIL' });
  // new job confirm: old datasets must not leak
  await page.click('#exit-link'); await page.fill('#landing-well', 'NFQ40-1'); await page.fill('#landing-layer', 'K2'); await page.click('#project-toggle .project-opt[data-p="NFW"]'); await page.click('#landing-start'); await page.waitForTimeout(1500);
  const s4 = await snap(), u4 = await ui(); await L.nav(page, 'review'); const rv = await page.textContent('#rv53-ct-status'); await L.nav(page, 'basesummary'); const charts = await page.$eval('#chart1-slot', (e) => e.innerText.slice(0, 60));
  const idb = { raw: (await L.idbDump(page, 'actualRaw')).map((r) => r.jobKey), heavy: (await L.idbDump(page, 'heavyState')).map((r) => r.id), match: (await L.idbDump(page, 'matchingData')).map((r) => r.id) };
  L.record({ id: 'PERS-new-job-clean', area: 'Persistence', title: 'Confirm new job NFW/NFQ40-1/K2', expected: 'clean job: no rows, perfs, predictions, matching, charts; old job data removed', actual: { s4, u4, rv, charts, idb }, status: s4.rows === 0 && s4.perfs === 0 && !s4.approved && /NO TABLE/.test(rv) && /NO TABLE/.test(u4.ctRows) ? 'PASS' : 'FAIL' });
  // Reset All cancel/confirm
  page.__dialogPolicy = 'dismiss'; await page.click('#reset-all'); await page.waitForTimeout(500); const s5 = await snap();
  L.record({ id: 'PERS-reset-cancel', area: 'Persistence', title: 'Reset All → cancel', expected: 'no change', actual: { well: s5.well }, status: s5.well === 'NFQ40-1' ? 'PASS' : 'FAIL' });
  page.__dialogPolicy = 'accept'; await page.click('#reset-all'); await page.waitForTimeout(3000); await L.installToastSpy(page);
  const s6 = await L.lsState(page), idb6 = { raw: (await L.idbDump(page, 'actualRaw')).length, heavy: (await L.idbDump(page, 'heavyState')).length, match: (await L.idbDump(page, 'matchingData')).length, review: (await L.idbDump(page, 'reviewPrediction')).length };
  L.record({ id: 'PERS-reset-confirm', area: 'Persistence', title: 'Reset All → confirm', expected: 'landing, empty storage', actual: { ls: s6 && { well: s6.well, started: s6.started }, idb6, landing: await page.$eval('#screen-landing', (e) => getComputedStyle(e).display) }, status: idb6.raw + idb6.match + idb6.review === 0 ? 'PASS' : 'FAIL' });
  await ctx.close();
  // storage failure: quota exhaustion by big analogue DB, then reload
  ({ ctx, page, log } = await L.launchClone('golden', 'p17b'));
  await L.nav(page, 'analogue'); await L.chooseFile(page, '#connect-analogue-btn', path.join(L.DATA, 'analogue_big_40000.xlsx')); await page.waitForTimeout(12000);
  const warnBar = await page.$eval('#projecta-storage-warning', (e) => e.textContent).catch(() => null); const tq = await L.toasts(page);
  await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3500');
  await L.reload(page); await page.waitForTimeout(2500); const s7 = await L.lsState(page);
  L.record({ id: 'PERS-storage-quota', area: 'Persistence', title: 'Storage failure (40k-row analogue DB exceeds localStorage), later edit, reload', expected: 'user warned; after reload state is last committed (consistent) and warning explains loss', actual: { warnBar, toasts: tq, afterReload: { analogue: s7.analogueDb.length, pressure: s7.pressure.formationPressure }, banner: await page.$eval('#recovery-banner', (e) => e.innerText).catch(() => null) }, status: warnBar ? 'PASS' : 'FAIL', note: 'Edits after the failure (pressure 3500, 40k DB) are lost on reload; warning was displayed.' });
  await ctx.close();
  // simulated upgrade: mark stored job as BETA169 revision and reload
  ({ ctx, page, log } = await L.launchClone('golden', 'p17c'));
  const before = await snap();
  await page.evaluate(() => { const k = 'projecta-zonation-v48-fullcycle-beta33', s = JSON.parse(localStorage.getItem(k)); s.calculationRevision = 'BETA169'; localStorage.setItem(k, JSON.stringify(s)); });
  await L.reload(page); await page.waitForTimeout(2500); const after = await snap(), ua = await ui();
  L.record({ id: 'UPG-simulated-BETA169-revision', area: 'Upgrade', title: 'Stored job relabelled calculationRevision=BETA169 then opened in BETA170 (simulation, not a genuine BETA169 job)', expected: 'no silent loss of schedules/approval/alignment', actual: { same: JSON.stringify(before) === JSON.stringify(after), before, after, ua }, status: JSON.stringify(before) === JSON.stringify(after) ? 'PASS' : 'FAIL', note: 'Genuine BETA169 upgrade BLOCKED: BETA169 build not supplied.' });
  L.save('t17_log.json', log);
  await ctx.close(); L.stopServer();
})();
