// Shared Playwright helpers for the BETA170 UAT. Real UI interactions only;
// app internals are private (IIFE closure), so observation is via DOM, localStorage,
// IndexedDB, clipboard and downloaded files.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const S = path.resolve(__dirname, '..');
const DATA = path.join(S, 'data');
const EV = path.join(S, 'evidence');
const APP_SRC = path.join(S, 'src', 'BETA170.html');
fs.mkdirSync(EV, { recursive: true });

let server = null;
function startServer(port = 8170) {
  if (server) return Promise.resolve(port);
  return new Promise((res) => {
    server = http.createServer((req, resp) => {
      // Serve the unmodified BETA170 bytes.
      if (req.url.startsWith('/app.html')) {
        resp.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        fs.createReadStream(APP_SRC).pipe(resp);
      } else { resp.writeHead(404); resp.end(); }
    }).listen(port, () => res(port));
  });
}
function stopServer() { if (server) { server.close(); server = null; } }

async function launch(profileName, opts = {}) {
  await startServer();
  const userDataDir = path.join(S, 'profiles', profileName);
  if (opts.fresh !== false) fs.rmSync(userDataDir, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: true,
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
    timezoneId: opts.timezoneId || 'Asia/Dubai',
    locale: 'en-GB',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const log = { console: [], errors: [], dialogs: [], toasts: [] };
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => log.errors.push(String(e && e.stack || e)));
  page.__dialogPolicy = 'accept';
  page.on('dialog', async (d) => {
    log.dialogs.push({ type: d.type(), message: d.message(), policy: page.__dialogPolicy });
    if (page.__dialogPolicy === 'dismiss') await d.dismiss(); else await d.accept();
  });
  await page.goto('http://localhost:8170/app.html');
  await page.waitForLoadState('load');
  await installToastSpy(page);
  return { ctx, page, log };
}

async function installToastSpy(page) {
  await page.evaluate(() => {
    window.__toasts = [];
    const host = document.getElementById('toast-host');
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push({ t: Date.now(), text: n.textContent })))).observe(host, { childList: true });
  });
}
async function toasts(page, clear = true) {
  const t = await page.evaluate(() => window.__toasts.map((x) => x.text));
  if (clear) await page.evaluate(() => { window.__toasts = []; });
  return t;
}
async function reload(page) {
  await page.reload(); await page.waitForLoadState('load');
  await page.waitForTimeout(800); await installToastSpy(page);
}
async function lsState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('projecta-zonation-v48-fullcycle-beta33') || 'null'));
}
async function idbDump(page, store) {
  return page.evaluate((store) => new Promise((res, rej) => {
    const r = indexedDB.open('ProjectA_Zonation_LocalDB');
    r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains(store)) { db.close(); return res([]); }
      const tx = db.transaction(store, 'readonly'); const q = tx.objectStore(store).getAll();
      q.onsuccess = () => { db.close(); res(q.result); }; q.onerror = () => rej(q.error); };
    r.onerror = () => rej(r.error);
  }), store);
}
async function nav(page, target) {
  // Open the sidebar stage group if collapsed, then click the page button.
  const btn = page.locator(`#page-nav button[data-target="${target}"]`);
  if (!(await btn.isVisible())) {
    await page.evaluate((t) => { const b = document.querySelector(`#page-nav button[data-target="${t}"]`); const g = b.closest('.stage-nav-group'); const tg = g && g.querySelector('.stage-nav-toggle'); if (tg && !g.classList.contains('is-open')) tg.click(); }, target);
  }
  await btn.click();
  await page.waitForTimeout(150);
}
async function chooseFile(page, buttonSelector, file) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(buttonSelector)]);
  await fc.setFiles(file);
}
async function setField(page, sel, value) {
  await page.fill(sel, String(value));
  await page.locator(sel).dispatchEvent('change');
}
async function clipboard(page) { return page.evaluate(() => navigator.clipboard.readText()); }
async function download(page, clickSelector, name) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(clickSelector)]);
  const out = path.join(EV, name || dl.suggestedFilename());
  await dl.saveAs(out);
  return { path: out, suggested: dl.suggestedFilename() };
}
async function waitIdle(page, ms = 300) {
  await page.waitForFunction(() => !document.getElementById('work-progress'), null, { timeout: 120000 });
  await page.waitForTimeout(ms);
}
function save(name, obj) { fs.writeFileSync(path.join(EV, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); }
async function shot(page, name) { await page.screenshot({ path: path.join(EV, name + '.png'), fullPage: false }); }

module.exports = { S, DATA, EV, launch, reload, lsState, idbDump, nav, chooseFile, setField, clipboard, download, waitIdle, toasts, save, shot, stopServer, installToastSpy };

// ---- test recorder + profile cloning ----
const RES = path.join(EV, 'results.jsonl');
function record(r) { fs.appendFileSync(RES, JSON.stringify(Object.assign({ at: new Date().toISOString() }, r)) + '\n'); console.log(`[${r.status}] ${r.id} ${r.title}${r.actual ? ' :: ' + String(typeof r.actual === 'string' ? r.actual : JSON.stringify(r.actual)).slice(0, 260) : ''}`); }
function cloneProfile(from, to) { const src = path.join(S, 'profiles', from), dst = path.join(S, 'profiles', to); fs.rmSync(dst, { recursive: true, force: true }); require('child_process').execSync(`cp -r "${src}" "${dst}"`); }
async function launchClone(from, to, opts) { cloneProfile(from, to); const r = await launch(to, Object.assign({ fresh: false }, opts || {})); await r.page.waitForTimeout(2000); return r; }
async function typeInto(page, sel, text, key = 'Tab') { const loc = typeof sel === 'string' ? page.locator(sel) : sel; await loc.click({ clickCount: 3 }); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); if (String(text) !== '') await page.keyboard.type(String(text)); if (key) await page.keyboard.press(key); await page.waitForTimeout(200); }
module.exports.record = record; module.exports.cloneProfile = cloneProfile; module.exports.launchClone = launchClone; module.exports.typeInto = typeInto;
