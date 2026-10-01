// Regression test: run the JS engine on the Aug-2026 data and compare with the Excel workbook results.
// Usage: node test/verify.mjs <costing.xlsm> <erp-fixture-folder>
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { sheetToGrid } from '../src/engine/grid.js';
import { buildDataset, planImport, step1Status } from '../src/engine/step1.js';
import { runStep2, buildReworkRegister, step2Classification, RW_FIELDS } from '../src/engine/step2.js';
import { validateOpening, runStep3 } from '../src/engine/step3.js';
import { txt, num } from '../src/engine/util.js';

const [, , wbPath, fixDir] = process.argv;
const PERIOD = '2026-08';
let fails = 0, checks = 0;
const close = (a, b, tol) => Math.abs(num(a) - num(b)) <= tol;
function expect(label, got, want, tol = 0.01) {
  checks++;
  const ok = typeof want === 'number' || typeof got === 'number' ? close(got, want, tol) : txt(got) === txt(want);
  if (!ok) { fails++; if (fails < 60) console.log(`  ✗ ${label}: got ${got} want ${want}`); }
  return ok;
}

console.time('load workbook');
const wb = XLSX.read(fs.readFileSync(wbPath), { type: 'buffer', cellDates: false, cellFormula: false, cellHTML: false, cellStyles: false });
console.timeEnd('load workbook');
const G = (n) => sheetToGrid(XLSX, wb.Sheets[n]);
const cell = (g, a1) => { const { r, c } = XLSX.utils.decode_cell(a1); return (g[r] || [])[c]; };

// ---------------- STEP 1 ----------------
console.log('STEP 1 — import fixtures');
const files = fs.readdirSync(fixDir).filter((f) => f.endsWith('.xlsx')).map((f) => ({ name: f, lastModified: fs.statSync(path.join(fixDir, f)).mtimeMs }));
const plan = planImport(files, PERIOD);
if (plan.error) throw new Error(plan.error);
const datasets = {};
for (const [k, f] of Object.entries(plan.slots)) {
  const w = XLSX.read(fs.readFileSync(path.join(fixDir, f.name)), { type: 'buffer' });
  datasets[k] = buildDataset(sheetToGrid(XLSX, w.Sheets[w.SheetNames[0]]), f.name, PERIOD);
}
const s1 = step1Status(Object.fromEntries(Object.entries(datasets).map(([k, d]) => [k, d])));
const cc = G('00_CONTROL_CENTER');
for (let r = 16; r <= 36; r++) {
  const erp = cell(cc, 'D' + r), rpt = cell(cc, 'E' + r);
  const ds = datasets[`${rpt}-${erp}`];
  expect(`step1 rows ${rpt}-${erp}`, ds ? ds.dataRows : -1, cell(cc, 'G' + r), 0);
  expect(`step1 status ${rpt}-${erp}`, ds ? ds.status : '', cell(cc, 'F' + r));
}
expect('step1 overall', s1.overall, 'COMPLETE');

// ---------------- STEP 2 ----------------
console.log('STEP 2 — stock out allocation');
const s2 = runStep2(datasets, PERIOD);
const sa = G('03_STOCK_OUT_ALLOCATION');
['T', 'S', 'O'].forEach((e, i) => {
  const row = s2.summary[i]; const r = 5 + i;
  expect(`s2 ${e} src`, row.src, cell(sa, 'B' + r)); expect(`s2 ${e} alloc`, row.alloc, cell(sa, 'C' + r));
  expect(`s2 ${e} unalloc`, row.unalloc, cell(sa, 'D' + r)); expect(`s2 ${e} status`, row.status, cell(sa, 'F' + r));
});
expect('s2 total', s2.total.src, cell(sa, 'B8')); expect('s2 status', s2.status, cell(sa, 'F8'));
let nDet = 0;
for (let r = 20; cell(sa, 'A' + r) !== null && cell(sa, 'A' + r) !== undefined; r++) nDet++;
expect('s2 detail rows', s2.detail.length, nDet, 0);
s2.detail.forEach((d, i) => {
  const r = 20 + i;
  for (const [ci, colL, tol] of [[0, 'A'], [1, 'B'], [3, 'D', 0], [4, 'E'], [6, 'G'], [8, 'I'], [10, 'K'], [13, 'N'], [14, 'O', 1e-12], [15, 'P', 1e-6], [16, 'Q']]) {
    expect(`s2 detail r${r} ${colL}`, d[ci], cell(sa, colL + r) ?? '', tol ?? 0.01);
  }
});
for (const e of ['T', 'O']) {
  const g = G(`PC-P-${e}`); const h = g[3]; const c0 = h.indexOf('Stock Out from T');
  for (const p of s2.pc.filter((x) => x.erp === e)) {
    const row = g[4 + p.rowIdx];
    expect(`pcp ${e} ${p.pcNo} T`, p.allocT, row[c0], 1e-6); expect(`pcp ${e} ${p.pcNo} S`, p.allocS, row[c0 + 1], 1e-6);
    expect(`pcp ${e} ${p.pcNo} O`, p.allocO, row[c0 + 2], 1e-6); expect(`pcp ${e} ${p.pcNo} RM`, p.rmIncl, row[c0 + 4], 1e-4);
    expect(`pcp ${e} ${p.pcNo} src`, p.src || '-', row[c0 + 5]);
  }
}

// ---------------- 2B register ----------------
console.log('STEP 2B — FG rework register');
const ri = G('03_FG_REWORK_INPUT');
const oldRows = [];
for (let r = 8; r < ri.length && ri[r] && ri[r][2]; r++) oldRows.push(Object.fromEntries(RW_FIELDS.map((f, i) => [f, ri[r][i]])));
const reg = buildReworkRegister(datasets, PERIOD, oldRows, []);
expect('rw rows', reg.rows.length, oldRows.length, 0);
reg.rows.forEach((row, i) => {
  const o = oldRows[i];
  for (const f of ['active', 'rid', 'erp', 'doc', 'srcRow', 'issueDate', 'fg', 'itemType', 'loc', 'uom', 'issueQty', 'erpRef', 'reason', 'jobKey', 'rwType', 'rwStatus', 'outFG', 'inputCheck', 'fifoStatus', 'fifoQty', 'fifoCost', 'closingWIP', 'carryIn']) {
    expect(`rw ${i} ${f}`, row[f] ?? '', o[f] ?? '', 1e-6);
  }
});
const cls = step2Classification(datasets, PERIOD, s2, reg);
expect('cls raw', cls.totalRaw, cell(sa, 'K5')); expect('cls rm', cls.rmEligible, cell(sa, 'K6')); expect('cls fg', cls.fgRef, cell(sa, 'K7'));
expect('cls fgRows', cls.fgRows, cell(sa, 'N5'), 0); expect('cls fgQty', cls.fgQty, cell(sa, 'N6'), 0);
expect('cls check', cls.classCheck, cell(sa, 'N8')); expect('cls gate', cls.gate, cell(sa, 'N9'));

// ---------------- STEP 3 ----------------
console.log('STEP 3A — material WIP');
const wo = G('WIP_OPENING');
const opening = { period: txt(cell(wo, 'B2')), source: txt(cell(wo, 'H2')), rows: [] };
for (let r = 5; r < wo.length; r++) { const x = wo[r] || []; if (x[0] === null && x[1] === null && x[3] === null) continue; opening.rows.push({ code: x[0], name: x[1], unit: x[2], qty: x[3], amt: x[4], source: x[5], note: x[6] }); }
validateOpening(opening, datasets, PERIOD);
expect('opening status', opening.status, cell(wo, 'E2')); expect('opening materials', opening.stats.materials, cell(wo, 'B3'), 0);
expect('opening amt', opening.stats.totalAmt, cell(wo, 'H3'), 0.05); expect('opening missName', opening.stats.missingName, cell(wo, 'E4'), 0);
expect('opening missUnit', opening.stats.missingUnit, cell(wo, 'H4'), 0);
const s3 = runStep3(datasets, opening, s2, PERIOD, '');
const w = G('03_WIP_ALLOCATION');
let nW = 0; for (let r = 11; r < w.length && w[r] && w[r][0] !== null; r++) nW++;
expect('wip rows', s3.rows.length, nW, 0);
const keys = ['code', 'name', 'unit', 'opQty', 'opAmt', 'miQty', 'miAmt', 'soQty', 'soAmt', 'inQty', 'inAmt', 'pcQty', 'pcAmt', 'mrQty', 'mrAmt', 'soOutQty', 'soOutAmt', 'outQty', 'outAmt', 'closingQty', 'closingAmt', 'status'];
s3.rows.forEach((m, i) => { const x = w[11 + i]; keys.forEach((k, c) => expect(`wip r${12 + i} ${k}`, m[k] ?? '', x[c] ?? '', c >= 3 && c <= 20 ? 0.001 : 0)); });
expect('wip A5 opening', s3.summary.opening, cell(w, 'A5'), 0.05); expect('wip E5 in', s3.summary.inAmt, cell(w, 'E5'), 0.05);
expect('wip I5 out', s3.summary.outAmt, cell(w, 'I5'), 0.05); expect('wip O5 closing', s3.summary.closingAmt, cell(w, 'O5'), 0.05);
expect('wip S5 new', s3.summary.newMat, cell(w, 'S5'), 0); expect('wip U5 exc', s3.summary.exceptions, cell(w, 'U5'), 0);
expect('wip F6 MI', s3.summary.miAmt, cell(w, 'F6'), 0.05); expect('wip H6 SO', s3.summary.soAmt, cell(w, 'H6'), 0.05);
expect('wip J6 PC', s3.summary.pcAmt, cell(w, 'J6'), 0.05); expect('wip L6 MR', s3.summary.mrAmt, cell(w, 'L6'), 0.05);
expect('wip C8', s3.checks.wipRecon.status, cell(w, 'C8')); expect('wip G8', s3.checks.soVsStep2.status, cell(w, 'G8'));
expect('wip J8', s3.checks.pcmVsPcp.value, cell(w, 'J8'), 0.01); expect('wip N8', s3.checks.exceptions.value, cell(w, 'N8'), 0);
expect('wip B9 mr lines', s3.checks.mrQty.lines, cell(w, 'B9'), 0); expect('wip F9 mr cost', s3.checks.mrQty.cost, cell(w, 'F9'), 0.01);

console.log(`\n${checks - fails}/${checks} checks passed${fails ? `, ${fails} FAILED` : ''}`);
process.exit(fails ? 1 : 0);
