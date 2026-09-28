// L4 axis validation on all chart groups; L3 CT speed units; L6 multiplier feedback.
const L = require('./lib'); const path = require('path');
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p14');
  const groups = [
    ['CT actual', 'ctactual', 'a82-ct-pmin', 'a82-ct-pmax', '#ct-chart svg', 'a82-ct-auto'],
    ['BH actual', 'bhactual', 'a82-bh-pmin', 'a82-bh-pmax', '#bh-chart-time svg', 'a82-bh-auto'],
    ['CT match', 'matching', 'a82-ctm-pmin', 'a82-ctm-pmax', '#ctm58-chart svg', 'a82-ctm-auto'],
    ['BH match', 'matching', 'a82-bhm-pmin', 'a82-bhm-pmax', '#bhm123-case1-slot svg', 'a82-bhm-auto'],
    ['CT prediction', 'review', 'rv67-pmin', 'rv67-pmax', '#rv53-ct-chart svg', 'rv67-axis-auto'],
    ['BH prediction', 'review', 'rv68-bh-pmin', 'rv68-bh-pmax', '#rv53-bh-chart .active svg', 'rv68-bh-axis-auto'],
  ];
  // pressure tick labels on the left axis
  const ticks = (sel) => page.$eval(sel, (svg) => [...svg.querySelectorAll('text')].filter((t) => (t.getAttribute('data-axis') === 'pressure') || (t.getAttribute('text-anchor') === 'end' && Number(t.getAttribute('x')) < 200 && /^-?[\d.]+$/.test(t.textContent))).map((t) => Number(t.textContent)).sort((a, b) => a - b)).catch((e) => 'ERR ' + e);
  for (const [name, pg, mn, mx, svgSel, auto] of groups) {
    await L.nav(page, pg); await page.waitForTimeout(400);
    if (pg === 'matching') await page.evaluate(() => document.querySelectorAll('details').forEach((d) => d.open = true));
    const t0 = await ticks(svgSel), v0 = [await page.inputValue('#' + mn), await page.inputValue('#' + mx)];
    const res = {};
    await L.typeInto(page, '#' + mn, 1000); await L.typeInto(page, '#' + mx, 5000);
    res.valid = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel) };
    await L.typeInto(page, '#' + mn, 5000); res.equal = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel), toasts: await L.toasts(page) };
    await L.typeInto(page, '#' + mn, 7000); res.greater = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel), toasts: await L.toasts(page) };
    await L.typeInto(page, '#' + mn, -500); res.negative = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel) };
    await L.typeInto(page, '#' + mx, ''); res.blankMax = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel) };
    await L.typeInto(page, '#' + mn, 3000); await L.typeInto(page, '#' + mx, 3000.5); res.small = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel) };
    await L.reload(page); await L.nav(page, pg); await page.waitForTimeout(600); if (pg === 'matching') await page.evaluate(() => document.querySelectorAll('details').forEach((d) => d.open = true));
    res.afterReload = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel) };
    await page.click('#' + auto); await page.waitForTimeout(300); res.auto = { inputs: [await page.inputValue('#' + mn), await page.inputValue('#' + mx)], ticks: await ticks(svgSel) };
    const agree = (r, a, b) => Array.isArray(r.ticks) && Math.abs(r.ticks[0] - a) < 1e-6 && Math.abs(r.ticks[r.ticks.length - 1] - b) < 1e-6;
    const pass = agree(res.valid, 1000, 5000) && /must be less/.test(res.equal.toasts.join()) && Number(res.equal.inputs[0]) === 1000 && /must be less/.test(res.greater.toasts.join()) && agree(res.negative, -500, 5000) && agree(res.small, 3000, 3000.5) && agree(res.afterReload, 3000, 3000.5) && agree(res.auto, Number(v0[0]), Number(v0[1]));
    L.record({ id: 'L4-' + name.replace(' ', '-'), area: 'Charts/L4', title: 'Pressure-axis validation: ' + name, expected: 'valid applied; min=max and min>max rejected with message and prior range kept; negative, small range, reload and auto-reset honoured; inputs = plotted endpoints', actual: Object.assign({ initial: { inputs: v0, ticks: t0 } }, res), status: pass ? 'PASS' : 'FAIL' });
  }
  await ctx.close();
  // ---- L3 CT speed units ----
  ({ ctx, page, log } = await L.launchClone('golden', 'p14b'));
  await L.nav(page, 'ctactual'); await page.selectOption('#ct-speed-unit', 'ft/s'); await page.waitForTimeout(200);
  let s = await L.lsState(page); const staleAfterUnit = s.actual.ct.processing && s.actual.ct.processing.status;
  await page.click('#ct-process'); await page.waitForTimeout(600); s = await L.lsState(page);
  await page.click('#ct-copy'); await page.waitForTimeout(200); const clip = await L.clipboard(page);
  L.record({ id: 'L3-declared-ft-s', area: 'CT/L3', title: 'Declared unit ft/s (source actually ft/min): no conversion applied', expected: 'speed = raw value (e.g. -20 for passes); unit change marks result stale first', actual: { staleAfterUnit, speeds: s.actual.ct.output.map((r) => r.speed), qaUnit: (s.actual.ct.qa.match(/CT speed input = [^\n]+/) || [])[0], clipSpeedCol: clip.split('\n').map((l) => l.split('\t')[9]) }, status: staleAfterUnit === 'stale' && Math.abs(s.actual.ct.output[4].speed + 20) < 1e-9 ? 'PASS' : 'FAIL' });
  const head = await page.$$eval('#page-ctactual table thead th', (t) => t.map((x) => x.textContent)); const disp = await page.$$eval('#ct-output tr', (t) => t.map((r) => r.cells[9].textContent));
  L.record({ id: 'L3-display-header', area: 'CT/L3', title: 'CT output header and display precision', expected: 'header shows ft/s; 4 dp display', actual: { head: head.filter((h) => /Speed/.test(h)), disp }, status: head.some((h) => /Speed \[ft\/s\]/.test(h)) ? 'PASS' : 'FAIL' });
  await ctx.close();
  // ---- L6 multipliers ----
  ({ ctx, page, log } = await L.launchClone('golden', 'p14c'));
  await L.nav(page, 'kmcontrol');
  const setM = async (i, f, v) => L.typeInto(page, `#km-multiplier-tbody input[data-i="${i}"][data-f="${f}"]`, v);
  await setM(1, 'dolomite', '0'); await setM(1, 'limestone', '0'); await setM(3, 'dolomite', '-2'); await setM(0, 'limestone', '');
  await L.typeInto(page, '#km-diverter-tbody input[data-case="1"][data-stage="0"]', '125'); await L.typeInto(page, '#km-diverter-tbody input[data-case="3"][data-stage="0"]', '700');
  await page.click('#km-generate-btn'); await page.waitForTimeout(400); s = await L.lsState(page);
  const line = await page.$eval('#km-case-status-line', (e) => e.innerText); const t = await L.toasts(page);
  await L.nav(page, 'kminput'); await page.click('#km-input-tabs button[data-case="4"]'); await page.waitForTimeout(200); const c4 = await page.$eval('#km-input-empty', (e) => e.hidden ? '' : e.innerText.replace(/\s+/g, ' '));
  await page.click('#km-input-tabs button[data-case="2"]'); await page.waitForTimeout(200); const c2props = await page.$$eval('#km-input-properties-tbody tr', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ')));
  L.record({ id: 'L6-zero-multiplier', area: 'KM/L6', title: 'Case 2 multipliers = 0', expected: 'allowed; case ready (summary) with zero case kH', actual: { status: s.kmCaseStatus[1], c2props }, status: s.kmCaseStatus[1].summaryReady ? 'PASS' : 'FAIL' });
  L.record({ id: 'L6-negative-multiplier', area: 'KM/L6', title: 'Case 4 dolomite = -2', expected: 'actionable rejection message', actual: { status: s.kmCaseStatus[3], line, c4 }, status: !s.kmCaseStatus[3].summaryReady && /zero or greater/.test(s.kmCaseStatus[3].reason) ? 'PASS' : 'FAIL' });
  L.record({ id: 'L6-blank-case1', area: 'KM/L6', title: 'Blank Case 1 limestone then Generate (Cases ticked)', expected: 'existing rule: blank Case 1 cell defaults to 1.00', actual: { case1: [s.kmCases[0].dolomite, s.kmCases[0].limestone], status: s.kmCaseStatus[0] }, status: s.kmCases[0].limestone === '1.00' ? 'PASS' : 'FAIL' });
  L.record({ id: 'KM-unsupported-700', area: 'KM/loadings', title: 'Numeric 700 loading', expected: 'unsupported message', actual: s.kmCaseStatus[3], status: 'INFO' });
  L.save('t14_log.json', log);
  await ctx.close(); L.stopServer();
})();
