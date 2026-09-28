const L=require('./lib');const path=require('path');
(async()=>{for(const run of [1,2]){const {ctx,page,log}=await L.launchClone('golden','r02_'+run);
await L.nav(page,'bhactual');await page.locator('#bh-file-1').setInputFiles(path.join(L.DATA,'BH_start_mid_opr.txt'));await page.waitForTimeout(1200);
await page.click('#bh-process');await page.waitForTimeout(700);const s=await L.lsState(page);await L.shot(page,'r02_bh_midopr_run'+run);
const opr1=s.actual.bh.output.find(r=>r.surface==='OPR-1');
L.record({id:'D-BH-START-CUM-run'+run,area:'BH Actual',title:'Recording starts mid OPR-1 with meter at 51.67 bbl, no detection start',expected:'OPR-1 = 150 bbl − 41.67 bbl pumped before recording = 108.33 bbl (only volume observed in the file)',actual:{opr1:opr1&&opr1.vol,rows:s.actual.bh.output.map(r=>[r.surface,+r.vol.toFixed(2)]),qa:s.actual.bh.qa.split('\n').filter(l=>/Volume before|Excluded|Detected pumped|Allocated|Unallocated|PASS|WARNING/.test(l))},status:opr1&&Math.abs(opr1.vol-108.33)<0.5?'PASS':'FAIL'});
await ctx.close();}L.stopServer();})();
