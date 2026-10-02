// Browser check: product cost trace screens.
import { chromium } from 'playwright';
import path from 'node:path';
const [, , base0, wbPath, outDir] = process.argv;
const base = base0 + '?sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept());
await page.goto(base + '#settings'); await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath); await page.waitForSelector('#mig table', { timeout: 240000 });
const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
let t0 = Date.now();
await page.goto(base + '#trace'); await page.waitForSelector('#tr-list-t .vt-table');
console.log('list ms', Date.now() - t0, '|', (await txt('#tr-body')).slice(0, 200));
await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
await page.screenshot({ path: path.join(outDir, '50-trace-list.png') });
await page.click('#tr-list-t tbody tr[data-v]'); await page.waitForSelector('.tr-head');
console.log('product:', await txt('.tr-head'), '|', (await txt('.kpis')).slice(0, 300));
await page.screenshot({ path: path.join(outDir, '51-trace-cost.png'), fullPage: false });
console.log('anoms:', (await txt('.anoms')).slice(0, 400));
for (const s of ['mats', 'matlots', 'so', 'lots']) { await page.click(`[data-trsub="${s}"]`); await page.waitForTimeout(300); }
await page.click('[data-trsub="mats"]'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(outDir, '52-trace-mats.png') });
await page.click('#tr-sub tbody tr[data-v]'); await page.waitForTimeout(300);
console.log('mat→lots query:', await page.inputValue('#tr-sub .vt-search'), (await txt('#tr-sub .vt-count')));
await page.click('[data-trtab="cogs"]'); await page.waitForTimeout(400);
console.log('cogs:', (await txt('.kpis')).slice(0, 300));
await page.screenshot({ path: path.join(outDir, '53-trace-cogs.png') });
for (const s of ['layers', 'detail', 'closing', 'sales']) { await page.click(`[data-trcsub="${s}"]`); await page.waitForTimeout(250); }
// deep link from Step 4 table
await page.goto(base + '#step4'); await page.waitForSelector('.tr-link'); await page.click('.tr-link'); await page.waitForTimeout(500);
console.log('deep link:', page.url().split('#')[1], '|', await txt('.tr-head'));
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
await page.screenshot({ path: path.join(outDir, '54-trace-phone.png'), fullPage: true });
console.log('errors:', errors.join('\n') || 'none');
await browser.close();
if (errors.length) process.exit(1);
