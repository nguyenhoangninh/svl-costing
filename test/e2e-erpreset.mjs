// Browser check: "Xoá dữ liệu ERP" (scope → reason) removes the reports and they stay removed after a reload.
// node test/e2e-erpreset.mjs <base-url> <costing.xlsm>
import { chromium } from 'playwright';
const [, , base0, wbPath] = process.argv;
const base = base0 + '?sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let answers = [];
page.on('dialog', async (d) => { const a = answers.length ? answers.shift() : (d.type() === 'prompt' ? 'test' : undefined); console.log('dialog:', d.message().split('\n')[0].slice(0, 90), '→', a); await d.accept(a); });
const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
await page.goto(base + '#settings'); await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath); await page.waitForSelector('#mig table', { timeout: 240000 });
const count = async () => { await page.goto(base + '#step1'); await page.waitForSelector('.grid3'); return (await txt('.grid3')); };
console.log('before:', await count());
answers = ['lý do bất kỳ']; await page.click('[data-act=reset-erp]'); await page.waitForTimeout(300);
console.log('invalid scope toast:', (await page.textContent('#toasts')).includes('không hợp lệ'));
answers = ['T', 'Kiểm thử xoá hệ T']; await page.click('[data-act=reset-erp]'); await page.waitForTimeout(800);
console.log('toast:', (await page.textContent('#toasts')).slice(-120));
console.log('after delete:', await count());
await page.reload(); await page.waitForTimeout(1500);
console.log('after reload:', await count());
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
