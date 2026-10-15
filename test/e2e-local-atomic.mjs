// Wave 1 — test real IndexedDB ACID behavior in Chromium with synthetic non-accounting data.
// Existing Cloud/period data is NEVER used: ?sandbox=1 creates a separate local database.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , base = 'http://127.0.0.1:8765/'] = process.argv;
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium')
  ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage();
let failures = 0;
const ok = (name, good) => { console.log((good ? '✓' : '✗') + ' ' + name); if (!good) failures++; };
try {
  await page.goto(base + '?sandbox=1#cc');
  const results = await page.evaluate(async () => {
    const store = await import('./src/store.js');
    const p = '2099-03', key = (k) => 'p/' + p + '/' + k;
    await store.localSet(key('opening'), { original: 'old-snapshot' });
    await store.localSet(key('unsynced'), true);
    const before = await store.localGet(key('opening'));
    await store.localReplacePeriod(p,
      { opening: { version: 'new-snapshot' }, 'ds:STOCK OUT-T': [{ code: 'M-TEST', amt: 100 }], audit: [] },
      { rev: 7, updatedAt: '2099-03-01T00:00:00Z' });
    const after = await store.localGet(key('opening'));
    const replaced = (await store.localGet(key('cloudRev'))) === 7;
    const removedUnsynced = (await store.localGet(key('unsynced'))) === undefined;
    const storedReport = (await store.localGet(key('ds:STOCK OUT-T')))?.[0]?.amt === 100;
    let failed = false;
    try {
      // Functions are uncloneable. The transaction fails mid-replacement.
      await store.localReplacePeriod(p,
        { opening: { version: 'invalid-snapshot' }, 'ds:BAD': { impossibleToClone() {} } },
        { rev: 8, updatedAt: '2099-03-02T00:00:00Z' });
    } catch { failed = true; }
    const oldIntact = (await store.localGet(key('opening')))?.version === 'new-snapshot';
    const originalRevisionIntact = (await store.localGet(key('cloudRev'))) === 7;
    const unchangedReport = (await store.localGet(key('ds:STOCK OUT-T')))?.[0]?.amt === 100;
    return { before: before?.original, after: after?.version, replaced, removedUnsynced, storedReport, failed, oldIntact, originalRevisionIntact, unchangedReport };
  });
  ok('local snapshot before pull exists', results.before === 'old-snapshot');
  ok('atomic pull replaces complete snapshot and revision', results.after === 'new-snapshot' && results.replaced);
  ok('atomic pull clears unsynced flag and saves datasets', results.removedUnsynced && results.storedReport);
  ok('injected IndexedDB structured-clone failure aborts transaction', results.failed);
  ok('failed update leaves earlier snapshot, revision and datasets intact', results.oldIntact && results.originalRevisionIntact && results.unchangedReport);
} catch (e) { failures++; console.error(e); }
finally { await browser.close(); }
console.log(failures ? `FAILED: ${failures} atomic snapshot tests` : 'PASS: atomic IndexedDB replacement and rollback');
process.exit(failures ? 1 : 0);
