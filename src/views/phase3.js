// Phase 3 views: STEP 5 — Opening FG, FIFO COGS + FG Rework FIFO (5B), FG History & month close.
import * as F5 from '../engine/step5.js';
import * as P2 from './phase2.js';
import { num, ttxt, utxt, txt, nowISO, prevPeriod, serialToISO, fpRows } from '../engine/util.js';

let A = null;
export function install(api) { A = api; }
const esc = (s) => A.esc(s);
const tabsHTML = (cur, tabs, attr) => `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab ${id === cur ? 'on' : ''}" ${attr}="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join('')}</div>`;
const colsOf = (fields, headers, types = {}, widths = {}) => fields.map((f, i) => ({ key: f, label: headers[i], type: types[f] || 'text', width: widths[f] || (types[f] === 'num' ? 140 : types[f] === 'qty' ? 100 : f === 'prod' ? 150 : 120), trace: f === 'prod' }));

export const PHASE3_BLOBS = ['dupDecisions', 'fgOpen', 'step5', 'fgHistory', 'fifoOverrides', 's5cfg', 'fgItems', 'closed', 'closedEver', 'rwArchive', 'fastTie', 'nrvDecision'];
export const PHASE3_SHEETS = ['05_FG_OPENING', '05_SALES_COGS', '05_RECONCILIATION', '05_FG_HISTORY', '05_FG_ROLLFORWARD', '05_COGS_SUMMARY', '05_FG_REWORK_FIFO'];
export const CLOSED_BLOCK = new Set(['run-step2', 'run-step3', 'roll-wip', 'validate-wip', 'reset-wip', 'reset-erp', '3b-sync', '3b-build', '3b-apply', 'sales-save', 'pm-update', 'run-step4', 's5-roll', 's5-validate', 's5-run', 's5-hist']);

// ======================= derived =======================
/** Engine side of the FAST tie. */
export function engineBalances(S, p2, res) {
  const d = S.d; const reg = d.register ? d.register.rows : [];
  const wf = p2 && p2.d3b ? p2.d3b.wf : null;
  const w632 = ((d.wipadj && d.wipadj.reg632) || []).filter((r) => r.record === 'RECORDED').reduce((a, r) => a + num(r.impact), 0);
  const nd = d.nrvDecision, nrvAdj = nd && res && nd.key === nrvKey(res) && utxt(nd.status) === 'RECORDED' ? num(nd.recordedAmount ?? nd.amount) : 0;
  return {
    // DIRECT_632 impact > 0 = Dr 632 / Cr 154. NRV recorded adjustment > 0 = Dr 632 / Cr 2294.
    a154: (wf ? wf.finalClosing : d.step3 ? d.step3.summary.closingAmt : 0) + reg.reduce((a, r) => a + num(r.closingWIP), 0) - w632,
    a155: res ? res.totals.closeA : 0,
    a2294: nrvAdj,
    a632: (res ? res.totals.cogsA : 0) + w632 + nrvAdj,
    a511: F5.periodRevenue(d.salesDB ? d.salesDB.rows : [], S.period),
  };
}
function snap(S, D4) {
  const d = S.d; const fl = D4 && D4.fl;
  return { period: S.period, step4RunAt: d.step4 ? d.step4.runAt : '', finalCost: fl ? fl.totals.totalCost : 0, dbSavedAt: d.salesDB ? d.salesDB.savedAt : '', openValidatedAt: d.fgOpen ? d.fgOpen.validatedAt : '', mode: cfg(S).mode, dupKey: dupKey(S),
    flKey: flKey(fl), ovKey: ovKey(S), rate: sellRate(S) };
}
/** Audit F-03: final STEP 4 cost per lot (3B / rework carry-in can move between lots with an unchanged total) and the FIFO overrides. */
export const flKey = (fl) => fpRows(fl ? fl.rows : [], (r) => [r.erp, utxt(r.pc), utxt(r.prod), num(r.qty), num(r.totalRM).toFixed(0), num(r.t622).toFixed(0), num(r.t627).toFixed(0), num(r.totalCost).toFixed(0)].join('|'));
export const ovKey = (S) => fpRows(Object.entries(S.d.fifoOverrides || {}).filter(([, v]) => v), ([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
const cfg = (S) => S.d.s5cfg || { mode: 'MONTHLY', tol: 1 };
/** NRV estimated selling cost (share of selling price); owner decision 02/10/2026: 1.5 % unless changed. */
export const sellRate = (S) => { const c = cfg(S); return c.sellCostRate === undefined || c.sellCostRate === null || c.sellCostRate === '' ? 0.015 : num(c.sellCostRate); };
/** Approval key for NRV decision. Any changed closing layer / provision amount invalidates the prior decision. */
export const nrvKey = (res) => fpRows((res && res.closing) || [], (r) => [ttxt(r.lid), utxt(r.prod), num(r.qty).toFixed(4), num(r.tot).toFixed(0), num(r.price).toFixed(6), num(r.nrvUnit).toFixed(2), num(r.prov).toFixed(0), num(r.provNeed).toFixed(0)].join('|'));
/** Repeated sales lines of the period and how many still need a KEEP / EXCLUDE decision (F-03). */
export function dupStatus(S) {
  const groups = F5.duplicateGroups(S.d.salesDB ? S.d.salesDB.rows : [], S.period);
  const dec = S.d.dupDecisions || {};
  let pending = 0, excluded = 0;
  for (const g of groups) for (const l of g) if (l.occ > 1) { const v = dec[l.key]; if (!v) pending++; else if (v === 'EXCLUDE') excluded++; }
  return { groups, pending, excluded };
}
const dupKey = (S) => Object.entries(S.d.dupDecisions || {}).filter(([, v]) => v === 'EXCLUDE').map(([k]) => k).sort().join('|');
/** Why STEP 5 is stale (F-01): any upstream step not CURRENT/PASS makes STEP 5 OUTDATED, not only a changed Step 4 run time. */
function staleReason(S, D4, d3b) {
  const r = S.d.step5; if (!r || !r.snap) return '';
  if (D4 && D4.freshness !== 'CURRENT') return `STEP 4 ${D4.freshness}${P2.step4StaleReason(S, d3b) ? ' – ' + P2.step4StaleReason(S, d3b) : ''}`;
  if (D4 && String(D4.controls.status).startsWith('BLOCK')) return `STEP 4 = ${D4.controls.status}`;
  if (!D4 || !D4.fl) return 'STEP 4 chưa có kết quả';
  const c = snap(S, D4), p = r.snap;
  if (c.period !== p.period) return 'Kỳ khác';
  if (c.step4RunAt !== p.step4RunAt) return 'STEP 4 đã chạy lại';
  if (Math.abs(c.finalCost - p.finalCost) > 1) return 'Giá thành STEP 4 đã đổi (điều chỉnh 3B / rework hoàn thành)';
  if (c.dbSavedAt !== p.dbSavedAt) return 'Sales Database đã lưu lại';
  if (c.openValidatedAt !== p.openValidatedAt) return 'FG đầu kỳ đã validate lại';
  if (c.mode !== p.mode) return 'Đổi chế độ FIFO';
  if (dupKey(S) !== (p.dupKey || '')) return 'Quyết định dòng nghi trùng đã đổi';
  if (p.flKey !== undefined && c.flKey !== p.flKey) return 'Giá thành từng lô ở STEP 4 đã đổi (điều chỉnh 3B / rework chuyển giữa các lô)';
  if (p.ovKey !== undefined && c.ovKey !== p.ovKey) return 'Lựa chọn xử lý FIFO (override) đã đổi';
  if (p.rate !== undefined && c.rate !== p.rate) return 'Tỷ lệ chi phí bán hàng (NRV) đã đổi';
  return '';
}
function freshness(S, D4, d3b) {
  const r = S.d.step5; if (!r || !r.snap) return 'NOT RUN';
  if (staleReason(S, D4, d3b)) return 'OUTDATED';
  const c = snap(S, D4), p = r.snap;
  const same = c.period === p.period && c.step4RunAt === p.step4RunAt && Math.abs(c.finalCost - p.finalCost) <= 1 && c.dbSavedAt === p.dbSavedAt && c.openValidatedAt === p.openValidatedAt && c.mode === p.mode;
  return same ? 'CURRENT' : 'OUTDATED';
}
const sumOf = (rows, f) => (rows || []).reduce((a, r) => a + num(r[f]), 0);

export function derive(S, p2) {
  const d = S.d; const D4 = p2 ? p2.d4 : null; const fl = D4 ? D4.fl : null;
  const res = d.step5 && d.step5.period === S.period ? d.step5 : null;
  const fresh = res ? freshness(S, D4, p2 ? p2.d3b : null) : 'NOT RUN';
  const stale = res ? staleReason(S, D4, p2 ? p2.d3b : null) : '';
  const dups = dupStatus(S);
  const hg = F5.historyGate(d.fgHistory, res, S.period);
  const recon = F5.step5Recon({ period: S.period, res, freshness: fresh, hist: d.fgHistory, histGate: d.fgHistory ? hg : null, gl: d.gl, fl, s4: d.step4, gate6: fl ? fl.gate6 : '' });
  const tie = res ? F5.fastTie(engineBalances(S, p2, res), d.fastTie && d.fastTie.period === S.period ? d.fastTie : null) : null;
  const controls = step5Controls(S, { res, recon, hg, fl, fresh, d3b: p2 ? p2.d3b : null, tie });
  let closeReason = F5.closeBlockReason({ period: S.period, recon, histGate: d.fgHistory ? hg : null, res, register: d.register, closed: d.closed });
  if (res && stale && !(d.closed && d.closed.period === S.period)) closeReason = `STEP 5 OUTDATED: ${stale}. Chạy lại theo thứ tự STEP 4 → RUN FIFO → BUILD FG HISTORY.`;
  if (!closeReason && res && !(d.closed && d.closed.period === S.period)) { const b = P2.threeBBlock(S, p2 ? p2.d3b : null, { forClose: true }); if (b) closeReason = b; }
  if (!closeReason && res && (S.prevDrift || []).length && !(d.closed && d.closed.period === S.period)) closeReason = `Số dư đầu kỳ đã lệch so với kỳ trước: ${S.prevDrift[0]}`;
  if (!closeReason && res && res.undated && res.undated.length) closeReason = `Sales Database có ${res.undated.length} dòng thiếu / sai ngày hoá đơn (vd. ${res.undated.slice(0, 3).map((u) => u.inv || 'dòng ' + u.dbRow).join(', ')}) – không xác định được kỳ nên chưa tính giá vốn. Sửa ngày rồi import & lưu lại.`;
  if (!closeReason && res && dups.pending) closeReason = `Còn ${dups.pending} dòng doanh thu nghi trùng trong kỳ chưa xác nhận (màn hình 4.1 → Nghi trùng).`;
  if (!closeReason && res && res.returnControl && res.returnControl.status === 'BLOCK') closeReason = `STEP 5R Sales Return còn ${res.returnControl.blocked} giao dịch chưa xử lý đầy đủ (invoice gốc / số lượng / COGS reversal).`;
  if (!closeReason && res && num(res.totals && res.totals.nrvProv) > 1 && !(d.closed && d.closed.period === S.period)) {
    const nd = d.nrvDecision, key = nrvKey(res);
    if (!nd || nd.key !== key || !['RECORDED', 'NO ADJUSTMENT APPROVED'].includes(utxt(nd.status))) closeReason = `NRV đề xuất dự phòng ${A.fmtNum(res.totals.nrvProv)} VND chưa có quyết định kế toán hiện hành (RECORDED hoặc NO ADJUSTMENT APPROVED).`;
  }
  if (!closeReason && res && tie && !(d.closed && d.closed.period === S.period)) {
    if (!tie.entered) closeReason = 'Chưa nhập số dư / phát sinh FAST 154 / 155 / 2294 / 632 / 511 (STEP 5.3 → tab Đối chiếu FAST).';
    else if (tie.diffs && !tie.approved) closeReason = `Số liệu lệch FAST ở ${tie.diffs} tài khoản chưa được xác nhận (STEP 5.3 → Đối chiếu FAST → Xác nhận chênh lệch).`;
  }
  return { res, fresh, stale, dups, hg, recon, controls, closeReason, tie };
}

/** 00_CONTROL_CENTER rows 119..136 — STEP 5 checkpoints. */
function step5Controls(S, x) {
  const d = S.d; const { res, recon, hg, fl } = x;
  const rec = res ? res.rec : {};
  const rows = [];
  const add = (no, label, expected, actual, status, rule) => rows.push({ no, label, expected, actual, diff: typeof expected === 'number' && typeof actual === 'number' ? actual - expected : '', status, rule });
  const R = (r) => rec[r] || { expected: '', result: '', status: '' };
  add('01', 'FG đầu kỳ đã validate', R(4).expected, R(4).result, R(4).status, '05_FG_OPENING nạp & validate');
  add('02', 'STEP 4 CURRENT & PASS', R(5).expected, R(5).result, R(5).status, 'Điều kiện trước FIFO');
  add('03', 'Lớp sản xuất = giá thành STEP 4', R(6).expected, R(6).result, R(6).status, '04_COST_ALLOCATION → FG ledger');
  add('04', 'Roll-forward số lượng', R(8).expected, R(8).result, R(8).status, 'Đầu kỳ + SX − COGS − Rework − Cuối kỳ');
  add('05', 'Roll-forward giá trị', R(9).expected, R(9).result, R(9).status, 'Đầu kỳ + SX − COGS − Rework − Cuối kỳ');
  add('06', 'Roll-forward RM / 622 / 627', R(10).expected, R(10).result, R(10).status, 'Chênh lệch tuyệt đối lớn nhất');
  add('07', 'SL FIFO = SL bán đủ điều kiện', R(11).expected, R(11).result, R(11).status, 'Dòng bán FIFO COGS');
  add('08', 'Sản phẩm thiếu FG', R(13).expected, R(13).result, R(13).status, 'Phải bằng 0');
  add('09', 'Dòng bán cần review', R(15).expected, R(15).result, R(15).status, 'Final Treatment = REVIEW');
  const und = res && res.undated ? res.undated.length : 0, adv = res && res.stats ? num(res.stats.advisory) : 0;
  if (res) {
    add('09a', 'Dòng bán thiếu / sai ngày hoá đơn', 0, und, und ? 'BLOCK' : 'PASS', 'Không xác định được kỳ → chưa tính giá vốn. Sửa ngày ở nguồn rồi import & lưu lại (4.1)');
    if (res.mode === 'STRICT_DATE') { const ul = num(res.stats && res.stats.undatedLayers); add('09c', 'STRICT_DATE: lớp sản xuất không có ngày hoàn thành đã được dùng', 0, ul, ul ? 'REVIEW' : 'PASS', 'PC-P thiếu Date → không chứng minh được thứ tự thời gian'); }
    add('09b', 'Dòng FIFO có cảnh báo kiểm tra dữ liệu bán', 0, adv, adv ? 'REVIEW' : 'PASS', 'Thiếu khách hàng, SL×đơn giá lệch, loại OTHER… (không chặn)');
    const rc = res.returnControl || { total: 0, processed: 0, blocked: 0, status: 'PASS' };
    add('09r', 'STEP 5R · Sales Return đã match & reverse COGS', rc.total, rc.processed, rc.blocked ? 'BLOCK' : 'PASS', rc.total ? `Unresolved=${rc.blocked}; Return qty=${A.fmtNum(rc.qty)}; COGS reversal=${A.fmtNum(rc.cogsReversal)}` : 'Không có Sales Return');
  }
  add('10', `Lô cuối kỳ giá vốn > NRV (giá bán − ${(sellRate(S) * 100).toLocaleString('vi-VN')}% CPBH)`, R(16).expected, R(16).result, R(16).status, res && res.totals && res.totals.nrvProv ? `Dự phòng giảm giá đề xuất (TK 2294): ${A.fmtNum(res.totals.nrvProv)} VND – xem STEP 5.2 → Tồn cuối` : 'Review NRV (sau dự phòng)');
  if (res && res.stats && res.stats.returns) add('10b', 'Hàng bán bị trả lại nhập lại kho', 'INFO', res.stats.returns, 'INFO', `${A.fmtNum(res.totals.retQ)} sp · ${A.fmtNum(res.totals.retA)} VND giảm giá vốn (theo giá vốn hoá đơn gốc)`);
  const reg = d.register ? d.register.rows : [];
  const stale = reg.some((r) => (r.active === 'Y' && utxt(r.fifoStatus) === 'NOT RUN') || utxt(r.fifoStatus).startsWith('RERUN'));
  const rw = res && res.rework ? res.rework : null;
  const srcQ = sumOf(reg, 'issueQty'), fifoQ = rw ? rw.fifoQty : 0, fifoC = rw ? rw.fifoCost : 0;
  const bf = reg.filter((r) => r.active === 'B/F').reduce((a, r) => a + num(r.bfCost), 0);
  const e12 = fifoC + bf, f12 = sumOf(reg, 'closingWIP') + sumOf(reg, 'carryIn');
  const comp = sumOf(reg, 'carryIn'), stepCarry = fl ? fl.totals.carryIn : 0;
  add('11', '5B · SL rework = SL chuyển FIFO', srcQ, fifoQ, stale ? 'RERUN FIFO' : Math.abs(fifoQ - srcQ) <= 0.000001 ? 'PASS' : 'CHECK', 'Sổ rework ↔ FIFO rework');
  add('12', '5B · FIFO + B/F = WIP rework cuối + chuyển vào', e12, f12, stale ? 'RERUN FIFO' : Math.abs(f12 - e12) <= 1 ? 'PASS' : 'CHECK', 'Không mất giá trị rework');
  add('13', '5B · Rework hoàn thành = chuyển vào STEP 4', comp, stepCarry, stale ? 'RERUN FIFO' : Math.abs(stepCarry - comp) <= 1 ? 'PASS' : 'CHECK', 'Giá trị lô rework vào STEP 4');
  const conf = rw ? rw.conflicts : 0;
  add('14', '5B · Xung đột thứ tự thời gian', 0, conf, conf === 0 ? 'PASS' : 'BLOCK', rw && rw.mode === 'STRICT_DATE' ? `STRICT_DATE: bán hàng và rework chạy chung theo ngày (${rw.rawConflicts || 0} trường hợp đã xử lý)` : 'Phải bằng 0 ở chế độ MONTHLY');
  if (rw && rw.mode !== 'STRICT_DATE' && rw.lateLayers) add('14b', '5B · Rework lấy lớp hoàn thành sau ngày xuất', 0, rw.lateLayers, 'REVIEW', 'MONTHLY lấy lớp cũ nhất còn lại sau bán hàng – dùng STRICT_DATE để FIFO theo ngày xuất');
  const T = res ? res.totals : null;
  const f201 = T ? T.openA + (fl ? fl.totals.totalCost : 0) - T.cogsA - num(T.rwTot) - T.closeA : 0;
  add('15', 'Cầu nối TK 155 (gồm rework)', 0, f201, Math.abs(f201) <= 1 ? 'PASS' : 'REVIEW', 'Đầu kỳ + nhập kho − COGS − rework − cuối kỳ');
  // audit F-17: VBA Control Center F200 "WIP 154 bridge (incl. 3B & Rework)"
  const s3 = d.step3, s4 = d.step4;
  if (res && s3 && fl && x.d3b && s4 && !s4.blocked) {
    const S3 = s3.summary;
    const f200 = num(s3.openingAmt) + num(S3.miAmt) + num(S3.soAmt) + num(s4.alloc622) + num(s4.alloc627) + fifoC + bf - num(S3.mrAmt) - fl.totals.totalCost - x.d3b.wf.finalClosing - sumOf(reg, 'closingWIP');
    add('15a', 'Cầu nối TK 154 (gồm 3B & rework)', 0, f200, Math.abs(f200) <= 1 ? 'PASS' : stale ? 'RERUN FIFO' : 'REVIEW', 'WIP đầu kỳ + B/F + MI + Stock Out + 622 + 627 + FG đi rework − MR − nhập kho − WIP cuối (sau 3B) − rework WIP cuối');
  }
  if (res && x.tie) add('15b', 'Đối chiếu FAST 154 / 155 / 2294 / 632 / 511', 0, x.tie.diffs, x.tie.status === 'PASS' ? 'PASS' : x.tie.status === 'APPROVED' ? 'REVIEW' : x.tie.status === 'NOT ENTERED' ? 'REVIEW' : 'REVIEW', x.tie.status === 'NOT ENTERED' ? 'Chưa nhập số dư FAST' : x.tie.status === 'APPROVED' ? `Chênh lệch đã xác nhận bởi ${x.tie.approval.by}` : x.tie.diffs ? 'Lệch – cần xác nhận trước khi đóng kỳ' : 'Khớp FAST');
  add('16', 'FG History', 'PASS', hg.gate, hg.gate === 'PASS' ? 'PASS' : 'RERUN HISTORY', 'BUILD FG HISTORY sau FIFO');
  const f135 = recon.finalStatus;
  add('17', 'Cổng đóng kỳ', 'READY', res ? f135 : '', !res ? 'NOT RUN' : f135.startsWith('READY') ? (f135.includes('REVIEW') ? 'PASS WITH REVIEW' : 'PASS') : 'BLOCK', '05_RECONCILIATION dòng 49');
  const H = rows.map((r) => String(r.status || ''));
  const ok = H.filter((s) => s === 'PASS' || s === 'CURRENT' || s === 'INFO').length;
  const status = H.some((s) => s.startsWith('BLOCK') || s.startsWith('CHECK')) ? 'BLOCK' : H.some((s) => s === 'NOT RUN' || s.startsWith('RERUN')) ? 'RERUN REQUIRED' : H.some((s) => s.startsWith('REVIEW')) ? 'PASS WITH REVIEW' : 'PASS';
  const op = d.fgOpen;
  const opSt = !op ? 'NOT LOADED' : op.status;
  const next = d.closed && d.closed.period === S.period ? `Kỳ đã đóng – tạo kỳ ${nextP(S.period)}` : opSt === 'NOT LOADED' ? 'Roll forward / import FG đầu kỳ' : !opSt.startsWith('VALIDATED') ? 'Validate FG đầu kỳ' : rows[1].status !== 'PASS' ? 'Hoàn tất STEP 4 trước' : (rows[3].status !== 'PASS' || rows[4].status !== 'PASS' || rows[10].status !== 'PASS') ? 'Chạy FIFO COGS' : rows[15].status !== 'PASS' ? 'Build FG History' : rows[16].status.startsWith('PASS') ? 'CLOSE MONTH' : 'Xử lý cổng đóng kỳ (05_RECONCILIATION dòng 49)';
  return { rows, okText: `${ok} / 17 OK`, status: d.closed && d.closed.period === S.period ? 'CLOSED' : status, next };
}
const nextP = (p) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; };

export function railStatus(S, D5) {
  const op = S.d.fgOpen;
  const s5o = !op ? 'NOT RUN' : op.status === 'VALIDATED' ? 'PASS' : op.status === 'VALIDATED WITH REVIEW' ? 'PASS WITH REVIEW' : op.status === 'BLOCKED' ? 'BLOCK' : 'NOT VALIDATED';
  const closed = S.d.closed && S.d.closed.period === S.period;
  const s5 = !D5.res ? 'NOT RUN' : D5.fresh !== 'CURRENT' ? 'RERUN REQUIRED' : D5.recon.e18;
  const s5c = closed ? 'CLOSED' : !D5.res ? 'NOT RUN' : D5.hg.gate !== 'PASS' ? 'RERUN HISTORY' : D5.recon.finalStatus;
  return { s5o, s5, s5c };
}

// ======================= 5.1 Opening FG =======================
const LAYER_T = { date: 'date', qty: 'qty', rm: 'num', a622: 'num', a627: 'num', tot: 'num', unitCost: 'num', price: 'qty', prov: 'num', status: 'status' };
const LAYER_W = { lid: 200, name: 220, msg: 260, prod: 150 };
export function viewOpen(el) {
  const S = A.S; const d = S.d; const op = d.fgOpen; const closed = d.closed && d.closed.period === S.period;
  const st = op ? op.stats || {} : {};
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 5.1 · FG đầu kỳ theo lô</h1><p class="lead">Mỗi dòng là một lớp FIFO còn tồn (lô sản xuất) đầu kỳ ${esc(S.period)}. Tháng đầu tiên: import template; các tháng sau: roll forward từ FG cuối kỳ ${esc(prevPeriod(S.period))} (kỳ trước phải đã đóng).</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(op ? op.status : 'NOT LOADED')}<small>${op && op.validatedAt ? 'Validate ' + A.fmtTs(op.validatedAt) : ''}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    <div class="row">
      <button class="btn" data-act="s5-roll" type="button">Roll forward từ ${esc(prevPeriod(S.period))}</button>
      <label class="btn ghost">Import file FG đầu kỳ…<input type="file" id="f-fgopen" accept=".xlsx,.xlsm,.xls" hidden></label>
      <button class="btn ghost" data-act="s5-template" type="button">Tải template</button>
      <button class="btn" data-act="s5-validate" type="button" ${op ? '' : 'disabled'}>Validate FG đầu kỳ</button>
    </div>
    ${op ? `<p class="muted">Nguồn: ${esc(op.source || '')} · nạp ${A.fmtTs(op.loadedAt)}</p>` : ''}
    <div class="kpis">${A.kpiN('Số lớp', st.layers)}${A.kpiN('Số lượng', st.qty)}${A.kpi('Giá trị FG đầu kỳ', st.amt ?? null, true)}${A.kpiN('BLOCK', st.block)}${A.kpiN('REVIEW', st.review)}</div>
    <div id="t-op"></div></section>`;
  el.querySelector('#f-fgopen').addEventListener('change', (e) => importOpenFile(e.target.files[0]));
  if (!op) { el.querySelector('#t-op').innerHTML = A.emptyNote('Chưa có FG đầu kỳ.'); return; }
  const cols = colsOf(F5.LAYER_FIELDS, F5.LAYER_HEADERS, LAYER_T, LAYER_W);
  A.mountTable(el.querySelector('#t-op'), { columns: cols, rows: op.rows, filterKey: 'status', height: 520, totals: ['qty', 'rm', 'a622', 'a627', 'tot'], onExport: A.exportTable('05_FG_OPENING', cols) });
}
async function importOpenFile(file) {
  if (!file || !A.guardEdit() || closedGuard()) return;
  const S = A.S;
  if (S.d.fgOpen && S.d.fgOpen.rows.length && !confirm('FG đầu kỳ đã có dữ liệu. Thay bằng file mới?')) return;
  await A.busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const res = await A.parseFile(await file.arrayBuffer(), 'all');
      S.d.fgOpen = F5.importOpeningFG(res.grids, file.name, S.period);
      refreshFgRef(S);
      A.audit('STEP 5 - IMPORT OPENING FG', `${S.d.fgOpen.srcKind} | Layers=${S.d.fgOpen.stats.layers}; Amount=${A.fmtNum(S.d.fgOpen.stats.amt)}; File=${file.name}`);
      A.markDirty('fgOpen', 'fgRef', 'audit');
      A.toast(`Đã nạp ${S.d.fgOpen.stats.layers} lớp FG đầu kỳ. Bước tiếp: Validate.`, 'pass');
    } catch (e) { A.toast('Import FG đầu kỳ lỗi: ' + e.message, 'block'); }
  });
  A.render();
}
function closedGuard() {
  const S = A.S;
  if (S.d.closed && S.d.closed.period === S.period) { A.toast(`Kỳ ${S.period} đã đóng. Mở lại kỳ (quản trị viên) nếu cần sửa.`, 'review'); return true; }
  return false;
}
export async function doRollOpen() {
  const S = A.S; const prev = prevPeriod(S.period);
  const pd = await A.loadPeriodData(prev);
  if (!pd || !pd.step5) { A.toast(`Kỳ ${prev} chưa có kết quả STEP 5 trên web. Dùng Import file FG đầu kỳ.`, 'block'); return; }
  let reason = '';
  if (!pd.closed || pd.closed.period !== prev) {
    reason = (prompt(`Kỳ ${prev} CHƯA ĐÓNG.\nQuy trình chuẩn: BUILD FG HISTORY → CLOSE MONTH → ROLL FORWARD.\nNhập lý do để vẫn roll forward (chỉ dùng khi thiết lập ban đầu / khôi phục), để trống để huỷ:`, '') || '').trim();
    if (!reason) return;
    A.audit('STEP 5 - ROLL FORWARD OVERRIDE', `Kỳ ${prev} chưa đóng. Lý do: ${reason}`);
  }
  if (S.d.fgOpen && S.d.fgOpen.rows.length && !confirm(`FG đầu kỳ đã có dữ liệu. Thay bằng FG cuối kỳ ${prev}?`)) return;
  try {
    S.d.fgOpen = F5.openingFromClosing(pd.step5, S.period, reason);
    refreshFgRef(S);
    A.audit('STEP 5 - ROLL FORWARD OPENING FG', `Layers=${S.d.fgOpen.stats.layers}; Amount=${A.fmtNum(S.d.fgOpen.stats.amt)}`);
    A.markDirty('fgOpen', 'fgRef', 'audit');
    A.toast(`Đã roll forward ${S.d.fgOpen.stats.layers} lớp từ ${prev}. Bước tiếp: Validate.`, 'pass');
  } catch (e) { A.toast(e.message, 'block'); }
}
export function doValidateOpen() {
  const S = A.S;
  try {
    F5.validateOpeningFG(S.d.fgOpen, S.period);
    const st = S.d.fgOpen.stats;
    A.audit('STEP 5 - VALIDATE OPENING FG', `${S.d.fgOpen.status} | Layers=${st.layers}; Block=${st.block}; Review=${st.review}; Amount=${A.fmtNum(st.amt)}`);
    A.markDirty('fgOpen', 'audit');
    A.toast(`FG đầu kỳ: ${S.d.fgOpen.status} · BLOCK ${st.block} · REVIEW ${st.review}`, st.block ? 'block' : 'pass');
  } catch (e) { A.toast(e.message, 'block'); }
}
export async function doTemplate() {
  const S = A.S; const prev = prevPeriod(S.period);
  const pd = await A.loadPeriodData(prev);
  let rows = [];
  if (pd && pd.step5 && pd.step5.closing && confirm(`Điền sẵn template bằng FG cuối kỳ ${prev} (${pd.step5.closing.length} lớp)?`)) {
    rows = pd.step5.closing.map((c) => [c.pc, typeof c.date === 'number' ? serialToISO(c.date) : c.date, c.mo, c.prod, c.name, c.loc, c.unit, c.qty, c.rm, c.a622, c.a627, c.tot, c.price, c.prov, c.cons, `05_FG_CLOSING ${prev} | ${c.lid}`, '']);
  }
  await A.exportBook(`SVL_FG_Opening_Import_Template_v1_${S.period}.xlsx`, [{ name: 'FG_OPENING', aoa: [[F5.TPL_MARKER, 'v1', 'SVL - OPENING FINISHED GOODS BY PRODUCTION LOT (IMPORT TEMPLATE FOR STEP 5)'], ['Opening Period', '', S.period, 'Source Closing', prev, 'Prepared By', '', 'Prepared At'], ['Mỗi dòng là một lô còn tồn. Bắt buộc: PC No., Layer Date, Product Code, Qty, RM / 622 / 627 / Total Amount. Không đổi tiêu đề dòng 4 và dấu A1.'], F5.TPL_HEADERS, ...rows], cols: [15, 11, 17, 19, 32, 12, 7, 10, 17, 16, 16, 17, 11, 15, 13, 22, 24] }]);
}

// ======================= 5.2 FIFO COGS =======================
export function viewFIFO(el) {
  const S = A.S; const d = S.d; const D = A.derived(); const D5 = D.d5; const res = D5.res; const c = D5.controls;
  const conf = cfg(S); const tab = S.tab5 || 'sales'; const edit = A.canEdit();
  const T = res ? res.totals : null;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 5.2 · FIFO giá vốn &amp; FIFO rework</h1><p class="lead">FG đầu kỳ + nhập kho từ STEP 4 → xuất bán theo FIFO từng sản phẩm (lớp cũ nhất trước: ngày lô, đầu kỳ trước sản xuất). Sau đó FG xuất đi rework lấy tiếp theo FIFO từ lớp còn lại (5B).</p></div>
      <div class="result"><span>Kết quả</span>${A.pill(c.status)}<small>${esc(c.okText)}</small></div></header>
    <div class="row">
      <label>Chế độ FIFO <select id="s5-mode" ${edit ? '' : 'disabled'}>${['MONTHLY', 'STRICT_DATE'].map((m) => `<option ${conf.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label>Chi phí bán hàng ước tính (NRV) <input id="s5-rate" inputmode="decimal" value="${(sellRate(S) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}" ${edit ? '' : 'disabled'} style="width:70px;text-align:right"> % doanh thu</label>
      <button class="btn" data-act="s5-run" type="button">RUN FIFO COGS</button>
    </div>
    <p class="muted">${conf.mode === 'STRICT_DATE' ? '<b>STRICT_DATE</b> = FIFO theo ngày: dòng bán (ngày Bill / hoá đơn) và phiếu xuất rework (ngày xuất) chạy chung theo thứ tự thời gian; mỗi sự kiện chỉ dùng lớp có ngày ≤ ngày của nó.' : '<b>MONTHLY</b> = FIFO định kỳ theo tháng: cộng SL bán cả tháng của từng sản phẩm, lấy lớp cũ nhất trước, rồi chia giá vốn cho các dòng bán theo tỷ lệ SL. Tổng giá vốn tháng là FIFO; giá vốn từng hoá đơn là bình quân của tháng.'}</p>
    <div class="row">
      <span class="muted">${res ? `Chạy ${A.fmtTs(res.runAt)} · ${res.runSeconds}s · ${A.pill(D5.fresh)}` : ''}</span>
    </div>
    ${res && D5.fresh !== 'CURRENT' ? `<div class="alert review"><b>STEP 5 OUTDATED:</b> ${esc(D5.stale)}. Chạy lại theo thứ tự (STEP 4 nếu cần) → RUN FIFO COGS → BUILD FG HISTORY.</div>` : ''}
    ${D5.dups.pending ? `<div class="alert review">Còn <b>${D5.dups.pending}</b> dòng doanh thu nghi trùng trong kỳ chưa xác nhận – đang được tính FIFO như dòng thật (giống Excel). <a href="#sales">Xác nhận ở 4.1 → Nghi trùng</a>. Chưa xác nhận thì không đóng kỳ được.</div>` : ''}
    ${T ? `<div class="kpis">${A.kpi('FG đầu kỳ', T.openA)}${A.kpi('Nhập kho (STEP 4)', T.prodA)}${A.kpi('Giá vốn FIFO (632)', T.cogsA, true)}${A.kpi('Chuyển rework (5B)', num(T.rwTot))}${A.kpi('FG cuối kỳ', T.closeA, true)}</div>` : ''}
    <p class="muted">Việc tiếp theo: <b>${esc(c.next)}</b></p>
    <details ${String(c.status).startsWith('PASS') ? '' : 'open'}><summary>Checkpoint STEP 5 (${esc(c.okText)})</summary>${A.cpTable(c.rows)}</details>
    ${res ? tabsHTML(tab, [['sales', 'Giá vốn theo dòng bán'], ['detail', 'FIFO detail'], ['ledger', 'FG ledger'], ['closing', 'FG cuối kỳ'], ['sum', 'Tổng hợp theo SP'], ['rw', 'FIFO rework'], ['xnt', 'Nhập – xuất – tồn'], ['rec', 'Đối chiếu']], 'data-tab5') : ''}
    <div id="t5"></div></section>`;
  const modeSel = el.querySelector('#s5-mode');
  const rateIn = el.querySelector('#s5-rate');
  if (rateIn) rateIn.addEventListener('change', () => { if (!A.guardEdit()) return; const v = A.parseNum(rateIn.value, 'Tỷ lệ NRV'); if (v === undefined || v < 0 || v >= 100) { A.render(); return; } S.d.s5cfg = { ...cfg(S), sellCostRate: v / 100 }; A.audit('STEP 5 CONFIG', `NRV selling cost = ${v}%`); A.markDirty('s5cfg', 'audit'); A.render(); });
  modeSel.addEventListener('change', () => { if (!A.guardEdit()) return; S.d.s5cfg = { ...conf, mode: modeSel.value }; A.audit('STEP 5 CONFIG', `FIFO Mode = ${modeSel.value}`); A.markDirty('s5cfg', 'audit'); A.render(); });
  el.querySelectorAll('[data-tab5]').forEach((b) => b.addEventListener('click', () => { S.tab5 = b.dataset.tab5; A.render(); }));
  const box = el.querySelector('#t5');
  if (!res) { box.innerHTML = A.emptyNote('Chưa chạy FIFO COGS.'); return; }
  if (tab === 'sales') {
    const cols = colsOf(F5.SALES_FIELDS, F5.SALES_HEADERS, { date: 'date', qty: 'qty', usd: 'num', vnd: 'num', fq: 'qty', rm: 'num', c622: 'num', c627: 'num', tot: 'num', unit: 'num', status: 'status', seq: 'int', dbRow: 'int' }, { name: 220, msg: 260, key: 300, cust: 180 });
    const ov = d.fifoOverrides || {};
    const rows = res.sales.map((s) => ({ ...s, ovr: ov[s.key] || '' }));
    const ci = cols.findIndex((x) => x.key === 'ovr'); cols[ci] = { ...cols[ci], editable: edit, options: ['FIFO COGS', 'NO COGS', 'REVIEW'] };
    box.innerHTML = '<p class="muted">Cột Override Treatment là ô nhập duy nhất (FIFO COGS / NO COGS / REVIEW), giữ theo Line Key khi chạy lại. Thay đổi có hiệu lực ở lần RUN FIFO COGS tiếp theo.</p><div id="t5s"></div>';
    A.mountTable(box.querySelector('#t5s'), { columns: cols, rows, filterKey: 'status', height: 520, totals: ['qty', 'usd', 'vnd', 'fq', 'rm', 'c622', 'c627', 'tot'], onExport: A.exportTable('05_SALES_COGS', cols),
      onEdit: !edit ? undefined : (row, key, val) => { const o = S.d.fifoOverrides || (S.d.fifoOverrides = {}); if (val) o[row.key] = val; else delete o[row.key]; row.ovr = val; A.audit('STEP 5 OVERRIDE', `${row.key} = ${val || '(xoá)'}`); A.markDirty('fifoOverrides', 'audit'); } });
  } else if (tab === 'detail') {
    const cols = colsOf(F5.DETAIL_FIELDS, F5.DETAIL_HEADERS, { date: 'date', layerQty: 'qty', qty: 'qty', rm: 'num', a622: 'num', a627: 'num', tot: 'num', unit: 'num', left: 'qty', seq: 'int', line: 'int' }, { lid: 220 });
    A.mountTable(box, { columns: cols, rows: res.detail, filterKey: 'take', height: 520, totals: ['qty', 'rm', 'a622', 'a627', 'tot'], onExport: A.exportTable('05_FIFO_DETAIL', cols) });
  } else if (tab === 'ledger') {
    const cols = colsOf(F5.LEDGER_FIELDS, F5.LEDGER_HEADERS, { date: 'date', qtyIn: 'qty', rm: 'num', a622: 'num', a627: 'num', tot: 'num', unitCost: 'num', qtyOut: 'qty', rmOut: 'num', o622: 'num', o627: 'num', totOut: 'num', remQ: 'qty', remTot: 'num', seq: 'int' }, { lid: 220, name: 220, flag: 260 });
    A.mountTable(box, { columns: cols, rows: res.ledger, filterKey: 'source', height: 520, totals: ['qtyIn', 'tot', 'qtyOut', 'totOut', 'remQ', 'remTot'], onExport: A.exportTable('05_FG_LEDGER', cols) });
  } else if (tab === 'closing') {
    const cols = [...colsOf(F5.LAYER_FIELDS, F5.LAYER_HEADERS, LAYER_T, LAYER_W), { key: 'nrvUnit', label: 'NRV / đv (VND)', type: 'num', width: 120 }, { key: 'provNeed', label: 'Dự phòng đề xuất (VND)', type: 'num', width: 150 }];
    A.mountTable(box, { columns: cols, rows: res.closing, filterKey: 'status', height: 520, totals: ['qty', 'rm', 'a622', 'a627', 'tot', 'provNeed'], onExport: A.exportTable('05_FG_CLOSING', cols) });
    box.insertAdjacentHTML('afterbegin', `<p class="muted">NRV = giá bán (Price Master × tỷ giá) × (1 − ${(sellRate(S) * 100).toLocaleString('vi-VN')}% chi phí bán hàng ước tính). Dự phòng đề xuất = (giá thành sau dự phòng cũ − NRV) × SL tồn, chỉ khi dương. Tổng: <b>${A.fmtNum(res.totals.nrvProv || 0)}</b> VND.</p>`);
  } else if (tab === 'sum') {
    const t = { openQ: 'qty', openA: 'num', prodQ: 'qty', prodA: 'num', cogsQ: 'qty', cogsRM: 'num', cogs622: 'num', cogs627: 'num', cogsA: 'num', closeQ: 'qty', closeA: 'num', eligQ: 'qty', layers: 'int', status: 'status', rwQ: 'qty', rwRM: 'num', rw622: 'num', rw627: 'num', rwTot: 'num', rollStatus: 'status' };
    const cols = colsOf(F5.SUM_FIELDS, F5.SUM_HEADERS, t, { name: 220, msg: 220 });
    A.mountTable(box, { columns: cols, rows: res.summary, filterKey: 'status', height: 520, totals: ['openQ', 'openA', 'prodQ', 'prodA', 'cogsQ', 'cogsA', 'closeQ', 'closeA', 'rwQ', 'rwTot'], onExport: A.exportTable('05_COGS_SUMMARY', cols) });
  } else if (tab === 'rw') {
    const rw = res.rework;
    if (!rw) { box.innerHTML = A.emptyNote('Kỳ này không có FG xuất rework (sổ 2B trống).'); return; }
    const rr = (r) => `<tr><td>${esc(r.label)}</td><td class="r">${A.cpVal(r.expected)}</td><td class="r">${A.cpVal(r.result)}</td><td class="r">${A.cpVal(r.diff)}</td><td>${A.pill(r.status)}</td><td class="muted">${esc(r.note || '')}</td></tr>`;
    box.innerHTML = `<h2>Batch 8 – FIFO rework <small>${A.pill(rw.gate8)}</small></h2><table class="cp"><thead><tr><th>Kiểm soát</th><th class="r">Kỳ vọng / Nguồn</th><th class="r">Kết quả</th><th class="r">Chênh lệch</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${rw.batch8.map(rr).join('')}</tbody></table>
      <h2>Kiểm soát rework</h2><table class="cp"><tbody>${rw.control.map((r) => `<tr><td>${esc(r.label)}</td><td class="r">${A.cpVal(r.value)}</td><td class="muted">${esc(r.note)}</td><td>${A.pill(r.status)}</td></tr>`).join('')}</tbody></table>
      <h2>Chi tiết FIFO rework</h2><div id="t5r"></div>`;
    const cols = colsOf(F5.RWF_FIELDS, F5.RWF_HEADERS, { issueDate: 'date', layerDate: 'date', layerQty: 'qty', qty: 'qty', rm: 'num', a622: 'num', a627: 'num', tot: 'num', unit: 'num', seq: 'int' }, { rid: 280, lid: 220 });
    A.mountTable(box.querySelector('#t5r'), { columns: cols, rows: rw.rows, height: 360, totals: ['qty', 'rm', 'a622', 'a627', 'tot'], onExport: A.exportTable('05_FG_REWORK_FIFO', cols) });
  } else if (tab === 'xnt') {
    const rf = res.rollforward || { rows: [], total: {} };
    const t = Object.fromEntries(['openQ', 'inQ', 'outQ', 'balQ', 'chkQ'].map((k) => [k, 'qty']).concat(['openA', 'inA', 'outA', 'balA', 'chkA'].map((k) => [k, 'num'])));
    const cols = colsOf(F5.XNT_FIELDS, F5.XNT_HEADERS, t, { name: 260 });
    box.innerHTML = '<p class="muted">Tồn kho thành phẩm theo mã (đầu kỳ / nhập / xuất bán / tồn). Cột “check vs lots” = phần chênh với tồn theo lô – khác 0 khi có FG xuất rework.</p><div id="t5x"></div>';
    A.mountTable(box.querySelector('#t5x'), { columns: cols, rows: rf.rows, height: 520, totals: ['openQ', 'openA', 'inQ', 'inA', 'outQ', 'outA', 'balQ', 'balA', 'chkQ', 'chkA'], onExport: A.exportTable('05_FG_ROLLFORWARD', cols) });
  } else if (tab === 'rec') {
    box.innerHTML = recTable(res.rec, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], REC_LABELS) + `<p class="muted">Run snapshot: chế độ ${esc(res.mode)} · ${res.openLayers} lớp đầu kỳ · override dùng ${res.overridesUsed} · kết quả ${esc(res.runResult)}</p>`;
  }
}
const REC_LABELS = { 4: 'Opening FG validation', 5: 'STEP 4 output current & passed', 6: 'Production layers vs STEP 4 total cost', 7: 'Production qty vs STEP 4 complete qty', 8: 'Qty roll-forward', 9: 'Amount roll-forward', 10: 'Component roll-forward RM / 622 / 627', 11: 'FIFO qty = eligible sales qty', 12: 'Sales line COGS = FIFO detail total', 13: 'Products with insufficient FG', 14: 'Layers with negative remaining qty', 15: 'Sales lines needing review', 16: 'Closing lots with unit cost above selling price' };
function recTable(rec, keys, labels) {
  return `<table class="cp"><thead><tr><th>Kiểm soát</th><th class="r">Kỳ vọng / Nguồn</th><th class="r">Kết quả</th><th class="r">Chênh lệch</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>
    ${keys.filter((k) => rec[k]).map((k) => { const r = rec[k]; return `<tr><td>${esc(r.label || labels[k] || k)}</td><td class="r">${A.cpVal(r.expected)}</td><td class="r">${A.cpVal(r.result)}</td><td class="r">${r.diff === '' ? '' : A.cpVal(r.diff)}</td><td>${A.pill(r.status)}</td><td class="muted">${esc(r.note || '')}</td></tr>`; }).join('')}</tbody></table>`;
}

/** Aggregated invoice+product FIFO origins of up to 12 earlier periods – authoritative source cost for Sales Return. */
async function priorSalesFor(S) {
  const rows = S.d.salesDB ? S.d.salesDB.rows : [];
  const pS = S.period;
  if (!rows.some((r) => utxt(r.tranType) === 'SALES RETURN' && num(r.qty) < 0 && F5.saleDate(r) !== null && serialToISO(F5.saleDate(r)).slice(0, 7) === pS)) return [];
  const origins = new Map(), returned = new Map(); let p = pS;
  const keyOf = (inv, prod) => `${utxt(inv)}|${utxt(prod)}`;
  for (let k = 0; k < 12; k++) {
    p = prevPeriod(p);
    const pd = await A.loadPeriodData(p).catch(() => null);
    const r5 = pd && pd.step5 && pd.step5.period === p ? pd.step5 : null;
    if (!r5) continue;
    for (const x of r5.sales || []) {
      if (x.fin === 'FIFO COGS' && num(x.fq) > 0 && ttxt(x.inv) && ttxt(x.prod)) {
        const key = keyOf(x.inv, x.prod), o = origins.get(key);
        if (o) {
          o.fq += num(x.fq); o.rm += num(x.rm); o.c622 += num(x.c622); o.c627 += num(x.c627); o.tot += num(x.tot);
          o.date = Math.min(num(o.date), num(x.date));
        } else origins.set(key, { inv: x.inv, cust: x.cust, prod: x.prod, date: x.date, fq: num(x.fq), rm: num(x.rm), c622: num(x.c622), c627: num(x.c627), tot: num(x.tot), period: p });
      }
      if (x.fin === 'RETURN' && x.status === 'RETURNED' && ttxt(x.origInv) && num(x.fq) < 0) {
        const key = keyOf(x.origInv, x.prod);
        returned.set(key, (returned.get(key) || 0) + -num(x.fq));
      }
    }
  }
  return [...origins.entries()].map(([key, o]) => ({ ...o, returned: returned.get(key) || 0 }));
}
export async function doRunFIFO() {
  const S = A.S; const d = S.d;
  if (closedGuard()) return;
  const D4 = P2.derive(S).d4; const fl = D4.fl;
  if (!fl) { A.toast('Chưa có kết quả STEP 4.', 'block'); return; }
  const conf = cfg(S);
  const gate = F5.reworkGate(d.register, d.salesDB ? d.salesDB.rows : [], S.period, conf.mode);
  if (gate) { A.toast('FG Rework FIFO không chạy: ' + gate, 'block'); return; }
  const before = snap(S, D4);
  const priorSales = await priorSalesFor(S);
  try {
    const res = F5.runFIFO({ priorSales, sellCostRate: sellRate(S), period: S.period, opening: d.fgOpen, caRows: fl.rows, salesRows: d.salesDB ? d.salesDB.rows : [], pmRows: d.pm ? d.pm.rows : [], fx: d.gl ? d.gl.fx : 0, register: d.register, overrides: d.fifoOverrides || {}, dupDecisions: d.dupDecisions || {}, mode: conf.mode, tol: conf.tol,
      step4: { current: D4.freshness, overall: fl.overall, finalCost: fl.totals.totalCost, qty: d.step4.totalQty } });
    let rwMsg = '';
    if (F5.reworkCount(d.register)) {
      F5.runReworkFIFO(res, d.register, { period: S.period, opening: d.fgOpen, salesRows: d.salesDB ? d.salesDB.rows : [], step4Carry: fl.totals.carryIn });
      rwMsg = `; Rework=${A.fmtNum(res.rework.fifoCost)}`;
    }
    F5.finalizeRun(res);
    const rf = F5.buildRollforward(res, d.fgOpen, d.fgItems);
    res.rollforward = { rows: rf.rows, total: rf.total }; d.fgItems = rf.items;
    res.snap = before;
    d.step5 = res;
    refreshFgRef(S);
    try { P2.runLotCheck(); } catch { /* lot check is review-only */ }
    const after = P2.derive(S).d4.fl;
    const step4Changed = after && Math.abs(after.totals.carryIn - fl.totals.carryIn) > 1;
    A.audit('STEP 5 - RUN FIFO COGS', `${res.runResult} | Mode=${res.mode}; Open=${A.fmtNum(res.totals.openA)}; Prod=${A.fmtNum(res.totals.prodA)}; COGS=${A.fmtNum(res.totals.cogsA)}${rwMsg}; Close=${A.fmtNum(res.totals.closeA)}; Lines=${res.stats.lines}`);
    A.markDirty('step5', 'register', 'fgItems', 'fgRef', 'lotCheck', 'audit');
    if (step4Changed) A.toast('FIFO rework đã tính, nhưng giá trị rework hoàn thành chuyển vào STEP 4 vừa thay đổi → giá thành STEP 4 đổi. Chạy RUN FIFO COGS thêm một lần nữa.', 'review');
    else A.toast(`FIFO xong: ${res.runResult}. COGS ${A.fmtNum(res.totals.cogsA)} · FG cuối kỳ ${A.fmtNum(res.totals.closeA)} VND.`, res.runResult === 'BLOCKED' ? 'block' : 'pass');
  } catch (e) { A.toast('STEP 5 dừng: ' + e.message, 'block'); }
}
function refreshFgRef(S) {
  const d = S.d;
  const ref = { opening: [], closingQty: {} };
  for (const r of (d.fgOpen && d.fgOpen.rows) || []) if (ttxt(r.lid)) ref.opening.push({ prod: r.prod, qty: r.qty, rm: r.rm });
  if (d.step5 && d.step5.period === S.period) for (const c of d.step5.closing) { const k = ttxt(c.pc) + '|' + ttxt(c.prod); ref.closingQty[k] = num(ref.closingQty[k]) + num(c.qty); }
  else if (d.fgRef) ref.closingQty = d.fgRef.closingQty || {};
  d.fgRef = ref;
}

// ======================= 5.3 FG History & close =======================
function nrvDecisionHTML(S, res, closed) {
  const amt = num(res.totals && res.totals.nrvProv), key = nrvKey(res);
  const d = S.d.nrvDecision, current = d && d.key === key;
  const summary = current ? `<div class="alert info"><b>NRV: ${esc(d.status)}</b> · yêu cầu ${A.fmtNum(d.amount)} VND${utxt(d.status) === 'RECORDED' ? ' · đã ghi ' + A.fmtNum(num(d.recordedAmount ?? d.amount)) + ' VND' : ''} · ${esc(d.by || '')} · ${A.fmtTs(d.at)}${d.ref ? ' · Ref ' + esc(d.ref) : ''}<br><span class="muted">${esc(d.note || '')}</span></div>` : `<div class="alert review"><b>NRV provision đề xuất: ${A.fmtNum(amt)} VND.</b> Cần quyết định kế toán trước khi CLOSE MONTH. Quyết định cũ (nếu có) không còn hiệu lực khi số liệu STEP 5 thay đổi.</div>`;
  if (closed || !A.isAdmin() || !A.canEdit()) return summary;
  return summary + `<form id="f-nrv-decision" class="inline"><label>NRV decision <select name="status"><option value="">-- chọn --</option><option>RECORDED</option><option>NO ADJUSTMENT APPROVED</option></select></label><label>Số đã ghi FAST (VND)<input name="recordedAmount" inputmode="decimal" value="${A.fmtNum(amt)}"></label><label>Accounting Ref<input name="ref" placeholder="JV / FAST ref"></label><label style="flex:1">Giải trình<input name="note" placeholder="Lý do / bằng chứng review" style="min-width:260px"></label><button class="btn" type="submit">Lưu quyết định NRV</button></form>`;
}
export function viewClose(el) {
  const S = A.S; const d = S.d; const D5 = A.derived().d5; const { recon, hg, res } = D5;
  const closed = d.closed && d.closed.period === S.period;
  const H = d.fgHistory; const tab = S.tabH || 'gate';
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 5.3 · FG History &amp; đóng kỳ</h1><p class="lead">FG History lưu toàn bộ lịch sử lô đã bán (cộng dồn qua các kỳ) và ảnh chụp FG cuối kỳ. Đóng kỳ chỉ được khi STEP 5 CURRENT, Batch 7 PASS, FG History khớp và Final Production Status = READY.</p></div>
      <div class="result"><span>Final status</span>${A.pill(closed ? 'CLOSED' : recon.finalStatus)}<small>${closed ? `Đóng ${A.fmtTs(d.closed.closedAt)}` : `Cổng đóng kỳ: ${esc(recon.closeGate)}`}</small></div></header>
    ${closed ? `<div class="alert pass"><b>Kỳ ${esc(S.period)} đã đóng</b> lúc ${A.fmtTs(d.closed.closedAt)} bởi ${esc(d.closed.closedBy)} · trạng thái ${esc(d.closed.status)}. Tạo kỳ ${esc(nextP(S.period))} rồi Roll forward FG đầu kỳ.</div>` : ''}
    <div class="row">
      <button class="btn" data-act="s5-hist" type="button" ${res ? '' : 'disabled'}>BUILD FG HISTORY</button>
      <button class="btn" data-act="s5-close" type="button" ${closed || !A.isAdmin() ? 'disabled' : ''} title="${A.isAdmin() ? '' : 'Chỉ quản trị viên được đóng kỳ'}">CLOSE MONTH${A.isAdmin() ? '' : ' (quản trị viên)'}</button>
      ${closed && A.isAdmin() ? '<button class="btn danger ghost" data-act="s5-reopen" type="button">Mở lại kỳ…</button>' : ''}
      <span class="muted">${H ? `History đến ${esc(H.through)} · tạo ${A.fmtTs(H.builtAt)}` : 'Chưa có FG History.'}</span>
    </div>
    ${!closed && D5.closeReason && res ? `<div class="alert review"><b>Chưa đóng được:</b> ${esc(D5.closeReason)}</div>` : ''}
    ${res && num(res.totals && res.totals.nrvProv) > 1 ? nrvDecisionHTML(S, res, closed) : ''}
    <div class="kpis">${A.kpiN('Dòng history', H ? H.rows.length : null)}${A.kpiN('Đã bán các kỳ trước', hg.prior)}${A.kpiN('COGS kỳ này (lớp)', hg.curCOGS)}${A.kpiN('FG cuối kỳ (lớp)', hg.curClose)}<div class="kpi"><span>Archive gate</span><b>${A.pill(hg.gate)}</b></div></div>
    ${tabsHTML(tab, [['gate', 'Cổng đóng kỳ'], ['fast', `Đối chiếu FAST${D5.tie ? ' · ' + (D5.tie.status === 'PASS' ? 'khớp' : D5.tie.status === 'APPROVED' ? 'đã xác nhận' : D5.tie.status === 'NOT ENTERED' ? 'chưa nhập' : 'lệch') : ''}`], ['hist', 'FG History'], ['b7', 'Batch 7 – giá thành → FIFO']], 'data-tabh')}
    <div id="th"></div></section>`;
  const nf = el.querySelector('#f-nrv-decision');
  if (nf) nf.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!A.isAdmin() || !A.canEdit()) { A.toast('Chỉ Quản trị viên được xác nhận xử lý NRV.', 'block'); return; }
    const status = utxt(nf.elements.status.value), ref = nf.elements.ref.value.trim(), note = nf.elements.note.value.trim();
    if (!['RECORDED', 'NO ADJUSTMENT APPROVED'].includes(status)) { A.toast('Chọn quyết định NRV.', 'review'); return; }
    let recordedAmount = 0;
    if (status === 'RECORDED') {
      recordedAmount = A.parseNum(nf.elements.recordedAmount.value, 'Số NRV đã ghi FAST');
      if (recordedAmount === undefined || recordedAmount === null) return;
      if (ref.length < 3) { A.toast('NRV RECORDED cần Accounting Reference / Journal No.', 'review'); return; }
    }
    if (note.length < 5) { A.toast('Nhập giải trình NRV ít nhất 5 ký tự.', 'review'); return; }
    S.d.nrvDecision = { key: nrvKey(res), status, ref, note, amount: num(res.totals.nrvProv), recordedAmount, by: A.who(), at: nowISO() };
    A.audit('NRV DECISION', `${status}; required=${A.fmtNum(res.totals.nrvProv)}; recorded=${A.fmtNum(recordedAmount)}; ref=${ref || '-'}; ${note}`);
    A.markDirty('nrvDecision', 'audit'); A.render();
  });
    el.querySelectorAll('[data-tabh]').forEach((b) => b.addEventListener('click', () => { S.tabH = b.dataset.tabh; A.render(); }));
  const box = el.querySelector('#th');
  if (tab === 'gate') {
    box.innerHTML = `<h2>Đối chiếu YTD 622 / 627 (chỉ review)</h2>${recTable(recon.rows, [20, 21, 22], {})}
      <h2>FG History / roll forward <small>${A.pill(recon.closeGate)}</small></h2>${recTable(recon.rows, [31, 32, 33, 34, 35, 36, 37], {})}
      <h2>Final production readiness <small>${A.pill(recon.finalStatus)}</small></h2>${recTable(recon.rows, [43, 44, 45, 46, 47, 48], {})}
      <h2>Kiểm soát archive FG History <small>${A.pill(hg.gate)}</small></h2><table class="cp"><thead><tr><th>Chỉ tiêu</th><th class="r">FG History</th><th class="r">STEP 5</th><th class="r">Chênh lệch</th></tr></thead><tbody>${hg.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="r">${A.cpVal(r.hist)}</td><td class="r">${A.cpVal(r.step5)}</td><td class="r">${A.cpVal(r.diff)}</td></tr>`).join('')}</tbody></table>`;
  } else if (tab === 'fast') {
    fastTab(box, D5, closed);
  } else if (tab === 'b7') {
    box.innerHTML = `<h2>Batch 7 <small>${A.pill(recon.batch7)}</small></h2>${recTable(recon.rows, [53, 54, 55, 56, 57, 58, 59], {})}`;
  } else {
    if (!H) { box.innerHTML = A.emptyNote('Chưa BUILD FG HISTORY.'); return; }
    const t = { date: 'date', qty: 'qty', rmSrc: 'num', rmST: 'num', tot: 'num', rm: 'num', a622: 'num', a627: 'num', price: 'qty', costMonth: 'int', provVND: 'num', net: 'num', hStatus: 'status' };
    const cols = colsOf(F5.HIST_FIELDS, F5.HIST_HEADERS, t, { name: 220, lid: 220 });
    A.mountTable(box, { columns: cols, rows: H.rows, filterKey: 'hStatus', height: 520, totals: ['qty', 'tot', 'rm', 'a622', 'a627'], onExport: A.exportTable('05_FG_HISTORY', cols) });
  }
}
function fastTab(box, D5, closed) {
  const S = A.S; const d = S.d; const tie = D5.tie;
  if (!tie) { box.innerHTML = A.emptyNote('Chạy RUN FIFO COGS trước để có số dư cuối kỳ.', 'step5', 'Mở STEP 5.2'); return; }
  const edit = !closed && A.canEdit();
  const ft = d.fastTie && d.fastTie.period === S.period ? d.fastTie : null;
  const maker = ft ? String(ft.by || '').trim().toLowerCase() : '';
  const checker = String(A.who() || '').trim().toLowerCase();
  const canApproveDiff = edit && A.isAdmin() && !!ft && maker !== checker;
  box.innerHTML = `<p class="muted">Nhập số dư / phát sinh trên FAST (sổ cái) để đối chiếu với kết quả giá thành. Lệch > 1 VND phải được Quản trị viên khác người nhập FAST xác nhận kèm giải trình trước khi đóng kỳ; xác nhận tự hết hiệu lực nếu số liệu hai bên thay đổi.</p>
    <form id="f-fast" autocomplete="off"><table class="cp"><thead><tr><th>TK</th><th>Nội dung</th><th class="r">Theo giá thành (web)</th><th class="r">Số FAST</th><th class="r">Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>
    ${tie.rows.map((r) => `<tr><td><b>${r.acc}</b></td><td>${esc(r.label)}</td><td class="r">${A.fmtNum(r.engine)}</td><td class="r"><input name="${r.k}" inputmode="decimal" value="${r.fast === null ? '' : A.fmtNum(r.fast)}" ${edit ? '' : 'disabled'} aria-label="Số FAST TK ${r.acc}" style="text-align:right;max-width:180px"></td><td class="r">${r.diff === null ? '' : A.fmtNum(r.diff)}</td><td>${A.pill(r.status === 'DIFF' ? 'REVIEW' : r.status)}</td></tr>`).join('')}
    </tbody></table>${edit ? '<div class="row"><button class="btn" type="submit">Lưu số FAST</button></div>' : ''}</form>
    ${ft ? `<p class="muted">Nhập bởi ${esc(ft.by || '')} lúc ${A.fmtTs(ft.enteredAt)}.</p>` : ''}
    ${tie.diffs ? (tie.approved ? `<div class="alert info"><b>Chênh lệch đã được xác nhận</b> bởi ${esc(tie.approval.by)} lúc ${A.fmtTs(tie.approval.at)}: ${esc(tie.approval.note)}</div>`
      : `<div class="alert review"><b>${tie.diffs} tài khoản lệch FAST.</b> Kiểm tra nguyên nhân (bút toán chưa ghi, điều chỉnh tay trên FAST, chênh làm tròn…) rồi xác nhận.${canApproveDiff && tie.entered ? `<form id="f-fast-ok" class="row" style="margin-top:8px"><input name="note" placeholder="Giải trình chênh lệch (bắt buộc)" style="flex:1;min-width:240px"><button class="btn" type="submit">Quản trị xác nhận chênh lệch</button></form>` : `<div class="muted">Maker-checker: chênh lệch phải được Quản trị viên khác người nhập FAST xác nhận.</div>`}</div>`) : tie.entered ? '<div class="alert pass">Khớp FAST ở cả 5 tài khoản.</div>' : ''}`;
  const f = box.querySelector('#f-fast');
  if (f && edit) f.addEventListener('submit', (e) => {
    e.preventDefault(); if (closedGuard()) return;
    const fast = {};
    for (const r of tie.rows) { const raw = f.elements[r.k].value.trim(); if (raw === '') continue; const v = A.parseNum(raw, 'TK ' + r.acc); if (v === undefined) return; fast[r.k] = v; }
    d.fastTie = { period: S.period, fast, enteredAt: nowISO(), by: A.who(), approval: ft && ft.approval ? ft.approval : null };
    A.audit('FAST TIE INPUT', F5.FAST_ACCOUNTS.map(([k, acc]) => `${acc}=${fast[k] ?? ''}`).join('; '));
    A.markDirty('fastTie', 'audit'); A.render();
  });
  const ok = box.querySelector('#f-fast-ok');
  if (ok) ok.addEventListener('submit', (e) => {
    e.preventDefault(); if (closedGuard()) return;
    if (!A.isAdmin() || maker === checker) { A.toast('Maker-checker: Quản trị viên xác nhận phải khác người nhập số FAST.', 'block'); return; }
    const note = ok.elements.note.value.trim();
    if (note.length < 5) { A.toast('Nhập giải trình chênh lệch (ít nhất 5 ký tự).', 'review'); return; }
    d.fastTie.approval = { key: tie.key, by: A.who(), at: nowISO(), note, diffs: tie.rows.filter((r) => r.status === 'DIFF').map((r) => ({ acc: r.acc, diff: r.diff })) };
    A.audit('FAST TIE APPROVE', `${note} · ${d.fastTie.approval.diffs.map((x) => `${x.acc}: ${A.fmtNum(x.diff)}`).join('; ')}`);
    A.markDirty('fastTie', 'audit'); A.render();
  });
}
export function doBuildHistory() {
  const S = A.S; const d = S.d; const D5 = derive(S, P2.derive(S));
  if (closedGuard()) return;
  const { recon, res } = D5;
  if (!res) { A.toast('Chưa chạy FIFO COGS.', 'block'); return; }
  if (recon.c17 !== 'CURRENT' || !recon.e18.startsWith('PASS')) { A.toast(`FG History KHÔNG được tạo: STEP 5 chưa CURRENT (${recon.c17} / ${recon.e18}). Chạy lại RUN FIFO COGS.`, 'block'); return; }
  if (recon.batch7 !== 'PASS') { A.toast(`FG History KHÔNG được tạo: Batch 7 = ${recon.batch7}.`, 'block'); return; }
  if (F5.reworkCount(d.register) && (!res.rework || res.rework.gate8 !== 'PASS')) { A.toast(`BUILD FG HISTORY bị chặn: FG Rework Batch 8 = ${res.rework ? res.rework.gate8 : 'NOT RUN'}.`, 'block'); return; }
  try {
    const fl = P2.derive(S).d4.fl;
    const h = F5.buildHistory(res, d.fgHistory ? d.fgHistory.rows : [], { period: S.period, opening: d.fgOpen, caRows: fl ? fl.rows : [] });
    const g = F5.historyGate(h, res, S.period);
    if (g.gate !== 'PASS') throw new Error(`FG History không khớp (gate ${g.gate}).`);
    d.fgHistory = h;
    A.audit('STEP 5 - BUILD FG HISTORY', `PASS; Current COGS=${h.nCOGS}; Closing=${h.nClose}; Historical Sold=${h.nKeep}`);
    A.markDirty('fgHistory', 'audit');
    A.toast(`FG History: ${h.rows.length} dòng (COGS kỳ này ${h.nCOGS}, FG cuối kỳ ${h.nClose}, đã bán trước ${h.nKeep}). Archive gate PASS.`, 'pass');
  } catch (e) { A.toast('BUILD FG HISTORY lỗi: ' + e.message, 'block'); }
}
export async function doClose() {
  const S = A.S; const d = S.d; const D5 = derive(S, P2.derive(S));
  // audit F-16: closing is an approval step – administrators only (reopen already is)
  if (!A.isAdmin()) { A.toast('Chỉ quản trị viên được CLOSE MONTH. Người lập chuẩn bị số liệu; quản trị viên kiểm tra và đóng kỳ.', 'review'); return; }
  if (D5.closeReason) { A.toast('CLOSE MONTH bị chặn: ' + D5.closeReason, 'block'); return; }
  const { recon } = D5;
  let msg = `Đóng kỳ kế toán ${S.period}?\n\nFinal Production Status: ${recon.finalStatus}\nMonth Close Gate: ${recon.closeGate}\nFG History: PASS\nBatch 7: PASS`;
  if (recon.finalStatus.includes('REVIEW') || recon.closeGate.includes('REVIEW')) msg += '\n\nKỳ này còn mục REVIEW. Xác nhận đã được quản lý review trước khi đóng.';
  if (!confirm(msg)) return;
  const prevArchive = d.rwArchive;
  const exceptions = [];
  for (const [no, r] of Object.entries(recon.rows || {})) if (String(r && r.status || '').startsWith('REVIEW')) exceptions.push({ control: no, label: r.label || '', status: r.status, expected: r.expected ?? '', result: r.result ?? '', diff: r.diff ?? '', note: r.note || '' });
  if (D5.tie && D5.tie.diffs) exceptions.push({ control: 'FAST', label: 'FAST reconciliation', status: D5.tie.status, result: D5.tie.rows.filter((r) => r.status === 'DIFF').map((r) => `${r.acc}:${r.diff}`).join('; '), note: D5.tie.approval ? D5.tie.approval.note : '' });
  if (d.nrvDecision) exceptions.push({ control: 'NRV', label: 'NRV decision', status: d.nrvDecision.status, result: d.nrvDecision.amount, note: d.nrvDecision.note || '', ref: d.nrvDecision.ref || '' });
  d.closedEver = true;
  d.closed = { period: S.period, closedAt: nowISO(), closedBy: A.who(), status: recon.finalStatus, closeGate: recon.closeGate, runAt: d.step5.runAt, note: `FG History PASS; Close Gate=${recon.closeGate}; Batch7=PASS`, exceptions };
  d.rwArchive = F5.archiveReworkWIP(d.register, S.period);
  const arcCost = d.rwArchive.reduce((a, r) => a + num(r.carryCost), 0);
  A.audit('STEP 5 - CLOSE MONTH', `${recon.finalStatus}; ${recon.closeGate}; FG HISTORY PASS`);
  A.audit('STEP 5B - REWORK WIP CARRY-FORWARD', `Rows=${d.rwArchive.length}; carrying cost=${A.fmtNum(arcCost, 2)}`);
  A.markDirty('closed', 'closedEver', 'rwArchive', 'audit');
  // audit F-25: with cloud sync, the close only stands once the cloud has committed it
  if (A.cloudOn()) {
    A.toast('Đang ghi trạng thái ĐÓNG KỲ lên cloud…', 'review');
    const r = await A.syncNow();
    if (!r.ok) {
      d.closed = null; d.rwArchive = prevArchive;
      A.audit('STEP 5 - CLOSE MONTH FAILED', `Cloud chưa xác nhận: ${r.error}`);
      A.markDirty('closed', 'rwArchive', 'audit');
      A.toast(`CHƯA đóng kỳ: cloud không xác nhận (${r.error}). Kiểm tra kết nối / xung đột rồi CLOSE MONTH lại.`, 'block');
      A.render(); return;
    }
  }
  A.toast(`Kỳ ${S.period} đã ĐÓNG${A.cloudOn() ? ' (cloud đã xác nhận)' : ''}. Rework WIP chuyển kỳ: ${d.rwArchive.length} dòng / ${A.fmtNum(arcCost)} VND. Bước tiếp: tạo kỳ ${nextP(S.period)} → Roll forward.`, 'pass');
  A.render();
}
export async function doReopen() {
  const S = A.S;
  if (!A.isAdmin()) { A.toast('Chỉ quản trị viên được mở lại kỳ đã đóng.', 'review'); return; }
  const np = nextP(S.period);
  const nd = await A.loadPeriodData(np).catch(() => null);
  if (nd && nd.closed && nd.closed.period === np) {
    A.toast(`Không thể mở lại ${S.period}: kỳ kế tiếp ${np} đã ĐÓNG và đang phụ thuộc số dư cuối kỳ này. Mở lại ${np} trước, sau đó mới mở lại ${S.period}.`, 'block');
    return;
  }
  const reason = (prompt(`Mở lại kỳ ${S.period} đã đóng (để sửa số liệu). Nhập lý do:`, '') || '').trim();
  if (!reason) return;
  const was = S.d.closed;
  S.d.closed = null;
  A.markDirty('closed');
  if (A.cloudOn()) {
    A.toast('Đang ghi revision MỞ LẠI KỲ lên cloud…', 'review');
    const r = await A.syncNow();
    if (!r.ok) {
      S.d.closed = was;
      A.markDirty('closed');
      A.toast(`CHƯA mở lại kỳ: cloud không xác nhận (${r.error}).`, 'block');
      A.render(); return;
    }
  }
  S.d.closedEver = true;
  A.audit('STEP 5 - REOPEN PERIOD', `${reason} (đóng lúc ${was ? was.closedAt : '?'} bởi ${was ? was.closedBy : '?'})`);
  A.markDirty('closedEver', 'audit');
  A.toast(`Đã mở lại kỳ ${S.period}${A.cloudOn() ? ' (cloud đã xác nhận)' : ''}. Sau khi sửa: RUN FIFO → BUILD FG HISTORY → CLOSE MONTH.`, 'pass');
}

// ======================= migration / carry-forward =======================
export async function migratePhase3(g, S, period) {
  const d = S.d; const cell = (gr, r, c) => (gr && gr[r - 1] ? gr[r - 1][c - 1] : null);
  const oG = g['05_FG_OPENING'];
  if (oG) {
    const rows = [];
    for (let r = 5; r < oG.length; r++) { const x = oG[r] || []; if (!ttxt(x[2])) continue; rows.push(Object.fromEntries(F5.LAYER_FIELDS.map((f, i) => [f, x[i] ?? null]))); }
    d.fgOpen = { period, status: txt(cell(oG, 2, 2)) || 'LOADED - NOT VALIDATED', loadedAt: nowISO(), source: txt(cell(oG, 2, 6)), srcKind: 'MIGRATED', validatedAt: '', rows, stats: {} };
    if (rows.length) F5.validateOpeningFG(d.fgOpen, period);
  }
  const sG = g['05_SALES_COGS'];
  d.fifoOverrides = {};
  if (sG) for (let r = 5; r < sG.length; r++) { const x = sG[r] || []; if (ttxt(x[22]) && ttxt(x[12])) d.fifoOverrides[ttxt(x[22])] = utxt(x[12]); }
  const rG = g['05_RECONCILIATION'];
  d.s5cfg = { mode: utxt(cell(rG, 3, 12)) === 'STRICT_DATE' ? 'STRICT_DATE' : 'MONTHLY', tol: num(cell(rG, 4, 12)) || 1 };
  const xG = g['05_FG_ROLLFORWARD'];
  d.fgItems = [];
  if (xG) for (let r = 4; r < xG.length; r++) { const x = xG[r] || []; if (ttxt(x[0])) d.fgItems.push({ code: utxt(x[0]), name: ttxt(x[1]), unit: ttxt(x[2]) }); }
  const hG = g['05_FG_HISTORY']; let prevHist = [];
  if (hG) for (let r = 5; r < hG.length; r++) { const x = hG[r] || []; if (!ttxt(x[22]) && !ttxt(x[0])) continue; prevHist.push(Object.fromEntries(F5.HIST_FIELDS.map((f, i) => [f, x[i] ?? null]))); }
  const histThrough = ttxt(cell(hG, 2, 2));
  d.fgHistory = prevHist.length ? { through: histThrough, builtAt: '', rows: prevHist, nKeep: 0, nCOGS: 0, nClose: 0 } : null;
  let msg = '';
  try {
    if (d.fgOpen && String(d.fgOpen.status).startsWith('VALIDATED') && d.step4 && !d.step4.blocked) {
      await doRunFIFO();
      if (d.step5 && histThrough === period) doBuildHistory();
    } else msg = 'STEP 5: FG đầu kỳ chưa VALIDATED hoặc STEP 4 chưa chạy được – chưa chạy FIFO.';
  } catch (e) { msg = 'STEP 5: ' + e.message; }
  const res = d.step5;
  const cmp = [
    ['STEP 5 · FG đầu kỳ', d.fgOpen ? d.fgOpen.stats.amt : null, cell(oG, 3, 8)],
    ['STEP 5 · Giá vốn FIFO', res ? res.totals.cogsA : null, cell(g['05_COGS_SUMMARY'], 3, 11)],
    ['STEP 5 · Chuyển rework (5B)', res ? num(res.totals.rwTot) : null, cell(g['05_COGS_SUMMARY'], 3, 22)],
    ['STEP 5 · FG cuối kỳ', res ? res.totals.closeA : null, cell(g['05_COGS_SUMMARY'], 3, 13)],
    ['STEP 5 · Số lớp FG cuối kỳ', res ? res.totals.layers : null, cell(g['05_COGS_SUMMARY'], 3, 15)],
    ['STEP 5 · Dòng FG History', d.fgHistory && d.fgHistory.through === period ? d.fgHistory.rows.length : null, cell(hG, 3, 2)],
  ];
  return { cmp, msg };
}
/** Carried into the next period: FG history, rollforward item order, FIFO config; opening FG is rolled forward when the period was closed. */
export function carryForward(prev, newPeriod) {
  const out = {};
  if (prev.fgHistory) out.fgHistory = prev.fgHistory;
  if (prev.fgItems) out.fgItems = prev.fgItems;
  if (prev.s5cfg) out.s5cfg = prev.s5cfg;
  if (prev.step5 && prev.closed && prev.closed.period === prev.step5.period && prevPeriod(newPeriod) === prev.step5.period) {
    try { out.fgOpen = F5.openingFromClosing(prev.step5, newPeriod, ''); } catch { /* not reconciled */ }
  }
  return out;
}
export { F5 };
