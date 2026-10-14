// Maker–checker logic for STEP 5R manual unit costs (v1.14.41). Pure functions, no Firebase.
// These checks run the same code the browser and store.js use. firestore.rules are NOT executed here.
import { ACTION_MANUAL_COST, approvalDocId, canonicalManualCost, isApprovedFor, decideApprovalWrite } from '../src/engine/approvals.js';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}`); };
const throwsWith = (fn, part) => { try { fn(); return false; } catch (e) { return String(e.message).includes(part); } };

const M = { origInv: '', unitCost: 1234500, note: 'Căn cứ: đơn giá nhập trước kỳ web' };
const canon = canonicalManualCost(M);
const ctx = (email, extra = {}) => ({ email, uid: 'uid-' + email.split('@')[0], canonical: canon, key: 'K1', values: { ...M }, now: '2026-10-14T05:00:00.000Z', ...extra });

// doc id is stable and safe as a Firestore id
ok('approval doc id replaces unsafe characters', approvalDocId(ACTION_MANUAL_COST, 'CI-1|2 /x') === 'RETURN_MANUAL_COST__CI-1_2__x');

// canonical text: trims, rounds to 1e-6, and changes with any covered field
ok('canonical ignores surrounding spaces', canonicalManualCost({ ...M, note: '  ' + M.note + ' ' }) === canon);
ok('canonical changes with the unit cost', canonicalManualCost({ ...M, unitCost: 1500000 }) !== canon);
ok('canonical changes with the note', canonicalManualCost({ ...M, note: 'khác' }) !== canon);
ok('canonical changes with the invoice', canonicalManualCost({ ...M, origInv: 'CI-9' }) !== canon);

// request
const req = decideApprovalWrite(null, { ...ctx('a@x.vn'), op: 'request' });
ok('request stamps the requester and leaves approval empty', req.status === 'REQUESTED' && req.requestedByEmail === 'a@x.vn' && req.approvedByEmail === '');
ok('request stores the values and canonical text', req.values.unitCost === 1234500 && req.canonical === canon);
ok('request with unit cost 0 is refused', throwsWith(() => decideApprovalWrite(null, { ...ctx('a@x.vn', { values: { ...M, unitCost: 0 } }), op: 'request' }), 'lớn hơn 0'));

// approve
const approved = decideApprovalWrite(req, { ...ctx('b@x.vn'), op: 'approve' });
ok('a different user approves a pending request', approved.status === 'APPROVED' && approved.approvedByEmail === 'b@x.vn' && approved.requestedByEmail === 'a@x.vn');
ok('the approver identity is the signed-in email, lower-cased', decideApprovalWrite(req, { ...ctx('B@X.vn'), op: 'approve' }).approvedByEmail === 'b@x.vn');
ok('the requester cannot approve own request', throwsWith(() => decideApprovalWrite(req, { ...ctx('A@x.vn'), op: 'approve' }), 'tự duyệt'));
ok('approve refused when the values changed after the request', throwsWith(() => decideApprovalWrite(req, { ...ctx('b@x.vn', { canonical: canonicalManualCost({ ...M, unitCost: 1 }) }), op: 'approve' }), 'đã đổi'));
ok('approve refused when nothing is pending', throwsWith(() => decideApprovalWrite(null, { ...ctx('b@x.vn'), op: 'approve' }), 'Không có yêu cầu'));
ok('approve refused when already approved', throwsWith(() => decideApprovalWrite(approved, { ...ctx('c@x.vn'), op: 'approve' }), 'Không có yêu cầu'));

// receipt counts only for the exact entry, approved by another person
ok('approved receipt counts for the same entry', isApprovedFor(approved, M));
ok('approved receipt does not count after a value change', !isApprovedFor(approved, { ...M, unitCost: 999 }));
ok('a pending receipt does not count', !isApprovedFor(req, M));
ok('a receipt approved by its own requester does not count', !isApprovedFor({ ...approved, approvedByEmail: 'a@x.vn' }, M));
ok('zero unit cost never counts', !isApprovedFor(approved, { ...M, unitCost: 0 }));
ok('missing receipt does not count', !isApprovedFor(undefined, M));

// delete
ok('the requester may delete own receipt', decideApprovalWrite(req, { ...ctx('a@x.vn'), op: 'delete' }) === 'delete');
ok('an admin may delete any receipt', decideApprovalWrite(req, { ...ctx('z@x.vn', { isAdmin: true }), op: 'delete' }) === 'delete');
ok('another editor cannot delete the receipt', throwsWith(() => decideApprovalWrite(req, { ...ctx('b@x.vn'), op: 'delete' }), 'người gửi'));
ok('deleting a missing receipt is a no-op', decideApprovalWrite(null, { ...ctx('a@x.vn'), op: 'delete' }) === null);
ok('unknown operation is refused', throwsWith(() => decideApprovalWrite(req, { ...ctx('b@x.vn'), op: 'hack' }), 'không hợp lệ'));

console.log(`\n${total - fail}/${total} manual-cost approval logic checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
