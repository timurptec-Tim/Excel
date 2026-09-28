// Capture all clipboard outputs (real button clicks) for reconciliation.
const L=require('./lib');
(async()=>{const {ctx,page,log}=await L.launch('baseline',{fresh:false});await page.waitForTimeout(2000);
const clip={},disp={};
await L.nav(page,'kminput');
for(const c of [1,2,3,4]){await page.click(`#km-input-tabs button[data-case="${c}"]`);await page.waitForTimeout(300);
 for(const [b,k] of [['#km-input-copy-btn','zone'],['#km-input-opr-copy','opr'],['#km-input-spurt-copy','spurt']]){await page.evaluate(()=>navigator.clipboard.writeText('__EMPTY__'));await page.click(b);await page.waitForTimeout(250);clip[k+'_case'+c]=await L.clipboard(page);}
 disp['case'+c]={zone:await page.$$eval('#km-input-zone-tbody tr',t=>t.map(r=>[...r.cells].map(x=>x.textContent))),opr:await page.$$eval('#km-input-opr-tbody tr',t=>t.map(r=>[...r.cells].map(x=>x.textContent))),spurtHead:await page.$$eval('#km-input-spurt-head th',t=>t.map(x=>x.textContent)),props:await page.$$eval('#km-input-properties-tbody tr',t=>t.map(r=>[...r.cells].map(x=>x.textContent))),empty:await page.$eval('#km-input-empty',e=>e.hidden?'':e.innerText)};
 disp['case'+c].toasts=await L.toasts(page);}
await L.nav(page,'kmcontrol');await page.evaluate(()=>navigator.clipboard.writeText('__EMPTY__'));await page.click('#prediction-template-copy-btn').catch(()=>{});await page.waitForTimeout(250);clip.template=await L.clipboard(page);
await L.nav(page,'ctactual');await page.click('#ct-copy');await page.waitForTimeout(250);clip.ct=await L.clipboard(page);
disp.ct=await page.$$eval('#ct-output tr',t=>t.map(r=>[...r.cells].map(x=>x.textContent)));
await L.nav(page,'bhactual');await page.click('#bh-copy');await page.waitForTimeout(250);clip.bh=await L.clipboard(page);
disp.bh=await page.$$eval('#bh-output tr',t=>t.map(r=>[...r.cells].map(x=>x.textContent)));
const st=await L.lsState(page);
L.save('t05_capture.json',{clip,disp,state:st});
console.log(Object.keys(clip).map(k=>k+':'+clip[k].split('\n').length+' lines').join(', '));
console.log(disp.case2.toasts, disp.case2.empty.slice(0,100));
await ctx.close();L.stopServer();})();
