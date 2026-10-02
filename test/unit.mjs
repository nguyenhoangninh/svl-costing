// Synthetic control tests (no private fixtures needed) — run in CI on every push / PR.
import { parseUserNumber, cellDateSerial } from '../src/engine/util.js';
import { validateSaveSales, salesCoverage, runStep4 } from '../src/engine/step4.js';
import { buildFingerprint } from '../src/engine/step3b.js';
import * as F5 from '../src/engine/step5.js';

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

// ---- Audit 2026-10 group A
import { directKey, postedKey } from '../src/views/phase2.js';
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
  let futureBillErr = '';
  try { validateSaveSales({ mode: 'YTD', rows: [{ ...row(ser(2026, 8, 7), 'UF', 'A', 1, 10), billDate: ser(2026, 9, 1) }] }, { rows: [] }, P2); } catch (e) { futureBillErr = e.message; }
  eq('F-05 future Bill Date blocked from current period Sales DB', futureBillErr.includes('BLOCK'), true);
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
  const dsD = { 'MI-M-O': { header: ['Date', 'Material Code', 'Total Cost'], rows: [[ser(2026, 8, 2), 'M', 5], [ser(2026, 7, 30), 'M', 7], [null, '', 12], ['31/02/2026', 'M2', 8]] } };
  const di = outOfPeriodRows(dsD, P2);
  eq('F-10 ERP date issues classified', di.map((x) => [x.key, x.n, x.outside, x.blank, x.invalid, x.amt, x.months.join()]), [['MI-M-O', 3, 1, 1, 1, 27, '2026-07']]);
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
  let mret = ''; try { F5.runFIFO({ ...ctx({}), salesRows: rt }); } catch (e) { mret = e.message; }
  eq('#6 MONTHLY return requires STRICT_DATE', mret.includes('STRICT_DATE'), true);
  const rr = F5.runFIFO({ ...ctx({}), salesRows: rt, mode: 'STRICT_DATE' });
  const ln = rr.sales.find((x) => x.inv === 'CN1');
  eq('#6 return restored at original cost', [ln.fin, ln.status, Math.round(ln.tot)], ['RETURN', 'RETURNED', -100]);
  eq('#6 net COGS and roll-forward', [Math.round(rr.totals.cogsQ), Math.round(rr.totals.cogsA), rr.rec[8].status, rr.rec[9].status, rr.rec[10].status, rr.rec[11].status], [2, 200, 'PASS', 'PASS', 'PASS', 'PASS']);
  eq('#6 return layer in closing', rr.closing.some((c) => c.source === 'RETURN' && c.qty === 1), true);
  const rh = F5.buildHistory(rr, [], { period: P2, opening, caRows: ca });
  eq('#6 return reversal included in FG History', rh.rows.some((h) => h.source === 'SALES RETURN REVERSAL' && h.qty === -1 && Math.round(h.tot) === -100), true);
  eq('#6 return → FG History gate PASS', F5.historyGate(rh, rr, P2).gate, 'PASS');
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
  eq('#6 original not found → REVIEW', rn.sales[0].fin, 'REVIEW');
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
  eq('#6 cumulative return above sold qty → REVIEW', rOver.sales.find((x) => x.inv === 'R2-CN2').fin, 'REVIEW');
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

  // #7 NRV with 1.5 % selling cost: unit cost 100, price 4 USD × 25000 = 100000 → NRV 98500; here cost 100 VND so no provision; force price low
  const nv = F5.runFIFO({ ...ctx({}), pmRows: [{ product: 'A', finalPrice: 0.004 }], sellCostRate: 0.015 }); // price 100 VND, NRV 98.5
  const cl = nv.closing.find((c) => c.prod === 'A');
  eq('#7 NRV provision = (100 − 98.5) × qty', Math.round(cl.provNeed * 100) / 100, Math.round(1.5 * cl.qty * 100) / 100);
  const nk1 = nrvKey(nv), nk2 = nrvKey({ ...nv, closing: nv.closing.map((x) => ({ ...x, price: num(x.price) + 0.001 })) });
  eq('#7 NRV decision key changes when valuation price changes', nk1 !== nk2, true);
  // #3 FAST tie: difference needs approval bound to the figures
  const eng = { a154: 1000, a155: 2000, a632: 3000, a511: 4000 };
  const t0 = F5.fastTie(eng, null);
  eq('#3 not entered', t0.status, 'NOT ENTERED');
  const tie = { fast: { a154: 1000, a155: 2000, a632: 2990, a511: 4000 } };
  const t1 = F5.fastTie(eng, tie);
  eq('#3 diff → REVIEW', [t1.status, t1.diffs], ['REVIEW', 1]);
  const t2 = F5.fastTie(eng, { ...tie, approval: { key: t1.key, by: 'x', note: 'ok' } });
  eq('#3 approved', t2.status, 'APPROVED');
  eq('#3 approval lapses when figures change', F5.fastTie({ ...eng, a155: 2001 }, { ...tie, approval: { key: t1.key } }).status, 'REVIEW');
  const eb = engineBalances({ period: P2, d: { step3: { summary: { closingAmt: 1000 } }, register: { rows: [] }, wipadj: { reg632: [{ record: 'RECORDED', impact: 100 }] }, salesDB: { rows: [] } } }, { d3b: { wf: { finalClosing: 1000 } } }, { totals: { closeA: 0, cogsA: 300 } });
  eq('#3 DIRECT_632 changes both 154 and 632', [eb.a154, eb.a632], [900, 400]);
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
