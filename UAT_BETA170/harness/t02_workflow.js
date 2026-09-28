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

  // 10 Pressure
  await step('pressure inputs', async () => {
    await L.nav(page, 'pressure');
    await L.setField(page, '#probe-tvd', 8500); await L.setField(page, '#formation-pressure', 3450);
    await L.setField(page, '#fg-tvdss', 0.817); await L.setField(page, '#fixed-conversion', 0.107);
    const s = await L.lsState(page); return { pressure: s.pressure, errors: await page.$$eval('small[id$="-error"]', (e) => e.map((x) => x.id + ':' + x.textContent)) };
  });

  // 11-12 Analogue
  await step('connect analogue workbook', async () => {
    await L.nav(page, 'analogue');
    await page.selectOption('#analogue-lith-units', { index: 0 });
    await L.chooseFile(page, '#connect-analogue-btn', D('analogue_main.xlsx'));
    await page.waitForTimeout(1500);
    const s = await L.lsState(page);
    return { unitsOptions: await page.$$eval('#analogue-lith-units option', (o) => o.map((x) => x.value + '=' + x.textContent)), n: s.analogueDb.length, src: s.analogueSource, db: s.analogueDb.map((r) => [r.well, r.formation, r.limestonePct, r.dolomitePct, r.mdKHafter, r.mdInterval, r.lithologyUnitEvidence]), note: await txt('#analogue-source-note') };
  });
  await step('select cases', async () => {
    await page.click('#select-cases-btn'); await page.waitForTimeout(400);
    const s = await L.lsState(page);
    return { suggested: s.suggestedCases, cards: await page.$$eval('.analogue-compare-card', (c) => c.map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 260))) };
  });
  await L.shot(page, 't02_analogue_cards');
  await step('transfer cases', async () => {
    await page.click('#transfer-cases-btn'); await page.waitForTimeout(300);
    const s = await L.lsState(page); return { kmCases: s.kmCases.map((c) => [c.dolomite, c.limestone, c.selectedForPrediction]) };
  });
  await step('repeat transfer no change', async () => { await page.click('#transfer-cases-btn'); await page.waitForTimeout(200); return {}; });

  // 13 KM control
  await step('km control: select case 3 for prediction, diverter loadings', async () => {
    await L.nav(page, 'kmcontrol');
    await page.check('#km-multiplier-tbody input[data-prediction-case][data-i="2"]');
    const setDiv = async (ci, si, v) => { const sel = `#km-diverter-tbody input[data-case="${ci}"][data-stage="${si}"]`; await page.fill(sel, v); await page.locator(sel).dispatchEvent('change'); };
    await setDiv(0, 0, '125'); await setDiv(0, 1, '400'); await setDiv(0, 2, 'BG50-100');
    await setDiv(2, 0, '100'); await setDiv(2, 1, '500'); await setDiv(2, 2, '600');
    await page.check('#select-cases-cb'); await page.check('#select-prediction-cb');
    return { recap: await page.evaluate(() => ['kmc-case', 'kmc-md-kh', 'kmc-k-avg-md', 'kmc-limestone', 'kmc-dolomite', 'kmc-interval-md', 'kmc-tvd-kh', 'kmc-tvd-height'].map((i) => i + '=' + document.getElementById(i).textContent)) };
  });
  // 14 generate
  await step('km generate', async () => {
    await page.click('#km-generate-btn'); await page.waitForTimeout(400);
    const s = await L.lsState(page);
    return { status: s.kmCaseStatus, props: await page.$$eval('#km-properties-tbody tr', (t) => t.map((r) => r.innerText.replace(/\t/g, ' | '))), line: await txt('#km-case-status-line'), tmplCases: s.predictionTemplate && s.predictionTemplate.cases.length };
  });
  // 15 KM input copy
  for (const c of [1, 3]) {
    await step('km input case ' + c + ' copy tables', async () => {
      await L.nav(page, 'kminput');
      await page.click(`#km-input-tabs button[data-case="${c}"]`);
      await page.click('#km-input-copy-btn'); await page.waitForTimeout(200); out.clip['zone_case' + c] = await L.clipboard(page);
      await page.click('#km-input-opr-copy'); await page.waitForTimeout(200); out.clip['opr_case' + c] = await L.clipboard(page);
      await page.click('#km-input-spurt-copy'); await page.waitForTimeout(200); out.clip['spurt_case' + c] = await L.clipboard(page);
      out['kminput_display_case' + c] = await page.$$eval('#km-input-zone-tbody tr', (t) => t.slice(0, 5).map((r) => r.innerText));
      out['kminput_spurthead_case' + c] = await page.$$eval('#km-input-spurt-head th', (t) => t.map((x) => x.textContent));
      out['kminput_props_case' + c] = await page.$$eval('#km-input-properties-tbody tr', (t) => t.map((r) => r.innerText));
      return { zoneLines: out.clip['zone_case' + c].split('\n').length, spurtLines: out.clip['spurt_case' + c].split('\n').length, head: out['kminput_spurthead_case' + c] };
    });
  }
  // 16 prediction tables
  await step('prediction CT paste', async () => {
    await L.nav(page, 'review');
    await page.click('#rv75-ct-loader-toggle');
    await page.fill('#rv55-ct-paste', fs.readFileSync(D('CT_prediction.tsv'), 'utf8'));
    await page.click('#rv55-ct-paste-load'); await page.waitForTimeout(500);
    return { status: await txt('#rv53-ct-status') };
  });
  for (const [cid, f] of [['base', 'BH_prediction_base.tsv'], ['case3', 'BH_prediction_case3.tsv']]) {
    await step('prediction BH paste ' + cid, async () => {
      await page.click(`[data-paste-review-case="${cid}"]`); await page.waitForTimeout(300);
      await page.fill('#rv55-bh-paste', fs.readFileSync(D(f), 'utf8'));
      await page.click('#rv55-bh-paste-load'); await page.waitForTimeout(600);
      return { cases: await page.$$eval('#rv53-bh-cases .review53-bh-case', (c) => c.map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 200))) };
    });
  }
  await step('fiber plan + target dP (base)', async () => {
    await page.click('[data-review-case="base"] .beta141-case-select'); await page.waitForTimeout(300);
    const fib = page.locator('#rv73-fiber-tbody input[data-fiber-field="fiberLoading"]'); const tgt = page.locator('#rv73-fiber-tbody input[data-fiber-field="targetDp"]');
    const nf = await fib.count(), nt = await tgt.count();
    for (let i = 0; i < nf; i++) { await fib.nth(i).fill(i === 0 ? '125' : '0'); await fib.nth(i).dispatchEvent('change'); await page.waitForTimeout(100); }
    for (let i = 0; i < nt; i++) { await tgt.nth(i).fill(String(600 + 50 * i)); await tgt.nth(i).dispatchEvent('change'); await page.waitForTimeout(100); }
    return { nf, nt, rows: await page.$$eval('#rv73-fiber-tbody tr', (t) => t.map((r) => r.innerText.replace(/\s+/g, ' '))) };
  });
  await L.shot(page, 't02_prediction');
  // 17 CT actual
  await step('CT actual load+process', async () => {
    await L.nav(page, 'ctactual');
    await page.locator('#ct-file-1').setInputFiles(D('CT_actual_1s.txt')); await page.waitForTimeout(1500);
    await L.setField(page, '#ct-topperf', 11000); await L.setField(page, '#ct-bottomperf', 11500);
    await page.selectOption('#ct-speed-unit', 'ft/min');
    const t0 = Date.now(); await page.click('#ct-process'); await page.waitForTimeout(500);
    const ms = Date.now() - t0;
    await page.click('#ct-copy'); await page.waitForTimeout(200); out.clip.ct = await L.clipboard(page);
    const s = await L.lsState(page);
    return { ms, qa: s.actual.ct.qa, status: await txt('#ct-kpi-status'), rows: s.actual.ct.output.length, head: await page.$$eval('#page-ctactual thead th', (t) => t.map((x) => x.textContent).slice(0, 12)) };
  });
  await L.shot(page, 't02_ctactual');
  // 18 BH actual
  await step('BH actual load+process', async () => {
    await L.nav(page, 'bhactual');
    await page.locator('#bh-file-1').setInputFiles(D('BH_actual_1s.txt')); await page.waitForTimeout(1200);
    await page.selectOption('#bh-diverter-type', 'MaxCO3');
    for (const [k, v] of [['j4', 5], ['j5', 100], ['j6', 150], ['j7', 450], ['j8', 3], ['j9', 2]]) { await page.fill('#bh-' + k, String(v)); await page.locator('#bh-' + k).dispatchEvent('input'); }
    await page.click('#bh-add-plan'); await page.click('#bh-add-plan');
    const setPlan = async (i, f, v) => { const sel = `#bh-plan input[data-bi="${i}"][data-bf="${f}"]`; await page.fill(sel, String(v)); await page.locator(sel).dispatchEvent('input'); };
    await setPlan(0, 'loading', 125); await setPlan(0, 'volume', 100);
    await setPlan(1, 'loading', 0); await setPlan(1, 'volume', 30);
    await page.click('.bh-plan-split[data-bi="1"]'); await page.waitForTimeout(100);
    await setPlan(2, 'loading', 100); await setPlan(2, 'volume', 70);
    await page.click('#bh-process'); await page.waitForTimeout(600);
    await page.click('#bh-copy'); await page.waitForTimeout(200); out.clip.bh = await L.clipboard(page);
    const s = await L.lsState(page);
    return { plan: s.actual.bh.plan, errs: await txt('#bh-process-errors'), qa: s.actual.bh.qa, status: await txt('#bh-kpi-status'), rows: s.actual.bh.output.length };
  });
  await L.shot(page, 't02_bhactual');
  // 19-21 Matching
  await step('CT matching load, shift, save', async () => {
    await L.nav(page, 'matching');
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
  out.log = log; L.save('t02_workflow.json', out);
  console.log('errors', log.errors, log.console.filter((c) => !/404/.test(c)).slice(0, 5), 'dialogs', log.dialogs, 'reopenErrors', r2.log.errors);
  await r2.ctx.close(); L.stopServer();
})();
