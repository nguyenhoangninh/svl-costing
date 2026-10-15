// Browser check for the provision tab (v1.14.71, 5P "Dự phòng FG"): the opening provision import sits on 5P (not 5.1),
// a file that does not match the FG layers is refused (nothing is applied), STEP 5.2 no longer carries the provision tab,
// and 5P renders the FAST entries, the layer table and the separate rework block after RUN FIFO without page errors.
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
ok('STEP 5.1 no longer carries the provision import (moved to 5P)', (await page.locator('#f-provopen').count()) === 0);

await page.goto(base + '#provision'); await page.waitForSelector('#f-provopen', { state: 'attached' });
ok('5P has the opening provision import button', (await page.locator('#f-provopen').count()) === 1);
const before = await txt('main');
await page.setInputFiles('#f-provopen', provPath);
await page.waitForTimeout(1500);
const toasts = await txt('#toasts');
ok('a provision file that does not match the FG layers is refused with a message', toasts.includes('Chưa nạp dự phòng'));
ok('a refused provision file leaves the page unchanged (no provision source)', (await txt('main')).includes('Chưa nạp. Nạp sau') === before.includes('Chưa nạp. Nạp sau'));
await page.screenshot({ path: path.join(outDir, 'provision-5p-1.png') });

await page.goto(base + '#step5'); await page.waitForSelector('.kpis');
await page.click('[data-act=s5-run]'); await page.waitForTimeout(1500);
ok('STEP 5.2 no longer has the "Dự phòng FG" tab', (await page.locator('[data-tab5="prov"]').count()) === 0);

await page.goto(base + '#provision'); await page.waitForSelector('#f-provopen', { state: 'attached' }); await page.waitForTimeout(400);
const body = await txt('main');
ok('5P shows the FAST entries and the layer table', body.includes('Bút toán FAST') && body.includes('Theo dõi theo lớp'));
ok('5P shows the rework block apart from the layer table', body.includes('Chuyển rework — tách riêng'));
await page.screenshot({ path: path.join(outDir, 'provision-5p-2.png') });

ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
console.log(`\n${fails ? 'FAILED' : 'PASS'}: provision tab 5P (${fails} failing)`);
process.exit(fails || errors.length ? 1 : 0);
