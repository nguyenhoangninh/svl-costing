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
ok('Cloud period hard deletion disabled for all committed revisions', rules.includes('match /svl_costing_periods/{period}') && rules.slice(rules.indexOf('match /svl_costing_periods/{period}'), rules.indexOf('match /chunks/{chunk}')).includes('allow delete: if false;'));
ok('content-addressed chunks are create-only and undeletable by clients', rules.includes('allow create: if canWrite() && periodOpen(period);') && rules.slice(rules.indexOf('match /chunks/{chunk}'), rules.indexOf('match /revisions/{revision}')).includes('allow update: if false;') && rules.slice(rules.indexOf('match /chunks/{chunk}'), rules.indexOf('match /revisions/{revision}')).includes('allow delete: if false;'));
ok('old CLOSED chunk exception removed', !rules.includes("chunk.matches('closed@.*')"));
ok('revision rev bound to parent', rules.includes('request.resource.data.rev == getAfter(periodPath(period)).data.rev'));
ok('revision hash bound to parent', rules.includes('request.resource.data.manifestHash == getAfter(periodPath(period)).data.manifestHash'));
ok('revision blob manifest exactly equals parent', rules.includes('request.resource.data.blobs == getAfter(periodPath(period)).data.blobs'));
ok('revision summary exactly equals parent', rules.includes('request.resource.data.summary == getAfter(periodPath(period)).data.summary'));
ok('revision documents immutable', /match \/revisions\/\{revision\}[\s\S]*allow update, delete: if false;/.test(rules));
ok('audit events immutable', /match \/svl_costing_audit\/\{id\}[\s\S]*allow update, delete: if false;/.test(rules));
ok('owner email is a placeholder (public repo – real email only in the Firebase console)', rules.includes("myEmail() in ['YOUR_EMAIL@gmail.com']") && !/@gmail\.com'\]/.test(rules.replace("'YOUR_EMAIL@gmail.com'", '')));
ok('cloudSave preserves everClosed after close/reopen', store.includes('safeSummary.everClosed = true'));
ok('cloudDelete refuses to remove any Cloud pointer', store.includes('if (meta || revs.length) throw new Error('));
ok('cloudDelete checks retained revision history even if Cloud pointer is missing', store.includes('cloudRevisions(period, 1)'));
ok('close persists local closedEver retention state', phase3.includes('d.closedEver = true'));
ok('close snapshots exception package', phase3.includes('exceptions'));
ok('CLOSE has cloud-state preflight', phase3.includes("Cloud đã ghi kỳ này là CLOSED"));
ok('REOPEN has cloud-state preflight', phase3.includes("Cloud đang ở trạng thái OPEN"));
ok('permission error gives rules/admin guidance', phase3.includes('Publish firestore.rules mới nhất') && phase3.includes('Quản trị'));
ok('REOPEN revision changes only closed / everClosed (accepted by every published rules version)', app.includes('closed: null, everClosed: true }') && !app.includes('step5: live.step5'));

// Wave 1 (v1.14.90): local snapshot and period dependency controls.
ok('DATA-01: Cloud Pull uses one atomic IndexedDB replacement', app.includes('await store.localReplacePeriod(p, blobsOf(d), r.meta)') && store.includes("d.transaction('kv', 'readwrite')") && store.includes("store.getAllKeys(IDBKeyRange.bound(prefix"));
ok('DATA-04: REOPEN checks next-period Cloud state inside transaction', store.includes("opts.transition.kind === 'REOPEN'") && store.includes('await t.get(pdoc(nextPeriod))'));
ok('DATA-04: CLOSE checks preceding period revision inside transaction', store.includes("opts.transition.kind === 'CLOSE'") && store.includes('actual !== opts.transition.sourceRev'));
// v1.14.35 (audit wave 2)
const appJs = app;
ok('ENH-08 audit ACTOR events must match the signed-in uid and email', rules.includes("get('attribution', 'LEGACY') != 'ACTOR'") && rules.includes('actorUid == request.auth.uid') && rules.includes('actorEmail == myEmail()'));
ok('ENH-08 audit documents are keyed by event id (idempotent upload)', store.includes('fb.F.doc(fb.fs, AUDIT, e.eventId)') && store.includes('if (!ex.exists())'));
ok('ENH-08 actor is captured at event time, not at upload', store.includes('const actor = cloud.user ? { uid: cloud.user.uid'));
ok('DATA-03: no destructive Cloud pointer removal or chunk sweep', !store.includes('t.delete(pdoc(period))') && !store.includes('sweepChunks('));
ok('DATA-02: chunk deletion denied by Rules', rules.slice(rules.indexOf('match /chunks/{chunk}'), rules.indexOf('match /revisions/{revision}')).includes('allow delete: if false;'));
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
ok('ENH-09 / AUD-01 close success confirmed from the cloud pointer (transition id; close timestamp for older pointers)', phase3Js.includes("SP.transitionOutcome({ ok: r.ok, skipped: r.skipped, writtenId: r.writtenId, meta, metaError, id: trId, kind: 'CLOSE' })") && phase3Js.includes('SP.closeCommitted(meta, d.closed.closedAt)'));
ok('ENH-10 CLOSE re-reads the previous period before the gate', phase3Js.includes('if (A.refreshPrevDrift) await A.refreshPrevDrift();'));
ok('ENH-10 previous period reopened after roll-forward is a drift', app.includes('op.closedAt && !isClosedIn(prevD, p)'));

// v1.14.37 (found by the browser cloud run)
// v1.14.81 (AUD-05): a failed commit never deletes chunks (another session may have reused and committed them)
const saveBody = store.slice(store.indexOf('export async function cloudSave'), store.indexOf('export async function', store.indexOf('export async function cloudSave') + 10));
ok('cloud save never deletes chunks, even after a failed commit', saveBody.length > 0 && !saveBody.includes('deleteDoc(cdoc('));
// v1.14.81 (AUD-07): a sync with the same manifest and summary writes no revision
ok('no-op sync writes no revision (NO_CHANGE)', saveBody.includes('if (cur && !changed && !opts.forceRevision && !opts.transition) return { ...cur, noChange: true };') && saveBody.indexOf('noChange: true') < saveBody.indexOf('commitRevision('));
// v1.14.81 (AUD-04): everClosed is one-way on every update, not only on REOPEN
ok('rules: everClosed cannot be lowered by any update', rules.includes('function keepsEverClosed()') && /allow update: if canWrite\(\) && request\.resource\.data\.rev == resource\.data\.get\('rev', 0\) \+ 1\s*&& keepsEverClosed\(\)/.test(rules));

// v1.14.41 (maker–checker for STEP 5R manual unit costs, rules-based; no Cloud Functions on the Spark plan)
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
ok('approval receipts: any editor requests, stamped with the signed-in requester', /match \/approvals\/\{approval\}[\s\S]*requestedByEmail == myEmail\(\)[\s\S]*requestedByUid == request\.auth\.uid/.test(rules));
ok('approval receipts: only a DIFFERENT signed-in user approves, and values cannot change', rules.includes('myEmail() != resource.data.requestedByEmail') && rules.includes('request.resource.data.values == resource.data.values') && rules.includes('request.resource.data.approvedByUid == request.auth.uid'));
ok('approval receipts are frozen once the period is CLOSED', /match \/approvals\/\{approval\}[\s\S]*allow create: if canWrite\(\) && periodOpen\(period\)/.test(rules));
ok('approval receipts: only the requester or an admin may delete', rules.includes('resource.data.requestedByEmail == myEmail() || isAdmin()'));
ok('approval writes go through one transaction helper with the same identity rules', store.includes('export async function cloudWriteApproval') && store.includes('decideApprovalWrite(') && store.includes('runTransaction(fb.fs'));
ok('STEP 5R counts only approved receipts (effective matches feed RUN FIFO and the stale key)', phase3.includes('export function effectiveReturnMatches') && phase3.includes('returnMatches: effectiveReturnMatches(S)') && phase3.includes('Object.entries(effectiveReturnMatches(S))'));
ok('an entry with both an invoice and a manual cost is refused before a request goes out', phase3.includes('Đang có cả hoá đơn gốc và đơn giá'));
ok('no Cloud Functions / callable code remains (Spark plan)', !store.includes('httpsCallable') && !app.includes('callFn') && !phase3.includes('httpsCallable') && !fs.existsSync(new URL('../functions', import.meta.url)));
ok('approval module is precached for offline use', sw.includes("'./src/engine/approvals.js'"));

// v1.14.43 Live Notifications (atomic revision event + private read state)
ok('Notifications: event bound to a committed period revision',
  rules.includes("getAfter(periodPath(request.resource.data.period)).data.rev == request.resource.data.rev")
  && store.includes("if (includeNotice) t.set("));
ok('Notifications: event actor bound to signed-in user',
  rules.includes('request.resource.data.actorUid == request.auth.uid')
  && rules.includes('request.resource.data.actor == myEmail()'));
ok('Notifications: immutable history and role protected',
  rules.includes('match /svl_costing_notifications/{id}')
  && rules.slice(rules.indexOf('match /svl_costing_notifications/{id}'), rules.indexOf('match /svl_costing_notification_reads/{uid}')).includes('allow update, delete: if false;'));
ok('Notifications: read state only accessible to owner',
  rules.includes('match /svl_costing_notification_reads/{uid}')
  && rules.includes('request.auth.uid == uid'));
ok('Notifications: listeners query committed stream not uncommitted audit log',
  store.includes("F.collection(fb.fs, 'svl_costing_notifications')")
  && store.includes("F.orderBy('createdAt', 'desc')"));

// v1.14.42 (Firestore rules published by CI from main; placeholder replaced only in the runner copy)
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const firebaseJson = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
ok('firebase.json deploys firestore.rules only', firebaseJson.firestore && firebaseJson.firestore.rules === 'firestore.rules');
ok('rules job runs only on push to main, after checks and the synthetic browser period (v1.14.87)', /rules:\s*\n\s*needs: \[checks, e2e\]\s*\n\s*if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/.test(ci));
ok('rules job pins firebase-tools (no floating version)', /firebase-tools@\d+\.\d+\.\d+ deploy --only firestore:rules --project svl-costing/.test(ci));
ok('rules job refuses to publish while the placeholder is present', ci.includes('Placeholder vẫn còn trong firestore.rules') && ci.includes('grep -q "YOUR_EMAIL@gmail.com" firestore.rules'));
ok('rules job never commits the owner email (runner copy only)', !/git (add|commit|push)/.test(ci.slice(ci.indexOf('  rules:'))));

console.log(`\n${total - fail}/${total} Firestore/accounting retention contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
