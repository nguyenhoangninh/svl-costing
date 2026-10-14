// STEP 4.4 — Thành phẩm sản xuất lũy kế từ đầu năm (owner request 06/10/2026).
// Opening (prior months of the year: upload file or roll forward) + current month (posted from STEP 4.3 final layer)
// = YTD finished-goods production by lot, product and month. Rolled into the next month; January starts a new year.
import { txt, ttxt, utxt, num, isNumeric, nowISO, fpRows, serialToYMD, cellDateSerial } from './util.js';
import { FG_PROD_COLS } from './templates.js';
import * as FD from './fgdetail.js'; // v1.14.27 detail (Carol) model – functions only used at call time (circular import is safe)

export const FGP_FIELDS = ['period', 'erp', 'pc', 'date', 'mo', 'prod', 'name', 'fam', 'loc', 'unit', 'qty', 'baseRM', 'wipAdj', 'carryIn', 'totalRM', 'c622', 'c627', 'total', 'unitCost', 'source', 'note'];
export const FGP_HEADERS = ['Kỳ', 'ERP', 'PC No.', 'PC Date', 'MO No.', 'Product Code', 'Product Name', 'Costing Family', 'Location', 'Unit', 'Complete Qty', 'RM gốc (PC + Stock Out)', 'Điều chỉnh WIP 3B', 'Rework chuyển vào', 'Total RM', '622', '627', 'Tổng giá thành', 'Giá thành / đv', 'Nguồn', 'Ghi chú'];
export const FGP_MARKER = 'SVL_FG_PRODUCTION_YTD';
/** Columns of the upload template (row 4). Required: Kỳ, Product Code, Complete Qty and Tổng giá thành (or RM + 622 + 627). */
export const TPL_COLS = [
  ['period', 'Kỳ (YYYY-MM)'], ['erp', 'ERP'], ['pc', 'PC No.'], ['date', 'PC Date'], ['mo', 'MO No.'], ['prod', 'Product Code'], ['name', 'Product Name'],
  ['fam', 'Costing Family'], ['loc', 'Location'], ['unit', 'Unit'], ['qty', 'Complete Qty'], ['totalRM', 'RM (VND)'], ['c622', '622 (VND)'], ['c627', '627 (VND)'],
  ['total', 'Tổng giá thành (VND)'], ['soldQty0', 'SL đã xuất trước kỳ'], ['soldTot0', 'Giá vốn đã xuất trước kỳ (VND)'], ['note', 'Ghi chú'],
];
const TOL = 1;
const ym = (p) => /^\d{4}-\d{2}$/.test(p);
const yearOf = (p) => p.slice(0, 4);

/** Rows of the current month from the STEP 4.3 final layer (04_COST_ALLOCATION after 3B and rework carry-in). */
export function rowsFromFinalLayer(fl, period) {
  return ((fl && fl.rows) || []).filter((r) => ttxt(r.pc) && (num(r.qty) !== 0 || Math.abs(num(r.totalCost)) > TOL)).map((r) => {
    const qty = num(r.qty), total = num(r.totalCost);
    return { period, erp: ttxt(r.erp), pc: ttxt(r.pc), date: r.date ?? null, mo: ttxt(r.sub) || ttxt(r.mo), prod: utxt(r.prod), name: ttxt(r.name), fam: ttxt(r.fam), loc: ttxt(r.loc), unit: ttxt(r.unit),
      qty, baseRM: num(r.baseRM), wipAdj: num(r.wipAdj), carryIn: num(r.carryIn), totalRM: num(r.totalRM), c622: num(r.t622), c627: num(r.t627), total, unitCost: qty ? total / qty : null, source: 'STEP 4.3', note: '' };
  });
}
export const rowsKey = (rows) => fpRows(rows || [], (r) => [r.period, r.erp, r.pc, r.prod, num(r.qty), num(r.totalRM).toFixed(0), num(r.c622).toFixed(0), num(r.c627).toFixed(0), num(r.total).toFixed(0)].join('|'));

/** Accepts 2026-07, 07/2026, 7/2026, 202607 or an Excel date in the month. */
export function parsePeriod(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (v >= 190001 && v <= 299912 && Number.isInteger(v)) { const s = String(v); return `${s.slice(0, 4)}-${s.slice(4)}`; }
    const d = serialToYMD(v); return d && d.y ? `${d.y}-${String(d.m).padStart(2, '0')}` : '';
  }
  const s = txt(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/); if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})(\d{2})$/); if (m) return `${m[1]}-${m[2]}`;
  const d = cellDateSerial(s); if (d !== null) { const x = serialToYMD(d); return `${x.y}-${String(x.m).padStart(2, '0')}`; }
  return '';
}
const norm = (s) => txt(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const ALIAS = {
  period: ['KYYYYYMM', 'KY', 'PERIOD', 'MONTH', 'THANG', 'COSTMONTH'], erp: ['ERP'], pc: ['PCNO', 'PC', 'PCNUMBER'], date: ['PCDATE', 'DATE', 'COMPLETEDATE'], mo: ['MONO', 'MO', 'SUBMO'],
  prod: ['PRODUCTCODE', 'PRODUCTNUMBER', 'ITEMCODE'], name: ['PRODUCTNAME', 'ITEMNAME'], fam: ['COSTINGFAMILY', 'FAMILY'], loc: ['LOCATION', 'SOURCELOCATION'], unit: ['UNIT', 'UOM'],
  qty: ['COMPLETEQTY', 'QTY', 'QUANTITY'], totalRM: ['RMVND', 'RM', 'TOTALRM', 'RMCOST'], c622: ['622VND', '622', 'TOTAL622', 'DIRECTLABORS'], c627: ['627VND', '627', 'TOTAL627'],
  total: ['TONGGIATHANHVND', 'TONGGIATHANH', 'TOTALPRODUCTIONCOST', 'TOTALCOST', 'TOTALCOSTVND', 'PRODUCTIONCOST'], note: ['GHICHU', 'NOTE'],
  soldQty0: ['SLDAXUATTRUOCKY', 'SOLDQTY'], soldTot0: ['GIAVONDAXUATTRUOCKYVND', 'GIAVONDAXUATTRUOCKY', 'SOLDCOST'],
};
// Vietnamese headers lose their diacritics in norm() only partly; map the accented forms explicitly.
const deaccent = (s) => txt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

/** Upload of the year's earlier months (opening). Every row: period in the same year and before `period`. */
export function importOpening(grids, fileName, period) {
  let g = null, hdr = -1, col = null;
  for (const grid of Object.values(grids || {})) {
    for (let r = 0; r < Math.min(grid.length, 30); r++) {
      const h = (grid[r] || []).map((x) => norm(deaccent(x)));
      const find = (k) => h.findIndex((x) => x && ALIAS[k].includes(x));
      const c = Object.fromEntries(Object.keys(ALIAS).map((k) => [k, find(k)]));
      if (c.period >= 0 && c.prod >= 0 && c.qty >= 0 && (c.total >= 0 || c.totalRM >= 0)) { g = grid; hdr = r; col = c; break; }
    }
    if (g) break;
  }
  if (!g) throw new Error('Không tìm thấy bảng có các cột Kỳ, Product Code, Complete Qty và Tổng giá thành (hoặc RM / 622 / 627). Dùng nút "Tải template".');
  const rows = []; let block = 0, review = 0;
  const y = yearOf(period);
  for (let i = hdr + 1; i < g.length; i++) {
    const x = g[i] || []; const v = (k) => (col[k] >= 0 ? x[col[k]] ?? null : null);
    if (!ttxt(v('prod')) && !ttxt(v('period')) && !ttxt(v('qty'))) continue;
    const hard = [], warn = [];
    const p = parsePeriod(v('period'));
    if (!p) hard.push('Kỳ không đọc được (dùng YYYY-MM)');
    else if (yearOf(p) !== y) hard.push(`Kỳ ${p} không thuộc năm ${y}`);
    else if (p >= period) hard.push(`Kỳ ${p} không trước kỳ ${period} (số kỳ này lấy từ STEP 4.3)`);
    const prod = utxt(v('prod')); if (!prod) hard.push('Thiếu Product Code');
    const n = (k) => { const raw = v(k); if (raw === null || raw === '') return 0; if (!isNumeric(raw)) { hard.push(`${k} không phải số`); return 0; } return num(raw); };
    const qty = n('qty'), rm = n('totalRM'), c622 = n('c622'), c627 = n('c627'), soldQty0 = n('soldQty0'), soldTot0 = n('soldTot0');
    let total = n('total');
    const hasTotal = col.total >= 0 && v('total') !== null && v('total') !== '';
    if (!hasTotal) total = rm + c622 + c627;
    else if ((col.totalRM >= 0 || col.c622 >= 0 || col.c627 >= 0) && (rm || c622 || c627) && Math.abs(rm + c622 + c627 - total) > TOL) warn.push(`RM + 622 + 627 = ${Math.round(rm + c622 + c627)} khác Tổng giá thành ${Math.round(total)}`);
    if (qty < 0) hard.push('Complete Qty âm');
    if (soldQty0 < 0 || soldQty0 > qty + 1e-6) hard.push('SL đã xuất trước kỳ phải từ 0 đến Complete Qty');
    if (qty === 0 && Math.abs(total) > TOL) warn.push('Có giá trị nhưng SL = 0');
    if (qty > 0 && total <= 0) warn.push('SL > 0 nhưng giá thành ≤ 0');
    const d = v('date'); const ds = d === null || d === '' ? null : typeof d === 'number' ? d : cellDateSerial(d);
    const st = hard.length ? 'BLOCK' : warn.length ? 'REVIEW' : 'PASS';
    if (st === 'BLOCK') block++; else if (st === 'REVIEW') review++;
    rows.push({ period: p, erp: ttxt(v('erp')), pc: ttxt(v('pc')), date: ds, mo: ttxt(v('mo')), prod, name: ttxt(v('name')), fam: ttxt(v('fam')), loc: ttxt(v('loc')), unit: ttxt(v('unit')),
      qty, baseRM: rm, wipAdj: 0, carryIn: 0, totalRM: rm, c622, c627, total, unitCost: qty ? total / qty : null, soldQty0, soldTot0, source: 'UPLOAD', note: ttxt(v('note')),
      srcRow: i + 1, check: st, msg: [...hard, ...warn].join('; ') });
  }
  if (!rows.length) throw new Error('File không có dòng dữ liệu.');
  const through = rows.reduce((a, r) => (r.period > a ? r.period : a), '');
  return { kind: 'UPLOAD', source: fileName, loadedAt: nowISO(), period, through, rows, status: block ? 'BLOCKED' : review ? 'VALIDATED WITH REVIEW' : 'VALIDATED', stats: stats(rows, block, review) };
}
const stats = (rows, block = 0, review = 0) => ({ rows: rows.length, qty: rows.reduce((a, r) => a + num(r.qty), 0), total: rows.reduce((a, r) => a + num(r.total), 0), block, review, months: [...new Set(rows.map((r) => r.period))].sort() });

/**
 * Opening of `newPeriod` from the previous month's table: its opening + its posted month. January starts a new year (empty).
 */
export function rollOpening(prev, prevP, newPeriod) {
  if (prev && prev.opening && prev.opening.period === prevP && prev.opening.model === 'DETAIL') return rollDetail(prev, prevP, newPeriod);
  if (yearOf(newPeriod) !== yearOf(prevP) || newPeriod.slice(5) === '01') return { kind: 'NEW YEAR', source: `Năm mới ${yearOf(newPeriod)}`, loadedAt: nowISO(), period: newPeriod, through: '', rows: [], status: 'VALIDATED', stats: stats([]) };
  if (!prev || !prev.current || prev.current.period !== prevP) throw new Error(`Kỳ ${prevP} chưa chuyển kết quả STEP 4.3 vào bảng Thành phẩm SX lũy kế (mở kỳ ${prevP} → 4.4 → Cập nhật từ STEP 4.3).`);
  const op = prev.opening && prev.opening.status !== 'BLOCKED' ? prev.opening.rows.filter((r) => r.period < prevP) : [];
  const rows = [...op, ...prev.current.rows].map((r) => ({ ...r, source: r.source === 'STEP 4.3' ? `STEP 4.3 ${r.period}` : r.source, check: undefined, msg: undefined }));
  const sales = [...((prev.opening && prev.opening.status !== 'BLOCKED' && prev.opening.sales) || []).filter((x) => x.month < prevP), ...(prev.current.sales || [])];
  return { kind: 'ROLL', source: `Roll forward từ ${prevP}`, loadedAt: nowISO(), period: newPeriod, through: prevP, rows, sales, status: 'VALIDATED', stats: stats(rows) };
}

/** v1.14.27 — detail model roll: every row of the previous month's detail table (its opening + its lots with its FIFO issues
 * split off). January keeps only the rows still in stock (the sold history stays in the previous year). */
export function rollDetail(prev, prevP, newPeriod) {
  if (!prev.current || prev.current.period !== prevP) throw new Error(`Kỳ ${prevP} chưa chuyển kết quả STEP 4.3 vào bảng Thành phẩm SX lũy kế (mở kỳ ${prevP} → 4.4 → Cập nhật từ STEP 4.3).`);
  const det = FD.buildDetail(prev, prevP);
  const newYear = yearOf(newPeriod) !== yearOf(prevP);
  const rows = FD.nextOpeningRows(det.rows, newPeriod).map((r) => ({ ...r, check: undefined, msg: undefined, fifoTot: undefined }));
  const sales = newYear ? [] : [...((prev.opening.sales) || []).filter((x) => x.month < prevP), ...(prev.current.sales || [])];
  return { model: 'DETAIL', kind: newYear ? 'NEW YEAR' : 'ROLL', source: `${newYear ? 'Năm mới – tồn kho ' : 'Roll forward '}từ ${prevP}`, loadedAt: nowISO(), period: newPeriod, through: prevP, rows, sales,
    status: 'VALIDATED', stats: FD.detailStats(rows, newPeriod) };
}
/** Sales records to apply on the lot table: the detail model already holds earlier months in its rows (sold-before). */
export function allocSales(fp, period) {
  return FD.isDetail(fp, period) ? ytdSales(fp, period).filter((x) => x.month === period) : ytdSales(fp, period);
}

/**
 * FIFO consumption of the month from the STEP 5 result: every take of a lot by an invoice line (month, invoice, customer,
 * qty, cost) and every FG issue to rework. Keyed to the 4.4 lots by source period + PC No. + product.
 */
export function consumptionFromStep5(res, period) {
  if (!res || res.period !== period) return [];
  const led = new Map(((res.ledger) || []).map((l) => [ttxt(l.lid), l]));
  const sales = new Map(((res.sales) || []).map((x) => [x.seq, x]));
  const out = [];
  for (const d of res.detail || []) {
    if (!num(d.qty)) continue;
    const l = led.get(ttxt(d.lid)) || {}; const sl = d.line ? sales.get(d.line) : null;
    // v1.14.28: FG consumption (tiêu dùng nội bộ) is its own kind – it is not a sale and has no invoice
    const cons = d.kind === 'CONS';
    out.push({ month: period, kind: cons ? 'CONSUME' : 'SALE', lotPeriod: ttxt(d.srcPeriod ?? l.srcPeriod), pc: ttxt(d.pc), prod: utxt(d.prod), lid: ttxt(d.lid),
      inv: cons ? '(tiêu dùng nội bộ)' : sl ? ttxt(sl.inv) : '(bình quân tháng)', cust: cons ? 'Tiêu dùng nội bộ' : sl ? ttxt(sl.cust) : '', sdate: sl ? sl.date : null, qty: num(d.qty), tot: num(d.tot) });
  }
  for (const r of (res.rework && res.rework.rows) || []) {
    if (!num(r.qty) || !ttxt(r.lid)) continue;
    const l = led.get(ttxt(r.lid)) || {};
    out.push({ month: period, kind: 'REWORK', lotPeriod: ttxt(l.srcPeriod), pc: ttxt(l.pc), prod: utxt(r.fg || l.prod), lid: ttxt(r.lid), inv: ttxt(r.rid), cust: 'Xuất đi rework', sdate: r.issueDate ?? null, qty: num(r.qty), tot: num(r.tot) });
  }
  return out;
}
export const lotKey = (period, pc, prod) => `${period}|${utxt(pc)}|${utxt(prod)}`;
/** Consumption records of the year up to `period` (opening months + this month). */
export function ytdSales(fp, period) {
  const op = fp && fp.opening && fp.opening.period === period && fp.opening.status !== 'BLOCKED' ? (fp.opening.sales || []).filter((x) => x.month < period && yearOf(x.month) === yearOf(period)) : [];
  const cur = fp && fp.current && fp.current.period === period ? fp.current.sales || [] : [];
  return [...op, ...cur];
}
/**
 * Lots of the YTD table with what has been issued from them (sales by invoice / rework) and what is left.
 * Records whose lot is not in the table (opening FG from before the year / not uploaded) are returned as `unmatched`.
 */
export function allocate(rows, sales) {
  const idx = new Map(), byPc = new Map(); const lots = rows.map((r) => ({ ...r, soldQty: num(r.soldQty0), soldTot: num(r.soldTot0), rwQty: 0, rwTot: 0, csQty: 0, csTot: 0, months: {}, invs: new Set() }));
  lots.forEach((r) => {
    const k = lotKey(r.period, r.pc, r.prod); if (r.pc && !idx.has(k)) idx.set(k, r);
    // v1.14.26: PC numbers are unique (PC-YYMM-nnn), so a lot is also found by PC No. + product when the FG layer carries
    // another source period (opening FG loaded from an Excel "month detail" file is stamped with the previous month).
    const k2 = `${utxt(r.pc)}|${utxt(r.prod)}`; if (r.pc) byPc.set(k2, byPc.has(k2) ? null : r);
  });
  const unmatched = [];
  for (const x of sales || []) {
    const r = idx.get(lotKey(x.lotPeriod, x.pc, x.prod)) || (x.pc ? byPc.get(`${utxt(x.pc)}|${utxt(x.prod)}`) : null);
    if (!r) { unmatched.push(x); continue; }
    if (x.kind === 'REWORK') { r.rwQty += num(x.qty); r.rwTot += num(x.tot); }
    else if (x.kind === 'CONSUME') { r.csQty += num(x.qty); r.csTot += num(x.tot); } // v1.14.28: internal consumption, not a sale
    else { r.soldQty += num(x.qty); r.soldTot += num(x.tot); r.invs.add(x.inv); }
    r.months[x.month] = num(r.months[x.month]) + num(x.qty);
  }
  for (const r of lots) {
    r.remQty = num(r.qty) - r.soldQty - r.rwQty; r.remTot = num(r.total) - r.soldTot - r.rwTot;
    r.issuedMonths = Object.entries(r.months).sort().map(([m, q]) => `${m}: ${Math.round(q * 1000) / 1000}`).join(' · ');
    r.invCount = r.invs.size; delete r.invs; delete r.months;
  }
  return { lots, unmatched };
}

/** All rows of the YTD table for `period`: valid opening rows (earlier months of the year) + posted current month. */
export function ytdRows(fp, period) {
  if (FD.isDetail(fp, period)) return [...(fp.opening.status !== 'BLOCKED' ? FD.lotsFromRows(fp.opening.rows, period) : []), ...(fp.current && fp.current.period === period ? fp.current.rows : [])];
  const op = fp && fp.opening && fp.opening.period === period && fp.opening.status !== 'BLOCKED' ? fp.opening.rows.filter((r) => r.period < period && yearOf(r.period) === yearOf(period)) : [];
  const cur = fp && fp.current && fp.current.period === period ? fp.current.rows : [];
  return [...op, ...cur];
}
const add = (o, r) => { o.qty += num(r.qty); o.totalRM += num(r.totalRM); o.c622 += num(r.c622); o.c627 += num(r.c627); o.total += num(r.total); o.lots++; };
const z = () => ({ qty: 0, totalRM: 0, c622: 0, c627: 0, total: 0, lots: 0 });
/** By product (this month / YTD) and by month. */
export function summarize(rows, period, sales = []) {
  const byProd = new Map(), byMonth = new Map();
  for (const r of rows) {
    if (!byProd.has(r.prod)) byProd.set(r.prod, { prod: r.prod, name: r.name, unit: r.unit, fam: r.fam, cur: z(), ytd: z() });
    const p = byProd.get(r.prod); if (!p.name && r.name) p.name = r.name; if (!p.unit && r.unit) p.unit = r.unit;
    add(p.ytd, r); if (r.period === period) add(p.cur, r);
    if (!byMonth.has(r.period)) byMonth.set(r.period, { period: r.period, ...z(), prods: new Set() });
    const m = byMonth.get(r.period); add(m, r); m.prods.add(r.prod);
  }
  const soldP = new Map(), soldM = new Map();
  for (const x of sales || []) {
    if (x.kind !== 'SALE') continue;
    const a = soldP.get(x.prod) || { q: 0, t: 0 }; a.q += num(x.qty); a.t += num(x.tot); soldP.set(x.prod, a);
    const b = soldM.get(x.month) || { q: 0, t: 0 }; b.q += num(x.qty); b.t += num(x.tot); soldM.set(x.month, b);
    if (!byProd.has(x.prod)) byProd.set(x.prod, { prod: x.prod, name: '', unit: '', fam: '', cur: z(), ytd: z() });
  }
  const prods = [...byProd.values()].map((p) => ({ soldQty: soldP.has(p.prod) ? soldP.get(p.prod).q : 0, soldTot: soldP.has(p.prod) ? soldP.get(p.prod).t : 0, prod: p.prod, name: p.name, unit: p.unit, fam: p.fam,
    curQty: p.cur.qty, curTotal: p.cur.total, curUnit: p.cur.qty ? p.cur.total / p.cur.qty : null,
    ytdQty: p.ytd.qty, ytdRM: p.ytd.totalRM, ytd622: p.ytd.c622, ytd627: p.ytd.c627, ytdTotal: p.ytd.total, ytdUnit: p.ytd.qty ? p.ytd.total / p.ytd.qty : null, lots: p.ytd.lots }))
    .sort((a, b) => b.ytdTotal - a.ytdTotal);
  let cq = 0, ct = 0;
  for (const m of soldM.keys()) if (!byMonth.has(m)) byMonth.set(m, { period: m, ...z(), prods: new Set() });
  const months = [...byMonth.values()].sort((a, b) => (a.period < b.period ? -1 : 1)).map((m) => { cq += m.qty; ct += m.total; return { soldQty: soldM.has(m.period) ? soldM.get(m.period).q : 0, soldTot: soldM.has(m.period) ? soldM.get(m.period).t : 0, period: m.period, products: m.prods.size, lots: m.lots, qty: m.qty, totalRM: m.totalRM, c622: m.c622, c627: m.c627, total: m.total, unitAvg: m.qty ? m.total / m.qty : null, cumQty: cq, cumTotal: ct }; });
  const T = rows.reduce((o, r) => { add(o, r); return o; }, z());
  const C = rows.filter((r) => r.period === period).reduce((o, r) => { add(o, r); return o; }, z());
  return { prods, months, ytd: T, cur: C };
}

/** Upload template (optionally pre-filled, e.g. the YTD through this month = opening file of next month). */
const monthsText = (rows) => { const m = [...new Set(rows.map((r) => r.period))].sort(); return m.length > 2 ? `${m[0]} → ${m[m.length - 1]} (${m.length} tháng)` : m.join(', '); };
export function templateAOA(rows, forPeriod, note = '') {
  return [
    [FGP_MARKER, 'v1', 'SVL - THÀNH PHẨM SẢN XUẤT LŨY KẾ TỪ ĐẦU NĂM (FILE ĐẦU KỲ CHO STEP 4.4)'],
    ['Dùng cho kỳ', forPeriod, 'Gồm các tháng', rows.length ? monthsText(rows) : `${yearOf(forPeriod)}-01 … tháng trước ${forPeriod}`, '', '', note], // row 2 is informational only (not read)
    ['Mỗi dòng là một lô (hoặc một sản phẩm / tháng). Bắt buộc: Kỳ (YYYY-MM, cùng năm và trước kỳ dùng), Product Code, Complete Qty, Tổng giá thành (hoặc RM + 622 + 627). Không đổi tiêu đề dòng 4. Hướng dẫn chi tiết và ví dụ: sheet HUONG_DAN.'],
    TPL_COLS.map(([, h]) => h),
    ...rows.map((r) => TPL_COLS.map(([k]) => (k === 'date' && typeof r.date === 'number' ? isoDate(r.date) : k === 'soldQty0' ? num(r.soldQty) + num(r.rwQty) || num(r.soldQty0) || '' : k === 'soldTot0' ? num(r.soldTot) + num(r.rwTot) || num(r.soldTot0) || '' : r[k] ?? ''))),
  ];
}
/** v1.14.26 — the 4.4 upload template as styled sheets: FG_PRODUCTION (importable, rows 1–4 fixed) + TONG_HOP (by month). */
export const TPL_WIDTHS = [11, 6, 16, 12, 18, 20, 34, 14, 12, 7, 13, 17, 16, 16, 19, 15, 20, 30];
export function templateSheets(rows, forPeriod, note = '') {
  const col = (k) => TPL_COLS.findIndex(([f]) => f === k);
  const numFmt = {}; for (const k of ['qty', 'soldQty0']) numFmt[col(k)] = '#,##0.###'; for (const k of ['totalRM', 'c622', 'c627', 'total', 'soldTot0']) numFmt[col(k)] = '#,##0';
  const notes = Object.fromEntries(FG_PROD_COLS.map((c, i) => [i, `${c[1]} – ${c[2]}\nĐịnh dạng: ${c[3]}${c[4] !== '' && c[4] !== undefined ? `\nVí dụ: ${c[4]}` : ''}`]));
  // professional order: month → ERP → PC No. → product (the reader does not depend on the order)
  rows = [...rows].sort((a, b) => String(a.period).localeCompare(String(b.period)) || String(a.erp).localeCompare(String(b.erp)) || String(a.pc).localeCompare(String(b.pc)) || String(a.prod).localeCompare(String(b.prod)));
  const data = { name: 'FG_PRODUCTION', keep: true, header: 4, aoa: templateAOA(rows, forPeriod, note), cols: TPL_WIDTHS, footer: `Thành phẩm SX lũy kế – file đầu kỳ ${forPeriod}`,
    tpl: { headerRow: 4, freezeCols: 3, required: ['period', 'prod', 'qty', 'total'].map(col), conditional: ['totalRM', 'c622', 'c627'].map(col), numFmt, notes,
      lists: { [col('erp')]: ['T', 'O'], [col('fam')]: ['DOONA', 'MK', 'VETO', 'HAMA', 'O-OTHER'] }, center: [col('erp'), col('unit')], mergeInfo: true, minRows: Math.max(500, rows.length + 200) } };
  if (!rows.length) return [data];
  const by = new Map();
  for (const r of rows) {
    const m = by.get(r.period) || { lots: 0, prods: new Set(), qty: 0, rm: 0, c622: 0, c627: 0, total: 0, sold: 0, soldTot: 0 };
    m.lots++; m.prods.add(utxt(r.prod)); m.qty += num(r.qty); m.rm += num(r.totalRM); m.c622 += num(r.c622); m.c627 += num(r.c627); m.total += num(r.total);
    const sq = num(r.soldQty) + num(r.rwQty) || num(r.soldQty0), st = num(r.soldTot) + num(r.rwTot) || num(r.soldTot0); m.sold += sq; m.soldTot += st;
    by.set(r.period, m);
  }
  const head = ['Tháng sản xuất', 'Số lô', 'Số mã thành phẩm', 'SL hoàn thành', 'RM (VND)', '622 (VND)', '627 (VND)', 'Tổng giá thành (VND)', 'SL đã xuất trước kỳ', 'Giá vốn đã xuất (VND)', 'SL còn lại', 'Giá trị còn lại (VND)'];
  const body = [...by.entries()].sort().map(([p, m]) => [p, m.lots, m.prods.size, m.qty, m.rm, m.c622, m.c627, m.total, m.sold, m.soldTot, m.qty - m.sold, m.total - m.soldTot]);
  const tot = body.reduce((a, r) => a.map((v, i) => (i < 1 ? v : i === 2 ? v : v + r[i])), ['Tổng', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  tot[2] = new Set(rows.map((r) => utxt(r.prod))).size;
  const fmt = (r) => r.map((v, i) => (typeof v === 'number' ? { v, z: [3, 8, 10].includes(i) ? '#,##0.###;(#,##0.###);"-"' : '#,##0;(#,##0);"-"' } : v));
  return [data, { name: 'TONG_HOP', title: `THÀNH PHẨM SẢN XUẤT LŨY KẾ – TỔNG HỢP THEO THÁNG (file đầu kỳ ${forPeriod})`, subtitle: note || `Số liệu của sheet FG_PRODUCTION · ${rows.length} dòng`, header: 4, aoa: [head, ...body.map(fmt), fmt(tot)], cols: [14, 8, 12, 14, 18, 17, 17, 19, 15, 19, 13, 19], footer: `Thành phẩm SX lũy kế – tổng hợp ${forPeriod}` }];
}
const isoDate = (s) => { const d = serialToYMD(s); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; };
