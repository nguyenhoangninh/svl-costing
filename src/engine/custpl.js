// Doanh thu · giá vốn · lãi gộp theo khách hàng (v1.14.79).
// Pure functions over the STEP 5 result (res.sales, res.totals): no UI, no I/O. Used by the Dashboard, the bút toán
// (journal.js) and the export "Bảng tổng hợp hạch toán".
//   revenue  : 511 gross on the sales line's customer; 5212 returns and 5213 credit notes follow the customer of the
//              original invoice (matchedOrigInv / origInv) when that invoice is in this period, else the line's own customer
//   COGS     : FIFO cost of the sales lines, net of the returned cost (the return reverses the cost of its invoice)
//   consumption (tiêu dùng nội bộ, 632 / 155): no customer – its own row
//   lãi gộp  = doanh thu thuần − giá vốn; chưa trừ dự phòng 2294 (màn 5P)
import { num, ttxt, utxt, recognitionDate, serialToISO } from './util.js';
import { splitBooks, bookOf } from './revenue.js';

export const CONS_LABEL = 'Tiêu dùng nội bộ (632 / 155)';
export const NO_CUST = '(Không rõ khách hàng)';
export const TOTAL_LABEL = 'Tổng cộng';
const TOL = 1;

const share = (v, base) => (Math.abs(base) > TOL ? v / base : null);

/**
 * Customer of each STEP 5 line: a sales line (511) keeps its own customer; a return (5212) or credit note (5213)
 * follows the customer of its original invoice when that invoice is in this period, else its own customer.
 */
export function custResolver(res) {
  const invCust = new Map();
  for (const s of (res && res.sales) || []) {
    const inv = ttxt(s.inv), c = ttxt(s.cust);
    if (s.acc === '511' && inv && c && !invCust.has(inv)) invCust.set(inv, c);
  }
  return (s) => {
    const own = ttxt(s.cust);
    if (s.acc === '511') return own || NO_CUST;
    const orig = invCust.get(ttxt(s.matchedOrigInv)) || invCust.get(ttxt(s.origInv));
    return orig || own || NO_CUST;
  };
}

/** Revenue, COGS and gross profit of each customer of the period. Returns null before STEP 5 has run. */
export function customerPL(res) {
  if (!res || !Array.isArray(res.sales) || !res.totals) return null;
  let noCustLines = 0;
  const custOf = custResolver(res);
  const byCust = new Map();
  for (const s of res.sales) {
    const c = custOf(s);
    if (!byCust.has(c)) byCust.set(c, { cust: c, qty: 0, gross: 0, ret: 0, disc: 0, cogs: 0, review: 0 });
    const x = byCust.get(c);
    if (s.acc === '511') x.gross += num(s.vnd);
    else if (s.acc === '5212') x.ret += num(s.vnd);
    else if (s.acc === '5213') x.disc += num(s.vnd);
    if (s.fin === 'FIFO COGS' || s.fin === 'RETURN') { x.cogs += num(s.tot); x.qty += num(s.fq); }
    if (s.status === 'REVIEW') x.review++;
    if (c === NO_CUST && (Math.abs(num(s.vnd)) > TOL || Math.abs(num(s.tot)) > TOL)) noCustLines++;
  }
  const finish = (x) => {
    const net = x.gross + x.ret + x.disc;
    return { ...x, net, gp: net - x.cogs, gpPct: share(net - x.cogs, net) };
  };
  const rows = [...byCust.values()].map(finish)
    .sort((a, b) => b.net - a.net || a.cust.localeCompare(b.cust, 'vi'));
  const consA = num(res.totals.consA);
  const cons = { ...finish({ cust: CONS_LABEL, qty: num(res.totals.consQ), gross: 0, ret: 0, disc: 0, cogs: consA, review: 0 }), isCons: true };
  const sumOf = (f) => rows.reduce((a, r) => a + num(r[f]), 0);
  const sales = { qty: sumOf('qty'), gross: sumOf('gross'), ret: sumOf('ret'), disc: sumOf('disc'), net: sumOf('net'), cogs: sumOf('cogs'), review: sumOf('review') };
  const total = finish({ cust: TOTAL_LABEL, qty: sales.qty, gross: sales.gross, ret: sales.ret, disc: sales.disc, cogs: sales.cogs + consA, review: sales.review });
  const cogsA = num(res.totals.cogsA);
  const checks = [
    { id: 'cogs', label: 'Giá vốn theo khách hàng khớp TK 632 (JE07 + JE07B)', expected: cogsA, actual: total.cogs, status: Math.abs(total.cogs - cogsA) <= TOL ? 'PASS' : 'CHECK' },
    { id: 'nocust', label: 'Dòng bán không rõ khách hàng', expected: 0, actual: noCustLines, status: noCustLines ? 'REVIEW' : 'PASS' },
    { id: 'review', label: 'Dòng bán còn REVIEW (chưa xử lý giá vốn)', expected: 0, actual: total.review, status: total.review ? 'REVIEW' : 'PASS' },
  ];
  return { rows, cons, total, checks, sales, noCustLines };
}

/**
 * Journal lines by customer: revenue lines (on FAST, for reference) and the COGS line per customer (JE07, Nợ 632 / Có 155).
 * Amounts are positive; a return or credit note is shown as a debit to its revenue account.
 */
export function customerJournal(pl) {
  const out = [];
  if (!pl) return out;
  for (const r of pl.rows) {
    if (Math.abs(r.gross) > TOL) out.push({ je: 'DT', dr: '131', cr: '511', desc: 'Doanh thu bán hàng (đã ghi trên FAST)', cust: r.cust, amount: r.gross });
    if (Math.abs(r.ret) > TOL) out.push({ je: 'TL', dr: '5212', cr: '131', desc: 'Hàng bán bị trả lại (đã ghi trên FAST)', cust: r.cust, amount: -r.ret });
    if (Math.abs(r.disc) > TOL) out.push({ je: 'GG', dr: '5213', cr: '131', desc: 'Giảm giá / credit note (đã ghi trên FAST)', cust: r.cust, amount: -r.disc });
    if (Math.abs(r.cogs) > TOL) out.push({ je: 'JE07', dr: '632', cr: '155', desc: 'Giá vốn hàng bán theo FIFO (đã trừ hàng trả lại)', cust: r.cust, amount: r.cogs });
  }
  return out;
}

export const PL_HEADERS = ['Khách hàng', 'SL xuất (FIFO)', 'Doanh thu gộp 511', 'Hàng trả lại 5212', 'Giảm giá 5213', 'Doanh thu thuần', 'Giá vốn 632', 'Lãi gộp', 'GP %', 'Tỷ trọng DT %'];
/** Rows of the customer summary sheet: customers (by net revenue), the consumption row, then the total. */
export function plSheetRows(pl) {
  if (!pl) return [];
  const base = pl.total.net;
  const line = (x, withShare = true) => [x.cust, x.qty, x.gross, x.ret, x.disc, x.net, x.cogs, x.gp, x.gpPct, withShare ? share(x.net, base) : null];
  return [...pl.rows.map((r) => line(r)), line(pl.cons, false), line(pl.total, false)];
}

// ---------------------------------------------------------------------------------------------------------------------
// v1.14.80: dashboard filters, products, monthly trend
const isCosted = (s) => s.fin === 'FIFO COGS' || s.fin === 'RETURN';

/**
 * The STEP 5 result limited to one customer and / or one product (dashboard filters). Consumption (tiêu dùng nội bộ)
 * belongs to no customer or sale, so it is left out of a filtered view. Without a filter the result is returned as it is.
 */
export function filterRes(res, f = {}) {
  const cust = ttxt(f.cust), prod = utxt(f.prod);
  if (!res || !Array.isArray(res.sales) || (!cust && !prod)) return res;
  const custOf = custResolver(res);
  const sales = res.sales.filter((s) => (!cust || custOf(s) === cust) && (!prod || utxt(s.prod) === prod));
  const cogsA = sales.filter(isCosted).reduce((a, s) => a + num(s.tot), 0);
  return { ...res, sales, totals: { ...res.totals, cogsA, consA: 0, consQ: 0 }, filtered: true };
}

/** Revenue, COGS and gross profit by product (same rules as by customer); lines without a product are "(Không mã SP)". */
export const NO_PROD = '(Không mã SP)';
export function productPL(res) {
  if (!res || !Array.isArray(res.sales)) return null;
  const by = new Map();
  for (const s of res.sales) {
    const k = utxt(s.prod) || NO_PROD;
    if (!by.has(k)) by.set(k, { prod: k, name: '', qty: 0, gross: 0, ret: 0, disc: 0, cogs: 0 });
    const x = by.get(k);
    if (!x.name && ttxt(s.name)) x.name = ttxt(s.name);
    if (s.acc === '511') x.gross += num(s.vnd);
    else if (s.acc === '5212') x.ret += num(s.vnd);
    else if (s.acc === '5213') x.disc += num(s.vnd);
    if (isCosted(s)) { x.cogs += num(s.tot); x.qty += num(s.fq); }
  }
  const rows = [...by.values()].map((x) => { const net = x.gross + x.ret + x.disc; return { ...x, net, gp: net - x.cogs, gpPct: share(net - x.cogs, net) }; })
    .filter((x) => Math.abs(x.net) > TOL || Math.abs(x.cogs) > TOL)
    .sort((a, b) => b.net - a.net || a.prod.localeCompare(b.prod));
  return { rows };
}

export const PROD_HEADERS = ['Mã sản phẩm', 'Tên sản phẩm', 'SL xuất (FIFO)', 'Doanh thu gộp 511', 'Hàng trả lại 5212', 'Giảm giá 5213', 'Doanh thu thuần', 'Giá vốn 632', 'Lãi gộp', 'GP %'];
export const prodSheetRows = (pp) => (pp ? pp.rows.map((x) => [x.prod, x.name, x.qty, x.gross, x.ret, x.disc, x.net, x.cogs, x.gp, x.gpPct]) : []);

/**
 * Revenue by month (YYYY-MM) from the Sales and Returns Databases, for the trend chart. The date is the recognition date
 * (B/L date, else invoice date) as in STEP 5. Duplicate decisions of STEP 4.1 are not applied here (the period's own
 * figures come from STEP 5). Optional filter { cust, prod } on the row's own customer / product.
 */
export function monthlyRevenue(salesDB, returnsDB, f = {}) {
  const cust = ttxt(f.cust), prod = utxt(f.prod);
  const { sales, returns } = splitBooks(salesDB, returnsDB);
  const by = new Map();
  for (const r of [...sales, ...returns]) {
    if (cust && ttxt(r.customer) !== cust) continue;
    if (prod && utxt(r.product) !== prod) continue;
    const d = recognitionDate(r); if (d === null) continue;
    const ym = serialToISO(d).slice(0, 7);
    if (!by.has(ym)) by.set(ym, { ym, gross: 0, ret: 0, disc: 0, net: 0, qty: 0 });
    const x = by.get(ym), v = num(r.amtVND), b = bookOf(r);
    if (b === '511') { x.gross += v; x.qty += num(r.qty); } else if (b === '5212') x.ret += v; else x.disc += v;
    x.net += v;
  }
  return by;
}

/** Previous month of a YYYY-MM period. */
export const prevMonth = (p) => { const [y, m] = p.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
/** Growth of a against b (null when b is about zero). */
export const growth = (a, b) => (a === null || b === null || a === undefined || b === undefined || Math.abs(b) <= TOL ? null : (a - b) / Math.abs(b));
