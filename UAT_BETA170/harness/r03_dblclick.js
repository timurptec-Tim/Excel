const L=require('./lib');
(async()=>{for(const run of [1,2]){const {ctx,page,log}=await L.launchClone('golden','r03_'+run);
let n=0;page.on('download',()=>n++);
await L.nav(page,'matching');await page.waitForTimeout(500);
await page.dblclick('#matching-export-xlsx');await page.waitForTimeout(9000);await L.waitIdle(page);
const t1=await L.toasts(page),n1=n;
await L.nav(page,'review');n=0;await page.dblclick('.rail button[data-step="export"]');await page.waitForTimeout(9000);await L.waitIdle(page);
const t2=await L.toasts(page),n2=n;
// overlay timing: when does #work-progress appear after click?
await L.nav(page,'matching');const timing=await page.evaluate(()=>new Promise(res=>{const b=document.getElementById('matching-export-xlsx');const t0=performance.now();let seen=null;const mo=new MutationObserver(()=>{if(!seen&&document.getElementById('work-progress'))seen=performance.now()-t0;});mo.observe(document.body,{childList:true});b.click();setTimeout(()=>{mo.disconnect();res({overlayAfterMs:seen,btnDisabledImmediately:b.disabled});},300);}));
await page.waitForTimeout(9000);await L.waitIdle(page);
L.record({id:'D-DOUBLE-EXPORT-run'+run,area:'Exports',title:'Real double-click on export buttons',expected:'one download per double-click (double-click protection)',actual:{matchingDownloads:n1,auditedDownloads:n2,t1,t2,timing},status:n1===1&&n2===1?'PASS':'FAIL'});
await ctx.close();}L.stopServer();})();
