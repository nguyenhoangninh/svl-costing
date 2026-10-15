// Provision on finished goods (v1.14.70): FIFO release, sales returns, consumption, signed NRV true-up,
// RM split, roll-forward and the opening provision file. Hand-checked numbers; no company data.
// Run: node test/provision-logic.mjs
import * as F5 from '../src/engine/step5.js';
import { nrvNeed, layerKey, parseOpeningProvision, applyOpeningProvision, provisionTrack, provisionJournal, nrvApproved, provisionMovement, closingProvision, carryOpeningProvision, PROV_ACC, PROV_COST_ACC } from '../src/engine/provision.js';
import { fgLayerSheet, provisionTrackSheet, provisionJournalSheet } from '../src/engine/exportform.js';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}`); };
const near = (a, b, t = 0.5) => Math.abs(num(a) - num(b)) <= t;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
const P = '2026-08';

/** One product P1 (opening layer A with provision, production layer B) and P2 (opening layer with NRV above cost). */
function scenario({ sales = [], returns = [], caRows = null, price1 = 0.8, price2 = 2, mode = 'MONTHLY' } = {}) {
  const opening = {
    status: 'VALIDATED',
    rows: [
      { period: P, srcPeriod: '2026-07', lid: 'OP-A', pc: 'PC-1', prod: 'P1', name: 'Product one', loc: 'FG', unit: 'PC', qty: 100, rm: 1800000, a622: 600000, a627: 600000, tot: 3000000, price: price1, prov: -600000, cons: '', date: serial(2026, 6, 10), mo: 'MO-1', status: 'OK', msg: '' },
      { period: P, srcPeriod: '2026-07', lid: 'OP-C', pc: 'PC-3', prod: 'P2', name: 'Product two', loc: 'FG', unit: 'PC', qty: 100, rm: 600000, a622: 200000, a627: 200000, tot: 1000000, price: price2, prov: -100000, cons: '', date: serial(2026, 6, 12), mo: 'MO-3', status: 'OK', msg: '' },
    ],
  };
  const defaultCa = [
    { erp: 'T', pc: 'PC-2', prod: 'P1', name: 'Product one', loc: 'FG', unit: 'PC', qty: 50, date: serial(2026, 8, 5), mo: 'MO-2', sub: '', totalRM: 300000, pcRM: 250000, so: 50000, carryIn: 0, t622: 100000, t627: 100000, totalCost: 500000, price: price1, statusText: 'ELIGIBLE' },
  ];
  return F5.runFIFO({
    period: P, opening, caRows: caRows || defaultCa, step4: { current: 'CURRENT', overall: 'PASS', finalCost: 500000, qty: 50 },
    salesRows: sales, returnRows: returns, pmRows: [{ product: 'P1', finalPrice: price1 }, { product: 'P2', finalPrice: price2 }], fx: 25000,
    mode, sellCostRate: 0.015, register: { rows: [] }, overrides: {}, dupDecisions: {}, returnMatches: {}, tol: 1,
  });
}
const sale = (qty, day, inv, txn) => ({ invDate: serial(2026, 8, day), product: 'P1', prodName: 'Product one', qty, amtUSD: 0, amtVND: 0, tranType: 'NORMAL SALE', invNo: inv, customer: 'C1', txnKey: txn, validResult: 'OK' });

// ---- nrvNeed: lower of cost and NRV, signed
ok('nrvNeed: cost above NRV adds the gap to existing provision', near(nrvNeed(1200000, -240000, 40, 19700), 172000));
ok('nrvNeed: NRV above cost releases existing provision', near(nrvNeed(1000000, -100000, 100, 49250), -100000));
ok('nrvNeed: no provision needed when cost below NRV and no provision', near(nrvNeed(300000, 0, 30, 19700), 0));
ok('nrvNeed: cost above NRV with existing provision equal to the gap needs nothing more', near(nrvNeed(1200000, -412000, 40, 19700), 0));

// ---- layer key and opening file
const key1 = layerKey({ pc: 'PC-1', prod: 'P1', mo: 'MO-1', loc: 'FG', date: serial(2026, 6, 10), qty: 100 });
ok('layer key is stable for the 6 match fields', key1 === layerKey({ pc: ' pc-1 ', prod: 'p1', mo: 'mo-1', loc: 'fg', date: serial(2026, 6, 10), qty: 100.0 }));

const grid = (rows, bal) => {
  const g = [];
  g.push(['SVL_PROVISION_OPENING_TEMPLATE', 'v1', 'DỰ PHÒNG', '', '', '', '', 'Số dư sổ cái đầu kỳ (VND)', '', bal]);
  g.push(['', '', '', '', '', '', '', 'Tổng trong file (VND)', '', 0]);
  g.push(['', '', '', '', '', '', '', 'Chênh lệch', '', 0]);
  g.push(['Kỳ', 'Kỳ nguồn', 'PC No.', 'Product Code', 'MO No.', 'Location', 'Layer Date', 'Qty', 'Layer ID', 'Dự phòng', 'Nguồn', 'Ghi chú', 'Kiểm tra']);
  for (const r of rows) g.push([P, '2026-07', r.pc, r.prod, r.mo, r.loc, r.date, r.qty, '', r.prov, '', '', '']);
  return { PROVISION_OPENING: g };
};
const fileRows = [
  { pc: 'PC-1', prod: 'P1', mo: 'MO-1', loc: 'FG', date: serial(2026, 6, 10), qty: 100, prov: -600000 },
  { pc: 'PC-3', prod: 'P2', mo: 'MO-3', loc: 'FG', date: serial(2026, 6, 12), qty: 100, prov: -100000 },
];
const parsed = parseOpeningProvision(grid(fileRows, -700000), 'prov.xlsx', P);
ok('opening file reads with no errors when the total equals the GL balance', parsed.ok && parsed.rows.length === 2);
ok('opening file total is the sum of the rows', near(parsed.sum, -700000));
const badTotal = parseOpeningProvision(grid(fileRows, -650000), 'prov.xlsx', P);
ok('opening file is refused when the total differs from the GL balance', !badTotal.ok && badTotal.errors.some((e) => e.includes('sổ cái')));
const badPeriod = parseOpeningProvision({ PROVISION_OPENING: [...grid(fileRows, -700000).PROVISION_OPENING.slice(0, 4), [ '2026-07', '', 'PC-1', 'P1', 'MO-1', 'FG', serial(2026, 6, 10), 100, '', -600000 ]] }, 'x.xlsx', P);
ok('a row from another period is refused', badPeriod.errors.some((e) => e.includes("khác kỳ")));
const positive = parseOpeningProvision(grid([{ ...fileRows[0], prov: 5000 }, fileRows[1]], -95000), 'prov.xlsx', P);
ok('a positive provision is refused (provision is a credit)', positive.errors.some((e) => e.includes('số âm')));

const openA = { rows: [
  { pc: 'PC-1', prod: 'P1', mo: 'MO-1', loc: 'FG', date: serial(2026, 6, 10), qty: 100, prov: 0 },
  { pc: 'PC-3', prod: 'P2', mo: 'MO-3', loc: 'FG', date: serial(2026, 6, 12), qty: 100, prov: 0 },
] };
const applied = applyOpeningProvision(openA, parsed);
ok('opening provision is applied to the matching layers', applied.ok && applied.matched === 2 && near(openA.rows[0].prov, -600000) && near(openA.rows[1].prov, -100000));
const openB = { rows: [{ pc: 'PC-1', prod: 'P1', mo: 'MO-9', loc: 'FG', date: serial(2026, 6, 10), qty: 100, prov: 0 }, openA.rows[1]] };
const notMatched = applyOpeningProvision(openB, parsed);
ok('an unmatched provision row blocks the whole file (nothing applied)', !notMatched.ok && notMatched.errors.some((e) => e.includes('Không khớp')) && openB.rows[0].prov === 0);

// ---- main scenario: 60 units sold from layer A (oldest), then a return of 10 of them
const base = scenario({ sales: [sale(60, 15, 'INV1', 'T1')] });
const L = base.ledger.find((l) => l.lid === 'OP-A');
const relSale = 360000;
ok('FIFO take of 60 units releases 60% of the layer provision', near(base.sales[0].provRel, relSale));
ok('sale line keeps the FIFO cost split and the provision release', near(base.sales[0].tot, 1800000) && near(base.sales[0].provRel, relSale));
ok('ledger: provision taken from the opening layer', near(L.provOut, -360000) && near(L.prov, -600000));
ok('totals: provision released by sales', near(base.totals.provRelSales, relSale));
ok('closing layer A keeps 40 units with 40% of the provision', (() => { const c = base.closing.find((x) => x.lid === 'OP-A'); return c && near(c.qty, 40) && near(c.prov, -240000) && near(c.tot, 1200000); })());
ok('NRV true-up on layer A: cost after provision above NRV → add 172,000', (() => { const c = base.closing.find((x) => x.lid === 'OP-A'); return c && near(c.nrvUnit, 19700) && near(c.provNeed, 172000); })());
ok('layer P2 with NRV above cost: provision released (signed NRV)', (() => { const c = base.closing.find((x) => x.lid === 'OP-C'); return c && near(c.provNeed, -100000) && near(c.prov, -100000); })());
ok('nrvProv total is the signed sum (172,000 − 100,000)', near(base.totals.nrvProv, 72000));
ok('production layer B untouched by the sale (layer A covers 60 units): 50 units, no provision, no NRV need', (() => { const c = base.closing.find((x) => x.source === 'PRODUCTION'); return !!c && near(c.qty, 50) && near(c.prov, 0) && near(c.provNeed, 0, 0.5); })());

// ---- RM split: PC RM + Stock Out + WIP/rework adj = RM Amount, on production layer and after FIFO takes
const split = scenario({ sales: [sale(60, 15, 'INV1', 'T1')], caRows: [{ erp: 'T', pc: 'PC-2', prod: 'P1', name: 'Product one', loc: 'FG', unit: 'PC', qty: 50, date: serial(2026, 8, 5), mo: 'MO-2', sub: '', totalRM: 350000, pcRM: 250000, so: 50000, carryIn: 50000, t622: 100000, t627: 100000, totalCost: 550000, price: 0.8, statusText: 'ELIGIBLE' }] });
const pl = split.ledger.find((l) => l.source === 'PRODUCTION');
ok('production layer split: PC RM 250,000 + Stock Out 50,000 + WIP/rework 50,000 = RM 350,000', near(pl.rmPC, 250000) && near(pl.rmSO, 50000) && near(pl.rmAdj, 50000) && near(pl.rmPC + pl.rmSO + pl.rmAdj, pl.rm));
const plc = split.closing.find((c) => c.source === 'PRODUCTION');
ok('closing split of the untouched production layer: parts add to its RM (250,000 + 50,000 + 50,000)', plc && near(plc.rmPC + plc.rmSO + plc.rmAdj, plc.rm) && near(plc.rmPC, 250000) && near(plc.rmSO, 50000) && near(plc.rmAdj, 50000));
const fifo2 = scenario({ sales: [sale(120, 15, 'INV2', 'T2')], caRows: [{ erp: 'T', pc: 'PC-2', prod: 'P1', name: 'Product one', loc: 'FG', unit: 'PC', qty: 50, date: serial(2026, 8, 5), mo: 'MO-2', sub: '', totalRM: 350000, pcRM: 250000, so: 50000, carryIn: 50000, t622: 100000, t627: 100000, totalCost: 550000, price: 0.8, statusText: 'ELIGIBLE' }] });
const plt = fifo2.closing.find((c) => c.source === 'PRODUCTION');
ok('partial take from the production layer (20 of 50 units) keeps the split in proportion', plt && near(plt.qty, 30) && near(plt.rmPC, 250000 * 30 / 50) && near(plt.rmSO, 50000 * 30 / 50) && near(plt.rmAdj, 50000 * 30 / 50) && near(plt.rmPC + plt.rmSO + plt.rmAdj, plt.rm));
const openSplit = split.closing.find((c) => c.lid === 'OP-A');
ok('opening layers without a split keep all RM in RM cost (splitOK false)', openSplit && openSplit.splitOK === false && near(openSplit.rmPC, openSplit.rm) && near(openSplit.rmSO, 0));

// ---- sales return of 10 units: provision goes back with the goods
const ret = scenario({ sales: [sale(60, 15, 'INV1', 'T1')], returns: [{ invDate: serial(2026, 8, 20), product: 'P1', prodName: 'Product one', qty: -10, amtUSD: 0, amtVND: 0, tranType: 'SALES RETURN', invNo: 'RT1', customer: 'C1', origInv: 'INV1', txnKey: 'R1', validResult: 'OK' }] });
const retLayer = ret.closing.find((c) => String(c.lid).startsWith('RT-'));
ok('return restores provision in proportion to the returned units (60,000 for 10 of 60)', retLayer && near(retLayer.prov, -60000));
ok('return line carries the negative release (put back)', (() => { const r = ret.sales.find((s) => s.fin === 'RETURN' && s.status === 'RETURNED'); return r && near(r.provRel, -60000); })());
ok('totals: release by sales net of the return (360,000 − 60,000)', near(ret.totals.provRelSales, 300000));

// ---- provision roll-forward per layer: open + restore − sale − consumption − rework = closing (before NRV) and + NRV
const tr = provisionTrack(ret);
ok('provision roll-forward ties per period (opening + restore − releases = closing before NRV)', tr.ok && Math.abs(tr.check) <= 1);
ok('roll-forward totals: opening 700,000 (both layers), restore 60,000, release 360,000', near(tr.totals.open, 700000) && near(tr.totals.restore, 60000) && near(tr.totals.relSale, 360000));
const trA = tr.rows.find((r) => r.lid === 'OP-A');
ok('layer A without a decision: NRV proposal kept apart (+172,000), nothing approved, close 240,000', trA && near(trA.open, 600000) && near(trA.relSale, 360000) && near(trA.closePre, 240000) && near(trA.nrvProp, 172000) && near(trA.nrvAdj, 0) && near(trA.close, 240000));

// ---- v1.14.73: increase = NRV approved (RECORDED), spread over the layers in proportion to the proposal
const recFull = { status: 'RECORDED', amount: 115000, recordedAmount: 115000 }; // proposal: A +172,000, C −100,000, return layer +43,000
const ap = nrvApproved(ret.closing, recFull);
ok('NRV approved in full: each layer gets its proposal (A +172,000, C −100,000, return +43,000)', near(ap.proposed, 115000) && near(ap.byLayer['OP-A'], 172000) && near(ap.byLayer['OP-C'], -100000) && near(ap.total, 115000));
const apHalf = nrvApproved(ret.closing, { status: 'RECORDED', amount: 115000, recordedAmount: 57500 });
ok('NRV recorded at half the proposal is spread in proportion (A +86,000, C −50,000)', near(apHalf.byLayer['OP-A'], 86000) && near(apHalf.byLayer['OP-C'], -50000));
ok('NO ADJUSTMENT APPROVED or no decision: nothing approved', Object.keys(nrvApproved(ret.closing, { status: 'NO ADJUSTMENT APPROVED' }).byLayer).length === 0 && nrvApproved(ret.closing, null).total === 0);
const trOk = provisionTrack(ret, ap.byLayer);
ok('layer A with NRV approved: close 240,000 + 172,000 = 412,000', near(trOk.rows.find((r) => r.lid === 'OP-A').close, 412000));
const mv = provisionMovement(trOk, ap);
ok('movement: opening 700,000 + increase 115,000 − decrease (360,000 − 60,000) = closing 515,000', near(mv.open, 700000) && near(mv.increase, 115000) && near(mv.decrease, 300000) && near(mv.closeBooks, 515000) && mv.ok);
ok('movement: closing on the layers = closing on the books when nothing went to rework', near(mv.closeLayers, mv.closeBooks) && near(mv.rework, 0));
ok('movement without a decision: no increase, closing = 700,000 − 300,000', near(provisionMovement(tr, nrvApproved(ret.closing, null)).closeBooks, 400000));

// ---- v1.14.73: closing provision carried to next period's opening
const prevS5 = { closing: ret.closing };
ok('closing provision (next opening) = layers + NRV approved = 515,000', near(closingProvision(prevS5, recFull).total, 515000));
const nextOpen = { rows: ret.closing.map((c) => ({ ...c, prov: 0 })) };
const car = carryOpeningProvision(nextOpen, prevS5, recFull);
ok('carry onto a rolled-forward opening (same Layer IDs): opening = previous closing 515,000', car.ok && near(car.sum, 515000) && near(-nextOpen.rows.reduce((a, r) => a + r.prov, 0), 515000));
const nextFile = { rows: ret.closing.map((c) => ({ pc: c.pc, prod: c.prod, mo: c.mo, loc: c.loc, date: c.date, qty: c.qty, prov: 0 })) };
ok('carry onto a file-imported opening matches on the 6-field layer key', carryOpeningProvision(nextFile, prevS5, recFull).ok && near(-nextFile.rows.reduce((a, r) => a + r.prov, 0), 515000));
const short = { rows: ret.closing.filter((c) => c.lid !== 'OP-A').map((c) => ({ pc: c.pc, prod: c.prod, mo: c.mo, loc: c.loc, date: c.date, qty: c.qty, prov: 0 })) };
const carShort = carryOpeningProvision(short, prevS5, recFull);
ok('carry refused when a layer with provision has no opening row (nothing changed)', !carShort.ok && short.rows.every((r) => r.prov === 0));
ok('carry refused when the previous period has no STEP 5', !carryOpeningProvision(nextFile, null, null).ok);

// ---- journal for FAST: sale release, return put-back, NRV recorded by decision
const jr = provisionJournal(tr, 115000);
const line = (code) => jr.lines.find((l) => l.code === code);
ok('journal: sale release Dr 2294 / Cr 632', line('PROV-SALE').dr === PROV_ACC && line('PROV-SALE').cr === PROV_COST_ACC && near(line('PROV-SALE').amount, 360000));
ok('journal: return put-back Dr 632 / Cr 2294', line('PROV-RETURN').dr === PROV_COST_ACC && line('PROV-RETURN').cr === PROV_ACC && near(line('PROV-RETURN').amount, 60000));
ok('journal: NRV recorded 115,000 is Dr 632 / Cr 2294', line('PROV-NRV').dr === PROV_COST_ACC && near(line('PROV-NRV').amount, 115000));
ok('journal: 2294 movement (credit positive) = −360,000 + 60,000 + 115,000', near(jr.acc2294, -185000));
const jrRelease = provisionJournal(tr, -50000);
ok('journal: NRV release −50,000 is Dr 2294 / Cr 632', jrRelease.lines.find((l) => l.code === 'PROV-NRV').dr === PROV_ACC && near(jrRelease.lines.find((l) => l.code === 'PROV-NRV').amount, 50000));

// ---- internal consumption (STRICT_DATE) releases provision like a sale
const strict = scenario({ sales: [sale(60, 15, 'INV1', 'T1')], mode: 'STRICT_DATE' });
ok('STRICT_DATE: same FIFO release as MONTHLY for the same sale', near(strict.totals.provRelSales, relSale) && near(strict.closing.find((c) => c.lid === 'OP-A').prov, -240000));

// ---- ledger carries the parts the roll-forward needs (no provision on production layers)
ok('production layer carries no provision', (() => { const p = base.ledger.find((l) => l.source === 'PRODUCTION'); return p && near(p.prov, 0) && near(p.provOut, 0); })());

// ---- FG rework (STRICT_DATE): 10 units of layer A go to rework; the provision follows them and is NOT posted
const opening2 = { status: 'VALIDATED', rows: [
  { period: P, srcPeriod: '2026-07', lid: 'OP-A', pc: 'PC-1', prod: 'P1', name: 'Product one', loc: 'FG', unit: 'PC', qty: 100, rm: 1800000, a622: 600000, a627: 600000, tot: 3000000, price: 0.8, prov: -600000, cons: '', date: serial(2026, 6, 10), mo: 'MO-1', status: 'OK', msg: '' },
] };
const regRw = { rows: [{ active: 'Y', rwStatus: 'WIP', rwType: 'NORMAL', fg: 'P1', issueQty: 10, issueDate: serial(2026, 8, 12), rid: 'RW1', inputCheck: 'PASS', outFG: 'P1', pcNo: 'PC-R', compQty: 0, scrapQty: 0, returnedFG: 0, doc: 'DOC1', fgName: 'Product one', loc: 'FG', uom: 'PC', compDate: null, carryIn: 0 }] };
const rwRes = F5.runFIFO({
  period: P, opening: opening2, caRows: [], step4: { current: 'CURRENT', overall: 'PASS', finalCost: 0, qty: 0 },
  salesRows: [sale(60, 15, 'INV1', 'T1')], returnRows: [], pmRows: [{ product: 'P1', finalPrice: 0.8 }], fx: 25000,
  mode: 'STRICT_DATE', sellCostRate: 0.015, register: regRw, overrides: {}, dupDecisions: {}, returnMatches: {}, tol: 1,
});
F5.runReworkFIFO(rwRes, regRw, { period: P, opening: opening2, salesRows: [], step4Carry: 0 });
const lA = rwRes.ledger.find((l) => l.lid === 'OP-A');
const cA = rwRes.closing.find((c) => c.lid === 'OP-A');
ok('rework take of 10 units moves 60,000 of provision with the units', lA && near(lA.provOut, -420000) && near(lA.qtyOut, 70));
ok('closing layer after rework: 30 units with 180,000 provision', cA && near(cA.qty, 30) && near(cA.prov, -180000));
const trRw = provisionTrack(rwRes);
ok('provision roll-forward: rework part shown as pending (60,000), sale released 360,000', trRw.ok && near(trRw.totals.relRw, 60000) && near(trRw.totals.relSale, 360000));
const jrRw = provisionJournal(trRw, 0);
ok('rework part is not in the posting lines; shown as pending amount', jrRw.lines.every((l) => l.code !== 'PROV-REWORK') && near(jrRw.pending.amount, 60000));

// ---- export sheets: layer track and FAST journal
const sheetTrack = provisionTrackSheet(provisionTrack(ret), P);
ok('06_PROVISION_TRACK sheet: name, header row 2, totals row after the layers', sheetTrack.name === '06_PROVISION_TRACK' && sheetTrack.header === 2 && sheetTrack.totals === sheetTrack.aoa.length);
ok('06_PROVISION_TRACK: title shows the check result', String(sheetTrack.aoa[0][0]).includes('Kiểm tra dự phòng: PASS'));
const jsheet = provisionJournalSheet(provisionJournal(provisionTrack(ret), 115000), P);
ok('06_PROVISION_JE sheet: sale release line is Dr 2294 / Cr 632', jsheet.aoa.some((r) => r[0] === 'PROV-SALE' && r[2] === PROV_ACC && r[3] === PROV_COST_ACC));
ok('06_PROVISION_JE sheet: pending rework line has no accounts', jsheet.aoa.some((r) => r[0] === 'PROV-REWORK' && r[2] === '' && r[3] === ''));
ok('05 export: RM split blank for layers without a split (opening layer)', (() => { const cl = fgLayerSheet(split.closing, 'closing', P); const h = cl.aoa[1]; const iPC = h.indexOf('RM cost'); const row = cl.aoa.find((r) => r[2] === 'OP-A'); return iPC >= 0 && row[iPC] === ''; })());
ok('05 export: RM split filled for the production layer (PC RM 250,000)', (() => { const cl = fgLayerSheet(split.closing, 'closing', P); const h = cl.aoa[1]; const iPC = h.indexOf('RM cost'); const iSO = h.indexOf('RM cost (Stock out)'); const row = cl.aoa.find((r) => r[2] && String(r[2]).startsWith('PR-')); return row && near(row[iPC].v, 250000) && near(row[iSO].v, 50000); })());

// ---- v1.14.81 (audit AUD-08): 5P must reconcile before CLOSE – the gate used by STEP 5.3
const P3 = await import('../src/views/phase3.js');
P3.install({ fmtNum: (n) => String(Math.round(n)) });
const gS = { period: P, d: { nrvDecision: null } };
ok('5P gate: a reconciled provision movement does not block CLOSE', P3.provisionGate(gS, ret) === '');
// a production layer carrying provision with no opening / return source: the 2294 movement cannot explain it
const bad = structuredClone(ret); const prodLayer = bad.ledger.find((l) => l.source !== 'OPENING' && l.source !== 'RETURN'); prodLayer.prov = num(prodLayer.prov) - 50000;
const badS = gS;
ok('5P gate: the same data with the NRV decision recorded on every layer passes', P3.provisionGate({ period: P, d: { nrvDecision: { status: 'RECORDED', amount: 115000, recordedAmount: 115000, key: P3.nrvKey(ret) } } }, ret) === '');
const gMsg = P3.provisionGate(badS, bad);
ok('5P gate: provision with no source on a production layer blocks CLOSE (50,000)', /5P Dự phòng FG \(TK 2294\) chưa khớp/.test(gMsg) && /50000/.test(gMsg));
ok('5P gate: no STEP 5 result → no 5P block (STEP 5 gates apply)', P3.provisionGate(gS, null) === '');

// ---- v1.14.86 (audit AUD-02): FG opening rolled from last period's closing must still match that closing
{
  const prevStep5 = { ...structuredClone(ret), period: '2026-07', runResult: 'PASS' };
  const prevD = { step5: prevStep5, nrvDecision: null };
  const S8 = { period: '2026-08', d: { fgOpen: F5.openingFromClosing(prevStep5, '2026-08', '', {}) } };
  ok('FG drift: an opening rolled from the current closing matches', P3.fgOpenDrift(S8, prevD, '2026-07') === '');
  const changed = structuredClone(prevD); changed.step5.closing[0].tot = num(changed.step5.closing[0].tot) + 1000;
  ok('FG drift: closing cost changed after the roll → message', /đã thay đổi sau khi chuyển sang FG đầu kỳ 2026-08/.test(P3.fgOpenDrift(S8, changed, '2026-07')));
  const provChanged = structuredClone(prevD); provChanged.step5.closing[0].prov = num(provChanged.step5.closing[0].prov) - 500;
  ok('FG drift: closing provision changed after the roll → message names dự phòng', /FG \/ dự phòng cuối kỳ 2026-07/.test(P3.fgOpenDrift(S8, provChanged, '2026-07')));
  const S8file = { period: '2026-08', d: { fgOpen: { ...S8.d.fgOpen, provSource: { kind: 'FILE' } } } };
  ok('FG drift: opening provision loaded from a file afterwards → provision not compared', P3.fgOpenDrift(S8file, provChanged, '2026-07') === '');
  const S8imp = { period: '2026-08', d: { fgOpen: { ...S8.d.fgOpen, srcKind: 'IMPORT' } } };
  ok('FG drift: an imported opening (not rolled) is not compared', P3.fgOpenDrift(S8imp, changed, '2026-07') === '');
  const failed = structuredClone(prevD); failed.step5.runResult = 'CHECK';
  ok('FG drift: previous closing no longer PASS → message', /không còn dùng được/.test(P3.fgOpenDrift(S8, failed, '2026-07')));
}

console.log(`\n${total - fail}/${total} provision checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
