// Baseline workflow steps 1-9 via real UI.
const L = require('./lib');
const path = require('path');
const fs = require('fs');
(async () => {
  const { ctx, page, log } = await L.launch('baseline');
  const out = { steps: [] };
  const step = async (name, fn) => { const t0 = Date.now(); let r; try { r = await fn(); } catch (e) { r = { error: String(e) }; } out.steps.push({ name, ms: Date.now() - t0, toasts: await L.toasts(page), result: r }); };

  await step('landing: version markers', async () => ({ title: await page.title(), sub: await page.textContent('#hdr-subtitle').catch(() => null) }));
  await step('L1 empty well name', async () => { await page.fill('#landing-well', '   '); await page.click('#landing-start'); return { appActive: await page.getAttribute('#screen-app', 'data-active') }; });
  await step('select NFE, well, reservoir, start', async () => {
    await page.click('#project-toggle .project-opt[data-p="NFE"]');
    await page.fill('#landing-well', 'NFQ22-4'); await page.fill('#landing-layer', 'k1');
    await page.click('#landing-start'); await page.waitForTimeout(500);
    return { appActive: await page.getAttribute('#screen-app', 'data-active'), well: await page.textContent('#hdr-well'), layer: await page.textContent('#hdr-layer'), pill: await page.textContent('#hdr-proj-pill') };
  });
  await step('import RESSUM (file chooser)', async () => {
    await L.nav(page, 'models');
    const t0 = Date.now();
    await L.chooseFile(page, '#load-workbook-btn', path.join(L.DATA, 'RESSUM_synthetic_24000.xlsx'));
    await page.waitForFunction(() => document.getElementById('model-rows-count').textContent !== '0', null, { timeout: 120000 });
    await L.waitIdle(page);
    return { importMs: Date.now() - t0, rows: await page.textContent('#model-rows-count'), rkb: await page.inputValue('#rkb-input') };
  });
  await step('refresh', async () => { await page.click('button[data-step="refresh"]'); await page.waitForTimeout(300); const s = await L.lsState(page); return { steps: s.steps, rail: await page.textContent('#rail-headline') }; });
  await step('paste perforations with header + formatted depths', async () => {
    await L.nav(page, 'perforations');
    await page.fill('#perf-paste', fs.readFileSync(path.join(L.DATA, 'perforations_with_header.tsv'), 'utf8'));
    await page.click('#perf-paste-load');
    const s = await L.lsState(page);
    return { n: s.perforations.length, first: s.perforations[0], last: s.perforations[s.perforations.length - 1], tableRows: await page.locator('#perf-tbody tr').count() };
  });
  await step('generate', async () => { const t0 = Date.now(); await page.click('button[data-step="generate"]'); await page.waitForTimeout(300); return { ms: Date.now() - t0, initialRows: await page.locator('#initial-zonation-tbody tr').count() }; });
  await step('update', async () => { const t0 = Date.now(); await page.click('button[data-step="update"]'); await page.waitForTimeout(300); return { ms: Date.now() - t0, finalRows: await page.locator('#final-zonation-tbody tr').count(), final: await page.$$eval('#final-zonation-tbody tr', (trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent))) }; });
  await step('base summary recap', async () => { await L.nav(page, 'basesummary'); return await page.evaluate(() => { const g = (id) => (document.getElementById(id) || {}).textContent; return { lime: g('bs-limestone'), dol: g('bs-dolomite'), md: g('bs-interval-md'), mdkh: g('bs-md-kh'), tvdkh: g('bs-tvd-kh'), tvdh: g('bs-tvd-height'), kavg: g('bs-k-avg-md') }; }); });
  await L.shot(page, 't01_basesummary');
  out.log = log; out.state = await L.lsState(page);
  L.save('t01_baseline.json', out);
  console.log(JSON.stringify(out.steps.map((s) => ({ n: s.name, ms: s.ms, t: s.toasts, r: s.name === 'update' ? { ms: s.result.ms, finalRows: s.result.finalRows } : s.result })), null, 1));
  console.log('errors', log.errors, log.console.slice(0, 5), log.dialogs);
  await ctx.close(); L.stopServer();
})();
