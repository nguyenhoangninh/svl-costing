// DATA-04 focused browser test with simulated Firebase. No production data, no real Firestore writes.
// Verifies guard decisions INSIDE the same cloudSave transaction. Firestore Emulator concurrency UAT still required.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { installFakeFirebase } from './support/fake-firebase.mjs';
const [, , base = 'http://127.0.0.1:8765/'] = process.argv;
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium')
  ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage();
let failures = 0;
const ok = (label, success) => { console.log((success ? '✓' : '✗') + ' ' + label); if (!success) failures++; };
try {
  await installFakeFirebase(page);
  await page.goto(base + '#cc');
  await page.waitForFunction(() => document.getElementById('account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
  const x = await page.evaluate(async () => {
    const store = await import('./src/store.js');
    const docs = window.__fake.docs, root = 'svl_costing_periods/';
    const p3 = root + '2099-03', p4 = root + '2099-04', p5 = root + '2099-05';
    const ptr = (period, rev, closed) => ({ period, rev, blobs: {}, summary: { closed, everClosed: !!closed }, updatedAt: '2099-05-01T00:00:00Z', updatedBy: 'admin.test@example.com' });
    docs.set(p3, ptr('2099-03', 2, '2099-03-31T17:00:00Z'));
    docs.set(p4, ptr('2099-04', 1, '2099-04-30T17:00:00Z'));
    docs.set(p5, ptr('2099-05', 1, '2099-05-31T17:00:00Z'));
    const reopenGuard = async () => store.cloudSave('2099-04', { closed: null }, { closed: null, everClosed: true }, () => {}, 1,
      { keepAllExcept: ['closed'], transition: { kind: 'REOPEN', id: 'test-reopen', reason: 'synthetic' } });
    let blockedNext = false;
    try { await reopenGuard(); } catch (e) { blockedNext = /kỳ sau.*CLOSED/.test(e.message); }
    const revAfterReopenBlock = docs.get(p4).rev === 1;
    docs.get(p5).summary.closed = null;
    let blockedSource = false;
    try {
      await store.cloudSave('2099-04', { closed: { mark: 'test' } }, { closed: '2099-04-30T17:01:00Z', everClosed: true }, () => {}, 1,
        { transition: { kind: 'CLOSE', id: 'test-stale', sourceRev: 1 } });
    } catch (e) { blockedSource = /kỳ trước.*thay đổi revision/.test(e.message); }
    const revAfterSourceBlock = docs.get(p4).rev === 1;
    // Valid matching source revision commits normally.
    const valid = await store.cloudSave('2099-04', { closed: { mark: 'test' } }, { closed: '2099-04-30T17:02:00Z', everClosed: true }, () => {}, 1,
      { transition: { kind: 'CLOSE', id: 'test-valid', sourceRev: 2 } });
    const saved = docs.get(p4);
    return { blockedNext, revAfterReopenBlock, blockedSource, revAfterSourceBlock,
      valid: !!valid && valid.rev === 2 && saved.rev === 2 && saved.transition?.id === 'test-valid',
      chunks: [...docs.keys()].some(k => k.startsWith(p4 + '/chunks/')) };
  });
  ok('REOPEN transaction rejects a next period already CLOSED', x.blockedNext && x.revAfterReopenBlock);
  ok('CLOSE transaction rejects a changed preceding-period revision', x.blockedSource && x.revAfterSourceBlock);
  ok('matching source revision commits once with transition metadata', x.valid && x.chunks);
} catch (e) { failures++; console.error(e); }
finally { await browser.close(); }
console.log(failures ? `FAILED: ${failures} guarded transitions` : 'PASS: Cloud period-guard transaction smoke tests');
process.exit(failures ? 1 : 0);
