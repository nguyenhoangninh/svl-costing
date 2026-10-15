// Browser check for the provision screens (v1.14.70): STEP 5.1 "Nạp dự phòng đầu kỳ" rejects a file that does not match
// the FG layers (nothing is applied), and STEP 5.2 "Dự phòng FG" renders after RUN FIFO without page errors.
// Usage: node test/e2e-provision.mjs http://127.0.0.1:8765/ ../costing.xlsm <provision_template.xlsx> <outDir>
import { chromium } from 'playwright';
import path from 'node:path';
const [, , base0, wbPath, provPath, outDir] = process.argv;
const base = base0 + '?sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { await d.accept(d.type() === 'prompt' ? 'test' : undefined); });
const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
let fails = 0;
const ok = (label, cond) => { console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fails++; };

await page.goto(base + '#settings');
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });

await page.goto(base + '#fgopen'); await page.waitForSelector('.kpis');
ok('STEP 5.1 has the provision import button', (await page.locator('#f-provopen').count()) === 1);
const before = await txt('main');
await page.setInputFiles('#f-provopen', provPath);
await page.waitForTimeout(1500);
const toasts = await txt('#toasts');
ok('a provision file that does not match the FG layers is refused with a message', toasts.includes('Chưa nạp dự phòng'));
ok('a refused provision file leaves the status line unchanged (not loaded)', (await txt('main')).includes('Chưa nạp dự phòng đầu kỳ') === before.includes('Chưa nạp dự phòng đầu kỳ'));
await page.screenshot({ path: path.join(outDir, 'provision-5-1.png') });

await page.goto(base + '#step5'); await page.waitForSelector('.kpis');
await page.click('[data-act=s5-run]'); await page.waitForTimeout(1500);
if (await page.locator('[data-tab5="prov"]').count()) {
  await page.click('[data-tab5="prov"]'); await page.waitForTimeout(400);
  const body = await txt('#t5');
  ok('STEP 5.2 "Dự phòng FG" shows the FAST entries and the layer table', body.includes('Bút toán FAST') && body.includes('Theo dõi theo lớp'));
  await page.screenshot({ path: path.join(outDir, 'provision-5-2.png') });
} else {
  ok('STEP 5.2 "Dự phòng FG" tab exists', false);
}
ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
console.log(`\n${fails ? 'FAILED' : 'PASS'}: provision screens (${fails} failing)`);
process.exit(fails || errors.length ? 1 : 0);
