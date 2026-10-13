// v1.14.25 — ERP data-quality check at STEP 1 (owner request 13/10/2026): "ở ngay bước 1 tôi đã được cảnh báo và xác nhận
// với danh sách dữ liệu bất thường". Runs on the datasets as stored (also data imported before the check existed),
// lists every abnormal material line and must be CONFIRMED by a user before STEP 2 can run. Any re-import that changes the
// list (fingerprint) needs a new confirmation.
//
// Abnormal lines (PC-M / MI-M / MR-M – the material reports that feed the WIP / 3B engine; footer rows without a Material Code are ignored):
//   ZERO COST  – quantity ≠ 0 but Total Cost = 0 / blank  (3B cannot value the material; e.g. customer-supplied items)
//   NEGATIVE   – negative quantity or Total Cost
//   TEXT       – quantity / Total Cost is text, not a number
import { ttxt, headerCol, headerColAny, fpRows } from './util.js';

// The material reports STEP 3A uses for WIP (src/engine/step3.js MOVES). PC-M-S is not used (system S has no PC lots).
export const DQ_REPORTS = [
  ['PC-M-T', 'PC No.', ['Quantity']], ['PC-M-O', 'PC No.', ['Quantity']],
  ['MI-M-T', 'MI No.', ['Current Issue Qty', 'Quantity']], ['MI-M-O', 'MI No.', ['Current Issue Qty', 'Base Qty', 'Quantity']],
  ['MR-M-T', 'Code', ['Quantity']], ['MR-M-O', 'Code', ['Quantity']], ['MR-M-S', 'Code', ['Bad Quantity']],
];
export const DQ_TYPES = { 'ZERO COST': 'SL ≠ 0 nhưng Total Cost = 0', NEGATIVE: 'Số âm (SL hoặc Total Cost)', TEXT: 'SL / Total Cost là chữ, không phải số' };
export const DQ_FIELDS = ['report', 'type', 'row', 'doc', 'mat', 'name', 'qty', 'amt'];
export const DQ_HEADERS = ['Báo cáo', 'Loại bất thường', 'Dòng Excel', 'Chứng từ (PC / MI / MR No.)', 'Mã vật tư', 'Tên vật tư', 'Số lượng', 'Total Cost'];

const cache = new WeakMap();
const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
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
      if ((!blank(q) && typeof q !== 'number') || (!blank(a) && typeof a !== 'number')) { out.push({ ...base, type: 'TEXT' }); return; }
      const qn = blank(q) ? 0 : q, an = blank(a) ? 0 : a;
      if (qn < 0 || an < 0) out.push({ ...base, type: 'NEGATIVE' });
      else if (qn !== 0 && an === 0) out.push({ ...base, type: 'ZERO COST' });
    });
  }
  cache.set(ds, out);
  return out;
}

/** All abnormal lines of the period's material reports + summary per report / type and a fingerprint of the list. */
export function erpAnomalies(datasets) {
  const lines = [];
  for (const [rep, doc, qty] of DQ_REPORTS) { const ds = datasets && datasets[rep]; if (ds && ds.rows && ds.rows.length) lines.push(...scan(rep, ds, doc, qty)); }
  const groups = new Map();
  for (const l of lines) {
    const k = `${l.report}|${l.type}`;
    const g = groups.get(k) || { report: l.report, type: l.type, label: DQ_TYPES[l.type], lines: 0, mats: new Set() };
    g.lines++; g.mats.add(l.mat); groups.set(k, g);
  }
  const summary = [...groups.values()].map((g) => ({ report: g.report, type: g.type, label: g.label, lines: g.lines, materials: g.mats.size, sample: [...g.mats].slice(0, 12).join(', ') }));
  return { lines, summary, materials: new Set(lines.map((l) => `${l.report.slice(-1)}|${l.mat}`)).size, fp: lines.length ? fpRows(lines, (l) => [l.report, l.type, l.row, l.mat, l.qty, l.amt].join('|')) : '' };
}

/** PASS (no abnormal line) · CONFIRMED (the same list was confirmed) · BLOCK - CONFIRM (not yet / list changed since). */
export function anomalyStatus(an, ack) {
  if (!an || !an.lines.length) return 'PASS';
  return ack && ack.fp === an.fp ? 'REVIEW - CONFIRMED' : 'BLOCK - CONFIRM';
}
