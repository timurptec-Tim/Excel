const L=require('./lib');
(async()=>{const {ctx,page}=await L.launchClone('golden','r01b');await L.nav(page,'matching');await page.waitForTimeout(500);await page.click('#ct-edit170');
await L.typeInto(page,'#ctm58-shift-number','-8.3');await page.click('#ctm58-lock-match');await page.waitForTimeout(300);
const s=await L.lsState(page);const el=page.locator('.ctm58-align, #ctm58-shift-number').first();
await page.locator('#ctm58-shift-number').scrollIntoViewIfNeeded();
const box=await page.locator('#ctm58-shift-number').boundingBox();await page.screenshot({path:L.EV+'/D01_ct_shift_saved.png',clip:{x:Math.max(0,box.x-500),y:Math.max(0,box.y-160),width:1100,height:300}});
console.log('saved shift',s.matching.ct.shift,'display',await page.textContent('#ctm58-shift-display'),'lock',await page.textContent('#ctm58-lock-status'));await ctx.close();L.stopServer();})();
