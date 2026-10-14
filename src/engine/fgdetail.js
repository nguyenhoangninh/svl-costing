// v1.14.27 — STEP 4.4 theo mẫu chi tiết của Carol ("FG2026 month detail") (owner request 13/10/2026):
// "4.4 lấy theo template tôi đã gửi … chi tiết từng dòng, và tách PC theo từng tháng mà nó ghi nhận COGS".
//
// Mỗi DÒNG là một phần của một lô thành phẩm (PC No. + Product code). Một lô được tách thành nhiều dòng:
//   · dòng có Cost month (YYYYMM)  = phần đã ghi nhận giá vốn (COGS) / đã xuất trong tháng đó
//   · dòng KHÔNG có Cost month     = phần còn tồn kho
// ⇒ Σ dòng chưa có Cost month của file đầu kỳ = FG đầu kỳ (= FG cuối kỳ trước).
//
// Kỳ đang mở: lô sản xuất trong kỳ (STEP 4.3) thêm vào thành dòng mới chưa có Cost month; tiêu thụ FIFO của kỳ (STEP 5.2:
// bán hàng / xuất rework) được TÁCH khỏi dòng còn tồn của đúng lô (theo PC No. + Product code): phần đã xuất mang Cost month
// của kỳ, phần còn lại giữ trống. Giá trị phần tách = tỷ lệ số lượng trên dòng gốc (như cách Carol tách).
// Đối chiếu với STEP 5.1 / 5.2 chỉ để REVIEW, không chặn (owner request).
import { txt, ttxt, utxt, num, isNumeric, nowISO, serialToYMD, cellDateSerial, prevPeriod } from './util.js';
import { parsePeriod } from './fgprod.js';
import { DETAIL_GUIDE } from './templates.js';

export const DET_MARKER = 'SVL_FG_DETAIL';
/** Columns A → AA exactly as Carol's sheet, then the app's own columns (AB → AF). */
export const DET_COLS = [
  ['pc', 'PC No.'], ['date', 'Date'], ['mo', 'MO No.'], ['prod', 'Product code'], ['name', 'Product Name'], ['loc', 'Location'], ['unit', 'Unit'],
  ['qty', 'Complete Qty'], ['rmA', 'RM cost'], ['rmST', 'RM cost (ST)'], ['total', 'Total cost(VND)'], ['totalRM', 'RM cost'], ['c622', 'Direct labors'], ['c627', 'Production cost'],
  ['price', 'Sales Price(USD)'], ['uRM', 'UNIT COST RM ( vnd)'], ['uCost', 'UNIT COST( vnd)'], ['costMonth', 'Cost month'],
  ['provUSD', 'provision in 2512-usd'], ['pl7', '7% PL'], ['uCost2', 'UNIT COST ( vnd)'], ['provVND', 'provision in 2512-vdn'], ['net', 'net inventory'], ['cons', '157-good on consignment'],
  ['note', 'Note'], ['fgEnd', 'total FG stock end of 2025'], ['note1', 'Note 1'],
  ['period', 'Kỳ sản xuất'], ['erp', 'ERP'], ['kind', 'Loại xuất'], ['docs', 'Chứng từ xuất'], ['src', 'Nguồn dòng'],
];
export const DET_HEADERS = DET_COLS.map((c) => c[1]);
export const DET_FIELDS = DET_COLS.map((c) => c[0]);
/** Money columns split pro rata with the quantity when a row is split. */
const MONEY = ['rmA', 'rmST', 'total', 'totalRM', 'c622', 'c627', 'provUSD', 'provVND', 'net', 'fgEnd'];
const TOLQ = 1e-6, TOLA = 1;
export const KIND_LABEL = { SALE: 'Bán hàng (COGS)', REWORK: 'Xuất rework', CONSUME: 'Tiêu dùng nội bộ (632 / 155)', PRIOR: 'Đã xuất (file đầu kỳ)' };

const norm = (s) => txt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '');
const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const ymOfSerial = (s) => { const d = serialToYMD(s); return d && d.y ? `${d.y}-${String(d.m).padStart(2, '0')}` : ''; };
const pcYM = (pc) => { const m = /^PC-(\d\d)(\d\d)-/i.exec(ttxt(pc)); return m ? `20${m[1]}-${m[2]}` : ''; };
const erpOf = (pc) => (((/^PC-\d{4}-(\d+)$/i.exec(ttxt(pc)) || [])[1] || '').length === 4 ? 'T' : 'O');
const famOf = (erp, loc) => { const u = utxt(loc); return erp === 'T' ? 'DOONA' : u.startsWith('MK') ? 'MK' : u.startsWith('VE') ? 'VETO' : u.startsWith('H') ? 'HAMA' : 'O-OTHER'; };
export const lotOf = (r) => `${utxt(r.pc)}|${utxt(r.prod)}`;
export const cmText = (cm) => (cm ? cm.replace('-', '') : '');
const isOpen = (r) => !r.costMonth;

/** Column index of every field in a header row (the n-th "RM cost" is the n-th occurrence). */
function headerMap(row) {
  const H = (row || []).map(norm); const seen = {}; const col = {};
  for (const [k, label] of DET_COLS) {
    const n = norm(label); seen[n] = (seen[n] || 0) + 1;
    let hit = 0, at = -1;
    for (let c = 0; c < H.length; c++) if (H[c] === n && ++hit === seen[n]) { at = c; break; }
    col[k] = at;
  }
  // tolerate "*" added to required headers by the styled template, and alternative names
  if (col.prod < 0) col.prod = H.findIndex((h) => h === 'PRODUCTCODE' || h === 'ITEMCODE');
  return col;
}
/** Header row of a Carol-format sheet: PC No. + Product code + Complete Qty + Cost month in the first 30 rows. */
export function findDetailSheet(grids) {
  for (const [name, g] of Object.entries(grids || {})) {
    for (let r = 0; r < Math.min(30, g.length); r++) {
      const h = (g[r] || []).map((x) => norm(txt(x).replace(/\*$/, '')));
      if (h.includes('PCNO') && h.includes('COMPLETEQTY') && h.includes('COSTMONTH') && (h.includes('PRODUCTCODE') || h.includes('ITEMCODE'))) return { name, g, hdr: r };
    }
  }
  return null;
}

/**
 * Opening of `period` from a Carol-format workbook: every row as it is (no grouping). Rows with Cost month before `period`
 * are issues of earlier months; rows without (or with a Cost month from `period` on – REVIEW) are the opening stock.
 */
export function importDetail(grids, fileName, period) {
  const f = findDetailSheet(grids);
  if (!f) throw new Error('Không tìm thấy bảng mẫu chi tiết (dòng tiêu đề có PC No., Product code, Complete Qty, Cost month).');
  const { name, g, hdr } = f;
  const col = headerMap((g[hdr] || []).map((x) => txt(x).replace(/\s*\*$/, '')));
  const miss = [['pc', 'PC No.'], ['date', 'Date'], ['prod', 'Product code'], ['qty', 'Complete Qty'], ['total', 'Total cost(VND)'], ['costMonth', 'Cost month']].filter(([k]) => col[k] < 0).map(([, l]) => l);
  if (miss.length) throw new Error(`Thiếu cột: ${miss.join(', ')} (dòng tiêu đề ${hdr + 1} của sheet ${name}).`);
  const rows = []; let block = 0, review = 0, stopAt = 0;
  for (let i = hdr + 1; i < g.length; i++) {
    const x = g[i] || []; const v = (k) => (col[k] >= 0 ? x[col[k]] ?? null : null);
    if (norm(v('qty')) === 'COMPLETEQTY') { stopAt = i + 1; break; } // a second header block below the data (scratch area) ends the table
    if (blank(v('pc')) && blank(v('prod'))) continue;
    const hard = [], warn = [];
    const pc = ttxt(v('pc')), prod = utxt(v('prod'));
    if (!pc) warn.push('Thiếu PC No. (dòng theo sản phẩm, không theo lô)'); if (!prod) hard.push('Thiếu Product code');
    const d = v('date'); const ds = blank(d) ? null : typeof d === 'number' ? d : cellDateSerial(d);
    if (!blank(d) && ds === null) hard.push('Date không đọc được');
    const prodP = ds !== null ? ymOfSerial(ds) : pcYM(pc);
    if (!prodP) hard.push('Không xác định được tháng sản xuất (Date trống, số PC không theo PC-YYMM-…)');
    else if (prodP >= period) hard.push(`Lô sản xuất ${prodP} không trước kỳ ${period} (lô của kỳ này lấy từ STEP 4.3)`);
    if (prodP && pcYM(pc) && pcYM(pc) !== prodP) warn.push(`Tháng theo Date (${prodP}) khác tháng trên số PC (${pcYM(pc)})`);
    const n = (k, need = false) => { const raw = v(k); if (blank(raw)) { if (need) hard.push(`Thiếu ${k === 'qty' ? 'Complete Qty' : 'Total cost(VND)'}`); return 0; } if (!isNumeric(raw)) { (need ? hard : warn).push(`Cột ${DET_COLS.find((c) => c[0] === k)[1]} không phải số`); return 0; } return num(raw); };
    const memo = (k) => { const raw = v(k); return blank(raw) ? null : isNumeric(raw) ? num(raw) : ttxt(raw); };
    const qty = n('qty', true), rmA = n('rmA'), rmST = n('rmST'), c622 = n('c622'), c627 = n('c627');
    let totalRM = n('totalRM'); if (col.totalRM < 0 || blank(v('totalRM'))) totalRM = rmA + rmST;
    let total = n('total'); if (blank(v('total')) && col.total >= 0) total = totalRM + c622 + c627;
    if (qty < 0) warn.push('Complete Qty âm');
    if (qty === 0 && Math.abs(total) > TOLA) warn.push('Có giá trị nhưng SL = 0');
    if (Math.abs(totalRM + c622 + c627 - total) > TOLA) warn.push(`RM + Direct labors + Production cost lệch Total cost ${Math.round(totalRM + c622 + c627 - total).toLocaleString('en-US')}`);
    if ((col.rmA >= 0 || col.rmST >= 0) && (rmA || rmST) && Math.abs(rmA + rmST - totalRM) > TOLA) warn.push(`RM cost (L) lệch RM cost + RM cost (ST) ${Math.round(totalRM - rmA - rmST).toLocaleString('en-US')}`);
    let costMonth = ''; const cmRaw = v('costMonth');
    if (!blank(cmRaw)) {
      costMonth = parsePeriod(cmRaw);
      if (!costMonth) hard.push(`Cost month '${ttxt(cmRaw)}' không đọc được (dùng YYYYMM, ví dụ 202608)`);
      else if (costMonth >= period) { warn.push(`Cost month ${cmText(costMonth)} không trước kỳ ${period} – coi là CÒN TỒN`); costMonth = ''; }
      else if (prodP && costMonth < prodP) warn.push(`Cost month ${cmText(costMonth)} trước tháng sản xuất ${prodP}`);
    }
    const erp = ttxt(v('erp')) || erpOf(pc), loc = ttxt(v('loc'));
    const st = hard.length ? 'BLOCK' : warn.length ? 'REVIEW' : 'PASS';
    if (st === 'BLOCK') block++; else if (st === 'REVIEW') review++;
    rows.push({ period: prodP, erp, pc, date: ds, mo: ttxt(v('mo')), prod, name: ttxt(v('name')), fam: famOf(erp, loc), loc, unit: ttxt(v('unit')),
      qty, rmA, rmST, total, totalRM, c622, c627, price: memo('price'), costMonth, kind: costMonth ? (ttxt(v('kind')) === 'REWORK' || /rework/i.test(ttxt(v('kind'))) ? 'REWORK' : 'PRIOR') : '',
      docs: ttxt(v('docs')), provUSD: memo('provUSD'), pl7: memo('pl7'), provVND: memo('provVND'), net: memo('net'), cons: memo('cons'), note: ttxt(v('note')), fgEnd: memo('fgEnd'), note1: ttxt(v('note1')),
      src: `${fileName} dòng ${i + 1}`, srcRow: i + 1, check: st, msg: [...hard, ...warn].join('; ') });
  }
  if (!rows.length) throw new Error('File không có dòng dữ liệu.');
  return { model: 'DETAIL', kind: 'UPLOAD', source: `${fileName} · sheet ${name}`, loadedAt: nowISO(), period, through: prevPeriod(period), rows, sales: [],
    status: block ? 'BLOCKED' : review ? 'VALIDATED WITH REVIEW' : 'VALIDATED', stats: detailStats(rows, period, block, review), ignoredFrom: stopAt };
}

/** Totals: all rows, opening stock (no Cost month), issued, prior-year stock, Cost months present. */
export function detailStats(rows, period, block = 0, review = 0) {
  const y = period.slice(0, 4); const s = { rows: rows.length, qty: 0, total: 0, stockRows: 0, stockQty: 0, stockTot: 0, soldQty: 0, soldTot: 0, priorRows: 0, priorQty: 0, priorTot: 0, block, review, lots: 0 };
  const cms = new Set(), lots = new Set();
  for (const r of rows) {
    s.qty += num(r.qty); s.total += num(r.total); lots.add(lotOf(r));
    if (isOpen(r)) { s.stockRows++; s.stockQty += num(r.qty); s.stockTot += num(r.total); if (r.period && r.period.slice(0, 4) < y) { s.priorRows++; s.priorQty += num(r.qty); s.priorTot += num(r.total); } }
    else { s.soldQty += num(r.qty); s.soldTot += num(r.total); cms.add(r.costMonth); }
  }
  s.lots = lots.size; s.costMonths = [...cms].sort(); s.months = [...new Set(rows.map((r) => r.period))].sort();
  return s;
}

/** Old lot-level opening (v1.14.26 template / roll) → rows: issued part (sold before / FIFO records) + remaining part. */
function legacySlices(op, period) {
  const y = period.slice(0, 4); const out = [];
  for (const r of op.rows || []) {
    if (!(r.period < period && r.period.slice(0, 4) === y)) continue;
    const base = { period: r.period, erp: r.erp || erpOf(r.pc), pc: ttxt(r.pc), date: r.date ?? null, mo: ttxt(r.mo), prod: utxt(r.prod), name: ttxt(r.name), fam: ttxt(r.fam), loc: ttxt(r.loc), unit: ttxt(r.unit),
      qty: num(r.qty), rmA: num(r.totalRM), rmST: 0, total: num(r.total), totalRM: num(r.totalRM), c622: num(r.c622), c627: num(r.c627), price: null, costMonth: '', kind: '', docs: '', note: ttxt(r.note), src: ttxt(r.source) || 'File đầu kỳ cũ' };
    out.push(base);
    if (num(r.soldQty0) > TOLQ) {
      const res = splitOff(out, out.length - 1, [{ kind: 'PRIOR', qty: Math.min(num(r.soldQty0), base.qty), docs: '', month: op.through || prevPeriod(period) }]);
      out.splice(out.length - 1, 1, ...res);
    }
  }
  // FIFO records of earlier months carried by the old roll (month < period)
  const recs = (op.sales || []).filter((x) => x.month < period && x.month.slice(0, 4) === y);
  const months = [...new Set(recs.map((x) => x.month))].sort();
  let rows = out;
  for (const m of months) rows = applyConsumption(rows, recs.filter((x) => x.month === m), m).rows;
  return rows;
}

/** Split row i into issued parts (one per kind) + remainder. parts: [{kind, qty, docs, month, fifoTot}] (Σ qty ≤ row qty). */
function splitOff(rows, i, parts) {
  const s = rows[i]; const q0 = num(s.qty); const out = []; let usedQ = 0; const used = Object.fromEntries(MONEY.map((k) => [k, 0]));
  for (const p of parts) {
    const q = Math.min(p.qty, q0 - usedQ); if (q <= TOLQ) continue;
    const full = Math.abs(q0 - usedQ - q) <= TOLQ;
    const part = { ...s, qty: full ? q0 - usedQ : q, costMonth: p.month, kind: p.kind, docs: p.docs || '', fifoTot: p.fifoTot ?? null, src: s.src };
    for (const k of MONEY) { if (typeof s[k] !== 'number') continue; part[k] = full ? s[k] - used[k] : (s[k] * q) / q0; used[k] += part[k]; }
    usedQ += part.qty; out.push(part);
  }
  if (q0 - usedQ > TOLQ) { const rem = { ...s, qty: q0 - usedQ }; for (const k of MONEY) if (typeof s[k] === 'number') rem[k] = s[k] - used[k]; out.push(rem); }
  return out;
}

/**
 * Consumption records of one month (FIFO sale takes / rework issues: {kind, pc, prod, qty, tot, inv}) taken from the open rows of
 * the same lot (PC No. + product), in row order. One issued row per lot row and kind; invoices listed in "Chứng từ xuất".
 */
export function applyConsumption(rows, recs, month) {
  const open = new Map();
  rows.forEach((r, i) => { if (isOpen(r) && num(r.qty) > TOLQ) { const k = lotOf(r); if (!open.has(k)) open.set(k, []); open.get(k).push(i); } });
  const taken = new Map(); const left = rows.map((r) => (isOpen(r) ? num(r.qty) : 0)); const unmatched = [];
  for (const x of recs || []) {
    let need = num(x.qty); if (need <= TOLQ) continue;
    const kind = x.kind === 'REWORK' ? 'REWORK' : x.kind === 'CONSUME' ? 'CONSUME' : 'SALE';
    for (const i of open.get(lotOf(x)) || []) {
      if (left[i] <= TOLQ) continue;
      const t = Math.min(left[i], need); left[i] -= t; need -= t;
      const m = taken.get(i) || {}; const e = m[kind] || { qty: 0, fifoTot: 0, docs: new Set() };
      e.qty += t; e.fifoTot += num(x.tot) * (t / num(x.qty)); if (ttxt(x.inv)) e.docs.add(ttxt(x.inv)); m[kind] = e; taken.set(i, m);
      if (need <= TOLQ) break;
    }
    if (need > TOLQ) unmatched.push({ ...x, qty: need, tot: num(x.tot) * (need / num(x.qty)), why: open.has(lotOf(x)) ? 'Lô trong 4.4 không đủ số lượng còn tồn' : 'Lô không có trong 4.4' });
  }
  const out = [];
  rows.forEach((r, i) => {
    const m = taken.get(i); if (!m) { out.push(r); return; }
    const docs = (e) => { const a = [...e.docs]; return a.length > 6 ? `${a.slice(0, 6).join(', ')} … (+${a.length - 6})` : a.join(', '); };
    out.push(...splitOff(rows, i, ['SALE', 'REWORK', 'CONSUME'].filter((k) => m[k]).map((k) => ({ kind: k, qty: m[k].qty, month, docs: docs(m[k]), fifoTot: m[k].fifoTot }))));
  });
  return { rows: out, unmatched };
}

/** Rows of the opening of `period` (detail upload / detail roll / converted old lot opening). Blocked uploads do not count. */
export function baseRows(fp, period) {
  const op = fp && fp.opening && fp.opening.period === period && fp.opening.status !== 'BLOCKED' ? fp.opening : null;
  if (!op) return [];
  return op.model === 'DETAIL' ? op.rows.map((r) => ({ ...r })) : legacySlices(op, period);
}
export const isDetail = (fp, period) => !!(fp && fp.opening && fp.opening.period === period && fp.opening.model === 'DETAIL');

/**
 * The 4.4 detail table of `period`: opening rows + this month's lots (STEP 4.3, posted) with this month's FIFO issues split off.
 * Returns { rows, opening (rows as opened), unmatched (issues whose lot is not / not enough in 4.4), stats }.
 */
export function buildDetail(fp, period) {
  const opening = baseRows(fp, period);
  const cur = fp && fp.current && fp.current.period === period ? fp.current : null;
  const prod = ((cur && cur.rows) || []).map((r) => ({ period, erp: ttxt(r.erp) || erpOf(r.pc), pc: ttxt(r.pc), date: r.date ?? null, mo: ttxt(r.mo), prod: utxt(r.prod), name: ttxt(r.name), fam: ttxt(r.fam), loc: ttxt(r.loc), unit: ttxt(r.unit),
    qty: num(r.qty), rmA: num(r.totalRM), rmST: 0, total: num(r.total), totalRM: num(r.totalRM), c622: num(r.c622), c627: num(r.c627), price: null, costMonth: '', kind: '', docs: '', note: '', src: `STEP 4.3 ${period}` }));
  const recs = ((cur && cur.sales) || []).filter((x) => x.month === period);
  const { rows, unmatched } = applyConsumption([...opening, ...prod], recs, period);
  return { period, rows, opening, produced: prod, unmatched, stats: detailStats(rows, period), openStats: detailStats(opening, period) };
}

/** Lot rows (old shape) of this year's production from detail rows – keeps the product / month / lot tabs working. */
export function lotsFromRows(rows, period) {
  const y = period.slice(0, 4); const by = new Map();
  for (const r of rows) {
    if (!(r.period && r.period.slice(0, 4) === y && r.period < period)) continue;
    const k = `${r.period}|${lotOf(r)}`;
    const l = by.get(k) || { period: r.period, erp: r.erp, pc: r.pc, date: r.date, mo: r.mo, prod: r.prod, name: r.name, fam: r.fam, loc: r.loc, unit: r.unit, qty: 0, baseRM: 0, wipAdj: 0, carryIn: 0, totalRM: 0, c622: 0, c627: 0, total: 0, soldQty0: 0, soldTot0: 0, source: 'FILE CHI TIẾT', note: '' };
    l.qty += num(r.qty); l.totalRM += num(r.totalRM); l.baseRM += num(r.totalRM); l.c622 += num(r.c622); l.c627 += num(r.c627); l.total += num(r.total);
    if (!isOpen(r)) { l.soldQty0 += num(r.qty); l.soldTot0 += num(r.total); }
    by.set(k, l);
  }
  return [...by.values()].map((l) => ({ ...l, unitCost: l.qty ? l.total / l.qty : null }));
}
/** Issues of the year as consumption-like records (for the product / month summaries). */
export const issuesOfYear = (rows, period) => rows.filter((r) => !isOpen(r) && r.costMonth.slice(0, 4) === period.slice(0, 4))
  .map((r) => ({ month: r.costMonth, kind: r.kind === 'REWORK' ? 'REWORK' : r.kind === 'CONSUME' ? 'CONSUME' : 'SALE', prod: r.prod, pc: r.pc, qty: num(r.qty), tot: num(r.total) }));

/** By Cost month (issued) + "Còn tồn", split into this year's production and earlier years. */
export function byCostMonth(rows, period) {
  const y = period.slice(0, 4); const m = new Map();
  for (const r of rows) {
    const k = isOpen(r) ? 'CÒN TỒN' : cmText(r.costMonth);
    const e = m.get(k) || { cm: k, rows: 0, lots: new Set(), qty: 0, total: 0, rm: 0, c622: 0, c627: 0, qtyY: 0, totY: 0, qtyP: 0, totP: 0, rwQty: 0, rwTot: 0 };
    e.rows++; e.lots.add(lotOf(r)); e.qty += num(r.qty); e.total += num(r.total); e.rm += num(r.totalRM); e.c622 += num(r.c622); e.c627 += num(r.c627);
    if (r.period && r.period.slice(0, 4) === y) { e.qtyY += num(r.qty); e.totY += num(r.total); } else { e.qtyP += num(r.qty); e.totP += num(r.total); }
    if (r.kind === 'REWORK') { e.rwQty += num(r.qty); e.rwTot += num(r.total); }
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => (a.cm === 'CÒN TỒN' ? 1 : b.cm === 'CÒN TỒN' ? -1 : a.cm.localeCompare(b.cm))).map((e) => ({ ...e, lots: e.lots.size, unit: e.qty ? e.total / e.qty : null }));
}

// ---------------------------------------------------------------- 4.4 ↔ 5.1 / 5.2 reconciliation (REVIEW only, never blocks)
export const RECON_LOT_FIELDS = ['side', 'type', 'pc', 'prod', 'name', 'q44', 'a44', 'q5', 'a5', 'dq', 'da', 'info'];
export const RECON_LOT_HEADERS = ['Thời điểm', 'Loại chênh lệch', 'PC No.', 'Product code', 'Product Name', 'SL 4.4', 'Giá trị 4.4 (VND)', 'SL STEP 5', 'Giá trị STEP 5 (VND)', 'Chênh SL (4.4 − 5)', 'Chênh giá trị (4.4 − 5)', 'Ghi chú'];
function aggBy(list, q, a, extra) {
  const m = new Map();
  for (const r of list || []) {
    const k = lotOf(r); const e = m.get(k) || { pc: ttxt(r.pc), prod: utxt(r.prod), name: ttxt(r.name), q: 0, a: 0, src: new Set() };
    e.q += num(r[q]); e.a += num(r[a]); if (!e.name && r.name) e.name = ttxt(r.name); if (extra) { const s = extra(r); if (s) e.src.add(s); } m.set(k, e);
  }
  return m;
}
function lotDiff(side, A, B, labelB) {
  const out = [];
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    const a = A.get(k), b = B.get(k); const q44 = a ? a.q : 0, a44 = a ? a.a : 0, q5 = b ? b.q : 0, a5 = b ? b.a : 0;
    if (Math.abs(q44 - q5) <= TOLQ && Math.abs(a44 - a5) <= TOLA) continue;
    const x = a || b;
    out.push({ side, type: !b || (Math.abs(q5) <= TOLQ && Math.abs(a5) <= TOLA) ? 'CHỈ CÓ Ở 4.4' : !a || (Math.abs(q44) <= TOLQ && Math.abs(a44) <= TOLA) ? `CHỈ CÓ Ở ${labelB}` : Math.abs(q44 - q5) > TOLQ ? 'LỆCH SỐ LƯỢNG' : 'LỆCH GIÁ TRỊ',
      pc: x.pc, prod: x.prod, name: (a && a.name) || (b && b.name) || '', q44, a44, q5, a5, dq: q44 - q5, da: a44 - a5, info: b && b.src.size ? [...b.src].join(', ') : '' });
  }
  return out.sort((p, q) => Math.abs(q.da) - Math.abs(p.da));
}
/**
 * det = buildDetail(...); fgOpen = STEP 5.1 opening (any status); res = STEP 5 result of the period (or null).
 * Rows: opening stock, closing stock, this month's COGS (and rework issues), FIFO issues not found in 4.4.
 */
export function reconcile(det, fgOpen, res, period) {
  const sum = (l, f) => (l || []).reduce((a, r) => a + num(r[f]), 0);
  const open44 = det.opening.filter(isOpen), close44 = det.rows.filter(isOpen);
  const cogs44 = det.rows.filter((r) => r.costMonth === period && r.kind === 'SALE'), rw44 = det.rows.filter((r) => r.costMonth === period && r.kind === 'REWORK');
  const cons44 = det.rows.filter((r) => r.costMonth === period && r.kind === 'CONSUME');
  const has51 = !!(fgOpen && fgOpen.period === period && fgOpen.rows && fgOpen.rows.length);
  const has52 = !!(res && res.period === period);
  const fifo = has52 ? (res.detail || []).filter((d) => ttxt(d.lid) && num(d.qty) && d.kind !== 'CONS') : [];
  const fifoCons = has52 ? (res.detail || []).filter((d) => ttxt(d.lid) && num(d.qty) && d.kind === 'CONS') : [];
  const rwF = has52 && res.rework ? (res.rework.rows || []).filter((r) => ttxt(r.lid) && num(r.qty)) : [];
  const line = (area, label, q44, a44, ok, q5, a5, note = '') => {
    const st = !ok ? 'CHƯA CÓ SỐ' : Math.abs(q44 - q5) <= TOLQ && Math.abs(a44 - a5) <= TOLA ? 'KHỚP' : 'LỆCH';
    return { area, label, q44, a44, q5: ok ? q5 : null, a5: ok ? a5 : null, dq: ok ? q44 - q5 : null, da: ok ? a44 - a5 : null, status: st, note };
  };
  const rows = [
    line('Đầu kỳ', 'Tồn FG đầu kỳ: 4.4 (dòng chưa có Cost month) ↔ STEP 5.1 FG đầu kỳ', sum(open44, 'qty'), sum(open44, 'total'), has51, has51 ? sum(fgOpen.rows, 'qty') : 0, has51 ? sum(fgOpen.rows, 'tot') : 0, has51 ? `5.1: ${fgOpen.source || ''} · ${fgOpen.status || ''}` : 'Chưa nạp FG đầu kỳ ở STEP 5.1'),
    line('Trong kỳ', 'Giá vốn bán hàng kỳ này: dòng Cost month = kỳ (bán hàng) ↔ FIFO STEP 5.2', sum(cogs44, 'qty'), sum(cogs44, 'total'), has52, sum(fifo, 'qty'), sum(fifo, 'tot'), has52 ? 'Giá trị 4.4 tách theo tỷ lệ SL của dòng; FIFO lấy giá trị của lớp tồn STEP 5' : 'Chưa chạy FIFO kỳ này'),
    line('Trong kỳ', 'Xuất rework kỳ này: dòng Cost month = kỳ (rework) ↔ Rework FIFO STEP 5', sum(rw44, 'qty'), sum(rw44, 'total'), has52, sum(rwF, 'qty'), sum(rwF, 'tot')),
    line('Trong kỳ', 'Tiêu dùng nội bộ kỳ này: dòng Cost month = kỳ (CONSUME) ↔ FIFO tiêu dùng STEP 5.2 (Nợ 632 / Có 155)', sum(cons44, 'qty'), sum(cons44, 'total'), has52, sum(fifoCons, 'qty'), sum(fifoCons, 'tot'), 'Tiêu dùng nội bộ được tính FIFO trước giá vốn bán hàng'),
    line('Trong kỳ', 'Số FIFO lấy từ lô không có / không đủ trong 4.4', 0, 0, has52, sum(det.unmatched, 'qty'), sum(det.unmatched, 'tot'), 'Lô không có trong file 4.4 hoặc 4.4 còn tồn ít hơn số FIFO đã xuất'),
    line('Cuối kỳ', 'Tồn FG cuối kỳ: 4.4 (dòng chưa có Cost month) ↔ STEP 5.2 FG cuối kỳ', sum(close44, 'qty'), sum(close44, 'total'), has52, has52 ? sum(res.closing, 'qty') : 0, has52 ? sum(res.closing, 'tot') : 0, has52 ? 'STEP 5 cuối kỳ gồm cả lớp hàng trả lại / rework nhập lại (nếu có)' : 'Chưa chạy FIFO kỳ này'),
  ];
  const lots = [
    ...(has51 ? lotDiff('Đầu kỳ', aggBy(open44, 'qty', 'total'), aggBy(fgOpen.rows, 'qty', 'tot', (r) => ttxt(r.source) !== 'OPENING' ? ttxt(r.source) : ''), '5.1') : []),
    ...(has52 ? lotDiff('Cuối kỳ', aggBy(close44, 'qty', 'total'), aggBy(res.closing, 'qty', 'tot', (r) => (ttxt(r.source) && ttxt(r.source) !== 'OPENING' && ttxt(r.source) !== 'PRODUCTION' ? ttxt(r.source) : '')), '5.2') : []),
  ];
  const status = rows.some((r) => r.status === 'LỆCH') ? 'REVIEW' : rows.some((r) => r.status === 'CHƯA CÓ SỐ') ? 'PARTIAL' : 'PASS';
  return { status, rows, lots, has51, has52 };
}

// ---------------------------------------------------------------- export (Carol layout)
const iso = (s) => { const d = serialToYMD(s); return d && d.y ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''; };
const cell = (r, k) => {
  if (k === 'date') return typeof r.date === 'number' ? { v: r.date, z: 'yyyy-mm-dd' } : r.date ?? '';
  if (k === 'costMonth') return cmText(r.costMonth);
  if (k === 'uRM') return num(r.qty) ? num(r.totalRM) / num(r.qty) : '';
  if (k === 'uCost') return num(r.qty) ? num(r.total) / num(r.qty) : '';
  if (k === 'kind') return r.kind ? KIND_LABEL[r.kind] || r.kind : '';
  const v = r[k]; return v === null || v === undefined ? '' : v;
};
/** Rows for the next period's opening (January of a new year keeps only the rows still in stock). */
export function nextOpeningRows(rows, nextPeriod) {
  return nextPeriod.slice(5) === '01' ? rows.filter(isOpen) : rows;
}
/** Sheets (styled) of the 4.4 detail file: FG_DETAIL (importable, Carol column order) + TONG_HOP + guide. */
export function detailSheets(rows, forPeriod, note = '') {
  rows = [...rows].sort((a, b) => String(a.period).localeCompare(String(b.period)) || String(a.pc).localeCompare(String(b.pc)) || String(a.prod).localeCompare(String(b.prod)) || (a.costMonth ? 0 : 1) - (b.costMonth ? 0 : 1) || String(a.costMonth).localeCompare(String(b.costMonth)));
  const st = detailStats(rows, forPeriod);
  const col = (k) => DET_FIELDS.indexOf(k);
  const numFmt = {};
  for (const k of ['qty']) numFmt[col(k)] = '#,##0.###;(#,##0.###);"-"';
  for (const k of ['rmA', 'rmST', 'total', 'totalRM', 'c622', 'c627', 'uRM', 'uCost', 'provVND', 'net', 'fgEnd']) numFmt[col(k)] = '#,##0;(#,##0);"-"';
  numFmt[col('price')] = '#,##0.00';
  const notes = Object.fromEntries(DETAIL_GUIDE.map((c, i) => [i, `${c[0]} – ${c[2]}\nĐịnh dạng: ${c[3]}`]));
  const aoa = [
    [DET_MARKER, 'v2', `SVL - THÀNH PHẨM SẢN XUẤT & TỒN KHO CHI TIẾT THEO DÒNG (STEP 4.4 · đầu kỳ ${forPeriod})`],
    ['Dùng cho kỳ', forPeriod, 'Tồn đầu kỳ – SL', st.stockQty, 'Tồn đầu kỳ – VND', Math.round(st.stockTot), 'Số dòng', rows.length, note],
    ['Mỗi dòng là một phần của lô (PC No. + Product code). Có Cost month (YYYYMM) = đã ghi nhận giá vốn / đã xuất trong tháng đó; KHÔNG có Cost month = còn tồn. Tổng dòng chưa có Cost month = FG đầu kỳ. Không đổi tiêu đề dòng 4. Hướng dẫn: sheet HUONG_DAN.'],
    DET_HEADERS,
    ...rows.map((r) => DET_FIELDS.map((k) => cell(r, k))),
  ];
  const data = { name: 'FG_DETAIL', keep: true, header: 4, aoa, footer: `Thành phẩm chi tiết theo dòng – đầu kỳ ${forPeriod}`,
    cols: [15, 11, 17, 19, 30, 11, 6, 11, 16, 13, 17, 16, 15, 16, 10, 13, 13, 10, 11, 9, 13, 14, 16, 12, 22, 14, 18, 10, 6, 16, 26, 26],
    tpl: { headerRow: 4, freezeCols: 4, required: ['pc', 'date', 'prod', 'qty', 'total'].map(col), conditional: ['costMonth', 'totalRM', 'c622', 'c627'].map(col), numFmt, notes, center: [col('unit'), col('costMonth'), col('erp')], minRows: rows.length + 200 } };
  if (!rows.length) return [data];
  const cm = byCostMonth(rows, forPeriod);
  const fmtN = (v, q) => ({ v, z: q ? '#,##0.###;(#,##0.###);"-"' : '#,##0;(#,##0);"-"' });
  const y = forPeriod.slice(0, 4);
  const head = ['Cost month', 'Số dòng', 'Số lô', 'SL', 'Giá trị (VND)', 'Trong đó SX năm ' + y + ' – SL', 'SX năm ' + y + ' – VND', 'SX năm trước – SL', 'SX năm trước – VND', 'Trong đó xuất rework – SL', 'Xuất rework – VND'];
  const body = cm.map((e) => [e.cm, e.rows, e.lots, fmtN(e.qty, 1), fmtN(e.total), fmtN(e.qtyY, 1), fmtN(e.totY), fmtN(e.qtyP, 1), fmtN(e.totP), fmtN(e.rwQty, 1), fmtN(e.rwTot)]);
  const tot = ['Tổng', rows.length, st.lots, fmtN(st.qty, 1), fmtN(st.total), '', '', '', '', '', ''];
  return [data, { name: 'TONG_HOP', title: `TỔNG HỢP THEO COST MONTH – file đầu kỳ ${forPeriod}`, subtitle: `Dòng "CÒN TỒN" = FG đầu kỳ ${forPeriod}: SL ${st.stockQty.toLocaleString('en-US')} · ${Math.round(st.stockTot).toLocaleString('en-US')} VND${note ? ' · ' + note : ''}`, header: 4,
    aoa: [head, ...body, tot], cols: [14, 9, 9, 14, 20, 16, 20, 15, 18, 15, 17], footer: `4.4 tổng hợp theo cost month ${forPeriod}` }];
}

