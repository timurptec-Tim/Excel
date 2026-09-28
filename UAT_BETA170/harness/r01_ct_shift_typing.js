const L=require('./lib');
(async()=>{for(const run of [1,2]){const {ctx,page,log}=await L.launchClone('golden','r01_'+run);
await L.nav(page,'matching');await page.waitForTimeout(500);await page.click('#ct-edit170');await page.waitForTimeout(300);
const trace=[];const box=page.locator('#ctm58-shift-number');await box.click({clickCount:3});await page.keyboard.press('Control+A');await page.keyboard.press('Backspace');
for(const ch of '-8.3'){await page.keyboard.type(ch,{delay:120});await page.waitForTimeout(150);trace.push([ch,await box.inputValue(),(await L.lsState(page)).matching.ct.shift]);}
await page.keyboard.press('Tab');await page.waitForTimeout(200);
const s=(await L.lsState(page)).matching.ct.shift;
// BH contrast
await L.typeInto(page,'#bhm59-shift-number','-8.3');const b=(await L.lsState(page)).matching.bh.alignment.shift;
await L.shot(page,'r01_ct_shift_run'+run);
L.record({id:'D-CT-SHIFT-TYPING-run'+run,area:'Matching/L2',title:'Type "-8.3" into CT shift number box (unlocked)',expected:'shift = -8.3',actual:{final:s,trace,bhSameInput:b},status:s===-8.3?'PASS':'FAIL'});
await ctx.close();}L.stopServer();})();
