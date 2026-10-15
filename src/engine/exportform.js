// Export layout of 04_COST_ALLOCATION, 05_FG_OPENING and 05_FG_CLOSING (v1.14.69).
// Column order and header text follow the approved templates ("template Cost allocation", "template 05_FG_OPENING",
// "template 05_FG_CLOSING"): row 1 = totals (cost allocation) or title (FG), row 2 = headers, data from row 3.
// The engine fields (CA_FIELDS, LAYER_FIELDS) are not changed: this module only maps them to the export.
import { num, utxt, serialToISO } from './util.js';

export const Z_QTY = '#,##0';
export const Z_VND = '#,##0;(#,##0);"-"';
export const Z_UNIT = '#,##0;(#,##0);"-"';
export const Z_USD = '#,##0.00;(#,##0.00);"-"';
export const Z_PCT = '0.00%';
export const Z_WEIGHT = '0.0000%';

const FIRST = 3; // first data row on every export sheet
const colLetter = (n) => { let s = ''; for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s; };
const dateText = (x) => (typeof x === 'number' ? serialToISO(x) : (x || ''));
/** A cell value: text as is, a finite number with its format, blank for null / NaN / ''. */
function put(v, z) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? { v, z } : '';
  return v;
}

// ---------------------------------------------------------------- 04_COST_ALLOCATION (template Cost allocation, A:AR)
// key: CA_FIELDS key, or a derived key (loc, unitRMUSD, allocUSD); null = blank column in the template.
// sum: the row-1 total (template SUM formulas kept only for amount and quantity columns).
export const CA_COLS = [
  { key: 'erp', head: 'ERP', width: 9 },
  { key: 'pc', head: 'PC No.', width: 14 },
  { key: 'date', head: 'PC Date', width: 12 },
  { key: 'mo', head: 'MO No.', width: 14 },
  { key: 'sub', head: 'Sub-MO', width: 18 },
  { key: 'prod', head: 'Product Code', width: 18 },
  { key: 'name', head: 'Product Name', width: 30 },
  { key: 'loc', head: 'Source Location', width: 15 },
  { key: 'unit', head: 'Unit', width: 9 },
  { key: 'qty', head: 'Complete Qty', width: 13, z: Z_QTY, sum: true },
  { key: 'pcRM', head: 'PC RM Cost', width: 16, z: Z_VND, sum: true },
  { key: 'so', head: 'Stock Out Allocated', width: 18, z: Z_VND, sum: true },
  { key: 'baseRM', head: 'Base Total RM (Pre WIP Adj)', width: 24, z: Z_VND, sum: true },
  { key: 'd622', head: 'Direct 622', width: 15, z: Z_VND, sum: true },
  { key: 'd627', head: 'Direct 627', width: 15, z: Z_VND, sum: true },
  { key: 'c622', head: 'Common 622', width: 15, z: Z_VND, sum: true },
  { key: 'c627', head: 'Common 627', width: 15, z: Z_VND, sum: true },
  { key: 't622', head: 'Total 622', width: 15, z: Z_VND, sum: true },
  { key: 't627', head: 'Total 627', width: 15, z: Z_VND, sum: true },
  { key: 'baseCost', head: 'Base Total Production Cost (Pre WIP Adj)', width: 32, z: Z_VND, sum: true },
  { key: 'fx', head: 'FX', width: 10, z: Z_QTY },
  { key: 'price', head: 'Unit Sales Price(USD)', width: 16, z: Z_USD },
  { key: 'salesVND', head: 'Sales Value (VND)', width: 18, z: Z_VND, sum: true },
  { key: 'unitRMUSD', head: 'Unit RM ( USD)', width: 14, z: Z_USD },
  { key: 'unitCost', head: 'Unit Cost', width: 15, z: Z_UNIT },
  { key: 'rmPct', head: 'RM %', width: 10, z: Z_PCT },
  { key: 'p622', head: '622 %', width: 10, z: Z_PCT },
  { key: 'p627', head: '627 %', width: 10, z: Z_PCT },
  { key: 'gpPct', head: 'GP %', width: 10, z: Z_PCT },
  { key: 'allocUSD', head: 'allocation based after RM(sales-RM)', width: 22, z: Z_USD, sum: true },
  { key: 'priceSrc', head: 'Price Source', width: 24 },
  { key: 'contrib', head: 'Contribution Before Conversion', width: 28, z: Z_VND, sum: true },
  { key: 'eligible', head: 'Eligible Base', width: 18, z: Z_VND, sum: true },
  { key: 'weight', head: 'Allocation Weight', width: 16, z: Z_WEIGHT, sum: true },
  { key: null, head: '', width: 2 },
  { key: 'statusText', head: 'Status / Review', width: 27 },
  { key: 'wipAdj', head: 'Direct WIP Adj Amount', width: 22, z: Z_VND, sum: true },
  { key: 'totalRM', head: 'Total RM', width: 16, z: Z_VND, sum: true },
  { key: 'totalCost', head: 'Total Production Cost', width: 22, z: Z_VND, sum: true },
  { key: 'finalUnit', head: 'Final Unit Cost', width: 16, z: Z_UNIT },
  { key: 'wipAdjStatus', head: 'WIP Adj Status', width: 18 },
  { key: 'ohBasis', head: 'OH Driver Basis', width: 19 },
  { key: 'carryIn', head: 'Rework Carry-In FG FIFO', width: 24, z: Z_VND, sum: true },
  { key: 'carryStatus', head: 'Rework Carry-In Status', width: 24 },
];

function caValue(r, key) {
  switch (key) {
    // template note on row 1: "nếu là T: FG đổi Location: FG -> Doona" (ERP T lines show Doona instead of FG)
    case 'loc': return utxt(r.erp) === 'T' && utxt(r.loc) === 'FG' ? 'Doona' : r.loc;
    case 'date': return dateText(r.date);
    // Unit RM (USD) = Base Total RM / Complete Qty / FX
    case 'unitRMUSD': return num(r.fx) > 0 && num(r.qty) !== 0 ? num(r.baseRM) / num(r.qty) / num(r.fx) : null;
    // allocation based after RM (sales - RM), in USD = max(0, Contribution VND) / FX
    case 'allocUSD': return num(r.fx) > 0 ? Math.max(0, num(r.contrib)) / num(r.fx) : null;
    default: return r[key];
  }
}

/** 04_COST_ALLOCATION sheet: row 1 totals, row 2 headers, one row per PC line. */
export function costAllocationSheet(rows, period) {
  const cols = CA_COLS, n = rows.length, last = FIRST + n - 1;
  const totals = cols.map((c, i) => {
    if (i === 0) return `TỔNG CỘNG · Kỳ ${period}`;
    if (!c.sum || !n) return '';
    const L = colLetter(i + 1);
    return { f: `SUM(${L}${FIRST}:${L}${last})`, r: rows.reduce((a, row) => a + num(caValue(row, c.key)), 0), z: c.z };
  });
  const body = rows.map((row) => cols.map((c) => (c.key ? put(caValue(row, c.key), c.z) : '')));
  return {
    name: '04_COST_ALLOCATION',
    aoa: [totals, cols.map((c) => c.head), ...body],
    header: 2, totals: 1, zebra: true, freezeCols: 7,
    cols: cols.map((c) => c.width), footer: 'Cost Allocation',
  };
}

// ---------------------------------------------------------------- 05_FG_OPENING / 05_FG_CLOSING (template 05_FG_OPENING / 05_FG_CLOSING, A:AA)
// calc: a formula written in the cell (template: net inventory = Total Amount + Provision VND; unit RM = RM Amount / Qty).
// key null: a template column the layer data does not carry yet (left blank, see the module note).
export function fgLayerCols(kind) {
  return [
    { key: 'period', head: 'Period', width: 10 },
    { key: 'srcPeriod', head: 'Source Period', width: 13 },
    { key: 'lid', head: 'Layer ID', width: 30 },
    { key: 'source', head: 'Source', width: 14 },
    { key: 'pc', head: 'PC No.', width: 14 },
    { key: 'date', head: 'Layer Date', width: 13 },
    { key: 'mo', head: 'MO No.', width: 17 },
    { key: 'prod', head: 'Product Code', width: 18 },
    { key: 'name', head: 'Product Name', width: 40 },
    { key: 'loc', head: 'Location', width: 11 },
    { key: 'unit', head: 'Unit', width: 9 },
    { key: 'qty', head: 'Qty', width: 12, z: Z_QTY },
    { key: 'rmPC', head: 'RM cost', width: 16, z: Z_VND, split: true },
    { key: 'rmSO', head: 'RM cost (Stock out)', width: 20, z: Z_VND, split: true },
    { key: 'rm', head: 'RM Amount', width: 16, z: Z_VND },
    { key: 'a622', head: '622 Amount', width: 16, z: Z_VND },
    { key: 'a627', head: '627 Amount', width: 16, z: Z_VND },
    { key: 'tot', head: 'Total Amount', width: 18, z: Z_VND },
    { key: 'unitCost', head: 'Total / Unit', width: 16, z: Z_UNIT },
    { key: 'price', head: 'Sales Price (USD)', width: 16, z: Z_USD },
    { key: null, head: kind === 'closing' ? 'provision in 2512-usd' : 'Provision USD (memo)', width: 20, z: Z_USD },
    { key: 'prov', head: 'Provision VND (memo)', width: 20, z: Z_VND },
    { key: null, calc: 'net', head: 'net inventory', width: 20, z: Z_VND },
    { key: 'cons', head: 'Consignment 157 (memo)', width: 22 },
    { key: 'status', head: 'Status', width: 22 },
    { key: 'msg', head: 'Message', width: 50 },
    { key: null, calc: 'unitRM', head: 'UNIT COST RM ( vnd)', width: 18, z: Z_UNIT },
  ];
}

/** 05_FG_OPENING (kind 'opening') or 05_FG_CLOSING (kind 'closing'): row 1 title, row 2 headers, one row per layer. */
export function fgLayerSheet(rows, kind, period) {
  const cols = fgLayerCols(kind);
  const L = (key) => colLetter(cols.findIndex((c) => c.key === key) + 1);
  const name = kind === 'closing' ? '05_FG_CLOSING' : '05_FG_OPENING';
  const body = rows.map((row, i) => {
    const n = FIRST + i;
    return cols.map((c) => {
      if (c.calc === 'net') return { f: `${L('tot')}${n}+${L('prov')}${n}`, r: num(row.tot) + num(row.prov), z: c.z };
      if (c.calc === 'unitRM') return { f: `IFERROR(${L('rm')}${n}/${L('qty')}${n},0)`, r: num(row.qty) ? num(row.rm) / num(row.qty) : 0, z: c.z };
      if (!c.key) return '';
      // RM split (v1.14.70): only layers whose RM was split (production layers) show it; others stay blank, not 0
      if (c.split && !row.splitOK) return '';
      return put(c.key === 'date' ? dateText(row.date) : row[c.key], c.z);
    });
  });
  return {
    name,
    aoa: [[`SVL – Starry Vietnam · ${name} · Kỳ ${period}`], cols.map((c) => c.head), ...body],
    header: 2, zebra: true, freezeCols: 3,
    cols: cols.map((c) => c.width), footer: kind === 'closing' ? 'FG Closing' : 'FG Opening',
  };
}

// ---------------------------------------------------------------- 06_PROVISION_TRACK / 06_PROVISION_JE (v1.14.70)
// Provision roll-forward per FG layer (credit balance; releases and put-backs shown as amounts) and the journal lines for FAST.
const PROV_COLS = [
  { key: 'lid', head: 'Layer ID', width: 30 },
  { key: 'source', head: 'Source', width: 14 },
  { key: 'pc', head: 'PC No.', width: 14 },
  { key: 'prod', head: 'Product Code', width: 18 },
  { key: 'loc', head: 'Location', width: 11 },
  { key: 'date', head: 'Layer Date', width: 13 },
  { key: 'qtyIn', head: 'Qty In', width: 12, z: Z_QTY },
  { key: 'qtyRem', head: 'Qty Remaining', width: 14, z: Z_QTY },
  { key: 'open', head: 'Provision Opening', width: 18, z: Z_VND, sum: true },
  { key: 'restore', head: 'Put back - sales return', width: 20, z: Z_VND, sum: true },
  { key: 'relSale', head: 'Released - sales (FIFO)', width: 22, z: Z_VND, sum: true },
  { key: 'relCons', head: 'Released - FG consumption', width: 22, z: Z_VND, sum: true },
  { key: 'relRw', head: 'Moved to rework (not posted)', width: 24, z: Z_VND, sum: true },
  { key: 'closePre', head: 'Provision before NRV test', width: 22, z: Z_VND, sum: true },
  { key: 'nrvProp', head: 'NRV proposed (+ add / − release)', width: 24, z: Z_VND, sum: true },
  { key: 'nrvAdj', head: 'NRV approved (+ add / − release)', width: 24, z: Z_VND, sum: true },
  { key: 'close', head: 'Provision Closing', width: 18, z: Z_VND, sum: true },
  { key: 'nrvUnit', head: 'NRV / unit', width: 14, z: Z_UNIT },
  { key: 'check', head: 'Check (should be 0)', width: 16, z: Z_VND, calc: true },
];

/** 06_PROVISION_TRACK: row 1 title with the check result, row 2 headers, one row per layer that moved, totals last. */
export function provisionTrackSheet(track, period) {
  const cols = PROV_COLS;
  const L = (key) => colLetter(cols.findIndex((c) => c.key === key) + 1);
  const n0 = FIRST, n = track.rows.length, last = FIRST + n - 1, tot = last + 1;
  const body = track.rows.map((row, i) => {
    const r = FIRST + i;
    return cols.map((c) => {
      if (c.calc) return { f: `${L('open')}${r}+${L('restore')}${r}-${L('relSale')}${r}-${L('relCons')}${r}-${L('relRw')}${r}-${L('closePre')}${r}`, r: num(row.open) + num(row.restore) - num(row.relSale) - num(row.relCons) - num(row.relRw) - num(row.closePre), z: c.z };
      if (c.key === 'date') return put(dateText(row.date), c.z);
      return put(row[c.key], c.z);
    });
  });
  const totals = cols.map((c, i) => {
    if (i === 0) return 'TỔNG CỘNG';
    if (!c.sum && !c.calc) return '';
    const Lc = colLetter(i + 1);
    if (!n) return '';
    return { f: `SUM(${Lc}${n0}:${Lc}${last})`, r: track.rows.reduce((a, row) => a + (c.calc ? 0 : num(row[c.key])), 0), z: c.z };
  });
  return {
    name: '06_PROVISION_TRACK',
    aoa: [[`SVL – Starry Vietnam · 06_PROVISION_TRACK · Kỳ ${period} · Kiểm tra dự phòng: ${track.ok ? 'PASS' : 'CHECK'}`], cols.map((c) => c.head), ...body, totals],
    header: 2, totals: tot > 0 ? tot : 0, zebra: true, freezeCols: 2,
    cols: cols.map((c) => c.width), footer: 'Provision Track',
  };
}

/** 06_PROVISION_JE: the entries to post in FAST (TK 2294 / 632), the rework item not posted, and the 2294 movement for the tie. */
export function provisionJournalSheet(journal, period) {
  const cols = [
    { head: 'Mã', width: 14 }, { head: 'Diễn giải', width: 60 }, { head: 'Nợ (TK)', width: 12 }, { head: 'Có (TK)', width: 12 },
    { head: 'Số tiền (VND)', width: 18, z: Z_VND }, { head: 'Ghi chú', width: 40 },
  ];
  const rows = journal.lines.map((l) => [l.code, l.desc, l.dr, l.cr, put(l.amount, Z_VND), l.amount ? 'Ghi sổ trên FAST' : 'Không phát sinh']);
  rows.push([journal.pending.code, journal.pending.desc, '', '', put(journal.pending.amount, Z_VND), 'Không ghi sổ – chờ quyết định kế toán']);
  rows.push(['TK 2294', 'Phát sinh Có − Nợ TK 2294 trong kỳ (đối chiếu FAST)', '', '', put(journal.acc2294, Z_VND), 'Khớp dòng 2294 của tab Đối chiếu FAST']);
  return {
    name: '06_PROVISION_JE',
    aoa: [[`SVL – Starry Vietnam · 06_PROVISION_JE · Kỳ ${period} · Bút toán dự phòng giảm giá thành phẩm`], cols.map((c) => c.head), ...rows],
    header: 2, zebra: true, freezeCols: 0,
    cols: cols.map((c) => c.width), footer: 'Provision Journal',
  };
}
