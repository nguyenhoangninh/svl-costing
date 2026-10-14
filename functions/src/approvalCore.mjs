// Server-side approvals for manual cost / maker–checker (audit ENH-06, v1.14.38).
// Pure logic shared by the Cloud Functions (functions/index.mjs) and the browser (src/views/phase3.js imports the
// canonical helpers). It talks to Firestore only through a tiny adapter so it can run against firebase-admin in production
// and against an in-memory adapter in tests:
//   db.doc(path) → { get(): snapshot, set(data) }      db.runTransaction(async tx => …) with tx.get(ref), tx.set(ref, data)
// Snapshots may expose exists / data() as a boolean property (admin SDK) or as functions (client SDK): both are accepted.

export const ACTION_MANUAL_COST = 'RETURN_MANUAL_COST';
const ACTIONS = new Set([ACTION_MANUAL_COST]);
export const ACCESS_PATH = 'svl_costing_config/access';
const PERIOD_RE = /^\d{4}-\d{2}$/;

const err = (code, message) => Object.assign(new Error(message), { code });
const lower = (s) => String(s || '').trim().toLowerCase();

/** Stable document id of one approval (action + line key). */
export function approvalDocId(action, key) { return `${action}__${String(key).replace(/[^A-Za-z0-9_.-]/g, '_')}`; }

/**
 * Canonical text of the values a manual cost approval covers. Both the browser (to decide whether the approval still
 * matches the entry) and the server (to store and compare) use exactly this function.
 */
export function canonicalManualCost(v) {
  const unit = Math.round((Number(v && v.unitCost) || 0) * 1e6) / 1e6;
  return JSON.stringify([String((v && v.origInv) ?? '').trim(), unit, String((v && v.note) ?? '').trim()]);
}

export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const exists = (s) => (typeof s.exists === 'function' ? s.exists() : !!s.exists);
const dataOf = (s) => (exists(s) ? (typeof s.data === 'function' ? s.data() : s.data) : undefined);

/** Role of an email: owners are admins; otherwise the members map of svl_costing_config/access. */
export async function roleOf(db, email, owners) {
  if ((owners || []).map(lower).includes(lower(email))) return 'admin';
  const acc = await db.doc(ACCESS_PATH).get();
  const members = (exists(acc) && dataOf(acc) && dataOf(acc).members) || {};
  return members[lower(email)] || '';
}

function callerOf(auth) {
  if (!auth || !auth.uid) throw err('unauthenticated', 'Cần đăng nhập.');
  const email = lower(auth.token && auth.token.email);
  if (!email) throw err('unauthenticated', 'Tài khoản không có email.');
  return { uid: String(auth.uid), email };
}
function checkPeriod(period) {
  if (!PERIOD_RE.test(String(period || ''))) throw err('invalid-argument', 'Kỳ phải dạng YYYY-MM.');
}
function checkKey(key) {
  const k = String(key || '');
  if (!k || k.length > 200) throw err('invalid-argument', 'Mã dòng không hợp lệ.');
  return k;
}
function manualValues(v) {
  const origInv = String((v && v.origInv) ?? '').trim();
  const unitCost = Number(v && v.unitCost);
  const note = String((v && v.note) ?? '').trim();
  if (origInv.length > 100) throw err('invalid-argument', 'Hoá đơn gốc quá dài.');
  if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > 1e12) throw err('invalid-argument', 'Đơn giá vốn không hợp lệ.');
  if (note.length < 3 || note.length > 500) throw err('invalid-argument', 'Ghi chú / căn cứ cần 3–500 ký tự.');
  return { origInv, unitCost, note };
}
async function assertOpen(tx, db, period) {
  const pointer = await tx.get(db.doc(`svl_costing_periods/${period}`));
  const d = exists(pointer) ? dataOf(pointer) : null;
  if (d && d.summary && d.summary.closed) throw err('failed-precondition', `Kỳ ${period} đã CLOSED: không thay đổi phê duyệt.`);
}

/**
 * Maker: record the values that need approval. The maker is the signed-in uid, never a value sent by the client.
 * Re-requesting the same values keeps an existing approval; changed values replace it (the old approval no longer matches).
 */
export async function requestApproval({ db, auth, data, owners, now }) {
  const me = callerOf(auth);
  const { period, action } = data || {};
  checkPeriod(period);
  if (!ACTIONS.has(action)) throw err('invalid-argument', 'Loại phê duyệt không hỗ trợ.');
  const key = checkKey(data.key);
  const values = manualValues(data.values);
  const role = await roleOf(db, me.email, owners);
  if (role !== 'admin' && role !== 'editor') throw err('permission-denied', 'Chỉ admin hoặc editor được gửi duyệt.');
  const canonical = canonicalManualCost(values);
  const fingerprint = await sha256Hex(canonical);
  const ref = db.doc(`svl_costing_periods/${period}/approvals/${approvalDocId(action, key)}`);
  return db.runTransaction(async (tx) => {
    await assertOpen(tx, db, period);
    const cur = await tx.get(ref);
    const c = exists(cur) ? dataOf(cur) : null;
    if (c && c.status === 'APPROVED' && c.canonical === canonical) return { status: 'APPROVED', fingerprint, unchanged: true };
    const receipt = {
      schema: 1, period, action, key, canonical, fingerprint, values,
      status: 'REQUESTED',
      requestedByUid: me.uid, requestedByEmail: me.email, requestedAt: now,
      approvedByUid: '', approvedByEmail: '', approvedAt: '',
    };
    tx.set(ref, receipt);
    return { status: 'REQUESTED', fingerprint };
  });
}

/**
 * Checker: approve exactly the values the maker requested (the client must echo the canonical text it is approving).
 * Refused when the approver is the maker (same uid or same email), the values changed since the request, or the
 * request is not pending.
 */
export async function approveApproval({ db, auth, data, owners, now }) {
  const me = callerOf(auth);
  const { period, action } = data || {};
  checkPeriod(period);
  if (!ACTIONS.has(action)) throw err('invalid-argument', 'Loại phê duyệt không hỗ trợ.');
  const key = checkKey(data.key);
  if (typeof data.canonical !== 'string' || data.canonical.length > 2000) throw err('invalid-argument', 'Thiếu nội dung cần duyệt.');
  const role = await roleOf(db, me.email, owners);
  if (role !== 'admin' && role !== 'editor') throw err('permission-denied', 'Chỉ admin hoặc editor được duyệt.');
  const ref = db.doc(`svl_costing_periods/${period}/approvals/${approvalDocId(action, key)}`);
  return db.runTransaction(async (tx) => {
    await assertOpen(tx, db, period);
    const cur = await tx.get(ref);
    const c = exists(cur) ? dataOf(cur) : null;
    if (!c || c.status !== 'REQUESTED') throw err('failed-precondition', 'Không có yêu cầu đang chờ duyệt cho dòng này.');
    if (c.requestedByUid === me.uid || lower(c.requestedByEmail) === me.email) throw err('permission-denied', 'Không được tự duyệt yêu cầu của chính mình.');
    if (c.canonical !== data.canonical) throw err('failed-precondition', 'Nội dung đã thay đổi sau khi gửi duyệt – người gửi cần gửi lại.');
    tx.set(ref, { ...c, status: 'APPROVED', approvedByUid: me.uid, approvedByEmail: me.email, approvedAt: now });
    return { status: 'APPROVED', fingerprint: c.fingerprint, requestedByEmail: c.requestedByEmail };
  });
}
