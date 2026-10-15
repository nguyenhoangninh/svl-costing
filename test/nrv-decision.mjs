// NRV decision helpers (v1.14.68): validation, saving, replacement audit and withdrawal. Pure functions, no DOM.
import { currentNrvDecision, validateNrvInput, buildNrvDecision, nrvSaveAuditText, nrvUndoAuditText } from '../src/engine/nrvdecision.js';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}`); };
const throwsWith = (fn, part) => { try { fn(); return false; } catch (e) { return String(e.message).includes(part); } };
const fmt = (v) => String(Math.round(Number(v) || 0));

const KEY = 'K1';
const rec = { status: 'RECORDED', ref: 'JV-0901', note: 'Ghi nhận dự phòng theo bảng NRV', recordedAmount: 167392149 };
const noAdj = { status: 'NO ADJUSTMENT APPROVED', note: 'Không trích lập kỳ này' };

// validation
ok('no status is refused', validateNrvInput({ status: '', note: 'abcdef' }) === 'Chọn quyết định NRV.');
ok('RECORDED without a reference is refused', validateNrvInput({ ...rec, ref: 'ab' }).includes('Accounting Reference'));
ok('RECORDED with a valid reference passes', validateNrvInput(rec) === '');
ok('NO ADJUSTMENT does not need a reference', validateNrvInput({ ...noAdj, ref: '' }) === '');
ok('a short explanation is refused', validateNrvInput({ ...noAdj, note: 'abc' }).includes('ít nhất 5 ký tự'));
ok('a non-numeric recorded amount is refused', validateNrvInput({ ...rec, recordedAmount: NaN }).includes('không hợp lệ'));

// building the stored decision
const built = buildNrvDecision({ ...noAdj, key: KEY, amount: 167392149, by: 'a@x.vn', at: '2026-10-15T06:00:00Z', recordedAmount: 99 });
ok('NO ADJUSTMENT stores a zero recorded amount', built.recordedAmount === 0 && built.status === 'NO ADJUSTMENT APPROVED');
ok('the decision keeps the key, the required amount and the author', built.key === KEY && built.amount === 167392149 && built.by === 'a@x.vn');
ok('RECORDED keeps the recorded amount and trims the reference', buildNrvDecision({ ...rec, key: KEY, ref: '  JV-0901 ' }).recordedAmount === 167392149 && buildNrvDecision({ ...rec, key: KEY, ref: ' JV-0901 ' }).ref === 'JV-0901');
ok('building with an unknown status throws', throwsWith(() => buildNrvDecision({ key: KEY, status: 'XYZ' }), 'Chọn quyết định NRV'));

// the decision only counts for the same provision
const stored = buildNrvDecision({ ...rec, key: KEY, amount: 1 });
ok('same provision key → decision is current', currentNrvDecision(stored, KEY) === stored);
ok('changed provision key → decision is not current', currentNrvDecision(stored, 'K2') === null);
ok('no decision → null', currentNrvDecision(null, KEY) === null);

// replacement audit keeps the previous decision in full
const prev = { ...stored, by: 'b@x.vn', at: '2026-10-14T09:00:00Z' };
const repl = nrvSaveAuditText(buildNrvDecision({ ...noAdj, key: KEY, amount: 167392149 }), 167392149, prev, fmt);
ok('replacement audit names the earlier status and amount', repl.includes('THAY THẾ RECORDED') && repl.includes('recorded=167392149'));
ok('replacement audit names the earlier author and time', repl.includes('by=b@x.vn') && repl.includes('at=2026-10-14T09:00:00Z'));
ok('first save has no replacement part', !nrvSaveAuditText(stored, 167392149, null, fmt).includes('THAY THẾ'));

// withdrawal audit keeps the withdrawn decision in full
const undoText = nrvUndoAuditText(prev, fmt);
ok('withdrawal audit records status, reference, author and note', undoText.startsWith('WITHDRAWN RECORDED') && undoText.includes('ref=JV-0901') && undoText.includes('by=b@x.vn') && undoText.includes('note=Ghi nhận'));

console.log(`\n${total - fail}/${total} NRV decision checks passed`);
process.exit(fail ? 1 : 0);
