// Bút toán đề xuất của kỳ (v1.14.79): the STEP 3 / 4 / 5 journal lines, with the COGS (JE07) split by customer.
// Used by the control centre table and the export "Bảng tổng hợp hạch toán" so both show the same lines.
import { wipJournalAmounts } from './step3.js';
import { customerPL, customerJournal } from './custpl.js';
import { num } from './util.js';

const TOL = 1;

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
      for (const c of cj.filter((x) => x.je === 'JE07')) out.push({ ...c, cust: c.cust });
      continue;
    }
    out.push({ ...l, cust: '' });
  }
  for (const c of cj.filter((x) => x.je !== 'JE07')) out.push({ ...c });
  return out;
}

/** Check: the customer lines of JE07 add up to JE07 (sales COGS, net of returns). */
export function journalCheck(ctx) {
  const pl = ctx.r5 ? customerPL(ctx.r5) : null;
  const je07 = ctx.r5 ? num(ctx.r5.totals.cogsA) - num(ctx.r5.totals.consA) : 0;
  const sum = pl ? pl.rows.reduce((a, r) => a + num(r.cogs), 0) : 0;
  return { expected: je07, actual: sum, status: Math.abs(sum - je07) <= TOL ? 'PASS' : 'CHECK' };
}
