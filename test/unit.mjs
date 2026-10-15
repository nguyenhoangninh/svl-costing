// Synthetic control tests (no private fixtures needed) — run in CI on every push / PR.
import { parseUserNumber, cellDateSerial, num } from '../src/engine/util.js';
import { validateSaveSales, salesCoverage, runStep4, rmBridgeCheck } from '../src/engine/step4.js';
import { buildFingerprint, runBuild, setDecision, applyControl } from '../src/engine/step3b.js';
import * as F5 from '../src/engine/step5.js';
import { recheckRegisterRow } from '../src/engine/step2.js';
import { splitBooks, bookOf } from '../src/engine/revenue.js';
import * as FP from '../src/engine/fgprod.js';
import * as AQ from '../src/engine/auditqueue.js';
import * as SP from '../src/engine/syncpolicy.js';

let n = 0, fail = 0;
const eq = (label, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fail++; console.log(`✗ ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } };
const ser = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;

// ---- F-16 user number parsing
for (const [s, v] of [['26300', 26300], ['1,5', 1.5], ['1.5', 1.5], ['15.506.701.812', 15506701812], ['15,506,701,812', 15506701812], ['1.234.567,89', 1234567.89], ['1,234,567.89', 1234567.89], ['(1.000.000)', -1000000], ['-0,125', -0.125], ['', null]]) eq(`parse ${s}`, parseUserNumber(s).value, v);
for (const s of ['26.300', '1,500', 'abc', '1.2.3', '1,23,4']) eq(`reject ${s}`, parseUserNumber(s).ok, false);
eq('date valid leap day', cellDateSerial('2028-02-29') !== null, true);
eq('date rejects non-leap 29/02', cellDateSerial('2027-02-29'), null);
eq('date rejects 31/04', cellDateSerial('31/04/2026'), null);

// ---- F-05 sales coverage by mode
const P = '2026-10';
eq('MONTHLY coverage = whole month', salesCoverage('MONTHLY', ser(2026, 10, 5), ser(2026, 10, 10), P), { from: ser(2026, 10, 1), to: ser(2026, 10, 31) });
eq('YTD coverage = 1 Jan → period end', salesCoverage('YTD', ser(2026, 1, 3), ser(2026, 10, 20), P), { from: ser(2026, 1, 1), to: ser(2026, 10, 31) });
const row = (d, inv, prod, qty, usd) => ({ invDate: d, customer: 'C', product: prod, prodName: 'N', fx: 25000, qty, unitPrice: usd / qty, amtUSD: usd, amtVND: usd * 25000, invNo: inv, lineNo: '', tranType: 'NORMAL SALE' });
let db = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 10, 2), 'I1', 'A', 1, 10), row(ser(2026, 10, 5), 'I2', 'A', 2, 20), row(ser(2026, 10, 10), 'I3', 'A', 3, 30)] }, { rows: [] }, P).db;
db = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 10, 5), 'I2', 'A', 2, 20), row(ser(2026, 10, 10), 'I3', 'A', 3, 30)] }, db, P).db;
eq('T-05 removed early-month row disappears', db.rows.map((r) => r.invNo).sort(), ['I2', 'I3']);
let priorMonthErr = '';
try { validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 9, 20), 'S1', 'A', 1, 10)] }, db, P); } catch (e) { priorMonthErr = e.message; }
eq('MONTHLY source from prior period is blocked', priorMonthErr.includes('BLOCK'), true);

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

// ---- Audit 2026-10 group A
import { directKey, postedKey, directApprovalBlock } from '../src/views/phase2.js';
import { flKey, engineBalances, nrvKey } from '../src/views/phase3.js';
import { updatePriceMaster } from '../src/engine/step4.js';
import { refreshErpMap } from '../src/engine/step3b.js';
import { buildDataset } from '../src/engine/step1.js';
import { step1Controls, step2Controls, step3Controls, outOfPeriodRows, fallbackAlloc } from '../src/engine/controls.js';
import { fp as fpStr } from '../src/engine/util.js';
{
  // F-02: moving a direct 622 amount to another PC with the same total changes the key
  const dA = [{ active: 'Y', erp: 'O', account: 622, pc: 'PC-1', prod: 'A', amount: 100 }, { active: 'Y', erp: 'O', account: 627, pc: 'PC-2', prod: 'B', amount: 50 }];
  const dB = [{ ...dA[0], pc: 'PC-2', prod: 'B' }, dA[1]];
  eq('F-02 direct key: same rows any order', directKey([dA[1], dA[0]]), directKey(dA));
  eq('F-02 direct key: PC moved → changes', directKey(dB) !== directKey(dA), true);
  eq('F-02 direct key: inactive row ignored', directKey([...dA, { ...dA[0], active: 'N', pc: 'PC-9' }]), directKey(dA));
  const dState = { d: { directAdj: dA, directApproval: { key: directKey(dA), by: 'checker' } } };
  eq('F-02 current direct approval passes', directApprovalBlock(dState), '');
  dState.d.directAdj = dB;
  eq('F-02 direct approval lapses when allocation changes', directApprovalBlock(dState).includes('chưa được duyệt'), true);
  eq('F-02 posted 3B key: amount moved → changes', postedKey(new Map([['O|PC-1|A', { amt: 10 }], ['O|PC-2|B', { amt: 0 }]])) !== postedKey(new Map([['O|PC-1|A', { amt: 0 }], ['O|PC-2|B', { amt: 10 }]])), true);
  // F-03: same total, cost moved between lots → STEP 5 key changes
  const L = (a, b) => ({ rows: [{ erp: 'O', pc: 'PC-1', prod: 'A', qty: 1, totalRM: a, t622: 0, t627: 0, totalCost: a }, { erp: 'O', pc: 'PC-2', prod: 'B', qty: 1, totalRM: b, t622: 0, t627: 0, totalCost: b }] });
  eq('F-03 lot key: redistribution with same total → changes', flKey(L(60, 40)) !== flKey(L(40, 60)), true);
  eq('F-03 lot key: identical → same', flKey(L(60, 40)), flKey(L(60, 40)));
  eq('fp deterministic', fpStr('abc'), fpStr('abc'));
  // F-05 v1.9: invalid/blank recognition dates are blocked before they can enter Sales DB
  let undErr = '';
  try { validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 7), 'U1', 'A', 1, 10), { ...row(null, 'U2', 'A', 1, 10), invDate: '' }] }, { rows: sales }, P2); } catch (e) { undErr = e.message; }
  eq('F-05 undated sales blocked at save', undErr.includes('BLOCK'), true);
  let billErr = '';
  try { validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 7), 'UB', 'A', 1, 10), billDate: '31/02/2026' }] }, { rows: [] }, P2); } catch (e) { billErr = e.message; }
  eq('F-05 supplied invalid Bill Date never falls back', billErr.includes('BLOCK'), true);
  const futureBill = validateSaveSales({ mode: 'YTD', rows: [{ ...row(ser(2026, 8, 7), 'UF', 'A', 1, 10), billDate: ser(2026, 9, 1) }] }, { rows: [] }, P2);
  eq('F-05 future Bill Date kept (REVIEW) and not costed this period', [futureBill.db.rows[0].validResult, F5.runFIFO({ ...ctx({}), salesRows: futureBill.db.rows }).sales.some((x) => x.inv === 'UF')], ['REVIEW', false]);
  eq('F-05 STEP5 canonical date never falls back from invalid supplied Bill Date', F5.saleDate({ invDate: ser(2026, 8, 7), billDate: '31/02/2026' }), null);
  // F-23: validation REVIEW of a costed line is counted
  const rv = validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 8), 'V1', 'A', 1, 10), customer: '' }] }, { rows: [] }, P2);
  eq('F-23 advisory counted', F5.runFIFO({ ...ctx({}), salesRows: rv.db.rows }).stats.advisory, 1);
  // F-15 / F-21 v1.9: future SO price and overlapping manual prices are hard price-policy blocks
  const s2pc = { pc: [{ erp: 'O', pcNo: 'PC-1', prod: 'A', rowIdx: 1 }, { erp: 'O', pcNo: 'PC-2', prod: 'B', rowIdx: 2 }] };
  const pmR = updatePriceMaster({ salesDB: { rows: [{ ...row(ser(2026, 8, 3), 'Z', 'C', 1, 5), include: 'Y' }], savedAt: 'x' }, so: [{ product: 'A', price: 9, soDate: ser(2026, 9, 15), active: 'Y' }],
    manual: [{ product: 'B', price: 4, effFrom: null, effTo: null }, { product: 'B', price: 5, effFrom: null, effTo: null }], step2: s2pc, period: P2 });
  eq('F-15 SO after period → BLOCK', pmR.pm.audit.find((a) => a.product === 'A').review, 'BLOCK - SO AFTER PERIOD');
  eq('F-21 manual overlap → BLOCK', pmR.pm.audit.find((a) => a.product === 'B').review.startsWith('BLOCK - MANUAL OVERLAP'), true);
  eq('F-21 overlap does not silently choose last row', pmR.pm.rows.find((r) => r.product === 'B').finalPrice, null);
  eq('F-15/F-21 Price Master overall blocked', pmR.pm.status, 'BLOCKED - PRICE POLICY');
  const pmA = updatePriceMaster({ salesDB: { rows: [{ ...row(ser(2026, 8, 3), 'ZA', 'B', 1, 5), include: 'Y' }], savedAt: 'x' }, so: [], manual: [{ product: 'B', price: 6, source: 'Approved quote', approvedBy: 'controller', effFrom: null, effTo: null }], step2: { pc: [{ erp: 'O', pcNo: 'PC-2', prod: 'B', rowIdx: 2 }] }, period: P2 });
  eq('F-21 approved single manual price can become final', [pmA.pm.status, pmA.pm.rows[0].finalPrice], ['CURRENT', 6]);
  const pmBadDate = updatePriceMaster({ salesDB: { rows: [{ ...row(ser(2026, 8, 3), 'ZB', 'B', 1, 5), include: 'Y' }], savedAt: 'x' }, so: [], manual: [{ product: 'B', price: 6, source: 'Quote', approvedBy: 'controller', effFrom: '31/02/2026' }], step2: { pc: [{ erp: 'O', pcNo: 'PC-2', prod: 'B', rowIdx: 2 }] }, period: P2 });
  eq('F-21 invalid manual effective date blocks Price Master', [pmBadDate.pm.status, pmBadDate.pm.rows[0].status], ['BLOCKED - PRICE POLICY', 'BLOCK - MANUAL INVALID DATE']);
  // F-13: existing map row whose movement moved to another ERP is flagged, not overwritten
  const H = ['Material Code', 'Quantity'];
  const map0 = { rows: [{ code: 'M1', erp: 'T', review: 'OK', b2Review: 'OK', override: '' }] };
  const rf = refreshErpMap(map0, { rows: [{ code: 'M1', closingQty: -1, closingAmt: -5 }] }, { 'MI-M-O': { header: H, rows: [['M1', 1]] } }, P2);
  eq('F-13 ERP change flagged', [rf.nChanged, rf.map.rows[0].erp, rf.map.rows[0].review.startsWith('REVIEW - ERP CHANGED')], [1, 'T', true]);
  // F-24: NO-DATA file with numbers is refused
  const grid = [['PC No.', 'Product Code', 'Current Complete Qty', 'Total Cost'], ['PC-1', 'A', 5, 100]];
  let e24 = ''; try { buildDataset(grid, 'PC-P-O-202608-NO DATA.xlsx', P2); } catch (e) { e24 = e.message; }
  eq('F-24 NO DATA with rows refused', e24.includes('NO DATA'), true);
  eq('F-24 empty NO DATA ok', buildDataset([grid[0]], 'PC-P-O-202608-NO DATA.xlsx', P2).status, 'NO DATA');
  // F-10 v1.9: outside-period, blank and invalid ERP transaction dates all block
  const dsD = { 'MI-M-O': { header: ['Date', 'Material Code', 'Total Cost'], rows: [[ser(2026, 8, 2), 'M', 5], [ser(2026, 7, 30), 'M', 7], [null, 'MB', 12], ['31/02/2026', 'M2', 8], [null, '', 999]] } };
  const di = outOfPeriodRows(dsD, P2);
  eq('F-10 ERP date issues classified; footer ignored', di.map((x) => [x.key, x.n, x.outside, x.blank, x.invalid, x.amt, x.months.join()]), [['MI-M-O', 3, 1, 1, 1, 27, '2026-07']]);
  const s1Stub = { checklist: Array.from({ length: 21 }, () => ({ status: 'IMPORTED', dataRows: 1 })), bySys: { T: { status: 'READY' }, S: { status: 'READY' }, O: { status: 'READY' } } };
  eq('F-10 STEP 1 blocks ERP date integrity', step1Controls(s1Stub, 0, di).result, 'BLOCK - ERP DATE CONTROL');
  // F-12: broad fallback amount visible in STEP 2 controls
  const s2 = { period: P2, runAt: 'z', status: 'PASS', total: { src: 100, alloc: 100, unalloc: 0 }, detail: [['O', 'X', '', 1, 100, '', 'O', 'ALL', 'PC-1', '', '', '', '', 1, 1, 100, 'ALLOCATED', 'O fallback ALL.']] };
  eq('F-12 fallback amount', fallbackAlloc(s2), 100);
  eq('F-12 fallback > 5% → BLOCK until approval', step2Controls({ period: P2, step2: s2, register: null, latestImport: '' }).rows.find((r) => r.no === '11').status, 'BLOCK - APPROVAL');
  s2.fallbackApproval = { amount: 100, totalAlloc: 100, by: 'reviewer', reason: 'Reviewed source allocation' };
  eq('F-12 approved material fallback → REVIEW', step2Controls({ period: P2, step2: s2, register: null, latestImport: '' }).rows.find((r) => r.no === '11').status, 'REVIEW - APPROVED');
  // F-22: ERP S memo rows
  const s3c = step3Controls({ period: P2, opening: { status: 'READY', period: P2, stats: { totalAmt: 0 } }, step3: { period: P2, runAt: 'z', summary: { opening: 0, inAmt: 0, outAmt: 0, closingAmt: 0 }, checks: { soVsStep2: { value: 0, status: 'PASS' }, pcmVsPcp: { value: 0, status: 'PASS' }, exceptions: { value: 0 } } }, step2: { runAt: 'a' },
    datasets: { 'MI-M-S': { header: ['Total Cost'], rows: [[30]] }, 'PC-M-S': { header: ['Total Cost'], rows: [[20]] } } });
  eq('F-22 S memo', s3c.rows.filter((r) => r.no === '11' || r.no === '12').map((r) => [r.actual, r.status]), [[30, 'INFO'], [20, 'INFO']]);
}

// ---- Owner decisions 02/10/2026
import { rebuildEngine } from '../src/engine/step3b.js';
{
  // #4 3B ACTUAL_USAGE by amount: qty 80/20 but amount 40/60 → 40/60
  const H = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Quantity', 'Total Cost'];
  const s2 = { period: P2, pc: [{ erp: 'O', pcNo: 'PC-1', prod: 'A', name: 'A', rmIncl: 100, rowIdx: 1 }, { erp: 'O', pcNo: 'PC-2', prod: 'B', name: 'B', rmIncl: 100, rowIdx: 2 }] };
  const dsx = { 'PC-M-O': { header: H, rows: [['PC-1', 'A', 'A', 'M1', 80, 40], ['PC-2', 'B', 'B', 'M1', 20, 60]] } };
  const inp = [{ key: 'M1', erp: 'O', desc: 'm' }];
  eq('#4 amount basis 40/60', rebuildEngine(inp, s2, dsx, P2, 'AMOUNT').rows.map((r) => r.share), [0.4, 0.6]);
  eq('#4 legacy qty basis 80/20', rebuildEngine(inp, s2, dsx, P2, 'QTY').rows.map((r) => r.share), [0.8, 0.2]);
  // #1 STRICT_DATE rework: issue 05/08, production 20/08, no opening → cannot take the later layer
  const op0 = { period: P2, status: 'LOADED', rows: [] }; F5.validateOpeningFG(op0, P2);
  const ca1 = [{ pc: 'PC9', date: ser(2026, 8, 20), prod: 'A', name: 'A', qty: 5, totalRM: 300, t622: 100, t627: 100, totalCost: 500, statusText: '' }];
  const reg = { rows: [{ active: 'Y', rid: 'R1', fg: 'A', issueQty: 2, issueDate: ser(2026, 8, 5), inputCheck: 'PASS', rwStatus: 'OPEN', rwType: 'NORMAL', period: P2 }] };
  const base = { period: P2, opening: op0, caRows: ca1, salesRows: [], pmRows: [], fx: 25000, overrides: {}, dupDecisions: {}, tol: 1, step4: { current: 'CURRENT', overall: 'PASS', finalCost: 500, qty: 5 } };
  const rS = F5.runFIFO({ ...base, mode: 'STRICT_DATE', register: reg }); F5.runReworkFIFO(rS, reg, { period: P2, opening: op0, salesRows: [], step4Carry: 0 });
  eq('#1 STRICT: rework before production → insufficient', [reg.rows[0].fifoStatus, reg.rows[0].fifoQty], ['BLOCK - INSUFFICIENT FG AT ISSUE DATE', 0]);
  const reg2 = { rows: [{ ...reg.rows[0], issueDate: ser(2026, 8, 25) }] };
  const rS2 = F5.runFIFO({ ...base, mode: 'STRICT_DATE', register: reg2 }); F5.runReworkFIFO(rS2, reg2, { period: P2, opening: op0, salesRows: [], step4Carry: 0 });
  eq('#1 STRICT: rework after production takes it', [reg2.rows[0].fifoStatus, Math.round(reg2.rows[0].fifoCost)], ['PASS', 200]);
  eq('#1 STRICT: gate allows rework', F5.reworkGate(reg2, [], P2, 'STRICT_DATE'), '');
  // ---- 5B rework dispositions: pending stays in 154; returned → FG layer; written off → expense; scrap share expensed
  {
    const disp = (extra) => { const rg = { rows: [{ ...reg.rows[0], outFG: 'A', issueDate: ser(2026, 8, 25), ...extra }] }; rg.rows.forEach(recheckRegisterRow); const r = F5.runFIFO({ ...base, mode: 'STRICT_DATE', register: rg }); F5.runReworkFIFO(r, rg, { period: P2, opening: op0, salesRows: [], step4Carry: 0 }); return { r, row: rg.rows[0] }; };
    const open = disp({});
    eq('5B pending: cost parked in 154, not FG / COGS', [Math.round(open.row.closingWIP), Math.round(open.r.totals.cogsA), Math.round(open.r.totals.closeA), open.r.rework.gate8], [200, 0, 300, 'PASS']);
    const back = disp({ rwStatus: 'RETURNED TO FG', dispNote: 'Khách huỷ yêu cầu sửa', compDate: ser(2026, 8, 28) });
    const lay = back.r.closing.find((c) => c.source === 'REWORK RETURN');
    eq('5B returned to FG: new FG layer at the same cost, 154 = 0', [Math.round(back.row.returnedFG), back.row.closingWIP, lay && lay.qty, lay && Math.round(lay.tot), Math.round(back.r.totals.closeA)], [200, 0, 2, 200, 500]);
    eq('5B returned to FG: roll-forward 8 / 9 / 10 and Batch 8 pass', [back.r.rec[8].status, back.r.rec[9].status, back.r.rec[10].status, back.r.rework.gate8], ['PASS', 'PASS', 'PASS', 'PASS']);
    const noNote = disp({ rwStatus: 'WRITTEN OFF' });
    eq('5B write-off without reason stays in 154 (REVIEW)', [noNote.row.inputCheck, Math.round(noNote.row.closingWIP), noNote.row.writeOff], ['REVIEW - NOTE REQUIRED', 200, 0]);
    const wo = disp({ rwStatus: 'WRITTEN OFF', dispNote: 'Không sửa được, huỷ', woAccount: '811' });
    eq('5B written off: expensed to chosen account, out of 154', [Math.round(wo.row.writeOff), wo.row.closingWIP, wo.r.rework.woByAcc, wo.r.rework.gate8], [200, 0, { 811: 200 }, 'PASS']);
    const scrap = disp({ rwStatus: 'COMPLETED', pcNo: 'PC-RW', outFG: 'A', compQty: 1, scrapQty: 1, scrapTreat: 'EXPENSE' });
    eq('5B completed with scrap expensed: half to new lot, half to expense', [Math.round(scrap.row.carryIn), Math.round(scrap.row.writeOff), scrap.row.closingWIP], [100, 100, 0]);
    const absorb = disp({ rwStatus: 'COMPLETED', pcNo: 'PC-RW', outFG: 'A', compQty: 1, scrapQty: 1 });
    eq('5B completed, scrap absorbed (default): all to new lot', [Math.round(absorb.row.carryIn), absorb.row.writeOff], [200, 0]);
    const bfRow = { active: 'B/F', rid: 'RB', fg: 'A', fgName: 'A', bfQty: 3, bfCost: 270, issueDate: ser(2026, 6, 2), rwStatus: 'RETURNED TO FG', rwType: 'NORMAL', dispNote: 'Trả kho', outFG: 'A', originPeriod: '2026-06', period: P2 };
    const rgB = { rows: [recheckRegisterRow({ ...bfRow })] }; const rB = F5.runFIFO({ ...base, mode: 'STRICT_DATE', register: rgB }); F5.runReworkFIFO(rB, rgB, { period: P2, opening: op0, salesRows: [], step4Carry: 0 });
    eq('5B B/F rework returned to FG this month', [Math.round(rgB.rows[0].returnedFG), rB.closing.some((c) => c.source === 'REWORK RETURN' && c.qty === 3), rB.rec[9].status, rB.rework.gate8], [270, true, 'PASS', 'PASS']);
  }
  let monthlyRwErr = ''; try { F5.runFIFO({ ...base, mode: 'MONTHLY', register: reg2 }); } catch (e) { monthlyRwErr = e.message; }
  eq('#1 MONTHLY active rework is blocked by engine', monthlyRwErr.includes('STRICT_DATE'), true);
  const undatedRun = F5.runFIFO({ ...base, caRows: [{ ...ca1[0], date: null }], mode: 'STRICT_DATE', register: { rows: [] }, salesRows: validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 6), 'U9', 'A', 1, 10)] }, { rows: [] }, P2).db.rows });
  eq('#1 STRICT production without completion date runs, flagged (09c)', undatedRun.stats.undatedLayers, 1);
  // sale on 10/08 then rework 15/08 with only the opening layer of 10 units: sale first, rework gets the rest in date order
  const reg3 = { rows: [{ ...reg.rows[0], issueQty: 3, issueDate: ser(2026, 8, 15) }] };
  const sl = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 10), 'S1', 'A', 8, 80)] }, { rows: [] }, P2).db.rows;
  const rS3 = F5.runFIFO({ ...base, opening, salesRows: sl, mode: 'STRICT_DATE', register: reg3 }); F5.runReworkFIFO(rS3, reg3, { period: P2, opening, salesRows: sl, step4Carry: 0 });
  eq('#1 STRICT: sale 8 then rework only 2 left', [Math.round(rS3.totals.cogsQ), reg3.rows[0].fifoQty, reg3.rows[0].fifoStatus], [8, 2, 'BLOCK - INSUFFICIENT FG AT ISSUE DATE']);
  // #5 Bill date drives the period
  const bl = validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 7, 30), 'B1', 'A', 2, 20), billDate: ser(2026, 8, 2) }] }, { rows: [] }, P2).db.rows;
  eq('#5 bill date in period → costed', Math.round(F5.runFIFO({ ...ctx({}), salesRows: bl }).totals.cogsQ), 2);
  eq('#5 revenue by bill date', F5.periodRevenue(bl, P2), 20 * 25000);
  const pmBill = updatePriceMaster({ salesDB: { rows: bl, savedAt: 'x' }, so: [], manual: [], step2: { pc: [{ erp: 'O', pcNo: 'PC-1', prod: 'A', rowIdx: 1 }] }, period: P2 }).pm;
  eq('#5 Price Master uses bill-date recognition month', pmBill.rows.find((x) => x.product === 'A').finalPrice, 10);
  // #6 return at the original sale's COGS (opening layer 100/unit), with Original Invoice No.
  const rt = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 5), 'X1', 'A', 3, 30), { ...row(ser(2026, 8, 20), 'CN1', 'A', -1, -10), tranType: 'SALES RETURN', origInv: 'X1' }] }, { rows: [] }, P2).db.rows;
  const mret = F5.runFIFO({ ...ctx({}), salesRows: rt });
  eq('#6 MONTHLY return booked at original cost', [mret.sales.find((x) => x.inv === 'CN1').status, Math.round(mret.sales.find((x) => x.inv === 'CN1').tot), mret.rec[8].status, mret.rec[9].status], ['RETURNED', -100, 'PASS', 'PASS']);
  const amtOnly = F5.runFIFO({ ...ctx({}), salesRows: validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 20), 'CN0', 'A', 1, -10), qty: null, tranType: 'SALES RETURN' }] }, { rows: [] }, P2).db.rows });
  eq('#6 amount-only credit → NO COGS, not a return', [amtOnly.sales[0].fin, amtOnly.returnControl.total, amtOnly.returnControl.status], ['NO COGS', 0, 'PASS']);
  const noInv = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 4), 'Y1', 'A', 2, 20), row(ser(2026, 8, 6), 'Y2', 'A', 2, 20), { ...row(ser(2026, 8, 20), 'CN5', 'A', -1, -10), tranType: 'SALES RETURN' }] }, { rows: [] }, P2).db.rows;
  const rAuto = F5.runFIFO({ ...ctx({}), salesRows: noInv });
  eq('#6 no original invoice → latest invoice, AUTO (review, not block)', [rAuto.sales.find((x) => x.inv === 'CN5').matchedOrigInv, rAuto.returnControl.status], ['Y2', 'REVIEW']);
  const cn5 = rAuto.sales.find((x) => x.inv === 'CN5').key;
  const rPend = F5.runFIFO({ ...ctx({}), salesRows: noInv, returnMatches: { [cn5]: { unitCost: 150, note: 'pre-web sale', by: 'a@svl' } } });
  eq('#6 manual unit cost NOT approved → BLOCK (v1.14.19 audit P0-02)', [rPend.sales.find((x) => x.inv === 'CN5').status === 'RETURNED', rPend.returnControl.status], [false, 'BLOCK']);
  const rSelf = F5.runFIFO({ ...ctx({}), salesRows: noInv, returnMatches: { [cn5]: { unitCost: 150, note: 'pre-web sale', by: 'a@svl', approvedBy: 'a@svl' } } });
  eq('#6 manual unit cost approved by the same user → still BLOCK', rSelf.returnControl.status, 'BLOCK');
  const rMan = F5.runFIFO({ ...ctx({}), salesRows: noInv, returnMatches: { [cn5]: { unitCost: 150, note: 'pre-web sale', by: 'a@svl', approvedBy: 'b@svl' } } });
  eq('#6 manual unit cost approved by another user', [rMan.sales.find((x) => x.inv === 'CN5').matchMode, Math.round(rMan.sales.find((x) => x.inv === 'CN5').tot), rMan.rec[9].status], ['MANUAL', -150, 'PASS']);
  const rPick = F5.runFIFO({ ...ctx({}), salesRows: noInv, returnMatches: { [cn5]: { origInv: 'Y1', note: 'credit note ref Y1' } } });
  eq('#6 chosen original invoice', [rPick.sales.find((x) => x.inv === 'CN5').matchedOrigInv, rPick.returnControl.status], ['Y1', 'PASS']);
  const rr = F5.runFIFO({ ...ctx({}), salesRows: rt, mode: 'STRICT_DATE' });
  const ln = rr.sales.find((x) => x.inv === 'CN1');
  eq('#6 return restored at original cost', [ln.fin, ln.status, Math.round(ln.tot)], ['RETURN', 'RETURNED', -100]);
  eq('#6 net COGS and roll-forward', [Math.round(rr.totals.cogsQ), Math.round(rr.totals.cogsA), rr.rec[8].status, rr.rec[9].status, rr.rec[10].status, rr.rec[11].status], [2, 200, 'PASS', 'PASS', 'PASS', 'PASS']);
  eq('#6 return layer in closing', rr.closing.some((c) => c.source === 'RETURN' && c.qty === 1), true);
  const rh = F5.buildHistory(rr, [], { period: P2, opening, caRows: ca });
  eq('#6 return reversal included in FG History', rh.rows.some((h) => h.source === 'SALES RETURN REVERSAL' && h.qty === -1 && Math.round(h.tot) === -100), true);
  eq('#6 return → FG History gate PASS', F5.historyGate(rh, rr, P2).gate, 'PASS');
  eq('#6 STEP 5R register processed', [rr.returnControl.status, rr.returnControl.total, rr.returnControl.processed, rr.returnRegister[0].originalInv], ['PASS', 1, 1, 'X1']);
  const rfl = { rows: ca.map((r) => ({ ...r, baseRM: r.totalRM, baseCost: r.totalCost, wipAdj: 0 })), totals: { totalCost: 500, totalRM: 300, wipAdj: 0 }, gate6: 'PASS' };
  const rrec = F5.step5Recon({ period: P2, res: rr, freshness: 'CURRENT', hist: rh, histGate: F5.historyGate(rh, rr, P2), gl: { ytd622: null, ytd627: null }, fl: rfl, s4: { alloc622: 100, alloc627: 100 }, gate6: 'PASS' });
  eq('#6 return → STEP5 reconciliation row 36 PASS', rrec.rows[36].status, 'PASS');
  eq('#6 return → Close Gate can become READY', rrec.closeGate.startsWith('READY'), true);
  const credit = validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 21), 'CR1', 'A', -1, -10), tranType: 'CREDIT NOTE' }] }, { rows: [] }, P2).db.rows;
  const cr = F5.runFIFO({ ...ctx({}), salesRows: credit, mode: 'STRICT_DATE' });
  eq('#6 CREDIT NOTE has no physical FG/COGS movement', [cr.sales[0].fin, cr.stats.returns, cr.totals.cogsQ], ['NO COGS', 0, 0]);
  eq('#6 CREDIT NOTE excluded from selling-price weighting', credit[0].include, 'N');
  const multi = validateSaveSales({ mode: 'MONTHLY', rows: [
    { ...row(ser(2026, 8, 5), 'ML1', 'A', 2, 20), lineNo: '1' },
    { ...row(ser(2026, 8, 5), 'ML1', 'A', 3, 30), lineNo: '2' },
    { ...row(ser(2026, 8, 12), 'ML-CN', 'A', -4, -40), tranType: 'SALES RETURN', origInv: 'ML1' },
  ] }, { rows: [] }, P2).db.rows;
  const mr = F5.runFIFO({ ...ctx({}), salesRows: multi, mode: 'STRICT_DATE' });
  eq('#6 multi-line original invoice aggregates returnable qty', [mr.sales.find((x) => x.inv === 'ML-CN').status, Math.round(mr.totals.cogsQ)], ['RETURNED', 1]);
  const rn = F5.runFIFO({ ...ctx({}), mode: 'STRICT_DATE', salesRows: validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 20), 'CN2', 'A', -1, -10), tranType: 'SALES RETURN', origInv: 'NOPE' }] }, { rows: [] }, P2).db.rows });
  eq('#6 original not found → unresolved (BLOCK in STEP 5R)', [rn.sales[0].status, rn.returnControl.status], ['REVIEW', 'BLOCK']);
  // return becomes an inventory layer at its return date and can feed a later sale in STRICT_DATE
  const rtFlow = validateSaveSales({ mode: 'MONTHLY', rows: [
    row(ser(2026, 8, 5), 'R-ORIG', 'A', 10, 100),
    { ...row(ser(2026, 8, 10), 'R-CN', 'A', -5, -50), tranType: 'SALES RETURN', origInv: 'R-ORIG' },
    row(ser(2026, 8, 20), 'R-NEXT', 'A', 5, 50),
  ] }, { rows: [] }, P2).db.rows;
  const unrelatedCA = [{ pc: 'PC-Z', date: ser(2026, 8, 1), prod: 'Z', name: 'Z', qty: 1, totalRM: 0, t622: 0, t627: 0, totalCost: 0, statusText: '' }];
  const rFlow = F5.runFIFO({ ...ctx({}), salesRows: rtFlow, caRows: unrelatedCA, mode: 'STRICT_DATE', step4: { current: 'CURRENT', overall: 'PASS', finalCost: 0, qty: 1 } });
  const closeA = rFlow.closing.filter((x) => x.prod === 'A').reduce((a, x) => a + x.qty, 0);
  eq('#6 STRICT return layer reused by later sale', [rFlow.sales.find((x) => x.inv === 'R-NEXT').status, Math.round(rFlow.totals.cogsQ), Math.round(closeA)], ['OK', 10, 0]);
  // cumulative returns cannot exceed the original sale
  const rtOver = validateSaveSales({ mode: 'MONTHLY', rows: [
    row(ser(2026, 8, 5), 'R2-ORIG', 'A', 3, 30),
    { ...row(ser(2026, 8, 10), 'R2-CN1', 'A', -2, -20), tranType: 'SALES RETURN', origInv: 'R2-ORIG' },
    { ...row(ser(2026, 8, 11), 'R2-CN2', 'A', -2, -20), tranType: 'SALES RETURN', origInv: 'R2-ORIG' },
  ] }, { rows: [] }, P2).db.rows;
  const rOver = F5.runFIFO({ ...ctx({}), salesRows: rtOver, mode: 'STRICT_DATE' });
  eq('#6 cumulative return above sold qty → unresolved', rOver.sales.find((x) => x.inv === 'R2-CN2').status, 'REVIEW');
  // ---- v1.13 MONTHLY FIFO split by invoice (default) vs workbook pro-rata: same month total, every take tied to an invoice
  {
    const two = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 9), 'M2', 'A', 2, 20), row(ser(2026, 8, 3), 'M1', 'A', 3, 30)] }, { rows: [] }, P2).db.rows;
    const inv = F5.runFIFO({ ...ctx({}), salesRows: two }), pro = F5.runFIFO({ ...ctx({}), salesRows: two, monthlySplit: 'PRORATA' });
    eq('MONTHLY invoice split: month COGS = pro-rata', [Math.round(inv.totals.cogsA), inv.runResult], [Math.round(pro.totals.cogsA), pro.runResult]);
    eq('MONTHLY invoice split: every take has an invoice, earliest invoice first', [inv.detail.every((d) => d.line > 0), inv.detail[0].inv, pro.detail.every((d) => d.line === null)], [true, 'M1', true]);
    eq('MONTHLY invoice split: line COGS = detail', Math.round(inv.sumLineA), Math.round(inv.sumDetA));
  }
  // ---- v1.11 revenue books: sales (511) and returns / credit notes (5212 / 5213) are separate files, databases and runs
  {
    const mixed = () => ({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 5), 'X1', 'A', 3, 30), { ...row(ser(2026, 8, 20), 'CN1', 'A', -1, -10), tranType: 'SALES RETURN', origInv: 'X1' }, { ...row(ser(2026, 8, 21), 'CR1', 'A', 1, -4), qty: null, tranType: 'CREDIT NOTE' }] });
    const sOnly = validateSaveSales(mixed(), { rows: [] }, P2, { book: 'SALES' });
    eq('books: sales file keeps only sales lines, skips returns', [sOnly.db.rows.map((r) => r.invNo), sOnly.stats.skipped], [['X1'], 2]);
    const rOnly = validateSaveSales(mixed(), { rows: [] }, P2, { book: 'RETURNS' });
    eq('books: returns file keeps only SALES RETURN / CREDIT NOTE', [rOnly.db.rows.map((r) => r.invNo), rOnly.stats.skipped], [['CN1', 'CR1'], 1]);
    let noRet = ''; try { validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 5), 'X9', 'A', 1, 10)] }, { rows: [] }, P2, { book: 'RETURNS' }); } catch (e) { noRet = e.message; }
    eq('books: returns file without return lines is refused', noRet.includes('không có dòng SALES RETURN'), true);
    let noSale = ''; try { validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 20), 'CN7', 'A', -1, -10), tranType: 'SALES RETURN', origInv: 'X1' }] }, { rows: [] }, P2, { book: 'SALES' }); } catch (e) { noSale = e.message; }
    eq('books: returns-only file on the sales screen is refused (cannot wipe sales)', noSale.includes('không có dòng doanh thu bán hàng'), true);
    const r2 = validateSaveSales({ mode: 'MONTHLY', rows: [{ ...row(ser(2026, 8, 22), 'CN8', 'A', -1, -10), tranType: 'SALES RETURN', origInv: 'X1' }] }, rOnly.db, P2, { book: 'RETURNS' });
    eq('books: saving returns replaces only the returns database range', r2.db.rows.map((r) => r.invNo), ['CN8']);
    const legacy = splitBooks({ rows: validateSaveSales(mixed(), { rows: [] }, P2).db.rows }, null);
    eq('books: legacy combined Sales DB still read as two books', [legacy.sales.length, legacy.returns.length, legacy.usingLegacy], [1, 2, true]);
    eq('books: once a returns DB exists, legacy return lines are ignored', [splitBooks({ rows: legacy.sales.concat(legacy.returns) }, rOnly.db).ignoredLegacy, splitBooks({ rows: [] }, rOnly.db).returns.length], [2, 2]);
    const rb = F5.revenueBooks(sOnly.db.rows, rOnly.db.rows, P2);
    eq('books: 511 gross, 5212 returns, 5213 price reductions', [rb.a511, rb.a5212, rb.a5213, rb.physical], [30 * 25000, 10 * 25000, 4 * 25000, 1]);
    eq('books: bookOf', [bookOf(rOnly.db.rows[0]), bookOf(rOnly.db.rows[1]), bookOf(sOnly.db.rows[0])], ['5212', '5213', '511']);
    // STEP 5.2 = sales only; STEP 5R = same engine + returns book; sales results unchanged
    for (const mode of ['MONTHLY', 'STRICT_DATE']) {
      const a = F5.runFIFO({ ...ctx({}), mode, salesRows: sOnly.db.rows });
      const b = F5.runFIFO({ ...ctx({}), mode, salesRows: sOnly.db.rows, returnRows: rOnly.db.rows });
      const c = F5.runFIFO({ ...ctx({}), mode, salesRows: validateSaveSales(mixed(), { rows: [] }, P2).db.rows });
      const x1 = (r) => r.sales.find((z) => z.inv === 'X1');
      eq(`books ${mode}: 5.2 has no return lines`, [a.sales.some((z) => z.book === 'RETURNS'), a.returnControl.total], [false, 0]);
      eq(`books ${mode}: sale COGS identical in 5.2 and 5R`, [Math.round(x1(a).tot), x1(a).key], [Math.round(x1(b).tot), x1(b).key]);
      eq(`books ${mode}: 5R books the return at original cost`, [b.sales.find((z) => z.inv === 'CN1').status, Math.round(b.totals.retA), b.returnControl.status, b.sales.find((z) => z.inv === 'CN1').acc], ['RETURNED', 100, 'PASS', '5212']);
      eq(`books ${mode}: separate inputs = legacy combined result`, [Math.round(b.totals.cogsA), Math.round(b.totals.closeA), b.sales.find((z) => z.inv === 'CN1').key], [Math.round(c.totals.cogsA), Math.round(c.totals.closeA), c.sales.find((z) => z.inv === 'CN1').key]);
    }
    const tie0 = F5.fastTie({ a154: 1, a155: 1, a2294: 0, a632: 1, a511: 1, a5212: 0, a5213: 0 }, { fast: { a154: 1, a155: 1, a632: 1, a511: 1 } });
    eq('FAST: 5212 / 5213 blank = 0 when the web has none', [tie0.entered, tie0.status, tie0.rows.map((r) => r.acc)], [true, 'PASS', ['154', '155', '2294', '632', '511', '5212', '5213']]);
    const tie1 = F5.fastTie({ a154: 1, a155: 1, a2294: 0, a632: 1, a511: 1, a5212: 250000, a5213: 0 }, { fast: { a154: 1, a155: 1, a632: 1, a511: 1 } });
    eq('FAST: 5212 must be entered when the web has returns', [tie1.entered, tie1.status], [false, 'NOT ENTERED']);
  }
  // #8 zero-production month: STEP 4 can be zero and STEP 5 sells from Opening FG only
  const zS2 = { status: 'PASS', period: P2, pc: [], total: { alloc: 0 } };
  const zS3 = { period: P2, summary: { outAmt: 0, mrAmt: 0 }, checks: { soVsStep2: { status: 'PASS' }, pcmVsPcp: { status: 'PASS' }, exceptions: { value: 0 } } };
  const zPM = { rows: [{ product: 'A', finalPrice: 10 }], status: 'CURRENT' };
  const zGL = { fx: 25000, gl622: 0, gl627: 0 };
  const z4 = runStep4({ period: P2, step2: zS2, step3: zS3, pm: zPM, gl: zGL, directAdj: [] });
  eq('#8 STEP 4 zero-production valid', [z4.zeroProduction, z4.blocked, z4.rows.length], [true, false, 0]);
  const zSales = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 9), 'ZSALE', 'A', 2, 20)] }, { rows: [] }, P2).db.rows;
  const z5 = F5.runFIFO({ period: P2, opening, caRows: [], salesRows: zSales, pmRows: zPM.rows, fx: 25000, overrides: {}, dupDecisions: {}, mode: 'MONTHLY', tol: 1, step4: { current: 'CURRENT', overall: 'PASS', finalCost: 0, qty: 0 } });
  eq('#8 opening-FG-only FIFO works', [Math.round(z5.totals.prodQ), Math.round(z5.totals.cogsQ), Math.round(z5.totals.closeQ)], [0, 2, 8]);
  // #8b v1.14.33: STEP 4 RM bridge = RM lô PC + Stock Out phân bổ + tiêu hao 632/152 = WIP ra (STEP 3)
  eq('#8b rmBridgeCheck: lô PC + tiêu hao = WIP ra', [rmBridgeCheck(100, 25, 125).ok, rmBridgeCheck(100, 0, 125).ok], [true, false]);
  eq('#8b rmBridgeCheck: diff = phần chưa giải thích', Math.round(rmBridgeCheck(100, 25, 150).diff), -25);
  const cS2 = { status: 'PASS', period: P2, pc: [], total: { alloc: 0, cons: 1000 } };
  const cS3 = { period: P2, summary: { outAmt: 1000, mrAmt: 0 }, checks: { soVsStep2: { status: 'PASS' }, pcmVsPcp: { status: 'PASS' }, exceptions: { value: 0 } } };
  const c4 = runStep4({ period: P2, step2: cS2, step3: cS3, pm: zPM, gl: zGL, directAdj: [] });
  eq('#8b STEP 4 with consumption only passes the bridge', [c4.zeroProduction, c4.blocked, c4.consumedRM], [true, false, 1000]);
  let cBad = '';
  try { runStep4({ period: P2, step2: cS2, step3: { ...cS3, summary: { outAmt: 1500, mrAmt: 0 } }, pm: zPM, gl: zGL, directAdj: [] }); } catch (e) { cBad = e.message; }
  eq('#8b STEP 4 still stops when the bridge is not explained', cBad.startsWith('RM STEP 4 không khớp') && cBad.includes('-500.00'), true);

  // #7 NRV with 1.5 % selling cost: unit cost 100, price 4 USD × 25000 = 100000 → NRV 98500; here cost 100 VND so no provision; force price low
  const nv = F5.runFIFO({ ...ctx({}), pmRows: [{ product: 'A', finalPrice: 0.004 }], sellCostRate: 0.015 }); // price 100 VND, NRV 98.5
  const cl = nv.closing.find((c) => c.prod === 'A');
  eq('#7 NRV provision = (100 − 98.5) × qty', Math.round(cl.provNeed * 100) / 100, Math.round(1.5 * cl.qty * 100) / 100);
  const nk1 = nrvKey(nv), nk2 = nrvKey({ ...nv, closing: nv.closing.map((x) => ({ ...x, price: num(x.price) + 0.001 })) });
  eq('#7 NRV decision key changes when valuation price changes', nk1 !== nk2, true);
  // #3 FAST tie: difference needs approval bound to the figures
  const eng = { a154: 1000, a155: 2000, a2294: 0, a632: 3000, a511: 4000 };
  const t0 = F5.fastTie(eng, null);
  eq('#3 not entered', t0.status, 'NOT ENTERED');
  const tie = { fast: { a154: 1000, a155: 2000, a2294: 0, a632: 2990, a511: 4000 } };
  const t1 = F5.fastTie(eng, tie);
  eq('#3 diff → REVIEW', [t1.status, t1.diffs], ['REVIEW', 1]);
  const t2 = F5.fastTie(eng, { ...tie, approval: { key: t1.key, by: 'x', note: 'ok' } });
  eq('#3 approved', t2.status, 'APPROVED');
  eq('#3 approval lapses when figures change', F5.fastTie({ ...eng, a155: 2001 }, { ...tie, approval: { key: t1.key } }).status, 'REVIEW');
  const eb = engineBalances({ period: P2, d: { step3: { summary: { closingAmt: 1000 } }, register: { rows: [] }, wipadj: { reg632: [{ record: 'RECORDED', impact: 100 }] }, salesDB: { rows: [] } } }, { d3b: { wf: { finalClosing: 1000 } } }, { totals: { closeA: 0, cogsA: 300 } });
  eq('#3 DIRECT_632 changes both 154 and 632', [eb.a154, eb.a632], [900, 400]);
  const fakeRes = { totals: { closeA: 0, cogsA: 300 }, closing: [{ lid: 'L', prod: 'A', qty: 1, tot: 100, price: 1, nrvUnit: 50, prov: 0, provNeed: 40 }] };
  const nk = nrvKey(fakeRes);
  const ebNrv = engineBalances({ period: P2, d: { step3: { summary: { closingAmt: 1000 } }, register: { rows: [] }, wipadj: { reg632: [] }, salesDB: { rows: [] }, nrvDecision: { key: nk, status: 'RECORDED', recordedAmount: 40, amount: 40 } } }, { d3b: { wf: { finalClosing: 1000 } } }, fakeRes);
  eq('#7 recorded NRV bridges both 2294 and 632', [ebNrv.a2294, ebNrv.a632], [40, 340]);
}

// ---- v1.10.2: ERP access-right notice line is not a dated transaction
{
  const { outOfPeriodRows: oor } = await import('../src/engine/controls.js');
  const dsN = { 'MI-M-O': { header: ['MI No.', 'Date', 'Material Code', 'Current Issue Qty', 'Total Cost'], rows: [['MI-1', ser(2026, 8, 3), 'M', 1, 5], ['Notice : This report has been affected by item type/Sub-ledger/document group access right.', null, null, null, null]] } };
  eq('ERP notice footer ignored by date control', oor(dsN, '2026-08').length, 0);
}
// ---- STEP 4.4 YTD finished-goods production table
{
  const fl = { rows: [
    { erp: 'O', pc: 'PC-1', date: ser(2026, 8, 3), mo: 'MO1', sub: '', prod: 'a', name: 'A', fam: 'F', loc: 'L', unit: 'PC', qty: 10, baseRM: 600, wipAdj: 40, carryIn: 0, totalRM: 640, t622: 200, t627: 160, totalCost: 1000 },
    { erp: 'O', pc: 'PC-2', date: ser(2026, 8, 9), mo: 'MO2', sub: '', prod: 'B', name: 'B', fam: 'F', loc: 'L', unit: 'PC', qty: 5, baseRM: 300, wipAdj: 0, carryIn: 50, totalRM: 350, t622: 100, t627: 50, totalCost: 500 },
  ] };
  const cur = FP.rowsFromFinalLayer(fl, '2026-08');
  eq('4.4 rows from STEP 4.3 final layer', cur.map((r) => [r.period, r.prod, r.qty, r.totalRM, r.c622, r.c627, r.total, r.unitCost]), [['2026-08', 'A', 10, 640, 200, 160, 1000, 100], ['2026-08', 'B', 5, 350, 100, 50, 500, 100]]);
  // upload file for the earlier months (template layout, header on row 4)
  const tpl = FP.templateAOA([], '2026-08');
  const grid = [...tpl, ['2026-06', 'O', 'PC-J', '', '', 'A', 'A', '', '', 'PC', 4, 300, 60, 40, 400, 1, 100, ''], ['07/2026', '', '', '', '', 'A', '', '', '', '', 6, '', '', '', 660, '', '', 'tổng tháng'], ['2025-12', '', '', '', '', 'A', '', '', '', '', 1, '', '', '', 10, '', '', ''], ['2026-08', '', '', '', '', 'A', '', '', '', '', 1, '', '', '', 10, '', '', '']];
  const op = FP.importOpening({ S: grid }, 'op.xlsx', '2026-08');
  eq('4.4 upload: parsed periods / checks', op.rows.map((r) => [r.period, r.check]), [['2026-06', 'PASS'], ['2026-07', 'PASS'], ['2025-12', 'BLOCK'], ['2026-08', 'BLOCK']]);
  eq('4.4 upload with errors is BLOCKED', [op.status, op.stats.block], ['BLOCKED', 2]);
  const ok = FP.importOpening({ S: grid.slice(0, 6) }, 'op.xlsx', '2026-08');
  eq('4.4 upload valid', [ok.status, ok.stats.rows, ok.stats.total, ok.through], ['VALIDATED', 2, 1060, '2026-07']);
  const fpAug = { opening: ok, current: { period: '2026-08', rows: cur } };
  const sm = FP.summarize(FP.ytdRows(fpAug, '2026-08'), '2026-08');
  eq('4.4 YTD by product', sm.prods.map((p) => [p.prod, p.curQty, p.ytdQty, p.ytdTotal]), [['A', 10, 20, 2060], ['B', 5, 5, 500]]);
  eq('4.4 by month with running total', sm.months.map((m) => [m.period, m.qty, m.total, m.cumTotal]), [['2026-06', 4, 400, 400], ['2026-07', 6, 660, 1060], ['2026-08', 15, 1500, 2560]]);
  eq('4.4 blocked upload is not counted', FP.ytdRows({ opening: op, current: fpAug.current }, '2026-08').length, 2);
  const sep = FP.rollOpening(fpAug, '2026-08', '2026-09');
  eq('4.4 roll forward = opening + posted month', [sep.kind, sep.stats.rows, sep.stats.total, sep.through, sep.stats.months], ['ROLL', 4, 2560, '2026-08', ['2026-06', '2026-07', '2026-08']]);
  eq('4.4 January starts a new year', [FP.rollOpening(fpAug, '2026-12', '2027-01').kind, FP.rollOpening(fpAug, '2026-12', '2027-01').rows.length], ['NEW YEAR', 0]);
  let miss = ''; try { FP.rollOpening({ opening: ok }, '2026-08', '2026-09'); } catch (e) { miss = e.message; }
  eq('4.4 roll needs the previous month posted', miss.includes('chưa chuyển kết quả STEP 4.3'), true);
  const back = FP.importOpening({ S: FP.templateAOA(FP.ytdRows(fpAug, '2026-08'), '2026-09') }, 'next.xlsx', '2026-09');
  eq('4.4 "file đầu kỳ cho kỳ sau" round-trips', [back.status, back.stats.rows, back.stats.total], ['VALIDATED', 4, 2560]);
  // lot allocation: which invoice / month took which lot, what is left (pre-web sales from the upload count too)
  const res8 = { period: '2026-08', ledger: [{ lid: 'L1', srcPeriod: '2026-06', pc: 'PC-J', prod: 'A' }, { lid: 'L2', srcPeriod: '2026-08', pc: 'PC-1', prod: 'A' }, { lid: 'L9', srcPeriod: '2025-11', pc: 'OLD', prod: 'A' }],
    sales: [{ seq: 1, inv: 'INV-1', cust: 'C1', date: ser(2026, 8, 5) }, { seq: 2, inv: 'INV-2', cust: 'C2', date: ser(2026, 8, 9) }],
    detail: [{ line: 1, lid: 'L1', pc: 'PC-J', prod: 'A', qty: 3, tot: 300 }, { line: 1, lid: 'L2', pc: 'PC-1', prod: 'A', qty: 1, tot: 100 }, { line: 2, lid: 'L2', pc: 'PC-1', prod: 'A', qty: 4, tot: 400 }, { line: 2, lid: 'L9', pc: 'OLD', prod: 'A', qty: 1, tot: 90 }],
    rework: { rows: [{ lid: 'L2', fg: 'A', rid: 'RW-1', issueDate: ser(2026, 8, 20), qty: 2, tot: 200 }] } };
  const cons = FP.consumptionFromStep5(res8, '2026-08');
  eq('4.4 consumption tied to month / invoice / lot', cons.map((c) => [c.month, c.kind, c.inv, c.lotPeriod, c.pc, c.qty]), [['2026-08', 'SALE', 'INV-1', '2026-06', 'PC-J', 3], ['2026-08', 'SALE', 'INV-1', '2026-08', 'PC-1', 1], ['2026-08', 'SALE', 'INV-2', '2026-08', 'PC-1', 4], ['2026-08', 'SALE', 'INV-2', '2025-11', 'OLD', 1], ['2026-08', 'REWORK', 'RW-1', '2026-08', 'PC-1', 2]]);
  const al = FP.allocate(FP.ytdRows(fpAug, '2026-08'), cons);
  const pj = al.lots.find((r) => r.pc === 'PC-J'), p1 = al.lots.find((r) => r.pc === 'PC-1');
  eq('4.4 lot PC-J: pre-web sold + FIFO sold → remaining', [pj.soldQty, pj.soldTot, pj.remQty, pj.remTot, pj.invCount], [4, 400, 0, 0, 1]);
  eq('4.4 lot PC-1: sold to 2 invoices + rework', [p1.soldQty, p1.rwQty, p1.remQty, p1.issuedMonths, p1.invCount], [5, 2, 3, '2026-08: 7', 2]);
  eq('4.4 lot outside the table reported', al.unmatched.map((u) => u.pc), ['OLD']);
  const sep2 = FP.rollOpening({ ...fpAug, current: { ...fpAug.current, sales: cons } }, '2026-08', '2026-09');
  eq('4.4 roll carries the allocation records', [sep2.sales.length, FP.ytdSales({ opening: sep2 }, '2026-09').length], [5, 5]);
  eq('4.4 sold per product / month in summary', [FP.summarize(FP.ytdRows(fpAug, '2026-08'), '2026-08', cons).prods.find((p) => p.prod === 'A').soldQty, FP.summarize([], '2026-08', cons).months[0].soldTot], [9, 890]);
  const nx = FP.importOpening({ S: FP.templateAOA(al.lots, '2026-09') }, 'nx.xlsx', '2026-09');
  eq('4.4 next-month file keeps sold-before qty', nx.rows.find((r) => r.pc === 'PC-1').soldQty0, 7);
  eq('4.4 period parser', ['2026-7', '7/2026', 202607, '2026/07'].map(FP.parsePeriod), ['2026-07', '2026-07', '2026-07', '2026-07']);
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

// ---- PC cost basis: PC-P lot cost aligned to PC-M (per PC No. + Product Code) ----
{
  const { pcBasisScan, applyPcBasis, undoPcBasis, pcBasisIntact } = await import('../src/engine/pcbasis.js');
  const H = ['PC No.', 'Product Code', 'Product Name', 'Location', 'MO No.', 'Total Cost'];
  const mk = (rows) => ({ header: H, rows });
  const ds = {
    'PC-P-T': mk([['PC-1', 'A', 'n', 'L', 'MO1', 100], ['PC-1', 'B', 'n', 'L', 'MO1', 50], ['PC-2', 'A', 'n', 'L', 'MO2', 60], ['PC-2', 'A', 'n', 'L', 'MO2', 40]]),
    'PC-M-T': mk([['PC-1', 'A', 'n', 'L', 'MO1', 99.5], ['PC-1', 'B', 'n', 'L', 'MO1', 50], ['PC-2', 'A', 'n', 'L', 'MO2', 98]]),
  };
  const sc = pcBasisScan(ds);
  eq('pcb: gaps found', sc.lines.length, 2);
  eq('pcb: only-one-side empty', sc.onlyPCM.length + sc.onlyPCP.length, 0);
  eq('pcb: diff = PC-M − PC-P', Math.abs(sc.totals.diff - (-2.5)) < 0.001, true);
  const res = applyPcBasis(ds, '2026-09');
  eq('pcb: tie zero after apply', res.ok, true);
  const sum = res.changes.reduce((a, c) => a + (c.adj - Number(c.orig)), 0);
  eq('pcb: adjustments sum to diff', Math.abs(sum - sc.totals.diff) < 0.001, true);
  eq('pcb: split by current cost (PC-2 rows 60/40 of 98)', [res.datasets['PC-P-T'].rows[2][5], res.datasets['PC-P-T'].rows[3][5]], [58.8, 39.2]);
  eq('pcb: intact right after apply', pcBasisIntact(res.datasets, res.changes), true);
  const back = undoPcBasis(res.datasets, res.changes);
  eq('pcb: undo restores original cost', back['PC-P-T'].rows.map((r) => r[5]), [100, 50, 60, 40]);
  eq('pcb: undo leaves dataset identical to input', pcBasisScan(back).totals.diff.toFixed(2), sc.totals.diff.toFixed(2));
  eq('pcb: intact false after undo', pcBasisIntact(back, res.changes), false);
  const bad = { ...ds, 'PC-M-T': mk([['PC-1', 'A', 'n', 'L', 'MO1', 99.5], ['PC-9', 'Z', 'n', 'L', 'MO9', 7]]) };
  let threw = false; try { applyPcBasis(bad, '2026-09'); } catch { threw = true; }
  eq('pcb: refuses when a PC exists on one side only', threw, true);
}

// ---- v1.14.15 Sales YTD guard, SO price text, SO check labels, Price Master never touches sales
{
  const { parseLocaleNum } = await import('../src/engine/util.js');
  const S4 = await import('../src/engine/step4.js');
  for (const [v, want] of [[34.6, 34.6], ['34,6', 34.6], ['1.234,5', 1234.5], ['1,234.5', 1234.5], ['0,5', 0.5], ['8,8334', 8.8334], ['1,234', 1234], ['USD 265', null], ['', null]]) eq(`parseLocaleNum ${JSON.stringify(v)}`, parseLocaleNum(v), want);
  const P9 = '2026-09';
  const sr = (d, inv, prod, qty, usd) => ({ invDate: d, customer: 'C', product: prod, prodName: 'N', fx: 26000, qty, unitPrice: usd / qty, amtUSD: usd, amtVND: usd * 26000, invNo: inv, lineNo: '', tranType: 'NORMAL SALE' });
  const jan = S4.validateSaveSales({ mode: 'YTD', rows: [sr(ser(2026, 1, 10), 'J1', 'OLD', 10, 100), sr(ser(2026, 8, 10), 'A1', 'A', 10, 200)] }, { rows: [] }, '2026-08', { book: 'SALES' }).db;
  const sepOnly = () => ({ mode: 'YTD', rows: [sr(ser(2026, 9, 22), 'S1', 'A', 5, 105)] });
  let err = ''; try { S4.validateSaveSales(sepOnly(), jan, P9, { book: 'SALES' }); } catch (e) { err = e.message; }
  eq('YTD sales file starting in September is refused', /XOÁ/.test(err) && /MONTHLY/.test(err), true);
  eq('YTD guard shows in the save preview (before the confirm dialog)', !!S4.salesSavePreview(sepOnly(), jan, P9, { book: 'SALES' }).block, true);
  eq('YTD guard: earlier months are untouched', jan.rows.length, 2);
  const mo = S4.validateSaveSales({ ...sepOnly(), mode: 'MONTHLY' }, jan, P9, { book: 'SALES' }).db;
  eq('MONTHLY September keeps January–August', mo.rows.map((r) => r.invNo).sort(), ['A1', 'J1', 'S1']);
  const full = S4.validateSaveSales({ mode: 'YTD', rows: [sr(ser(2026, 1, 10), 'J1', 'OLD', 10, 100), sr(ser(2026, 9, 22), 'S1', 'A', 5, 105)] }, jan, P9, { book: 'SALES' }).db;
  eq('YTD file from January still replaces the whole year', full.rows.map((r) => r.invNo).sort(), ['J1', 'S1']);
  eq('YTD guard does not apply to the returns book', S4.ytdStartGap('YTD', 'RETURNS', ser(2026, 6, 1), P9), '');
  const step2 = { pc: ['A', 'NEW', 'LATE', 'TXT', 'OLD'].map((p, i) => ({ erp: 'O', pcNo: 'PC-2609-' + i, prod: p, rowIdx: i })) };
  const so = [
    { active: 'Y', product: 'NEW', soDate: ser(2026, 9, 3), price: '34,6' },
    { active: 'Y', product: 'LATE', soDate: ser(2026, 10, 3), price: 50 },
    { active: 'Y', product: 'TXT', soDate: null, price: 'USD 12' },
    { active: 'Y', product: 'A', soDate: ser(2026, 9, 1), price: 99 },
  ];
  const before = JSON.stringify(mo);
  const r = S4.updatePriceMaster({ salesDB: mo, so, manual: [], step2, period: P9 });
  eq('Price Master does not modify the Sales Database', JSON.stringify(mo), before);
  const pm = Object.fromEntries(r.pm.rows.map((x) => [x.product, x]));
  const chk = Object.fromEntries(r.so.map((x) => [x.product, x.check]));
  eq('SO price typed "34,6" is 34.6', [pm.NEW.finalPrice, pm.NEW.finalSource], [34.6, 'SALES ORDER']);
  eq('SO used → check says USED', chk.NEW, 'USED - FINAL PRICE (SALES ORDER)');
  eq('SO after period → PM BLOCK and check is not "USED"', [pm.LATE.status, chk.LATE], ['BLOCK - SO AFTER PERIOD', 'BLOCK - SO AFTER PERIOD (NOT USED AS PRICE)']);
  eq('SO price text that is not a number is reported', [chk.TXT, pm.TXT.status], ['SKIPPED - UNIT PRICE USD IS NOT A NUMBER', 'MISSING PRICE']);
  eq('actual sales keep priority over SO', [pm.A.finalSource, chk.A], ['CURRENT MONTH ACTUAL', 'NOT USED - ACTUAL SALES / MANUAL PRICE HAS PRIORITY']);
  eq('January actual still prices OLD after a MONTHLY September save', pm.OLD.finalSource, 'LATEST ACTUAL 202601');
}

// ---- v1.14.17 STEP 3B when STEP 3A has no negative WIP; one definition of "negative WIP" for BUILD and the STEP 4 gate
{
  const { step3bControls } = await import('../src/engine/controls.js');
  const { threeBBlock } = await import('../src/views/phase2.js');
  const P9 = '2026-09';
  const mk = (rows) => ({ period: P9, runAt: '2026-10-12T16:25:00Z', rows });
  const okRow = { code: 'RM1', closingQty: 5, closingAmt: 100, status: 'OK' };
  const tiny = { code: 'RM2', closingQty: -0.00005, closingAmt: 0, status: 'OK' }; // rounding residue: not CHECK NEGATIVE
  const negRow = { code: 'RM3', closingQty: -3, closingAmt: -50, status: 'CHECK NEGATIVE' };
  const wf = { erpClosing: 100, finalClosing: 100, bridge: 0, bridgeStatus: 'PASS', approvedAdj: 0, negFinal: 0 };
  const c0 = step3bControls({ period: P9, input: [], step3: mk([okRow, tiny]), wf, control: null });
  eq('3B: no CHECK NEGATIVE + empty INPUT → PASS without BUILD', [c0.status, c0.noNegative, c0.rows.some((r) => r.status === 'NOT RUN')], ['PASS', true, false]);
  const c1 = step3bControls({ period: P9, input: [], step3: mk([okRow, negRow]), wf, control: null });
  eq('3B: real negative WIP still requires BUILD', c1.status, 'RERUN REQUIRED');
  const S = (rows, input = []) => ({ d: { step3: mk(rows), wipadj: { input } } });
  eq('STEP 4 gate: rounding residue is not negative WIP (same rule as BUILD)', threeBBlock(S([okRow, tiny]), null), '');
  eq('STEP 4 gate: real negative WIP blocks until taken into 3B', /1 vật tư WIP âm/.test(threeBBlock(S([okRow, negRow]), null)), true);
}

// ---- v1.14.18 STEP 3B ACTUAL_USAGE AMOUNT: every material with PC-M Total Cost ≤ 0 is reported in one error (no stop at the first)
{
  const H = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Quantity', 'Total Cost'];
  const s2 = { period: P2, pc: [{ erp: 'T', pcNo: 'PC-1', prod: 'A', name: 'A', rmIncl: 100, rowIdx: 1 }, { erp: 'T', pcNo: 'PC-2', prod: 'B', name: 'B', rmIncl: 100, rowIdx: 2 }] };
  const dsx = { 'PC-M-T': { header: H, rows: [
    ['PC-1', 'A', 'A', 'Z1', 1.145, 0], ['PC-2', 'B', 'B', 'Z1', 2, 0],   // Z1: quantity but zero cost → blocked
    ['PC-1', 'A', 'A', 'OK', 80, 40], ['PC-2', 'B', 'B', 'OK', 20, 60],  // OK: amount basis fine
    ['PC-1', 'A', 'A', 'Z2', 3, 0],                                       // Z2: zero cost → blocked
  ] } };
  const inp = [{ key: 'Z1', erp: 'T', desc: 'z1', basisAmt: -50 }, { key: 'OK', erp: 'T', desc: 'ok', basisAmt: -10 }, { key: 'Z2', erp: 'T', desc: 'z2', erpAmt: -30 }];
  let err = null; try { rebuildEngine(inp, s2, dsx, P2, 'AMOUNT'); } catch (e) { err = e; }
  eq('3B AMOUNT: blocked list has all bad materials, not only the first', err && err.blocked.map((b) => b.key), ['Z1', 'Z2']);
  eq('3B AMOUNT: message names every blocked material', !!err && /Z1[\s\S]*Z2/.test(err.message) && !/OK \(/.test(err.message), true);
  eq('3B AMOUNT: message does not silently fall back to QTY', !!err && /Không tự fallback sang QTY/.test(err.message), true);
  eq('3B QTY basis still builds (legacy exception chosen on purpose)', rebuildEngine(inp, s2, dsx, P2, 'QTY').rows.length > 0, true);
  // v1.14.24 zero-value material: PC-M cost 0 AND WIP amount 0 → quantity share, 0 VND, not blocked
  const inpZ = [{ key: 'Z1', erp: 'T', desc: 'z1', basisAmt: 0, erpAmt: -3.7e-9 }, { key: 'OK', erp: 'T', desc: 'ok', basisAmt: -10 }, { key: 'Z2', erp: 'T', desc: 'z2', basisAmt: 0.4, erpAmt: 0 }];
  const ez = rebuildEngine(inpZ, s2, dsx, P2, 'AMOUNT');
  const z1 = ez.rows.filter((r) => r.key === 'Z1');
  eq('3B zero-value: Z1 split by quantity 1.145 / 2, amount basis 0, noted', [z1.map((r) => Math.round(r.share * 10000) / 10000), z1.every((r) => r.bTot === 0 && /giá trị 0/.test(r.note))], [[Math.round(1.145 / 3.145 * 10000) / 10000, Math.round(2 / 3.145 * 10000) / 10000], true]);
  eq('3B zero-value: listed for the control, OK material still by amount', [ez.zeroValue.map((x) => x.key), ez.rows.filter((r) => r.key === 'OK').map((r) => r.share)], [['Z1', 'Z2'], [0.4, 0.6]]);
  let errM = null; try { rebuildEngine([{ key: 'Z1', erp: 'T', desc: 'z1', basisAmt: 0, erpAmt: 0 }, { key: 'Z2', erp: 'T', desc: 'z2', basisAmt: -250000 }], s2, dsx, P2, 'AMOUNT'); } catch (e) { errM = e; }
  eq('3B zero-value: a zero-cost material that still carries WIP money stays BLOCKED', errM && errM.blocked.map((b) => b.key), ['Z2']);
}

// ---- STEP 3B AMOUNT: mixed zero-cost PC rows must not BLOCK material-level CONTROL.
// Reproduction: material 322936, 58 PC-M detail lines, WIP Qty -690.84, amount 501,339.63 VND.
{
  const period = P2, code = '322936';
  const H = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Quantity', 'Total Cost'];
  const pc = Array.from({ length: 58 }, (_, i) => ({ erp: 'O', pcNo: `PC-${i + 1}`, prod: `FG-${i + 1}`, name: 'Label', rmIncl: 1000, rowIdx: i }));
  const ds = { 'PC-M-O': { header: H, rows: pc.map((p, i) => [p.pcNo, p.prod, p.name, code, 1 + i / 10, i % 13 === 0 ? 0 : i + 1]) } };
  const input = [{ code, desc: 'Woven label', basisQty: -690.84, basisAmt: 501339.63, option: 'ERP_AMOUNT' }];
  const erpMap = { rows: [{ code, erp: 'O', review: 'OK', override: '' }] };
  const step2 = { period, runAt: '2026-08-31T00:00:00Z', pc };
  const step3 = { period, runAt: '2026-08-31T01:00:00Z', rows: [{ code, name: 'Woven label', closingQty: -690.84, closingAmt: 501339.63, status: 'CHECK NEGATIVE' }] };
  const r = runBuild({ erpMap, input, control: null, reg632: [], basis: 'AMOUNT' }, { period, step2, step3, datasets: ds });
  const zero = r.detail.filter((d) => d.bLot === 0);
  eq('3B 322936: BUILD retains 58 PC-M details, zero-cost PCs do not BLOCK', [r.detail.length, zero.length > 0, zero.every((d) => d.share === 0 && d.allocAmt === 0 && d.allocQty === 0 && d.status === 'READY TO REVIEW')], [58, true, true]);
  eq('3B 322936: zero-cost PCs remain identifiable in DETAIL', zero.every((d) => /PC-M Total Cost = 0/.test(d.note)), true);
  eq('3B 322936: CONTROL reconciles 100% and VND to allocated basis', [r.control.rows[0].status, Math.round(r.control.rows[0].share * 10000) / 10000, Math.round(r.control.rows[0].apc * 100) / 100, r.control.rows[0].blocks], ['PASS', 1, 501339.63, 0]);
  eq('3B fingerprint: APPLY AMOUNT matches BUILD', r.control.fp, buildFingerprint(input, r.erpMap, step2, step3, 'AMOUNT'));
  eq('3B fingerprint: switching basis to QTY requires rebuild', r.control.fp === buildFingerprint(input, r.erpMap, step2, step3, 'QTY'), false);
  eq('3B fingerprint: changed INPUT requires rebuild', r.control.fp === buildFingerprint([{ ...input[0], basisAmt: 501340.63 }], r.erpMap, step2, step3, 'AMOUNT'), false);
  eq('3B fingerprint: ERP override change requires rebuild', r.control.fp === buildFingerprint(input, { rows: [{ code, erp: 'O', override: 'T' }] }, step2, step3, 'AMOUNT'), false);
  for (const x of r.control.rows) setDecision(x, 'HOLD');
  eq('3B HOLD ALL without reason prompts reason', applyControl(r.control, step3, '').mode, 'NEED_REASON');
  const applied = applyControl(r.control, step3, 'Không điều chỉnh WIP âm trong kỳ; chờ xác minh');
  eq('3B HOLD ALL + reason closes without posting any adjustments', [applied.mode, applied.nHold, r.control.noAdj !== null, r.control.rows.every((x) => x.postCheck === 'NOT POSTED' && x.decision === 'HOLD')], ['NO_ADJ', 1, true, true]);
  const bad = { rows: [{ ...r.control.rows[0], status: 'BLOCK - DETAIL', decision: 'HOLD' }] };
  eq('3B HOLD must not bypass a real BLOCK', applyControl(bad, step3, 'reason').mode, 'STOPPED');
}

// ---- v1.14.34 Wave 1 (audit ENH-01/02/03): approval bound to the PC allocation; Step 4 freshness key; one STEP 3B gate
{
  const B3 = await import('../src/engine/step3b.js');
  const PH = await import('../src/views/phase2.js');
  const period = P2, code = '322936';
  const H = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Quantity', 'Total Cost'];
  const pc = Array.from({ length: 58 }, (_, i) => ({ erp: 'O', pcNo: `PC-${i + 1}`, prod: `FG-${i + 1}`, name: 'Label', rmIncl: 1000, rowIdx: i }));
  const ds = { 'PC-M-O': { header: H, rows: pc.map((p, i) => [p.pcNo, p.prod, p.name, code, 1 + i / 10, i % 13 === 0 ? 0 : i + 1]) } };
  const input = [{ code, desc: 'Woven label', basisQty: -690.84, basisAmt: 501339.63, option: 'ERP_AMOUNT' }];
  const erpMap = { rows: [{ code, erp: 'O', review: 'OK', override: '' }] };
  const step2 = { period, runAt: '2026-08-31T00:00:00Z', pc };
  const step3 = { period, runAt: '2026-08-31T01:00:00Z', rows: [{ code, name: 'Woven label', closingQty: -690.84, closingAmt: 501339.63, status: 'CHECK NEGATIVE' }] };
  const r = runBuild({ erpMap, input, control: null, reg632: [], basis: 'AMOUNT' }, { period, step2, step3, datasets: ds });
  const inD = () => B3.deriveInput(input, r.erpMap, step3, period);
  const ctl0 = r.control; const row0 = () => ctl0.rows.find((x) => x.code === code);
  const alloc = r.detail.filter((d) => d.code === code && Number(d.allocAmt) > 0);
  eq('ENH-01 precondition: 322936 PASS with at least two allocated PC lines', [row0().status, alloc.length >= 2], ['PASS', true]);
  B3.setDecision(row0(), 'APPROVE');
  const again = B3.buildControl(r.detail, inD(), ctl0);
  eq('ENH-01: re-BUILD with identical allocation keeps APPROVE', [again.rows.find((x) => x.code === code).decision, again.allocResets], ['APPROVE', 0]);
  const moved = r.detail.map((d) => ({ ...d }));
  const ia = moved.findIndex((d) => d.code === code && d.pc === alloc[0].pc), ib = moved.findIndex((d) => d.code === code && d.pc === alloc[1].pc);
  moved[ia].allocAmt = Number(moved[ia].allocAmt) + 100; moved[ib].allocAmt = Number(moved[ib].allocAmt) - 100;
  const after = B3.buildControl(moved, inD(), ctl0);
  const ra = after.rows.find((x) => x.code === code);
  eq('ENH-01: moving 100 VND between PC lines (total unchanged) resets APPROVE', [ra.status, ra.decision, after.allocResets, /không còn áp dụng/.test(ra.note)], ['PASS', '', 1, true]);
  const legacy = { ...ctl0, rows: ctl0.rows.map(({ allocFp, ...rest }) => rest) };
  const lg = B3.buildControl(r.detail, inD(), legacy);
  eq('ENH-01: a control saved before the fingerprint is re-reviewed once', [lg.rows.find((x) => x.code === code).decision, lg.allocResets], ['', 1]);

  eq('ENH-02: same per-PC posting key stays CURRENT', PH.posted3BFresh({ posted3BKey: 'k1' }, { posted3BKey: 'k1' }), true);
  eq('ENH-02: a re-allocation between PCs is OUTDATED even with the same total', PH.posted3BFresh({ posted3BKey: 'k2' }, { posted3BKey: 'k1' }), false);
  eq('ENH-02: a Step 4 snapshot without the key is OUTDATED', PH.posted3BFresh({ posted3BKey: 'k1' }, {}), false);

  const okCtl = (over = {}) => ({ builtAt: '2026-10-14T10:00:00Z', appliedAt: '2026-10-14T10:05:00Z', noAdj: null, rows: [{ code: 'A', status: 'PASS', decision: 'APPROVE', appliedDecision: 'APPROVE', gate: 'READY TO POST' }], ...over });
  eq('ENH-03 gate: applied, all PASS → no reason to stop', B3.step3BGateReason(okCtl()), '');
  eq('ENH-03 gate: a BLOCK row held is still BLOCK', /HOLD không gỡ được BLOCK/.test(B3.step3BGateReason(okCtl({ rows: [{ code: 'B', status: 'BLOCK - DETAIL', decision: 'HOLD', appliedDecision: 'HOLD', gate: 'BLOCK - DETAIL' }] }))), true);
  eq('ENH-03 gate: HOLD everything but no APPLY after BUILD → blocked', /chưa APPLY/.test(B3.step3BGateReason(okCtl({ appliedAt: '2026-10-14T09:00:00Z', rows: [{ code: 'A', status: 'PASS', decision: 'HOLD', gate: 'HOLD' }] }))), true);
  eq('ENH-03 gate: decision changed after APPLY → blocked', /đổi quyết định sau lần APPLY/.test(B3.step3BGateReason(okCtl({ rows: [{ code: 'A', status: 'PASS', decision: 'HOLD', appliedDecision: 'APPROVE', gate: 'HOLD' }] }))), true);
  eq('ENH-03 gate: no-adjustment reason shorter than 5 characters → blocked', /tối thiểu 5/.test(B3.step3BGateReason(okCtl({ noAdj: { reason: 'abc' } }))), true);
  eq('ENH-03 gate: DIRECT_632 not recorded blocks CLOSE only', [B3.step3BGateReason(okCtl(), { forClose: true, reg632: [{ record: 'READY FOR ACCOUNTING' }] }) !== '', B3.step3BGateReason(okCtl(), { reg632: [{ record: 'READY FOR ACCOUNTING' }] })], [true, '']);

  const ap = B3.applyControl(ctl0, step3, '');
  eq('ENH-03: APPLY records the applied decision on every row', [ap.mode, ctl0.rows.every((x) => x.appliedDecision === x.decision)], ['APPLIED', true]);
  eq('ENH-03: after APPLY the gate passes for an approved PASS row', B3.step3BGateReason(ctl0), '');
  B3.setDecision(row0(), 'HOLD');
  eq('ENH-03: switching APPROVE → HOLD after APPLY is caught by the gate', /đổi quyết định sau lần APPLY/.test(B3.step3BGateReason(ctl0)), true);

  const mkS = (control) => ({ d: { step3: { period, runAt: '2026-08-31T00:30:00Z', rows: [] }, wipadj: { input: [{ code }], control } } });
  eq('ENH-03 STEP 4 gate: CONTROL BLOCK cannot be bypassed by HOLD', /HOLD không gỡ được BLOCK/.test(PH.threeBBlock(mkS({ builtAt: '2026-08-31T01:00:00Z', appliedAt: '2026-08-31T02:00:00Z', rows: [{ code, status: 'BLOCK - DETAIL', decision: 'HOLD', appliedDecision: 'HOLD', gate: 'BLOCK - DETAIL' }] }), null)), true);
  eq('ENH-03 STEP 4 gate: applied PASS control → open', PH.threeBBlock(mkS({ builtAt: '2026-08-31T01:00:00Z', appliedAt: '2026-08-31T02:00:00Z', noAdj: null, rows: [{ code, status: 'PASS', decision: 'HOLD', appliedDecision: 'HOLD', gate: 'HOLD' }] }), null), '');
}

// ---- v1.14.18 PC-M gate at IMPORT: negative / zero-cost issue lines block the file (STEP 1), footers are ignored
{
  const HP = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Quantity', 'Total Cost'];
  const gridOf = (body) => [['PC-M report'], HP, ...body];
  const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
  const clean = gridOf([['PC-1', 'A', 'A', 'M1', 2, 10], ['PC-1', 'A', 'A', 'M2', 0, 0], [null, null, null, null, 999, 999]]);
  eq('PC-M gate: clean file (incl. zero-qty zero-cost and footer total) imports', buildDataset(clean, 'PC-M-O-202609.xlsx', P2).status, 'IMPORTED');
  const neg = thrown(() => buildDataset(gridOf([['PC-1', 'A', 'A', 'MNEG', 2, -10], ['PC-1', 'A', 'A', 'M1', 2, 10]]), 'PC-M-O-202609.xlsx', P2));
  eq('PC-M gate: negative Total Cost blocks the file', !!neg && /CHẶN/.test(neg) && /ÂM/.test(neg) && neg.includes('MNEG'), true);
  const negQ = thrown(() => buildDataset(gridOf([['PC-1', 'A', 'A', 'MQ', -1, 10]]), 'PC-M-T-202609.xlsx', P2));
  eq('PC-M gate: negative Quantity blocks the file', !!negQ && negQ.includes('MQ'), true);
  const zds = buildDataset(gridOf([['PC-1', 'A', 'A', 'Z1', 1.145, 0], ['PC-2', 'B', 'B', 'Z1', 2, 0], ['PC-1', 'A', 'A', 'OK', 80, 40]]), 'PC-M-T-202609.xlsx', P2);
  eq('PC-M gate: qty ≠ 0 with zero cost is a WARNING, file still imports', [zds.status, zds.warnings.zeroCostLines, zds.warnings.zeroCostMaterials], ['IMPORTED', 2, ['Z1']]);
  eq('PC-M gate: clean file carries no warning', buildDataset(clean, 'PC-M-O-202609.xlsx', P2).warnings, undefined);
  const txt = thrown(() => buildDataset(gridOf([['PC-1', 'A', 'A', 'T1', '34,6', 10]]), 'PC-M-O-202609.xlsx', P2));
  eq('PC-M gate: text quantity blocks the file', !!txt && /không phải số/.test(txt), true);
  const pcpNeg = [['PC No.', 'Product Code', 'Current Complete Qty', 'Total Cost'], ['PC-1', 'A', 5, -100]];
  eq('PC-M gate: other reports (PC-P) are not gated by this rule', buildDataset(pcpNeg, 'PC-P-O-202609.xlsx', P2).status, 'IMPORTED');
}

// ---- v1.14.18 STEP 2 per-rule amounts and checkpoint 11 in whole VND
{
  const { ruleSummary } = await import('../src/engine/step2report.js');
  const { step2Controls } = await import('../src/engine/controls.js');
  const P9 = '2026-09';
  const D18 = (erp, key, type, src, tErp, pc, alloc, status, note) => [erp, key, type, 1, src, key, tErp, 'SP', pc, '', '', '', '', 0, 0, alloc, status, note];
  const detail = [
    D18('T', 'DOONA', 'Customer', 100, 'T', 'PC-A', 60, 'ALLOCATED', 'DOONA -> T SP*.'),
    D18('T', 'DOONA', 'Customer', 100, 'T', 'PC-B', 40, 'ALLOCATED', 'DOONA -> T SP*.'),
    D18('O', 'XX', 'Job', 30, 'O', 'PC-C', 30, 'FALLBACK RM COST', 'O other -> all O theo PC RM Cost.'),
    // a PC row carries the system of its own lot (step2.js writes p.erp), here an O lot
    D18('S', 'Y', 'Loc', 10, 'O', 'PC-D', 10, 'FALLBACK RM COST', 'S other -> T+O theo PC RM Cost.'),
  ];
  const s2 = { period: P9, runAt: '', status: 'PASS', detail, summary: [], pc: [], fallbackApproval: null, total: { src: 140, alloc: 140, unalloc: 0, diff: 0, status: 'PASS' } };
  const rs = ruleSummary(s2);
  const byCode = Object.fromEntries(rs.map((r) => [r.code, r]));
  eq('ruleSummary: R1 amount = 100 over 2 lots', [byCode.R1.alloc, byCode.R1.lines, byCode.R1.groups], [100, 2, 1]);
  eq('ruleSummary: R4c and R6 amounts', [byCode.R4c.alloc, byCode.R6.alloc], [30, 10]);
  eq('ruleSummary: rule amounts add to total allocated', rs.reduce((a, r) => a + r.alloc, 0), 140);
  // v1.14.54: allocated amount split by the receiving PC system adds back to the rule total
  eq('ruleSummary: T + S + O = allocated for every rule', rs.every((r) => Math.abs(r.allocT + r.allocS + r.allocO - r.alloc) < 0.005), true);
  eq('ruleSummary: R1 (T customer) goes to T lots only', [byCode.R1.allocT, byCode.R1.allocO], [100, 0]);
  eq('ruleSummary: share of total allocated', Math.round(byCode.R1.share * 1000) / 1000, 0.714);
  eq('ruleSummary v1.14.22: full catalogue in fixed order, also rules without data', rs.map((r) => r.code), ['R1', 'R2', 'R3', 'R4', 'R4a', 'R4b', 'R4c', 'R5a', 'R5b', 'R5c', 'R6', 'R0', 'RX']);
  eq('ruleSummary v1.14.22: unused rule = 0 and flagged, priority row and source ERP set', [byCode.R2.alloc, byCode.R2.used, byCode.R2.screen, byCode.R2.erp, byCode.R5b.screen, byCode.R1.used], [0, false, 2, 'T', 8, true]);
  const c = step2Controls({ period: P9, step2: s2, register: null, latestImport: '' }).rows;
  const r11 = c.find((r) => r.no === '11');
  eq('CP11: expected = 5% threshold, actual = fallback, diff = excess, all whole VND', [r11.expected, r11.actual, r11.diff], [7, 40, 33]);
  eq('CP11: fallback above 5% needs approval', r11.status, 'BLOCK - APPROVAL');
  eq('CP11: per-rule sub-rows show the fallback rules', c.filter((r) => /^11\./.test(r.no)).map((r) => [r.no, r.actual]), [['11.R4c', 30], ['11.R6', 10]]);
  eq('CP11: sub-rows add up to the fallback amount', c.filter((r) => /^11\./.test(r.no)).reduce((a, r) => a + r.actual, 0), 40);
}

// ---- v1.14.18 R4c (O còn lại → mọi lô O) is counted in the broad fallback, end-to-end through runStep2 (default FAMILY rule)
{
  const { runStep2 } = await import('../src/engine/step2.js');
  const { fallbackAlloc } = await import('../src/engine/controls.js');
  const { ruleSummary } = await import('../src/engine/step2report.js');
  const { buildDataset: bd } = await import('../src/engine/step1.js');
  const ser8 = (d) => (Date.UTC(2026, 7, d) - Date.UTC(1899, 11, 30)) / 86400000;
  const HPx = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'Unit', 'Current Complete Qty', 'Total Cost'];
  const HSOx = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Base Unit', 'Base Qty', 'Base Unit Cost', 'Total Cost', 'MO No.', 'DIVISION', 'JOB CODE', 'CUSTOMER'];
  const HSSx = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Quantity', 'Unit', 'Location', 'Base Unit Cost', 'Total Cost', 'Remark', 'MO No.', 'Doc Ref 1', 'DIVISION', 'JOB CODE'];
  const HSTx = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Unit', 'Quantity', 'Total Cost', 'Customer', 'MO No.'];
  const dsR = {};
  const addR = (name, h, rows) => { const d = bd([h, ...rows], `${name}-202608.xlsx`, P2); dsR[d.key] = d; };
  addR('PC-P-O', HPx, [
    ['PC-O1', 'PC', ser8(3), 'Completed', 'MO-1', 'MO-1-001', 'OLX-300', 'Bag', 'MKX1', 'PCS', 1, 100],
    ['PC-O2', 'PC', ser8(3), 'Completed', 'MO-2', 'MO-2-001', 'OLX-400', 'Belt', 'VEX1', 'PCS', 1, 300],
  ]);
  addR('PC-P-T', HPx, []);
  addR('STOCK OUT-O', HSOx, [['SO-O-1', 'Stock Out', 'G', 'Completed', ser8(7), null, 1, '300001', 'Material', 'RM', 'MKX1', 'PC', -10, 5, -50, null, 'DIV', 'ZZ-UNKNOWN', null]]);
  addR('STOCK OUT-T', HSTx, []);
  addR('STOCK OUT-S', HSSx, []);
  const sR = runStep2(dsR, P2);
  const fb = fallbackAlloc(sR);
  const r4c = ruleSummary(sR).find((r) => r.code === 'R4c');
  eq('R4c: the unmatched O job code is allocated to all O lots', [r4c && r4c.alloc, r4c && r4c.lines], [50, 2]);
  eq('R4c: counted in the broad fallback amount (checkpoint 11)', fb, 50);
}

// ---- v1.14.28 — RM consumption (tiêu hao): Nợ 632 / Có 152, kept out of the PC-P lots
{
  const { buildDataset: bd } = await import('../src/engine/step1.js');
  const ser8 = (d) => (Date.UTC(2026, 7, d) - Date.UTC(1899, 11, 30)) / 86400000;
  const HPx = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'Unit', 'Current Complete Qty', 'Total Cost'];
  const HSOx = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Base Unit', 'Base Qty', 'Base Unit Cost', 'Total Cost', 'MO No.', 'DIVISION', 'JOB CODE', 'CUSTOMER'];
  const HSSx = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Quantity', 'Unit', 'Location', 'Base Unit Cost', 'Total Cost', 'Remark', 'MO No.', 'Doc Ref 1', 'DIVISION', 'JOB CODE'];
  const HSTx = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Unit', 'Quantity', 'Total Cost', 'Customer', 'MO No.'];
  const { runStep2 } = await import('../src/engine/step2.js');
  const dsC = {};
  const addC = (name, h, rows) => { const d = bd([h, ...rows], `${name}-202608.xlsx`, P2); dsC[d.key] = d; };
  addC('PC-P-O', HPx, [
    ['PC-O1', 'PC', ser8(3), 'Completed', 'MO-1', 'MO-1-001', 'OLX-300', 'Bag', 'MKX1', 'PCS', 1, 100],
    ['PC-O2', 'PC', ser8(3), 'Completed', 'MO-2', 'MO-2-001', 'OLX-400', 'Belt', 'VEX1', 'PCS', 1, 300],
  ]);
  addC('PC-P-T', HPx, []);
  addC('STOCK OUT-O', HSOx, [
    ['SO-C-1', 'Stock Out', 'G', 'Completed', ser8(7), null, 1, 'MAT-CONS', 'Consumable', 'RM', 'MKX1', 'PC', -4, 5, -40, null, 'DIV', 'MKX1', null],
    ['SO-C-2', 'Stock Out', 'G', 'Completed', ser8(7), null, 2, 'MAT-ALLOC', 'Allocated', 'RM', 'MKX1', 'PC', -6, 5, -60, null, 'DIV', 'MKX1', null],
  ]);
  addC('STOCK OUT-T', HSTx, []);
  addC('STOCK OUT-S', HSSx, []);
  const plain = runStep2(dsC, P2);
  eq('RM consumption: nothing selected → all 100 allocated to lots', [plain.total.alloc, plain.total.cons, plain.status], [100, 0, 'PASS']);
  // v1.14.29: the picker marks single Stock Out LINES: the first line (MAT-CONS, 40) is consumption, the second is allocated
  const { soLineKeys, stockOutLines } = await import('../src/engine/step2.js');
  const lineKeys = soLineKeys(dsC['STOCK OUT-O'], 'O');
  eq('RM consumption: each Stock Out line has its own key', [lineKeys.filter(Boolean).length, new Set(lineKeys.filter(Boolean)).size], [2, 2]);
  eq('RM consumption: picker lists non-FG lines with their amounts', stockOutLines(dsC, P2).map((x) => [x.doc, x.item, x.amt]), [['SO-C-1', 'MAT-CONS', 40], ['SO-C-2', 'MAT-ALLOC', 60]]);
  const cons = runStep2(dsC, P2, { consumeLines: [lineKeys[0]] });
  eq('RM consumption: marked line is posted to 632 (40), only 60 allocated, tie holds', [cons.total.alloc, cons.total.cons, cons.total.unalloc, Math.round(cons.total.diff), cons.status], [60, 40, 0, 0, 'PASS']);
  eq('RM consumption: listed per ERP / code, not in the allocation detail', [cons.consumption.map((c) => [c.erp, c.code, c.rows, c.amt]), cons.detail.some((d) => d[1] === 'MAT-CONS')], [[['O', 'MAT-CONS', 1, 40]], false]);
  const lineOnly = runStep2(dsC, P2, { consumeLines: [lineKeys[1]] });
  eq('RM consumption: a different line of the same material is not consumed', [lineOnly.total.cons, lineOnly.total.alloc], [60, 40]);
  eq('RM consumption: receiving lot carries only the allocated 60', Math.round(cons.pc.find((p) => p.pcNo === 'PC-O1').alloc), 60);
}

// ---- v1.14.28 — FG consumption (tiêu dùng nội bộ, Nợ 632 / Có 155): FIFO BEFORE the month's sales COGS
{
  const opC = { period: P2, status: 'LOADED', rows: [] }; F5.validateOpeningFG(opC, P2);
  const caC = [{ pc: 'PCC1', date: ser(2026, 8, 3), prod: 'A', name: 'A', qty: 5, totalRM: 300, t622: 100, t627: 100, totalCost: 500, statusText: '' }];
  const mkReg = (issue) => ({ rows: [{ active: 'Y', rid: 'CN1', fg: 'A', issueQty: issue, issueDate: ser(2026, 8, 10), inputCheck: 'PASS', rwStatus: 'CONSUMPTION', rwType: 'NORMAL', period: P2 }] });
  const salesC = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 20), 'SC1', 'A', 3, 300)] }, { rows: [] }, P2).db.rows;
  const baseC = { period: P2, opening: opC, caRows: caC, salesRows: salesC, pmRows: [], fx: 25000, overrides: {}, dupDecisions: {}, tol: 1, step4: { current: 'CURRENT', overall: 'PASS', finalCost: 500, qty: 5 } };
  eq('FG consumption is not an active rework row (no STRICT_DATE gate)', F5.activeReworkCount(mkReg(2)), 0);
  for (const mode of ['MONTHLY', 'STRICT_DATE']) {
    const reg = mkReg(2);
    const res = F5.runFIFO({ ...baseC, mode, register: reg });
    F5.runReworkFIFO(res, reg, { period: P2, opening: opC, salesRows: salesC, step4Carry: 0 });
    const c = reg.rows[0];
    eq(`FG consumption ${mode}: 2 units × 100 costed first; closing row keeps no rework WIP`, [c.fifoStatus, c.fifoQty, Math.round(c.fifoCost), c.closingWIP, Math.round(res.totals.consA)], ['PASS', 2, 200, 0, 200]);
    eq(`FG consumption ${mode}: sales get the rest (3 × 100); 632 total = 300 sales + 200 consumption`, [Math.round(res.totals.cogsA - res.totals.consA), Math.round(res.totals.cogsA)], [300, 500]);
    eq(`FG consumption ${mode}: identities 8–12 PASS, closing FG = 0`, [[8, 9, 10, 11, 12].map((k) => res.rec[k].status).join(), res.totals.closeQ], ['PASS,PASS,PASS,PASS,PASS', 0]);
    eq(`FG consumption ${mode}: rework batch 8 consumption check PASS`, res.rework.batch8.find((b) => b.label.startsWith('FG consumption')).status, 'PASS');
    F5.finalizeRun(res);
  }
  const short = mkReg(6); const rShort = F5.runFIFO({ ...baseC, mode: 'MONTHLY', register: short });
  F5.runReworkFIFO(rShort, short, { period: P2, opening: opC, salesRows: salesC, step4Carry: 0 });
  eq('FG consumption short (6 > 5 on hand): BLOCK, 1 unit short, only 5 costed', [short.rows[0].fifoStatus, Math.round(rShort.totals.consQ), rShort.totals.consShort, rShort.runResult === 'BLOCKED'], ['BLOCK - INSUFFICIENT FG', 5, 1, true]);
  // v1.14.29 STRICT_DATE: issues are taken in date order with sales — a sale dated 05/08 is costed before the consumption of 10/08
  const salesEarly = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 5), 'SE1', 'A', 1, 100)] }, { rows: [] }, P2).db.rows;
  const regD = mkReg(5); const rD = F5.runFIFO({ ...baseC, salesRows: salesEarly, mode: 'STRICT_DATE', register: regD });
  F5.runReworkFIFO(rD, regD, { period: P2, opening: opC, salesRows: salesEarly, step4Carry: 0 });
  eq('FG consumption STRICT: sale of 05/08 takes 1 first; consumption 10/08 gets the remaining 4 and is short 1',
    [rD.sales.find((x) => x.inv === 'SE1').fq, regD.rows[0].fifoQty, regD.rows[0].fifoStatus, Math.round(rD.totals.consQ)], [1, 4, 'BLOCK - INSUFFICIENT FG AT ISSUE DATE', 4]);
  // STRICT with enough stock: consumption 2 (10/08) and sale 3 (20/08) both costed; identities hold
  const regS = mkReg(2); const rS2 = F5.runFIFO({ ...baseC, mode: 'STRICT_DATE', register: regS });
  F5.runReworkFIFO(rS2, regS, { period: P2, opening: opC, salesRows: salesC, step4Carry: 0 });
  eq('FG consumption STRICT: 2 consumed at 200, sales 300, rec 8–12 PASS',
    [regS.rows[0].fifoStatus, Math.round(rS2.totals.consA), Math.round(rS2.totals.cogsA - rS2.totals.consA), [8, 9, 10, 11, 12].map((k) => rS2.rec[k].status).join()], ['PASS', 200, 300, 'PASS,PASS,PASS,PASS,PASS']);
  // checkpoint 11 (5B · SL rework = SL chuyển FIFO): the source qty of the screen = reworkSourceQty(rows) and must exclude 2B consumption
  eq('checkpoint 11 basis, consumption only: source qty 0 = FIFO transfer qty 0 (2 consumed do not count as rework)',
    [F5.reworkSourceQty(regS.rows), rS2.rework.fifoQty, rS2.rework.srcQty], [0, 0, 0]);
  const mixR = { rows: [
    { active: 'Y', rid: 'RW1', fg: 'A', issueQty: 1, issueDate: ser(2026, 8, 10), inputCheck: 'PASS', rwStatus: 'OPEN', rwType: 'NORMAL', period: P2 },
    { active: 'Y', rid: 'CN2', fg: 'A', issueQty: 1, issueDate: ser(2026, 8, 10), inputCheck: 'PASS', rwStatus: 'CONSUMPTION', rwType: 'NORMAL', period: P2 }] };
  const rM = F5.runFIFO({ ...baseC, mode: 'STRICT_DATE', register: mixR });
  F5.runReworkFIFO(rM, mixR, { period: P2, opening: opC, salesRows: salesC, step4Carry: 0 });
  eq('checkpoint 11 mixed: rework 1 + consumption 1 → source 1 = FIFO transfer 1 (consumption excluded on both sides)',
    [F5.reworkSourceQty(mixR.rows), rM.rework.fifoQty, rM.rework.srcQty, mixR.rows[1].fifoStatus], [1, 1, 1, 'PASS']);
}

// ---- v1.14.19 audit Release A — the exact regression cases of the 13/10/2026 audit
{
  const RT = await import('../src/engine/return.js');
  // P0-02: invoice sold 100, 60 already returned, return 50 with an approved manual cost → BLOCK (10 over), nothing booked
  const cand = [{ inv: 'INV1', prod: 'A', cust: 'C', date: ser(2026, 8, 2), fq: 100, rm: 1000, c622: 0, c627: 0, tot: 1000, returned: 60 }];
  const sale = { prod: 'A', qty: -50, date: ser(2026, 8, 20), cust: 'C', inv: 'CN9' };
  const r1 = RT.processReturnEvent({ sale, candidates: cand, returnedNow: new Map(), period: P2, sequence: 1, match: { origInv: 'INV1', unitCost: 10, by: 'a@svl', approvedBy: 'b@svl' } });
  eq('P0-02: over-return with manual cost → BLOCK, 40 left, 10 over, no FG layer', [r1.ok, r1.available, /vượt 10/.test(r1.message), !!r1.layer], [false, 40, true, false]);
  const r2 = RT.processReturnEvent({ sale: { ...sale, qty: -40 }, candidates: cand, returnedNow: new Map(), period: P2, sequence: 1, match: { origInv: 'INV1' } });
  eq('P0-02: return within the remaining 40 is booked at the invoice cost', [r2.ok, r2.qty, Math.round(r2.amount)], [true, 40, 400]);
  const r3 = RT.processReturnEvent({ sale: { ...sale, qty: -5 }, candidates: [], returnedNow: new Map(), period: P2, sequence: 1, match: { unitCost: 10, by: 'a@svl' } });
  eq('P0-02: legacy manual cost without a second-person approval → BLOCK', [r3.ok, /CHỜ DUYỆT/.test(r3.message)], [false, true]);
  // P0-01: STRICT_DATE, opening FG 0, production layer without date, sale on 05/08 → layer not consumed, 09c counts it
  const opU = { period: P2, status: 'LOADED', rows: [] }; F5.validateOpeningFG(opU, P2);
  const caU = [{ pc: 'PCU', date: null, prod: 'A', name: 'A', qty: 5, totalRM: 300, t622: 100, t627: 100, totalCost: 500, statusText: '' }];
  const sU = validateSaveSales({ mode: 'MONTHLY', rows: [row(ser(2026, 8, 5), 'XU', 'A', 2, 20)] }, { rows: [] }, P2).db.rows;
  const rU = F5.runFIFO({ period: P2, opening: opU, caRows: caU, salesRows: sU, pmRows: [], fx: 25000, overrides: {}, dupDecisions: {}, tol: 1, mode: 'STRICT_DATE', step4: { current: 'CURRENT', overall: 'PASS', finalCost: 500, qty: 5 } });
  const xu = rU.sales.find((x) => x.inv === 'XU');
  eq('P0-01: STRICT_DATE never consumes an undated production layer', [num(xu.fq), xu.status, rU.stats.undatedLayers], [0, 'INSUFFICIENT FG', 1]);
  const caD = [{ ...caU[0], date: ser(2026, 8, 1) }];
  const rD = F5.runFIFO({ period: P2, opening: opU, caRows: caD, salesRows: sU, pmRows: [], fx: 25000, overrides: {}, dupDecisions: {}, tol: 1, mode: 'STRICT_DATE', step4: { current: 'CURRENT', overall: 'PASS', finalCost: 500, qty: 5 } });
  eq('P0-01: the same layer with a date before the sale is used', [num(rD.sales.find((x) => x.inv === 'XU').fq), rD.stats.undatedLayers], [2, 0]);
  // P0-01 root cause: a text completion date in PC-P is read as a date by STEP 2 (was num() → 0)
  const { runStep2: rs2 } = await import('../src/engine/step2.js');
  const { buildDataset: bd2 } = await import('../src/engine/step1.js');
  const HPd = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'Unit', 'Current Complete Qty', 'Total Cost'];
  const HSOd = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Base Unit', 'Base Qty', 'Base Unit Cost', 'Total Cost', 'MO No.', 'DIVISION', 'JOB CODE', 'CUSTOMER'];
  const HSSd = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Quantity', 'Unit', 'Location', 'Base Unit Cost', 'Total Cost', 'Remark', 'MO No.', 'Doc Ref 1', 'DIVISION', 'JOB CODE'];
  const HSTd = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Unit', 'Quantity', 'Total Cost', 'Customer', 'MO No.'];
  const dsD = {}; const addD = (name, h, rows) => { const x = bd2([h, ...rows], `${name}-202608.xlsx`, P2); dsD[x.key] = x; };
  addD('PC-P-O', HPd, [['PC-O1', 'PC', '05/08/2026', 'Completed', 'MO-1', 'MO-1-001', 'OLX-300', 'Bag', 'MKX1', 'PCS', 1, 100]]);
  addD('PC-P-T', HPd, []); addD('STOCK OUT-O', HSOd, []); addD('STOCK OUT-T', HSTd, []); addD('STOCK OUT-S', HSSd, []);
  eq('P0-01 root cause: text PC-P date "05/08/2026" is kept as a date in STEP 2', rs2(dsD, P2).pc[0].date, ser(2026, 8, 5));
}

// ---- v1.14.19 sales import reads text numbers with the decimal comma
{
  const { importSales } = await import('../src/engine/step4.js');
  const g = [['Invoice Date', 'Invoice No', 'Customer', 'Product Number', 'Product Name', 'Exchange Rate', 'Quantity', 'Unit Price', 'Amount USD', 'Amount VND'],
    [ser(2026, 8, 5), 'I1', 'C', 'P1', 'n', 26300, '34,6', '2,5', '86,5', '2.274.950'], [ser(2026, 8, 5), 'I2', 'C', 'P2', 'n', 26300, 10, 'abc', 20, 526000]];
  const st = importSales({ S: g }, 'f.xlsx', 'MONTHLY', P2);
  eq('sales import: "34,6" = 34.6 (was 346), "2.274.950" = 2274950', [st.rows[0].qty, st.rows[0].unitPrice, st.rows[0].amtUSD, st.rows[0].amtVND], [34.6, 2.5, 86.5, 2274950]);
  eq('sales import: unreadable text is kept for validation to flag', st.rows[1].unitPrice, 'abc');
}

// ---- v1.14.21 Price Master coverage per PC lot
{
  const { pcPriceCheck } = await import('../src/engine/step4.js');
  const s2 = { runAt: '2026-10-13T02:00:00Z', pc: [
    { erp: 'T', rowIdx: 0, pcNo: 'PC-1', prod: 'A', name: 'a', qty: 10 }, { erp: 'T', rowIdx: 1, pcNo: 'PC-2', prod: 'B', name: 'b', qty: 5 },
    { erp: 'O', rowIdx: 0, pcNo: 'PC-3', prod: 'D', name: 'd', qty: 4 }, { erp: 'O', rowIdx: 1, pcNo: 'XX-9', prod: 'C', name: 'c', qty: 7 }] };
  const pm = { period: P2, updatedAt: '2026-10-13T03:00:00Z', rows: [{ product: 'A', finalPrice: 2, finalSource: 'CURRENT MONTH ACTUAL' }, { product: 'B', finalPrice: null, finalSource: '' }] };
  const c = pcPriceCheck(s2, pm, P2);
  eq('PC price: status per lot', c.rows.map((r) => r.status), ['OK', 'MISSING PRICE', 'NOT IN PRICE MASTER', 'NOT COSTED (PC No. không bắt đầu PC-)']);
  eq('PC price: coverage summary', [c.status, c.summary.lots, c.summary.lotsOK, c.summary.notCosted, c.summary.salesUSD, Math.round(c.summary.qtyCover * 1000) / 1000], ['BLOCK', 3, 1, 1, 20, 0.526]);
  eq('PC price: by source', c.bySource.map((x) => [x.source, x.lots, x.salesUSD]), [['CURRENT MONTH ACTUAL', 1, 20]]);
  const full = pcPriceCheck({ ...s2, pc: s2.pc.slice(0, 1) }, pm, P2);
  eq('PC price: all lots priced → PASS', full.status, 'PASS');
  eq('PC price: STEP 2 newer than Price Master → RERUN PRICE MASTER', pcPriceCheck({ ...s2, runAt: '2026-10-13T04:00:00Z' }, pm, P2).status, 'RERUN PRICE MASTER');
  eq('PC price: Price Master of another period → RERUN', pcPriceCheck(s2, { ...pm, period: '2026-07' }, P2).status, 'RERUN PRICE MASTER');
}

// ---- v1.14.23 import templates: the guide examples import cleanly with the real readers; the guide sheet is never read as data
{
  const T = await import('../src/engine/templates.js');
  const S3 = await import('../src/engine/step3.js');
  const F4x = await import('../src/engine/step4.js');
  const FPx = await import('../src/engine/fgprod.js');
  const P9 = '2026-09';
  const book = (sheets, fill) => Object.fromEntries(sheets.map((sh, i) => [sh.name, i === 0 ? [...sh.aoa, ...fill] : sh.aoa]));
  const guideOnly = (sheets) => ({ [T.GUIDE_SHEET]: sheets.find((x) => x.name === T.GUIDE_SHEET).aoa });
  const thrown = (fn) => { try { const r = fn(); return r === null || r === undefined ? 'null' : ''; } catch (e) { return e.message; } };
  // WIP opening
  const wip = T.wipOpeningTemplate(P9);
  const gw = book(wip, T.exampleRows(T.WIP_COLS));
  const det = S3.detectOpeningSource(gw);
  const { opening } = S3.openingFromSource(gw, det, 'wip.xlsx', P9);
  eq('template WIP: examples read from WIP_OPENING (2 rows, codes, amounts)', [det.sheet, opening.rows.length, opening.rows.map((r) => String(r.code)), opening.rows.map((r) => r.amt)], ['WIP_OPENING', 2, ['50120788', '300001'], [600991.2, 1250000]]);
  eq('template WIP: guide sheet alone is not a WIP table', S3.detectOpeningSource(guideOnly(wip)), null);
  // FG opening (template rows 1–4 as in STEP 5.1 + guide)
  const fgData = { name: 'FG_OPENING', aoa: [[F5.TPL_MARKER, 'v1', 'x'], ['Opening Period', '', P9, 'Source Closing', '2026-08', 'Prepared By', 'tester', 'Prepared At'], ['note'], F5.TPL_HEADERS] };
  const gf = book([fgData, T.fgOpeningGuide(P9)], T.exampleRows(T.FG_OPEN_COLS));
  const of = F5.importOpeningFG(gf, 'fg.xlsx', P9); F5.validateOpeningFG(of, P9);
  eq('template FG opening: 2 example lots validate', [of.rows.length, of.status, of.rows.filter((r) => /ERROR|BLOCK/.test(String(r.status))).length], [2, 'VALIDATED', 0]);
  // v1.14.76: RM split, Unit Cost, Provision USD, Net Inventory
  eq('template FG opening v2: example 1 carries the RM split (24M PC RM, 5M Stock Out, 1M adj)', [of.rows[0].splitOK, of.rows[0].rmPC, of.rows[0].rmSO, of.rows[0].rmAdj], [true, 24000000, 5000000, 1000000]);
  eq('template FG opening v2: example 2 without split keeps all RM as PC RM; Provision USD and Net Inventory read', [of.rows[1].splitOK, of.rows[1].rmPC, of.rows[1].provUSD, of.rows[1].netIn], [false, 5250000, -6, 6850000]);
  const fgRun = F5.runFIFO({ period: P9, opening: of, caRows: [], salesRows: [], pmRows: [], fx: 25000, overrides: {}, dupDecisions: {}, mode: 'MONTHLY', tol: 1, step4: { current: 'CURRENT', overall: 'PASS', finalCost: 0, qty: 0 } });
  const cl0 = fgRun.closing.find((c) => c.pc === of.rows[0].pc);
  eq('template FG opening v2: the RM split goes into the FIFO layer and the closing', [cl0 && cl0.splitOK, cl0 && Math.round(cl0.rmPC), cl0 && Math.round(cl0.rmSO)], [true, 24000000, 5000000]);
  const fgBad = (patch) => { const rowsX = T.exampleRows(T.FG_OPEN_COLS); const H = F5.TPL_HEADERS; const r0 = [...(rowsX[0] || [])]; for (const [h, v] of Object.entries(patch)) r0[H.indexOf(h)] = v; const g2 = book([fgData, T.fgOpeningGuide(P9)], [r0]); const o = F5.importOpeningFG(g2, 'fg.xlsx', P9); F5.validateOpeningFG(o, P9); return o.rows[0]; };
  eq('template FG opening v2: Unit Cost ≠ Total / Qty → REVIEW', /Unit Cost/.test(fgBad({ 'Unit Cost': 300000 }).msg) && fgBad({ 'Unit Cost': 300000 }).status === 'REVIEW', true);
  eq('template FG opening v2: Net Inventory ≠ Total + Provision → REVIEW', /Net Inventory/.test(fgBad({ 'Net Inventory': 1 }).msg), true);
  eq('template FG opening v2: RM split above RM Amount → BLOCK', fgBad({ 'RM cost': 29000000 }).status, 'BLOCK');
  const v1Data = { name: 'FG_OPENING', aoa: [[F5.TPL_MARKER, 'v1', 'x'], ['Opening Period', '', P9, 'Source Closing', '2026-08', 'Prepared By', 'tester', 'Prepared At'], ['note'], F5.TPL_HEADERS_V1] };
  const v1Row = ['PC-2608-0012', '2026-08-20', 'MO-1', 'SP101-10-043-003', 'Seat', 'FG', 'PCS', 120, 30000000, 4000000, 6000000, 40000000, 137.78, -150000, '', 'ref', ''];
  const ov1 = F5.importOpeningFG(book([v1Data], [v1Row]), 'old.xlsx', P9); F5.validateOpeningFG(ov1, P9);
  eq('template FG opening: the old 17-column layout still imports', [ov1.rows.length, ov1.rows[0].rm, ov1.rows[0].tot, ov1.rows[0].prov, ov1.rows[0].splitOK, ov1.status], [1, 30000000, 40000000, -150000, false, 'VALIDATED']);
  eq('template FG opening: guide sheet alone is not a template', /Không thấy template/.test(thrown(() => F5.importOpeningFG(guideOnly([T.fgOpeningGuide(P9)].map((x) => x)), 'g.xlsx', P9))), true);
  // FG production YTD
  const fpData = { name: 'FG_PRODUCTION', aoa: FPx.templateAOA([], P9) };
  const gp = book([fpData, T.fgProductionGuide(P9)], T.exampleRows(T.FG_PROD_COLS));
  const op = FPx.importOpening(gp, 'fp.xlsx', P9);
  eq('template FG production: 2 example rows, no BLOCK', [op.rows.length, op.block || 0], [2, 0]);
  eq('template FG production: guide sheet alone is not a table', /Không tìm thấy bảng/.test(thrown(() => FPx.importOpening(guideOnly([T.fgProductionGuide(P9)]), 'g.xlsx', P9))), true);
  // Sales revenue (TK 511)
  const sales = T.salesTemplate(P9);
  const ss = F4x.importSales(book(sales, T.exampleRows(T.SALES_COLS)), 's.xlsx', 'MONTHLY', P9);
  const sv = F4x.validateSaveSales(ss, { rows: [] }, P9, { book: 'SALES' });
  eq('template sales: 2 example lines saved, none blocked or skipped', [ss.rows.length, sv.stats.saved, sv.stats.skipped], [2, 2, 0]);
  eq('template sales: example 2 (B/L in October) is recognised in October', sv.db.rows.map((r) => r.month), [9, 10]);
  // v1.14.57: ED Number and Provision Reversal are read by header name and kept on the saved line
  eq('template sales: ED Number and Provision Reversal carried to the Sales Database', sv.db.rows.map((r) => [r.edNo, r.provRev]), [['ED-306012345678', null], ['ED-306012349999', 1250000]]);
  eq('template sales: Customer - Item Code carried to the Sales Database', sv.db.rows.map((r) => r.custItem), ['TRV-DOONA-SS', '48-22-8442']);
  eq('template sales: guide sheet alone is not a sales table', /Không tìm thấy sheet doanh thu/.test(thrown(() => F4x.importSales(guideOnly(sales), 'g.xlsx', 'MONTHLY', P9))), true);
  // Returns (TK 5212 / 5213)
  const rets = T.returnsTemplate(P9);
  const rs = F4x.importSales(book(rets, T.exampleRows(T.RETURN_COLS)), 'r.xlsx', 'MONTHLY', P9);
  const rv = F4x.validateSaveSales(rs, { rows: [] }, P9, { book: 'RETURNS' });
  eq('template returns: SALES RETURN + CREDIT NOTE examples saved in the returns book', [rv.stats.saved, rv.stats.skipped, rv.db.rows.map((r) => r.tranType)], [2, 0, ['SALES RETURN', 'CREDIT NOTE']]);
  // SO price list
  const so = T.soTemplate(P9);
  const sr = F4x.parseSOGrids(book(so, T.exampleRows(T.SO_COLS)));
  eq('template SO: 2 example rows with full product codes and prices', [sr.length, sr.map((r) => r.product), sr.map((r) => r.price)], [2, ['SP101-10-043-003', 'OLI-5017VU'], [137.78, 34.6]]);
  eq('template SO: guide sheet alone is not an SO table', /Không tìm thấy bảng/.test(thrown(() => F4x.parseSOGrids(guideOnly(so)))), true);
  // every guide has its header row styled and one line per data column
  eq('template guides: one guide line per data column', [wip, sales, rets, so].map((x) => x[1].aoa.length - x[1].header === x[0].aoa[x[0].header - 1].length), [true, true, true, true]);
}

// ---- v1.14.25 STEP 1 ERP data-quality check: listed, persistent, must be confirmed before STEP 2
{
  const DQ = await import('../src/engine/dataquality.js');
  const { step1Controls } = await import('../src/engine/controls.js');
  const HM = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Material Name', 'Quantity', 'Total Cost'];
  const pcmT = buildDataset([['x'], HM, ['PC-1', 'A', 'a', '50728557', 'Tape', 1.145, 0], ['PC-2', 'A', 'a', '50728557', 'Tape', 2, 0], ['PC-1', 'A', 'a', 'OK1', 'ok', 5, 100], [null, null, null, null, null, 9, 0]], 'PC-M-T-202608.xlsx', P2);
  // dataset imported by an older version (no import gate): a negative and a text value are still found
  const pcmO = { key: 'PC-M-O', headerRow: 1, header: HM, rows: [['PC-9', 'B', 'b', '326551', 'PE board', 1018.08, 0], ['PC-9', 'B', 'b', 'NEG1', 'n', -3, 10], ['PC-9', 'B', 'b', 'TXT1', 't', '1,5', 5]] };
  const HI = ['MI No.', 'Material Code', 'Material Name', 'Current Issue Qty', 'Total Cost'];
  const mimT = { key: 'MI-M-T', headerRow: 1, header: HI, rows: [['MI-1', '50661189', 'Liki', 700, 0], ['MI-2', 'OK2', 'ok', 3, 30]] };
  const ds = { 'PC-M-T': pcmT, 'PC-M-O': pcmO, 'MI-M-T': mimT };
  const an = DQ.erpAnomalies(ds);
  eq('DQ: abnormal lines by report / type (footer row ignored)', an.summary.map((g) => [g.report, g.type, g.lines, g.materials]), [['PC-M-T', 'ZERO COST', 2, 1], ['PC-M-O', 'ZERO COST', 1, 1], ['PC-M-O', 'NEGATIVE', 1, 1], ['PC-M-O', 'TEXT', 1, 1], ['MI-M-T', 'ZERO COST', 1, 1]]);
  eq('DQ: Excel row numbers and materials listed', [an.lines[0].row, an.lines[0].mat, an.materials], [3, '50728557', 5]);
  eq('DQ: not confirmed → BLOCK - CONFIRM', DQ.anomalyStatus(an, null), 'BLOCK - CONFIRM');
  const ack = { fp: an.fp, by: 'a@svl', at: '2026-10-13T09:00:00Z', note: 'Hàng khách cấp' };
  eq('DQ: confirmed for this list → REVIEW - CONFIRMED', DQ.anomalyStatus(an, ack), 'REVIEW - CONFIRMED');
  const an2 = DQ.erpAnomalies({ ...ds, 'MI-M-T': { ...mimT, rows: [...mimT.rows, ['MI-3', 'NEW', 'new', 1, 0]] } });
  eq('DQ: list changed by a re-import → confirmation needed again', DQ.anomalyStatus(an2, ack), 'BLOCK - CONFIRM');
  eq('DQ: clean data → PASS', DQ.anomalyStatus(DQ.erpAnomalies({ 'MI-M-T': { ...mimT, rows: [mimT.rows[1]] } }), null), 'PASS');
  const s1 = { checklist: Array.from({ length: 21 }, () => ({ status: 'IMPORTED', dataRows: 1 })), bySys: { T: { status: 'READY' }, S: { status: 'READY' }, O: { status: 'READY' } } };
  const c1 = step1Controls(s1, 0, [], { ...an, status: DQ.anomalyStatus(an, null), blocking: DQ.blockingParts(an, null) });
  eq('STEP 1: unconfirmed anomalies block STEP 1 (status / result / next lists the blocking parts)', [c1.status, c1.result, /^Rà soát và xác nhận dữ liệu ERP bất thường \(STEP 1\) trước khi chạy STEP 2: A: \d+ .*\(chưa xác nhận\); B: \d+ .*\(chưa xác nhận\); C: \d+ .*\(chưa xác nhận\)$/.test(c1.next)], ['BLOCK', 'BLOCK - XÁC NHẬN DỮ LIỆU BẤT THƯỜNG', true]);
  // v1.14.67: notifications name each blocking part, and a part changed since its confirmation is labelled as such
  const dA = { parts: { A: { count: 0, fp: '' }, B: { count: 0, fp: '' }, C: { count: 0, fp: '' }, D: { count: 2, fp: 'new' } } };
  const dAck = { parts: { D: { fp: 'old', count: 2, by: 'a@svl', at: '2026-10-13T09:00:00Z', note: 'ok' } } };
  const blk = DQ.blockingParts(dA, dAck);
  eq('DQ: part D confirmed before a PC-P adjustment → CHANGED and blocking', [blk.map((p) => [p.key, p.status, p.count]), DQ.blockingSummary(blk)], [[['D', 'CHANGED', 2]], 'D: 2 lô PC bất thường (PC-P) (thay đổi sau lần xác nhận)']);
  eq('DQ: nothing blocking when every non-empty part is confirmed', DQ.blockingParts(dA, { parts: { D: { fp: 'new', count: 2, by: 'a', at: '', note: '' } } }), []);
  const c2 = step1Controls(s1, 0, [], { ...an, status: DQ.anomalyStatus(an, ack) });
  eq('STEP 1: confirmed anomalies → PASS WITH REVIEW, next = STEP 2', [c2.status, c2.result, c2.next], ['PASS WITH REVIEW', 'PASS - ĐÃ XÁC NHẬN BẤT THƯỜNG', 'Chạy STEP 2']);
}

// ---- v1.14.26 STEP 1: PC-P vs PC-M per system (T / S / O) is part of the confirmed data check
{
  const DQ = await import('../src/engine/dataquality.js');
  const HP = ['PC No.', 'Product Code', 'Product Name', 'Current Complete Qty', 'Total Cost'];
  const HM = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Material Name', 'Quantity', 'Total Cost'];
  const P = (e, rows) => buildDataset([HP, ...rows], `PC-P-${e}-202608.xlsx`, P2);
  const M = (e, rows) => buildDataset([['x'], HM, ...rows], `PC-M-${e}-202608.xlsx`, P2);
  const ds = {
    'PC-P-T': P('T', [['PC-1', 'SP1', 's', 10, 1000]]), 'PC-M-T': M('T', [['PC-1', 'SP1', 's', 'M1', 'm', 5, 600], ['PC-1', 'SP1', 's', 'M2', 'm', 5, 400]]),
    'PC-P-O': P('O', [['PC-7', 'OLI-1', 'o', 4, 500], ['PC-8', 'OLI-2', 'o', 4, 300]]),
    'PC-M-O': M('O', [['PC-7', 'OLI-1', 'o', 'X1', 'x', 4, 494.39], ['PC-9', 'OLI-3', 'o', 'X2', 'x', 1, 50]]),
  };
  const rc = DQ.pcpPcmRecon(ds);
  eq('PC-P/PC-M: per system status', rc.bySys.map((x) => [x.erp, x.status, x.gaps, x.onlyM, x.onlyP]), [['T', 'PASS', 0, 0, 0], ['O', 'CHECK', 1, 1, 1]]);
  eq('PC-P/PC-M: gap and one-sided PCs listed with amounts', rc.issues.map((x) => [x.type, x.pcNo, Math.round(x.diff * 100) / 100]), [['CHỈ CÓ Ở PC-P', 'PC-8', -300], ['CHỈ CÓ Ở PC-M', 'PC-9', 50], ['LỆCH', 'PC-7', -5.61]]);
  const an = DQ.erpAnomalies(ds);
  eq('PC-P/PC-M gap alone requires the STEP 1 confirmation', [an.lines.length, an.issues, DQ.anomalyStatus(an, null)], [0, 3, 'BLOCK - CONFIRM']);
  const ack = { fp: an.fp };
  const ds2 = { ...ds, 'PC-M-O': M('O', [['PC-7', 'OLI-1', 'o', 'X1', 'x', 4, 490], ['PC-9', 'OLI-3', 'o', 'X2', 'x', 1, 50]]) };
  eq('PC-P/PC-M: confirmed list stays confirmed; changed amounts need a new confirmation', [DQ.anomalyStatus(an, ack), DQ.anomalyStatus(DQ.erpAnomalies(ds2), ack)], ['REVIEW - CONFIRMED', 'BLOCK - CONFIRM']);
  const clean = { 'PC-P-T': ds['PC-P-T'], 'PC-M-T': ds['PC-M-T'] };
  eq('PC-P/PC-M: all systems equal → PASS', DQ.anomalyStatus(DQ.erpAnomalies(clean), null), 'PASS');
}

// ---- v1.14.30 STEP 1: each part (A PC-P/PC-M · B ZERO COST · C NEGATIVE/TEXT) is confirmed and cleared on its own
{
  const DQ = await import('../src/engine/dataquality.js');
  const HP = ['PC No.', 'Product Code', 'Product Name', 'Current Complete Qty', 'Total Cost'];
  const HM = ['PC No.', 'Product Code', 'Product Name', 'Material Code', 'Material Name', 'Quantity', 'Total Cost'];
  const ds = {
    'PC-P-O': buildDataset([HP, ['PC-7', 'OLI-1', 'o', 4, 500], ['PC-8', 'OLI-2', 'o', 4, 300]], 'PC-P-O-202608.xlsx', P2),
    'PC-M-O': { key: 'PC-M-O', headerRow: 1, header: HM, rows: [['PC-7', 'OLI-1', 'o', 'X1', 'x', 4, 494.39], ['PC-9', 'OLI-3', 'o', 'X2', 'x', 1, 50], ['PC-7', 'OLI-1', 'o', 'Z1', 'z', 2, 0], ['PC-7', 'OLI-1', 'o', 'N1', 'n', -1, 5]] },
  };
  const an = DQ.erpAnomalies(ds);
  eq('v1.14.30 DQ parts: A = PC gaps, B = zero cost, C = negative', [an.parts.A.count, an.parts.B.count, an.parts.C.count], [an.recon.issues.length, 1, 1]);
  eq('v1.14.30 DQ parts: all three start NOT CONFIRMED → BLOCK', ['A', 'B', 'C'].map((k) => DQ.partStatus(an, null, k)).concat(DQ.anomalyStatus(an, null)), ['NOT CONFIRMED', 'NOT CONFIRMED', 'NOT CONFIRMED', 'BLOCK - CONFIRM']);
  const ackA = { A: { fp: an.parts.A.fp, count: an.parts.A.count, by: 'a@svl', at: '2026-10-14T09:00:00Z', note: 'PC lệch do xuất lệch giờ' } };
  eq('v1.14.30 DQ parts: confirming A alone leaves B/C blocked', [DQ.partStatus(an, { parts: ackA }, 'A'), DQ.partStatus(an, { parts: ackA }, 'B'), DQ.anomalyStatus(an, { parts: ackA })], ['CONFIRMED', 'NOT CONFIRMED', 'BLOCK - CONFIRM']);
  const ackAll = { parts: { ...ackA, B: { fp: an.parts.B.fp, count: 1, by: 'a@svl', at: 't', note: 'Hàng khách cấp' }, C: { fp: an.parts.C.fp, count: 1, by: 'a@svl', at: 't', note: 'Số âm do điều chỉnh kho' } } };
  eq('v1.14.30 DQ parts: all three confirmed → REVIEW - CONFIRMED', DQ.anomalyStatus(an, ackAll), 'REVIEW - CONFIRMED');
  const ds2 = { ...ds, 'PC-M-O': { key: 'PC-M-O', headerRow: 1, header: HM, rows: [['PC-7', 'OLI-1', 'o', 'X1', 'x', 4, 494.39], ['PC-9', 'OLI-3', 'o', 'X2', 'x', 1, 50], ['PC-7', 'OLI-1', 'o', 'Z1', 'z', 2, 0], ['PC-7', 'OLI-1', 'o', 'N1', 'n', -1, 5], ['PC-7', 'OLI-1', 'o', 'Z2', 'z', 3, 0]] } };
  const an2 = DQ.erpAnomalies(ds2);
  eq('v1.14.30 DQ parts: a new zero-cost line makes only B CHANGED (A, C stay confirmed)', [an2.parts.B.count, DQ.partStatus(an2, ackAll, 'B'), DQ.partStatus(an2, ackAll, 'A'), DQ.partStatus(an2, ackAll, 'C'), DQ.anomalyStatus(an2, ackAll)], [2, 'CHANGED', 'CONFIRMED', 'CONFIRMED', 'BLOCK - CONFIRM']);
  const cleared = { parts: { ...ackAll.parts } }; delete cleared.parts.B;
  eq('v1.14.30 DQ parts: clearing B re-blocks STEP 2; A and C keep their confirmation', [DQ.partStatus(an, cleared, 'B'), DQ.partStatus(an, cleared, 'A'), DQ.partStatus(an, cleared, 'C'), DQ.anomalyStatus(an, cleared)], ['NOT CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'BLOCK - CONFIRM']);
  const clean = DQ.erpAnomalies({ 'PC-P-O': ds['PC-P-O'], 'PC-M-O': { key: 'PC-M-O', headerRow: 1, header: HM, rows: [['PC-7', 'OLI-1', 'o', 'X1', 'x', 4, 500], ['PC-8', 'OLI-2', 'o', 'X3', 'x', 4, 300], ['PC-7', 'OLI-1', 'o', 'Z1', 'z', 2, 0]] } });
  eq('v1.14.30 DQ parts: a part with no abnormal line is NONE and does not block', [DQ.partStatus(clean, null, 'A'), DQ.partStatus(clean, null, 'C'), DQ.anomalyStatus(clean, { parts: { B: { fp: clean.parts.B.fp, count: clean.parts.B.count, by: 'x', at: 't', note: 'n' } } })], ['NONE', 'NONE', 'REVIEW - CONFIRMED']);
  const legacy = DQ.ackParts({ fp: an.fp, by: 'a@svl', at: 't', note: 'bản cũ' }, an);
  eq('v1.14.30 DQ parts: a v1.14.29 single-fp confirmation converts to parts for the same list', [Object.keys(legacy).sort(), DQ.anomalyStatus(an, { fp: an.fp, by: 'a@svl', at: 't', note: 'bản cũ' })], [['A', 'B', 'C'], 'REVIEW - CONFIRMED']);
  eq('v1.14.30 DQ parts: a v1.14.29 confirmation of an older list is not converted', DQ.anomalyStatus(an2, { fp: an.fp, by: 'a@svl', at: 't', note: 'bản cũ' }), 'BLOCK - CONFIRM');
}

// ---- v1.14.31 2B: FG tiêu dùng nội bộ – chọn, xác nhận (lý do bắt buộc), chờ RUN FIFO, hoàn tác
{
  const C = await import('../src/engine/step2.js');
  const row = (o) => ({ active: 'Y', rid: 'R1', rwType: 'NORMAL', rwStatus: 'OPEN', pcNo: null, outFG: 'FG1', compDate: null, compQty: null, scrapQty: null, issueQty: 5, fifoStatus: 'PASS', fifoCost: 100, erpRef: 120, issueDate: 46000, fg: 'FG1', fgName: 'x', dispNote: null, inputCheck: 'PASS', ...o });
  const rows = () => [row({ rid: 'R1' }), row({ rid: 'R2', rwStatus: 'HOLD', issueQty: 3 }), row({ rid: 'R3', rwStatus: 'COMPLETED', pcNo: 'PC9', compQty: 5 }), row({ rid: 'R4', active: 'B/F' }), row({ rid: 'R5' })];
  const r0 = rows();
  eq('2B consumption: only active rows not yet finalised are eligible (OPEN, HOLD)', r0.map((r) => C.consFgEligible(r)), [true, true, false, false, true]);
  const bad = C.confirmConsFg(r0, ['R1', 'R2'], 'ab', 'a@svl', '2026-10-14T01:00:00Z');
  eq('2B consumption: reason under 5 characters blocks the confirmation, nothing changes', [bad.ok, r0[0].rwStatus, r0[1].rwStatus], [false, 'OPEN', 'HOLD']);
  eq('2B consumption: empty selection blocks the confirmation', C.confirmConsFg(r0, [], 'Dùng làm mẫu', 'a', 't').ok, false);
  eq('2B consumption: a completed row in the selection blocks the whole confirmation', [C.confirmConsFg(r0, ['R1', 'R3'], 'Dùng làm mẫu', 'a', 't').ok, r0[0].rwStatus], [false, 'OPEN']);
  eq('2B consumption: a B/F row cannot be selected', C.confirmConsFg(r0, ['R4'], 'Dùng làm mẫu', 'a', 't').ok, false);
  const ok = C.confirmConsFg(r0, ['R1', 'R2'], '  Dùng làm mẫu thử nội bộ ', 'a@svl', '2026-10-14T01:00:00Z');
  eq('2B consumption: confirm sets CONSUMPTION, reason and who/when; FIFO cost is reset until STEP 5.2 runs', [ok.ok, r0[0].rwStatus, r0[0].dispNote, r0[0].dispBy, r0[0].fifoStatus, r0[0].fifoCost, r0[1].rwStatus], [true, 'CONSUMPTION', 'Dùng làm mẫu thử nội bộ', 'a@svl', 'NOT COSTED - RUN STEP 5.2', 0, 'CONSUMPTION']);
  eq('2B consumption: rows outside the selection keep their status', [r0[4].rwStatus, r0[2].rwStatus], ['OPEN', 'COMPLETED']);
  eq('2B consumption: confirmed rows need no PC / output FG / completion data (input check PASS)', [r0[0].inputCheck, r0[0].pcNo, r0[0].compQty], ['PASS', null, null]);
  eq('2B consumption: confirmed rows are not eligible again', C.confirmConsFg(r0, ['R1'], 'Dùng làm mẫu', 'a', 't').ok, false);
  eq('2B consumption: pending count until STEP 5.2 prices them', C.consFgPendingCount(r0), 2);
  r0[0].fifoStatus = 'PASS'; r0[0].fifoCost = 420;
  eq('2B consumption: a priced row leaves the pending count', C.consFgPendingCount(r0), 1);
  const u = C.undoConsFg(r0[1], 'a@svl', 't');
  eq('2B consumption: undo returns the row to OPEN and asks for a new FIFO run', [u.ok, r0[1].rwStatus, r0[1].dispNote, r0[1].fifoStatus], [true, 'OPEN', null, 'NOT COSTED - RUN STEP 5.2']);
  eq('2B consumption: undo on a row that is not consumption is refused', C.undoConsFg(r0[2], 'a', 't').ok, false);
}

// ---- v1.14.26 STEP 4.4: FIFO sales find the lot by PC No. + product when the FG layer carries another source period; Sep → Oct roll
{
  const FPx = await import('../src/engine/fgprod.js');
  const lotR = (period, pc, prod, qty, total, sold = 0) => ({ period, erp: 'O', pc, prod, qty, totalRM: total, c622: 0, c627: 0, total, soldQty0: sold, soldTot0: sold ? total * sold / qty : 0 });
  const opening = { period: '2026-09', status: 'VALIDATED', rows: [lotR('2026-01', 'PC-2601-102', 'A', 10, 1000, 4), lotR('2026-08', 'PC-2608-005', 'B', 6, 600)] };
  const current = { period: '2026-09', rows: [lotR('2026-09', 'PC-2609-001', 'C', 100, 1000)], sales: [
    { month: '2026-09', kind: 'SALE', lotPeriod: '2026-08', pc: 'PC-2601-102', prod: 'A', inv: 'I1', qty: 1, tot: 100 }, // layer from an Excel month-detail opening (stamped 2026-08)
    { month: '2026-09', kind: 'SALE', lotPeriod: '2026-09', pc: 'PC-2609-001', prod: 'C', inv: 'I2', qty: 40, tot: 400 },
    { month: '2026-09', kind: 'SALE', lotPeriod: '2025-12', pc: 'PC-2512-001', prod: 'Z', inv: 'I3', qty: 5, tot: 50 }] };
  const fp = { opening, current };
  const al = FPx.allocate(FPx.ytdRows(fp, '2026-09'), FPx.ytdSales(fp, '2026-09'));
  const byPc = Object.fromEntries(al.lots.map((r) => [r.pc, r]));
  eq('4.4: sale of an older lot matched by PC No. + product (period stamp differs)', [byPc['PC-2601-102'].soldQty, byPc['PC-2601-102'].remQty, byPc['PC-2609-001'].remQty], [5, 5, 60]);
  eq('4.4: a lot of the previous year stays unmatched (not in the year table)', al.unmatched.map((x) => x.pc), ['PC-2512-001']);
  const roll = FPx.rollOpening(fp, '2026-09', '2026-10');
  const al10 = FPx.allocate(FPx.ytdRows({ opening: roll }, '2026-10'), FPx.ytdSales({ opening: roll }, '2026-10'));
  eq('4.4: roll Sep → Oct keeps Jan–Sep lots and cumulative issues', [roll.kind, roll.rows.length, [...new Set(roll.rows.map((r) => r.period))].sort().join(','), al10.lots.find((r) => r.pc === 'PC-2601-102').soldQty, al10.lots.find((r) => r.pc === 'PC-2609-001').soldQty], ['ROLL', 3, '2026-01,2026-08,2026-09', 5, 40]);
  let rollErr = ''; try { FPx.rollOpening({ opening }, '2026-09', '2026-10'); } catch (e) { rollErr = e.message; }
  eq('4.4: roll refuses when September was not posted from STEP 4.3', /chưa chuyển kết quả STEP 4.3/.test(rollErr), true);
}


// ---- v1.14.27 STEP 4.4 detail model (Carol "FG month detail"): rows split by Cost month, no Cost month = stock
{
  const FD = await import('../src/engine/fgdetail.js');
  const FPx = await import('../src/engine/fgprod.js');
  const T = await import('../src/engine/templates.js');
  const H = FD.DET_HEADERS.slice(0, 27);
  const R = (pc, d, prod, qty, total, cm = null, note = '') => { const r = Array(27).fill(null); Object.assign(r, { 0: pc, 1: d, 2: 'MO', 3: prod, 4: prod + ' name', 5: 'FG', 6: 'PC', 7: qty, 8: total * 0.6, 9: 0, 10: total, 11: total * 0.6, 12: total * 0.2, 13: total * 0.2, 17: cm, 24: note }); return r; };
  const grid = [['Starry'], ['report'], [null], H,
    R('PC-2601-001', ser(2026, 1, 10), 'A', 6, 600, '202603'), R('PC-2601-001', ser(2026, 1, 10), 'A', 4, 400),
    R('PC-2512-009', ser(2025, 12, 20), 'Z', 3, 330, null, 'inventory end of 2025.12'), R('PC-2512-009', ser(2025, 12, 20), 'Z', 2, 220, 202601),
    R('PC-2608-0040', ser(2026, 8, 20), 'B', 10, 1000, '202609'), // Cost month not before the period → stock (REVIEW)
    [null, null, null, null, null, null, null, 'Complete Qty'], R('SCRATCH', ser(2026, 1, 1), 'X', 99, 9)];
  const op = FD.importDetail({ 'FG2026 month detail': grid }, 'carol.xlsx', '2026-09');
  eq('4.4 detail: rows read as they are, scratch block below the second header ignored', [op.rows.length, op.model, op.status], [5, 'DETAIL', 'VALIDATED WITH REVIEW']);
  eq('4.4 detail: opening stock = rows without Cost month (incl. prior-year lot)', [op.stats.stockQty, op.stats.stockTot, op.stats.priorQty, op.stats.priorTot, op.stats.soldQty], [17, 1730, 3, 330, 8]);
  eq('4.4 detail: Cost month 202609 in a 2026-09 opening is treated as stock + REVIEW', [op.rows[4].costMonth, op.rows[4].check], ['', 'REVIEW']);
  const bad = FD.importDetail({ S: [H, R('PC-2609-001', ser(2026, 9, 2), 'C', 1, 1), R('PC-2601-002', ser(2026, 1, 2), 'C', 1, 1, 'xx')] }, 'b.xlsx', '2026-09');
  eq('4.4 detail: lot of the open period / unreadable Cost month → BLOCK', [bad.status, bad.rows.map((r) => r.check)], ['BLOCKED', ['BLOCK', 'BLOCK']]);
  // September: lot from STEP 4.3 + FIFO issues split off (two invoices on lot A, rework on B, unknown lot)
  const current = { period: '2026-09', rows: [{ period: '2026-09', erp: 'O', pc: 'PC-2609-001', prod: 'C', qty: 100, totalRM: 700, c622: 200, c627: 100, total: 1000 }], sales: [
    { month: '2026-09', kind: 'SALE', pc: 'PC-2601-001', prod: 'A', inv: 'I1', qty: 1, tot: 100 }, { month: '2026-09', kind: 'SALE', pc: 'PC-2601-001', prod: 'A', inv: 'I2', qty: 2, tot: 200 },
    { month: '2026-09', kind: 'REWORK', pc: 'PC-2608-0040', prod: 'B', inv: 'RW-1', qty: 10, tot: 1000 },
    { month: '2026-09', kind: 'SALE', pc: 'PC-2609-001', prod: 'C', inv: 'I3', qty: 40, tot: 400 },
    { month: '2026-09', kind: 'SALE', pc: 'PC-2512-009', prod: 'Z', inv: 'I4', qty: 5, tot: 550 }, // only 3 left in 4.4
    { month: '2026-09', kind: 'SALE', pc: 'PC-0000', prod: 'Q', inv: 'I5', qty: 1, tot: 7 }] };
  const fp = { opening: op, current };
  const det = FD.buildDetail(fp, '2026-09');
  const a = det.rows.filter((r) => r.pc === 'PC-2601-001');
  eq('4.4 detail: lot A → old sold row, 3 issued in 202609 (2 invoices on one row), 1 left; values pro rata', a.map((r) => [r.costMonth, r.qty, Math.round(r.total), r.kind, r.docs]), [['2026-03', 6, 600, 'PRIOR', ''], ['2026-09', 3, 300, 'SALE', 'I1, I2'], ['', 1, 100, '', '']]);
  eq('4.4 detail: full rework issue leaves no stock row for lot B', det.rows.filter((r) => r.pc === 'PC-2608-0040').map((r) => [r.costMonth, r.kind, r.qty]), [['2026-09', 'REWORK', 10]]);
  eq('4.4 detail: this month\'s lot split 40 sold / 60 in stock', det.rows.filter((r) => r.pc === 'PC-2609-001').map((r) => [r.costMonth, r.qty, r.total, r.c622]), [['2026-09', 40, 400, 80], ['', 60, 600, 120]]);
  eq('4.4 detail: FIFO not found / not enough in 4.4 reported', det.unmatched.map((u) => [u.pc, u.qty, /không đủ/.test(u.why)]), [['PC-2512-009', 2, true], ['PC-0000', 1, false]]);
  eq('4.4 detail: closing stock', [det.stats.stockQty, Math.round(det.stats.stockTot)], [61, 700]);
  // reconciliation with STEP 5.1 / 5.2 (review only)
  const fgOpen = { period: '2026-09', status: 'VALIDATED', rows: [{ pc: 'PC-2601-001', prod: 'A', qty: 4, tot: 400 }, { pc: 'PC-2512-009', prod: 'Z', qty: 3, tot: 330 }, { pc: 'PC-2608-0040', prod: 'B', qty: 10, tot: 990 }] };
  const res = { period: '2026-09', detail: [{ lid: 'L1', qty: 3, tot: 300 }, { lid: 'L3', qty: 40, tot: 400 }, { lid: 'L4', qty: 5, tot: 550 }, { lid: 'L5', qty: 1, tot: 7 }], rework: { rows: [{ lid: 'L2', qty: 10, tot: 990 }] },
    closing: [{ pc: 'PC-2601-001', prod: 'A', qty: 1, tot: 100 }, { pc: 'PC-2609-001', prod: 'C', qty: 60, tot: 600 }] };
  const rc = FD.reconcile(det, fgOpen, res, '2026-09');
  eq('4.4 recon: opening 17/1730 vs 5.1 17/1720 → LỆCH 10 VND (lot B)', [rc.rows[0].q44, rc.rows[0].q5, Math.round(rc.rows[0].da), rc.rows[0].status], [17, 17, 10, 'LỆCH']);
  eq('4.4 recon: COGS 4.4 vs FIFO, rework, consumption (none), unmatched, closing', rc.rows.slice(1).map((r) => [r.q44, r.q5, r.status]), [[46, 49, 'LỆCH'], [10, 10, 'LỆCH'], [0, 0, 'KHỚP'], [0, 3, 'LỆCH'], [61, 61, 'KHỚP']]);
  eq('4.4 recon: lot differences (opening value, closing prior-year lot only in 4.4)', rc.lots.map((l) => [l.side, l.type, l.pc, Math.round(l.da)]), [['Đầu kỳ', 'LỆCH GIÁ TRỊ', 'PC-2608-0040', 10]]);
  eq('4.4 recon status is REVIEW (never BLOCK)', rc.status, 'REVIEW');
  const ok = FD.reconcile(FD.buildDetail({ opening: op, current: { period: '2026-09', rows: [], sales: [] } }, '2026-09'), { period: '2026-09', rows: [{ pc: 'PC-2601-001', prod: 'A', qty: 4, tot: 400 }, { pc: 'PC-2512-009', prod: 'Z', qty: 3, tot: 330 }, { pc: 'PC-2608-0040', prod: 'B', qty: 10, tot: 1000 }] }, null, '2026-09');
  eq('4.4 recon: opening equal → KHỚP, no FIFO yet → PARTIAL', [ok.rows[0].status, ok.status, ok.lots.length], ['KHỚP', 'PARTIAL', 0]);
  // lot tabs keep working: this year's lots with sold-before from the rows; only this month's FIFO applied
  const lots = FPx.ytdRows(fp, '2026-09');
  eq('4.4 detail → year lots (prior-year lot excluded)', lots.map((l) => [l.pc, l.qty, l.soldQty0]), [['PC-2601-001', 10, 6], ['PC-2608-0040', 10, 0], ['PC-2609-001', 100, undefined]]);
  const al = FPx.allocate(lots, FPx.allocSales(fp, '2026-09'));
  eq('4.4 detail: lot remaining = 4.4 stock', al.lots.map((l) => l.remQty), [1, 0, 60]);
  // roll Sep → Oct (detail) and Dec → Jan (stock rows only)
  const oct = FPx.rollOpening(fp, '2026-09', '2026-10');
  eq('4.4 detail roll: all rows, stock = September closing', [oct.model, oct.kind, oct.rows.length, oct.stats.stockQty, Math.round(oct.stats.stockTot), oct.stats.costMonths.join(',')], ['DETAIL', 'ROLL', det.rows.length, 61, 700, '2026-01,2026-03,2026-09']);
  const jan = FPx.rollOpening({ opening: { ...op, period: '2026-12' }, current: { period: '2026-12', rows: [], sales: [] } }, '2026-12', '2027-01');
  eq('4.4 detail roll into January keeps only rows in stock', [jan.kind, jan.rows.length, jan.rows.every((r) => !r.costMonth), jan.stats.stockQty], ['NEW YEAR', 3, true, 17]);
  // next-period file (Carol layout) reads back with the same reader
  const sh = FD.detailSheets(FD.nextOpeningRows(det.rows, '2026-10'), '2026-10', 'test');
  const flat = sh[0].aoa.map((r) => r.map((c) => (c && typeof c === 'object' && 'v' in c ? c.v : c)));
  const back = FD.importDetail({ FG_DETAIL: flat }, 'next.xlsx', '2026-10');
  eq('4.4 detail file round-trips (rows, stock, Cost months, kinds)', [back.status, back.rows.length, back.stats.stockQty, Math.round(back.stats.stockTot), back.rows.filter((r) => r.kind === 'REWORK').length], ['VALIDATED', det.rows.length, 61, 700, 1]);
  eq('4.4 detail file: sheets', sh.map((x) => x.name), ['FG_DETAIL', 'TONG_HOP']);
  // old lot opening → detail rows (sold-before kept as an issued row)
  const legacy = { period: '2026-09', status: 'VALIDATED', through: '2026-08', rows: [{ period: '2026-02', pc: 'PC-2602-001', prod: 'L', qty: 10, totalRM: 600, c622: 200, c627: 200, total: 1000, soldQty0: 4 }] };
  const ld = FD.buildDetail({ opening: legacy }, '2026-09');
  eq('4.4 old lot opening converted (sold-before row + stock row)', ld.rows.map((r) => [r.costMonth, r.qty, r.total]), [['2026-08', 4, 400], ['', 6, 600]]);
  // guide examples import with the real reader; the guide alone is not a table
  const tpl = FD.detailSheets([], '2026-09')[0];
  const gd = FD.importDetail({ FG_DETAIL: [...tpl.aoa, ...T.exampleRows(T.DETAIL_GUIDE)] }, 'ex.xlsx', '2026-09');
  eq('template 4.4 detail: 2 example rows (one stock, one sold 202608), no BLOCK', [gd.rows.length, gd.stats.block, gd.stats.stockQty, gd.stats.soldQty], [2, 0, 12, 5]);
  eq('template 4.4 detail: guide sheet alone is not a table', FD.findDetailSheet({ [T.GUIDE_SHEET]: T.fgDetailGuide('2026-09').aoa }), null);
}

// ---- audit wave 2 (ENH-08): actor fixed at event time, never re-attributed at upload
{
  const A = { uid: 'uid-a', email: 'A@x.com', role: 'editor' }, B = { uid: 'uid-b', email: 'b@x.com', role: 'admin' };
  const eA = AQ.makeAuditEvent({ period: '2026-09', action: 'CLOSE', detail: 'd', app: 'v', at: '2026-09-30T10:00:00Z', actor: A, deviceId: 'dev1', eventId: 'e1' });
  eq('ENH-08 event keeps actor uid/email/role of the moment', [eA.attribution, eA.actorUid, eA.actorEmail, eA.actorRole], ['ACTOR', 'uid-a', 'a@x.com', 'editor']);
  const eAnon = AQ.makeAuditEvent({ period: '2026-09', action: 'SAVE', detail: '', app: 'v', actor: null, eventId: 'e2' });
  eq('ENH-08 event without a signed-in actor is UNVERIFIED', [eAnon.attribution, eAnon.actorUid], ['UNVERIFIED', '']);
  eq('ENH-08 A event is not uploadable by B', AQ.mayUpload(eA, B.uid), false);
  eq('ENH-08 A event is uploadable by A', AQ.mayUpload(eA, A.uid), true);
  eq('ENH-08 unverified event is uploadable by anyone signed in', AQ.mayUpload(eAnon, B.uid), true);
  const part = AQ.partitionQueue([eA, eAnon], B.uid);
  eq('ENH-08 B signing in uploads only unverified; A event waits', [part.ready.map((e) => e.eventId), part.waiting.map((e) => e.eventId)], [['e2'], ['e1']]);
  const docB = AQ.toAuditDoc(eAnon, B);
  eq('ENH-08 unverified event is stored under the uploader, flagged', [docB.by, docB.attribution, docB.actorUid], ['b@x.com', 'UNVERIFIED', '']);
  const docA = AQ.toAuditDoc(eA, A);
  eq('ENH-08 ACTOR doc carries actorUid and by == actor email', [docA.by, docA.actorUid, docA.actorEmail, docA.eventId], ['a@x.com', 'uid-a', 'a@x.com', 'e1']);
  const legacy = AQ.normalizeQueue([{ period: '2026-08', at: '2026-08-02T00:00:00Z', action: 'OLD', detail: 'x', app: '1.14.30' }]);
  eq('ENH-08 legacy queue entry gets an id and is UNVERIFIED', [legacy[0].attribution, typeof legacy[0].eventId, legacy[0].eventId.length > 10], ['UNVERIFIED', 'string', true]);
  eq('ENH-08 event ids are unique', new Set([0, 1, 2, 3, 4].map(() => AQ.newEventId())).size, 5);
  eq('ENH-08 detail capped at 2000 chars', AQ.makeAuditEvent({ period: 'p', action: 'a', detail: 'z'.repeat(3000), eventId: 'e3' }).detail.length, 2000);
}

// ---- wave 3 (ENH-07 / ENH-09 / ENH-10): retry policy, outbox, commit confirmation
eq('ENH-07 retry delays 2s,4s,8s … capped at 60s', [1, 2, 3, 4, 5, 6, 9].map((k) => SP.retryDelayMs(k)), [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
eq('ENH-07 retry stops after the limit', [SP.shouldRetry(0), SP.shouldRetry(1), SP.shouldRetry(SP.RETRY_LIMIT), SP.shouldRetry(SP.RETRY_LIMIT + 1)], [false, true, true, false]);
eq('ENH-07 outbox lists other periods only, sorted, unique', SP.outboxOthers(['2026-10', '2026-08', '2026-08', '', '2026-09'], '2026-10'), ['2026-08', '2026-09']);
eq('ENH-09 commit confirmed only when the cloud holds this close timestamp', [SP.closeCommitted({ summary: { closed: 'T1' } }, 'T1'), SP.closeCommitted({ summary: { closed: 'T0' } }, 'T1'), SP.closeCommitted(null, 'T1'), SP.closeCommitted({ summary: { closed: null } }, 'T1')], [true, false, false, false]);

// ---- v1.14.79 revenue · COGS · GP by customer (engine/custpl.js): hand-made STEP 5 lines
{
  const { customerPL, customerJournal, plSheetRows } = await import('../src/engine/custpl.js');
  const sales = [
    { acc: '511', inv: 'I1', cust: 'A', vnd: 100, tot: 60, fin: 'FIFO COGS', fq: 1, status: 'PASS' },
    { acc: '511', inv: 'I2', cust: 'B', vnd: 200, tot: 120, fin: 'FIFO COGS', fq: 2, status: 'PASS' },
    { acc: '5212', inv: 'R1', cust: '', origInv: 'I1', matchedOrigInv: 'I1', vnd: -40, tot: -24, fin: 'RETURN', fq: -0.4, status: 'RETURNED' },
    { acc: '5213', inv: 'CN2', cust: 'B', origInv: 'I2', vnd: -10, tot: 0, fin: 'NO COGS', fq: 0, status: 'PASS' },
    { acc: '511', inv: 'I3', cust: '', vnd: 50, tot: 30, fin: 'FIFO COGS', fq: 1, status: 'REVIEW' },
  ];
  const pl = customerPL({ sales, totals: { cogsA: 191, consA: 5, consQ: 1 } });
  const by = Object.fromEntries(pl.rows.map((r) => [r.cust, r]));
  eq('customer P&L: a return with a blank customer goes to the customer of its original invoice (A)', [by.A.ret, by.A.cogs, by.A.net], [-40, 36, 60]);
  eq('customer P&L: a credit note goes to the customer of its invoice (B): net 190, COGS 120', [by.B.disc, by.B.net, by.B.cogs], [-10, 190, 120]);
  eq('customer P&L: a line without customer is its own row, not dropped', [pl.rows.length, by['(Không rõ khách hàng)'].gross], [3, 50]);
  eq('customer P&L: rows sorted by net revenue (B, A, unknown)', pl.rows.map((r) => r.cust), ['B', 'A', '(Không rõ khách hàng)']);
  eq('customer P&L: consumption is its own row (cost 5, GP −5)', [pl.cons.cogs, pl.cons.gp], [5, -5]);
  eq('customer P&L: totals net 300, COGS 191 (= 632), GP 109', [pl.total.net, pl.total.cogs, pl.total.gp], [300, 191, 109]);
  eq('customer P&L: checks — COGS ties to 632; unknown customer and REVIEW line flagged', pl.checks.map((c) => c.status), ['PASS', 'REVIEW', 'REVIEW']);
  eq('customer P&L: JE07 per customer adds up to 36 + 120 + 30', customerJournal(pl).filter((l) => l.je === 'JE07').map((l) => l.amount), [120, 36, 30]);
  eq('customer P&L: the summary sheet starts with the top customer', plSheetRows(pl)[0].slice(0, 2), ['B', 2]);
  eq('customer P&L: no result before STEP 5 runs', customerPL(null), null);
}

// ---- cloud delete two-phase (ENH-04) and audit rule source checks live in test/rules-contract.mjs

console.log(`\n${n - fail}/${n} unit checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
