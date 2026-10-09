// Browser check: period table in settings – delete a never-closed period from its own row.
// node test/e2e-periods.mjs <base-url> <costing.xlsm>
import { chromium } from 'playwright';
const [, , base0, wbPath] = process.argv;
const base = base0 + '?sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let answers = [];
page.on('dialog', async (d) => { const a = answers.length ? answers.shift() : undefined; console.log('dialog:', d.message().split('\n')[0].slice(0, 90), '→', a); await d.accept(a); });
const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
await page.goto(base + '#settings'); await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath); await page.waitForSelector('#mig table', { timeout: 240000 });
answers = ['2026-09']; await page.click('[data-act=new-period]'); await page.waitForTimeout(1500);
await page.goto(base + '#settings'); await page.waitForTimeout(500);
console.log('table:', ((await txt('main')).match(/Kỳ hiện có.{0,200}/) || ['?'])[0]);
answers = ['2026-08']; await page.click('[data-act=delete-period][data-p="2026-08"]'); await page.waitForTimeout(2000);
await page.goto(base + '#settings'); await page.waitForTimeout(500);
console.log('after delete:', ((await txt('main')).match(/Kỳ hiện có.{0,120}/) || ['?'])[0]);
await page.reload(); await page.waitForTimeout(1500); await page.goto(base + '#settings'); await page.waitForTimeout(500);
console.log('after reload:', ((await txt('main')).match(/Kỳ hiện có.{0,120}/) || ['?'])[0]);
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
