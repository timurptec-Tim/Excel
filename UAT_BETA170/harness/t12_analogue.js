// Analogue import units, malformed files, ranking edge cases, concurrency and job-specific notices.
const L = require('./lib');
const fs = require('fs'); const path = require('path');
const D = (f) => path.join(L.DATA, f);
(async () => {
  let { ctx, page, log } = await L.launchClone('golden', 'p12');
  const imp = async (file, mode) => {
    await L.nav(page, 'analogue'); await page.selectOption('#analogue-lith-units', mode);
    await L.chooseFile(page, '#connect-analogue-btn', D(file)); await page.waitForTimeout(700);
    const s = await L.lsState(page); return { db: s.analogueDb.map((r) => [r.well, r.limestonePct, r.dolomitePct, r.lithologyUnitEvidence]), note: await page.textContent('#analogue-source-note'), toasts: await L.toasts(page) };
  };
  // expected lime/dol for each variant under auto / fraction / percent (from existing documented rules in the app UI:
  // "Auto · Excel format first; infer units per column", explicit '%' text and Excel % formats authoritative)
  const E = {
    A_unformatted_fraction: { auto: [35, 65], fraction: [35, 65], percent: [0.35, 0.65] },
    B_unformatted_percent: { auto: [35, 65], fraction: [3500, 6500], percent: [35, 65] },
    C_mixed_column: { auto: [0.35, 0.65], fraction: [35, 65], percent: [0.35, 0.65] },
    D_column_style_percent: { auto: [35, 65], fraction: [35, 65], percent: [35, 65] },
    E_row_style_percent: { auto: [35, 65], fraction: [35, 65], percent: [35, 65] },
    F_cell_overrides_column: { auto: [35, 65], fraction: [35, 65], percent: [0.35, 0.65] },
    G_text_percent: { auto: [35, 65], fraction: [35, 65], percent: [35, 65] },
    H_literal_pct_numfmt: { auto: [35, 65], fraction: [3500, 6500], percent: [35, 65] },
    I_header_fraction: { auto: [35, 65], fraction: [35, 65], percent: [0.35, 0.65] },
    J_excel_pct_65: { auto: [35, 65], fraction: [35, 65], percent: [35, 65] },
    K_total_not_100: { auto: [30, 60], fraction: [3000, 6000], percent: [30, 60] },
  };
  for (const [k, modes] of Object.entries(E)) for (const [mode, exp] of Object.entries(modes)) {
    const r = await imp('analogue_' + k + '.xlsx', mode); const got = r.db[0] ? [r.db[0][1], r.db[0][2]].map((v) => Math.round(v * 1e9) / 1e9) : null;
    const ok = got && Math.abs(got[0] - exp[0]) < 1e-9 && Math.abs(got[1] - exp[1]) < 1e-9;
    const clar = (k === 'C_mixed_column' && mode === 'auto') || (k === 'F_cell_overrides_column') || (k === 'D_column_style_percent' && mode !== 'percent') || k === 'E_row_style_percent';
    L.record({ id: `AN-units-${k}-${mode}`, area: 'Analogue/units', title: `${k} in ${mode} mode`, expected: exp, actual: { got, evidence: r.db[0] && r.db[0][3], rows: r.db.map((x) => [x[0], x[1], x[2]]), note: r.note.slice(0, 140) }, status: ok ? 'PASS' : (clar ? 'REQUIREMENT CLARIFICATION' : 'FAIL') });
  }
  // malformed / wrong files after a valid DB is connected
  await imp('analogue_main.xlsx', 'auto');
  for (const f of ['analogue_wrong_headers.xlsx', 'analogue_empty.xlsx', 'analogue_not_zip.xlsx', 'analogue_header_only.xlsx']) {
    const r = await imp(f, 'auto');
    L.record({ id: 'AN-bad-' + f, area: 'Analogue/import', title: 'Import ' + f + ' over a connected DB', expected: 'rejected with message; previous 10-row DB retained', actual: { n: r.db.length, note: r.note, toasts: r.toasts }, status: r.db.length === 10 && /rejected|Couldn/.test(r.note + r.toasts.join(' ')) ? 'PASS' : 'FAIL' });
  }
  // cancel file selection
  { await L.nav(page, 'analogue'); const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#connect-analogue-btn')]); await fc.setFiles([]); await page.waitForTimeout(300); const s = await L.lsState(page);
    L.record({ id: 'AN-cancel', area: 'Analogue/import', title: 'Cancel file chooser', expected: 'no change', actual: { n: s.analogueDb.length, toasts: await L.toasts(page) }, status: s.analogueDb.length === 10 ? 'PASS' : 'FAIL' }); }
  // ---- concurrency: old (big) then new (small) upload; newest wins ----
  {
    await L.nav(page, 'analogue'); await page.selectOption('#analogue-lith-units', 'auto');
    await L.chooseFile(page, '#connect-analogue-btn', D('analogue_big_40000.xlsx'));
    await L.chooseFile(page, '#connect-analogue-btn', D('analogue_J_excel_pct_65.xlsx'));
    await page.waitForTimeout(12000); const s = await L.lsState(page);
    L.record({ id: 'AN-concurrency-newest-wins', area: 'Analogue/concurrency', title: 'Older slow upload then newer small upload (reverse completion)', expected: 'newest (1 row) wins', actual: { n: s.analogueDb.length, file: s.analogueSource.file, toasts: await L.toasts(page) }, status: s.analogueDb.length === 1 && /J_excel/.test(s.analogueSource.file) ? 'PASS' : 'FAIL' });
  }
  {
    // analogue upload then RESSUM upload immediately
    await L.nav(page, 'analogue'); await L.chooseFile(page, '#connect-analogue-btn', D('analogue_big_40000.xlsx'));
    await L.nav(page, 'models'); await L.chooseFile(page, '#load-workbook-btn', D('RESSUM_synthetic_24000.xlsx'));
    await page.waitForTimeout(20000); await L.waitIdle(page); const s = await L.lsState(page);
    L.record({ id: 'AN-concurrency-ressum', area: 'Analogue/concurrency', title: 'Analogue upload followed by RESSUM upload', expected: 'RESSUM does not cancel analogue; both complete', actual: { analogueRows: s.analogueDb.length, file: s.analogueSource.file, modelRows: s.modelRows, toasts: await L.toasts(page) }, status: s.analogueDb.length === 40000 && s.modelRows === 24000 ? 'PASS' : 'FAIL' });
  }
  await ctx.close();
  // job switch while pending; error notice isolation
  ({ ctx, page, log } = await L.launchClone('golden', 'p12b'));
  {
    await L.nav(page, 'analogue'); await L.chooseFile(page, '#connect-analogue-btn', D('analogue_big_40000.xlsx'));
    await page.click('#exit-link'); await page.waitForTimeout(200);
    await page.fill('#landing-well', 'NFQ22-9'); await page.click('#landing-start'); await page.waitForTimeout(12000);
    const s = await L.lsState(page);
    L.record({ id: 'AN-job-switch-pending', area: 'Analogue/concurrency', title: 'Switch to new job while analogue import pending', expected: 'pending import does not enter new job', actual: { well: s.well, analogueRows: s.analogueDb.length, dialogs: log.dialogs.slice(-1), toasts: await L.toasts(page) }, status: s.well === 'NFQ22-9' && s.analogueDb.length === 0 ? 'PASS' : 'FAIL' });
    await L.nav(page, 'analogue'); await L.chooseFile(page, '#connect-analogue-btn', D('analogue_not_zip.xlsx')); await page.waitForTimeout(800);
    const n1 = await page.textContent('#analogue-source-note');
    await page.click('#exit-link'); await page.fill('#landing-well', 'NFQ22-10'); await page.click('#landing-start'); await page.waitForTimeout(1500);
    await L.nav(page, 'analogue'); const n2 = await page.textContent('#analogue-source-note');
    L.record({ id: 'AN-error-notice-isolation', area: 'Analogue/concurrency', title: 'Import error then open another job', expected: 'error notice not shown in new job', actual: { n1, n2 }, status: /rejected/.test(n1) && !/rejected/.test(n2) ? 'PASS' : 'FAIL' });
  }
  L.save('t12_log.json', log);
  await ctx.close(); L.stopServer();
})();
