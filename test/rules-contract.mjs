import fs from 'node:fs';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++; };
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../src/store.js', import.meta.url), 'utf8');
const phase3 = fs.readFileSync(new URL('../src/views/phase3.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

ok('explicit admin CLOSE transition exists', rules.includes("isAdmin() && closedOf(resource.data) == null && closedOf(request.resource.data) != null"));
ok('closed period REOPEN changes only closed manifest key', rules.includes("affectedKeys().hasOnly(['closed'])"));
ok('REOPEN summary permits closed + everClosed + live step5 status', rules.includes("affectedKeys().hasOnly(['closed', 'everClosed', 'step5'])"));
ok('reopen preserves everClosed=true', rules.includes("request.resource.data.summary.get('everClosed', false) == true"));
ok('hard delete blocked after everClosed', rules.includes("get('everClosed', false) != true"));
ok('content-addressed chunks are create-only', rules.includes('allow create: if canWrite() && periodOpen(period);') && rules.includes('allow update: if false;'));
ok('old CLOSED chunk exception removed', !rules.includes("chunk.matches('closed@.*')"));
ok('revision rev bound to parent', rules.includes('request.resource.data.rev == getAfter(periodPath(period)).data.rev'));
ok('revision hash bound to parent', rules.includes('request.resource.data.manifestHash == getAfter(periodPath(period)).data.manifestHash'));
ok('revision blob manifest exactly equals parent', rules.includes('request.resource.data.blobs == getAfter(periodPath(period)).data.blobs'));
ok('revision summary exactly equals parent', rules.includes('request.resource.data.summary == getAfter(periodPath(period)).data.summary'));
ok('revision documents immutable', /match \/revisions\/\{revision\}[\s\S]*allow update, delete: if false;/.test(rules));
ok('audit events immutable', /match \/svl_costing_audit\/\{id\}[\s\S]*allow update, delete: if false;/.test(rules));
ok('owner email is a placeholder (public repo – real email only in the Firebase console)', rules.includes("myEmail() in ['YOUR_EMAIL@gmail.com']") && !/@gmail\.com'\]/.test(rules.replace("'YOUR_EMAIL@gmail.com'", '')));
ok('cloudSave preserves everClosed after close/reopen', store.includes('safeSummary.everClosed = true'));
ok('cloudDelete checks everClosed metadata', store.includes('meta.summary.everClosed'));
ok('cloudDelete checks historical closed revision', store.includes('r.summary && r.summary.closed'));
ok('close persists local closedEver retention state', phase3.includes('d.closedEver = true'));
ok('close snapshots exception package', phase3.includes('exceptions'));
ok('CLOSE has cloud-state preflight', phase3.includes("Cloud đã ghi kỳ này là CLOSED"));
ok('REOPEN has cloud-state preflight', phase3.includes("Cloud đang ở trạng thái OPEN"));
ok('permission error gives rules/admin guidance', phase3.includes('Publish firestore.rules mới nhất') && phase3.includes('Quản trị'));
ok('REOPEN revision changes only closed / everClosed (accepted by every published rules version)', app.includes('closed: null, everClosed: true }') && !app.includes('step5: live.step5'));

// v1.14.35 (audit wave 2)
const appJs = app;
ok('ENH-08 audit ACTOR events must match the signed-in uid and email', rules.includes("get('attribution', 'LEGACY') != 'ACTOR'") && rules.includes('actorUid == request.auth.uid') && rules.includes('actorEmail == myEmail()'));
ok('ENH-08 audit documents are keyed by event id (idempotent upload)', store.includes('fb.F.doc(fb.fs, AUDIT, e.eventId)') && store.includes('if (!ex.exists())'));
ok('ENH-08 actor is captured at event time, not at upload', store.includes('const actor = cloud.user ? { uid: cloud.user.uid'));
ok('ENH-04 cloudDelete removes the pointer in a transaction before sweeping chunks', store.indexOf('t.delete(pdoc(period))') > 0 && store.indexOf('t.delete(pdoc(period))') < store.indexOf('await sweepChunks(period, {});', store.indexOf('export async function cloudDelete')));
ok('ENH-04 cloudDelete refuses to sweep under a pointer saved meanwhile', store.includes('vừa được lưu lại trên cloud trong lúc xoá'));
ok('ENH-05 render has no offline bypass for local accounting data', !appJs.includes('!store.cloud.offline') && appJs.includes('(store.cloud.enabled && !store.cloud.user)'));

// v1.14.36 (audit wave 3)
const phase3Js = phase3;
const fgprodJs = fs.readFileSync(new URL('../src/views/fgprod.js', import.meta.url), 'utf8');
ok('ENH-07 automatic push retries with backoff and stops after the limit', app.includes('SP.retryDelayMs(retryN)') && app.includes('SP.shouldRetry(retryN)'));
ok('ENH-07 status names other periods still waiting for the cloud', app.includes('chờ đồng bộ kỳ') && app.includes('SP.outboxOthers(S.outbox, S.period)'));
ok('ENH-07 period being left is pushed before switching (user decides on failure)', app.includes('const r = await syncNow();\n    if (!r.ok && !r.skipped && !confirm(`Kỳ ${S.period} CHƯA lên được cloud'));
ok('ENH-09 FG posting is deferred until the close is committed', fgprodJs.includes('defer = false') && phase3Js.includes('{ silent: true, defer: true }'));
ok('ENH-09 close audit lines are written only after the cloud commit', (() => { const a = phase3Js.indexOf('export async function doClose'); const b = phase3Js.indexOf('export async function doReopen'); const seg = phase3Js.slice(a, b); return seg.indexOf('await A.syncNow()') > 0 && seg.lastIndexOf('for (const [a, t] of trail) A.audit(a, t);') > seg.indexOf('await A.syncNow()'); })());
ok('ENH-09 failed close rolls back the FG posting as well', phase3Js.includes('d.fgProd = before.fgProd;'));
ok('ENH-09 close success confirmed by the close timestamp (no double apply)', phase3Js.includes('SP.closeCommitted(await A.cloudMeta(S.period)'));
ok('ENH-10 CLOSE re-reads the previous period before the gate', phase3Js.includes('if (A.refreshPrevDrift) await A.refreshPrevDrift();'));
ok('ENH-10 previous period reopened after roll-forward is a drift', app.includes('op.closedAt && !isClosedIn(prevD, p)'));

console.log(`\n${total - fail}/${total} Firestore/accounting retention contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
