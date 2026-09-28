// Redo BH match alignment/approval with real click+keyboard input, then re-export both workbooks.
const L = require('./lib');
(async () => {
  const { ctx, page, log } = await L.launch('baseline', { fresh: false });
  await page.waitForTimeout(2000);
  const res = {};
  const type = async (loc, text) => { await loc.click({ clickCount: 3 }); await page.keyboard.type(String(text)); await page.keyboard.press('Tab'); await page.waitForTimeout(150); };
  await L.nav(page, 'matching'); await page.waitForTimeout(500);
  await page.evaluate(() => { ['ctm85-setup-panel', 'bhm85-setup-panel'].forEach((id) => { const d = document.getElementById(id); if (d && !d.open) d.querySelector('summary').click(); }); });
  // clear old approval
  await page.click('#bhm61-clear-approval'); await page.waitForTimeout(300);
  await type(page.locator('#bhm59-shift-number'), 5);
  const fibs = page.locator('#bhm85-stage-tbody tr.diverter input.fiber-input');
  for (let i = 0; i < await fibs.count(); i++) await type(fibs.nth(i), i ? '100' : '125');
  const stims = page.locator('#bhm85-stage-tbody tr.high input.stim-input');
  for (let i = 0; i < await stims.count(); i++) await type(stims.nth(i), 700 + 10 * i);
  await type(page.locator('[data-bhm-descriptor]').first(), 'Base perm');
  await page.click('#bhm61-approve-final'); await page.waitForTimeout(300);            // expect rejection: alignment not saved
  res.beforeSaveToasts = await L.toasts(page);
  await page.click('#bhm59-save-match'); await page.waitForTimeout(300);
  await page.click('#bhm61-approve-final'); await page.waitForTimeout(800);
  const s = await L.lsState(page);
  res.approved = s.matching.bh.approved; res.alignment = s.matching.bh.alignment; res.stage = s.matching.bh.stageInputs.windows.map((w) => [w.type, w.startVolume, w.endVolume, w.fiberLoading, w.stimDp]);
  res.toasts = await L.toasts(page);
  res.plotHeads = await page.$$eval('.bhm59-plot-head', (h) => h.map((x) => x.innerText.replace(/\s+/g, ' ')));
  await L.shot(page, 't04_bh_approved');
  res.matchingExport = await L.download(page, '#matching-export-xlsx', 'E2E_matching.xlsx'); await L.waitIdle(page);
  await L.nav(page, 'review');
  res.auditedExport = await L.download(page, 'button[data-step="export"]', 'E2E_audited.xlsx'); await L.waitIdle(page);
  res.state = await L.lsState(page);
  L.save('t04_bh_rematch.json', res);
  console.log(JSON.stringify({ b: res.beforeSaveToasts, a: res.approved, al: res.alignment, st: res.stage, t: res.toasts, h: res.plotHeads }, null, 1));
  console.log('errors', log.errors);
  await ctx.close(); L.stopServer();
})();
