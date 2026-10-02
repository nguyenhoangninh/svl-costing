// Synthetic control tests (no private fixtures needed) — run in CI on every push / PR.
import { parseUserNumber } from '../src/engine/util.js';
import { validateSaveSales, salesCoverage } from '../src/engine/step4.js';
import { buildFingerprint } from '../src/engine/step3b.js';
import * as F5 from '../src/engine/step5.js';

let n = 0, fail = 0;
const eq = (label, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fail++; console.log(`✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } };
const ser = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;

// ---- F-16 user number parsing
for (const [s, v] of [['26300', 26300], ['1,5', 1.5], ['1.5', 1.5], ['15.506.701.812', 15506701812], ['15,506,701,812', 15506701812], ['1.234.567,89', 1234567.89], ['1,234,567.89', 1234567.89], ['(1.000.000)', -1000000], ['-0,125', -0.125], ['', null]]) eq(`parse ${s}`, parseUserNumber(s).value, v);
for (const s of ['26.300', '1,500', 'abc', '1.2.3', '1,23,4']) eq(`reject ${s}`, parseUserNumber(s).ok, false);

// ---- F-05 sales coverage by mode
const P = '2026-10';
eq('MONTHLY coverage = whole month', salesCoverage('MONTHLY', ser(2026, 10, 5), ser(2026, 10, 10), P), { from: ser(2026, 10, 1), to: ser(2026, 10, 31) });
eq('YTD coverage = 1 Jan → period end', salesCoverage('YTD', ser(2026, 1, 3), ser(2026, 10, 20), P), { from: ser(2026, 1, 1), to: ser(2026, 10, 31) });
const row = (d, inv, prod, qty, usd) => ({ invDate: d, customer: 'C', product: prod, prodName: 'N', fx: 25000, qty, unitPrice: usd / qty, amtUSD: usd, amtVND: usd * 25000, invNo: inv, lineNo: '', tranType: 'NORMAL SALE' });
let db = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 10, 2), 'I1', 'A', 1, 10), row(ser(2026, 10, 5), 'I2', 'A', 2, 20), row(ser(2026, 10, 10), 'I3', 'A', 3, 30)] }, { rows: [] }, P).db;
db = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 10, 5), 'I2', 'A', 2, 20), row(ser(2026, 10, 10), 'I3', 'A', 3, 30)] }, db, P).db;
eq('T-05 removed early-month row disappears', db.rows.map((r) => r.invNo).sort(), ['I2', 'I3']);
db = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 9, 20), 'S1', 'A', 1, 10)] }, db, P).db;
eq('rows outside coverage kept', db.rows.map((r) => r.invNo).sort(), ['I2', 'I3', 'S1']);

// ---- F-04 3B build fingerprint
const inp = [{ code: 'M1', basisQty: -5, basisAmt: 100, option: '' }];
const fp = buildFingerprint(inp, { rows: [] }, { runAt: 'a' }, { runAt: 'b' });
eq('fp stable', buildFingerprint(JSON.parse(JSON.stringify(inp)), { rows: [] }, { runAt: 'a' }, { runAt: 'b' }), fp);
eq('fp changes on basis edit', buildFingerprint([{ ...inp[0], basisAmt: 101 }], { rows: [] }, { runAt: 'a' }, { runAt: 'b' }) !== fp, true);
eq('fp changes on ERP override', buildFingerprint(inp, { rows: [{ code: 'M1', override: 'O' }] }, { runAt: 'a' }, { runAt: 'b' }) !== fp, true);
eq('fp ignores reviewer note', buildFingerprint([{ ...inp[0], note: 'x', reason: 'y' }], { rows: [] }, { runAt: 'a' }, { runAt: 'b' }), fp);

// ---- F-03 duplicate sales lines + FIFO
const P2 = '2026-08';
const opening = { period: P2, status: 'LOADED', rows: [{ period: P2, srcPeriod: '2026-07', lid: 'OP-1', source: 'OPENING', pc: 'PC1', date: ser(2026, 7, 10), mo: 'MO', prod: 'A', name: 'A', loc: '', unit: 'PC', qty: 10, rm: 600, a622: 200, a627: 200, tot: 1000, price: 0, prov: 0, cons: '' }] };
F5.validateOpeningFG(opening, P2);
eq('opening validated', opening.status, 'VALIDATED');
const sales = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 5), 'X1', 'A', 2, 20), row(ser(2026, 8, 5), 'X1', 'A', 2, 20), row(ser(2026, 8, 6), 'X2', 'A', 1, 10)] }, { rows: [] }, P2).db.rows;
const groups = F5.duplicateGroups(sales, P2);
eq('one duplicate group of 2', groups.map((g) => g.length), [2]);
const ca = [{ pc: 'PC2', date: ser(2026, 8, 1), prod: 'A', name: 'A', qty: 5, totalRM: 300, t622: 100, t627: 100, totalCost: 500, statusText: '' }];
const ctx = (dec) => ({ period: P2, opening, caRows: ca, salesRows: sales, pmRows: [], fx: 25000, overrides: {}, dupDecisions: dec, mode: 'MONTHLY', tol: 1, step4: { current: 'CURRENT', overall: 'PASS', finalCost: 500, qty: 5 } });
const keep = F5.runFIFO(ctx({}));
eq('KEEP: all 5 units sold, COGS 500', [keep.totals.cogsQ, Math.round(keep.totals.cogsA)], [5, 500]);
const ex = F5.runFIFO(ctx({ [groups[0][1].key]: 'EXCLUDE' }));
eq('EXCLUDE: duplicate not consumed', [ex.totals.cogsQ, Math.round(ex.totals.cogsA)], [3, 300]);
eq('EXCLUDE: line marked NO COGS', ex.sales.find((s) => s.key === groups[0][1].key).fin, 'NO COGS');
eq('FIFO oldest layer first', Math.round(keep.ledger.find((l) => l.lid === 'OP-1').remQ), 5);
eq('roll-forward qty', keep.rec[8].status, 'PASS');

// ---- STEP 4 must be CURRENT to run FIFO
let threw = '';
try { F5.runFIFO({ ...ctx({}), step4: { current: 'OUTDATED - RERUN REQUIRED', overall: 'PASS' } }); } catch (e) { threw = e.message; }
eq('FIFO refuses stale STEP 4', threw.includes('CURRENT'), true);

// ---- Trace: PC-M rows are tied to lots by ERP + PC No. (as STEP 3), whatever Sub-MO / Product Code PC-M carries
import * as TR from '../src/engine/trace.js';
{
  const H = ['PC No.', 'MO No.', 'Sub-MO', 'Product Code', 'Material Code', 'Material Name', 'Quantity', 'Total Cost'];
  const ds = (rows) => ({ 'PC-M-O': { header: H, rows } });
  const fl = { rows: [
    { erp: 'O', pc: 'PC-1', mo: 'MO-1', sub: 'MO-1-001', prod: 'A', qty: 10, pcRM: 1000, totalCost: 1500, totalRM: 1000 },
    { erp: 'O', pc: 'PC-2', mo: 'MO-1', sub: 'MO-1-001', prod: 'A', qty: 10, pcRM: 800, totalCost: 1300, totalRM: 800 },
    { erp: 'O', pc: 'PC-3', mo: 'MO-2', sub: 'MO-2-001', prod: 'A', qty: 5, pcRM: 300, totalCost: 400, totalRM: 300 },
    { erp: 'O', pc: 'PC-3', mo: 'MO-2', sub: 'MO-2-002', prod: 'B', qty: 5, pcRM: 200, totalCost: 300, totalRM: 200 } ] };
  const run = (rows) => TR.costTrace({ prod: 'A', fl, index: TR.buildIndex(ds(rows)) });
  const pcRev = (t) => t.anomalies.filter((a) => a.area === 'Báo cáo PC' && a.level === 'REVIEW').length;
  // PC-M: Sub-MO blank, Product Code blank on PC-1, different code on PC-2 → still tied by PC No.
  let t = run([['PC-1', 'MO-1', '', '', 'M1', 'x', 5, 600], ['PC-1', 'MO-1', '', '', 'M2', 'y', 1, 400], ['PC-2', 'MO-1', '', 'A ', 'M1', 'x', 4, 800],
    ['PC-3', 'MO-2', 'MO-2-001', 'A', 'M1', 'x', 2, 300], ['PC-3', 'MO-2', 'MO-2-002', 'B', 'M1', 'x', 2, 200]]);
  eq('trace: PC-M sums per lot', t.lots.map((l) => l.pcmSum), [1000, 800, 300]);
  eq('trace: no false PC-P ≠ PC-M', pcRev(t), 0);
  eq('trace: loose match reported once (INFO)', t.anomalies.filter((a) => a.level === 'INFO' && /ghép theo PC No/.test(a.msg)).length, 1);
  eq('trace: material totals from tied rows', t.materials.map((m) => [m.mat, m.amt]), [['M1', 1700], ['M2', 400]]);
  // real difference still flagged
  t = run([['PC-1', 'MO-1', 'MO-1-001', 'A', 'M1', 'x', 5, 900], ['PC-2', 'MO-1', 'MO-1-001', 'A', 'M1', 'x', 4, 800], ['PC-3', 'MO-2', 'MO-2-001', 'A', 'M1', 'x', 2, 300]]);
  eq('trace: genuine difference flagged', t.lots.map((l) => Math.round(l.pcmDiff)), [100, 0, 0]);
  eq('trace: one REVIEW for genuine difference', pcRev(t), 1);
  // PC-M dataset absent → one dataset-level message, not one per lot
  t = TR.costTrace({ prod: 'A', fl, index: TR.buildIndex({}) });
  eq('trace: missing PC-M reported once', pcRev(t), 1);
  // drill-down: lot missing a material that the other lots use → "KHÔNG CÓ trong lô"; material view per lot
  {
    const fl2 = { rows: [1, 2, 3, 4].map((i) => ({ erp: 'O', pc: 'PC-' + i, mo: 'MO-9', sub: 'S', prod: 'A', qty: 10, pcRM: i < 4 ? 300 : 100, totalCost: i < 4 ? 400 : 200, totalRM: i < 4 ? 300 : 100 })) };
    const rows = []; for (const i of [1, 2, 3, 4]) { rows.push(['PC-' + i, 'MO-9', 'S', 'A', 'M1', 'x', 10, 100]); if (i < 4) rows.push(['PC-' + i, 'MO-9', 'S', 'A', 'M2', 'y', i === 3 ? 30 : 20, 200]); }
    const t2 = TR.costTrace({ prod: 'A', fl: fl2, index: TR.buildIndex(ds(rows)) });
    const d = TR.anomalyDetail({ kind: 'lot', lk: t2.lots[3].key }, t2, null);
    eq('detail lot: missing material', d.tables[0].rows.map((r) => [r.mat, r.status]), [['M2', 'KHÔNG CÓ trong lô'], ['M1', 'OK']]);
    eq('detail lot: expected value of missing material', Math.round(d.tables[0].rows[0].expAmt), Math.round(20 * (600 / 70)));
    eq('detail lot: own PC-M lines', d.tables[2].rows.length, 1);
    const m = TR.anomalyDetail({ kind: 'mat', mat: 'M2' }, t2, null);
    eq('detail mat: per-lot usage deviation', m.tables[0].rows.map((r) => Math.round(r.useDev * 100)), [0, 0, 50]);
    eq('detail: unknown kind → null', TR.anomalyDetail({ kind: 'x' }, t2, null), null);
  }
}

// ---- PWA: every module the app can load is precached by the service worker (offline start)
import fs from 'node:fs';
import path from 'node:path';
const swText = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const pre = new Set([...swText.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const root = new URL('..', import.meta.url).pathname;
for (const f of [...walk(path.join(root, 'src')), ...walk(path.join(root, 'lib')).filter((x) => x.endsWith('.mjs')), ...walk(path.join(root, 'icons')).filter((x) => x.endsWith('.png'))]) eq(`precached ${path.relative(root, f)}`, pre.has(path.relative(root, f)), true);
const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const ic of man.icons) eq(`manifest icon ${ic.src} exists`, fs.existsSync(path.join(root, ic.src)), true);

console.log(`\n${n - fail}/${n} unit checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
