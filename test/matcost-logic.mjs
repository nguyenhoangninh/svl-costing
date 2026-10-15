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

// v1.14.46: thresholds are options (the screen lets the user change them)
const rDev = materialIssueCosts(datasets, P, { dev: 2.5 });
ok('threshold 250 %: the 220 % line in M1 is no longer flagged', rDev.lines.length === 0 && rDev.summary.dev === 2.5 && rDev.summary.flagged === 0);
const rMin = materialIssueCosts(datasets, P, { minCost: 300000 });
ok('minimum cost 300k: M2 line of 500k (deviating) is flagged too', rMin.lines.some((l) => l.code === 'M2') && rMin.lines.some((l) => l.code === 'M1') && rMin.summary.minCost === 300000);
const rDef = materialIssueCosts(datasets, P, {});
ok('no options → defaults (30 %, 1.000.000 VND)', rDef.summary.dev === MATCOST_DEV && rDef.summary.minCost === MATCOST_MIN_COST && rDef.lines.length === 1);

// v1.14.48: the MI-M unit-cost lines are part C of the STEP 1 confirmation gate (confirmed with the negative / text lines)
const DQ = await import('../src/engine/dataquality.js');
const negN = (x) => x.lines.filter((l) => l.type !== 'ZERO COST').length; // part C's own lines (zero-cost lines are part B)
const an = DQ.erpAnomalies(datasets, P);
ok('part C lists the flagged MI-M lines at the default thresholds', an.mcLines.length === 1 && an.mcLines[0].code === 'M1');
ok('v1.14.65: part C = negative/text lines + flagged MI-M lines (blocking again)', an.parts.C.count === negN(an) + an.mcLines.length && an.mcLines.length > 0);
ok('v1.14.62: the full MI-M list (all costed lines, with status) is available for the filter', an.mcAll.length >= an.mcLines.length && an.mcAll.filter((l) => l.flag === 'REVIEW - BẤT THƯỜNG').length === an.mcLines.length && an.mcAll.some((l) => l.flag === 'OK - BÌNH THƯỜNG'));
ok('v1.14.63: part D = flagged PC-lot unit costs, blocking like C', 'D' in an.parts && an.parts.D.count === an.pcFlagged.length && an.pcFlagged.every((l) => l.flag === 'REVIEW - BẤT THƯỜNG') && 'D' in DQ.DQ_PARTS);
ok('part C blocks STEP 2 while not confirmed', DQ.anomalyStatus(an, null) === 'BLOCK - CONFIRM' && DQ.partStatus(an, null, 'C') === 'NOT CONFIRMED');
const ackC = { parts: { A: { fp: an.parts.A.fp, count: an.parts.A.count }, B: { fp: an.parts.B.fp, count: an.parts.B.count }, C: { fp: an.parts.C.fp, count: an.parts.C.count, by: 't', at: 'x', note: 'ok' } } };
ok('confirmed part C releases the gate', DQ.anomalyStatus(an, ackC) === 'REVIEW - CONFIRMED');
ok('the fingerprint is stable for the same data (confirmation stays valid)', DQ.erpAnomalies(datasets, P).parts.C.fp === an.parts.C.fp);
const anOther = DQ.erpAnomalies(datasets, '2026-07');
ok('another period has no MI-M lines in part C (no false block)', anOther.mcLines.length === 0 && anOther.parts.C.count === negN(anOther));
const anNoPeriod = DQ.erpAnomalies(datasets);
ok('without a period no MI-M lines are added to part C (backward compatible)', anNoPeriod.mcLines.length === 0 && anNoPeriod.parts.C.count === negN(anNoPeriod));
const negOnly = { 'MI-M-T': { ...datasets['MI-M-T'], rows: datasets['MI-M-T'].rows.filter((r) => r[15] < 0) } };
const anNeg = DQ.erpAnomalies(negOnly, P);
ok('a list with only a negative line gives part C that line alone', anNeg.mcLines.length === 0 && anNeg.parts.C.count === 1 && negN(anNeg) === 1);

console.log(`\n${total - fail}/${total} material unit cost checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
