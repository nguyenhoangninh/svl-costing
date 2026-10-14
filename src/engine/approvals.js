// Maker–checker for STEP 5R manual unit costs (v1.14.41). Pure logic, no Firebase: the browser writes the receipt through
// store.js, and the same functions are used by test/approvals-logic.mjs. firestore.rules enforce the identity rules
// (the approver is a different signed-in user); the browser also checks the canonical text, so an approval only counts
// for the exact values that were requested.

export const ACTION_MANUAL_COST = 'RETURN_MANUAL_COST';

/** Stable document id of one approval (action + line key). */
export function approvalDocId(action, key) { return `${action}__${String(key).replace(/[^A-Za-z0-9_.-]/g, '_')}`; }

/** Canonical text of the values an approval covers. Any change to origInv, unitCost or note changes it. */
export function canonicalManualCost(v) {
  const unit = Math.round((Number(v && v.unitCost) || 0) * 1e6) / 1e6;
  return JSON.stringify([String((v && v.origInv) ?? '').trim(), unit, String((v && v.note) ?? '').trim()]);
}

const lower = (s) => String(s || '').trim().toLowerCase();

/** Does this receipt approve the entry m exactly as it is now? (approved, by someone other than the requester) */
export function isApprovedFor(r, m) {
  return !!r && r.status === 'APPROVED' && !!r.approvedByEmail
    && lower(r.approvedByEmail) !== lower(r.requestedByEmail)
    && Number(m && m.unitCost) > 0 && r.canonical === canonicalManualCost(m);
}

/**
 * The receipt written for one operation, or null (nothing to write), or 'delete'. Throws an Error (Vietnamese message)
 * when the operation is not allowed. cur = the stored receipt or null; ctx = { op, email, uid, isAdmin, key, values, canonical, now }.
 */
export function decideApprovalWrite(cur, ctx) {
  const email = lower(ctx.email);
  if (ctx.op === 'request') {
    if (!(Number(ctx.values && ctx.values.unitCost) > 0)) throw new Error('Đơn giá nhập tay phải lớn hơn 0.');
    return {
      action: ACTION_MANUAL_COST, key: String(ctx.key), values: { ...ctx.values }, canonical: String(ctx.canonical),
      status: 'REQUESTED', requestedByEmail: email, requestedByUid: ctx.uid, requestedAt: ctx.now,
      approvedByEmail: '', approvedByUid: '', approvedAt: '',
    };
  }
  if (ctx.op === 'approve') {
    if (!cur || cur.status !== 'REQUESTED') throw new Error('Không có yêu cầu đang chờ duyệt cho dòng này.');
    if (cur.canonical !== ctx.canonical) throw new Error('Đơn giá đã đổi sau khi gửi duyệt – người gửi cần gửi lại.');
    if (lower(cur.requestedByEmail) === email) throw new Error('Không được tự duyệt yêu cầu của chính mình.');
    return { ...cur, status: 'APPROVED', approvedByEmail: email, approvedByUid: ctx.uid, approvedAt: ctx.now };
  }
  if (ctx.op === 'delete') {
    if (!cur) return null;
    if (lower(cur.requestedByEmail) !== email && !ctx.isAdmin) throw new Error('Chỉ người gửi yêu cầu hoặc quản trị viên mới xoá được.');
    return 'delete';
  }
  throw new Error('Thao tác duyệt không hợp lệ.');
}
