// Browser smoke test: create period, import ERP fixtures, import opening from workbook, run STEP 2/3, screenshot.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [, , base = 'http://localhost:8765/', fixDir, wbPath, outDir] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { console.log('dialog:', d.message().slice(0, 120)); await d.accept(d.type() === 'prompt' ? '2026-08' : undefined); });
const shot = (n) => page.screenshot({ path: path.join(outDir, n + '.png'), fullPage: false });

await page.goto(base);
await page.waitForSelector('#f-new');
await page.fill('#f-new input[name=p]', '2026-08');
await page.click('#f-new button');
await page.waitForSelector('.kpis');
await shot('01-cc-empty');

await page.goto(base + '#step1');
await page.waitForSelector('#f-files', { state: 'attached' });
const files = fs.readdirSync(fixDir).filter((f) => f.endsWith('.xlsx')).map((f) => path.join(fixDir, f));
await page.setInputFiles('#f-files', files);
await page.waitForSelector('#plan .alert', { timeout: 120000 });
console.log('import:', (await page.textContent('#plan')).slice(0, 200));
await shot('02-step1');
// v1.14.25: abnormal ERP lines are listed at STEP 1 and STEP 2 is blocked until they are confirmed
const dqText = (await page.textContent('body')).replace(/\s+/g, ' ');
console.log('DQ section:', (dqText.match(/Dữ liệu ERP bất thường:[^.]*/) || ['(none)'])[0].slice(0, 120));
await page.goto(base + '#step2');
await page.click('[data-act=run-step2]');
await page.waitForTimeout(500);
console.log('STEP 2 before confirm blocked:', !(await page.$('#t-detail .vt-table')) && /STEP 2 bị chặn: STEP 1 có/.test(await page.textContent('body')));
await page.goto(base + '#step1');
if (await page.$('[data-act=dq-confirm]')) { await page.click('[data-act=dq-confirm]'); await page.waitForTimeout(400); }
console.log('DQ after confirm:', ((await page.textContent('body')).replace(/\s+/g, ' ').match(/Đã xác nhận bởi[^:]*/) || ['(no confirmation)'])[0]);
await shot('02b-step1-confirmed');
await page.goto(base + '#step2');
await page.click('[data-act=run-step2]');
await page.waitForSelector('#t-detail .vt-table', { timeout: 60000 });
await shot('03-step2');

await page.goto(base + '#rework');
await page.waitForSelector('#t-rw .vt-table');
await shot('04-rework');

await page.goto(base + '#opening');
await page.setInputFiles('#f-open', wbPath);
await page.waitForSelector('#t-op .vt-table', { timeout: 180000 });
await shot('05-opening');

await page.goto(base + '#step3');
await page.click('[data-act=run-step3]');
await page.waitForSelector('#t-wip .vt-table', { timeout: 60000 });
await shot('06-step3');
const flow = await page.textContent('.flow');
console.log('flow:', flow.replace(/\s+/g, ' '));

await page.goto(base + '#cc');
await page.waitForSelector('.kpis');
await shot('07-cc');
await page.setViewportSize({ width: 390, height: 844 });
await shot('08-mobile');
await page.emulateMedia({ colorScheme: 'dark' });
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base + '#step3');
await page.waitForSelector('#t-wip .vt-table');
await shot('09-dark');
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
