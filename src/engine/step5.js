// STEP 5 — FG inventory by production lot, FIFO COGS, FG Rework FIFO (5B), FG History and month close.
// Port of modSTEP5_FIFO (STEP5_Run_FIFO_COGS …), modSTEP2B_5B_FGRework (RW_RunMonthlyReworkFIFO …),
// modSTEP5_MonthClose (STEP5_Build_FG_History_B333 / STEP5_Close_Month_B333) and the 05_RECONCILIATION formulas.
import { txt, ttxt, utxt, num, nowISO, prevPeriod, serialToYMD, cellDateSerial, fp } from './util.js';

export const TOLQ = 0.0001;          // S5_TOLQ
const TOL_QTY = 0.000001;            // modSTEP5_MonthClose / RW
const TOL_AMT = 1;

export const LAYER_FIELDS = ['period', 'srcPeriod', 'lid', 'source', 'pc', 'date', 'mo', 'prod', 'name', 'loc', 'unit', 'qty', 'rm', 'a622', 'a627', 'tot', 'unitCost', 'price', 'prov', 'cons', 'status', 'msg'];
export const LAYER_HEADERS = ['Period', 'Source Period', 'Layer ID', 'Source', 'PC No.', 'Layer Date', 'MO No.', 'Product Code', 'Product Name', 'Location', 'Unit', 'Qty', 'RM Amount', '622 Amount', '627 Amount', 'Total Amount', 'Total / Unit', 'Sales Price (USD)', 'Provision VND (memo)', 'Consignment 157 (memo)', 'Status', 'Message'];
export const TPL_HEADERS = ['PC No.', 'Layer Date', 'MO No.', 'Product Code', 'Product Name', 'Location', 'Unit', 'Qty', 'RM Amount', '622 Amount', '627 Amount', 'Total Amount', 'Sales Price (USD)', 'Provision VND (memo)', 'Consignment 157 (memo)', 'Source Reference', 'Note'];
export const TPL_MARKER = 'SVL_FG_OPENING_TEMPLATE';
export const LEDGER_FIELDS = ['seq', 'lid', 'source', 'srcPeriod', 'pc', 'date', 'mo', 'prod', 'name', 'unit', 'qtyIn', 'rm', 'a622', 'a627', 'tot', 'unitCost', 'qtyOut', 'rmOut', 'o622', 'o627', 'totOut', 'remQ', 'remTot', 'flag'];
export const LEDGER_HEADERS = ['Seq', 'Layer ID', 'Source', 'Source Period', 'PC No.', 'Layer Date', 'MO No.', 'Product Code', 'Product Name', 'Unit', 'Qty In', 'RM', '622', '627', 'Total', 'Total / Unit', 'Qty Out', 'RM Out', '622 Out', '627 Out', 'Total Out', 'Qty Remaining', 'Total Remaining', 'Flag'];
export const SALES_FIELDS = ['seq', 'date', 'inv', 'cust', 'prod', 'name', 'qty', 'usd', 'vnd', 'type', 'remark', 'def', 'ovr', 'fin', 'fq', 'rm', 'c622', 'c627', 'tot', 'unit', 'status', 'msg', 'key', 'dbRow', 'origInv'];
export const SALES_HEADERS = ['Seq', 'Invoice Date', 'SI Invoice No.', 'Customer', 'Product Code', 'Product Name', 'Quantity', 'Amount (USD)', 'Amount (VND)', 'Transaction Type', 'Remark', 'Default Treatment', 'Override Treatment', 'Final Treatment', 'FIFO Qty', 'RM COGS', '622 COGS', '627 COGS', 'Total COGS', 'Unit COGS', 'Status', 'Message', 'Line Key', 'Sales DB Row', 'Original Invoice (return)'];
export const DETAIL_FIELDS = ['seq', 'prod', 'line', 'lid', 'source', 'pc', 'date', 'layerQty', 'qty', 'rm', 'a622', 'a627', 'tot', 'unit', 'take', 'left'];
export const DETAIL_HEADERS = ['Seq', 'Product Code', 'Sales Line Seq', 'Layer ID', 'Source', 'PC No.', 'Layer Date', 'Layer Qty', 'Qty Taken', 'RM', '622', '627', 'Total', 'Unit Cost', 'Take Type', 'Qty Left In Layer'];
export const SUM_FIELDS = ['prod', 'name', 'openQ', 'openA', 'prodQ', 'prodA', 'cogsQ', 'cogsRM', 'cogs622', 'cogs627', 'cogsA', 'closeQ', 'closeA', 'eligQ', 'layers', 'status', 'msg', 'rwQ', 'rwRM', 'rw622', 'rw627', 'rwTot', 'rollStatus'];
export const SUM_HEADERS = ['Product Code', 'Product Name', 'Opening Qty', 'Opening Amount', 'Production Qty', 'Production Amount', 'COGS Qty', 'COGS RM', 'COGS 622', 'COGS 627', 'COGS Total', 'Closing Qty', 'Closing Amount', 'Eligible Sales Qty', 'Layers Left', 'Status', 'Message', 'Rework Qty', 'Rework RM Carry', 'Rework 622 Carry', 'Rework 627 Carry', 'Rework Total Carry', 'FG Rollforward incl Rework'];
export const RWF_FIELDS = ['seq', 'period', 'rid', 'issueDate', 'fg', 'pcNo', 'outFG', 'lid', 'layerSrc', 'layerDate', 'layerQty', 'qty', 'rm', 'a622', 'a627', 'tot', 'unit', 'rwStatus', 'fifoStatus', 'mode'];
export const RWF_HEADERS = ['Seq', 'Period', 'Rework ID', 'Issue Date', 'Input FG', 'Rework PC', 'Output FG', 'Layer ID', 'Layer Source', 'Layer Date', 'Layer Qty', 'Qty Taken', 'RM Carry', '622 Carry', '627 Carry', 'Total Carry', 'Unit Cost', 'Rework Status', 'FIFO Status', 'Mode'];
export const HIST_FIELDS = ['pc', 'date', 'mo', 'prod', 'name', 'loc', 'unit', 'qty', 'rmSrc', 'rmST', 'tot', 'rm', 'a622', 'a627', 'price', 'costMonth', 'provUSD', 'pl7', 'srcPeriod', 'provVND', 'net', 'cons', 'hStatus', 'archive', 'lid', 'source'];
export const HIST_HEADERS = ['PC No.', 'Date', 'MO No.', 'Product code', 'Product Name', 'Location', 'Unit', 'Complete Qty', 'RM cost (source)', 'RM cost (ST)', 'Total cost(VND)', 'RM cost', 'Direct labors', 'Production cost', 'Sales Price(USD)', 'Cost month', 'provision in 2512-usd', '7% PL', 'Layer Source Period', 'provision in 2512-vdn', 'net inventory', '157-good on consignment', 'History Status', 'Archive Period', 'Layer ID', 'Source'];
export const XNT_FIELDS = ['code', 'name', 'unit', 'openQ', 'openA', 'inQ', 'inA', 'outQ', 'outA', 'balQ', 'balA', 'chkQ', 'chkA'];
export const XNT_HEADERS = ['Item code', 'Item Name(English)', 'Base Unit', 'Qty-Opening', 'AMT-Opening', 'QTY IN', 'AMT IN', 'QTY OUT', 'AMT OUT', 'QTY BAL', 'AMT BAL', 'Qty check vs lots', 'AMT check vs lots'];

// ---------------------------------------------------------------- helpers
const s5t = (v) => ttxt(v);
/** Strict STEP 5 date parser; impossible calendar dates are rejected instead of normalized. */
export function dateVal(v) {
  const d = cellDateSerial(v);
  return d !== null && d > 20000 && d < 80000 ? d : null;
}
/** VBA Format$ for "0.####" / "#,##0.####" / "#,##0" / "0" (incl. the trailing "." quirk of optional decimals). */
export function vbFmt(x, maxDec = 0, group = false) {
  x = num(x);
  const s = Math.abs(x).toFixed(maxDec);
  let [i, f = ''] = s.split('.');
  f = f.replace(/0+$/, '');
  if (group) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let out = maxDec > 0 ? `${i}.${f}` : i;
  if (x < 0 && Number(s) !== 0) out = '-' + out;
  return out;
}
const pad = (n, w) => String(Math.round(n)).padStart(w, '0');
function periodBounds(p) {
  const y = +p.slice(0, 4), m = +p.slice(5, 7);
  const start = (Date.UTC(y, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000;
  const end = (Date.UTC(y, m, 0) - Date.UTC(1899, 11, 30)) / 86400000;
  return { start, end };
}
const ymOf = (serial) => { const { y, m } = serialToYMD(serial); return `${y}${String(m).padStart(2, '0')}`; };
const norm = (v) => utxt(v).replace(/[^A-Z0-9]/g, '');

// ---------------------------------------------------------------- 5.1 opening FG
/** Opening FG from a template / legacy "month detail" workbook (grids by sheet name). */
export function importOpeningFG(grids, fileName, period) {
  const prevP = prevPeriod(period);
  const rows = []; let srcKind = '', srcLabel = '';
  let tpl = null;
  for (const [n, g] of Object.entries(grids)) if (utxt(g[0] && g[0][0]) === TPL_MARKER) { tpl = [n, g]; break; }
  if (tpl) {
    const [n, g] = tpl; srcKind = 'TEMPLATE';
    const per = periodText(g[1] && g[1][2]);
    if (per !== period) throw new Error(`Opening Period trên template (C2) là '${per}' nhưng kỳ đang mở là ${period}.`);
    if (g.length < 5) throw new Error('Template không có dòng dữ liệu (dữ liệu bắt đầu từ dòng 5).');
    const bad = TPL_HEADERS.map((h, c) => (norm(g[3] && g[3][c]) !== norm(h) ? `cột ${c + 1} phải là '${h}' (đang là '${s5t(g[3] && g[3][c])}')` : '')).filter(Boolean);
    if (bad.length) throw new Error('Dòng tiêu đề 4 của template bị thay đổi: ' + bad.join('; '));
    const srcP = periodText(g[1] && g[1][4]) || prevP;
    for (let r = 4; r < g.length; r++) {
      const x = g[r] || []; const prod = utxt(x[3]);
      if (!prod && !s5t(x[0]) && num(x[7]) === 0) continue;
      const qty = num(x[7]), tot = num(x[11]);
      rows.push({ period, srcPeriod: srcP, lid: `OP-${s5t(x[0])}-T${r + 1}`, source: 'OPENING', pc: s5t(x[0]), date: dateVal(x[1]), mo: s5t(x[2]), prod, name: s5t(x[4]), loc: s5t(x[5]), unit: s5t(x[6]), qty, rm: num(x[8]), a622: num(x[9]), a627: num(x[10]), tot, unitCost: qty !== 0 ? tot / qty : null, price: num(x[12]), prov: num(x[13]), cons: s5t(x[14]), status: 'NOT VALIDATED', msg: '' });
    }
    srcLabel = `${fileName} | TEMPLATE ${n} | prepared by ${s5t(g[1] && g[1][6])}`;
  } else {
    srcKind = 'LEGACY MONTH DETAIL';
    let pick = null; const yr = period.slice(0, 4);
    for (const n of Object.keys(grids)) if (/month detail/i.test(n)) { if (!pick) pick = n; if (n.includes(yr)) pick = n; }
    if (!pick) throw new Error(`Không thấy template (A1 = ${TPL_MARKER}) hay sheet 'month detail' trong ${fileName}.`);
    const g = grids[pick];
    const find = (row, aliases) => { const al = aliases.split('|'); for (let c = 0; c < row.length; c++) { const k = norm(row[c]); if (k && al.includes(k)) return c; } return -1; };
    let hr = -1;
    for (let r = 0; r < Math.min(30, g.length); r++) {
      const row = g[r] || []; let hits = 0;
      for (const grp of 'PCNO;PRODUCTCODE|ITEMCODE|PRODUCTNUMBER;COMPLETEQTY|QTY|QUANTITY;COSTMONTH'.split(';')) if (find(row, grp) >= 0) hits++;
      if (hits >= 3) { hr = r; break; }
    }
    if (hr < 0) throw new Error(`Không thấy dòng tiêu đề (PC No. / Product code / Complete Qty / Cost month) trong 30 dòng đầu của ${pick}.`);
    const H = g[hr];
    const nth = (aliases, occ = 1) => { const al = aliases.split('|'); let hit = 0; for (let c = 0; c < H.length; c++) { const k = norm(H[c]); if (k && al.includes(k)) { hit++; if (hit === occ) return c; } } return -1; };
    const c = { pc: nth('PCNO|PCNUMBER'), dt: nth('DATE|PCDATE|COMPLETEDATE'), mo: nth('MONO'), prod: nth('PRODUCTCODE|ITEMCODE|PRODUCTNUMBER'), name: nth('PRODUCTNAME|ITEMNAME'), loc: nth('LOCATION'), unit: nth('UNIT|BASEUNIT'), qty: nth('COMPLETEQTY|QTY|QUANTITY'), rm: nth('RMCOST', 2), tot: nth('TOTALCOSTVND|TOTALCOST'), a622: nth('DIRECTLABORS|DIRECTLABOR|DIRECTLABOURS|622'), a627: nth('PRODUCTIONCOST|627|OVERHEAD'), price: nth('SALESPRICEUSD|UNITSALESPRICEUSD|SELLINGPRICEUSD'), cm: nth('COSTMONTH'), prov: -1, cons: -1 };
    H.forEach((h, i) => { const k = norm(h); if (k.startsWith('PROVISION') && (k.includes('VDN') || k.includes('VND'))) c.prov = i; if (k.includes('CONSIGNMENT')) c.cons = i; });
    const miss = [['pc', 'PC No.'], ['dt', 'Date'], ['prod', 'Product code'], ['qty', 'Complete Qty'], ['tot', 'Total cost(VND)'], ['a622', 'Direct labors'], ['a627', 'Production cost'], ['cm', 'Cost month']].filter(([k]) => c[k] < 0).map(([, l]) => l);
    if (miss.length) throw new Error(`Thiếu cột trong ${pick} (dòng tiêu đề ${hr + 1}): ${miss.join(', ')}`);
    for (let r = hr + 1; r < g.length; r++) {
      const x = g[r] || []; const prod = utxt(x[c.prod]);
      if (!prod || s5t(x[c.cm])) continue;
      const qty = num(x[c.qty]); if (qty === 0 && num(x[c.tot]) === 0) continue;
      const tot = num(x[c.tot]), a622 = num(x[c.a622]), a627 = num(x[c.a627]);
      rows.push({ period, srcPeriod: prevP, lid: `OP-${s5t(x[c.pc])}-R${r + 1}`, source: 'OPENING', pc: s5t(x[c.pc]), date: dateVal(x[c.dt]), mo: c.mo >= 0 ? s5t(x[c.mo]) : '', prod, name: c.name >= 0 ? s5t(x[c.name]) : '', loc: c.loc >= 0 ? s5t(x[c.loc]) : '', unit: c.unit >= 0 ? s5t(x[c.unit]) : '', qty, rm: c.rm >= 0 ? num(x[c.rm]) : tot - a622 - a627, a622, a627, tot, unitCost: qty !== 0 ? tot / qty : null, price: c.price >= 0 ? num(x[c.price]) : null, prov: c.prov >= 0 ? num(x[c.prov]) : null, cons: c.cons >= 0 ? s5t(x[c.cons]) : '', status: 'NOT VALIDATED', msg: '' });
    }
    srcLabel = `${fileName} | ${pick}`;
  }
  return { period, status: 'LOADED - NOT VALIDATED', loadedAt: nowISO(), source: srcLabel, srcKind, validatedAt: '', rows, stats: openStats(rows) };
}
function periodText(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) { const { y, m } = serialToYMD(v); return `${y}-${String(m).padStart(2, '0')}`; }
  let t = ttxt(v); if (/^\d{6}$/.test(t)) t = t.slice(0, 4) + '-' + t.slice(4);
  return t;
}
const openStats = (rows) => ({ layers: rows.length, qty: rows.reduce((a, r) => a + num(r.qty), 0), amt: rows.reduce((a, r) => a + num(r.tot), 0) });

/** STEP5_Roll_Forward_Opening — previous closing layers become this period's opening. */
export function openingFromClosing(prevStep5, period, overrideReason) {
  const prevP = prevPeriod(period);
  if (!prevStep5 || prevStep5.period !== prevP) throw new Error(`Chưa có Closing FG của kỳ ${prevP} trên web.`);
  if (!String(prevStep5.runResult || '').toUpperCase().startsWith('PASS')) throw new Error(`Closing FG ${prevP} chưa đối chiếu xong (Run Result = ${prevStep5.runResult}). Sửa STEP 5 của ${prevP} trước.`);
  const rows = prevStep5.closing.map((r) => ({ ...r, period, source: 'OPENING', status: 'NOT VALIDATED', msg: '' }));
  return { period, status: 'LOADED - NOT VALIDATED', loadedAt: nowISO(), source: `ROLL FORWARD from 05_FG_CLOSING ${prevP}${overrideReason ? ` (override: ${overrideReason})` : ''}`, srcKind: 'ROLL FORWARD', validatedAt: '', rows, stats: openStats(rows) };
}

/** STEP5_Validate_Opening_FG */
export function validateOpeningFG(open, period) {
  if (!open || utxt(open.status) === 'NOT LOADED') throw new Error('Chưa nạp Opening FG.');
  const { start } = periodBounds(period);
  const keys = new Map(); let nBlock = 0, nReview = 0;
  open.rows.forEach((r, i) => {
    let sev = 0, msg = '';
    const prod = utxt(r.prod), qty = num(r.qty), rm = num(r.rm), v622 = num(r.a622), v627 = num(r.a627), tot = num(r.tot);
    if (s5t(r.period) !== period) { sev = 2; msg += `Period <> ${period}; `; }
    if (!prod) { sev = 2; msg += 'Product Code blank; '; }
    if (!s5t(r.pc)) { sev = 2; msg += 'PC No. blank; '; }
    const d = dateVal(r.date);
    if (d === null) { sev = 2; msg += 'Layer Date missing; '; } else if (d >= start) { sev = 2; msg += `Layer Date is not before ${period}-01; `; }
    if (qty <= 0) { sev = 2; msg += 'Qty <= 0; '; }
    if (tot <= 0) { sev = 2; msg += 'Total Amount <= 0; '; }
    if (rm < 0 || v622 < 0 || v627 < 0) { sev = 2; msg += 'Negative cost component; '; }
    if (Math.abs(rm + v622 + v627 - tot) > 1) { sev = 2; msg += `RM + 622 + 627 <> Total (${(rm + v622 + v627 - tot).toFixed(2)}); `; }
    const u = utxt(r.unit);
    if (u && u !== 'PC' && u !== 'PCS') { if (sev < 1) sev = 1; msg += `Unit '${u}' is not PC/PCS; `; }
    const key = `${prod}|${utxt(r.pc)}|${utxt(r.mo)}|${vbFmt(qty, 4)}|${vbFmt(tot, 0)}`.toUpperCase();
    if (keys.has(key)) { if (sev < 1) sev = 1; msg += `Possible duplicate of row ${keys.get(key) + 6}; `; } else keys.set(key, i);
    if (num(r.prov) !== 0) msg += `Has provision memo ${vbFmt(num(r.prov), 0, true)}; `;
    r.status = sev === 2 ? 'BLOCK' : sev === 1 ? 'REVIEW' : 'OK'; r.msg = msg;
    if (sev === 2) nBlock++; else if (sev === 1) nReview++;
  });
  open.status = nBlock ? 'BLOCKED' : nReview ? 'VALIDATED WITH REVIEW' : 'VALIDATED';
  open.validatedAt = nowISO(); open.stats = { ...openStats(open.rows), block: nBlock, review: nReview };
  return open;
}

// ---------------------------------------------------------------- 5.4 RUN FIFO COGS
function takeLayer(L, take, D, prod, lineNo) {
  let vrm, v622, v627, vtot;
  if (Math.abs((L.qty - L.oq) - take) <= TOLQ) {
    vrm = L.rm - L.orm; v622 = L.a622 - L.o622; v627 = L.a627 - L.o627; vtot = L.tot - L.otot;
    take = L.qty - L.oq;
  } else {
    const f = take / L.qty;
    vrm = L.rm * f; v622 = L.a622 * f; v627 = L.a627 * f; vtot = L.tot * f;
  }
  L.oq += take; L.orm += vrm; L.o622 += v622; L.o627 += v627; L.otot += vtot;
  const d = { prod, line: lineNo, L, qty: take, rm: vrm, a622: v622, a627: v627, tot: vtot };
  D.push(d);
  return d;
}

/**
 * Sales FIFO. ctx = { period, opening, caRows (Step 4 final rows), salesRows (Sales DB rows), pmRows, fx,
 *   overrides: {lineKey: treatment}, mode, tol, step4: { current, overall, finalCost, qty } }
 */
export function runFIFO(ctx) {
  const t0 = Date.now();
  const { period, opening } = ctx;
  const { start: pStart, end: pEnd } = periodBounds(period);
  // gates
  const openStatus = utxt(opening && opening.status);
  if (!openStatus.startsWith('VALIDATED')) throw new Error(`Opening FG đang ở trạng thái '${openStatus || 'NOT LOADED'}'. Chạy VALIDATE OPENING FG (không còn BLOCK) trước.`);
  if (opening.rows.length && s5t(opening.rows[0].period) !== period) throw new Error(`Kỳ của Opening FG khác kỳ ${period}.`);
  if (utxt(ctx.step4.current) !== 'CURRENT') throw new Error('Kết quả STEP 4 không CURRENT. Chạy lại STEP 4 trước.');
  if (!utxt(ctx.step4.overall).startsWith('PASS')) throw new Error(`STEP 4 tổng thể chưa PASS (${ctx.step4.overall}).`);
  const mode = utxt(ctx.mode) === 'STRICT_DATE' ? 'STRICT_DATE' : 'MONTHLY';
  const tol = num(ctx.tol) > 0 ? num(ctx.tol) : 1;

  // ledger: opening layers
  const L = [];
  for (const r of opening.rows) {
    if (!s5t(r.prod) || !(num(r.qty) > 0)) continue;
    L.push({ lid: s5t(r.lid), src: 'OPENING', sp: s5t(r.srcPeriod), pc: s5t(r.pc), dt: dateVal(r.date) || 0, mo: s5t(r.mo), prod: utxt(r.prod), name: s5t(r.name), loc: s5t(r.loc), unit: s5t(r.unit), qty: num(r.qty), rm: num(r.rm), a622: num(r.a622), a627: num(r.a627), tot: num(r.tot), price: num(r.price), prov: num(r.prov), cons: s5t(r.cons), flag: utxt(r.status) === 'REVIEW' ? 'OPENING REVIEW: ' + s5t(r.msg) : '' });
  }
  const nO = L.length;
  if (!ctx.caRows || !ctx.caRows.length) throw new Error('04_COST_ALLOCATION chưa có lô sản xuất.');
  let step4Qty = 0, step4Cost = 0;
  for (const r of ctx.caRows) {
    const prod = utxt(r.prod), qty = num(r.qty);
    if (!s5t(r.pc) || !prod || !(qty > 0)) continue;
    const n = L.length + 1 - nO;
    const l = { lid: `PR-${period.replace('-', '')}-${s5t(r.pc)}-${pad(n, 3)}`, src: 'PRODUCTION', sp: period, pc: s5t(r.pc), dt: dateVal(r.date) || 0, mo: s5t(r.sub) || s5t(r.mo), prod, name: s5t(r.name), loc: s5t(r.loc), unit: s5t(r.unit), qty, rm: num(r.totalRM), a622: num(r.t622), a627: num(r.t627), tot: num(r.totalCost), price: num(r.price), prov: 0, cons: '', flag: '' };
    if (/NON-POSITIVE/i.test(txt(r.statusText))) l.flag = 'STEP 4 REVIEW: no 622/627 allocated (non-positive contribution)';
    L.push(l); step4Qty += qty; step4Cost += l.tot;
  }
  L.forEach((l, i) => { Object.assign(l, { i: i + 1, oq: 0, orm: 0, o622: 0, o627: 0, otot: 0 }); });
  // sort: product, layer date, opening first, source order
  const sorted = L.map((l) => ({ k: `${l.prod}\x01${pad(l.dt, 6)}\x01${l.src === 'OPENING' ? '0' : '1'}\x01${pad(l.i, 6)}`, l }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).map((x) => x.l);
  const first = new Map(), last = new Map();
  sorted.forEach((l, pos) => { if (!first.has(l.prod)) first.set(l.prod, pos); last.set(l.prod, pos); });

  // sales lines
  const ovr = new Map(Object.entries(ctx.overrides || {}).map(([k, v]) => [k.toUpperCase(), utxt(v)]));
  const excluded = new Set(Object.entries(ctx.dupDecisions || {}).filter(([, v]) => v === 'EXCLUDE').map(([k]) => k.toUpperCase()));
  const S = []; const keyCount = new Map(); const need = new Map(); const lines = new Map();
  let overridesUsed = 0, reviewLines = 0, sumEligQ = 0, advisory = 0;
  const returnsOn = ctx.returns !== 'LEGACY';
  const sellRate = num(ctx.sellCostRate); // NRV: estimated selling cost as a share of the selling price
  const undated = []; // audit F-05: sales rows whose date cannot be read never silently drop out of COGS
  (ctx.salesRows || []).forEach((r, idx) => {
    const d = saleDate(r); // Bill (B/L) date when present, else invoice date (owner decision 02/10/2026)
    if (d === null) { if (utxt(r.product) || num(r.qty) !== 0) undated.push({ dbRow: idx + 6, inv: s5t(r.invNo), cust: s5t(r.customer), prod: utxt(r.product), qty: num(r.qty), vnd: num(r.amtVND), rawDate: r.invDate === null || r.invDate === undefined ? '' : String(r.invDate) }); return; }
    if (d < pStart || d > pEnd) return;
    const s = { seq: S.length + 1, date: d, origInv: s5t(r.origInv), prod: utxt(r.product), qty: num(r.qty), dbRow: idx + 6, inv: s5t(r.invNo), cust: s5t(r.customer), name: s5t(r.prodName), usd: num(r.amtUSD), vnd: num(r.amtVND), type: utxt(r.tranType), remark: s5t(r.remark), def: '', ovr: '', fin: '', fq: 0, rm: 0, c622: 0, c627: 0, tot: 0, status: '', msg: '' };
    s.key = lineKey(r, d, keyCount);
    if (excluded.has(s.key.toUpperCase())) { s.def = 'NO COGS'; s.msg = 'Confirmed duplicate – excluded from FIFO; '; }
    else if (!s.prod && s.qty !== 0 && !['CREDIT NOTE', 'ADJUSTMENT', 'NON-PRODUCT REVENUE'].includes(s.type)) { s.def = 'REVIEW'; s.msg = 'Quantity without Product Number; '; }
    else if (s.type === 'SALES RETURN') {
      if (s.qty < 0 && returnsOn) s.def = 'RETURN'; // physical return: reverse original COGS and restore FG
      else { s.def = 'REVIEW'; s.msg = 'SALES RETURN requires negative quantity and the return engine; '; }
    }
    else if (s.type === 'CREDIT NOTE' || s.type === 'NON-PRODUCT REVENUE') { s.def = 'NO COGS'; s.msg = s.type + ' – financial/revenue transaction, no physical FG movement; '; }
    else if (s.type === 'OTHER' || s.type === 'ADJUSTMENT') { s.def = 'REVIEW'; s.msg = s.type + ' requires explicit accounting treatment; '; }
    else if (s.qty < 0) { s.def = 'REVIEW'; s.msg = 'Negative quantity is not a SALES RETURN; '; }
    else if (!s.prod || s.qty === 0) s.def = 'NO COGS';
    else if (!['NORMAL SALE', 'FOC', 'SAMPLE'].includes(s.type)) { s.def = 'REVIEW'; s.msg = 'Unsupported inventory Transaction Type; '; }
    else if (!first.has(s.prod)) { s.def = 'REVIEW'; s.msg = 'No FG layer for this Product Code; '; }
    else s.def = 'FIFO COGS';
    s.fin = s.def;
    const o = ovr.get(s.key.toUpperCase());
    if (o !== undefined) {
      s.ovr = o;
      if (['FIFO COGS', 'NO COGS', 'REVIEW'].includes(o) || (o === 'RETURN' && returnsOn && s.qty < 0)) {
        s.fin = o; overridesUsed++;
        if (s.fin === 'FIFO COGS' && (s.qty <= 0 || !first.has(s.prod))) { s.fin = 'REVIEW'; s.msg += 'Override FIFO COGS rejected (qty <= 0 or no FG layer); '; }
      }
    }
    if (s.fin === 'NO COGS') s.status = 'NO COGS';
    if (s.fin === 'REVIEW') { s.status = 'REVIEW'; reviewLines++; }
    if (utxt(r.validResult) === 'REVIEW') { s.vmsg = s5t(r.validMsg); if (s.fin === 'FIFO COGS') advisory++; } // audit F-23
    if (s.fin === 'FIFO COGS') {
      need.set(s.prod, (need.get(s.prod) || 0) + s.qty);
      if (!lines.has(s.prod)) lines.set(s.prod, []); lines.get(s.prod).push(s);
      sumEligQ += s.qty;
    }
    S.push(s);
  });

  // Sales returns are inventory events. For accounting safety, returns require chronological FIFO;
  // MONTHLY cannot prove when returned FG became available for a later sale/rework in the same period.
  const returns = S.filter((s) => s.fin === 'RETURN');
  if (mode === 'MONTHLY' && returns.length) throw new Error('Có Sales Return trong kỳ. Chuyển FIFO sang STRICT_DATE để hoàn nhập COGS và đưa hàng trả lại vào đúng thứ tự thời gian.');
  const returnByProd = new Map();
  for (const s of returns) { if (!returnByProd.has(s.prod)) returnByProd.set(s.prod, []); returnByProd.get(s.prod).push(s); }
  let retQ = 0, retA = 0, retN = 0;
  const originNow = new Map(), returnedNow = new Map();
  const originKey = (o) => `${utxt(o.inv)}|${utxt(o.prod)}`;

  // FIFO allocation
  const D = []; let shortProducts = 0; const undatedUsed = new Set();
  const rwByProd = new Map(), rwPlan = [];
  if (mode !== 'MONTHLY' && ctx.register) ctx.register.rows.forEach((r, i) => {
    if (utxt(r.active) !== 'Y' || utxt(r.inputCheck).includes('BLOCK') || !(num(r.issueQty) > TOLQ)) return;
    const p = utxt(r.fg); if (!rwByProd.has(p)) rwByProd.set(p, []);
    rwByProd.get(p).push({ i, d: dateVal(r.issueDate) || 0, qty: num(r.issueQty) });
  });
  for (const [prod, list] of lines) {
    if (mode === 'MONTHLY') {
      let nd = need.get(prod), tq = 0, trm = 0, t622 = 0, t627 = 0, ttot = 0;
      for (let pos = first.get(prod); pos <= last.get(prod); pos++) {
        if (nd <= TOLQ) break;
        const l = sorted[pos]; const avail = l.qty - l.oq;
        if (avail > TOLQ) {
          const take = avail <= nd + TOLQ ? avail : nd;
          const d = takeLayer(l, take, D, prod, 0);
          tq += d.qty; trm += d.rm; t622 += d.a622; t627 += d.a627; ttot += d.tot;
          nd -= take;
        }
      }
      if (nd > TOLQ) shortProducts++;
      let cq = 0, crm = 0, c622 = 0, c627 = 0, ct = 0;
      list.forEach((s, li) => {
        if (li < list.length - 1) {
          const fr = s.qty / need.get(prod);
          s.fq = tq * fr; s.rm = trm * fr; s.c622 = t622 * fr; s.c627 = t627 * fr; s.tot = ttot * fr;
        } else { s.fq = tq - cq; s.rm = trm - crm; s.c622 = t622 - c622; s.c627 = t627 - c627; s.tot = ttot - ct; }
        cq += s.fq; crm += s.rm; c622 += s.c622; c627 += s.c627; ct += s.tot;
        if (nd > TOLQ) { s.status = 'INSUFFICIENT FG'; s.msg += `Product short by ${vbFmt(nd, 4, true)} units for the period; `; } else s.status = 'OK';
      });
    }
  }
  // STRICT_DATE (owner decision 02/10/2026): sales and FG rework issues of a product run through FIFO in one date order;
  // each event can only use layers dated on/before it. Rework takes are reserved here and booked by runReworkFIFO.
  function strictProduct(prod, list) {
    const prodLayers = sorted.filter((l) => l.prod === prod);
    const ret = returnByProd.get(prod) || [];
    const ev = [
      ...list.map((s) => ({ k: 'S', d: s.date, o: s.dbRow, s })),
      ...ret.map((s) => ({ k: 'T', d: s.date, o: s.dbRow, s })),
      ...(rwByProd.get(prod) || []).map((e) => ({ k: 'R', d: e.d, o: e.i, e })),
    ].sort((a, b) => a.d - b.d || (a.k === b.k ? a.o - b.o : a.k === 'T' ? -1 : a.k === 'R' && b.k === 'S' ? -1 : 1));
    let short = false;
    const currentOrigins = () => [...originNow.values()].filter((o) => o.prod === prod && o.date <= (currentEventDate || Number.MAX_SAFE_INTEGER));
    let currentEventDate = null;
    for (const x of ev) {
      currentEventDate = x.d;
      if (x.k === 'T') {
        const s = x.s; const q = -s.qty;
        const prior = (ctx.priorSales || []).filter((o) => utxt(o.prod) === prod && num(o.fq) > TOLQ && num(o.date) <= s.date);
        const cand = [...currentOrigins(), ...prior];
        let o = null;
        if (s.origInv) {
          o = cand.filter((z) => utxt(z.inv) === utxt(s.origInv)).sort((a, b) => b.date - a.date)[0] || null;
          if (!o) {
            s.fin = 'REVIEW'; s.status = 'REVIEW'; reviewLines++;
            s.msg += `Return: Original Invoice ${s.origInv} not found for product ${prod}; no automatic fallback is allowed; `;
            continue;
          }
        } else {
          const same = cand.filter((z) => utxt(z.cust) === utxt(s.cust)).sort((a, b) => b.date - a.date);
          if (same.length === 1) o = same[0];
          else {
            s.fin = 'REVIEW'; s.status = 'REVIEW'; reviewLines++;
            s.msg += same.length ? 'Return: multiple possible original invoices – enter Original Invoice No.; ' : 'Return: original sale not found – enter Original Invoice No.; ';
            continue;
          }
        }
        const ok = originKey(o), already = num(o.returned) + (returnedNow.get(ok) || 0), avail = Math.max(0, num(o.fq) - already);
        if (q > avail + TOLQ) {
          s.fin = 'REVIEW'; s.status = 'REVIEW'; reviewLines++;
          s.msg += `Return qty ${vbFmt(q, 4, true)} exceeds remaining returnable qty ${vbFmt(avail, 4, true)} of ${o.inv}; `;
          continue;
        }
        const f = q / num(o.fq);
        s.fq = -q; s.rm = -num(o.rm) * f; s.c622 = -num(o.c622) * f; s.c627 = -num(o.c627) * f; s.tot = -num(o.tot) * f;
        s.matchedOrigInv = o.inv; s.status = 'RETURNED';
        s.msg += `Return at original COGS of ${o.inv} (${o.period || period}); `;
        returnedNow.set(ok, (returnedNow.get(ok) || 0) + q);
        retN++; retQ += q; retA += -s.tot;
        const l = { lid: `RT-${period.replace('-', '')}-${s.inv || 'NOINV'}-${pad(retN, 3)}`, src: 'RETURN', sp: period, pc: o.inv || '', dt: s.date, mo: '', prod, name: s.name, loc: '', unit: '', qty: q, rm: -s.rm, a622: -s.c622, a627: -s.c627, tot: -s.tot, price: 0, prov: 0, cons: '', flag: `Sales return ${s.inv}`, oq: 0, orm: 0, o622: 0, o627: 0, otot: 0, i: 900000 + retN };
        s.returnLid = l.lid;
        sorted.push(l); prodLayers.push(l);
        prodLayers.sort((a, b) => a.dt - b.dt || (a.src === 'OPENING' ? -1 : b.src === 'OPENING' ? 1 : a.i - b.i));
        continue;
      }

      let nd = x.k === 'S' ? x.s.qty : x.e.qty; const takes = [];
      for (const l of prodLayers) {
        if (nd <= TOLQ) break;
        if (!(l.dt <= x.d || l.dt === 0)) continue;
        const avail = l.qty - l.oq - (l.rq || 0);
        if (avail <= TOLQ) continue;
        const take = avail <= nd + TOLQ ? avail : nd;
        if (l.dt === 0 && l.src !== 'OPENING') undatedUsed.add(l.lid || `${l.pc}|${prod}`);
        if (x.k === 'S') {
          const s = x.s; const d = takeLayer(l, take, D, prod, s.seq);
          if (l.dt === 0 && l.src !== 'OPENING') s.msg += `Used production layer ${l.pc || ''} without completion date; `;
          s.fq += d.qty; s.rm += d.rm; s.c622 += d.a622; s.c627 += d.a627; s.tot += d.tot;
        } else { l.rq = (l.rq || 0) + take; takes.push({ lid: l.lid, qty: take }); }
        nd -= take;
      }
      if (x.k === 'S') {
        const s = x.s;
        if (nd > TOLQ) { short = true; s.status = 'INSUFFICIENT FG'; s.msg += `Short by ${vbFmt(nd, 4, true)} units (no eligible layer dated on/before invoice); `; }
        else s.status = 'OK';
        if (s.fq > TOLQ && s.inv) {
          const ok = originKey({ inv: s.inv, prod });
          const p = originNow.get(ok);
          if (p) {
            p.fq += s.fq; p.rm += s.rm; p.c622 += s.c622; p.c627 += s.c627; p.tot += s.tot;
            p.date = Math.min(p.date, s.date);
          } else originNow.set(ok, { inv: s.inv, cust: s.cust, prod, date: s.date, fq: s.fq, rm: s.rm, c622: s.c622, c627: s.c627, tot: s.tot, period, returned: 0 });
        }
      } else rwPlan[x.e.i] = { takes, short: nd > TOLQ ? nd : 0 };
    }
    if (short) shortProducts++;
  }
  if (mode !== 'MONTHLY') {
    const products = new Set([...lines.keys(), ...rwByProd.keys(), ...returnByProd.keys()]);
    for (const prod of products) strictProduct(prod, lines.get(prod) || []);
    sorted.sort((a, b) => a.prod.localeCompare(b.prod) || a.dt - b.dt || (a.src === 'OPENING' ? -1 : b.src === 'OPENING' ? 1 : a.i - b.i));
  }

  // Sales returns were already processed as chronological inventory events above.

  // outputs
  const fx = num(ctx.fx);
  const price = new Map();
  for (const p of ctx.pmRows || []) if (s5t(p.product) && num(p.finalPrice) > 0) price.set(utxt(p.product), num(p.finalPrice));
  const ledger = [], closing = [], sum = [], prodIx = new Map();
  let nrv = 0, negLayers = 0;
  const T = { openQ: 0, openA: 0, prodQ: 0, prodA: 0, cogsQ: 0, cogsA: 0, closeQ: 0, closeA: 0 };
  const cOpen = [0, 0, 0, 0], cProd = [0, 0, 0, 0], cCogs = [0, 0, 0, 0], cClose = [0, 0, 0, 0];
  sorted.forEach((l, pos) => {
    let remQ = l.qty - l.oq; if (Math.abs(remQ) <= TOLQ) remQ = 0;
    if (remQ < 0) negLayers++;
    const remRm = l.rm - l.orm, rem622 = l.a622 - l.o622, rem627 = l.a627 - l.o627, remTot = l.tot - l.otot;
    l.pos = pos + 1; l.remQ = remQ; l.remTot = remTot;
    ledger.push({ seq: pos + 1, lid: l.lid, source: l.src, srcPeriod: l.sp, pc: l.pc, date: l.dt > 0 ? l.dt : null, mo: l.mo, prod: l.prod, name: l.name, unit: l.unit, qtyIn: l.qty, rm: l.rm, a622: l.a622, a627: l.a627, tot: l.tot, unitCost: l.qty !== 0 ? l.tot / l.qty : null, qtyOut: l.oq, rmOut: l.orm, o622: l.o622, o627: l.o627, totOut: l.otot, remQ, remTot, flag: l.flag, loc: l.loc, price: l.price, prov: l.prov, cons: l.cons });
    if (!prodIx.has(l.prod)) { prodIx.set(l.prod, sum.length); sum.push({ prod: l.prod, name: l.name, openQ: null, openA: null, prodQ: null, prodA: null, cogsQ: 0, cogsRM: 0, cogs622: 0, cogs627: 0, cogsA: 0, closeQ: null, closeA: null, eligQ: null, layers: null, status: '', msg: '' }); }
    const k = sum[prodIx.get(l.prod)];
    if (l.src === 'OPENING') {
      k.openQ = num(k.openQ) + l.qty; k.openA = num(k.openA) + l.tot; T.openQ += l.qty; T.openA += l.tot;
      cOpen[0] += l.rm; cOpen[1] += l.a622; cOpen[2] += l.a627; cOpen[3] += l.tot;
    } else if (l.src === 'RETURN') { // a return reduces COGS (net 632) and comes back as a layer
      k.cogsQ -= l.qty; k.cogsRM -= l.rm; k.cogs622 -= l.a622; k.cogs627 -= l.a627; k.cogsA -= l.tot; k.retQ = num(k.retQ) + l.qty; k.retA = num(k.retA) + l.tot;
      T.cogsQ -= l.qty; T.cogsA -= l.tot;
      cCogs[0] -= l.rm; cCogs[1] -= l.a622; cCogs[2] -= l.a627; cCogs[3] -= l.tot;
    } else {
      k.prodQ = num(k.prodQ) + l.qty; k.prodA = num(k.prodA) + l.tot; T.prodQ += l.qty; T.prodA += l.tot;
      cProd[0] += l.rm; cProd[1] += l.a622; cProd[2] += l.a627; cProd[3] += l.tot;
    }
    k.cogsQ += l.oq; k.cogsRM += l.orm; k.cogs622 += l.o622; k.cogs627 += l.o627; k.cogsA += l.otot;
    T.cogsQ += l.oq; T.cogsA += l.otot;
    cCogs[0] += l.orm; cCogs[1] += l.o622; cCogs[2] += l.o627; cCogs[3] += l.otot;
    if (remQ > 0) {
      const c = { period, srcPeriod: l.sp, lid: l.lid, source: l.src, pc: l.pc, date: l.dt > 0 ? l.dt : null, mo: l.mo, prod: l.prod, name: l.name, loc: l.loc, unit: l.unit, qty: remQ, rm: remRm, a622: rem622, a627: rem627, tot: remTot, unitCost: remTot / remQ, price: null, prov: null, cons: l.cons, status: '', msg: '' };
      let px = l.price; if (price.has(l.prod)) px = price.get(l.prod);
      c.price = px;
      let provShare = 0;
      if (l.prov !== 0) { provShare = l.prov * remQ / l.qty; c.prov = provShare; }
      const netUnit = (remTot + provShare) / remQ;
      const nrvUnit = px > 0 && fx > 0 ? px * fx * (1 - sellRate) : 0; // NRV = selling price − estimated selling cost
      if (nrvUnit > 0) { c.nrvUnit = nrvUnit; c.provNeed = Math.max(0, netUnit - nrvUnit) * remQ; }
      if (px > 0 && fx > 0 && netUnit > nrvUnit + 1) { c.status = 'REVIEW - COST > PRICE'; c.msg = sellRate ? `Unit cost after provision ${vbFmt(netUnit, 0, true)} > NRV ${vbFmt(nrvUnit, 0, true)} VND (price ${vbFmt(px * fx, 0, true)} − ${(sellRate * 100).toFixed(1)}% selling cost); provision needed ${vbFmt(c.provNeed, 0, true)}` : `Unit cost after provision ${vbFmt(netUnit, 0, true)} > price ${vbFmt(px * fx, 0, true)} VND (NRV review)`; nrv++; }
      else c.status = 'OK';
      if (l.flag) c.msg = `${c.msg} ${l.flag}`.trim();
      closing.push(c);
      k.closeQ = num(k.closeQ) + remQ; k.closeA = num(k.closeA) + remTot; k.layers = num(k.layers) + 1;
      T.closeQ += remQ; T.closeA += remTot;
      cClose[0] += remRm; cClose[1] += rem622; cClose[2] += rem627; cClose[3] += remTot;
    }
  });
  for (const [prod, n] of need) {
    if (!prodIx.has(prod)) { prodIx.set(prod, sum.length); sum.push({ prod, name: '', cogsQ: 0, cogsRM: 0, cogs622: 0, cogs627: 0, cogsA: 0 }); }
    sum[prodIx.get(prod)].eligQ = n;
  }
  for (const k of sum) {
    if (num(k.eligQ) - num(k.cogsQ) > TOLQ) { k.status = 'INSUFFICIENT FG'; k.msg = 'Eligible sales exceed available FG'; }
    else if (num(k.cogsQ) === 0 && num(k.prodQ) === 0) k.status = 'NO MOVEMENT';
    else k.status = 'OK';
    // VBA writes 0 COGS cells only when touched; keep numbers
  }
  let sumLineA = 0;
  const sales = S.map((s) => {
    const o = { seq: s.seq, date: s.date, inv: s.inv, cust: s.cust, prod: s.prod, name: s.name, qty: s.qty, usd: s.usd, vnd: s.vnd, type: s.type, remark: s.remark, def: s.def, ovr: s.ovr, fin: s.fin, fq: null, rm: null, c622: null, c627: null, tot: null, unit: null, status: s.status, msg: s.msg, key: s.key, dbRow: s.dbRow, returnLid: s.returnLid || '' };
    if (s.fin === 'FIFO COGS') { Object.assign(o, { fq: s.fq, rm: s.rm, c622: s.c622, c627: s.c627, tot: s.tot, unit: s.fq !== 0 ? s.tot / s.fq : null }); sumLineA += s.tot; }
    else if (s.fin === 'RETURN' && s.status === 'RETURNED') Object.assign(o, { fq: s.fq, rm: s.rm, c622: s.c622, c627: s.c627, tot: s.tot, unit: s.fq !== 0 ? s.tot / s.fq : null, origInv: s.origInv || s.matchedOrigInv });
    return o;
  });
  let sumDetA = 0;
  const detail = D.map((d, k) => {
    sumDetA += d.tot;
    return { seq: k + 1, prod: d.prod, line: d.line > 0 ? d.line : null, lid: d.L.lid, source: d.L.src, pc: d.L.pc, date: d.L.dt > 0 ? d.L.dt : null, layerQty: d.L.qty, qty: d.qty, rm: d.rm, a622: d.a622, a627: d.a627, tot: d.tot, unit: d.qty !== 0 ? d.tot / d.qty : null, take: Math.abs(d.qty - d.L.qty) <= TOLQ ? 'FULL' : 'PARTIAL', left: d.L.qty - d.L.oq };
  });
  const totals = { ...T, cogsRM: cCogs[0], cogs622: cCogs[1], cogs627: cCogs[2], eligQ: sumEligQ, layers: closing.length, retQ, retA, nrvProv: closing.reduce((a, c) => a + num(c.provNeed), 0) };

  // reconciliation rows 4..16
  let compDiff = 0;
  for (let k = 0; k < 3; k++) compDiff = Math.max(compDiff, Math.abs(cOpen[k] + cProd[k] - cCogs[k] - cClose[k]));
  const rec = {}; let anyBlock = false, anyReview = false;
  const put = (r, expected, result, diff, status, note) => { rec[r] = { expected, result, diff, status, note }; if (status === 'BLOCK' || status === 'CHECK') anyBlock = true; if (status === 'REVIEW') anyReview = true; };
  const putN = (r, e, x, t, note) => put(r, e, x, x - e, Math.abs(x - e) <= t ? 'PASS' : 'CHECK', note);
  const putC = (r, n, fail, note) => put(r, 0, n, n, n === 0 ? 'PASS' : fail, note);
  put(4, 'VALIDATED', openStatus, '', openStatus === 'VALIDATED' ? 'PASS' : 'REVIEW', `Opening layers: ${nO}`);
  put(5, 'CURRENT & PASS', `${ctx.step4.current} / ${ctx.step4.overall}`, '', 'PASS', 'Gate checked before run');
  putN(6, num(ctx.step4.finalCost), T.prodA, tol, `Production layers: ${L.length - nO}`);
  putN(7, num(ctx.step4.qty), T.prodQ, TOLQ, '');
  putN(8, 0, T.openQ + T.prodQ - T.cogsQ - T.closeQ, TOLQ, '');
  putN(9, 0, T.openA + T.prodA - T.cogsA - T.closeA, tol, '');
  putN(10, 0, compDiff, tol, '');
  putN(11, sumEligQ - retQ, T.cogsQ, TOLQ, `Mode: ${mode}${retQ ? ` · net of returns ${vbFmt(retQ, 4, true)}` : ''}`);
  putN(12, sumDetA, sumLineA, tol, `FIFO detail rows: ${D.length}`);
  putC(13, shortProducts, 'BLOCK', 'See 05_COGS_SUMMARY status INSUFFICIENT FG');
  putC(14, negLayers, 'BLOCK', '');
  putC(15, reviewLines, 'REVIEW', '05_SALES_COGS Final Treatment = REVIEW');
  putC(16, nrv, 'REVIEW', '05_FG_CLOSING status REVIEW - COST > PRICE');
  const runResult = anyBlock ? 'BLOCKED' : anyReview ? 'PASS WITH REVIEW' : 'PASS';
  return {
    period, runAt: nowISO(), mode, tol, runSeconds: Math.round((Date.now() - t0) / 100) / 10, overridesUsed, openLayers: nO, runResult,
    ledger, sales, detail, closing, summary: sum, totals, rec, sumDetA, sumLineA, step4Qty, step4Cost,
    stats: { lines: S.length, products: need.size, reviewLines, shortProducts, nrv, negLayers, advisory, undatedLayers: undatedUsed.size, returns: retN, sellRate },
    undated,
    // internal (dropped before saving): layers for the rework pass
    _sorted: sorted, _rwPlan: mode !== 'MONTHLY' ? rwPlan : null,
  };
}
/** 05_SALES_COGS Line Key: Transaction Key (or fallback) + '#' + occurrence within the period. */
function lineKey(r, d, keyCount) {
  let base = s5t(r.txnKey);
  if (!base) base = `${ymd(d)}|${s5t(r.invNo)}|${utxt(r.product)}|${vbFmt(num(r.qty), 4)}|${num(r.amtUSD).toFixed(2)}`;
  const ku = base.toUpperCase(); keyCount.set(ku, (keyCount.get(ku) || 0) + 1);
  return `${base}#${keyCount.get(ku)}`;
}
/**
 * Sales lines of the period that share a Transaction Key (F-03). The sales file has no Invoice Line No., so several genuine
 * lines of one invoice can look identical; each repeat (#2, #3 …) must be confirmed KEEP or EXCLUDE before close.
 */
export function duplicateGroups(salesRows, period) {
  const { start, end } = periodBounds(period);
  const keyCount = new Map(); const groups = new Map();
  (salesRows || []).forEach((r, idx) => {
    const d = saleDate(r); if (d === null || d < start || d > end) return;
    const key = lineKey(r, d, keyCount); const base = key.slice(0, key.lastIndexOf('#')).toUpperCase();
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ key, occ: +key.slice(key.lastIndexOf('#') + 1), dbRow: idx + 6, date: d, inv: s5t(r.invNo), cust: s5t(r.customer), prod: utxt(r.product), name: s5t(r.prodName), qty: num(r.qty), usd: num(r.amtUSD), vnd: num(r.amtVND) });
  });
  return [...groups.values()].filter((g) => g.length > 1);
}
const ymd = (serial) => { const { y, m, d } = serialToYMD(serial); return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`; };

// ---------------------------------------------------------------- 5B FG REWORK FIFO
export const reworkCount = (register) => (register ? register.rows.filter((r) => r.active === 'Y' || r.active === 'B/F').length : 0);
export const activeReworkCount = (register) => (register ? register.rows.filter((r) => r.active === 'Y').length : 0);

/** RW_CountChronologyConflicts — same-product sale of the period dated on/after the rework issue date. */
export function chronologyConflicts(register, salesRows, period) {
  if (!register) return 0;
  const pYM = period.replace('-', ''); let n = 0;
  const S = (salesRows || []).map((r) => ({ prod: ttxt(r.product), qty: num(r.qty), d: saleDate(r) || 0 }));
  for (const r of register.rows) {
    if (utxt(r.active) !== 'Y') continue;
    const prod = ttxt(r.fg), iss = num(r.issueDate);
    if (!prod || !(iss > 0)) continue;
    for (const s of S) if (s.prod === prod && s.qty > TOL_QTY && s.d >= iss && s.d > 0 && ymOf(s.d) === pYM) n++;
  }
  return n;
}

/** Pre-run gate of STEP5_FGREWORK_Run_FIFO_v1_1. Returns '' or a blocking message. */
export function reworkGate(register, salesRows, period, mode) {
  if (!reworkCount(register)) return '';
  let m = utxt(mode) || 'MONTHLY'; let conflicts = chronologyConflicts(register, salesRows, period);
  if (!activeReworkCount(register)) { m = 'MONTHLY'; conflicts = 0; }
  if (m === 'MONTHLY' && conflicts > 0) return `BLOCK - STRICT DATE REQUIRED: ${conflicts} sự kiện rework có bán hàng cùng sản phẩm từ ngày xuất rework trở đi. Phân bổ MONTHLY sau bán hàng sẽ sai thứ tự FIFO – chuyển sang STRICT_DATE.`;
  return ''; // STRICT_DATE runs sales and rework in one date order (owner decision 02/10/2026)
}

/**
 * RW_RunMonthlyReworkFIFO + RW_ProcessOpeningRework + RW_RefreshClosingFromLedger + RW_PatchCOGSSummary + RW_PatchStep5Reconciliation.
 * Mutates res (ledger / closing / summary / rec) and register rows (FIFO results). step4Carry = carry-in in Step 4 at the time of the run.
 */
export function runReworkFIFO(res, register, ctx) {
  const { period, opening, salesRows, step4Carry } = ctx;
  const now = nowISO();
  const ledger = res.ledger;
  // events: active Y, input check not BLOCK, qty > tol, stable by issue date
  const ev = register.rows.map((r, i) => ({ r, i })).filter(({ r }) => utxt(r.active) === 'Y' && !utxt(r.inputCheck).includes('BLOCK') && num(r.issueQty) > TOL_QTY);
  const evs = ev.map((x) => ({ ...x, d: num(x.r.issueDate) })).sort((a, b) => a.d - b.d || a.i - b.i);
  const plan = res._rwPlan || null; // STRICT_DATE: layer takes reserved in date order by runFIFO
  const ledgerByLid = new Map(ledger.map((l) => [ttxt(l.lid).toUpperCase(), l]));
  const rwf = []; let lateLayers = 0;
  for (const { r, i } of evs) {
    const prod = plan ? utxt(r.fg) : txt(r.fg); let nd = num(r.issueQty);
    let tq = 0, trm = 0, t622 = 0, t627 = 0, tt = 0;
    const book = (l, take) => {
      const remQty = num(l.remQ); const qIn = num(l.qtyIn);
      if (qIn <= TOL_QTY) throw new Error('Invalid FG layer quantity: ' + l.lid);
      const uRM = num(l.rm) / qIn, u622 = num(l.a622) / qIn, u627 = num(l.a627) / qIn, uT = num(l.tot) / qIn;
      l.qtyOut = num(l.qtyOut) + take; l.rmOut = num(l.rmOut) + take * uRM; l.o622 = num(l.o622) + take * u622; l.o627 = num(l.o627) + take * u627; l.totOut = num(l.totOut) + take * uT;
      l.remQ = remQty - take; l.remTot = num(l.tot) - num(l.totOut);
      const late = !plan && l.source === 'PRODUCTION' && num(l.date) > 0 && num(r.issueDate) > 0 && num(l.date) > num(r.issueDate);
      if (late) lateLayers++;
      rwf.push({ seq: rwf.length + 1, period: r.period, rid: r.rid, issueDate: r.issueDate, fg: prod, pcNo: r.pcNo, outFG: r.outFG, lid: l.lid, layerSrc: l.source, layerDate: l.date, layerQty: qIn, qty: take, rm: take * uRM, a622: take * u622, a627: take * u627, tot: take * uT, unit: uT, rwStatus: r.rwStatus, fifoStatus: late ? 'REVIEW - LAYER AFTER ISSUE DATE' : 'FIFO OK', mode: plan ? 'STRICT_DATE / CHRONOLOGICAL' : 'MONTHLY / POST-SALES SAFE' });
      tq += take; trm += take * uRM; t622 += take * u622; t627 += take * u627; tt += take * uT;
      nd -= take;
    };
    if (plan) {
      for (const t of (plan[i] && plan[i].takes) || []) { const l = ledgerByLid.get(ttxt(t.lid).toUpperCase()); if (l) book(l, t.qty); }
    } else {
      for (const l of ledger) {
        if (nd <= TOL_QTY) break;
        if (l.prod !== prod) continue;
        const remQty = num(l.remQ);
        if (!(remQty > TOL_QTY)) continue;
        book(l, Math.min(nd, remQty));
      }
    }
    const fs = nd > TOL_QTY ? (plan ? 'BLOCK - INSUFFICIENT FG AT ISSUE DATE' : 'BLOCK - INSUFFICIENT FG') : 'PASS';
    r.fifoStatus = fs; r.fifoQty = tq; r.fifoCost = tt;
    if (utxt(r.rwStatus) === 'COMPLETED' && utxt(r.rwType) === 'NORMAL' && fs === 'PASS') { r.closingWIP = 0; r.carryIn = tt; } else { r.closingWIP = tt; r.carryIn = 0; }
    r.lastFifoRun = now;
  }
  // RW_ProcessOpeningRework
  for (const r of register.rows) {
    if (utxt(r.active) !== 'B/F') continue;
    const cost = num(r.bfCost);
    r.fifoStatus = 'OPENING B/F'; r.fifoQty = 0; r.fifoCost = 0;
    if (utxt(r.rwStatus) === 'COMPLETED' && utxt(r.rwType) === 'NORMAL' && utxt(r.inputCheck) === 'PASS') { r.closingWIP = 0; r.carryIn = cost; } else { r.closingWIP = cost; r.carryIn = 0; }
    r.lastFifoRun = now;
  }
  // RW_RefreshClosingFromLedger
  const byLid = new Map(); for (const l of ledger) if (ttxt(l.lid)) byLid.set(ttxt(l.lid).toUpperCase(), l);
  const closing = []; let nrv = 0;
  for (const c of res.closing) {
    const lid = ttxt(c.lid); if (!lid) continue;
    const oldQty = num(c.qty);
    const l = byLid.get(lid.toUpperCase());
    if (l) {
      const remQty = num(l.remQ);
      if (remQty <= TOL_QTY) continue;
      if (Math.abs(remQty - oldQty) > TOL_QTY) {
        c.qty = remQty; c.rm = num(l.rm) - num(l.rmOut); c.a622 = num(l.a622) - num(l.o622); c.a627 = num(l.a627) - num(l.o627); c.tot = num(l.tot) - num(l.totOut);
        c.unitCost = num(c.tot) / remQty;
        if (oldQty > TOL_QTY && num(c.prov) !== 0) c.prov = num(c.prov) * remQty / oldQty;
      }
    }
    if (utxt(c.status) === 'REVIEW - COST > PRICE') nrv++;
    closing.push(c);
  }
  res.closing = closing;
  res.totals.layers = closing.length; res.totals.closeQ = closing.reduce((a, c) => a + num(c.qty), 0); res.totals.closeA = closing.reduce((a, c) => a + num(c.tot), 0);
  res.rec[16] = { ...res.rec[16], result: nrv, diff: nrv - num(res.rec[16].expected), status: nrv === 0 ? 'PASS' : 'REVIEW' };
  // RW_PatchCOGSSummary
  const dict = () => new Map();
  const dq = dict(), drm = dict(), d622 = dict(), d627 = dict(), dt = dict(), cq = dict(), ca = dict(), cl = dict();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const f of rwf) { const p = ttxt(f.fg).toUpperCase(); if (!p) continue; add(dq, p, f.qty); add(drm, p, f.rm); add(d622, p, f.a622); add(d627, p, f.a627); add(dt, p, f.tot); }
  for (const c of closing) { const p = ttxt(c.prod).toUpperCase(); if (!p) continue; add(cq, p, num(c.qty)); add(ca, p, num(c.tot)); add(cl, p, 1); }
  const g = (m, k) => m.get(k) || 0;
  const RT = { q: 0, rm: 0, a622: 0, a627: 0, tot: 0 };
  for (const k of res.summary) {
    const p = ttxt(k.prod).toUpperCase(); if (!p) continue;
    k.rwQ = g(dq, p); k.rwRM = g(drm, p); k.rw622 = g(d622, p); k.rw627 = g(d627, p); k.rwTot = g(dt, p);
    k.closeQ = g(cq, p); k.closeA = g(ca, p); k.layers = g(cl, p);
    const qd = num(k.openQ) + num(k.prodQ) - num(k.cogsQ) - k.rwQ - k.closeQ;
    const ad = num(k.openA) + num(k.prodA) - num(k.cogsA) - k.rwTot - k.closeA;
    k.rollStatus = Math.abs(qd) <= TOL_QTY && Math.abs(ad) <= TOL_AMT ? 'PASS' : 'CHECK';
    RT.q += k.rwQ; RT.rm += k.rwRM; RT.a622 += k.rw622; RT.a627 += k.rw627; RT.tot += k.rwTot;
  }
  res.totals.closeQ = res.summary.reduce((a, k) => a + num(k.closeQ), 0);
  res.totals.closeA = res.summary.reduce((a, k) => a + num(k.closeA), 0);
  res.totals.layers = res.summary.reduce((a, k) => a + num(k.layers), 0);
  Object.assign(res.totals, { rwQ: RT.q, rwRM: RT.rm, rw622: RT.a622, rw627: RT.a627, rwTot: RT.tot });
  // RW_PatchStep5Reconciliation
  const T = res.totals;
  const st = (d, t) => (Math.abs(d) <= t ? 'PASS' : 'CHECK');
  const q8 = T.openQ + T.prodQ - T.cogsQ - RT.q - T.closeQ;
  res.rec[8] = { expected: 0, result: q8, diff: q8, status: st(q8, TOL_QTY), note: 'Opening + Production - Sales COGS - FG Rework - Closing' };
  const a9 = T.openA + T.prodA - T.cogsA - RT.tot - T.closeA;
  res.rec[9] = { expected: 0, result: a9, diff: a9, status: st(a9, TOL_AMT), note: 'Opening + Production - Sales COGS - FG Rework - Closing' };
  const sumOf = (rows, f) => rows.reduce((a, r) => a + num(r[f]), 0);
  const openRows = (opening && opening.rows || []).filter((r) => ttxt(r.lid));
  const prodRows = ledger.filter((l) => l.source === 'PRODUCTION');
  const comp = ['rm', 'a622', 'a627'].map((f, i) => sumOf(openRows, f) + sumOf(prodRows, f) - sumOf(res.sales, ['rm', 'c622', 'c627'][i]) - [RT.rm, RT.a622, RT.a627][i] - sumOf(closing, f));
  const cd = Math.max(...comp.map(Math.abs));
  res.rec[10] = { expected: 0, result: cd, diff: cd, status: cd <= TOL_AMT ? 'PASS' : 'CHECK', note: 'Max abs component diff after subtracting Rework RM / 622 / 627' };
  // Batch 8
  const regRows = register.rows;
  const srcQty = sumOf(regRows, 'issueQty'), erpRef = sumOf(regRows, 'erpRef');
  const completed = sumOf(regRows, 'carryIn'), openWIP = sumOf(regRows, 'closingWIP');
  const bfCost = regRows.filter((r) => r.active === 'B/F').reduce((a, r) => a + num(r.bfCost), 0);
  const conflicts = chronologyConflicts(register, salesRows, period);
  const b8 = [
    { label: 'FG Rework source qty', expected: srcQty, result: RT.q, diff: RT.q - srcQty, status: st(RT.q - srcQty, TOL_QTY) },
    { label: 'FG Rework FIFO cost', expected: RT.tot, result: RT.rm + RT.a622 + RT.a627, diff: RT.rm + RT.a622 + RT.a627 - RT.tot, status: st(RT.rm + RT.a622 + RT.a627 - RT.tot, TOL_AMT) },
    { label: 'Completed Rework carry-in', expected: completed, result: num(step4Carry), diff: num(step4Carry) - completed, status: st(num(step4Carry) - completed, TOL_AMT), note: 'Completed NORMAL Rework FIFO cost posted to target Rework PC' },
    { label: 'Closing Rework WIP', expected: bfCost + RT.tot - completed, result: openWIP, diff: openWIP - (bfCost + RT.tot - completed), status: st(openWIP - (bfCost + RT.tot - completed), TOL_AMT), note: 'B/F Rework WIP + FIFO transfer - Completed carry-in = Closing Rework WIP (outside FG Closing)' },
    { label: 'ERP Stock Out reference amount', expected: erpRef, result: RT.tot, diff: RT.tot - erpRef, status: 'INFO', note: 'Informational difference only. FIFO cost is used for inventory valuation.' },
    { label: 'Chronology safety', expected: 0, result: plan ? 0 : conflicts, diff: plan ? 0 : conflicts, status: plan || conflicts === 0 ? 'PASS' : 'BLOCK', note: plan ? `STRICT_DATE: ${conflicts} same-product sales on/after an issue date handled in date order` : '' },
    ...(plan ? [] : [{ label: 'Rework layers dated after issue date', expected: 0, result: lateLayers, diff: lateLayers, status: lateLayers ? 'REVIEW' : 'PASS', note: 'MONTHLY takes the oldest layer left after sales; use STRICT_DATE for issue-date FIFO' }]),
  ];
  const gate8 = b8.some((r) => r.status === 'CHECK' || r.status === 'BLOCK') ? 'CHECK' : 'PASS';
  const fifoQty = sumOf(rwf, 'qty'), fifoCost = sumOf(rwf, 'tot');
  const rollDiff = bfCost + fifoCost - completed - openWIP;
  const fgRows = activeReworkCount(register);
  const control = [
    { label: 'FG Source Rows', value: fgRows, note: '', status: fgRows > 0 ? 'INFO' : 'PASS' },
    { label: 'FG Source Qty', value: srcQty, note: '', status: Math.abs(srcQty - fifoQty) <= TOL_QTY ? 'PASS' : 'CHECK' },
    { label: 'ERP Stock Out Amount Ref', value: erpRef, note: 'Memo only - not valuation basis', status: 'INFO' },
    { label: 'FIFO Transfer Qty', value: fifoQty, note: '', status: Math.abs(srcQty - fifoQty) <= TOL_QTY ? 'PASS' : 'CHECK' },
    { label: 'FIFO Transfer Cost', value: fifoCost, note: 'Authoritative FG carrying cost', status: fifoCost > 0 || srcQty === 0 ? 'PASS' : 'CHECK' },
    { label: 'Closing Rework WIP', value: openWIP, note: 'Remains outside FG Closing', status: 'INFO' },
    { label: 'Completed Carry-In', value: completed, note: 'Mapped to completed NORMAL Rework PC', status: 'INFO' },
    { label: 'Chronology Conflicts', value: conflicts, note: plan ? 'STRICT_DATE – handled in date order' : 'Must be zero in MONTHLY mode', status: plan || conflicts === 0 ? 'PASS' : 'BLOCK' },
    { label: 'Opening Rework WIP (B/F)', value: bfCost, note: 'From the previous closed period', status: 'INFO' },
    { label: 'Rework WIP Roll-forward Diff', value: rollDiff, note: 'B/F + FIFO Transfer - Completed - Closing = 0', status: Math.abs(rollDiff) <= TOL_AMT ? 'PASS' : 'CHECK' },
  ];
  res.rework = { rows: rwf, batch8: b8, gate8, control, runAt: now, srcQty, fifoQty, fifoCost, completed, openWIP, bfCost, erpRef, conflicts: plan ? 0 : conflicts, rawConflicts: conflicts, lateLayers, mode: plan ? 'STRICT_DATE' : 'MONTHLY' };
  return res;
}

/** Carry-in per Rework PC|Output FG from the register (what Step 4 picks up). */
export function carryTotal(register) {
  let t = 0;
  for (const r of (register && register.rows) || []) {
    if (utxt(r.rwType) === 'NORMAL' && utxt(r.rwStatus) === 'COMPLETED' && ttxt(r.pcNo)) {
      const fs = utxt(r.fifoStatus);
      if (fs === 'PASS' || (fs === 'OPENING B/F' && utxt(r.inputCheck) === 'PASS')) t += num(r.carryIn);
    }
  }
  return t;
}

/** Strip internals before persisting. */
export function finalizeRun(res) { delete res._sorted; delete res._rwPlan; return res; }

// ---------------------------------------------------------------- 05_FG_ROLLFORWARD
export function buildRollforward(res, opening, prevItems) {
  const idx = new Map(); const items = [];
  const addItem = (code, name, unit) => {
    code = ttxt(code).toUpperCase(); if (!code) return;
    if (idx.has(code)) { const k = items[idx.get(code)]; if (!k.name) k.name = name; if (!k.unit) k.unit = unit; return; }
    idx.set(code, items.length); items.push({ code, name, unit });
  };
  for (const it of prevItems || []) addItem(it.code, ttxt(it.name), ttxt(it.unit));
  for (const r of (opening && opening.rows) || []) addItem(r.prod, ttxt(r.name), ttxt(r.unit));
  for (const l of res.ledger) addItem(l.prod, ttxt(l.name), ttxt(l.unit));
  for (const s of res.sales) if (s.fin === 'FIFO COGS') addItem(s.prod, ttxt(s.name), '');
  const S = (rows, f, pred) => { const m = new Map(); for (const r of rows) if (pred(r)) { const k = ttxt(r.prod).toUpperCase(); m.set(k, (m.get(k) || 0) + num(r[f])); } return m; };
  const oq = S(res.ledger, 'qtyIn', (l) => l.source === 'OPENING'), oa = S(res.ledger, 'tot', (l) => l.source === 'OPENING');
  const iq = S(res.ledger, 'qtyIn', (l) => l.source === 'PRODUCTION'), ia = S(res.ledger, 'tot', (l) => l.source === 'PRODUCTION');
  const sq = S(res.sales, 'fq', (s) => s.fin === 'FIFO COGS' || s.fin === 'RETURN'), sa = S(res.sales, 'tot', (s) => s.fin === 'FIFO COGS' || s.fin === 'RETURN');
  const rq = S(res.ledger, 'remQ', () => true), ra = S(res.ledger, 'remTot', () => true);
  const g = (m, k) => m.get(k) || 0;
  const rows = items.map((it) => {
    const k = it.code;
    const r = { code: it.code, name: it.name, unit: it.unit, openQ: g(oq, k), openA: g(oa, k), inQ: g(iq, k), inA: g(ia, k), outQ: g(sq, k), outA: g(sa, k) };
    r.balQ = r.openQ + r.inQ - r.outQ; r.balA = r.openA + r.inA - r.outA; r.chkQ = r.balQ - g(rq, k); r.chkA = r.balA - g(ra, k);
    return r;
  });
  const tot = Object.fromEntries(['openQ', 'openA', 'inQ', 'inA', 'outQ', 'outA', 'balQ', 'balA', 'chkQ', 'chkA'].map((f) => [f, rows.reduce((a, r) => a + r[f], 0)]));
  return { items: items.map(({ code, name, unit }) => ({ code, name, unit })), rows, total: tot };
}

// ---------------------------------------------------------------- FG HISTORY
export function buildHistory(res, prevRows, ctx) {
  const { period, opening, caRows } = ctx;
  const led = new Map(); for (const l of res.ledger) if (ttxt(l.lid)) led.set(ttxt(l.lid).toUpperCase(), l);
  const op = new Map(); for (const r of (opening && opening.rows) || []) if (ttxt(r.lid)) op.set(ttxt(r.lid).toUpperCase(), r);
  const ca = new Map(); for (const r of caRows || []) if (ttxt(r.pc)) ca.set(ttxt(r.pc).toUpperCase(), r);
  const keep = [];
  for (const h of prevRows || []) {
    const s = utxt(h.hStatus), ap = ttxt(h.archive);
    if (s === 'HISTORICAL SOLD') keep.push({ ...h });
    else if (s === 'CURRENT COGS' && ap && ap !== period) keep.push({ ...h, hStatus: 'HISTORICAL SOLD', archive: '<=' + ap });
  }
  const costMonth = +period.replace('-', '');
  const out = []; let nCOGS = 0, nClose = 0;
  for (const d of res.detail) {
    const lid = ttxt(d.lid), qty = num(d.qty);
    if (!lid || qty === 0) continue;
    nCOGS++;
    const h = Object.fromEntries(HIST_FIELDS.map((f) => [f, null]));
    Object.assign(h, { pc: ttxt(d.pc), date: d.date, prod: ttxt(d.prod), qty, rmSrc: num(d.rm), rmST: 0, tot: num(d.tot), rm: num(d.rm), a622: num(d.a622), a627: num(d.a627), costMonth, provUSD: 0, pl7: 0, provVND: 0, net: num(d.tot), hStatus: 'CURRENT COGS', archive: period, lid, source: ttxt(d.source) });
    const l = led.get(lid.toUpperCase());
    if (l) { h.mo = ttxt(l.mo); h.name = ttxt(l.name); h.unit = ttxt(l.unit); h.srcPeriod = ttxt(l.srcPeriod); }
    let price = 0, prov = 0, cons = 0;
    const o = op.get(lid.toUpperCase());
    if (o) { h.loc = ttxt(o.loc); price = num(o.price); prov = num(o.prov); cons = num(o.cons); }
    else {
      const c = ca.get(ttxt(d.pc).toUpperCase());
      if (c) { if (!ttxt(h.name)) h.name = ttxt(c.name); h.loc = ttxt(c.loc); if (!ttxt(h.unit)) h.unit = ttxt(c.unit); price = num(c.price); }
    }
    h.price = price; h.provVND = prov; h.net = num(d.tot) - prov; h.cons = cons;
    out.push(h);
  }
  // Sales Return is a negative COGS history event. Without this reversal, FG History would not reconcile to net 632.
  for (const s of res.sales || []) {
    if (s.fin !== 'RETURN' || s.status !== 'RETURNED' || !(num(s.fq) < -TOL_QTY)) continue;
    nCOGS++;
    const lid = ttxt(s.returnLid) || `RET-${period.replace('-', '')}-${ttxt(s.inv) || s.seq}`;
    out.push({ pc: ttxt(s.origInv || ''), date: s.date, mo: '', prod: ttxt(s.prod), name: ttxt(s.name), loc: '', unit: '', qty: num(s.fq), rmSrc: num(s.rm), rmST: 0, tot: num(s.tot), rm: num(s.rm), a622: num(s.c622), a627: num(s.c627), price: 0, costMonth, provUSD: 0, pl7: 0, srcPeriod: period, provVND: 0, net: num(s.tot), cons: 0, hStatus: 'CURRENT COGS', archive: period, lid, source: 'SALES RETURN REVERSAL' });
  }
  for (const c of res.closing) {
    if (!ttxt(c.lid)) continue;
    nClose++;
    const tot = num(c.tot), prov = num(c.prov), cons = num(c.cons);
    out.push({ pc: c.pc, date: c.date, mo: c.mo, prod: c.prod, name: c.name, loc: c.loc, unit: c.unit, qty: c.qty, rmSrc: c.rm, rmST: 0, tot, rm: c.rm, a622: c.a622, a627: c.a627, price: c.price, costMonth: null, provUSD: 0, pl7: 0, srcPeriod: c.srcPeriod, provVND: prov, net: tot - prov, cons, hStatus: 'CLOSING FG', archive: period, lid: c.lid, source: c.source });
  }
  const rows = [...out, ...keep];
  if (!rows.length) throw new Error('Không có dòng FG History để tạo.');
  return { through: period, builtAt: nowISO(), rows, nKeep: keep.length, nCOGS, nClose };
}

/** 05_FG_HISTORY AA2:AH9 archive control. */
export function historyGate(hist, res, period) {
  if (!hist) return { gate: 'NOT RUN', rows: [] };
  const cur = (s) => hist.rows.filter((h) => h.hStatus === s && h.archive === period);
  const sum = (rows, f) => rows.reduce((a, r) => a + num(r[f]), 0);
  const cogs = cur('CURRENT COGS'), cl = cur('CLOSING FG');
  const T = res ? res.totals : {};
  const retHistN = res ? (res.sales || []).filter((s) => s.fin === 'RETURN' && s.status === 'RETURNED' && num(s.fq) < -TOL_QTY).length : 0;
  const exp8 = res ? res.detail.filter((d) => ttxt(d.lid)).length + retHistN + res.closing.length : 0;
  const rows = [
    { label: 'History COGS Qty', hist: sum(cogs, 'qty'), step5: num(T.cogsQ) },
    { label: 'History COGS Amount', hist: sum(cogs, 'tot'), step5: num(T.cogsA) },
    { label: 'History Closing Qty', hist: sum(cl, 'qty'), step5: num(T.closeQ) },
    { label: 'History Closing Amount', hist: sum(cl, 'tot'), step5: num(T.closeA) },
    { label: 'Current Archive Rows', hist: cogs.length + cl.length, step5: exp8 },
  ].map((r) => ({ ...r, diff: r.hist - r.step5 }));
  const tols = [TOL_QTY, 1, TOL_QTY, 1, TOL_QTY];
  const gate = hist.through !== period ? 'OUTDATED' : rows.every((r, i) => Math.abs(r.diff) <= tols[i]) ? 'PASS' : 'REVIEW';
  return { gate, rows, prior: hist.rows.filter((h) => h.hStatus === 'HISTORICAL SOLD').length, curCOGS: cogs.length, curClose: cl.length };
}

// ---------------------------------------------------------------- 05_RECONCILIATION rows 17..60 + month close
/**
 * x = { period, res, freshness ('CURRENT' | 'OUTDATED' | 'NOT RUN'), hist, histGate, gl, fl (Step 4 final), s4, gate6 }
 */
export function step5Recon(x) {
  const { period, res } = x;
  const R = {};
  if (!res) return { rows: R, e17: 'NOT RUN', e18: 'NOT RUN', closeGate: 'BLOCK', finalStatus: 'NOT READY', batch7: 'CHECK' };
  const L4 = res.tol || 1;
  const c17 = x.freshness;
  const e17 = c17 === 'CURRENT' ? 'PASS' : c17 === 'NOT RUN' ? 'NOT RUN' : 'OUTDATED - RERUN STEP 5';
  // YTD 622 / 627 vs GL (review only)
  const y = +period.slice(0, 4);
  const yStart = (Date.UTC(y, 0, 1) - Date.UTC(1899, 11, 30)) / 86400000; const { end } = periodBounds(period);
  const histRows = x.hist ? x.hist.rows : [];
  const inY = (h) => { const d = num(h.date); return d >= yStart && d <= end; };
  const c20 = histRows.filter(inY).reduce((a, h) => a + num(h.a622), 0), c21 = histRows.filter(inY).reduce((a, h) => a + num(h.a627), 0);
  const through = x.hist ? x.hist.through : '';
  const b20 = x.gl && x.gl.ytd622 !== null && x.gl.ytd622 !== undefined && x.gl.ytd622 !== '' ? num(x.gl.ytd622) : '';
  const b21 = x.gl && x.gl.ytd627 !== null && x.gl.ytd627 !== undefined && x.gl.ytd627 !== '' ? num(x.gl.ytd627) : '';
  const ytdSt = (b, c) => (through !== period ? 'REVIEW - HISTORY OUTDATED' : b === '' ? 'REVIEW - INPUT YTD GL' : Math.abs(c - b) <= L4 ? 'PASS' : 'REVIEW');
  R[20] = { label: 'YTD 622 production history vs GL', expected: b20, result: c20, diff: b20 === '' ? '' : c20 - b20, status: ytdSt(b20, c20), note: 'Lũy kế 622 theo FG History vs GL lũy kế (FAST)' };
  R[21] = { label: 'YTD 627 production history vs GL', expected: b21, result: c21, diff: b21 === '' ? '' : c21 - b21, status: ytdSt(b21, c21), note: 'Lũy kế 627 theo FG History vs GL lũy kế (FAST)' };
  const c22 = b20 === '' || b21 === '' ? 'INPUT REQUIRED' : Math.max(Math.abs(c20 - b20), Math.abs(c21 - b21));
  R[22] = { label: 'YTD 622/627 vs GL overall', expected: 0, result: c22, diff: '', status: through !== period ? 'REVIEW' : c22 === 'INPUT REQUIRED' ? 'REVIEW' : c22 <= L4 ? 'PASS' : 'REVIEW', note: 'Chỉ review. Nhập 622/627 lũy kế năm ở màn hình 4.2.' };
  // reporting adjustments (not used on the web): all zero → PASS
  for (const [r, l] of [[24, 'COGS adjustment validation errors'], [25, 'Adjusted reporting COGS'], [26, 'COGS adjustment allocation'], [27, 'Adjustment component allocation'], [28, 'Company net reporting adjustment']]) R[r] = { label: l, expected: r === 25 ? res.totals.cogsA : 0, result: 0, diff: 0, status: 'PASS', note: 'Không có điều chỉnh COGS báo cáo' };
  const rowsRec = res.rec;
  const E = (r) => (rowsRec[r] ? rowsRec[r].status : R[r] ? R[r].status : '');
  const I12 = res.runResult;
  const e18 = e17 !== 'PASS' ? e17 : !I12 ? 'NOT RUN' : (I12 === 'PASS WITH REVIEW' || E(22).startsWith('REVIEW') || [24, 26, 27, 28].some((r) => R[r].status === 'REVIEW') || R[25].status === 'REVIEW') ? 'PASS WITH REVIEW' : I12;
  // history / roll-forward controls
  const hg = x.histGate || { gate: 'NOT RUN', rows: [] };
  const hv = (i) => (hg.rows[i] ? hg.rows[i].hist : 0);
  const T = res.totals;
  R[31] = { label: 'FG History period', expected: period, result: through, diff: through === period ? 0 : 1, status: through === period ? 'PASS' : 'REVIEW', note: 'History Through phải bằng kỳ báo cáo' };
  R[32] = { label: 'FG History COGS qty', expected: T.cogsQ, result: hv(0), diff: hv(0) - T.cogsQ, status: Math.abs(hv(0) - T.cogsQ) <= 0.000001 ? 'PASS' : 'REVIEW', note: '' };
  R[33] = { label: 'FG History COGS amount', expected: T.cogsA, result: hv(1), diff: hv(1) - T.cogsA, status: Math.abs(hv(1) - T.cogsA) <= L4 ? 'PASS' : 'REVIEW', note: '' };
  R[34] = { label: 'FG History closing qty', expected: T.closeQ, result: hv(2), diff: hv(2) - T.closeQ, status: Math.abs(hv(2) - T.closeQ) <= 0.000001 ? 'PASS' : 'REVIEW', note: '' };
  R[35] = { label: 'FG History closing amount', expected: T.closeA, result: hv(3), diff: hv(3) - T.closeA, status: Math.abs(hv(3) - T.closeA) <= L4 ? 'PASS' : 'REVIEW', note: '' };
  const exp36 = res.detail.filter((d) => ttxt(d.lid)).length + res.closing.length;
  R[36] = { label: 'FG History current layer count', expected: exp36, result: hv(4), diff: hv(4) - exp36, status: hv(4) === exp36 ? 'PASS' : 'REVIEW', note: '' };
  R[37] = { label: 'Roll-forward source period', expected: period, result: res.period, diff: res.period === period ? 0 : 1, status: res.period === period ? 'PASS' : 'REVIEW', note: '05_FG_CLOSING phải là kỳ hiện tại' };
  // Batch 7
  const fl = x.fl; const prod = res.ledger.filter((l) => l.source === 'PRODUCTION');
  const sp = (f) => prod.reduce((a, l) => a + num(l[f]), 0);
  const caN = fl ? fl.rows.reduce((a, r) => a + num(r.baseRM), 0) : 0, caAC = fl ? fl.rows.reduce((a, r) => a + num(r.baseCost), 0) : 0;
  const b7 = [
    [53, 'W6 integration gate', 'PASS', x.gate6 || '', null, x.gate6 === 'PASS' ? 'PASS' : 'CHECK'],
    [54, 'Production layers vs Final Production Cost', fl ? fl.totals.totalCost : 0, sp('tot')],
    [55, 'Production RM vs Final RM', fl ? fl.totals.totalRM : 0, sp('rm')],
    [56, 'Production 622 unchanged', x.s4 ? x.s4.alloc622 : 0, sp('a622')],
    [57, 'Production 627 unchanged', x.s4 ? x.s4.alloc627 : 0, sp('a627')],
    [58, 'RM uplift = approved PC WIP adjustment', fl ? fl.totals.wipAdj : 0, sp('rm') - caN],
    [59, 'Production cost uplift = approved PC WIP adjustment', fl ? fl.totals.wipAdj : 0, sp('tot') - caAC],
  ];
  for (const [r, label, b, c, , fixed] of b7) {
    const d = typeof b === 'number' && typeof c === 'number' ? c - b : (c === b ? 0 : 1);
    R[r] = { label, expected: b, result: c, diff: d, status: fixed || (Math.abs(d) <= L4 ? 'PASS' : 'CHECK'), note: '' };
  }
  const batch7 = [53, 54, 55, 56, 57, 58, 59].every((r) => R[r].status === 'PASS') ? 'PASS' : 'CHECK';
  // Batch 8 (only when rework rows exist)
  const g8 = res.rework ? res.rework.gate8 : 'PASS';
  // month close gate (E38)
  const blockRows = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const isP = (s) => s === 'PASS';
  const closeBlock = batch7 !== 'PASS' || e17 !== 'PASS' || !blockRows.every((r) => isP(E(r))) || ![24, 26, 27, 31, 32, 33, 34, 35, 36, 37].every((r) => isP(R[r].status));
  const reviewOnly = E(16) === 'REVIEW' || R[20].status.startsWith('REVIEW') || R[21].status.startsWith('REVIEW') || R[22].status === 'REVIEW' || R[28].status === 'REVIEW';
  const closeGate = closeBlock ? 'BLOCK' : reviewOnly ? 'READY WITH REVIEW' : 'READY TO CLOSE';
  // final production readiness (E49)
  R[43] = { label: 'Core STEP 5 result', expected: 'PASS / PASS WITH REVIEW', result: e18, diff: e18.startsWith('PASS') ? 0 : 1, status: e18.startsWith('PASS') ? 'PASS' : 'BLOCK', note: '' };
  R[44] = { label: 'STEP 5 output freshness', expected: 'CURRENT', result: c17, diff: c17 === 'CURRENT' ? 0 : 1, status: c17 === 'CURRENT' ? 'PASS' : 'BLOCK', note: '' };
  R[45] = { label: 'Reporting adjustment controls', expected: 'PASS', result: 'PASS', diff: 0, status: 'PASS', note: '' };
  R[46] = { label: 'FG History archive', expected: 'PASS', result: hg.gate, diff: hg.gate === 'PASS' ? 0 : 1, status: hg.gate === 'PASS' ? 'PASS' : 'BLOCK', note: '' };
  R[47] = { label: 'Month Close Gate', expected: 'READY', result: closeGate, diff: closeGate.startsWith('READY') ? 0 : 1, status: closeGate.startsWith('READY') ? 'PASS' : 'BLOCK', note: '' };
  const c48 = reviewOnly || e18 === 'PASS WITH REVIEW' || closeGate === 'READY WITH REVIEW' ? 'REVIEW' : 'CLEAR';
  R[48] = { label: 'Review-only flags', expected: 'CLEAR / REVIEW', result: c48, diff: 0, status: c48 === 'REVIEW' ? 'REVIEW' : 'PASS', note: '' };
  const finalStatus = batch7 !== 'PASS' || [43, 44, 45, 46, 47].some((r) => R[r].status !== 'PASS') ? 'NOT READY' : c48 === 'REVIEW' ? 'READY WITH REVIEW' : 'READY FOR PRODUCTION';
  return { rows: R, e17, c17, e18, closeGate, finalStatus, batch7, gate8: g8 };
}

/** STEP5_Close_Month_B333 + Batch 8 gate of the 5B wrapper. Returns '' when the period may be closed. */
export function closeBlockReason(x) {
  const { recon, histGate, res, register, closed } = x;
  if (closed && closed.period === x.period) return `Kỳ ${x.period} đã đóng lúc ${closed.closedAt} bởi ${closed.closedBy}.`;
  if (!res) return 'Chưa chạy STEP 5.';
  if (reworkCount(register) > 0 && (!res.rework || res.rework.gate8 !== 'PASS')) return `FG Rework Batch 8 = ${res.rework ? res.rework.gate8 : 'NOT RUN'}. Mọi kiểm soát Rework FIFO phải PASS.`;
  if (recon.c17 !== 'CURRENT') return 'Kết quả STEP 5 đã cũ (OUTDATED). Chạy lại RUN FIFO COGS.';
  if (recon.batch7 !== 'PASS') return `Batch 7 (giá thành STEP 5) = ${recon.batch7}.`;
  if (!histGate || histGate.gate !== 'PASS') return `FG History = ${histGate ? histGate.gate : 'NOT RUN'}. Chạy BUILD FG HISTORY trước.`;
  if (!recon.closeGate.startsWith('READY')) return `Month Close Gate = ${recon.closeGate}.`;
  if (!recon.finalStatus.startsWith('READY')) return `Final Production Status = ${recon.finalStatus}.`;
  return '';
}

/** Rows archived to 05_REWORK_WIP_HISTORY at close (seed of next period B/F). */
export function archiveReworkWIP(register, period) {
  const out = [];
  for (const r of (register && register.rows) || []) {
    const tag = utxt(r.active), cost = num(r.closingWIP);
    if ((tag === 'Y' || tag === 'B/F') && cost > TOL_AMT) out.push({ archive: period, originPeriod: tag === 'B/F' ? r.originPeriod : period, rid: r.rid, erp: r.erp, doc: r.doc, srcRow: r.srcRow, issueDate: r.issueDate, fg: r.fg, fgName: r.fgName, itemType: r.itemType, loc: r.loc, uom: r.uom, bfQty: tag === 'B/F' ? num(r.bfQty) : num(r.fifoQty), carryCost: cost, reason: r.reason, jobKey: r.jobKey, rwType: r.rwType, rwStatus: r.rwStatus, pcNo: r.pcNo, outFG: r.outFG, compDate: r.compDate, compQty: r.compQty, scrapQty: r.scrapQty, note: r.note });
  }
  return out;
}

// ---------------------------------------------------------------- FAST general-ledger tie (owner decision 02/10/2026)
/** Recognition date of a sales row: Bill (B/L) date when present, else invoice date. */
export const saleDate = (r) => { const b = dateVal(r.billDate); return b !== null ? b : dateVal(r.invDate); };
export const FAST_ACCOUNTS = [
  ['a154', '154', 'WIP cuối kỳ (vật tư sau 3B + rework WIP)'],
  ['a155', '155', 'Thành phẩm cuối kỳ'],
  ['a632', '632', 'Giá vốn trong kỳ (FIFO + 3B DIRECT_632)'],
  ['a511', '511', 'Doanh thu trong kỳ (Sales Database)'],
];
/** Revenue VND of the period by recognition date (all transaction types, returns negative). */
export function periodRevenue(salesRows, period) {
  const { start, end } = periodBounds(period); let s = 0;
  for (const r of salesRows || []) { const d = saleDate(r); if (d !== null && d >= start && d <= end) s += num(r.amtVND); }
  return s;
}
/**
 * Engine balances vs FAST balances. A difference (> 1 VND) needs an approval with a note; the approval is bound to the
 * exact engine + FAST figures (key), so it lapses as soon as either side changes.
 */
export function fastTie(engine, tie) {
  const rows = FAST_ACCOUNTS.map(([k, acc, label]) => {
    const e = num(engine[k]); const f = tie && tie.fast && tie.fast[k] !== undefined && tie.fast[k] !== null && tie.fast[k] !== '' ? num(tie.fast[k]) : null;
    const diff = f === null ? null : e - f;
    return { k, acc, label, engine: e, fast: f, diff, status: f === null ? 'NOT ENTERED' : Math.abs(diff) <= 1 ? 'PASS' : 'DIFF' };
  });
  const key = fp(rows.map((r) => `${r.k}|${Math.round(r.engine)}|${r.fast === null ? '' : Math.round(r.fast)}`).join(';'));
  const entered = rows.every((r) => r.fast !== null);
  const diffs = rows.filter((r) => r.status === 'DIFF').length;
  const approved = !!(tie && tie.approval && tie.approval.key === key);
  const status = !entered ? 'NOT ENTERED' : !diffs ? 'PASS' : approved ? 'APPROVED' : 'REVIEW';
  return { rows, key, entered, diffs, approved, status, approval: tie && tie.approval ? tie.approval : null };
}
