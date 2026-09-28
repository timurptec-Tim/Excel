// RKB, power-mean exponent, OPS model switch, RESSUM template round-trip; clipboard values saved for independent check.
const L = require('./lib'); const path = require('path'); const fs = require('fs'); const { execSync } = require('child_process');
(async () => {
  const { ctx, page, log } = await L.launchClone('golden', 'p21'); page.__dialogPolicy = 'accept';
  const rail = async (n) => { const b = page.locator('.rail button[data-step="' + n + '"]'); if (await b.isEnabled()) { await b.click(); await page.waitForTimeout(400); } };
  const regen = async () => { await rail('refresh'); await rail('generate'); await rail('update'); await L.nav(page, 'kmcontrol'); await page.click('#km-generate-btn'); await page.waitForTimeout(300); await L.nav(page, 'kminput'); await page.click('#km-input-tabs button[data-case="1"]'); await page.evaluate(() => navigator.clipboard.writeText('')); await page.click('#km-input-copy-btn'); await page.waitForTimeout(250); return L.clipboard(page); };
  const out = {};
  await L.nav(page, 'models'); await L.typeInto(page, '#rkb-input', '100'); out.rkb100 = await regen(); out.rkbToasts = await L.toasts(page);
  await L.nav(page, 'models'); await L.typeInto(page, '#rkb-input', '82');
  await L.typeInto(page, '#power-mean-input', '-1'); out.pm_neg1 = await regen();
  await L.nav(page, 'models'); await L.typeInto(page, '#power-mean-input', '0'); out.pm0Toast = await L.toasts(page); out.pm0Value = await page.inputValue('#power-mean-input');
  await L.typeInto(page, '#power-mean-input', '1.5');
  await page.click('#base-model-seg button[data-val="OPS"]'); await page.waitForTimeout(500); out.opsToasts = await L.toasts(page); out.ops = await regen();
  // template round-trip
  await L.nav(page, 'models'); const tpl = await L.download(page, '#download-template-btn', 'RESSUM_template.xlsx');
  execSync(`python3 -c "
import openpyxl,json
wb=openpyxl.load_workbook('${tpl.path}');ws=wb['RESSUM_Inputs']
print([c.value for c in ws[1]])
raw=json.load(open('${L.DATA}/ressum_rows.json'))['rows']
for i,r in enumerate(raw[:3000]):
  row=list(r)+[None]+list(r)+[None]+([82] if i==0 else [])
  for j,v in enumerate(row): ws.cell(row=i+2,column=j+1,value=v)
wb.save('${L.EV}/RESSUM_template_filled.xlsx')"`, { stdio: 'inherit' });
  await page.click('#base-model-seg button[data-val="ELAN"]'); await page.waitForTimeout(300);
  await L.chooseFile(page, '#load-workbook-btn', path.join(L.EV, 'RESSUM_template_filled.xlsx')); await page.waitForTimeout(2000); await L.waitIdle(page);
  const s = await L.lsState(page); out.templateImport = { rows: s.modelRows, rkb: s.rkb, toasts: await L.toasts(page) };
  L.record({ id: 'IMP-template-roundtrip', area: 'Import/RESSUM', title: 'Download RESSUM template, fill 3000 rows, re-import', expected: 'schema accepted; 3000 rows; RKB from U2', actual: out.templateImport, status: s.modelRows === 3000 && s.rkb === 82 ? 'PASS' : 'FAIL' });
  L.record({ id: 'PARAM-power-mean-zero', area: 'Models', title: 'Power-mean exponent 0', expected: 'rejected with message, value restored', actual: { toast: out.pm0Toast, value: out.pm0Value }, status: /non-zero/.test(out.pm0Toast.join()) ? 'PASS' : 'FAIL' });
  L.save('t21_clip.json', out);
  await ctx.close(); L.stopServer();
})();
