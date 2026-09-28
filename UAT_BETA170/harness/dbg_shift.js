const L=require('./lib');
(async()=>{const {ctx,page,log}=await L.launch('dbg',{fresh:false});await page.waitForTimeout(2000);
await L.nav(page,'matching');await page.waitForTimeout(500);
const sh=async(tag)=>{const s=await L.lsState(page);console.log(tag,'align',JSON.stringify(s.matching.bh.alignment),'num',await page.inputValue('#bhm59-shift-number'),'range',await page.inputValue('#bhm59-shift-range'));};
await sh('start');
await page.fill('#bhm59-shift-number','5');await sh('after fill');
await page.locator('#bhm59-shift-number').dispatchEvent('change');await page.waitForTimeout(300);await sh('after change');
// keyboard typing like a user
await page.click('#bhm59-shift-number',{clickCount:3});await page.keyboard.type('7.5');await sh('typed 7.5');await page.keyboard.press('Tab');await page.waitForTimeout(300);await sh('after tab');
await page.click('#bhm59-shift-number',{clickCount:3});await page.keyboard.type('-3');await sh('typed -3');await page.keyboard.press('Tab');await page.waitForTimeout(300);await sh('after tab');
console.log(await L.toasts(page));await ctx.close();L.stopServer();})();
