// Renders the Dashboard view (v1.14.80) from a synthetic STEP 5 result, without a browser:
// KPI cards, monthly trend, plan gauge, filters, previous-period comparison, rankings, checks and the empty state.
import * as DB from '../src/views/dashboard.js';

const serial = (y, m, d = 15) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
const RES = {
  period: '2026-08',
  sales: [
    { acc: '511', inv: 'I1', cust: 'A', prod: 'P1', name: 'Product one', vnd: 100, tot: 60, fq: 1, fin: 'FIFO COGS', status: 'PASS' },
    { acc: '511', inv: 'I2', cust: 'B', prod: 'P2', name: 'Product two', vnd: 200, tot: 120, fq: 2, fin: 'FIFO COGS', status: 'PASS' },
    { acc: '5212', inv: 'R1', cust: '', prod: 'P1', vnd: -40, tot: -24, fq: -1, fin: 'RETURN', origInv: 'I1', status: 'PASS' },
    { acc: '5213', inv: 'CN2', cust: 'B', prod: '', vnd: -10, tot: 0, fq: 0, fin: '', origInv: 'I2', status: 'PASS' },
    { acc: '511', inv: 'I3', cust: '', prod: 'P3', name: 'Product three', vnd: 50, tot: 30, fq: 1, fin: 'FIFO COGS', status: 'REVIEW' },
  ],
  totals: { cogsA: 191, consA: 5, consQ: 1 },
};
// previous period (2026-07) on this device: net 250, cogs 150
const PREV = { period: '2026-07', sales: [{ acc: '511', inv: 'J1', cust: 'A', prod: 'P1', vnd: 250, tot: 150, fq: 2, fin: 'FIFO COGS', status: 'PASS' }], totals: { cogsA: 150, consA: 0, consQ: 0 } };
const salesDB = { rows: [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((m) => ({ invDate: serial(2026, m), customer: 'A', product: 'P1', qty: 1, amtVND: 100 + m * 20, tranType: 'NORMAL SALE' })),
  { invDate: serial(2025, 8), customer: 'A', product: 'P1', qty: 1, amtVND: 200, tranType: 'NORMAL SALE' },
] };

const handlers = {}; const boxes = {};
const node = (sel) => ({ sel, value: '', addEventListener: (ev, fn) => { handlers[sel] = fn; } });
const el = {
  isConnected: true, innerHTML: '',
  querySelector: (s) => { if (s === '#dash-tbl' || s === '#dash-ptbl') return (boxes[s] = boxes[s] || { mounted: null }); if (s === '#dx-plan-rev' || s === '#dx-plan-gp') return (boxes[s] = boxes[s] || node(s)); return node(s); },
};
const S = { period: '2026-08', allPeriods: ['2026-08', '2026-07'], d: { step5: RES, salesDB, returnsDB: null, dashPlan: null } };
const saved = [];
const A = {
  S,
  esc: (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  fmtNum: (n, d = 0) => Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }),
  fmtTs: (x) => String(x),
  pill: (s) => `<span class="pill">${s}</span>`,
  emptyNote: (m) => `<div class="empty">${m}</div>`,
  mountTable: (b, o) => { b.mounted = o; },
  exportTable: () => () => {},
  derived: () => ({ d5: { res: S.d.step5, fresh: 'CURRENT' } }),
  exportHachToan: () => {},
  periods: () => S.allPeriods,
  loadStep5: async (p) => (p === '2026-07' ? PREV : null),
  loadPeriodData: async () => ({ step5: null }),
  guardEdit: () => true, closedGuard: () => false,
  parseNum: (v) => Number(String(v).replace(/\./g, '').replace(',', '.')),
  toast: () => {}, audit: () => {}, markDirty: (...b) => saved.push(...b), who: () => 'test@x',
};

let n = 0, bad = 0;
const ok = (label, cond, info = '') => { n++; if (!cond) bad++; console.log(`${cond ? '✓' : '✗'} ${label}${!cond && info ? ' — ' + info : ''}`); };
const tick = () => new Promise((r) => setTimeout(r, 20));

DB.install(A);
DB.view(el);
let html = el.innerHTML;
ok('header, filter bar and export button', html.includes('Dashboard điều hành') && html.includes('id="dx-cust"') && html.includes('id="dx-prod"') && html.includes('id="dash-export"'));
ok('six KPI cards', (html.match(/class="dx-kpi /g) || []).length === 6);
ok('monthly trend chart with the period month highlighted', html.includes('dx-trend') && html.includes('class="dx-ax cur">T8<'));
ok('last year line drawn from the Sales Database', html.includes('class="dx-last"'));
ok('plan gauge asks for a plan when none is set', html.includes('dx-gauge') && html.includes('Đặt kế hoạch kỳ'));
ok('GP % chart, top products, top customers, revenue mix, lowest GP %', html.includes('dash-svg') && html.includes('dx-bars') && html.includes('dx-t') && html.includes('dx-donut') && html.includes('Sản phẩm GP % thấp nhất'));
ok('reconciliation table has 4 checks', (html.match(/<tbody>[\s\S]*?<\/tbody>/g) || []).some((t) => (t.match(/<tr>/g) || []).length === 4 && t.includes('JE07')));
ok('customer table: 3 customers + consumption', boxes['#dash-tbl'].mounted.rows.length === 4 && boxes['#dash-tbl'].mounted.rows[3].cust === 'Tiêu dùng nội bộ (632 / 155)');
ok('product table: P2, P1, P3 by net revenue (credit note without product kept apart)', boxes['#dash-ptbl'].mounted.rows.map((r) => r.prod).join('|') === 'P2|P1|P3|(Không mã SP)', boxes['#dash-ptbl'].mounted.rows.map((r) => r.prod).join('|'));
ok('no NaN / undefined in output', !/NaN|undefined/.test(html));

// previous period loads asynchronously → GP comparison appears
await tick();
html = el.innerHTML;
ok('previous-period STEP 5 gives the GP comparison', !html.includes('chưa có STEP 5 kỳ trước'));
ok('revenue growth vs 2026-07: 300 vs 250 = +20,0%', html.includes('▲ 20,0%'));
ok('GP bars drawn for the months with STEP 5 (T7, T8)', (html.match(/class="dx-gp-bar/g) || []).length === 2);
ok('same month last year: 300 vs 200 = 50,0%', html.includes('50,0%'));

// filter by customer A: net 60 (100 − 40), cogs 36, no consumption row
handlers['#dx-cust']({ target: { value: 'A' } });
html = el.innerHTML;
ok('customer filter shows the filtered notice', html.includes('Đang lọc') && html.includes('<b>A</b>'));
ok('filtered customer table has one row and no consumption', boxes['#dash-tbl'].mounted.rows.length === 1 && boxes['#dash-tbl'].mounted.rows[0].net === 60);
ok('filtered product table: P1 only (return follows the original invoice)', boxes['#dash-ptbl'].mounted.rows.map((r) => r.prod).join('|') === 'P1');
ok('plan is hidden while a filter is on', html.includes('Bỏ bộ lọc để xem mức đạt kế hoạch'));
handlers['#dx-reset']();
ok('reset clears the filter', !el.innerHTML.includes('Đang lọc'));

// save a plan: revenue 250, GP % 40 → 300 / 250 = 120,0 %
boxes['#dx-plan-rev'] = { ...node('#dx-plan-rev'), value: '250' }; boxes['#dx-plan-gp'] = { ...node('#dx-plan-gp'), value: '40' };
handlers['#dx-plan-save']();
html = el.innerHTML;
ok('plan saved as a period blob', S.d.dashPlan && S.d.dashPlan.revenue === 250 && Math.abs(S.d.dashPlan.gpPct - 0.4) < 1e-9 && saved.includes('dashPlan'));
ok('gauge shows 120,0% of plan', html.includes('120,0%') && html.includes('Sửa kế hoạch kỳ'));

// empty state: no STEP 5 result
const el2 = { isConnected: true, innerHTML: '', querySelector: () => null };
DB.install({ ...A, derived: () => ({ d5: null }) });
DB.view(el2);
ok('empty state without STEP 5', el2.innerHTML.includes('Chưa có kết quả FIFO COGS') && !el2.innerHTML.includes('dx-kpi'));

console.log(`\n${n - bad}/${n} dashboard render checks passed`);
process.exit(bad ? 1 : 0);
