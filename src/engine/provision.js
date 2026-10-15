// Provision for inventory write-down on finished goods (dự phòng giảm giá thành phẩm, TK 2294) — v1.14.70.
// Pure functions shared by the engine (step5.js), the views and the tests.
//
// Sign convention: a layer's provision is NEGATIVE (a credit balance, as in the template). A movement that
// releases provision (hoàn nhập) is a POSITIVE release amount; Dr 2294 / Cr 632. Provision added (trích lập)
// is Dr 632 / Cr 2294.
//   - sale FIFO take:            release = provision of the units taken          (Dr 2294 / Cr 632)
//   - internal consumption (CONS): same as a sale                                 (Dr 2294 / Cr 632)
//   - sales return (restore):    provision of the original sale is put back      (Dr 632 / Cr 2294)
//   - NRV true-up (decision):    provNeed > 0 = add, < 0 = release               (Dr 632 / Cr 2294 or reverse)
//   - rework consumption:        tracked, NOT posted until accounting decides the entry
import { num, ttxt, utxt, cellDateSerial } from './util.js';

export const PROV_MARKER = 'SVL_PROVISION_OPENING_TEMPLATE';
export const PROV_SHEET = 'PROVISION_OPENING';
export const PROV_ACC = '2294';
export const PROV_COST_ACC = '632';
const TOL = 1;

/**
 * Lower-of-cost-and-NRV for one closing layer, expressed as the provision NEEDED after this period's NRV test.
 * C = remaining cost (gross, before provision), P = provision already on the layer (negative), Q = qty, nrvUnit = NRV/unit.
 * Result > 0: add provision; < 0: release provision; 0: nothing to do. Required provision = −max(0, C − NRV·Q).
 */
export function nrvNeed(C, P, Q, nrvUnit) {
  const nrvTot = num(nrvUnit) * num(Q);
  return num(P) + Math.max(0, num(C) - nrvTot);
}

/** Match key of a layer on the 6-field key (PC No., Product Code, MO No., Location, Layer Date, Qty). */
export function layerKey({ pc, prod, mo, loc, date, qty }) {
  const d = typeof date === 'number' ? date : (cellDateSerial(date) || 0);
  return [utxt(pc), utxt(prod), utxt(mo), utxt(loc), Math.round(d), num(qty).toFixed(4)].join('|');
}

/**
 * Read the PROVISION_OPENING sheet (grids: sheet name → rows). Returns { ok, errors, glBalance, rows }.
 * Columns (1-based): A Period, B Source Period, C PC No., D Product Code, E MO No., F Location, G Layer Date,
 * H Qty, I Layer ID (reference only), J Provision VND, K source reference, L note, M row check (formula).
 */
export function parseOpeningProvision(grids, fileName, period) {
  const errors = [];
  let name = null;
  for (const [n, g] of Object.entries(grids || {})) if (ttxt(g && g[0] && g[0][0]) === PROV_MARKER) { name = n; break; }
  if (!name) return { ok: false, errors: [`Không thấy template dự phòng (A1 = ${PROV_MARKER}) trong ${fileName}.`], glBalance: 0, rows: [] };
  const g = grids[name];
  const glBalance = num(g[0] && g[0][9]);
  const rows = [];
  for (let r = 4; r < g.length; r++) {
    const x = g[r] || [];
    const pc = ttxt(x[2]), prod = ttxt(x[3]), qty = num(x[7]), prov = x[9];
    const blank = !pc && !prod && (x[9] === undefined || x[9] === null || x[9] === '');
    if (blank) continue;
    const rowNo = r + 1;
    const rowPeriod = ttxt(x[0]);
    if (rowPeriod && rowPeriod !== period) errors.push(`Dòng ${rowNo}: Kỳ '${rowPeriod}' khác kỳ đang mở ${period}.`);
    if (!pc) errors.push(`Dòng ${rowNo}: thiếu PC No.`);
    if (!prod) errors.push(`Dòng ${rowNo}: thiếu Product Code.`);
    if (!(qty > 0)) errors.push(`Dòng ${rowNo}: Qty phải > 0.`);
    const date = cellDateSerial(x[6]);
    if (!date) errors.push(`Dòng ${rowNo}: Layer Date không đọc được.`);
    const p = num(prov);
    if (typeof prov !== 'number' && ttxt(prov) !== '') errors.push(`Dòng ${rowNo}: dự phòng không phải số.`);
    if (p > 0) errors.push(`Dòng ${rowNo}: dự phòng phải là số âm (hoặc 0).`);
    rows.push({ rowNo, pc, prod, mo: ttxt(x[4]), loc: ttxt(x[5]), date: date || 0, qty, prov: p, ref: ttxt(x[10]), note: ttxt(x[11]), period: rowPeriod || period });
  }
  if (!rows.length) errors.push('Template không có dòng dự phòng nào.');
  const sum = rows.reduce((a, r) => a + r.prov, 0);
  if (Math.abs(sum - glBalance) > TOL) errors.push(`Tổng dự phòng trong file ${sum.toFixed(0)} không khớp số dư sổ cái ${glBalance.toFixed(0)} (ô J1 template).`);
  return { ok: errors.length === 0, errors, glBalance, sum, rows, sheet: name };
}

/**
 * Apply the provision file to the FG opening layers (the file is the source of truth for opening provision).
 * Every opening layer gets its provision from the file (layers not in the file get 0). Nothing is changed unless
 * every file row matches exactly one layer and the total equals the GL balance.
 * opening = { rows: [...] } (the FG opening import). Returns { ok, errors, matched, unmatched, zeroLayers }.
 */
export function applyOpeningProvision(opening, parsed) {
  const errors = [...(parsed && parsed.errors ? parsed.errors : [])];
  const idx = new Map();
  for (const [i, r] of (opening.rows || []).entries()) {
    const k = layerKey({ pc: r.pc, prod: r.prod, mo: r.mo, loc: r.loc, date: r.date, qty: r.qty });
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(i);
  }
  const hits = new Map(); const unmatched = [];
  for (const p of parsed.rows || []) {
    const k = layerKey({ pc: p.pc, prod: p.prod, mo: p.mo, loc: p.loc, date: p.date, qty: p.qty });
    const list = idx.get(k) || [];
    if (list.length === 0) unmatched.push(p.rowNo);
    else if (list.length > 1) errors.push(`Dòng ${p.rowNo}: khớp ${list.length} lớp FG đầu kỳ (trùng khoá), không nạp được.`);
    else {
      if (hits.has(list[0])) errors.push(`Dòng ${p.rowNo}: lớp FG đầu kỳ dòng ${list[0] + 1} đã có dự phòng ở dòng khác.`);
      hits.set(list[0], p);
    }
  }
  if (unmatched.length) errors.push(`Không khớp lớp FG đầu kỳ: dòng ${unmatched.join(', ')} (kiểm tra PC No., Product Code, MO No., Location, Layer Date, Qty).`);
  const sum = (parsed.rows || []).reduce((a, p) => a + num(p.prov), 0);
  if (Math.abs(sum - num(parsed.glBalance)) > TOL) errors.push(`Tổng dự phòng ${sum.toFixed(0)} không khớp sổ cái ${num(parsed.glBalance).toFixed(0)}.`);
  if (errors.length) return { ok: false, errors, matched: 0, unmatched: unmatched.length, zeroLayers: 0 };
  let zero = 0;
  (opening.rows || []).forEach((r, i) => {
    const p = hits.get(i);
    r.prov = p ? p.prov : 0;
    if (!p) zero++;
  });
  return { ok: true, errors: [], matched: hits.size, unmatched: 0, zeroLayers: zero, sum };
}

/**
 * NRV approved for the period (v1.14.73), spread over the closing layers in proportion to the proposal.
 * decision = the CURRENT decision (the caller has checked its key) or null. Only RECORDED moves provision; the
 * recorded amount may differ from the proposal, so each layer gets provNeed × recorded / proposed.
 * Returns { byLayer: lid → credit added (+ add / − release), total, proposed, unallocated }.
 * unallocated ≠ 0 when an amount was recorded but nothing was proposed (it cannot be placed on a layer).
 */
export function nrvApproved(closing, decision) {
  const proposed = (closing || []).reduce((a, c) => a + num(c.provNeed), 0);
  const byLayer = {};
  if (!decision || utxt(decision.status) !== 'RECORDED') return { byLayer, total: 0, proposed, unallocated: 0 };
  const rec = num(decision.recordedAmount ?? decision.amount);
  if (Math.abs(proposed) < TOL) return { byLayer, total: rec, proposed, unallocated: rec };
  const f = rec / proposed;
  for (const c of closing || []) if (num(c.provNeed)) byLayer[ttxt(c.lid)] = num(c.provNeed) * f;
  return { byLayer, total: rec, proposed, unallocated: 0 };
}

/**
 * Provision balance at the end of a period, per closing layer (negative, as stored on the layers): what is left on
 * the layer after the period's takes, plus the NRV approved for that period. This is next period's opening provision.
 * Returns { layers: [{ lid, key, prov }], total } with total as a credit balance (positive).
 */
export function closingProvision(step5, decision) {
  const add = nrvApproved((step5 && step5.closing) || [], decision).byLayer;
  const layers = ((step5 && step5.closing) || []).map((c) => ({
    lid: ttxt(c.lid), key: layerKey({ pc: c.pc, prod: c.prod, mo: c.mo, loc: c.loc, date: c.date, qty: c.qty }),
    prov: num(c.prov) - num(add[ttxt(c.lid)]),
  }));
  return { layers, total: -layers.reduce((a, l) => a + l.prov, 0) };
}

/**
 * Carry last period's closing provision into this period's opening FG layers (v1.14.73). Each opening row is
 * matched by Layer ID, else by the 6-field layer key. Nothing changes unless every previous layer that carries
 * provision finds exactly one opening row. Opening rows with no previous provision get 0.
 * Returns { ok, errors, matched, sum, expected } (sum / expected as credit balances).
 */
export function carryOpeningProvision(opening, prevStep5, prevDecision) {
  const errors = [];
  if (!prevStep5 || !(prevStep5.closing || []).length) return { ok: false, errors: ['Kỳ trước chưa có FG cuối kỳ (STEP 5) trên hệ thống.'], matched: 0, sum: 0, expected: 0 };
  const prev = closingProvision(prevStep5, prevDecision);
  const rows = (opening && opening.rows) || [];
  const byLid = new Map(), byKey = new Map();
  rows.forEach((r, i) => {
    const lid = ttxt(r.lid); if (lid) byLid.set(lid, [...(byLid.get(lid) || []), i]);
    const k = layerKey({ pc: r.pc, prod: r.prod, mo: r.mo, loc: r.loc, date: r.date, qty: r.qty });
    byKey.set(k, [...(byKey.get(k) || []), i]);
  });
  const put = new Map(); const missing = [];
  for (const l of prev.layers) {
    if (Math.abs(l.prov) <= 0.005) continue;
    const hit = (l.lid && byLid.get(l.lid)) || byKey.get(l.key) || [];
    if (hit.length !== 1) { missing.push(l.lid || l.key); continue; }
    if (put.has(hit[0])) errors.push(`Lớp đầu kỳ dòng ${hit[0] + 1} khớp nhiều lớp cuối kỳ trước.`);
    put.set(hit[0], l.prov);
  }
  if (missing.length) errors.push(`${missing.length} lớp cuối kỳ trước có dự phòng nhưng không khớp đúng một lớp FG đầu kỳ: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}.`);
  const sum = -[...put.values()].reduce((a, v) => a + v, 0);
  if (!errors.length && Math.abs(sum - prev.total) > TOL) errors.push(`Tổng chuyển sang ${sum.toFixed(0)} khác số dư cuối kỳ trước ${prev.total.toFixed(0)}.`);
  if (errors.length) return { ok: false, errors, matched: 0, sum, expected: prev.total };
  rows.forEach((r, i) => { r.prov = put.has(i) ? put.get(i) : 0; });
  return { ok: true, errors: [], matched: put.size, sum, expected: prev.total };
}

/**
 * Period summary of TK 2294 (credit positive), the way accounting reads it (v1.14.73):
 *   opening + increase (NRV approved this period) − decrease (release on sales and internal use, net of sales
 *   returns) = closing on the books. The rework part is shown apart: it has left the FG layers but is not posted,
 *   so closing on the books = FG layers closing + rework pending.
 */
export function provisionMovement(track, approved = null) {
  const T = track.totals;
  const increase = T.nrvAdj + num(approved && approved.unallocated);
  const decrease = T.relSale + T.relCons - T.restore;
  const closeBooks = T.open + increase - decrease;
  const closeLayers = T.close + num(approved && approved.unallocated);
  const check = closeBooks - T.relRw - closeLayers;
  return { open: T.open, increase, nrvProposed: T.nrvProp, decrease, relSale: T.relSale, relCons: T.relCons, restore: T.restore,
    rework: T.relRw, closeBooks, closeLayers, check, ok: Math.abs(check) <= TOL && track.ok };
}

/**
 * Per-layer provision roll-forward for the period (credit balance = −provision; movements positive = credit increase).
 * res = output of runFIFO after closing (ledger, closing, detail with prov per take).
 * nrvAdd = NRV approved per layer (nrvApproved().byLayer); the proposal is kept apart in nrvProp (information only).
 * Columns: open (opening layers) + restore (sales returns put back) − sale release − consumption release − rework
 * (pending entry) + NRV approved = close. Returns { rows, totals, check }.
 */
export function provisionTrack(res, nrvAdd = {}) {
  const takes = new Map(); // lid → { sale, cons } (negative provision taken)
  for (const d of res.detail || []) {
    const k = ttxt(d.lid); const t = takes.get(k) || { sale: 0, cons: 0 };
    if (d.kind === 'CONS') t.cons += num(d.prov); else t.sale += num(d.prov);
    takes.set(k, t);
  }
  const closeBy = new Map((res.closing || []).map((c) => [ttxt(c.lid), c]));
  const rows = [];
  const T = { open: 0, restore: 0, relSale: 0, relCons: 0, relRw: 0, nrvProp: 0, nrvAdj: 0, closePre: 0, close: 0 };
  const add = nrvAdd || {};
  for (const l of res.ledger || []) {
    const lid = ttxt(l.lid);
    const prov = num(l.prov), provOut = num(l.provOut);
    const t = takes.get(lid) || { sale: 0, cons: 0 };
    const rwTake = provOut - t.sale - t.cons; // rework take (negative), booked later by runReworkFIFO
    const c = closeBy.get(lid);
    const open = l.source === 'OPENING' ? -prov : 0;
    const restore = l.source === 'RETURN' ? -prov : 0;
    const relSale = -t.sale, relCons = -t.cons, relRw = -rwTake;
    const closePre = -(prov - provOut);
    const nrvProp = c ? num(c.provNeed) : 0;
    const nrvAdj = num(add[lid]);
    const close = closePre + nrvAdj;
    const remQ = num(l.remQ);
    const row = { lid, source: l.source, pc: ttxt(l.pc), prod: utxt(l.prod), loc: ttxt(l.loc), date: l.date, mo: ttxt(l.mo), qtyIn: num(l.qtyIn), qtyRem: remQ,
      open, restore, relSale, relCons, relRw, closePre, nrvProp, nrvAdj, close, nrvUnit: c ? num(c.nrvUnit) : null };
    if ([open, restore, relSale, relCons, relRw, nrvProp, nrvAdj, closePre].some((v) => Math.abs(v) > 0.005)) rows.push(row);
    T.open += open; T.restore += restore; T.relSale += relSale; T.relCons += relCons; T.relRw += relRw; T.nrvProp += nrvProp; T.nrvAdj += nrvAdj; T.closePre += closePre; T.close += close;
  }
  const check = T.open + T.restore - T.relSale - T.relCons - T.relRw - T.closePre;
  return { rows, totals: T, check, ok: Math.abs(check) <= TOL };
}

/**
 * Journal lines for FAST (Nợ / Có). nrvRecorded = the NRV decision amount actually recorded (signed; from STEP 5.3).
 * Rework (relRw) is listed with amount but not in the posting total: accounting decides the entry.
 */
export function provisionJournal(track, nrvRecorded = 0) {
  const T = track.totals;
  const lines = [
    { code: 'PROV-SALE', desc: 'Hoàn nhập dự phòng theo giá vốn hàng bán (FIFO)', dr: PROV_ACC, cr: PROV_COST_ACC, amount: T.relSale },
    { code: 'PROV-CONS', desc: 'Hoàn nhập dự phòng theo tiêu dùng nội bộ FG', dr: PROV_ACC, cr: PROV_COST_ACC, amount: T.relCons },
    { code: 'PROV-RETURN', desc: 'Phục hồi dự phòng theo hàng bán bị trả lại', dr: PROV_COST_ACC, cr: PROV_ACC, amount: T.restore },
    { code: 'PROV-NRV', desc: 'Trích lập / hoàn nhập dự phòng NRV (quyết định đã duyệt ở 5P)', dr: nrvRecorded >= 0 ? PROV_COST_ACC : PROV_ACC, cr: nrvRecorded >= 0 ? PROV_ACC : PROV_COST_ACC, amount: Math.abs(num(nrvRecorded)) },
  ];
  for (const l of lines) l.amount = Math.round(num(l.amount));
  const pending = { code: 'PROV-REWORK', desc: 'Dự phòng chuyển vào rework — CHƯA GHI SỔ, chờ quyết định kế toán', amount: Math.round(T.relRw) };
  // movement of TK 2294 this period (credit positive) from the lines above: Cr 2294 adds, Dr 2294 reduces
  const acc2294 = lines.reduce((a, l) => a + (l.cr === PROV_ACC ? l.amount : 0) - (l.dr === PROV_ACC ? l.amount : 0), 0);
  return { lines, pending, acc2294 };
}
