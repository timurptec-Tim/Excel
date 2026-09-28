// Baseline workflow steps 10-24 via real UI, continuing the 'baseline' profile from t01.
const L = require('./lib');
const path = require('path');
const fs = require('fs');
const D = (f) => path.join(L.DATA, f);
(async () => {
  const { ctx, page, log } = await L.launch('baseline', { fresh: false });
  await page.waitForTimeout(1500);
  const out = { steps: [], clip: {} };
  const step = async (name, fn) => { const t0 = Date.now(); let r; try { r = await fn(); } catch (e) { r = { error: String(e).slice(0, 400) }; } const s = { name, ms: Date.now() - t0, toasts: await L.toasts(page), result: r }; out.steps.push(s); console.log('STEP', name, s.ms + 'ms', JSON.stringify(s.toasts).slice(0, 300), JSON.stringify(r).slice(0, 400)); };
  const txt = (sel) => page.textContent(sel).catch(() => null);

  await step('restored workspace', async () => ({ active: await page.getAttribute('#screen-app', 'data-active'), rows: await txt('#model-rows-count'), well: await txt('#hdr-well') }));

  await step('fiber plan + target dP (base)', async () => {
    await L.nav(page,'review'); await page.click('[data-review-case="base"] .beta141-case-select'); await page.waitForTimeout(300); if(await page.$eval('#rv78-fiber-panel',e=>e.classList.contains('collapsed'))) await page.click('#rv78-fiber-toggle');
    const fib = page.locator('#rv73-fiber-tbody input[data-fiber-field="fiberLoading"]'); const tgt = page.locator('#rv73-fiber-tbody input[data-fiber-field="targetDp"]');
    const nf = await fib.count(), nt = await tgt.count();
    for (let i = 0; i < nf; i++) { await fib.nth(i).fill(i === 0 ? '125' : '0'); await fib.nth(i).dispatchEvent('change'); await page.waitForTimeout(100); }
    for (let i = 0; i < nt; i++) { await tgt.nth(i).fill(String(600 + 50 * i)); await tgt.nth(i).dispatchEvent('change'); await page.waitForTimeout(100); }
    return { nf, nt, rows: await page.$$eval('#rv73-fiber-tbody tr', (t) => t.map((r) => r.innerText.replace(/\s+/g, ' '))) };
  });
  await L.shot(page, 't02_prediction');
  // 19-21 Matching
  await step('CT matching load, shift, save', async () => {
    await L.nav(page, 'matching');
    await page.evaluate(()=>{['ctm85-setup-panel','bhm85-setup-panel'].forEach(id=>{const d=document.getElementById(id);if(d&&!d.open)d.querySelector('summary').click();});});
    await page.fill('#ctm58-km-paste', fs.readFileSync(D('CT_matching.tsv'), 'utf8')); await page.click('#ctm58-km-load'); await page.waitForTimeout(500);
    await page.fill('#ctm58-shift-number', '-12.5'); await page.locator('#ctm58-shift-number').dispatchEvent('input'); await page.waitForTimeout(200);
    await page.click('#ctm58-lock-match'); await page.waitForTimeout(300);
    const s = await L.lsState(page); return { ct: s.matching.ct, lock: await txt('#ctm58-lock-status') };
  });
  await step('BH matching case1 load, shift, save, fiber, approve', async () => {
    await page.fill('#bhm59-km-paste', fs.readFileSync(D('BH_matching_case1.tsv'), 'utf8')); await page.click('#bhm59-km-load'); await page.waitForTimeout(600);
    await page.fill('#bhm59-shift-number', '5'); await page.locator('#bhm59-shift-number').dispatchEvent('change'); await page.waitForTimeout(300);
    const fib = page.locator('#bhm85-stage-tbody input[data-bhm85-field="fiberLoading"]:not([disabled])'); const nf = await fib.count();
    for (let i = 0; i < nf; i++) { await fib.nth(i).fill(i ? '100' : '125'); await fib.nth(i).dispatchEvent('change'); await page.waitForTimeout(100); }
    const st = page.locator('#bhm85-stage-tbody input[data-bhm85-field="stimDp"]:not([disabled])'); const ns = await st.count();
    for (let i = 0; i < ns; i++) { await st.nth(i).fill(String(700 + 10 * i)); await st.nth(i).dispatchEvent('change'); await page.waitForTimeout(100); }
    await page.fill('[data-bhm-descriptor]', 'Base perm'); await page.locator('[data-bhm-descriptor]').first().dispatchEvent('change'); await page.waitForTimeout(200);
    await page.click('#bhm61-approve-final'); await page.waitForTimeout(300);
    await page.click('#bhm59-save-match'); await page.waitForTimeout(300);
    await page.click('#bhm61-approve-final'); await page.waitForTimeout(600);
    const s = await L.lsState(page); return { nf, ns, approved: s.matching.bh.approved, align: s.matching.bh.alignment, badge: await txt('#bhm61-approved-badge') };
  });
  await step('final interpretation', async () => {
    await page.fill('#matching-final-interpretation', 'Synthetic UAT interpretation line 1.\nLine 2 — diverter response acceptable.');
    await page.waitForTimeout(300); const s = await L.lsState(page); return { fi: s.matching.finalInterpretation };
  });
  await L.shot(page, 't02_matching');
  // 23 exports
  await step('export matching xlsx', async () => { const d = await L.download(page, '#matching-export-xlsx', 'E2E_matching.xlsx'); await L.waitIdle(page); return d; });
  await step('export prediction audited xlsx (rail on review page)', async () => {
    await L.nav(page, 'review');
    const d = await L.download(page, 'button[data-step="export"]', 'E2E_audited.xlsx'); await L.waitIdle(page); return d;
  });
  await step('export audit log csv', async () => { await L.nav(page, 'audit'); return await L.download(page, '#export-log-btn', 'E2E_audit_log.csv'); });
  out.stateBeforeClose = await L.lsState(page);
  out.idbHeavyMeta = (await L.idbDump(page, 'heavyState')).map((r) => ({ id: r.id, logLen: (r.log || []).length, audit: (r.auditLog || []).length }));
  // 24 close / reopen
  await ctx.close();
  const r2 = await L.launch('baseline', { fresh: false }); await r2.page.waitForTimeout(2500);
  const p2 = r2.page; out.reopen = {};
  const s2 = await L.lsState(p2);
  out.reopen.state = { steps: s2.steps, casesGenerated: s2.casesGenerated, perfs: s2.perforations.length, pressure: s2.pressure, ct: s2.matching.ct, approved: s2.matching.bh.approved.caseId, fi: s2.matching.finalInterpretation, ctOut: s2.actual.ct.output.length, bhOut: s2.actual.bh.output.length, ctProc: s2.actual.ct.processing, bhProc: s2.actual.bh.processing && s2.actual.bh.processing.status };
  await L.nav(p2, 'matching'); await p2.waitForTimeout(800);
  out.reopen.matching = { ctLock: await p2.textContent('#ctm58-lock-status'), badge: await p2.textContent('#bhm61-approved-badge'), exportBtn: await p2.getAttribute('#matching-export-xlsx', 'disabled'), approvedSnap: await p2.$eval('#bh-approved-chart170', (e) => e.hidden + ' ' + e.innerText.slice(0, 200)).catch((e) => String(e)) };
  await L.nav(p2, 'review'); await p2.waitForTimeout(500);
  out.reopen.review = { ct: await p2.textContent('#rv53-ct-status'), cases: await p2.$$eval('#rv53-bh-cases .review53-bh-case', (c) => c.map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 120))) };
  out.reopenLog = r2.log;
  console.log('REOPEN', JSON.stringify(out.reopen).slice(0, 1500));
  out.log = log; L.save('t03_workflow_cont.json', out);
  console.log('errors', log.errors, log.console.filter((c) => !/404/.test(c)).slice(0, 5), 'dialogs', log.dialogs, 'reopenErrors', r2.log.errors);
  await r2.ctx.close(); L.stopServer();
})();
