// Shared loader for regression tests: workbook grids + Step 1-3 engine run on ERP fixtures.
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { sheetToGrid } from '../src/engine/grid.js';
import { buildDataset, planImport } from '../src/engine/step1.js';
import { runStep2, buildReworkRegister, RW_FIELDS } from '../src/engine/step2.js';
import { validateOpening, runStep3 } from '../src/engine/step3.js';
import { txt, num } from '../src/engine/util.js';

export const PERIOD = '2026-08';

export function loadWorkbook(wbPath) {
  const wb = XLSX.read(fs.readFileSync(wbPath), { type: 'buffer', cellDates: false, cellFormula: false, cellHTML: false, cellStyles: false });
  const cache = {};
  const G = (n) => (cache[n] ||= sheetToGrid(XLSX, wb.Sheets[n]));
  const cell = (g, a1) => { const { r, c } = XLSX.utils.decode_cell(a1); return (g[r] || [])[c]; };
  return { wb, G, cell, XLSX };
}

export function loadDatasets(fixDir) {
  const files = fs.readdirSync(fixDir).filter((f) => f.endsWith('.xlsx')).map((f) => ({ name: f, lastModified: fs.statSync(path.join(fixDir, f)).mtimeMs }));
  const plan = planImport(files, PERIOD);
  if (plan.error) throw new Error(plan.error);
  const datasets = {};
  for (const [k, f] of Object.entries(plan.slots)) {
    const w = XLSX.read(fs.readFileSync(path.join(fixDir, f.name)), { type: 'buffer' });
    datasets[k] = buildDataset(sheetToGrid(XLSX, w.Sheets[w.SheetNames[0]]), f.name, PERIOD);
  }
  return datasets;
}

export function runBase({ G, cell }, datasets) {
  const s2 = runStep2(datasets, PERIOD);
  const ri = G('03_FG_REWORK_INPUT');
  const oldRows = [];
  for (let r = 8; r < ri.length && ri[r] && ri[r][2]; r++) oldRows.push(Object.fromEntries(RW_FIELDS.map((f, i) => [f, ri[r][i]])));
  const register = buildReworkRegister(datasets, PERIOD, oldRows, []);
  const wo = G('WIP_OPENING');
  const opening = { period: txt(cell(wo, 'B2')), source: txt(cell(wo, 'H2')), rows: [] };
  for (let r = 5; r < wo.length; r++) { const x = wo[r] || []; if (x[0] === null && x[1] === null && x[3] === null) continue; opening.rows.push({ code: x[0], name: x[1], unit: x[2], qty: x[3], amt: x[4], source: x[5], note: x[6] }); }
  validateOpening(opening, datasets, PERIOD);
  const s3 = runStep3(datasets, opening, s2, PERIOD, '');
  return { s2, s3, register, opening, oldRegister: oldRows };
}

export function checker() {
  let fails = 0, checks = 0;
  const close = (a, b, tol) => Math.abs(num(a) - num(b)) <= tol;
  function expect(label, got, want, tol = 0.01) {
    checks++;
    const numeric = typeof want === 'number' || typeof got === 'number';
    const ok = numeric ? close(got, want, tol) && !(typeof want === 'number' && typeof got === 'string' && got.trim() !== '' && isNaN(+got)) : txt(got).trim() === txt(want).trim();
    if (!ok) { fails++; if (fails <= (+process.env.MAXFAIL || 60)) console.log(`  ✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
    return ok;
  }
  return { expect, done: () => { console.log(`\n${checks - fails}/${checks} checks passed${fails ? `, ${fails} FAILED` : ''}`); return fails; } };
}
