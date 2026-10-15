// Renders the Dashboard view (v1.14.79) from a synthetic STEP 5 result, without a browser: KPIs, charts, check table, empty state.
import * as DB from '../src/views/dashboard.js';
const RES = {
  sales: [
    { acc: '511', inv: 'I1', cust: 'A', vnd: 100, tot: 60, fq: 1, fin: 'FIFO COGS', status: 'PASS' },
    { acc: '511', inv: 'I2', cust: 'B', vnd: 200, tot: 120, fq: 2, fin: 'FIFO COGS', status: 'PASS' },
    { acc: '5212', inv: 'R1', cust: '', vnd: -40, tot: -24, fq: -1, fin: 'RETURN', origInv: 'I1', status: 'PASS' },
    { acc: '5213', inv: 'CN2', cust: 'B', vnd: -10, tot: 0, fq: 0, fin: '', origInv: 'I2', status: 'PASS' },
    { acc: '511', inv: 'I3', cust: '', vnd: 50, tot: 30, fq: 1, fin: 'FIFO COGS', status: 'REVIEW' },
  ],
  totals: { cogsA: 191, consA: 5, consQ: 1 },
};
const box = { mounted: null };
const el = { innerHTML: '', querySelector: (s) => (s === '#dash-tbl' ? box : null) };
const A = {
  S: { period: '2026-08' },
  esc: (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  fmtNum: (n, d = 0) => Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pill: (s) => `<span class="pill">${s}</span>`,
  kpi: (label, val, strong, opts = {}) => `<div class="kpi t-${opts.tone || 'base'}"><span>${label}</span><b>${val}</b><small>${opts.sub || 'VND'}</small></div>`,
  emptyNote: (m) => `<div class="empty">${m}</div>`,
  mountTable: (b, o) => { b.mounted = o; },
  exportTable: () => () => {},
  derived: () => ({ d5: { res: RES, fresh: 'CURRENT' } }),
  exportHachToan: () => {},
};
DB.install(A);
DB.view(el);
const html = el.innerHTML;
const checks = [
  ['header and export button', html.includes('Dashboard · Doanh thu, giá vốn, lãi gộp') && html.includes('id="dash-export"')],
  ['two charts rendered', (html.match(/class="dash-svg"/g) || []).length === 2],
  ['GP % overall KPI present', html.includes('GP % tổng hợp')],
  ['reconciliation table has 4 checks (3 customer checks + JE07)', (html.match(/<tbody>[\s\S]*?<\/tbody>/g) || []).some((t) => (t.match(/<tr>/g) || []).length === 4)],
  ['no NaN / undefined in output', !/NaN|undefined/.test(html)],
  ['table mounted with 4 rows (3 customers + consumption)', !!box.mounted && box.mounted.rows.length === 4],
  ['customer order by net: B, A, unknown', !!box.mounted && box.mounted.rows.slice(0, 3).map((r) => r.cust).join('|') === 'B|A|(Không rõ khách hàng)'],
  ['consumption row is last and has no net', !!box.mounted && box.mounted.rows[3].cust === 'Tiêu dùng nội bộ (632 / 155)' && box.mounted.rows[3].net === 0],
  ['totals: net 300 (B 190 + A 60 + unknown 50)', !!box.mounted && box.mounted.rows.slice(0, 3).reduce((a, r) => a + r.net, 0) === 300],
];
let bad = 0;
for (const [label, cond] of checks) { if (!cond) bad++; console.log(`${cond ? '✓' : '✗'} ${label}`); }
// empty state: no STEP 5 result
const el2 = { innerHTML: '', querySelector: () => null };
DB.install({ ...A, derived: () => ({ d5: null }) });
DB.view(el2);
const emptyOk = el2.innerHTML.includes('Chưa có kết quả FIFO COGS') && !el2.innerHTML.includes('dash-svg');
console.log(`${emptyOk ? '✓' : '✗'} empty state without STEP 5`); if (!emptyOk) bad++;
console.log(`\n${checks.length + 1 - bad}/${checks.length + 1} dashboard render checks passed`);
process.exit(bad ? 1 : 0);
