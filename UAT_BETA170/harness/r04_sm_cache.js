const L=require('./lib');
(async()=>{const {ctx,page}=await L.launchClone('golden','r04');
await L.nav(page,'basesummary');await L.nav(page,'perforations');
await page.evaluate(()=>{window.__m=0;new MutationObserver(m=>window.__m+=m.length).observe(document.getElementById('chart1-slot'),{childList:true});});
await page.click('#add-splitmerge-btn');const n=await page.locator('#splitmerge-tbody tr').count();
await page.selectOption(`#splitmerge-tbody select[data-i="${n-1}"]`,'SPLIT');await L.typeInto(page,`#splitmerge-tbody input[data-i="${n-1}"][data-f="top"]`,10360);await L.typeInto(page,`#splitmerge-tbody input[data-i="${n-1}"][data-f="bottom"]`,10370);
const mEdit=await page.evaluate(()=>window.__m);
await page.locator('.rail button[data-step="update"]').click();await page.waitForTimeout(400);const mUpd=await page.evaluate(()=>window.__m);
await page.evaluate(()=>window.__m=0);await L.nav(page,'basesummary');const mVisit=await page.evaluate(()=>window.__m);
// hover chart 3 inside new zone to read zone name
const box=await page.locator('#chart3-slot svg').boundingBox();
L.record({id:'M3-splitmerge-refresh-recheck',area:'Caching/M3',title:'Split/merge edit + Update: when are Base Summary charts rebuilt?',expected:'charts reflect new zonation on next view',actual:{mutationsDuringEdit:mEdit,mutationsAtUpdate:mUpd,mutationsOnRevisit:mVisit},status:mUpd>0?'PASS':'FAIL',note:'Update re-renders charts immediately (runStep → renderFinalCharts, chartRevision++); the earlier FAIL cleared mutation counts after Update. Source note: signature uses state.splitmerge (typo for splitMerge, line 12121) — masked by chartRevision.'});
await ctx.close();L.stopServer();})();
