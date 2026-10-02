// Regression test STEP 3B + STEP 4 vs the Aug-2026 workbook.
// Usage: node test/verify2.mjs <costing.xlsm> <erp-fixture-folder> <sales-fixture.xlsx>
import fs from 'node:fs';
import XLSX from 'xlsx';
import { loadWorkbook, loadDatasets, runBase, checker, PERIOD } from './load.mjs';
import { sheetToGrid } from '../src/engine/grid.js';
import { MAP_FIELDS, deriveInput, runBuild, engineDynamic, applyControl, wipFinal, postedByLot, balancePassCount } from '../src/engine/step3b.js';
import { importSales, validateSaveSales, updatePriceMaster, runStep4, finalLayer, lotCostCheck, SALES_FIELDS } from '../src/engine/step4.js';
import { txt, ttxt, num } from '../src/engine/util.js';

const [, , wbPath, fixDir, salesPath] = process.argv;
console.time('load');
const W = loadWorkbook(wbPath); const { G, cell } = W;
const datasets = loadDatasets(fixDir);
const base = runBase(W, datasets);
console.timeEnd('load');
const { expect, done } = checker();

// ========================= STEP 3B =========================
console.log('STEP 3B');
const mapG = G('03_WIP_ERP_MAP');
const erpMap = { rows: [] };
for (let r = 3; r < mapG.length; r++) { const x = mapG[r] || []; if (!ttxt(x[0])) continue; erpMap.rows.push(Object.fromEntries(MAP_FIELDS.map((f, i) => [f, x[i] ?? '']))); }
const inG = G('03_WIP_DIRECT_ADJ_INPUT');
const input = [];
for (let r = 9; r < inG.length; r++) { const x = inG[r] || []; if (!ttxt(x[1])) continue; input.push({ code: x[1], desc: x[2], basisQty: x[6], basisAmt: x[7], option: x[8], reason: x[9], note: x[10], sourceVersion: x[15], _row: r }); }
const ctG = G('03_WIP_DIRECT_ADJ_CONTROL');
const oldControl = { rows: [] };
for (let r = 9; r < ctG.length; r++) { const x = ctG[r] || []; if (!ttxt(x[2])) continue; oldControl.rows.push({ period: x[1], code: x[2], basisQty: x[5], basisAmt: x[6], method: x[7], decision: x[21], note: x[22], gate: x[23] }); }

const st = { erpMap, input, control: oldControl, reg632: [] };
const b = runBuild({ ...st, basis: 'QTY' }, { step3: base.s3, step2: base.s2, datasets, period: PERIOD });
expect('map rows', b.erpMap.rows.length, erpMap.rows.length, 0);
const inD = deriveInput(input, b.erpMap, base.s3, PERIOD);
inD.forEach((r, i) => {
  const x = inG[input[i]._row];
  expect(`in ${r.key} D erp`, r.erp, x[3]); expect(`in ${r.key} E`, r.erpQty, x[4], 1e-6); expect(`in ${r.key} F`, r.erpAmt, x[5], 1e-4);
  expect(`in ${r.key} L`, r.check, x[11]); expect(`in ${r.key} N`, r.erpSource, x[13]); expect(`in ${r.key} O`, r.rule, x[14]);
});
// engine static
const enG = G('03_WIP_DIRECT_ADJ_ENGINE');
let nEng = 0; for (let r = 4; r < enG.length && enG[r] && ttxt(enG[r][2]); r++) nEng++;
expect('engine rows', b.engine.rows.length, nEng, 0);
expect('engine nUse', b.engine.nUse, cell(enG, 'E2'), 0); expect('engine nNo', b.engine.nNo, cell(enG, 'H2'), 0);
// apply (no adjustment close, same as the workbook run)
const ctrl = b.control;
ctrl.rows.forEach((r) => { if (!r.decision) r.decision = 'REVIEW'; });
const ap = applyControl(ctrl, base.s3, 'Re-checking');
expect('apply mode', ap.mode, 'NO_ADJ');
const eng = engineDynamic(b.engine, inD, ctrl);
eng.forEach((e, i) => {
  const x = enG[4 + i];
  for (const [f, c, tol] of [['key', 2], ['erp', 4], ['pc', 8], ['prod', 9], ['qLot', 11, 1e-6], ['qTot', 12, 1e-6], ['bLot', 13, 1e-4], ['bTot', 14, 0.01], ['share', 15, 1e-12], ['note', 22], ['type', 30]]) expect(`eng r${5 + i} ${f}`, e[f] ?? '', x[c] ?? '', tol ?? 0);
  for (const [f, c, tol] of [['active', 0], ['H', 7], ['Q', 16, 1e-6], ['R', 17, 1e-4], ['V', 21], ['X', 23], ['Y', 24], ['AA', 26, 1e-6], ['AB', 27]]) expect(`eng r${5 + i} ${f}`, e[f] ?? '', x[c] ?? '', tol ?? 0);
});
// detail
const dG = G('03_WIP_DIRECT_ADJ_DETAIL');
let nDet = 0; for (let r = 9; r < dG.length && dG[r] && ttxt(dG[r][1]); r++) nDet++;
expect('detail rows', b.detail.length, nDet, 0);
b.detail.forEach((d, i) => {
  const x = dG[9 + i];
  for (const [f, c, tol] of [['code', 1], ['erp', 3], ['basisQty', 4, 1e-6], ['basisAmt', 5, 1e-4], ['method', 6], ['pc', 7], ['prod', 8], ['share', 14, 1e-12], ['allocQty', 15, 1e-6], ['allocAmt', 16, 1e-4], ['status', 20]]) expect(`det r${10 + i} ${f}`, d[f] ?? '', x[c] ?? '', tol ?? 0);
});
// control
ctrl.rows.forEach((c, i) => {
  const x = ctG[9 + i];
  for (const [f, col, tol] of [['code', 2], ['erp', 4], ['basisQty', 5, 1e-6], ['basisAmt', 6, 1e-4], ['method', 7], ['nDetail', 8, 0], ['share', 9, 1e-9], ['qpc', 10, 1e-6], ['apc', 11, 1e-4], ['dq', 16, 1e-6], ['da', 17, 1e-4], ['status', 20], ['decision', 21], ['gate', 23], ['postCheck', 28]]) expect(`ctl r${10 + i} ${f}`, c[f] ?? '', x[col] ?? '', tol ?? 0);
});
expect('balance pass count', balancePassCount(ctrl, base.s3), 73, 0);
// WIP final layer
const wG = G('03_WIP_ALLOCATION');
const wf = wipFinal(base.s3, ctrl, b.erpMap);
wf.rows.forEach((m, i) => {
  const x = wG[11 + i];
  for (const [f, c, tol] of [['erp', 22], ['adjQty', 25, 1e-6], ['adjAmt', 26, 0.01], ['finalQty', 27, 1e-6], ['finalAmt', 28, 0.001], ['postedPC', 29, 0.01], ['method', 30], ['status', 31]]) expect(`wipF r${12 + i} ${f}`, m[f] ?? '', x[c] ?? '', tol ?? 0);
});
expect('wip AB6 final', wf.finalClosing, cell(wG, 'AB6'), 0.05); expect('wip AF6', wf.bridgeStatus, cell(wG, 'AF6')); expect('wip AF5', wf.gateW4, cell(wG, 'AF5'));

// ========================= STEP 4 =========================
console.log('STEP 4');
const sw = XLSX.read(fs.readFileSync(salesPath), { type: 'buffer' });
const sGrids = Object.fromEntries(sw.SheetNames.map((n) => [n, sheetToGrid(XLSX, sw.Sheets[n])]));
const staging = importSales(sGrids, 'sales.xlsx', 'YTD', PERIOD);
const sd = G('04_SALES_DATA');
let nS = 0; for (let r = 5; r < sd.length && sd[r] && sd[r][0] !== null; r++) nS++;
expect('sales staged', staging.rows.length, nS, 0);
const saved = validateSaveSales(staging, { rows: [] }, PERIOD);
saved.db.rows.forEach((r, i) => {
  const x = sd[5 + i];
  expect(`sales r${6 + i} product`, r.product, x[3]); expect(`sales r${6 + i} type`, r.tranType, x[13]); expect(`sales r${6 + i} include`, r.include, x[14]);
  expect(`sales r${6 + i} valid`, r.validResult, x[15]); expect(`sales r${6 + i} key`, r.txnKey, x[16]); expect(`sales r${6 + i} month`, r.month, x[1], 0);
});
// SO + manual
const soG = G('04_SO_PRICE'); const so = [];
for (let r = 5; r < soG.length; r++) { const x = soG[r] || []; if (!ttxt(x[1]) && !ttxt(x[0])) continue; so.push({ active: x[0], product: x[1], soDate: x[2], soNo: x[3], customer: x[4], qty: x[5], price: x[6], note: x[7], _check: x[8] }); }
const pmG = G('04_PRICE_MASTER'); const manual = [];
for (let r = 5; r < pmG.length; r++) { const x = pmG[r] || []; if (!ttxt(x[10])) continue; manual.push({ product: x[10], price: x[11], effFrom: x[12], effTo: x[13], source: x[14], approvedBy: x[15], updatedAt: x[16] }); }
const pmRes = updatePriceMaster({ salesDB: saved.db, so, manual, step2: base.s2, period: PERIOD });
let nPM = 0; for (let r = 5; r < pmG.length && pmG[r] && ttxt(pmG[r][0]); r++) nPM++;
expect('pm rows', pmRes.pm.rows.length, nPM, 0);
pmRes.pm.rows.forEach((p, i) => {
  const x = pmG[5 + i];
  expect(`pm ${p.product} code`, p.product, x[0]); expect(`pm ${p.product} ref`, p.refPrice, x[1], 1e-9); expect(`pm ${p.product} src`, p.refSource, x[2]);
  expect(`pm ${p.product} refDate`, p.refDetail ?? '', x[3] ?? '', 0); expect(`pm ${p.product} final`, p.finalPrice, x[6], 1e-9); expect(`pm ${p.product} status`, p.status, x[8]);
  const a = pmRes.pm.audit[i];
  expect(`pmA ${p.product} cur`, a.curP, x[19], 1e-9); expect(`pmA ${p.product} latest`, a.latestP, x[20], 1e-9); expect(`pmA ${p.product} ytd`, a.ytdP, x[21], 1e-9);
  expect(`pmA ${p.product} so`, a.soP, x[22], 1e-9); expect(`pmA ${p.product} age`, a.age, x[26], 0); expect(`pmA ${p.product} review`, a.review, x[27]);
});
pmRes.so.forEach((r, i) => expect(`so r${6 + i} check`, r.check, so[i]._check ?? ''));
// GL + direct
const glG = G('04_GL_INPUT');
const gl = { period: txt(cell(glG, 'J5')), fx: cell(glG, 'C4'), gl622: cell(glG, 'C5'), gl627: cell(glG, 'C6') };
const daG = G('04_DIRECT_ADJ'); const directAdj = [];
for (let r = 5; r < daG.length; r++) { const x = daG[r] || []; if (![0, 1, 2, 3, 4, 5].some((c) => ttxt(x[c]))) continue; directAdj.push({ active: x[0], erp: x[1], account: x[2], amount: x[3], pc: x[4], prod: x[5], reason: x[6] }); }
const s4 = runStep4({ period: PERIOD, step2: base.s2, step3: base.s3, pm: pmRes.pm, gl, directAdj });
expect('s4 blocked', s4.blocked, false);
const caG = G('04_COST_ALLOCATION');
let nCA = 0; for (let r = 6; r < caG.length && caG[r] && ttxt(caG[r][1]); r++) nCA++;
expect('ca rows', s4.rows.length, nCA, 0);
const fl = finalLayer(s4, postedByLot(eng), base.register);
const caF = ['erp', 'pc', 'date', 'mo', 'sub', 'prod', 'name', 'loc', 'fam', 'unit', 'qty', 'pcRM', 'so', 'baseRM', 'price', 'priceSrc', 'fx', 'salesUSD', 'salesVND', 'contrib', 'eligible', 'weight', 'd622', 'd627', 'c622', 'c627', 't622', 't627', 'baseCost', 'unitCost', 'rmPct', 'p622', 'p627', 'gpPct', 'statusText', 'wipAdj', 'totalRM', 'totalCost', 'finalUnit', 'wipAdjStatus', 'ohBasis', 'carryIn', 'carryStatus'];
const tolOf = (f) => (['weight', 'rmPct', 'p622', 'p627', 'gpPct'].includes(f) ? 1e-9 : ['c622', 'c627', 't622', 't627'].includes(f) ? 0 : ['unitCost', 'finalUnit', 'price', 'fx', 'qty'].includes(f) ? 1e-6 : 0.01);
fl.rows.forEach((r, i) => { const x = caG[6 + i]; caF.forEach((f, c) => expect(`ca r${7 + i} ${f}`, r[f] ?? '', x[c] ?? '', tolOf(f))); });
const recG = G('04_RECONCILIATION');
s4.recon.rows.slice(0, 13).forEach((r, i) => { const x = recG[3 + i]; expect(`rec r${4 + i} exp`, r.expected, x[1], 1e-6); expect(`rec r${4 + i} res`, r.result, x[2], 1e-6); expect(`rec r${4 + i} status`, r.status, x[4]); });
expect('rec 17 B', fl.step5Row.expected, cell(recG, 'B17'), 0.05); expect('rec 17 C', fl.step5Row.result, cell(recG, 'C17'), 0.05);
expect('rec E18', fl.overall, cell(recG, 'E18')); expect('rec E29', fl.gate6, cell(recG, 'E29')); expect('rec E35', fl.gate6b, cell(recG, 'E35'));
expect('rec I21 final cost', fl.totals.totalCost, cell(recG, 'I21'), 0.05);
// lot cost check
const opG = G('05_FG_OPENING'); const refOp = [];
for (let r = 5; r < opG.length; r++) { const x = opG[r] || []; if (!ttxt(x[2])) continue; refOp.push({ prod: x[7], qty: x[11], rm: x[12] }); }
const clG = G('05_FG_CLOSING'); const clQ = new Map();
for (let r = 5; r < clG.length; r++) { const x = clG[r] || []; if (!ttxt(x[2])) continue; const k = ttxt(x[4]) + '|' + ttxt(x[7]); clQ.set(k, num(clQ.get(k)) + num(x[11])); }
const lc = lotCostCheck(fl.rows, {}, refOp, clQ);
const lcG = G('04_LOT_COST_CHECK');
expect('lot count', lc.count, cell(lcG, 'E5'), 0); expect('lot status', lc.status, cell(lcG, 'E7')); expect('lot abs', lc.abs, cell(lcG, 'H3'), 0.01); expect('lot cl', lc.closingImpact, cell(lcG, 'H4'), 0.01);
lc.rows.forEach((r, i) => { const x = lcG[9 + i]; expect(`lot r${i} pc`, r.pc, x[0]); expect(`lot r${i} med`, r.median, x[7], 1e-6); expect(`lot r${i} imp`, r.impact, x[10], 0.01); expect(`lot r${i} cl`, r.closingQty, x[11], 0); });

process.exit(done() ? 1 : 0);
