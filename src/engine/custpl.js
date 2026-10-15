// Doanh thu · giá vốn · lãi gộp theo khách hàng (v1.14.79).
// Pure functions over the STEP 5 result (res.sales, res.totals): no UI, no I/O. Used by the Dashboard, the bút toán
// (journal.js) and the export "Bảng tổng hợp hạch toán".
//   revenue  : 511 gross on the sales line's customer; 5212 returns and 5213 credit notes follow the customer of the
//              original invoice (matchedOrigInv / origInv) when that invoice is in this period, else the line's own customer
//   COGS     : FIFO cost of the sales lines, net of the returned cost (the return reverses the cost of its invoice)
//   consumption (tiêu dùng nội bộ, 632 / 155): no customer – its own row
//   lãi gộp  = doanh thu thuần − giá vốn; chưa trừ dự phòng 2294 (màn 5P)
import { num, ttxt } from './util.js';

export const CONS_LABEL = 'Tiêu dùng nội bộ (632 / 155)';
export const NO_CUST = '(Không rõ khách hàng)';
export const TOTAL_LABEL = 'Tổng cộng';
const TOL = 1;

const share = (v, base) => (Math.abs(base) > TOL ? v / base : null);

/** Revenue, COGS and gross profit of each customer of the period. Returns null before STEP 5 has run. */
export function customerPL(res) {
  if (!res || !Array.isArray(res.sales) || !res.totals) return null;
  // invoice number → customer, from the sales lines (511) of this period
  const invCust = new Map();
  for (const s of res.sales) {
    const inv = ttxt(s.inv), c = ttxt(s.cust);
    if (s.acc === '511' && inv && c && !invCust.has(inv)) invCust.set(inv, c);
  }
  let noCustLines = 0;
  const custOf = (s) => {
    const own = ttxt(s.cust);
    if (s.acc === '511') return own || NO_CUST;
    const orig = invCust.get(ttxt(s.matchedOrigInv)) || invCust.get(ttxt(s.origInv));
    return orig || own || NO_CUST;
  };
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
