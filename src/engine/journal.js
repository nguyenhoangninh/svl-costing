// Bút toán đề xuất của kỳ (v1.14.79): the STEP 3 / 4 / 5 journal lines, with the COGS (JE07) split by customer.
// Used by the control centre table and the export "Bảng tổng hợp hạch toán" so both show the same lines.
import { wipJournalAmounts } from './step3.js';
import { customerPL, customerJournal } from './custpl.js';
import { num } from './util.js';

const TOL = 1;

/**
 * v1.14.91 (audit ACC-01): amounts rounded to whole VND so that the lines add up to the rounded total exactly.
 * Each line is rounded; the difference left (a few VND at most) goes to the line with the largest absolute amount.
 */
export function roundToTotal(values, total) {
  const r = values.map((v) => Math.round(num(v)));
  if (!r.length) return r;
  const diff = Math.round(num(total)) - r.reduce((a, b) => a + b, 0);
  if (diff) {
    let k = 0; for (let i = 1; i < values.length; i++) if (Math.abs(num(values[i])) > Math.abs(num(values[k]))) k = i;
    r[k] += diff;
  }
  return r;
}

/** The period's journal lines before the customer split. JE07 is marked split: it is replaced by its customer lines. */
export function journalLines({ s3, s2, s4, fl, r5 }) {
  if (!s3) return [];
  const S3 = s3.summary;
  // v1.14.28: RM consumption (tiêu hao) is posted straight to 632, not through the WIP / PC lots.
  // v1.14.77: the amounts follow what STEP 3 put in WIP (consumption already out of its Stock Out), see wipJournalAmounts
  const J = wipJournalAmounts(s3, s2);
  const je = [
    { je: 'JE01', dr: '154', cr: '152', desc: 'Xuất NVL vào WIP – MI', amount: J.mi },
    { je: 'JE02', dr: '154', cr: '152', desc: 'Xuất NVL vào WIP – Stock Out (không gồm tiêu hao)', amount: J.so },
  ];
  if (J.cons) je.push({ je: 'JE02B', dr: '632', cr: '152', desc: 'Tiêu hao NVL – xuất thẳng vào 632', amount: J.cons });
  je.push({ je: 'JE05', dr: '152', cr: '154', desc: 'Nhập lại NVL từ WIP – MR', amount: S3.mrAmt });
  if (s4 && !s4.blocked) je.push(
    { je: 'JE03', dr: '154', cr: '622', desc: 'Kết chuyển nhân công trực tiếp', amount: s4.alloc622 },
    { je: 'JE04', dr: '154', cr: '627', desc: 'Kết chuyển chi phí SX chung', amount: s4.alloc627 });
  if (fl) je.push({ je: 'JE06', dr: '155', cr: '154', desc: 'Nhập kho thành phẩm theo giá thành STEP 4', amount: fl.totals.totalCost });
  // v1.14.28: JE07 = sales COGS; FG consumption (tiêu dùng nội bộ) is a separate line, booked before sales in STEP 5.2
  if (r5) je.push({ je: 'JE07', dr: '632', cr: '155', desc: 'Giá vốn hàng bán theo FIFO', amount: r5.totals.cogsA - (r5.totals.consA || 0), split: true });
  if (r5 && r5.totals.consA) je.push({ je: 'JE07B', dr: '632', cr: '155', desc: 'Tiêu dùng nội bộ FG theo FIFO (tiêu hao)', amount: r5.totals.consA });
  if (r5 && r5.rework) je.push({ je: 'JE08', dr: '154', cr: '155', desc: 'FG xuất đi rework (giá trị FIFO)', amount: r5.rework.fifoCost });
  return je;
}

/**
 * The lines to show and to export: JE07 is replaced by one line per customer (their sum is JE07), and the revenue
 * lines by customer follow at the end for reference (they are already booked on FAST).
 * Each line: { je, dr, cr, cust ('' when not customer-specific), desc, amount }.
 */
export function journalWithCustomers(ctx) {
  const lines = journalLines(ctx);
  const pl = ctx.r5 ? customerPL(ctx.r5) : null;
  const cj = customerJournal(pl);
  const out = [];
  for (const l of lines) {
    if (l.split) {
      // v1.14.91: whole VND; the customer lines add up to JE07 rounded, to the đồng
      const cl = cj.filter((x) => x.je === 'JE07');
      const amt = roundToTotal(cl.map((c) => c.amount), l.amount);
      cl.forEach((c, i) => { if (amt[i]) out.push({ ...c, cust: c.cust, amount: amt[i] }); });
      continue;
    }
    out.push({ ...l, cust: '', amount: Math.round(num(l.amount)) });
  }
  for (const c of cj.filter((x) => x.je !== 'JE07')) out.push({ ...c, amount: Math.round(num(c.amount)) });
  return out;
}

/** Check: the customer lines of JE07 add up to JE07 (sales COGS, net of returns). */
export function journalCheck(ctx) {
  const pl = ctx.r5 ? customerPL(ctx.r5) : null;
  const je07 = ctx.r5 ? num(ctx.r5.totals.cogsA) - num(ctx.r5.totals.consA) : 0;
  const sum = pl ? pl.rows.reduce((a, r) => a + num(r.cogs), 0) : 0;
  return { expected: je07, actual: sum, status: Math.abs(sum - je07) <= TOL ? 'PASS' : 'CHECK' };
}

/** v1.14.91: after rounding, the JE07 customer lines equal JE07 rounded exactly (no tolerance). */
export function journalRoundCheck(ctx) {
  const je07 = journalLines(ctx).find((l) => l.split);
  if (!je07) return null;
  const expected = Math.round(num(je07.amount));
  const actual = journalWithCustomers(ctx).filter((l) => l.je === 'JE07').reduce((a, l) => a + l.amount, 0);
  return { expected, actual, status: actual === expected ? 'PASS' : 'CHECK' };
}
