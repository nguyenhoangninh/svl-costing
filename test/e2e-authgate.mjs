// ENH-05 browser check: with Firebase unreachable (SDK blocked) the app must NOT show accounting data,
// even when a period was used on this device before. Usage: node test/e2e-authgate.mjs http://127.0.0.1:8765/
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// simulate "Google SDK cannot be reached" (policy/offline): block the Firebase CDN
await page.route('https://www.gstatic.com/**', (r) => r.abort());
await page.route('https://**/firebasejs/**', (r) => r.abort());
await page.goto(base + '#cc');
await page.evaluate(() => localStorage.setItem('svl.period', '2026-08'));
await page.reload();
await page.waitForSelector('.auth-login', { timeout: 20000 });
await page.waitForTimeout(1500);
const authShown = await page.isVisible('.auth-login');
const shellRail = await page.locator('#rail .nav-item, #rail button, #rail a').count();
const pageText = (await page.textContent('body')) || '';
// text of #main without the sign-in card itself: accounting screens would render here
const mainText = await page.evaluate(() => { const m = document.querySelector('#main'); if (!m) return ''; const c = m.cloneNode(true); c.querySelectorAll('.auth-login').forEach((x) => x.remove()); return c.textContent || ''; });
const leaks = ['STEP 1', 'STEP 2', 'FIFO', 'Tổng giá thành', 'Kỳ 2026-08'].filter((x) => mainText.includes(x));
const errShown = (await page.textContent('.auth-error').catch(() => '')) || '';
const checks = [
  ['sign-in gate shown when Firebase is unreachable', authShown],
  ['no navigation rail (no accounting screens) behind the gate', shellRail === 0],
  ['no accounting screen content behind the gate', leaks.length === 0 && mainText.trim() === ''],
  ['gate explains the connection problem', /kết nối|Đang kết nối/i.test(errShown + pageText)],
];
let fail = 0;
for (const [label, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) fail++; }
console.log('page errors:', errors.length ? errors.slice(0, 3) : 'none');
await browser.close();
console.log(`\n${checks.length - fail}/${checks.length} auth-gate browser checks passed`);
process.exit(fail ? 1 : 0);
