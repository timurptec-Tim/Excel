// M3 caching correctness + performance / stress measurements.
const L = require('./lib'); const path = require('path'); const fs = require('fs');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p18');
  const cdp = await ctx.newCDPSession(page);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return Math.round(h.usedSize / 1048576 * 10) / 10; };
  const perf = {};
  // load timing: 5 reloads until workspace + raw restore toast
  const loads = [];
  for (let i = 0; i < 5; i++) { const t0 = Date.now(); await page.reload(); await page.waitForFunction(() => document.querySelector('#screen-app').getAttribute('data-active') === 'true' && document.getElementById('model-rows-count').textContent === '24000'); loads.push(Date.now() - t0); }
  perf.reloadToWorkspaceMs = { runs: loads, median: q(loads, .5), p90: q(loads, .9) };
  await page.waitForTimeout(1500); await L.installToastSpy(page);
  // observe chart DOM rebuilds
  await page.evaluate(() => { window.__mut = {}; ['chart1-slot', 'rv53-ct-chart', 'rv53-bh-chart', 'ctm58-chart', 'bhm59-case-plots', 'bhm123-case1-slot', 'ct-chart'].forEach((id) => { const e = document.getElementById(id); if (e) new MutationObserver((m) => { window.__mut[id] = (window.__mut[id] || 0) + m.length; }).observe(e, { childList: true }); }); });
  const muts = async () => { const m = await page.evaluate(() => Object.assign({}, window.__mut)); await page.evaluate(() => { window.__mut = {}; }); return m; };
  const visit = async (t) => { const t0 = await page.evaluate(() => performance.now()); await L.nav(page, t); const t1 = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(performance.now())))); return t1 - t0; };
  const pages = ['models', 'perforations', 'basesummary', 'pressure', 'analogue', 'kmcontrol', 'kminput', 'review', 'audit', 'ctactual', 'bhactual', 'matching'];
  perf.firstVisitMs = {}; for (const p of pages) perf.firstVisitMs[p] = Math.round(await visit(p));
  await muts();
  // unchanged revisit
  await visit('models'); await muts(); await visit('basesummary'); const m1 = await muts(); await visit('models'); await visit('review'); const m2 = await muts();
  L.record({ id: 'M3-unchanged-revisit', area: 'Caching/M3', title: 'Unchanged revisit of Base Summary and Prediction Runs', expected: 'no chart rebuild', actual: { basesummary: m1, review: m2 }, status: !m1['chart1-slot'] && !m2['rv53-ct-chart'] && !m2['rv53-bh-chart'] ? 'PASS' : 'FAIL' });
  // pressure change -> review rebuilt with new dP
  await visit('pressure'); await L.typeInto(page, '#formation-pressure', '3600'); await muts(); await visit('review'); const m3 = await muts();
  const dp = await page.$eval('#rv53-bh-tbody tr', (r) => [...r.cells].map((c) => c.textContent));
  L.record({ id: 'M3-pressure-refresh', area: 'Caching/M3', title: 'Pressure change then revisit Prediction Runs', expected: 'charts rebuilt; dP = BHP − 3600', actual: { m3, firstRow: dp }, status: m3['rv53-bh-chart'] && Math.abs(Number(dp[3]) - 3600 - Number(dp[5])) < 0.01 ? 'PASS' : 'FAIL' });
  await visit('pressure'); await L.typeInto(page, '#formation-pressure', '3450');
  // split/merge change -> base summary rebuilt
  await visit('perforations'); await page.click('#add-splitmerge-btn'); await page.waitForTimeout(100); const n = await page.locator('#splitmerge-tbody tr').count();
  await page.selectOption(`#splitmerge-tbody select[data-i="${n - 1}"]`, 'SPLIT'); await L.typeInto(page, `#splitmerge-tbody input[data-i="${n - 1}"][data-f="top"]`, 10360); await L.typeInto(page, `#splitmerge-tbody input[data-i="${n - 1}"][data-f="bottom"]`, 10370);
  await page.locator('.rail button[data-step="update"]').click(); await page.waitForTimeout(400); await muts(); await visit('basesummary'); const m4 = await muts();
  const zoneAt = await page.$eval('#chart3-slot svg', (s) => s.outerHTML.length);
  L.record({ id: 'M3-splitmerge-refresh', area: 'Caching/M3', title: 'Split/merge + Update then revisit Base Summary', expected: 'charts rebuilt', actual: { m4 }, status: m4['chart1-slot'] ? 'PASS' : 'FAIL' });
  // multiplier change -> review KPI refresh
  await visit('kmcontrol'); await L.typeInto(page, '#km-multiplier-tbody input[data-i="2"][data-f="dolomite"]', '3'); await muts(); await visit('review'); const m5 = await muts(); const kpi = await page.$eval('[data-review-case="case3"]', (e) => e.innerText.replace(/\s+/g, ' ').slice(0, 120));
  L.record({ id: 'M3-multiplier-refresh', area: 'Caching/M3', title: 'Case 3 multiplier change then revisit Prediction Runs', expected: 'Case 3 KPI shows DOL × 3.00 and stale banner', actual: { m5, kpi, banner: await page.$eval('#audit86-prediction-warning', (b) => b.hidden ? '' : b.innerText).catch(() => '') }, status: /DOL × 3\.00/.test(kpi) ? 'PASS' : 'FAIL' });
  // 200 page switches
  const h0 = await heap(); const sw = []; const cycle = ['basesummary', 'review', 'kminput', 'matching', 'ctactual', 'bhactual', 'kmcontrol', 'analogue'];
  for (let i = 0; i < 200; i++) sw.push(await visit(cycle[i % cycle.length]));
  const h1 = await heap();
  perf.pageSwitch200 = { median: +q(sw, .5).toFixed(1), p90: +q(sw, .9).toFixed(1), p99: +q(sw, .99).toFixed(1), max: +Math.max(...sw).toFixed(1), heapMB: [h0, h1] };
  const perPage = {}; sw.forEach((v, i) => { const p = cycle[i % cycle.length]; (perPage[p] = perPage[p] || []).push(v); }); perf.pageSwitchByPage = Object.fromEntries(Object.entries(perPage).map(([k, v]) => [k, { median: +q(v, .5).toFixed(1), p90: +q(v, .9).toFixed(1) }]));
  L.record({ id: 'PERF-200-switches', area: 'Performance', title: '200 page switches', expected: 'no errors; bounded memory', actual: perf.pageSwitch200, status: log.errors.length === 0 && h1 - h0 < 50 ? 'PASS' : 'FAIL' });
  // rapid interactions
  await visit('matching'); let downloads = 0; page.on('download', () => downloads++);
  await Promise.all([page.click('#matching-export-xlsx'), page.click('#matching-export-xlsx', { force: true }).catch(() => {})]); await page.waitForTimeout(8000); await L.waitIdle(page);
  const t1 = await L.toasts(page);
  L.record({ id: 'PERF-double-click-export', area: 'Exports', title: 'Double-click matching export', expected: 'one download', actual: { downloads, toasts: t1 }, status: downloads === 1 ? 'PASS' : 'FAIL' });
  await visit('kmcontrol'); for (let i = 0; i < 15; i++) await page.click('#km-generate-btn'); await page.waitForTimeout(500); await L.toasts(page);
  await visit('ctactual'); for (let i = 0; i < 8; i++) await page.click('#ct-process'); await page.waitForTimeout(800); await L.toasts(page);
  await visit('bhactual'); for (let i = 0; i < 8; i++) await page.click('#bh-process'); await page.waitForTimeout(800); await L.toasts(page);
  const sR = await L.lsState(page);
  L.record({ id: 'PERF-rapid-buttons', area: 'Performance', title: 'Rapid repeated Generate/Process clicks', expected: 'no errors; stable current results', actual: { errors: log.errors.slice(0, 3), ct: sR.actual.ct.output.length, bh: sR.actual.bh.output.length, ctStatus: sR.actual.ct.processing.status }, status: log.errors.length === 0 && sR.actual.ct.output.length === 8 && sR.actual.bh.output.length === 11 ? 'PASS' : 'FAIL' });
  // timings of heavy operations
  const time = async (fn) => { const t0 = Date.now(); await fn(); return Date.now() - t0; };
  perf.ops = {};
  perf.ops.ctProcessMs = []; for (let i = 0; i < 5; i++) { await visit('ctactual'); perf.ops.ctProcessMs.push(await time(async () => { await page.click('#ct-process'); await page.waitForFunction(() => document.getElementById('ct-kpi-status').textContent !== 'WAITING'); })); }
  perf.ops.bhProcessMs = []; for (let i = 0; i < 5; i++) { await visit('bhactual'); perf.ops.bhProcessMs.push(await time(async () => { await page.click('#bh-process'); await page.waitForTimeout(50); })); }
  perf.ops.matchingExportMs = []; for (let i = 0; i < 3; i++) { await visit('matching'); perf.ops.matchingExportMs.push(await time(async () => { await L.download(page, '#matching-export-xlsx', 'perf_m' + i + '.xlsx'); await L.waitIdle(page, 0); })); }
  perf.ops.auditedExportMs = []; for (let i = 0; i < 3; i++) { await visit('review'); perf.ops.auditedExportMs.push(await time(async () => { await L.download(page, '.rail button[data-step="export"]', 'perf_a' + i + '.xlsx'); await L.waitIdle(page, 0); })); }
  perf.ops.generateUpdateMs = [];
  page.__dialogPolicy = 'accept';
  for (let i = 0; i < 3; i++) { await visit('perforations'); perf.ops.generateUpdateMs.push(await time(async () => { await L.typeInto(page, '#perf-tbody input[data-i="0"][data-f="top"]', i % 2 ? '10350.25' : '10350.75'); await page.locator('.rail button[data-step="generate"]').click(); await page.waitForTimeout(50); await page.locator('.rail button[data-step="update"]').click(); await page.waitForTimeout(50); })); }
  perf.consoleErrors = log.errors; perf.consoleWarnings = log.console.filter((c) => !/404/.test(c)).slice(0, 10);
  L.save('perf.json', perf); console.log(JSON.stringify(perf, null, 1));
  await ctx.close();
  // new job never reuses old charts + restored prediction replaces empty chart
  ({ ctx, page, log } = await L.launchClone('golden', 'p18b'));
  await L.nav(page, 'review'); await page.waitForTimeout(300);
  await page.evaluate(() => { const k = 'projecta-zonation-v48-fullcycle-beta33', s = JSON.parse(localStorage.getItem(k)); s.ui.activeTarget = 'review'; localStorage.setItem(k, JSON.stringify(s)); });
  await page.reload(); await page.waitForTimeout(3000);
  const ctChart = await page.$eval('#rv53-ct-chart', (e) => ({ poly: e.querySelectorAll('polyline').length, empty: !!e.querySelector('.review53-empty') }));
  L.record({ id: 'M3-restored-prediction-replaces-empty', area: 'Caching/M3', title: 'Reload directly onto Prediction Runs', expected: 'restored prediction chart replaces empty placeholder', actual: ctChart, status: ctChart.poly > 0 && !ctChart.empty ? 'PASS' : 'FAIL' });
  await page.click('#exit-link'); await page.fill('#landing-well', 'NEWWELL-1'); await page.click('#landing-start'); await page.waitForTimeout(1500);
  await L.nav(page, 'review'); const nc = await page.$eval('#rv53-ct-chart', (e) => ({ poly: e.querySelectorAll('polyline').length })); await L.nav(page, 'basesummary'); const nb = await page.$eval('#chart1-slot', (e) => e.querySelectorAll('polyline').length);
  L.record({ id: 'M3-new-job-no-old-charts', area: 'Caching/M3', title: 'New job after completed job', expected: 'no old charts', actual: { review: nc, basePolylines: nb }, status: nc.poly === 0 && nb === 0 ? 'PASS' : 'FAIL' });
  await ctx.close(); L.stopServer();
})();
