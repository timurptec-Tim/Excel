const L=require('./lib');const path=require('path');
(async()=>{const {ctx,page}=await L.launchClone('golden','r02b');
await L.nav(page,'bhactual');await page.locator('#bh-file-1').setInputFiles(path.join(L.DATA,'BH_start_mid_opr.txt'));await page.waitForTimeout(1200);
await page.fill('#bh-start-time','08:05:00');await page.locator('#bh-start-time').dispatchEvent('change');
await page.click('#bh-process');await page.waitForTimeout(700);const s=await L.lsState(page);
L.record({id:'D-BH-START-CUM-firstsample-cutoff',area:'BH Actual',title:'Same file with detection start = first sample time 08:05:00',expected:'same as "process from beginning"',actual:{rows:s.actual.bh.output.map(r=>[r.surface,+r.vol.toFixed(2)]),status:await page.textContent('#bh-kpi-status')},status:'OBSERVED'});
await ctx.close();L.stopServer();})();
