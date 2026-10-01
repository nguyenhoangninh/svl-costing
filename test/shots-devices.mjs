// Screenshots of key screens on phone / tablet sizes (visual QA).
import { chromium, devices } from 'playwright';
import path from 'node:path';
const [, , base0, wbPath, outDir, tag = 'a'] = process.argv;
const base = base0 + '?sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const DEV = {
  iphone: { ...devices['iPhone 14'] },
  ipadP: { ...devices['iPad (gen 7)'] },
  ipadL: { ...devices['iPad (gen 7) landscape'] },
  ipadPro: { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: devices['iPad (gen 7)'].userAgent },
};
const errors = [];
for (const [name, d] of Object.entries(DEV).filter(([k]) => !process.env.DEVS || process.env.DEVS.split(',').includes(k))) {
  const ctx = await browser.newContext({ ...d, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.on('dialog', (x) => x.accept()); page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  await page.goto(base + '#settings'); await page.waitForSelector('#f-xlsm', { state: 'attached' });
  await page.setInputFiles('#f-xlsm', wbPath); await page.waitForSelector('#mig table', { timeout: 240000 });
  for (const v of (process.env.VIEWS || 'cc,step4,step5,close').split(',')) {
    await page.goto(base + '#' + v); await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
    await page.screenshot({ path: path.join(outDir, `${tag}-${name}-${v}.png`), fullPage: !!process.env.FULL });
  }
  await ctx.close();
}
console.log('errors:', errors.join('\n') || 'none');
await browser.close();
