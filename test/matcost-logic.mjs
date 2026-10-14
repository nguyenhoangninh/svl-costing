// v1.14.43 — STEP 1 unit cost of material issues (MI-M): unit price, abnormal lines, zero-cost lines.
// Synthetic data only (no company data).
import { materialIssueCosts, MATCOST_DEV, MATCOST_MIN_COST } from '../src/engine/matcost.js';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++; };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const P = '2026-08';
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;

const HDR = ['MI No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Lot Number', 'Product Type (Item)', 'Item Type (Item)', 'Unit', 'Current Issue Qty', 'Location', 'Total Cost', 'RM COST $'];
const line = (code, name, unit, qty, cost, date = serial(2026, 8, 5), mi = 'MI-TEST') => [mi, 'MI_ASSY', date, 'Completed', 'MO-TEST', 'MO-TEST-001', 'SP-TEST', 'Synthetic product', 1, code, name, 'LOT', null, 'OPM', unit, qty, 'RM', cost, 0];

const rows = [
  // M1: 10 @ 100k, 10 @ 100k, 10 @ 150k, 5 @ 400k → BQ = 5.5M / 35 ≈ 157.1k; reference = median unit price 125k;
  // only the 400k line deviates > 30 % and costs ≥ 1M → flagged (the 100k lines are not flagged)
  line('M1', 'Synthetic material one', 'PCS', 10, 1000000),
  line('M1', 'Synthetic material one', 'PCS', 10, 1000000),
  line('M1', 'Synthetic material one', 'PCS', 10, 1500000),
  line('M1', 'Synthetic material one', 'PCS', 5, 2000000),
  // M2: small line far from BQ (cost < 1M, not flagged) and a zero-cost issue line (flag THIẾU COST)
  line('M2', 'Synthetic material two', 'G', 3, 500000),
  line('M2', 'Synthetic material two', 'G', 3, 3000),
  line('M2', 'Synthetic material two', 'G', 2, 0),
  // M3: normal material, plus a negative (return) line that must stay out of the unit price
  line('M3', 'Synthetic material three', 'PCS', 100, 1000000),
  line('M3', 'Synthetic material three', 'PCS', 100, 1020000),
  line('M3', 'Synthetic material three', 'PCS', -20, -2040000),
  // out of period (July) and zero quantity: ignored
  line('M4', 'Synthetic material four', 'PCS', 10, 5000000, serial(2026, 7, 28)),
  line('M4', 'Synthetic material four', 'PCS', 0, 0),
];

const datasets = {
  'MI-M-T': { header: HDR, rows, erp: 'T', report: 'MI-M' },
  // MI-M-O exists with the same header but no rows; MI-M-S is missing entirely
  'MI-M-O': { header: HDR, rows: [], erp: 'O', report: 'MI-M' },
};
const r = materialIssueCosts(datasets, P);
const m = (code) => r.materials.find((x) => x.code === code);

ok('three materials in period: M4 (only a July line and a zero-qty line) is not listed', r.summary.materials === 3 && !m('M4'));
ok('M1 unit price (BQ) = Σ cost ÷ Σ qty over costed lines', m('M1') && near(m('M1').bq, 5500000 / 35));
ok('M1 reference unit price = median of line unit prices (125k)', m('M1') && near(m('M1').ref, 125000));
ok('M1 has exactly one abnormal line (400k vs median); 100k lines not flagged', m('M1') && m('M1').nDev === 1);
ok('M1 is flagged REVIEW - BẤT THƯỜNG', m('M1') && m('M1').flag === 'REVIEW - BẤT THƯỜNG');
ok('M1 max deviation = 400k / median − 1 (= 220 %)', m('M1') && near(m('M1').maxDev, 400000 / 125000 - 1, 0.0001));
ok('M1 price range (min/max line unit cost)', m('M1') && near(m('M1').uMin, 100000) && near(m('M1').uMax, 400000));
ok('M2: small deviating line (< 1M) is not flagged', m('M2') && m('M2').nDev === 0);
ok('M2: zero-cost issue line is counted and flagged THIẾU COST', m('M2') && m('M2').nZero === 1 && m('M2').flag === 'REVIEW - THIẾU COST');
ok('M2: zero-cost line stays out of the unit price', m('M2') && near(m('M2').bq, 503000 / 6));
ok('M3: normal material is PASS', m('M3') && m('M3').flag === 'PASS' && m('M3').nDev === 0);
ok('M3: negative (return) line counted, not in the unit price', m('M3') && m('M3').nNeg === 1 && near(m('M3').bq, 2020000 / 200));
ok('flagged lines list contains only M1 line 4 (cost ≥ 1M, > 30 %)', r.lines.length === 1 && r.lines[0].code === 'M1' && near(r.lines[0].cost, 2000000));
ok('summary counts: 1 flagged material, 1 missing-cost material, 1 flagged line, 1 zero-cost line', r.summary.flagged === 1 && r.summary.missingCost === 1 && r.summary.flaggedLines === 1 && r.summary.zeroCostLines === 1);
ok('materials sorted: abnormal first, then missing cost, then PASS', r.materials.map((x) => x.flag).join(',') === ['REVIEW - BẤT THƯỜNG', 'REVIEW - THIẾU COST', 'PASS'].join(','));
ok('missing MI-M system is reported (S)', r.missing.includes('S') && !r.missing.includes('T'));
ok('thresholds are exported for the screen text', MATCOST_DEV === 0.3 && MATCOST_MIN_COST === 1000000);
ok('no datasets → empty result, no crash', (() => { const e = materialIssueCosts({}, P); return e.materials.length === 0 && e.missing.length === 3; })());

console.log(`\n${total - fail}/${total} material unit cost checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
