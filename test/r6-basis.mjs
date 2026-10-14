// v1.14.43 — STEP 2 rule R6 ("S khác" → T+O) is spread by the amount each lot already received from R5a/R5b/R5c.
// Synthetic data only (no company data). Checks the allocation arithmetic in FAMILY mode, the legacy WORKBOOK parity
// and the documented fallback when no R5 amount reaches an eligible lot.
import { runStep2 } from '../src/engine/step2.js';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++; };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const P = '2026-08';
const serial = (d) => (Date.UTC(2026, 7, d) - Date.UTC(1899, 11, 30)) / 86400000;

// PC-P lots (cost = RM cost of the lot)
const HPC = ['PC No.', 'Product Code', 'Product Name', 'Location', 'Current Complete Qty', 'Total Cost', 'Date', 'Sub-MO', 'Unit', 'MO No.'];
const pcLot = (erp, pc, prod, loc, cost) => [pc, prod, `Synthetic ${prod}`, loc, 10, cost, serial(5), '', 'PCS', 'MO-TEST'];
const ds = (header, rows) => ({ header, rows, erp: '', report: '' });

// Stock Out headers (same layouts the importer accepts)
const HST = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Unit', 'Quantity', 'Total Cost', 'Customer', 'MO No.'];
const HSO = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Base Unit', 'Base Qty', 'Base Unit Cost', 'Total Cost', 'MO No.', 'DIVISION', 'JOB CODE', 'CUSTOMER'];
const HSS = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Quantity', 'Unit', 'Location', 'Base Unit Cost', 'Total Cost', 'Remark', 'MO No.', 'Doc Ref 1', 'DIVISION', 'JOB CODE'];
const soS = (loc, cost, i) => ['SO-S-' + i, 'Stock Out', 'G', 'Completed', serial(10), 'SL', i, 'RM-' + i, 'Synthetic RM', 'RM', 1, 'PCS', loc, 0, -cost, '', 'MO-TEST', 'DOC', '', ''];

function datasetsFor({ sRows }) {
  return {
    'PC-P-T': ds(HPC, [pcLot('T', 'PC-T1', 'SP100', 'SP100', 1000), pcLot('T', 'PC-T2', 'SP200', 'SP200', 3000)]),
    'PC-P-O': ds(HPC, [pcLot('O', 'PC-O1', 'OLX1', 'MK1', 500), pcLot('O', 'PC-O2', 'OLX2', 'VE1', 9000)]),
    'STOCK OUT-T': ds(HST, []),
    'STOCK OUT-O': ds(HSO, []),
    'STOCK OUT-S': ds(HSS, sRows),
  };
}
const lotAlloc = (s2, pc) => s2.pc.filter((p) => p.pcNo === pc).reduce((a, p) => a + p.alloc, 0);
const ruleRows = (s2, prefix) => s2.detail.filter((d) => String(d[17]).startsWith(prefix));

// ---- scenario A: R5a (DS1 → T SP*), R5b (VE1 → O VE*), R5c (MK1 → O MK*) and an "other" location (XX1 → T+O)
const sRowsA = [soS('DS1', 100, 1), soS('MK1', 50, 2), soS('VE1', 80, 3), soS('XX1', 200, 4)];
const A = runStep2(datasetsFor({ sRows: sRowsA }), P, {});
// R5a–c amounts per lot: DS1 100 → T SP* by RM cost (T1 25, T2 75); MK1 50 → O1; VE1 80 → O2
const r5Lots = { 'PC-T1': 25, 'PC-T2': 75, 'PC-O1': 50, 'PC-O2': 80 };
const r5Sum = Object.values(r5Lots).reduce((a, b) => a + b, 0); // 230
const r6Total = 200;
const expectR6 = Object.fromEntries(Object.entries(r5Lots).map(([k, v]) => [k, r6Total * v / r5Sum]));
const r6Rows = ruleRows(A, 'S other -> T+O theo tỷ lệ R5a');
ok('scenario A: R6 uses the R5a–c basis (not RM Cost)', r6Rows.length > 0 && r6Rows.every((d) => d[16] === 'FALLBACK R5 BASIS'));
ok('scenario A: R6 total fully allocated (200)', near(r6Rows.reduce((a, d) => a + d[15], 0), 200));
// precise per-lot check of the R6 share (strip the R5 part from each lot)
const r6Share = (pc) => r6Rows.filter((d) => d[8] === pc).reduce((a, d) => a + d[15], 0);
ok('scenario A: O2 (VE1 only) receives 200 × 80/230 from R6', near(r6Share('PC-O2'), expectR6['PC-O2']));
ok('scenario A: T1 receives 200 × 25/230 from R6', near(r6Share('PC-T1'), expectR6['PC-T1']));
ok('scenario A: T2 receives 200 × 75/230 from R6', near(r6Share('PC-T2'), expectR6['PC-T2']));
ok('scenario A: O1 receives 200 × 50/230 from R6', near(r6Share('PC-O1'), expectR6['PC-O1']));
ok('scenario A: summary reconciles (src = alloc + unalloc + cons)', near(A.total.src, A.total.alloc + A.total.unalloc + A.total.cons, 0.01));

// ---- scenario B: no R5a–c amount on any eligible lot → documented fallback to PC RM Cost
const sRowsB = [soS('XX1', 200, 1)];
const B = runStep2(datasetsFor({ sRows: sRowsB }), P, {});
const fbRows = B.detail.filter((d) => String(d[17]).startsWith('S other -> T+O theo PC RM Cost.'));
ok('scenario B: no R5 basis → fallback to RM Cost, flagged', fbRows.length > 0 && fbRows.every((d) => d[16] === 'FALLBACK RM COST' && String(d[17]).includes('Dự phòng')));
const totalCost = 1000 + 3000 + 500 + 9000;
ok('scenario B: fallback weights follow RM Cost (T1 gets 200 × 1000/13500)', near(lotAlloc(B, 'PC-T1'), 200 * 1000 / totalCost));

// ---- scenario C: WORKBOOK parity (legacy equal T+O split, unchanged)
const C = runStep2(datasetsFor({ sRows: sRowsA }), P, { oRule: 'WORKBOOK' });
const cRows = C.detail.filter((d) => String(d[17]).startsWith('S other -> equal T+O.'));
ok('scenario C: WORKBOOK keeps equal T+O split (FALLBACK EQUAL)', cRows.length > 0 && cRows.every((d) => d[16] === 'FALLBACK EQUAL'));
ok('scenario C: WORKBOOK equal split: each of 4 lots gets 50', ['PC-T1', 'PC-T2', 'PC-O1', 'PC-O2'].every((pc) => near(cRows.filter((d) => d[8] === pc).reduce((a, d) => a + d[15], 0), 50)));

console.log(`\n${total - fail}/${total} R6 basis checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
