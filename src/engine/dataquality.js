// v1.14.25 — ERP data-quality check at STEP 1 (owner request 13/10/2026): "ở ngay bước 1 tôi đã được cảnh báo và xác nhận
// với danh sách dữ liệu bất thường". Runs on the datasets as stored (also data imported before the check existed),
// lists every abnormal material line and must be CONFIRMED by a user before STEP 2 can run. Any re-import that changes the
// list (fingerprint) needs a new confirmation.
//
// Abnormal lines (PC-M / MI-M / MR-M of systems T, S, O; footer rows without a Material Code are ignored):
//   ZERO COST  – quantity ≠ 0 but Total Cost = 0 / blank  (3B cannot value the material; e.g. customer-supplied items)
//   NEGATIVE   – negative quantity or Total Cost
//   TEXT       – quantity / Total Cost is text, not a number
import { ttxt, headerCol, headerColAny, fpRows, num, parseUserNumber } from './util.js';
import { pcBasisScan, PCB_TOL } from './pcbasis.js';
import { materialIssueCosts } from './matcost.js';
import { pcUnitCosts } from './pccost.js';

// The material reports checked at STEP 1: every system (T, S, O) – PC-M and MI-M of system S included (v1.14.61),
// MR-M uses Quantity (T, O) / Bad Quantity (S). The WIP movements of step3.js MOVES are the subset that feeds costing.
export const DQ_REPORTS = [
  ['PC-M-T', 'PC No.', ['Quantity']], ['PC-M-O', 'PC No.', ['Quantity']], ['PC-M-S', 'PC No.', ['Quantity']],
  ['MI-M-T', 'MI No.', ['Current Issue Qty', 'Quantity']], ['MI-M-O', 'MI No.', ['Current Issue Qty', 'Base Qty', 'Quantity']], ['MI-M-S', 'MI No.', ['Current Issue Qty', 'Base Qty', 'Quantity']],
  ['MR-M-T', 'Code', ['Quantity']], ['MR-M-O', 'Code', ['Quantity']], ['MR-M-S', 'Code', ['Bad Quantity']],
];
export const DQ_TYPES = { 'ZERO COST': 'SL ≠ 0 nhưng Total Cost = 0', NEGATIVE: 'Số âm (SL hoặc Total Cost)', TEXT: 'SL / Total Cost là chữ, không phải số',
  UNREADABLE: 'SL / Total Cost là chữ không đọc chắc chắn được (vd "1.234.567", "1.234,5", TRUE) – phải sửa file ERP' };
export const DQ_FIELDS = ['report', 'type', 'row', 'doc', 'mat', 'name', 'qty', 'amt'];
export const DQ_HEADERS = ['Báo cáo', 'Loại bất thường', 'Dòng Excel', 'Chứng từ (PC / MI / MR No.)', 'Mã vật tư', 'Tên vật tư', 'Số lượng', 'Total Cost'];

const cache = new WeakMap();
const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
// v1.14.91 (audit ACC-02 / ACC-05): a text cell is only confirmable when the costing engine (num, VBA rules) reads it as
// the same number a person reads ("1234", "1,234.5"). "1.234.567" (num → 0), "1.234,5" (num → 1,2345), "1,5" (num → 15),
// "1.234" (ambiguous) and TRUE / FALSE (num → −1 / 0) would be costed with a wrong value: they block until the file is fixed.
const isText = (v) => !blank(v) && typeof v !== 'number';
export function textReadable(v) {
  if (typeof v !== 'string') return false;
  const p = parseUserNumber(v);
  return p.ok && p.value !== null && Math.abs(p.value - num(v)) < 1e-9;
}
function scan(report, ds, docName, qtyNames) {
  const hit = cache.get(ds); if (hit) return hit;
  const h = ds.header || [];
  const cMat = headerCol(h, 'Material Code'), cName = headerCol(h, 'Material Name'), cDoc = headerCol(h, docName);
  const cQty = headerColAny(h, qtyNames), cAmt = headerCol(h, 'Total Cost');
  const out = [];
  if (cMat >= 0 && cQty >= 0 && cAmt >= 0) {
    (ds.rows || []).forEach((r, i) => {
      if (blank(r[cMat])) return;
      const q = r[cQty], a = r[cAmt];
      const base = { report, row: (ds.headerRow || 1) + i + 1, doc: cDoc >= 0 ? ttxt(r[cDoc]) : '', mat: ttxt(r[cMat]), name: cName >= 0 ? ttxt(r[cName]) : '', qty: q, amt: a };
      if (isText(q) || isText(a)) { out.push({ ...base, type: [q, a].some((v) => isText(v) && !textReadable(v)) ? 'UNREADABLE' : 'TEXT' }); return; }
      const qn = blank(q) ? 0 : q, an = blank(a) ? 0 : a;
      if (qn < 0 || an < 0) out.push({ ...base, type: 'NEGATIVE' });
      else if (qn !== 0 && an === 0) out.push({ ...base, type: 'ZERO COST' });
    });
  }
  cache.set(ds, out);
  return out;
}

// v1.14.26 — PC-P (lot Total Cost) must equal PC-M (sum of the lot's material Total Cost) per system, PC No. and product.
export const PCR_FIELDS = ['erp', 'type', 'pcNo', 'prod', 'name', 'pcp', 'pcm', 'diff'];
export const PCR_HEADERS = ['Hệ', 'Loại chênh lệch', 'PC No.', 'Product Code', 'Product Name', 'Total Cost PC-P (VND)', 'Tổng Total Cost PC-M (VND)', 'Chênh PC-M − PC-P (VND)'];
let pcrCache = { refs: null, out: null };
export function pcpPcmRecon(datasets) {
  const sys = ['T', 'S', 'O'].filter((e) => (datasets[`PC-P-${e}`] && datasets[`PC-P-${e}`].rows && datasets[`PC-P-${e}`].rows.length) || (datasets[`PC-M-${e}`] && datasets[`PC-M-${e}`].rows && datasets[`PC-M-${e}`].rows.length));
  const refs = sys.flatMap((e) => [datasets[`PC-P-${e}`], datasets[`PC-M-${e}`]]);
  if (pcrCache.refs && pcrCache.refs.length === refs.length && pcrCache.refs.every((r, i) => r === refs[i])) return pcrCache.out;
  const sc = pcBasisScan(datasets, sys);
  const issues = [
    ...sc.lines.map((l) => ({ erp: l.erp, type: 'LỆCH', pcNo: l.pcNo, prod: l.prod, name: l.name, pcp: l.pcp, pcm: l.pcm, diff: l.diff })),
    ...sc.onlyPCM.map((l) => ({ erp: l.erp, type: 'CHỈ CÓ Ở PC-M', pcNo: l.pcNo, prod: l.prod, name: '', pcp: 0, pcm: l.cost, diff: l.cost })),
    ...sc.onlyPCP.map((l) => ({ erp: l.erp, type: 'CHỈ CÓ Ở PC-P', pcNo: l.pcNo, prod: l.prod, name: '', pcp: l.cost, pcm: 0, diff: -l.cost })),
  ].sort((a, b) => a.erp.localeCompare(b.erp) || Math.abs(b.diff) - Math.abs(a.diff));
  const bySys = sys.map((e) => {
    const v = sc.bySys[e] || { pcp: 0, pcm: 0, diff: 0, pcsP: 0, pcsM: 0 }; const mine = issues.filter((x) => x.erp === e);
    return { erp: e, pcp: v.pcp, pcm: v.pcm, diff: v.diff, pcsP: v.pcsP, pcsM: v.pcsM, gaps: mine.filter((x) => x.type === 'LỆCH').length, onlyM: mine.filter((x) => x.type === 'CHỈ CÓ Ở PC-M').length, onlyP: mine.filter((x) => x.type === 'CHỈ CÓ Ở PC-P').length, status: mine.length ? 'CHECK' : 'PASS' };
  });
  const out = { bySys, issues, diff: sc.totals.diff, fp: issues.length ? fpRows(issues, (x) => [x.erp, x.type, x.pcNo, x.prod, Math.round(x.pcp * 100), Math.round(x.pcm * 100)].join('|')) : '', tol: PCB_TOL };
  pcrCache = { refs, out };
  return out;
}

/** v1.14.30: confirmable parts – A (PC-P vs PC-M), B (SL ≠ 0 but Total Cost = 0), C (negative / text).
 *  v1.14.48: the MI-M unit-cost lines (đơn giá xuất NVL bất thường trong kỳ) are part of C, confirmed with the same button.
 *  Their threshold is the DEFAULT one (30 % / 1.000.000 VND), not the screen option, so the list is the same on every device.
 *  Each part is confirmed separately. */
export const DQ_PARTS = { A: 'Chênh lệch PC-P và PC-M', B: 'Vật tư SL ≠ 0 nhưng Total Cost = 0', C: 'Vật tư số âm, sai kiểu dữ liệu hoặc đơn giá xuất NVL bất thường', D: 'Đơn giá thành phẩm theo lô PC bất thường (PC-P)' };
const lineFp = (l) => [l.report, l.type, l.row, l.mat, l.qty, l.amt].join('|');
const mcFp = (l) => [l.erp, l.mi, l.mo, l.code, l.lot, l.qty, l.cost].join('|');
const pcFp = (l) => [l.erp, l.pc, l.prod, l.qty, l.cost, l.kind].join('|');

/** All abnormal lines of the period's material reports + summary per report / type and a fingerprint of the list. */
export function erpAnomalies(datasets, period = '') {
  const lines = [];
  for (const [rep, doc, qty] of DQ_REPORTS) { const ds = datasets && datasets[rep]; if (ds && ds.rows && ds.rows.length) lines.push(...scan(rep, ds, doc, qty)); }
  const groups = new Map();
  for (const l of lines) {
    const k = `${l.report}|${l.type}`;
    const g = groups.get(k) || { report: l.report, type: l.type, label: DQ_TYPES[l.type], lines: 0, mats: new Set() };
    g.lines++; g.mats.add(l.mat); groups.set(k, g);
  }
  const summary = [...groups.values()].map((g) => ({ report: g.report, type: g.type, label: g.label, lines: g.lines, materials: g.mats.size, sample: [...g.mats].slice(0, 12).join(', ') }));
  const recon = pcpPcmRecon(datasets || {});
  const fpLines = lines.length ? fpRows(lines, lineFp) : '';
  const zero = lines.filter((l) => l.type === 'ZERO COST'), neg = lines.filter((l) => l.type !== 'ZERO COST' && l.type !== 'UNREADABLE');
  const unreadable = lines.filter((l) => l.type === 'UNREADABLE');
  // MI-M unit-cost lines (đơn giá lệch so với trung vị) are part C with the negative / text lines (v1.14.65: blocking again)
  const mc = period ? materialIssueCosts(datasets || {}, period) : { lines: [], allLines: [] };
  const mcLines = mc.lines, mcAll = mc.allLines;
  // D: finished-goods unit cost per PC lot (PC-P) outside the reference – v1.14.63, confirmed like C
  const pc = period ? pcUnitCosts(datasets || {}, period) : { lots: [], flagged: [] };
  const parts = {
    A: { count: recon.issues.length, fp: recon.fp },
    B: { count: zero.length, fp: zero.length ? fpRows(zero, lineFp) : '' },
    C: { count: neg.length + mcLines.length, fp: neg.length + mcLines.length ? [neg.length ? fpRows(neg, lineFp) : '', mcLines.length ? fpRows(mcLines, mcFp) : ''].join('@') : '' },
    D: { count: pc.flagged.length, fp: pc.flagged.length ? fpRows(pc.flagged, pcFp) : '' },
  };
  return { lines, summary, materials: new Set(lines.map((l) => `${l.report.slice(-1)}|${l.mat}`)).size, recon, issues: lines.length + recon.issues.length,
    unreadable, mcLines, mcAll, pcLots: pc.lots, pcFlagged: pc.flagged, fp: lines.length || recon.issues.length ? `${fpLines}#${recon.fp}` : '', parts };
}

/**
 * Confirmations per part. ack.parts = { A|B|C: { fp, count, by, at, note } }.
 * An ack written before v1.14.30 (single fp for everything) still counts for the parts it covered.
 */
export function ackParts(ack, an) {
  if (!ack) return {};
  if (ack.parts) return { ...ack.parts };
  if (ack.fp && an && ack.fp === an.fp) {
    const out = {};
    for (const k of Object.keys(DQ_PARTS)) if (an.parts && an.parts[k] && an.parts[k].count) out[k] = { fp: an.parts[k].fp, count: an.parts[k].count, by: ack.by, at: ack.at, note: ack.note };
    return out;
  }
  return {};
}

/** NONE (no abnormal line in the part) · CONFIRMED · CHANGED (confirmed earlier, list changed since) · NOT CONFIRMED */
export function partStatus(an, ack, key) {
  const p = an && an.parts ? an.parts[key] : null;
  if (!p || !p.count) return 'NONE';
  const c = ackParts(ack, an)[key];
  if (!c) return 'NOT CONFIRMED';
  return c.fp === p.fp ? 'CONFIRMED' : 'CHANGED';
}

/** PASS (no abnormal line and PC-P = PC-M) · CONFIRMED (the same list was confirmed) · BLOCK - CONFIRM (not yet / list changed since)
 *  · BLOCK - FIX DATA (v1.14.91: a number cell the engine cannot read reliably – no confirmation lifts it, the file must be fixed). */
export function anomalyStatus(an, ack) {
  if (!an || (!an.lines.length && !(an.recon && an.recon.issues.length) && !(an.mcLines && an.mcLines.length) && !(an.pcFlagged && an.pcFlagged.length))) return 'PASS';
  if (an.unreadable && an.unreadable.length) return 'BLOCK - FIX DATA';
  return Object.keys(DQ_PARTS).every((k) => ['NONE', 'CONFIRMED'].includes(partStatus(an, ack, k))) ? 'REVIEW - CONFIRMED' : 'BLOCK - CONFIRM';
}

/** Unit of each confirmable part, for notifications. */
export const DQ_PART_UNIT = {
  A: 'PC lệch PC-P / PC-M',
  B: 'dòng SL ≠ 0 nhưng Total Cost = 0',
  C: 'dòng vật tư số âm, sai kiểu hoặc đơn giá xuất NVL bất thường',
  D: 'lô PC bất thường (PC-P)',
  E: 'dòng vật tư có ô số không đọc được – sửa file ERP rồi import lại',
};
/** Parts that still block STEP 2: not confirmed, or changed since the last confirmation. */
export function blockingParts(an, ack) {
  const fix = an && an.unreadable && an.unreadable.length ? [{ key: 'E', status: 'FIX', count: an.unreadable.length }] : [];
  return fix.concat(Object.keys(DQ_PARTS).map((k) => ({ key: k, status: partStatus(an, ack, k), count: an && an.parts && an.parts[k] ? an.parts[k].count : 0 }))
    .filter((p) => p.status !== 'NONE' && p.status !== 'CONFIRMED'));
}
/** One line per blocking part, e.g. "A: 12 PC lệch PC-P / PC-M (chưa xác nhận); D: 43 lô PC bất thường (PC-P) (thay đổi sau lần xác nhận)". */
export function blockingSummary(list) {
  return (list || []).map((p) => `${p.key}: ${p.count} ${DQ_PART_UNIT[p.key]} (${p.status === 'FIX' ? 'không xác nhận được' : p.status === 'CHANGED' ? 'thay đổi sau lần xác nhận' : 'chưa xác nhận'})`).join('; ');
}
