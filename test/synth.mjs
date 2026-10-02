// Synthetic end-to-end regression (no company data): generated ERP reports → STEP 2 → 3A → 3B → 4 → 5 (MONTHLY + STRICT_DATE with rework).
// Checks the engine's own reconciliations and compares key results with test/synth.snapshot.json.
// Usage: node test/synth.mjs            (compare)
//        node test/synth.mjs --update   (rewrite the snapshot after an intended, reviewed change)
import fs from 'node:fs';
import { buildDataset } from '../src/engine/step1.js';
import { runStep2, buildReworkRegister, recheckRegisterRow } from '../src/engine/step2.js';
import { validateOpening, runStep3 } from '../src/engine/step3.js';
import { deriveInput, runBuild, engineDynamic, applyControl, wipFinal, postedByLot, writeInput } from '../src/engine/step3b.js';
import { importSales, validateSaveSales, updatePriceMaster, runStep4, finalLayer } from '../src/engine/step4.js';
import * as F5 from '../src/engine/step5.js';
import { num } from '../src/engine/util.js';

const P = '2026-08';
const ser = (d) => (Date.UTC(2026, 7, d) - Date.UTC(1899, 11, 30)) / 86400000;
// deterministic pseudo-random numbers
let seed = 20261002; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const R = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;

// ---------- master data (invented)
const PROD = { T: [['SPX-100', 'Synthetic seat A'], ['SPX-200', 'Synthetic seat B']], O: [['OLX-300', 'Synthetic bag C', 'MKX1'], ['OLX-400', 'Synthetic belt D', 'VEX1']] };
const MAT = { T: ['50000001', '50000002', '50000003', '50000004'], O: ['300001', '300002', '300003', '300004'] };
const price = { '50000001': 12000, '50000002': 3500, '50000003': 800, '50000004': 45000, '300001': 9000, '300002': 2200, '300003': 640, '300004': 15000 };

// ---------- PC-P / PC-M / MI-M / MR-M
const pcp = { T: [], O: [] }, pcm = { T: [], O: [] }, mim = { T: [], O: [] }, mrm = { T: [], O: [] };
let lot = 0;
for (const e of ['T', 'O']) {
  for (const [code, name, loc] of PROD[e]) {
    for (let k = 0; k < 3; k++) {
      lot++; const pc = `PC-2608-${String(lot).padStart(3, '0')}`; const mo = `MO-25${e}-${lot}`; const sub = `${mo}-001`;
      const qty = 20 + Math.round(rnd() * 80); const day = 3 + k * 9 + (e === 'O' ? 1 : 0);
      let cost = 0;
      MAT[e].forEach((m, i) => {
        if (k === 2 && i === 3) return; // one lot misses a material (trace anomaly)
        const q = Math.round(qty * (1 + i) * R(0.9, 1.1) * 100) / 100; const a = Math.round(q * price[m] * R(0.97, 1.03) * 100) / 100;
        cost += a;
        pcm[e].push([pc, 'PC', ser(day), 'Completed', mo, sub, code, name, '#', m, `Material ${m}`, q, 'PCS', a]);
        const iq = Math.round(q * (i === 3 ? R(0.6, 0.7) : R(1.0, 1.15)) * 100) / 100; // material 4 is under-issued → negative WIP → 3B
        mim[e].push([`MI-${lot}-${i}`, 'MI', ser(day - 1), 'Completed', mo, sub, code, name, '#', m, `Material ${m}`, iq, 'PCS', Math.round(iq * price[m] * 100) / 100]);
      });
      pcp[e].push([pc, 'PC', ser(day), 'Completed', mo, sub, code, name, loc || 'FG', 'PCS', qty, Math.round(cost * 100) / 100]);
    }
  }
  mrm[e].push(['MR-1', 'MR', ser(28), 'Completed', `MO-25${e}-1`, '', PROD[e][0][0], PROD[e][0][1], '#', MAT[e][0], `Material ${MAT[e][0]}`, 'PCS', 1, 'RM', 1, price[MAT[e][0]]]);
}
const HP = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'Unit', 'Current Complete Qty', 'Total Cost'];
const HM = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Quantity', 'Unit(Qty)', 'Total Cost'];
const HI = ['MI No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Current Issue Qty', 'Unit', 'Total Cost'];
const HR = ['Code', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Unit', 'Req. Qty', 'Location', 'Quantity', 'Total Cost'];
// ---------- Stock Out (RM + one FG issue to rework on ERP T)
const soT = [['SO-T-1', 'Stock Out', 'G', 'Completed', ser(6), null, 1, MAT.T[1], 'Material', 'RM', 'RM', 'PCS', -50, -175000, 'DOONA', null],
  ['SO-T-2', 'Stock Out', 'G', 'Completed', ser(9), null, 1, MAT.T[2], 'Material', 'RM', 'RM', 'PCS', -100, -80000, 'COMMON', null],
  ['SO-T-3', 'Stock Out', 'G', 'Completed', ser(15), null, 1, 'SPX-100', 'Synthetic seat A', 'FG', 'FG', 'PCS', -2, -900000, 'COMMON', 'MO-RW-1']];
const soO = [['SO-O-1', 'Stock Out', 'G', 'Completed', ser(7), null, 1, MAT.O[1], 'Material', 'RM', 'MKX1', 'PC', -40, 2200, -88000, null, 'DIV', 'MKX1', null],
  ['SO-O-2', 'Stock Out', 'G', 'Completed', ser(8), null, 1, MAT.O[2], 'Material', 'RM', 'ZZZ', 'PC', -30, 640, -19200, null, 'DIV', 'ZZ-UNKNOWN', null]];
const soS = [['SO-S-1', 'Stock Out', 'G', 'Completed', ser(10), null, 1, '900001', 'Material', 'RM', -5, 'M', 'DSL1', 3000, -15000, 'R', null, 'X', 'DIV', 'DS-1']];
const HST = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Unit', 'Quantity', 'Total Cost', 'Customer', 'MO No.'];
const HSO = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Base Unit', 'Base Qty', 'Base Unit Cost', 'Total Cost', 'MO No.', 'DIVISION', 'JOB CODE', 'CUSTOMER'];
const HSS = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Quantity', 'Unit', 'Location', 'Base Unit Cost', 'Total Cost', 'Remark', 'MO No.', 'Doc Ref 1', 'DIVISION', 'JOB CODE'];
const ds = {};
const add = (name, header, rows) => { const d = buildDataset([header, ...rows], `${name}-202608.xlsx`, P); ds[d.key] = d; };
for (const e of ['T', 'O']) { add(`PC-P-${e}`, HP, pcp[e]); add(`PC-M-${e}`, HM, pcm[e]); add(`MI-M-${e}`, HI, mim[e]); add(`MR-M-${e}`, HR, mrm[e]); }
add('STOCK OUT-T', HST, soT); add('STOCK OUT-O', HSO, soO); add('STOCK OUT-S', HSS, soS);
add('MR-M-S', ['Code', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Req. Qty', 'Location', 'Unit Rate', 'Bad Quantity', 'Total Cost'], []);

// ---------- STEP 2 / 2B
const s2 = runStep2(ds, P);
const register = buildReworkRegister(ds, P, [], []);
for (const r of register.rows) { r.rwType = 'NORMAL'; r.rwStatus = 'OPEN'; recheckRegisterRow(r); }
// ---------- STEP 3A: opening WIP (one material ends negative → 3B)
const opening = { period: P, source: 'synthetic', rows: [...MAT.T, ...MAT.O].map((m, i) => ({ code: m, name: `Material ${m}`, unit: 'PCS', qty: i === 3 ? 0 : 40, amt: i === 3 ? 0 : 40 * price[m] })) };
validateOpening(opening, ds, P);
const s3 = runStep3(ds, opening, s2, P, '');
// ---------- STEP 3B (amount basis, approve all)
const input = writeInput([], s3, false);
const b = runBuild({ erpMap: { rows: [] }, input, control: null, reg632: [], basis: 'AMOUNT' }, { step3: s3, step2: s2, datasets: ds, period: P });
for (const r of b.control.rows) r.decision = r.status === 'PASS' ? 'APPROVE' : 'HOLD';
applyControl(b.control, s3, '');
const inD = deriveInput(input, b.erpMap, s3, P);
const eng = engineDynamic(b.engine, inD, b.control);
const wf = wipFinal(s3, b.control, b.erpMap);
// ---------- STEP 4
const HS = ['Invoice Date', 'Month', 'Customer', 'Product Number', 'Product Name', 'Exchange Rate', 'Quantity', 'Unit Price (USD)', 'Amount (USD)', 'Amount (VND)', 'Remark', 'SI Invoice No.', 'Invoice Line No.', 'Transaction Type', 'Bill Date', 'Original Invoice No.'];
const FX = 26000;
const sale = (day, cust, prod, qty, usd, inv, bill = null, orig = null) => [ser(day), 8, cust, prod, 'x', FX, qty, usd, qty * usd, qty * usd * FX, null, inv, null, qty < 0 ? 'SALES RETURN' : 'NORMAL SALE', bill, orig];
const salesGrid = [HS, sale(5, 'C1', 'SPX-100', 30, 260, 'INV-1'), sale(12, 'C1', 'SPX-200', 20, 300, 'INV-2'), sale(14, 'C2', 'OLX-300', 25, 40, 'INV-3'), sale(20, 'C2', 'OLX-400', 15, 22, 'INV-4'),
  sale(18, 'C1', 'SPX-100', 25, 262, 'INV-5', ser(19)), sale(25, 'C1', 'SPX-100', -2, 260, 'CN-1', null, 'INV-1')];
const salesDB = validateSaveSales(importSales({ S: salesGrid }, 'synthetic.xlsx', 'YTD', P), { rows: [] }, P).db;
const pm = updatePriceMaster({ salesDB, so: [{ active: 'Y', product: 'OLX-400', price: 23, soDate: ser(2) }], manual: [], step2: s2, period: P }).pm;
const gl = { period: P, fx: FX, gl622: 90000000, gl627: 60000000 };
const s4 = runStep4({ period: P, step2: s2, step3: s3, pm, gl, directAdj: [{ active: 'Y', erp: 'O', account: 622, amount: 5000000, pc: pcp.O[0][0], prod: pcp.O[0][6], reason: 'Synthetic approved direct labor attribution' }] });
const fl = finalLayer(s4, postedByLot(eng), register);
// ---------- STEP 5
const fgOpen = { period: P, status: 'LOADED', rows: [['SPX-100', 10, 9000000], ['OLX-300', 8, 300000]].map(([prod, qty, tot], i) => ({ period: P, srcPeriod: '2026-07', lid: `OP-${i}`, source: 'OPENING', pc: `PC-2607-${i}`, date: (Date.UTC(2026, 6, 20) - Date.UTC(1899, 11, 30)) / 86400000, mo: '', prod, name: 'x', loc: '', unit: 'PCS', qty, rm: tot * 0.6, a622: tot * 0.25, a627: tot * 0.15, tot, price: 0, prov: 0, cons: '' })) };
F5.validateOpeningFG(fgOpen, P);
const run = (mode) => {
  // MONTHLY remains covered for ordinary sales-only costing. Any active rework is now an explicit STRICT_DATE workflow.
  const reg = mode === 'MONTHLY' ? { period: P, rows: [] } : JSON.parse(JSON.stringify(register));
  const salesRows = mode === 'MONTHLY' ? salesDB.rows.filter((r) => num(r.qty) >= 0) : salesDB.rows;
  const res = F5.runFIFO({ period: P, opening: fgOpen, caRows: fl.rows, salesRows, pmRows: pm.rows, fx: FX, overrides: {}, dupDecisions: {}, mode, tol: 1, register: reg, sellCostRate: 0.015,
    step4: { current: 'CURRENT', overall: fl.overall, finalCost: fl.totals.totalCost, qty: s4.recon.rows[1].result } });
  if (F5.reworkCount(reg)) F5.runReworkFIFO(res, reg, { period: P, opening: fgOpen, salesRows, step4Carry: fl.totals.carryIn });
  F5.finalizeRun(res);
  return { res, reg };
};
const M = run('MONTHLY'), St = run('STRICT_DATE');

// ---------- invariants
let fails = 0; const ok = (label, cond, info = '') => { if (!cond) { fails++; console.log(`✗ ${label} ${info}`); } };
ok('step2 PASS', s2.status === 'PASS', s2.status);
ok('step3 roll-forward', Math.abs(s3.summary.opening + s3.summary.inAmt - s3.summary.outAmt - s3.summary.closingAmt) < 1);
ok('3B has amount-basis rows', b.engine.rows.some((r) => r.note === 'Actual PC-M amount ratio'));
ok('3B WIP bridge', wf.bridgeStatus === 'PASS', wf.bridgeStatus);
ok('step4 overall PASS', String(fl.overall).startsWith('PASS'), fl.overall);
for (const [n, x] of [['MONTHLY', M], ['STRICT', St]]) for (const k of [8, 9, 10, 11, 12]) ok(`${n} rec ${k}`, x.res.rec[k].status === 'PASS', JSON.stringify(x.res.rec[k]));
ok('return restored in STRICT_DATE', St.res.sales.some((s) => s.fin === 'RETURN' && s.status === 'RETURNED'));
const hStrict = F5.buildHistory(St.res, [], { period: P, opening: fgOpen, caRows: fl.rows });
const hgStrict = F5.historyGate(hStrict, St.res, P);
const recStrict = F5.step5Recon({ period: P, res: St.res, freshness: 'CURRENT', hist: hStrict, histGate: hgStrict, gl: { ytd622: null, ytd627: null }, fl, s4, gate6: fl.gate6 || 'PASS' });
ok('STEP 5R return → FG History PASS', hgStrict.gate === 'PASS', hgStrict.gate);
ok('STEP 5R return → reconciliation row 36 PASS', recStrict.rows[36] && recStrict.rows[36].status === 'PASS', JSON.stringify(recStrict.rows[36]));
ok('all accepted sales recognition dates are inside the costing period', salesDB.rows.every((r) => { const d = F5.saleDate(r); return d !== null && d <= ser(31); }));
const f154 = (x) => num(s3.openingAmt) + s3.summary.miAmt + s3.summary.soAmt + s4.alloc622 + s4.alloc627 + num(x.res.rework && x.res.rework.fifoCost) - s3.summary.mrAmt - fl.totals.totalCost - wf.finalClosing - x.reg.rows.reduce((a, r) => a + num(r.closingWIP), 0);
ok('154 bridge MONTHLY', Math.abs(f154(M)) <= 1, f154(M));
ok('154 bridge STRICT', Math.abs(f154(St)) <= 1, f154(St));
const f155 = (x) => x.res.totals.openA + fl.totals.totalCost - x.res.totals.cogsA - num(x.res.totals.rwTot) - x.res.totals.closeA;
ok('155 bridge MONTHLY', Math.abs(f155(M)) <= 1, f155(M));
ok('155 bridge STRICT', Math.abs(f155(St)) <= 1, f155(St));

// ---------- snapshot
const r2 = (x) => Math.round(num(x) * 100) / 100;
const snap = {
  step2: { alloc: r2(s2.total.alloc), fallback: s2.detail.filter((d) => String(d[17]).includes('fallback ALL') || d[16] === 'FALLBACK EQUAL').length },
  step3: { closing: r2(s3.summary.closingAmt), final: r2(wf.finalClosing) },
  b3: eng.filter((e) => e.Y === 'Y').map((e) => [e.key, e.pc, r2(e.AA)]),
  step4: fl.rows.map((r) => [r.pc, r2(r.totalCost)]),
  strict: { cogs: r2(St.res.totals.cogsA), close: r2(St.res.totals.closeA), rw: r2(St.res.rework.fifoCost), rwStatus: St.reg.rows.map((r) => r.fifoStatus), lines: St.res.sales.map((s) => [s.inv, s.status, r2(s.tot)]) },
  revenue: r2(F5.periodRevenue(salesDB.rows, P)),
};
const file = new URL('./synth.snapshot.json', import.meta.url);
if (process.argv.includes('--update') || !fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(snap, null, 1) + '\n'); console.log('snapshot written'); }
else {
  const want = JSON.parse(fs.readFileSync(file, 'utf8'));
  const diff = (a, b, path) => { if (typeof a !== 'object' || a === null) { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; if (fails < 30) console.log(`✗ snapshot ${path}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); } return; } for (const k of new Set([...Object.keys(a), ...Object.keys(b || {})])) diff(a[k], b ? b[k] : undefined, `${path}.${k}`); };
  diff(snap, want, '');
}
console.log(fails ? `${fails} synthetic checks FAILED` : 'synthetic pipeline: all checks passed');
process.exit(fails ? 1 : 0);
