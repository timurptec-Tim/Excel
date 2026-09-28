// M1 / L5: pressure validation, readiness and reversal. Real keyboard input on isolated golden clones.
const L = require('./lib');
const FIELDS = [['probe-tvd', 'probeTVD', '8500', true], ['formation-pressure', 'formationPressure', '3450', false], ['fg-tvdss', 'fgTVDSS', '0.817', false], ['fixed-conversion', 'fixedConversion', '0.107', true]];
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p10');
  const st = () => L.lsState(page);
  const kmInputState = async () => { await L.nav(page, 'kminput'); await page.click('#km-input-tabs button[data-case="1"]'); await page.waitForTimeout(150); const empty = await page.$eval('#km-input-empty', (e) => e.hidden ? '' : e.innerText.replace(/\s+/g, ' ')); await page.evaluate(() => navigator.clipboard.writeText('__EMPTY__')); await page.click('#km-input-copy-btn').catch(() => {}); await page.waitForTimeout(200); return { empty, clip: (await L.clipboard(page)).slice(0, 20), toasts: await L.toasts(page) }; };
  const pressureMsgs = async () => page.$$eval('small[id$="-error"]', (e) => e.map((x) => x.id.replace('-error', '') + ':' + x.textContent).filter((x) => !/:$/.test(x)));
  const reviewBanner = async () => { await L.nav(page, 'review'); return page.$eval('#audit86-prediction-warning', (b) => b.hidden ? '' : b.innerText.replace(/\s+/g, ' ')).catch(() => 'n/a'); };

  // --- M1 field validation ---
  for (const [id, key, orig, zeroOk] of FIELDS) {
    for (const [label, val] of [['blank', ''], ['zero', '0'], ['negative', '-5'], ['non-numeric', 'abc'], ['large finite', '1e9']]) {
      await L.nav(page, 'pressure');
      await L.typeInto(page, '#' + id, val);
      const s = await st(), msgs = await pressureMsgs(), km = await kmInputState();
      const committed = s.pressure[key];
      const shouldBeInvalid = label === 'blank' || label === 'negative' || label === 'non-numeric' || (label === 'zero' && !zeroOk);
      const invalidShown = msgs.some((m) => m.startsWith(id + ':'));
      const kmBlocked = /Complete Pressure Data/.test(km.empty) && km.clip === '__EMPTY__';
      const pass = shouldBeInvalid ? (invalidShown && kmBlocked) : (!invalidShown);
      L.record({ id: `M1-${id}-${label}`, area: 'Pressure/M1', title: `${key} = "${val}"`, expected: shouldBeInvalid ? 'field message + KM Input copy blocked' : 'accepted, no field message', actual: { committed, msgs, kmEmpty: km.empty.slice(0, 90), clipBlocked: km.clip === '__EMPTY__', toasts: km.toasts }, status: pass ? 'PASS' : 'FAIL' });
      // restore original
      await L.nav(page, 'pressure'); await L.typeInto(page, '#' + id, orig);
    }
  }
  // restore check after all edits (undo should restore cases/template)
  {
    const s = await st(), km = await kmInputState();
    L.record({ id: 'M1-restore-after-invalid', area: 'Pressure/M1', title: 'All pressure fields returned to original values after invalid entries', expected: 'casesGenerated + template restored; KM tables copyable', actual: { casesGenerated: s.casesGenerated, template: !!s.predictionTemplate, export: s.steps.export, kmEmpty: km.empty, clipLen: km.clip.length }, status: s.casesGenerated && s.predictionTemplate && km.clip !== '__EMPTY__' ? 'PASS' : 'FAIL' });
  }
  // readiness of export & generate with invalid pressure
  {
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '');
    await L.nav(page, 'kmcontrol'); await page.click('#km-generate-btn'); await page.waitForTimeout(300);
    const s = await st(); const t = await L.toasts(page);
    await L.nav(page, 'review');
    let dl = null; const dlp = page.waitForEvent('download', { timeout: 5000 }).then((d) => d).catch(() => null);
    await page.click('button[data-step="export"]'); dl = await dlp; await L.waitIdle(page); const t2 = await L.toasts(page);
    L.record({ id: 'M1-generate-invalid', area: 'Pressure/M1', title: 'KM Generate with blank formation pressure', expected: 'no READY case sheets; template not assembled; reason shown', actual: { status: s.kmCaseStatus, template: s.predictionTemplate, toasts: t }, status: (s.kmCaseStatus.every((x) => !x || !x.caseSheetReady) && !s.predictionTemplate) ? 'PASS' : 'FAIL' });
    L.record({ id: 'M1-export-invalid', area: 'Pressure/M1', title: 'Prediction audited export with blank formation pressure', expected: 'blocked with pressure message', actual: { downloaded: !!dl, toasts: t2 }, status: !dl && t2.some((x) => /Formation pressure/.test(x)) ? 'PASS' : 'FAIL' });
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3450');
    await L.nav(page, 'kmcontrol'); await page.click('#km-generate-btn'); await page.waitForTimeout(300); await L.toasts(page);
  }
  await ctx.close();

  // --- L5 reversal on a fresh clone ---
  ({ ctx, page, log } = await L.launchClone('golden', 'p10b'));
  {
    const s0 = await st();
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3450.0');
    const s1 = await st(); const b1 = await reviewBanner();
    L.record({ id: 'L5-equivalent-format', area: 'Pressure/L5', title: 'Re-enter 3450 as 3450.0', expected: 'no invalidation', actual: { casesGenerated: s1.casesGenerated, banner: b1 }, status: s1.casesGenerated && !b1 ? 'PASS' : 'FAIL' });
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3600');
    const s2 = await st(), b2 = await reviewBanner(), km2 = await kmInputState();
    L.record({ id: 'L5-3600-stale', area: 'Pressure/L5', title: '3450 → 3600 marks predictions stale and invalidates cases', expected: 'banner (pressure) + cases/template cleared', actual: { banner: b2, casesGenerated: s2.casesGenerated, template: !!s2.predictionTemplate, kmEmpty: km2.empty.slice(0, 60), ctStale: s2.reviewPrediction.ct.designStale }, status: /pressure inputs changed/.test(b2) && !s2.casesGenerated && !s2.predictionTemplate ? 'PASS' : 'FAIL' });
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3450');
    const s3 = await st(), b3 = await reviewBanner(), km3 = await kmInputState();
    const same = JSON.stringify([s0.kmCaseStatus, s0.predictionTemplate && s0.predictionTemplate.cases.length, s0.steps]) === JSON.stringify([s3.kmCaseStatus, s3.predictionTemplate && s3.predictionTemplate.cases.length, s3.steps]);
    L.record({ id: 'L5-3450-restore', area: 'Pressure/L5', title: '3600 → 3450 restores pre-change readiness without re-paste', expected: 'banner cleared; cases/template/export status restored', actual: { banner: b3, casesGenerated: s3.casesGenerated, template: !!s3.predictionTemplate, steps: s3.steps, sameAsBefore: same, kmCopied: km3.clip !== '__EMPTY__' }, status: !b3 && s3.casesGenerated && s3.predictionTemplate && same ? 'PASS' : 'FAIL' });
    // reversal with intervening multiplier change
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3600');
    await L.nav(page, 'kmcontrol'); await L.typeInto(page, '#km-multiplier-tbody input[data-i="2"][data-f="dolomite"]', '2.5');
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3450');
    const s4 = await st(), b4 = await reviewBanner();
    L.record({ id: 'L5-reversal-after-multiplier', area: 'Pressure/L5', title: 'Pressure reversal after an intervening multiplier change', expected: 'unrelated (KM) invalidation remains; cases not silently restored', actual: { banner: b4, casesGenerated: s4.casesGenerated, case3Stale: s4.reviewPrediction.bh.cases.map((c) => [c.id, c.designStale, c.designStaleReason]) }, status: /KM case inputs changed|pressure/.test(b4) && !s4.casesGenerated ? 'PASS' : 'FAIL' });
    await L.nav(page, 'kmcontrol'); await L.typeInto(page, '#km-multiplier-tbody input[data-i="2"][data-f="dolomite"]', '1.99995507446');
  }
  await ctx.close();

  // --- L5 pre-existing stale state preserved + reload between change and reversal ---
  ({ ctx, page, log } = await L.launchClone('golden', 'p10c'));
  {
    // make Case 3 stale via a diverter-loading change, then regenerate cases (clears nothing on prediction staleness)
    await L.nav(page, 'kmcontrol');
    await L.typeInto(page, '#km-diverter-tbody input[data-case="2"][data-stage="0"]', '75');
    await page.click('#km-generate-btn'); await page.waitForTimeout(300); await L.toasts(page);
    const s0 = await st(); const before = s0.reviewPrediction.bh.cases.map((c) => [c.id, c.designStale]);
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3600');
    await L.reload(page); await page.waitForTimeout(1500);
    await L.nav(page, 'pressure'); await L.typeInto(page, '#formation-pressure', '3450');
    const s1 = await st(), b1 = await reviewBanner(); const after = s1.reviewPrediction.bh.cases.map((c) => [c.id, c.designStale, c.designStaleReason]);
    L.record({ id: 'L5-preexisting-stale', area: 'Pressure/L5', title: 'Pre-existing Case 3 staleness survives a pressure change/reversal', expected: 'Case 3 still stale (KM reason); Base/CT not stale', actual: { before, after, banner: b1, ctStale: s1.reviewPrediction.ct.designStale }, status: after.find((x) => x[0] === 'case3')[1] && !after.find((x) => x[0] === 'base')[1] && !s1.reviewPrediction.ct.designStale ? 'PASS' : 'FAIL' });
    L.record({ id: 'L5-reload-between', area: 'Pressure/L5', title: 'Reload between 3600 and reversal to 3450', expected: 'cases/template restored after reload+reversal', actual: { casesGenerated: s1.casesGenerated, template: !!s1.predictionTemplate, undoKept: 'pressureUndo170' in s1 }, status: s1.casesGenerated && s1.predictionTemplate ? 'PASS' : 'FAIL' });
  }
  L.save('t10_log.json', log);
  await ctx.close(); L.stopServer();
})();
