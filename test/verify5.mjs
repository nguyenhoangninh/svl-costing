// Regression test STEP 5 (FIFO COGS, Rework FIFO, FG History, close controls) vs the Aug-2026 workbook.
// Usage: node test/verify5.mjs <costing.xlsm> <erp-fixture-folder> <sales-fixture.xlsx>
import fs from 'node:fs';
import XLSX from 'xlsx';
import { loadWorkbook, loadDatasets, runBase, checker, PERIOD } from './load.mjs';
import { sheetToGrid } from '../src/engine/grid.js';
import { MAP_FIELDS, deriveInput, runBuild, engineDynamic, applyControl, postedByLot } from '../src/engine/step3b.js';
import { importSales, validateSaveSales, updatePriceMaster, runStep4, finalLayer } from '../src/engine/step4.js';
import * as F5 from '../src/engine/step5.js';
import { txt, ttxt, num } from '../src/engine/util.js';

const [, , wbPath, fixDir, salesPath] = process.argv;
const W = loadWorkbook(wbPath); const { G, cell } = W;
const datasets = loadDatasets(fixDir);
const base = runBase(W, datasets);
const { expect, done } = checker();
// ---- Step 3B / 4 state (same as verify2)
const mapG = G('03_WIP_ERP_MAP'); const erpMap = { rows: [] };
for (let r = 3; r < mapG.length; r++) { const x = mapG[r] || []; if (!ttxt(x[0])) continue; erpMap.rows.push(Object.fromEntries(MAP_FIELDS.map((f, i) => [f, x[i] ?? '']))); }
const inG = G('03_WIP_DIRECT_ADJ_INPUT'); const input = [];
for (let r = 9; r < inG.length; r++) { const x = inG[r] || []; if (!ttxt(x[1])) continue; input.push({ code: x[1], desc: x[2], basisQty: x[6], basisAmt: x[7], option: x[8], reason: x[9], note: x[10] }); }
const ctG = G('03_WIP_DIRECT_ADJ_CONTROL'); const oldControl = { rows: [] };
for (let r = 9; r < ctG.length; r++) { const x = ctG[r] || []; if (!ttxt(x[2])) continue; oldControl.rows.push({ period: x[1], code: x[2], basisQty: x[5], basisAmt: x[6], method: x[7], decision: x[21], note: x[22], gate: x[23] }); }
const b = runBuild({ erpMap, input, control: oldControl, reg632: [], basis: 'QTY' }, { step3: base.s3, step2: base.s2, datasets, period: PERIOD });
const inD = deriveInput(input, b.erpMap, base.s3, PERIOD);
b.control.rows.forEach((r) => { if (!r.decision) r.decision = 'REVIEW'; });
applyControl(b.control, base.s3, 'Re-checking');
const eng = engineDynamic(b.engine, inD, b.control);
const sw = XLSX.read(fs.readFileSync(salesPath), { type: 'buffer' });
const staging = importSales(Object.fromEntries(sw.SheetNames.map((n) => [n, sheetToGrid(XLSX, sw.Sheets[n])])), 'sales.xlsx', 'YTD', PERIOD);
const salesDB = validateSaveSales(staging, { rows: [] }, PERIOD).db;
const soG = G('04_SO_PRICE'); const so = [];
for (let r = 5; r < soG.length; r++) { const x = soG[r] || []; if (!ttxt(x[1]) && !ttxt(x[0])) continue; so.push({ active: x[0], product: x[1], soDate: x[2], soNo: x[3], customer: x[4], qty: x[5], price: x[6], note: x[7] }); }
const pmG = G('04_PRICE_MASTER'); const manual = [];
for (let r = 5; r < pmG.length; r++) { const x = pmG[r] || []; if (!ttxt(x[10])) continue; manual.push({ product: x[10], price: x[11], effFrom: x[12], effTo: x[13], source: x[14], approvedBy: x[15], updatedAt: x[16] }); }
const pm = updatePriceMaster({ salesDB, so, manual, step2: base.s2, period: PERIOD }).pm;
const glG = G('04_GL_INPUT');
const gl = { period: txt(cell(glG, 'J5')), fx: cell(glG, 'C4'), gl622: cell(glG, 'C5'), gl627: cell(glG, 'C6'), ytd622: cell(glG, 'C18'), ytd627: cell(glG, 'C19') };
const daG = G('04_DIRECT_ADJ'); const directAdj = [];
for (let r = 5; r < daG.length; r++) { const x = daG[r] || []; if (![0, 1, 2, 3, 4, 5].some((c) => ttxt(x[c]))) continue; directAdj.push({ active: x[0], erp: x[1], account: x[2], amount: x[3], pc: x[4], prod: x[5], reason: x[6] }); }
const s4 = runStep4({ period: PERIOD, step2: base.s2, step3: base.s3, pm, gl, directAdj });
const register = base.register;
const posted = postedByLot(eng);
const fl0 = finalLayer(s4, posted, register);

// ======================= STEP 5 =======================
console.log('STEP 5');
const oG = G('05_FG_OPENING'); const opening = { period: PERIOD, status: 'LOADED', rows: [] };
for (let r = 5; r < oG.length; r++) { const x = oG[r] || []; if (!ttxt(x[2])) continue; opening.rows.push(Object.fromEntries(F5.LAYER_FIELDS.map((f, i) => [f, x[i] ?? null]))); }
const sheetStatus = opening.rows.map((r) => [r.status, r.msg]);
F5.validateOpeningFG(opening, PERIOD);
expect('open status', opening.status, cell(oG, 'B2'));
opening.rows.forEach((r, i) => { expect(`open r${6 + i} st`, r.status, sheetStatus[i][0]); expect(`open r${6 + i} msg`, r.msg, sheetStatus[i][1] ?? ''); });
expect('open layers', opening.stats.layers, cell(oG, 'D3'), 0); expect('open amt', opening.stats.amt, cell(oG, 'H3'), 0.01);
const sG = G('05_SALES_COGS'); const overrides = {};
for (let r = 5; r < sG.length; r++) { const x = sG[r] || []; if (ttxt(x[22]) && ttxt(x[12])) overrides[ttxt(x[22])] = x[12]; }
const recG = G('05_RECONCILIATION');
const res = F5.runFIFO({ period: PERIOD, opening, caRows: fl0.rows, salesRows: salesDB.rows, pmRows: pm.rows, fx: gl.fx, overrides, mode: cell(recG, 'L3'), tol: cell(recG, 'L4'),
  step4: { current: 'CURRENT', overall: fl0.overall, finalCost: fl0.totals.totalCost, qty: s4.recon.rows[1].result } });
// Policy since v1.9 (owner decision #1, 02/10/2026): active FG rework must run STRICT_DATE; the workbook ran MONTHLY.
expect('gate MONTHLY blocked by policy', F5.reworkGate(register, salesDB.rows, PERIOD, 'MONTHLY').startsWith('BLOCK - STRICT DATE REQUIRED'), true);
expect('gate STRICT_DATE ok', F5.reworkGate(register, salesDB.rows, PERIOD, 'STRICT_DATE'), '');
const carryBefore = F5.carryTotal(register);
F5.runReworkFIFO(res, register, { period: PERIOD, opening, salesRows: salesDB.rows, step4Carry: fl0.totals.carryIn });
// ledger
const lG = G('05_FG_LEDGER');
let nL = 0; for (let r = 5; r < lG.length && lG[r] && ttxt(lG[r][1]); r++) nL++;
expect('ledger rows', res.ledger.length, nL, 0);
const tolF = (f) => (['qtyIn', 'qtyOut', 'remQ', 'unitCost', 'qty', 'layerQty', 'left', 'unit', 'fq', 'price', 'prov'].includes(f) ? 1e-6 : ['seq', 'line', 'dbRow'].includes(f) ? 0 : 0.01);
const cmpRows = (name, rows, g, fields, startRow, skip = []) => rows.forEach((o, i) => { const x = g[startRow + i] || []; fields.forEach((f, c) => { if (skip.includes(f)) return; expect(`${name} r${startRow + 1 + i} ${f}`, o[f] ?? '', x[c] ?? '', tolF(f)); }); });
cmpRows('led', res.ledger, lG, F5.LEDGER_FIELDS, 5);
cmpRows('sales', res.sales, sG, F5.SALES_FIELDS, 5);
const dG = G('05_FIFO_DETAIL'); let nD = 0; for (let r = 5; r < dG.length && dG[r] && ttxt(dG[r][3]); r++) nD++;
expect('detail rows', res.detail.length, nD, 0);
cmpRows('det', res.detail, dG, F5.DETAIL_FIELDS, 5);
const cG = G('05_FG_CLOSING'); let nC = 0; for (let r = 5; r < cG.length && cG[r] && ttxt(cG[r][2]); r++) nC++;
expect('closing rows', res.closing.length, nC, 0);
cmpRows('close', res.closing, cG, F5.LAYER_FIELDS, 5);
expect('close B3', res.totals.layers, cell(cG, 'B3'), 0); expect('close D3', res.totals.closeQ, cell(cG, 'D3'), 1e-6); expect('close F3', res.totals.closeA, cell(cG, 'F3'), 0.01); expect('close F2', res.runResult, cell(cG, 'F2'));
const smG = G('05_COGS_SUMMARY'); let nP = 0; for (let r = 5; r < smG.length && smG[r] && ttxt(smG[r][0]); r++) nP++;
expect('sum rows', res.summary.length, nP, 0);
cmpRows('sum', res.summary, smG, F5.SUM_FIELDS, 5);
const T = res.totals;
[['C3', T.openQ], ['D3', T.openA], ['E3', T.prodQ], ['F3', T.prodA], ['G3', T.cogsQ], ['H3', T.cogsRM], ['I3', T.cogs622], ['J3', T.cogs627], ['K3', T.cogsA], ['L3', T.closeQ], ['M3', T.closeA], ['N3', T.eligQ], ['O3', T.layers], ['R3', T.rwQ], ['S3', T.rwRM], ['T3', T.rw622], ['U3', T.rw627], ['V3', T.rwTot]].forEach(([a, v]) => expect('sum ' + a, v, cell(smG, a), 0.01));
// reconciliation rows 4-16
for (let r = 4; r <= 16; r++) { const x = recG[r - 1]; const o = res.rec[r]; expect(`rec ${r} B`, o.expected, x[1] ?? '', 0.01); expect(`rec ${r} C`, o.result, x[2] ?? '', 0.01); expect(`rec ${r} E`, o.status, x[4]); expect(`rec ${r} F`, o.note, x[5] ?? ''); }
expect('rec I12', res.runResult, cell(recG, 'I12')); expect('rec I11', res.overridesUsed, cell(recG, 'I11'), 0); expect('rec I8', res.openLayers, cell(recG, 'I8'), 0);
// rework
const rfG = G('05_FG_REWORK_FIFO'); let nR = 0; for (let r = 7; r < rfG.length && rfG[r] && ttxt(rfG[r][2]); r++) nR++;
expect('rwf rows', res.rework.rows.length, nR, 0);
cmpRows('rwf', res.rework.rows, rfG, F5.RWF_FIELDS, 7);
for (let r = 64; r <= 69; r++) { const x = recG[r - 1]; const o = res.rework.batch8[r - 64]; expect(`b8 ${r} B`, o.expected, x[1], 0.01); expect(`b8 ${r} C`, o.result, x[2], 0.01); expect(`b8 ${r} E`, o.status, x[4]); }
expect('b8 gate', res.rework.gate8, cell(recG, 'E70'));
const ctlG = G('05_FG_REWORK_CONTROL');
res.rework.control.forEach((c, i) => { const x = ctlG[5 + i]; expect(`rwctl ${c.label} B`, c.value, x[1], 0.01); expect(`rwctl ${c.label} D`, c.status, x[3]); });
const riG = G('03_FG_REWORK_INPUT');
register.rows.forEach((r, i) => { const x = riG[8 + i] || []; for (const [f, c] of [['fifoStatus', 25], ['fifoQty', 26], ['fifoCost', 27], ['closingWIP', 28], ['carryIn', 29]]) expect(`reg r${9 + i} ${f}`, r[f] ?? '', x[c] ?? '', 0.01); });
expect('carry unchanged', F5.carryTotal(register), carryBefore, 0.5);
// rollforward
const xG = G('05_FG_ROLLFORWARD'); const prevItems = [];
for (let r = 4; r < xG.length; r++) { const x = xG[r] || []; if (ttxt(x[0])) prevItems.push({ code: x[0], name: x[1], unit: x[2] }); }
const rf = F5.buildRollforward(res, opening, prevItems);
expect('xnt rows', rf.rows.length, prevItems.length, 0);
cmpRows('xnt', rf.rows, xG, F5.XNT_FIELDS, 4);
// history
const hG = G('05_FG_HISTORY'); const prevHist = [];
for (let r = 5; r < hG.length; r++) { const x = hG[r] || []; if (!ttxt(x[22]) && !ttxt(x[0])) continue; prevHist.push(Object.fromEntries(F5.HIST_FIELDS.map((f, i) => [f, x[i] ?? null]))); }
const hist = F5.buildHistory(res, prevHist, { period: PERIOD, opening, caRows: fl0.rows });
expect('hist rows', hist.rows.length, cell(hG, 'B3'), 0); expect('hist keep', hist.nKeep, cell(hG, 'D3'), 0); expect('hist cogs', hist.nCOGS, cell(hG, 'F3'), 0); expect('hist close', hist.nClose, cell(hG, 'H3'), 0);
cmpRows('hist', hist.rows, hG, F5.HIST_FIELDS, 5, ['rmSrc']);
const hgate = F5.historyGate(hist, res, PERIOD);
expect('hist gate', hgate.gate, cell(hG, 'AB9'));
// recon 20..60, close gate
const rc = F5.step5Recon({ period: PERIOD, res, freshness: 'CURRENT', hist, histGate: hgate, gl, fl: fl0, s4, gate6: fl0.gate6 });
expect('E17', rc.e17, cell(recG, 'E17')); expect('E18', rc.e18, cell(recG, 'E18'));
for (const r of [20, 21, 22, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 43, 44, 45, 46, 47, 48, 53, 54, 55, 56, 57, 58, 59]) {
  const x = recG[r - 1]; const o = rc.rows[r];
  expect(`rec ${r} E`, o.status, x[4]);
  if (typeof x[2] === 'number') expect(`rec ${r} C`, o.result, x[2], 0.01);
}
expect('E38', rc.closeGate, cell(recG, 'E38')); expect('E49', rc.finalStatus, cell(recG, 'E49')); expect('E60', rc.batch7, cell(recG, 'E60'));
expect('close allowed', F5.closeBlockReason({ period: PERIOD, recon: rc, histGate: hgate, res, register, closed: null }), '');
console.log("totals", JSON.stringify({cogsA: res.totals.cogsA, closeA: res.totals.closeA, rwTot: res.totals.rwTot, led: res.ledger.length, det: res.detail.length, hist: hist.rows.length, close: res.closing.length}));
process.exit(done() ? 1 : 0);
