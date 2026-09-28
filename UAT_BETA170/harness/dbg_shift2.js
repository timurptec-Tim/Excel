const L=require('./lib');
(async()=>{const {ctx,page,log}=await L.launch('dbg',{fresh:false});await page.waitForTimeout(2000);
await L.nav(page,'matching');await page.waitForTimeout(500);
await page.evaluate(()=>{['ctm85-setup-panel','bhm85-setup-panel'].forEach(id=>{const d=document.getElementById(id);if(d&&!d.open)d.querySelector('summary').click();});});
const sh=async(tag)=>{await page.waitForTimeout(150);const s=await L.lsState(page);console.log(tag,'| shift',s.matching.bh.alignment.shift,'saved',s.matching.bh.alignment.saved,'| num',await page.inputValue('#bhm59-shift-number'),'| focus',await page.evaluate(()=>{const e=document.activeElement;return e&&(e.id||e.getAttribute('data-bhm85-field')||e.tagName)}), '| desc',JSON.stringify(s.matching.bh.cases[0].descriptor));};
await page.fill('#bhm59-shift-number','5'); await page.locator('#bhm59-shift-number').dispatchEvent('change'); await sh('shift 5');
const fib=page.locator('#bhm85-stage-tbody input[data-bhm85-field="fiberLoading"]:not([disabled])');const nf=await fib.count();
for(let i=0;i<nf;i++){await fib.nth(i).fill(i?'100':'125');await sh('fib fill '+i);await fib.nth(i).dispatchEvent('change');await sh('fib change '+i);}
const st=page.locator('#bhm85-stage-tbody input[data-bhm85-field="stimDp"]:not([disabled])');const ns=await st.count();
for(let i=0;i<ns;i++){await st.nth(i).fill(String(700+10*i));await sh('stim fill '+i);await st.nth(i).dispatchEvent('change');await sh('stim change '+i);}
await page.fill('[data-bhm-descriptor]','Base perm');await sh('desc fill');await page.locator('[data-bhm-descriptor]').first().dispatchEvent('change');await sh('desc change');
console.log(await L.toasts(page));await ctx.close();L.stopServer();})();
