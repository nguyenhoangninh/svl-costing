// NRV accounting decision (STEP 5.3): pure helpers for recording, replacing and withdrawing the decision.
// No DOM, no Firebase. The view (views/phase3.js) calls these and does the storage / audit / render.

export const NRV_STATUSES = ['RECORDED', 'NO ADJUSTMENT APPROVED'];

/** The stored decision if it still belongs to the current NRV provision (same key), else null. */
export function currentNrvDecision(decision, key) {
  return decision && decision.key === key ? decision : null;
}

/** Checks the form input. Returns '' when valid, otherwise the message to show. */
export function validateNrvInput({ status, ref = '', note = '', recordedAmount = 0 } = {}) {
  if (!NRV_STATUSES.includes(status)) return 'Chọn quyết định NRV.';
  if (status === 'RECORDED') {
    if (!Number.isFinite(Number(recordedAmount))) return 'Số NRV đã ghi FAST không hợp lệ.';
    if (String(ref).trim().length < 3) return 'NRV RECORDED cần tham chiếu kế toán / số bút toán (Journal No.).';
  }
  if (String(note).trim().length < 5) return 'Nhập giải trình NRV ít nhất 5 ký tự.';
  return '';
}

/** Builds the stored decision. Only RECORDED keeps a recorded amount. */
export function buildNrvDecision({ key, status, ref = '', note = '', amount = 0, recordedAmount = 0, by = '', at = '' }) {
  if (!NRV_STATUSES.includes(status)) throw new Error('Chọn quyết định NRV.');
  return {
    key, status,
    ref: String(ref || '').trim(),
    note: String(note || '').trim(),
    amount: Number(amount) || 0,
    recordedAmount: status === 'RECORDED' ? Number(recordedAmount) || 0 : 0,
    by, at,
  };
}

/** Audit text for a new decision. When it replaces an earlier one, the earlier decision is written in full. */
export function nrvSaveAuditText(next, required, prev, fmt = String) {
  const base = `${next.status}; required=${fmt(required)}; recorded=${fmt(next.recordedAmount)}; ref=${next.ref || '-'}; ${next.note}`;
  if (!prev) return base;
  return `${base}; THAY THẾ ${prev.status}; recorded=${fmt(prev.recordedAmount)}; ref=${prev.ref || '-'}; by=${prev.by || '-'}; at=${prev.at || '-'}; note=${prev.note || '-'}`;
}

/** Audit text for a withdrawn decision. The decision is kept in full in the audit log, since the stored value is cleared. */
export function nrvUndoAuditText(prev, fmt = String) {
  return `WITHDRAWN ${prev.status}; required=${fmt(prev.amount)}; recorded=${fmt(prev.recordedAmount)}; ref=${prev.ref || '-'}; by=${prev.by || '-'}; at=${prev.at || '-'}; note=${prev.note || '-'}`;
}
