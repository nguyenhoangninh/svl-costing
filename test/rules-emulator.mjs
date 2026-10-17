// v1.14.92 (audit SEC-05 / NEW-06): Firestore Rules checked by real writes on the Firestore Emulator, not by reading the
// rules text. Run in CI (e2e job) with:
//   npm i --no-save @firebase/rules-unit-testing@3 firebase@10.12.2
//   npx --yes firebase-tools@15.31.0 emulators:exec --only firestore --project demo-svl "node test/rules-emulator.mjs"
// The owner placeholder is replaced in memory only; the repository keeps YOUR_EMAIL@gmail.com.
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const OWNER = 'owner@svl.test', ADMIN = 'admin@svl.test', EDITOR = 'editor@svl.test', EDITOR2 = 'editor2@svl.test', VIEWER = 'viewer@svl.test';
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8').replace(/YOUR_EMAIL@gmail\.com/g, OWNER);
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-svl', firestore: { rules, host, port: Number(port) } });

let total = 0, fail = 0;
const check = async (label, p) => { total++; try { await p; console.log(`✓ ${label}`); } catch (e) { fail++; console.log(`✗ ${label} — ${e && e.message ? e.message.split('\n')[0] : e}`); } };
const db = (email, verified = true) => env.authenticatedContext(email.replace(/\W/g, '_'), { email, email_verified: verified }).firestore();
const anon = env.unauthenticatedContext().firestore();

const P = '2026-08', P_CLOSED = '2026-07';
const OPEN_SUMMARY = { closed: null, everClosed: false, step5: 'PASS' };
const blobs = { step5: 'h1', register: 'h2' };
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const f = c.firestore();
    await setDoc(doc(f, 'svl_costing_config/access'), { members: { [ADMIN]: 'admin', [EDITOR]: 'editor', [EDITOR2]: 'editor', [VIEWER]: 'viewer' } });
    await setDoc(doc(f, `svl_costing_periods/${P}`), { rev: 3, summary: OPEN_SUMMARY, blobs, manifestHash: 'm3', updatedBy: EDITOR, updatedAt: 't3' });
    await setDoc(doc(f, `svl_costing_periods/${P}/chunks/c1`), { data: 'x' });
    await setDoc(doc(f, `svl_costing_periods/${P_CLOSED}`), { rev: 5, summary: { closed: { by: ADMIN }, everClosed: true, step5: 'CLOSED' }, blobs: { ...blobs, closed: 'hc' }, manifestHash: 'm5', updatedBy: ADMIN, updatedAt: 't5' });
    await setDoc(doc(f, `svl_costing_periods/${P}/revisions/3`), { rev: 3, period: P, by: EDITOR });
    await setDoc(doc(f, 'svl_costing_audit/a1'), { by: EDITOR, what: 'x' });
  });
}
const next = (over = {}) => ({ rev: 4, summary: OPEN_SUMMARY, blobs, manifestHash: 'm4', updatedBy: EDITOR, updatedAt: 't4', ...over });

await seed();
// ---- who can read
await check('signed-out user cannot read a period', assertFails(getDoc(doc(anon, `svl_costing_periods/${P}`))));
await check('unverified email cannot read a period', assertFails(getDoc(doc(db(VIEWER, false), `svl_costing_periods/${P}`))));
await check('stranger (not in the access list) cannot read a period', assertFails(getDoc(doc(db('x@other.test'), `svl_costing_periods/${P}`))));
await check('viewer can read a period', assertSucceeds(getDoc(doc(db(VIEWER), `svl_costing_periods/${P}`))));
// ---- access list
await check('editor cannot change the access list', assertFails(setDoc(doc(db(EDITOR), 'svl_costing_config/access'), { members: { [EDITOR]: 'admin' } })));
await check('owner (named in the rules) can change the access list', assertSucceeds(setDoc(doc(db(OWNER), 'svl_costing_config/access'), { members: { [ADMIN]: 'admin', [EDITOR]: 'editor', [EDITOR2]: 'editor', [VIEWER]: 'viewer', 'new@svl.test': 'viewer' } })));
// ---- OPEN period work
await check('viewer cannot save a period', assertFails(setDoc(doc(db(VIEWER), `svl_costing_periods/${P}`), next({ updatedBy: VIEWER }))));
await check('editor saves the next revision (rev + 1)', assertSucceeds(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}`), next())));
await seed();
await check('editor cannot skip a revision (rev + 2)', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}`), next({ rev: 5 }))));
await check('editor cannot overwrite with a stale revision (same rev)', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}`), next({ rev: 3 }))));
await check('editor creates a new OPEN period at rev 1', assertSucceeds(setDoc(doc(db(EDITOR), 'svl_costing_periods/2026-09'), next({ rev: 1 }))));
await check('editor cannot create a period already CLOSED', assertFails(setDoc(doc(db(EDITOR), 'svl_costing_periods/2026-10'), next({ rev: 1, summary: { closed: { by: EDITOR }, everClosed: true, step5: 'CLOSED' } }))));
// ---- CLOSE / REOPEN
const closeDoc = next({ summary: { closed: { by: ADMIN }, everClosed: true, step5: 'CLOSED' }, blobs: { ...blobs, closed: 'hc' }, updatedBy: ADMIN });
await check('editor cannot CLOSE a period', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}`), { ...closeDoc, updatedBy: EDITOR })));
await check('admin can CLOSE a period', assertSucceeds(setDoc(doc(db(ADMIN), `svl_costing_periods/${P}`), closeDoc)));
await seed();
const reopen = { rev: 6, summary: { closed: null, everClosed: true, step5: 'PASS' }, blobs, manifestHash: 'm5', updatedBy: ADMIN, updatedAt: 't6' };
await check('editor cannot save into a CLOSED period', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P_CLOSED}`), { ...reopen, summary: { closed: { by: ADMIN }, everClosed: true, step5: 'CLOSED' }, blobs: { ...blobs, closed: 'hc' }, updatedBy: EDITOR })));
await check('editor cannot REOPEN', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P_CLOSED}`), { ...reopen, updatedBy: EDITOR })));
await check('admin REOPEN that also changes an accounting blob is refused', assertFails(setDoc(doc(db(ADMIN), `svl_costing_periods/${P_CLOSED}`), { ...reopen, blobs: { step5: 'CHANGED', register: 'h2' } })));
await check('admin REOPEN that lowers everClosed is refused', assertFails(setDoc(doc(db(ADMIN), `svl_costing_periods/${P_CLOSED}`), { ...reopen, summary: { closed: null, everClosed: false, step5: 'PASS' } })));
await check('admin REOPEN removing only the closed blob succeeds', assertSucceeds(setDoc(doc(db(ADMIN), `svl_costing_periods/${P_CLOSED}`), reopen)));
await seed();
await check('everClosed cannot be lowered by a later save of a reopened period', (async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), `svl_costing_periods/${P_CLOSED}`), reopen));
  await assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P_CLOSED}`), { ...reopen, rev: 7, summary: { closed: null, everClosed: false, step5: 'PASS' }, updatedBy: EDITOR }));
})());
// ---- nothing is deleted, chunks are immutable
await seed();
await check('admin cannot delete a period pointer', assertFails(deleteDoc(doc(db(ADMIN), `svl_costing_periods/${P}`))));
await check('owner cannot delete a period pointer', assertFails(deleteDoc(doc(db(OWNER), `svl_costing_periods/${P}`))));
await check('admin cannot delete a chunk', assertFails(deleteDoc(doc(db(ADMIN), `svl_costing_periods/${P}/chunks/c1`))));
await check('editor cannot rewrite a chunk in place', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}/chunks/c1`), { data: 'y' })));
await check('editor adds a new chunk to an OPEN period', assertSucceeds(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}/chunks/c2`), { data: 'z' })));
await check('editor cannot add a chunk to a CLOSED period', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P_CLOSED}/chunks/c9`), { data: 'z' })));
// ---- revision manifest written in the same commit as the pointer
await check('revision written with the pointer in one batch, matching it', assertSucceeds((async () => {
  const f = db(EDITOR), b = writeBatch(f), n = next();
  b.set(doc(f, `svl_costing_periods/${P}`), n);
  b.set(doc(f, `svl_costing_periods/${P}/revisions/4`), { rev: 4, previousRev: 3, period: P, by: EDITOR, manifestHash: n.manifestHash, blobs: n.blobs, summary: n.summary });
  await b.commit();
})()));
await seed();
await check('revision whose blobs differ from the pointer is refused', assertFails((async () => {
  const f = db(EDITOR), b = writeBatch(f), n = next();
  b.set(doc(f, `svl_costing_periods/${P}`), n);
  b.set(doc(f, `svl_costing_periods/${P}/revisions/4`), { rev: 4, previousRev: 3, period: P, by: EDITOR, manifestHash: n.manifestHash, blobs: { step5: 'OTHER' }, summary: n.summary });
  await b.commit();
})()));
await check('revision signed with another user is refused', assertFails((async () => {
  const f = db(EDITOR), b = writeBatch(f), n = next();
  b.set(doc(f, `svl_costing_periods/${P}`), n);
  b.set(doc(f, `svl_costing_periods/${P}/revisions/4`), { rev: 4, previousRev: 3, period: P, by: ADMIN, manifestHash: n.manifestHash, blobs: n.blobs, summary: n.summary });
  await b.commit();
})()));
await check('a revision document cannot be changed or deleted', Promise.all([
  assertFails(setDoc(doc(db(ADMIN), `svl_costing_periods/${P}/revisions/3`), { rev: 3, period: P, by: ADMIN })),
  assertFails(deleteDoc(doc(db(ADMIN), `svl_costing_periods/${P}/revisions/3`))),
]));
// ---- audit trail
await check('editor adds an audit event in their own name', assertSucceeds(setDoc(doc(db(EDITOR), 'svl_costing_audit/a2'), { by: EDITOR, what: 'RUN' })));
await check('audit event in someone else\'s name is refused', assertFails(setDoc(doc(db(EDITOR), 'svl_costing_audit/a3'), { by: ADMIN, what: 'RUN' })));
await check('ACTOR audit event must carry the signed-in uid', assertFails(setDoc(doc(db(EDITOR), 'svl_costing_audit/a4'), { by: EDITOR, attribution: 'ACTOR', actorUid: 'someone', actorEmail: EDITOR })));
await check('audit events cannot be changed or deleted', Promise.all([
  assertFails(setDoc(doc(db(ADMIN), 'svl_costing_audit/a1'), { by: ADMIN, what: 'edited' })),
  assertFails(deleteDoc(doc(db(OWNER), 'svl_costing_audit/a1'))),
]));
// ---- maker–checker approvals (STEP 5R manual unit cost)
const req = (email) => ({ status: 'REQUESTED', requestedByEmail: email, requestedByUid: email.replace(/\W/g, '_'), approvedByEmail: '', canonical: 'k', values: { unitCost: 10 } });
await check('editor requests an approval', assertSucceeds(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}/approvals/r1`), req(EDITOR))));
const appr = (email) => ({ ...req(EDITOR), status: 'APPROVED', approvedByEmail: email, approvedByUid: email.replace(/\W/g, '_') });
await check('requester cannot approve their own request', assertFails(setDoc(doc(db(EDITOR), `svl_costing_periods/${P}/approvals/r1`), appr(EDITOR))));
await check('approval cannot change the requested values', assertFails(setDoc(doc(db(EDITOR2), `svl_costing_periods/${P}/approvals/r1`), { ...appr(EDITOR2), values: { unitCost: 99 } })));
await check('another editor approves', assertSucceeds(setDoc(doc(db(EDITOR2), `svl_costing_periods/${P}/approvals/r1`), appr(EDITOR2))));
// ---- private read state
await check('a user cannot read another user\'s notification read state', assertFails(getDoc(doc(db(EDITOR), `svl_costing_notification_reads/${'viewer@svl.test'.replace(/\W/g, '_')}`))));

await env.cleanup();
console.log(`\n${total - fail}/${total} Firestore Emulator rules checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
