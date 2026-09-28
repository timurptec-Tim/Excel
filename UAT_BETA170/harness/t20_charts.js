// Chart QA: inventory series and convert SVG polyline coordinates back to data values.
const L = require('./lib'); const path = require('path'); const fs = require('fs');
(async () => {
  const { ctx, page, log } = await L.launchClone('golden', 'p20');
  const inv = {};
  // generic extractor: list polylines with stroke colour, point count, first/last svg coords, and viewBox axis frame
  const grab = (sel) => page.$eval(sel, (host) => { const svg = host.tagName === 'svg' ? host : host.querySelector('svg'); if (!svg) return null;
    return { viewBox: svg.getAttribute('viewBox'), polylines: [...svg.querySelectorAll('polyline')].map((p) => { const pts = p.getAttribute('points').trim().split(/\s+/).map((s) => s.split(',').map(Number)); return { stroke: p.getAttribute('stroke'), dash: p.getAttribute('stroke-dasharray'), n: pts.length, first: pts[0], last: pts[pts.length - 1], clip: p.getAttribute('clip-path') || (p.closest('[clip-path]') || { getAttribute: () => null }).getAttribute('clip-path') }; }),
      legend: [...(host.querySelectorAll ? host.querySelectorAll('.a82-legend-item span,.rv74-legend-item span') : [])].map((x) => x.textContent), texts: [...svg.querySelectorAll('text')].map((t) => t.textContent).filter((t) => /[A-Za-z]/.test(t)).slice(0, 12) }; }).catch((e) => 'ERR ' + e);
  // CT prediction: rows known; axes auto -> xMax=rv67NiceCeil(180*1.15,100)=300 (maxX 180 -> step 100), L=92, pw=1280-92-84=1104
  await L.nav(page, 'review'); inv.ctPrediction = await grab('#rv53-ct-chart');
  const ref = fs.readFileSync(path.join(L.DATA, 'CT_prediction.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t').map(Number));
  const ax = { xMin: Number(await page.inputValue('#rv67-xmin')), xMax: Number(await page.inputValue('#rv67-xmax')), pMin: Number(await page.inputValue('#rv67-pmin')), pMax: Number(await page.inputValue('#rv67-pmax')), rMin: Number(await page.inputValue('#rv67-rmin')), rMax: Number(await page.inputValue('#rv67-rmax')) };
  const L0 = 92, pw = 1104, T = 64, ph = 455 - 64 - 68;
  const inv2 = (x, y, axis) => [ax.xMin + (x - L0) / pw * (ax.xMax - ax.xMin), axis === 'r' ? ax.rMin + (T + ph - y) / ph * (ax.rMax - ax.rMin) : ax.pMin + (T + ph - y) / ph * (ax.pMax - ax.pMin)];
  const map = { '#5b9c63': ['bhp', 3, 'p'], '#c0443b': ['whp', 4, 'p'], '#c89d25': ['frac', 1, 'p'], '#294f83': ['rate', 2, 'r'] };
  const chk = inv.ctPrediction.polylines.map((p) => { const m = map[p.stroke]; if (!m) return { stroke: p.stroke, unknown: true }; const f = inv2(p.first[0], p.first[1], m[2]), l = inv2(p.last[0], p.last[1], m[2]); const ef = [ref[0][0], ref[0][m[1]]], el = [ref[ref.length - 1][0], ref[ref.length - 1][m[1]]];
    return { series: m[0], n: p.n, rows: ref.length, firstDecoded: f.map((v) => +v.toFixed(2)), firstExpected: ef, lastDecoded: l.map((v) => +v.toFixed(2)), lastExpected: el, ok: p.n === ref.length && Math.abs(f[0] - ef[0]) < 0.2 && Math.abs(f[1] - ef[1]) / Math.max(1, Math.abs(ef[1])) < 0.01 && Math.abs(l[0] - el[0]) < 0.2 && Math.abs(l[1] - el[1]) / Math.max(1, Math.abs(el[1])) < 0.01 }; });
  L.record({ id: 'CHART-ct-prediction-decode', area: 'Charts', title: 'CT Prediction chart series decoded back to data', expected: 'each series has one point per row; first/last points within 1 % of source', actual: { axes: ax, series: chk, legend: inv.ctPrediction.legend }, status: chk.length === 4 && chk.every((c) => c.ok) ? 'PASS' : 'FAIL' });
  // BH prediction base: dP = BHP - 3450 and Target dP boxes
  inv.bhPrediction = await grab('#rv53-bh-chart [data-review-chart-case="base"]');
  inv.ctActual = (await L.nav(page, 'ctactual'), await grab('#ct-chart'));
  inv.bhActualTime = (await L.nav(page, 'bhactual'), await grab('#bh-chart-time')); inv.bhActualVolume = await grab('#bh-chart-volume');
  await L.nav(page, 'matching'); inv.ctMatch = await grab('#ctm58-chart'); inv.bhMatch = await grab('#bhm123-case1-slot .bhm59-plot-chart'); inv.bhApproved = await grab('#bh-approved-chart170');
  inv.ctMatchLegend = await page.$$eval('#a82-ctm-legend .a82-legend-item span', (t) => t.map((x) => x.textContent));
  await L.nav(page, 'basesummary'); inv.chart1 = await grab('#chart1-slot'); inv.chart2 = await grab('#chart2-slot'); inv.chart3 = await grab('#chart3-slot');
  // CT actual: time axis crosses midnight -> x must increase monotonically in each polyline
  const ctTicks = await page.evaluate(() => null);
  await L.nav(page, 'ctactual'); const ctx0 = await page.$eval('#ct-chart svg', (svg) => ({ xLabels: [...svg.querySelectorAll('text')].map((t) => t.textContent).filter((t) => /^\d\d:\d\d:\d\d$/.test(t)), mono: [...svg.querySelectorAll('polyline')].every((p) => { const xs = p.getAttribute('points').trim().split(/\s+/).map((s) => Number(s.split(',')[0])); return xs.every((x, i) => i === 0 || x >= xs[i - 1] - 1e-6); }) }));
  L.record({ id: 'CHART-ct-actual-midnight', area: 'Charts', title: 'CT Actual chart across midnight (23:30 → 01:33)', expected: 'monotonic time axis; labels wrap 23:xx → 00:xx', actual: ctx0, status: ctx0.mono && ctx0.xLabels.some((x) => /^23/.test(x)) && ctx0.xLabels.some((x) => /^0[01]/.test(x)) ? 'PASS' : 'FAIL' });
  // CT match shift applied: actual series first x should equal first processed volume + shift(-12.5)
  L.save('chart_inventory.json', inv);
  const summary = Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, v && v.polylines ? { series: v.polylines.length, strokes: [...new Set(v.polylines.map((p) => p.stroke))], points: v.polylines.map((p) => p.n), unclipped: v.polylines.filter((p) => !p.clip).length, legend: v.legend } : v]));
  console.log(JSON.stringify(summary, null, 1));
  L.record({ id: 'CHART-inventory', area: 'Charts', title: 'Chart / series inventory', expected: 'see chart_inventory.json', actual: summary, status: 'INFO' });
  await ctx.close(); L.stopServer();
})();
