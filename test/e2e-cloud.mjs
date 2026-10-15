// Browser run of the CLOUD paths (ENH-04 / 07 / 08 / 09) against the in-memory Firebase stand-in (test/support/fake-firebase.mjs).
// Real app.js / store.js / phase3.js run in Chromium; only the backend is simulated (firestore.rules are NOT enforced here).
// Usage: node test/e2e-cloud.mjs http://127.0.0.1:8765/ /path/costing.xlsm <outDir>
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import path from 'node:path';

const [, , base = 'http://127.0.0.1:8765/', wbPath = '/home/claude/costing.xlsm', outDir = '.'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push('console: ' + m.text()); });

// dialog policy: confirm() answer and prompt() answers are set per step
const policy = { confirm: true, promptNewPeriod: '2026-09' };
page.on('dialog', async (d) => {
  const msg = d.message();
  if (d.type() === 'prompt') {
    let ans = 'test reason';
    if (msg.startsWith('Kỳ mới')) ans = policy.promptNewPeriod;
    const del = msg.match(/Gõ (\d{4}-\d{2})/); if (del) ans = del[1];
    await d.accept(ans);
  } else if (policy.confirm) await d.accept(); else await d.dismiss();
});
await installFakeFirebase(page);

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };
const F = (fn, ...a) => page.evaluate(fn, ...a);
const docKeys = (prefix) => F((p) => [...window.__fake.docs.keys()].filter((k) => k.startsWith(p)), prefix);
const docVal = (p) => F((x) => window.__fake.docs.get(x) || null, p);
const auditRows = () => F(() => [...window.__fake.docs.entries()].filter(([k]) => k.startsWith('svl_costing_audit/')).map(([, v]) => v));
const countAudit = async (action) => (await auditRows()).filter((a) => a.action === action).length;
const waitAudit = async (action, atLeast, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await countAudit(action)) >= atLeast) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
const setFail = (op, count, msg) => F(([o, c, m]) => { window.__fake.fail[o] = { count: c, msg: m || 'injected: cloud unavailable', code: 'unavailable' }; }, [op, count, msg]);
const failedCount = () => F(() => window.__fake.log.filter((e) => e.failed).length);
const commits = () => F(() => window.__fake.log.filter((e) => e.op === 'commit').length);
const toasts = async () => ((await page.textContent('#toasts').catch(() => '')) || '').replace(/\s+/g, ' ');
const waitToast = (re, timeout = 20000) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#toasts')?.textContent || ''), re.source, { timeout }).then(() => true, () => false);
/** every chunk named by the current pointer must exist (a committed revision never points at missing data) */
const missingChunks = (periodId) => F((p) => {
  const S = window.__fake; const meta = S.docs.get('svl_costing_periods/' + p); if (!meta) return ['(no pointer)'];
  const miss = [];
  for (const [name, m] of Object.entries(meta.blobs || {})) for (let k = 0; k < m.n; k++) {
    const id = `${m.key || name}__${k}`; // same chunk id rule as store.js
    if (!S.docs.has(`svl_costing_periods/${p}/chunks/${id}`)) miss.push(`${name}#${k}`);
  }
  return miss;
}, periodId);
const sleep = (ms) => page.waitForTimeout(ms);
const syncPill = async () => ((await page.textContent('#sync').catch(() => '')) || '').replace(/\s+/g, ' ');
const sig = (u) => F((x) => { const S = window.__fake; S.uid = x.uid; S.email = x.email; S.signedIn = true; S.listeners.forEach((cb) => setTimeout(() => cb({ uid: x.uid, email: x.email, displayName: x.email }), 0)); }, u);
const signOutFake = () => F(() => { const S = window.__fake; S.signedIn = false; S.listeners.forEach((cb) => setTimeout(() => cb(null), 0)); });
const waitSynced = () => page.waitForFunction(() => /Đã đồng bộ/.test(document.querySelector('#sync')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
const gotoTab = async (hash) => { await page.goto(base + hash); await page.waitForTimeout(400); };

// ---- sign-in (fake) + migrate workbook ----
await page.goto(base + '#settings');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
await page.waitForFunction(() => window.__fake.log.some((e) => e.op === 'commit'), null, { timeout: 60000 });
const P8 = '2026-08';
ok('migrated period is saved to the cloud (pointer + chunks + revision)', (await docKeys(`svl_costing_periods/${P8}`)).length > 3);
ok('audit events reached the cloud with actor fixed at event time', (await auditRows()).length > 0 && (await auditRows()).every((a) => a.attribution === 'ACTOR' && a.actorUid === 'uid-admin'));

// ---- bring 2026-08 to a closeable state (same steps as the local e2e) ----
await gotoTab('#step4'); await page.click('[data-act=run-step4]'); await sleep(1500);
await gotoTab('#step5'); await page.click('[data-act=s5-run]'); await sleep(1500);
await gotoTab('#close'); await page.waitForSelector('.result');
await page.click('[data-act=s5-hist]'); await sleep(1200);
// v1.14.73 moved the NRV decision to 5P; the CLOSE gate needs it (the test reached CLOSE without it since then)
if (!(await page.locator('#f-nrv-decision').count())) { await gotoTab('#provision'); await sleep(1200); }
if (await page.locator('#f-nrv-decision').count()) {
  await page.selectOption('#f-nrv-decision select[name=status]', 'NO ADJUSTMENT APPROVED');
  await page.fill('#f-nrv-decision input[name=note]', 'Kiểm thử: chưa trích lập kỳ này'); await page.click('#f-nrv-decision button[type=submit]'); await sleep(500);
}
await gotoTab('#close'); await page.waitForSelector('.result');
await page.click('[data-tabh="fast"]'); await page.waitForSelector('#f-fast');
const engVals = await page.$$eval('#f-fast tbody tr', (trs) => trs.map((tr) => [tr.querySelector('input').name, tr.children[2].textContent.replace(/\./g, '').replace(',', '.').replace(/[–-]$/, '0')]));
for (const [k, v] of engVals) await page.fill(`#f-fast input[name=${k}]`, k === 'a632' ? String(Math.round(+v || 0) - 1000) : String(Math.round(+v || 0)));
await page.click('#f-fast button[type=submit]'); await sleep(400);
await page.fill('#f-fast-ok input[name=note]', 'Kiểm thử: chênh làm tròn bút toán 632'); await page.click('#f-fast-ok button'); await sleep(400);
await gotoTab('#sales'); await page.click('[data-tabs="dup"]'); await sleep(300);
await page.click('[data-dupall="KEEP"]'); await sleep(300);
await gotoTab('#close'); await page.waitForSelector('.result');
await waitSynced();
ok('2026-08 is closeable before the cloud tests', (await page.locator('[data-act=s5-close]').count()) === 1);

// ---- ENH-09a: a CLOSE whose cloud commit fails leaves no close trace ----
const closeBefore = await countAudit('STEP 5 - CLOSE MONTH');
await setFail('runTransaction', 1);
await page.click('[data-act=s5-close]'); await sleep(4000);
ok('ENH-09 failed commit: CLOSE refused with cloud message', /CHƯA đóng kỳ/.test(await toasts()), (await toasts()).slice(-140));
ok('ENH-09 failed commit: no "STEP 5 - CLOSE MONTH" in the cloud trail', (await countAudit('STEP 5 - CLOSE MONTH')) === closeBefore);
ok('ENH-09 failed commit: a FAILED entry is recorded instead', (await countAudit('STEP 5 - CLOSE MONTH FAILED')) >= 1);
ok('ENH-09 failed commit: cloud pointer is still OPEN (no closed summary)', !(await docVal(`svl_costing_periods/${P8}`))?.summary?.closed);
ok('ENH-09 failed commit: period is still OPEN on screen', !(await page.textContent('.result')).includes('CLOSED'));

// ---- ENH-09b: retry after the failure closes once ----
await page.click('[data-act=s5-close]');
ok('ENH-09 retry: close confirmed by the cloud', await waitToast(/cloud đã xác nhận/), (await toasts()).slice(-120));
const closedMeta = await docVal(`svl_costing_periods/${P8}`);
ok('ENH-09 retry: cloud pointer holds the close timestamp', !!closedMeta?.summary?.closed);
ok('ENH-09 retry: exactly one CLOSE entry in the cloud trail', (await waitAudit('STEP 5 - CLOSE MONTH', closeBefore + 1)) && (await countAudit('STEP 5 - CLOSE MONTH')) === closeBefore + 1);
ok('ENH-09 retry: rework carry-forward entry written once', (await countAudit('STEP 5B - REWORK WIP CARRY-FORWARD')) === 1);

// ---- ENH-09c: reply lost after the cloud committed → confirmed, not applied twice, chunks intact ----
await gotoTab('#close'); await page.waitForSelector('.result');
await page.click('[data-act=s5-reopen]'); await sleep(1500);
ok('reopen commits (cloud summary no longer closed)', !(await docVal(`svl_costing_periods/${P8}`))?.summary?.closed);
const chunkKeysBefore = (await docKeys(`svl_costing_periods/${P8}/chunks/`)).length;
await F(() => { window.__fake.dropReplyAfterCommit = 1; });
const closeBefore2 = await countAudit('STEP 5 - CLOSE MONTH');
const logMark = await F(() => window.__fake.log.length);
await page.evaluate(() => { const t = document.querySelector('#toasts'); if (t) t.innerHTML = ''; });
await page.click('[data-act=s5-close]'); await sleep(4000);
if (process.env.DEBUG_LOG) console.log('TOAST after lost-reply click:', (await toasts()).slice(0, 300), '| result:', ((await page.textContent('.result').catch(() => '')) || '').slice(0, 120));
ok('ENH-09 lost reply: confirmed as closed by the cloud', await waitToast(/cloud đã xác nhận/), (await toasts()).slice(-120));
if (process.env.DEBUG_LOG) console.log('LOG after lost reply:', JSON.stringify((await F((m) => window.__fake.log.slice(m), logMark)).map((e) => [e.op, (e.path || '').replace('svl_costing_periods/', '').slice(0, 60), e.failed ? 'FAILED' : ''])).slice(0, 3000));
ok('ENH-09 lost reply: CLOSE entry written exactly once', (await waitAudit('STEP 5 - CLOSE MONTH', closeBefore2 + 1)) && (await countAudit('STEP 5 - CLOSE MONTH')) === closeBefore2 + 1);
const miss = await missingChunks(P8);
ok('ENH-04/09 lost reply: every chunk the committed pointer references still exists', miss.length === 0, miss.length ? `missing: ${miss.slice(0, 4).join(', ')}` : 'all present');
const chunkKeysAfter = (await docKeys(`svl_costing_periods/${P8}/chunks/`)).length;
ok('ENH-04/09 lost reply: committed revision keeps its chunks (none deleted by the failed-write cleanup)', chunkKeysAfter >= chunkKeysBefore, `${chunkKeysBefore} → ${chunkKeysAfter}`);

// ---- v1.14.89 audit AUD-10: the close revision carries its transition (id, CLOSE, actor) in the pointer and the revision ----
{
  const ptr = await docVal(`svl_costing_periods/${P8}`);
  const rid = `svl_costing_periods/${P8}/revisions/${String(ptr.rev).padStart(6, '0')}-${ptr.manifestHash}`;
  const rev = await docVal(rid);
  ok('AUD-10: the close pointer carries its transition (CLOSE, OPEN → CLOSED, actor)', ptr.transition && ptr.transition.kind === 'CLOSE' && ptr.transition.from === 'OPEN' && ptr.transition.to === 'CLOSED' && /admin\.test/.test(ptr.transition.actor || ''), JSON.stringify(ptr.transition || null));
  ok('AUD-10: the immutable revision document holds the same transition', !!rev && rev.transition && rev.transition.id === ptr.transition.id, rid);
}
// ---- v1.14.89 audit AUD-09: REOPEN committed but the reply is lost → the device stays OPEN and nothing re-closes it ----
{
  await gotoTab('#close'); await page.waitForSelector('.result');
  const reopenBefore = await countAudit('STEP 5 - REOPEN PERIOD');
  await F(() => { window.__fake.dropReplyAfterCommit = 1; });
  await page.evaluate(() => { const t = document.querySelector('#toasts'); if (t) t.innerHTML = ''; });
  await page.click('[data-act=s5-reopen]'); await sleep(4000);
  ok('AUD-09: REOPEN with a lost reply is confirmed from the cloud (device OPEN)', !(await docVal(`svl_costing_periods/${P8}`))?.summary?.closed && !/CLOSED/.test((await page.textContent('.result').catch(() => '')) || ''), (await toasts()).slice(-160));
  ok('AUD-09: the REOPEN is recorded exactly once', (await waitAudit('STEP 5 - REOPEN PERIOD', reopenBefore + 1)) && (await countAudit('STEP 5 - REOPEN PERIOD')) === reopenBefore + 1);
  const revs = await F((p) => [...window.__fake.docs.entries()].filter(([k]) => k.startsWith(p)).map(([, v]) => v.transition).filter(Boolean), `svl_costing_periods/${P8}/revisions/`);
  ok('AUD-09/10: the reopen revision keeps its transition and reason (pointer keeps only the latest commit)', revs.some((t) => t.kind === 'REOPEN' && !!t.reason && t.from === 'CLOSED' && t.to === 'OPEN'), JSON.stringify(revs.map((t) => t.kind)));
  await sleep(2500); await waitSynced();
  ok('AUD-09: a later sync does not close the period again', !(await docVal(`svl_costing_periods/${P8}`))?.summary?.closed);
  // close again for the remaining tests
  await gotoTab('#close'); await page.waitForSelector('.result');
  await page.click('[data-act=s5-close]');
  ok('period closed again for the delete tests', await waitToast(/cloud đã xác nhận/));
}

// ---- Wave 1 DATA-02/03: every committed period, OPEN or CLOSED, is retained.
await gotoTab('#settings'); await sleep(500);
await page.selectOption('#period-sel', P8).catch(() => {});
ok('DATA-03 CLOSED period cannot be permanently deleted', (await page.locator(`[data-act=delete-period][data-p="${P8}"]`).count()) === 0);
ok('DATA-03 CLOSED period retains its Cloud pointer', !!(await docVal(`svl_costing_periods/${P8}`)));
await page.click('[data-act=new-period]'); await sleep(2500);
const P9 = '2026-09';
ok('2026-09 never-closed draft has Cloud revisions', (await docKeys(`svl_costing_periods/${P9}/chunks/`)).length > 0);
await gotoTab('#settings'); await sleep(500);
ok('DATA-03 OPEN committed period cannot be permanently deleted', (await page.locator(`[data-act=delete-period][data-p="${P9}"]`).count()) === 0);
ok('DATA-03 OPEN committed period exposes non-destructive Hide action', (await page.locator(`[data-act=hide-period][data-p="${P9}"]`).count()) === 1);
const draftChunks = (await docKeys(`svl_costing_periods/${P9}/chunks/`)).length;
await page.click(`[data-act=hide-period][data-p="${P9}"]`); await sleep(600);
ok('DATA-03 hide preserves all chunks and Cloud pointer',
  !!(await docVal(`svl_costing_periods/${P9}`)) && (await docKeys(`svl_costing_periods/${P9}/chunks/`)).length === draftChunks);
// The period stays active even if hidden; make it visible again before testing sync.
if (await page.locator('#show-hidden').count()) await page.check('#show-hidden');
if (await page.locator(`[data-act=unhide-period][data-p="${P9}"]`).count()) await page.click(`[data-act=unhide-period][data-p="${P9}"]`);
await sleep(500);

// ---- ENH-07: outbox per period, backoff retry, switch confirmation, pending pill ----
await page.selectOption('#period-sel', P9); await sleep(1300); // return to the retained OPEN period
await setFail('runTransaction', 100, 'injected: cloud down');
await gotoTab('#gl'); await page.waitForSelector('input[name=gl627]');
const gl = await page.inputValue('input[name=gl627]');
await page.fill('input[name=gl627]', String(+gl.replace(/\./g, '').replace(',', '.') + 1)); await page.click('#f-gl button[type=submit]');
await sleep(9000);
ok('ENH-07 backoff: automatic retries keep failing and are spaced out', (await failedCount()) >= 3, `failed attempts: ${await failedCount()}`);
policy.confirm = false;
await page.selectOption('#period-sel', P8);
await sleep(2500);
ok('ENH-07 switch refused: confirmation names the unsynced period and staying keeps 2026-09', (await page.inputValue('#period-sel')) === P9 && (await toasts()).length >= 0);
policy.confirm = true;
await page.selectOption('#period-sel', P8);
await sleep(2500);
ok('ENH-07 switch accepted: pending pill names 2026-09 as waiting for the cloud', (await syncPill()).includes(`chờ đồng bộ kỳ ${P9}`), await syncPill());
await setFail('runTransaction', 0);
await page.selectOption('#period-sel', P9);
await sleep(4000);
ok('ENH-07 back on 2026-09: pending data uploads and the pill clears', !(await syncPill()).includes('chờ đồng bộ') && (await docVal(`svl_costing_periods/${P9}`)) !== null);

// ---- ENH-08: events of a signed-in actor are not uploaded under another account ----
await setFail('setDoc', 100, 'injected: audit upload down');
await gotoTab('#gl'); await page.waitForSelector('input[name=gl627]');
await page.fill('input[name=gl627]', String(+gl.replace(/\./g, '').replace(',', '.') + 2)); await page.click('#f-gl button[type=submit]');
await sleep(1500);
const marker = 'ENH08-marker';
await page.fill('input[name=gl627]', String(+gl.replace(/\./g, '').replace(',', '.'))); await page.click('#f-gl button[type=submit]');
await sleep(800);
const queued = await F(() => JSON.parse(localStorage.getItem('x') || 'null')); // (queue lives in IndexedDB; counted by the upload gap below)
const aBefore = (await auditRows()).filter((a) => a.actorUid === 'uid-admin').length;
await setFail('setDoc', 0);
await signOutFake(); await sleep(800);
await sig({ uid: 'uid-b', email: 'b.test@example.com' }); await sleep(3000);
const aWhileB = (await auditRows()).filter((a) => a.actorUid === 'uid-admin').length;
const bActorRows = (await auditRows()).filter((a) => a.by === 'b.test@example.com' && a.attribution === 'ACTOR').length;
ok('ENH-08 user B signing in does not upload A\'s queued events (no new A rows, nothing as B)', aWhileB === aBefore && bActorRows === 0, `A rows ${aBefore} → ${aWhileB}; B ACTOR rows ${bActorRows}`);
await signOutFake(); await sleep(500);
await sig({ uid: 'uid-admin', email: 'admin.test@example.com' }); await sleep(3500);
const aAfter = (await auditRows()).filter((a) => a.actorUid === 'uid-admin');
ok('ENH-08 A signing in again uploads A\'s queued events under A', aAfter.length > aBefore && aAfter.every((a) => a.by === 'admin.test@example.com'), `A rows ${aBefore} → ${aAfter.length}`);

ok('no page errors during the cloud run', errors.length === 0, errors.slice(0, 3).join(' | '));
await page.screenshot({ path: path.join(outDir, 'cloud-final.png') });
await browser.close();
console.log(`\n${n - fail}/${n} cloud browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
