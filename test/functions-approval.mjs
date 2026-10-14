// Unit checks for the server-side approval logic (functions/src/approvalCore.mjs) against an in-memory Firestore-like adapter.
// This exercises the real functions code paths (roles, maker≠checker, canonical binding, closed periods, idempotency).
// It does NOT prove the Firestore rules or the deployed Cloud Functions; see the PR notes.
import * as C from '../functions/src/approvalCore.mjs';

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function memDb(seed = {}) {
  const docs = new Map(Object.entries(seed).map(([k, v]) => [k, clone(v)]));
  const snap = (p) => ({ exists: docs.has(p), data: () => clone(docs.get(p)) });
  const ref = (p) => ({ path: p, get: async () => snap(p), set: async (d) => { docs.set(p, clone(d)); } });
  return {
    docs,
    doc: (p) => ref(p),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = { get: async (r) => snap(r.path), set: (r, d) => writes.push([r.path, d]) };
      const out = await fn(tx);
      for (const [p, d] of writes) docs.set(p, clone(d));
      return out;
    },
  };
}
const auth = (email, uid = 'uid-' + email.split('@')[0]) => ({ uid, token: { email } });
const OWNERS = ['owner@example.com'];
const ACCESS = { members: { 'ed@example.com': 'editor', 'vi@example.com': 'viewer', 'ad@example.com': 'admin' } };
const P = '2026-09';
const VAL = { origInv: 'INV-100', unitCost: 1234.5, note: 'Căn cứ: đơn giá nhập trước kỳ web' };
const base = () => memDb({ 'svl_costing_config/access': ACCESS, [`svl_costing_periods/${P}`]: { rev: 3, summary: { closed: null } } });
const req = (db, who, values = VAL, extra = {}) => C.requestApproval({ db, auth: who, owners: OWNERS, now: '2026-10-14T04:00:00Z', data: { period: P, action: C.ACTION_MANUAL_COST, key: 'R-1', values, ...extra } });
const apr = (db, who, canonical, extra = {}) => C.approveApproval({ db, auth: who, owners: OWNERS, now: '2026-10-14T04:05:00Z', data: { period: P, action: C.ACTION_MANUAL_COST, key: 'R-1', canonical, ...extra } });
const RID = `svl_costing_periods/${P}/approvals/${C.approvalDocId(C.ACTION_MANUAL_COST, 'R-1')}`;
const codeOf = async (p) => { try { await p; return 'ok'; } catch (e) { return e.code || 'error'; } };
const canon = C.canonicalManualCost(VAL);

// canonical binding
ok('canonical ignores surrounding spaces and sub-micro rounding', C.canonicalManualCost({ origInv: '  INV-100 ', unitCost: 1234.5000004, note: ' Căn cứ: đơn giá nhập trước kỳ web ' }) === canon);
ok('canonical changes when the unit cost changes', C.canonicalManualCost({ ...VAL, unitCost: 1234.6 }) !== canon);
ok('approval doc id is path-safe', C.approvalDocId('X', 'a/b c') === 'X__a_b_c');

// maker
{ const db = base(); const r = await req(db, auth('ed@example.com'), VAL, { requestedByEmail: 'someone-else@x.com', requestedByUid: 'forged' });
  const rec = db.docs.get(RID);
  ok('editor request is recorded as REQUESTED', r.status === 'REQUESTED' && rec.status === 'REQUESTED');
  ok('requester identity comes from auth, not from the client payload', rec.requestedByEmail === 'ed@example.com' && rec.requestedByUid === 'uid-ed');
  ok('receipt keeps the exact canonical text and a SHA-256 fingerprint', rec.canonical === canon && /^[0-9a-f]{64}$/.test(rec.fingerprint));
}
ok('viewer cannot request approval', (await codeOf(req(base(), auth('vi@example.com')))) === 'permission-denied');
ok('anonymous request refused', (await codeOf(req(base(), null))) === 'unauthenticated');
ok('invalid note refused', (await codeOf(req(base(), auth('ed@example.com'), { ...VAL, note: 'x' }))) === 'invalid-argument');
ok('invalid period refused', (await codeOf(C.requestApproval({ db: base(), auth: auth('ed@example.com'), owners: OWNERS, now: 'n', data: { period: '2026/09', action: C.ACTION_MANUAL_COST, key: 'R-1', values: VAL } }))) === 'invalid-argument');
{ const db = memDb({ 'svl_costing_config/access': ACCESS, [`svl_costing_periods/${P}`]: { rev: 9, summary: { closed: '2026-09-30T10:00:00Z' } } });
  ok('closed period: no approval changes', (await codeOf(req(db, auth('ed@example.com')))) === 'failed-precondition'); }

// checker
{ const db = base(); await req(db, auth('ed@example.com'));
  ok('maker cannot approve own request (same uid)', (await codeOf(apr(db, auth('ed@example.com'), canon))) === 'permission-denied');
  const twin = { uid: 'another-uid', token: { email: 'ed@example.com' } };
  ok('same email under another uid is still the maker', (await codeOf(apr(db, twin, canon))) === 'permission-denied');
  ok('viewer cannot approve', (await codeOf(apr(db, auth('vi@example.com'), canon))) === 'permission-denied');
  ok('approval of different values refused', (await codeOf(apr(db, auth('ad@example.com'), C.canonicalManualCost({ ...VAL, unitCost: 1 })))) === 'failed-precondition');
  ok('approval without canonical text refused', (await codeOf(apr(db, auth('ad@example.com'), undefined))) === 'invalid-argument');
  const r = await apr(db, auth('ad@example.com'), canon);
  const rec = db.docs.get(RID);
  ok('another editor/admin approves the exact values', r.status === 'APPROVED' && rec.status === 'APPROVED');
  ok('approver identity recorded from auth', rec.approvedByEmail === 'ad@example.com' && rec.approvedByUid === 'uid-ad');
  ok('approving again is refused (no pending request)', (await codeOf(apr(db, auth('ad@example.com'), canon))) === 'failed-precondition');
  ok('re-requesting identical values keeps the approval', (await req(db, auth('ed@example.com'))).unchanged === true && db.docs.get(RID).status === 'APPROVED');
  await req(db, auth('ed@example.com'), { ...VAL, unitCost: 1500 });
  ok('changed values after approval replace it with a new pending request', db.docs.get(RID).status === 'REQUESTED' && db.docs.get(RID).canonical !== canon);
  ok('the old approval cannot be replayed on the changed values', (await codeOf(apr(db, auth('ad@example.com'), canon))) === 'failed-precondition');
}
{ const db = base(); await req(db, auth('ed@example.com'));
  ok('owner can approve without a members entry', (await apr(db, auth('owner@example.com'), canon)).status === 'APPROVED'); }
{ const db = base(); await req(db, auth('ed@example.com'));
  const closed = memDb({ ...Object.fromEntries(db.docs), [`svl_costing_periods/${P}`]: { rev: 4, summary: { closed: '2026-09-30T10:00:00Z' } } });
  ok('approval refused once the period is CLOSED', (await codeOf(apr(closed, auth('ad@example.com'), canon))) === 'failed-precondition'); }

console.log(`\n${n - fail}/${n} server approval checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
