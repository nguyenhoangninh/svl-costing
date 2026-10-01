// STEP 2 — Stock Out allocation to PC-P lots + 2B FG Rework register
// Port of STEP2_Allocate_Stock_Out, STEP2_FGREWORK_Allocate_Stock_Out_v1_1 (FG exclusion),
// RW_BuildInput, RW_CollectFGSource, RW_InputCheck, RW_UpdateStep2Control.
import { txt, ttxt, utxt, num, headerCol, headerColAny, lastDataEnd, dateInPeriod, nowISO } from './util.js';

export const TOL_QTY = 0.000001;
export const TOL_AMT = 1;

// Column layout of the STOCK OUT reports used by the FG / rework logic.
// Header names first; the fixed VBA column numbers are the fallback.
const SO_LAYOUT = {
  T: { qty: ['Quantity', 13], amt: ['Total Cost', 14], loc: ['Location', 11], uom: ['Unit', 12], reason: ['Customer', 15], key: ['MO No.', 16] },
  S: { qty: ['Quantity', 11], amt: ['Total Cost', 15], loc: ['Location', 13], uom: ['Unit', 12], reason: ['Remark', 16], key: ['JOB CODE', 20] },
  O: { qty: ['Base Qty', 13], amt: ['Total Cost', 15], loc: ['Location', 11], uom: ['Base Unit', 12], reason: ['DIVISION', 17], key: ['JOB CODE', 18] },
};
function col(header, spec) {
  const c = headerCol(header, spec[0]);
  return c >= 0 ? c : spec[1] - 1;
}
function soCols(ds, erp) {
  const h = ds.header, L = SO_LAYOUT[erp];
  const fix = (name, n) => { const c = headerCol(h, name); return c >= 0 ? c : n - 1; };
  return {
    doc: fix('Code', 1), date: fix('Date', 5), line: fix('#', 7), item: fix('Item Code', 8),
    name: headerColAny(h, ['Item Name(English)', 'Item Name (English)', 'Item Name']) >= 0 ? headerColAny(h, ['Item Name(English)', 'Item Name (English)', 'Item Name']) : 8,
    type: fix('Item Type', 10), qty: col(h, L.qty), amt: col(h, L.amt), loc: col(h, L.loc), uom: col(h, L.uom), reason: col(h, L.reason), key: col(h, L.key),
  };
}

export function isFG(itemType) {
  const t = utxt(itemType);
  return t === 'FG' || t === 'FINISHED_GOOD' || t === 'FINISHED GOOD';
}

/** Rows (index into ds.rows) of FG / FINISHED_GOOD Stock Out dated in the period → excluded from RM. */
export function fgMask(datasets, period) {
  const mask = {};
  for (const erp of ['T', 'S', 'O']) {
    const ds = datasets[`STOCK OUT-${erp}`];
    const set = new Set();
    if (ds) {
      const c = soCols(ds, erp);
      ds.rows.forEach((r, i) => { if (isFG(r[c.type]) && dateInPeriod(r[c.date], period)) set.add(i); });
      mask[erp] = { set, qty: c.qty, amt: c.amt };
    } else mask[erp] = { set, qty: -1, amt: -1 };
  }
  return mask;
}

/** Value of a Stock Out cell with FG rows zeroed (what the VBA engine sees during STEP 2 / 3). */
export function soCell(mask, erp, i, c, v) {
  const m = mask[erp];
  if (m && m.set.has(i) && (c === m.qty || c === m.amt)) return 0;
  return v;
}

function loadPCPool(ds, erp, pool) {
  const h = ds.header;
  const cPC = headerCol(h, 'PC No.'), cMO = headerCol(h, 'MO No.'), cProd = headerCol(h, 'Product Code');
  const cName = headerCol(h, 'Product Name'), cLoc = headerCol(h, 'Location');
  const cQty = headerCol(h, 'Current Complete Qty'), cCost = headerCol(h, 'Total Cost');
  if (cPC < 0 || cProd < 0 || cCost < 0) throw new Error(`Required PC-P headers not found in PC-P-${erp}`);
  const end = lastDataEnd(ds.rows, cPC);
  for (let i = 0; i < end; i++) {
    const r = ds.rows[i];
    if (ttxt(r[cPC]).length === 0) continue;
    pool.push({
      erp, rowIdx: i, pcNo: txt(r[cPC]), mo: cMO >= 0 ? txt(r[cMO]) : '', prod: txt(r[cProd]),
      name: cName >= 0 ? txt(r[cName]) : '', loc: cLoc >= 0 ? txt(r[cLoc]) : '',
      qty: cQty >= 0 ? num(r[cQty]) : 0, cost: num(r[cCost]),
      allocT: 0, allocS: 0, allocO: 0, alloc: 0, src: '',
    });
  }
}

function sFamily(loc) {
  const l = utxt(loc).slice(0, 2);
  if (l === 'DS' || l === 'DN') return 'DOONA';
  if (l === 'VE') return 'VETO';
  if (l === 'MK') return 'MK';
  return 'UNMATCHED';
}

function matches(targetERP, field, key, p) {
  const uKey = key.trim().toUpperCase(), uProd = p.prod.trim().toUpperCase(), uLoc = p.loc.trim().toUpperCase();
  if (targetERP === 'T+O') { if (p.erp !== 'T' && p.erp !== 'O') return false; }
  else if (p.erp !== targetERP) return false;
  switch (field) {
    case 'PRODUCT PREFIX': return uProd.slice(0, uKey.length) === uKey;
    case 'PRODUCT NOT PREFIX': return uProd.slice(0, uKey.length) !== uKey;
    case 'LOCATION EXACT': return uLoc === uKey;
    case 'LOCATION PREFIX': return uLoc.slice(0, uKey.length) === uKey;
    case 'ALL': case 'ALL T': case 'ALL O': return true;
    default: return false;
  }
}

export const STEP2_RULES = [
  [1, 'T', 'Customer = DOONA', 'T', 'PC-P-T Product Code SP*', 'Total Cost', '', 'Allocate'],
  [2, 'T', 'Customer = COMMON', 'T', 'All PC-P-T', 'Total Cost', '', 'Allocate'],
  [3, 'O', 'JOB CODE exact match', 'O', 'PC-P-O Location exact', 'Total Cost', '', 'Allocate'],
  [4, 'O', 'No exact: MK / VE / Other', 'O', 'MK* / VE* / ALL O', 'Total Cost', '', 'Fallback by rule'],
  [5, 'S', 'DS*/DN* | VE* | MK*', 'T / O', 'T SP* | O VE* | O MK*', 'Total Cost', '', 'Allocate'],
  [6, 'S', 'Other / Blank', 'T + O', 'All PC-P', 'Equal', '', 'Fallback Equal'],
];

export const STEP2_DETAIL_HEADERS = ['Source ERP', 'Source Key', 'Source Key Type', 'Source Rows', 'Source Stock Out', 'Family', 'Target ERP', 'Target Match', 'PC No.', 'MO No.', 'Product Code', 'Product Name', 'PC Location', 'PC RM Cost', 'Allocation %', 'Allocated Stock Out', 'Status', 'Note'];

/** Main STEP 2 engine (RM / non-FG Stock Out only). */
export function runStep2(datasets, period) {
  for (const erp of ['O', 'T']) if (!datasets[`PC-P-${erp}`]) throw new Error(`Thiếu PC-P-${erp}. Hãy import dữ liệu ERP trước.`);
  for (const erp of ['O', 'T', 'S']) if (!datasets[`STOCK OUT-${erp}`]) throw new Error(`Thiếu STOCK OUT-${erp}. Hãy import dữ liệu ERP trước.`);
  const mask = fgMask(datasets, period);
  const pool = [];
  for (const erp of ['O', 'T']) loadPCPool(datasets[`PC-P-${erp}`], erp, pool);

  // ---- group Stock Out ----
  const groups = []; const gIndex = new Map();
  const add = (erp, key, type, fam, amt) => {
    const k = `${erp}\u0001${key}\u0001${type}\u0001${fam}`;
    let g = gIndex.get(k);
    if (!g) { g = { erp, key, type, fam, cost: 0, rows: 0 }; gIndex.set(k, g); groups.push(g); }
    g.cost += amt; g.rows += 1;
  };
  for (const erp of ['O', 'T', 'S']) {
    const ds = datasets[`STOCK OUT-${erp}`]; const h = ds.header;
    const cCode = headerCol(h, 'Code'), cCost = headerCol(h, 'Total Cost');
    if (cCode < 0 || cCost < 0) throw new Error(`Required Stock Out headers not found in STOCK OUT-${erp}`);
    const end = lastDataEnd(ds.rows, cCode);
    const cKey = erp === 'O' ? headerCol(h, 'JOB CODE') : erp === 'T' ? headerCol(h, 'Customer') : headerCol(h, 'Location');
    if (cKey < 0) throw new Error(`${erp === 'O' ? 'JOB CODE' : erp === 'T' ? 'Customer' : 'Location'} header not found in STOCK OUT-${erp}`);
    for (let i = 0; i < end; i++) {
      const r = ds.rows[i];
      if (txt(r[cCode]).length === 0) continue;
      const amt = -num(soCell(mask, erp, i, cCost, r[cCost]));
      const key = utxt(r[cKey]);
      if (erp === 'O') add('O', key, 'JOB CODE', '', amt);
      else if (erp === 'T') add('T', key, 'CUSTOMER', key, amt);
      else add('S', key, 'LOCATION', sFamily(key), amt);
    }
  }

  // ---- allocate ----
  const detail = [];
  const sum = { T: [0, 0, 0], S: [0, 0, 0], O: [0, 0, 0] };
  for (const g of groups) {
    const srcERP = g.erp, srcAmt = g.cost;
    let allocated = 0, unalloc = 0, totalW = 0, cand = 0, forceEqual = false, note = '', status = 'ALLOCATED';
    let targetERP = '', field = '', tKey = '';
    if (Math.abs(srcAmt) < 0.005) {
      detail.push([srcERP, g.key, g.type, g.rows, srcAmt, g.fam, '', '', '', '', '', '', '', 0, 0, 0, 'ZERO COST', 'No cost to allocate.']);
    } else {
      const uk = g.key.toUpperCase();
      if (srcERP === 'T') {
        targetERP = 'T';
        if (uk === 'DOONA') { field = 'PRODUCT PREFIX'; tKey = 'SP'; note = 'DOONA -> T SP*.'; }
        else if (uk === 'COMMON') { field = 'ALL T'; tKey = 'ALL'; note = 'COMMON -> all PC-P-T.'; }
        else { status = 'CHECK CUSTOMER'; note = 'Unknown T Customer.'; }
      } else if (srcERP === 'O') {
        targetERP = 'O';
        const exact = uk.length > 0 && pool.some((p) => p.erp === 'O' && p.loc.trim().toUpperCase() === uk);
        if (exact) { field = 'LOCATION EXACT'; tKey = g.key; note = 'O exact Job Code.'; }
        else if (uk.slice(0, 2) === 'MK' || uk === 'SVL-MK') { field = 'LOCATION PREFIX'; tKey = 'MK'; note = 'O fallback MK*.'; }
        else if (uk.slice(0, 2) === 'VE') { field = 'LOCATION PREFIX'; tKey = 'VE'; note = 'O fallback VE*.'; }
        else { field = 'ALL O'; tKey = 'ALL'; note = 'O fallback ALL.'; }
      } else {
        if (g.fam === 'DOONA') { targetERP = 'T'; field = 'PRODUCT PREFIX'; tKey = 'SP'; note = 'S DS/DN -> T SP*.'; }
        else if (g.fam === 'VETO') { targetERP = 'O'; field = 'LOCATION PREFIX'; tKey = 'VE'; note = 'S VE -> O VE*.'; }
        else if (g.fam === 'MK') { targetERP = 'O'; field = 'LOCATION PREFIX'; tKey = 'MK'; note = 'S MK -> O MK*.'; }
        else { targetERP = 'T+O'; field = 'ALL'; tKey = 'ALL'; forceEqual = true; note = 'S other -> equal T+O.'; }
      }
      if (status === 'ALLOCATED') {
        for (const p of pool) if (matches(targetERP, field, tKey, p)) { cand++; if (forceEqual) totalW += 1; else if (p.cost > 0) totalW += p.cost; }
      }
      if (status !== 'ALLOCATED' || cand === 0 || totalW === 0) {
        unalloc = srcAmt;
        if (status === 'ALLOCATED') {
          if (cand === 0) { status = 'NO ELIGIBLE PC'; note += ' No eligible PC.'; }
          if (cand > 0 && totalW === 0) { status = 'NO TOTAL COST BASIS'; note += ' Total Cost basis = 0.'; }
        }
        detail.push([srcERP, g.key, g.type, g.rows, srcAmt, g.fam, targetERP, tKey, '', '', '', '', '', 0, 0, 0, status, note]);
      } else {
        for (const p of pool) {
          if (!matches(targetERP, field, tKey, p)) continue;
          const W = forceEqual ? 1 : p.cost;
          if (W > 0) {
            const pct = W / totalW, a = srcAmt * pct;
            allocated += a; p.alloc += a;
            if (!('+' + p.src.toUpperCase() + '+').includes('+' + srcERP + '+')) p.src = p.src ? p.src + '+' + srcERP : srcERP;
            if (srcERP === 'T') p.allocT += a; else if (srcERP === 'S') p.allocS += a; else p.allocO += a;
            const st = forceEqual ? 'FALLBACK EQUAL' : 'ALLOCATED';
            detail.push([srcERP, g.key, g.type, g.rows, srcAmt, g.fam, p.erp, tKey, p.pcNo, p.mo, p.prod, p.name, p.loc, p.cost, pct, a, st, note]);
          }
        }
      }
    }
    const s = sum[srcERP] || sum.O;
    s[0] += srcAmt; s[1] += allocated; s[2] += unalloc;
  }

  const summary = ['T', 'S', 'O'].map((erp) => {
    const [src, alloc, un] = sum[erp];
    const diff = src - alloc - un;
    const status = Math.abs(diff) < 0.01 ? (Math.abs(un) < 0.01 ? 'PASS' : 'PARTIAL / CHECK') : 'CHECK';
    return { erp, src, alloc, unalloc: un, diff, status };
  });
  const tot = summary.reduce((a, s) => ({ src: a.src + s.src, alloc: a.alloc + s.alloc, unalloc: a.unalloc + s.unalloc }), { src: 0, alloc: 0, unalloc: 0 });
  tot.erp = 'TOTAL'; tot.diff = tot.src - tot.alloc - tot.unalloc;
  tot.status = Math.abs(tot.diff) < 0.01 ? (Math.abs(tot.unalloc) < 0.01 ? 'PASS' : 'PARTIAL / CHECK') : 'CHECK';

  for (const p of pool) p.rmIncl = p.cost + p.alloc;
  return { period, runAt: nowISO(), summary, total: tot, status: tot.status, detail, pc: pool, fgMaskCounts: { T: mask.T.set.size, S: mask.S.set.size, O: mask.O.set.size } };
}

/** RW_RawStockOutAmounts: raw Stock Out split RM vs FG (rows with consumption qty > 0, dated in period). */
export function rawStockOutAmounts(datasets, period) {
  let total = 0, fg = 0, rm = 0;
  for (const erp of ['T', 'S', 'O']) {
    const ds = datasets[`STOCK OUT-${erp}`]; if (!ds) continue;
    const c = soCols(ds, erp);
    for (const r of ds.rows) {
      const qty = -num(r[c.qty]);
      if (qty > TOL_QTY && dateInPeriod(r[c.date], period)) {
        const amt = Math.abs(num(r[c.amt]));
        total += amt;
        if (isFG(r[c.type])) fg += amt; else rm += amt;
      }
    }
  }
  return { total, fg, rm };
}

// ======================= 2B — FG Rework register =======================
export const RW_FIELDS = ['active', 'period', 'rid', 'erp', 'doc', 'srcRow', 'issueDate', 'fg', 'fgName', 'itemType', 'loc', 'uom', 'issueQty', 'erpRef', 'reason', 'jobKey',
  'rwType', 'rwStatus', 'pcNo', 'outFG', 'compDate', 'compQty', 'scrapQty', 'note', 'inputCheck', 'fifoStatus', 'fifoQty', 'fifoCost', 'closingWIP', 'carryIn', 'lastFifoRun', 'rowSource', 'bfQty', 'bfCost', 'originPeriod'];
export const RW_HEADERS = ['Active', 'Period', 'Rework ID', 'ERP', 'Stock Out Doc', 'Source Row', 'Issue Date', 'FG Code', 'FG Name', 'Item Type', 'Location', 'UOM', 'Issue Qty', 'ERP Amount Ref - Memo', 'Reason / Division', 'Job Code / Customer',
  'Rework Type', 'Rework Status', 'Rework PC No.', 'Output FG Code', 'Completion Date', 'Completed Qty', 'Scrap Qty', 'Note', 'Input Check', 'FIFO Status', 'FIFO Transfer Qty', 'FIFO Transfer Cost', 'Closing Rework WIP', 'Completed Carry-In', 'Last FIFO Run', 'Row Source', 'B/F Qty', 'B/F Carry Cost', 'Origin Period'];
export const RW_EDITABLE = ['rwType', 'rwStatus', 'pcNo', 'outFG', 'compDate', 'compQty', 'scrapQty', 'note'];

export function rwInputCheck(rwType, status, pcNo, issueQty, compQty, scrapQty, outFG) {
  rwType = utxt(rwType); status = utxt(status); pcNo = ttxt(pcNo); outFG = ttxt(outFG);
  if (!outFG) return 'BLOCK - OUTPUT FG REQUIRED';
  if (rwType === 'ABNORMAL') return 'REVIEW - ABNORMAL REWORK';
  if (status === 'COMPLETED') {
    if (!pcNo) return 'BLOCK - REWORK PC REQUIRED';
    if (compQty <= TOL_QTY) return 'BLOCK - COMPLETED QTY REQUIRED';
    if (scrapQty < -TOL_QTY) return 'BLOCK - SCRAP QTY';
    if (Math.abs(issueQty - compQty - scrapQty) > TOL_QTY) return 'BLOCK - QTY RECON';
    return 'PASS';
  }
  if (status === 'OPEN' || status === 'HOLD') return 'PASS';
  return 'BLOCK - STATUS';
}

export function collectFGSource(datasets, period) {
  const out = [];
  for (const erp of ['T', 'S', 'O']) {
    const ds = datasets[`STOCK OUT-${erp}`]; if (!ds) continue;
    const c = soCols(ds, erp); const seen = new Set();
    ds.rows.forEach((r, i) => {
      if (!(isFG(r[c.type]) && dateInPeriod(r[c.date], period))) return;
      const qty = -num(r[c.qty]); const amt = Math.abs(num(r[c.amt]));
      if (qty <= TOL_QTY) return;
      const sheetRow = i + 5;
      let lineNo = ttxt(r[c.line]); if (!lineNo) lineNo = 'R' + sheetRow;
      let rid = `${erp}|${txt(r[c.doc])}|L${lineNo}|${txt(r[c.item])}`;
      if (seen.has(rid)) rid += '|R' + sheetRow;
      seen.add(rid);
      out.push({
        erp, doc: r[c.doc], rid, srcRow: sheetRow, issueDate: r[c.date], fg: r[c.item], fgName: r[c.name], itemType: r[c.type],
        loc: r[c.loc], uom: r[c.uom], issueQty: qty, erpRef: amt, reason: r[c.reason], jobKey: r[c.key],
        legacyRid: `${erp}|${txt(r[c.doc])}|${sheetRow}|${txt(r[c.item])}`,
      });
    });
  }
  return out;
}

const blank = (v) => ttxt(v).length === 0;

/**
 * RW_BuildInput. oldRows = previous register (manual inputs + FIFO results are kept),
 * bf = brought-forward Rework WIP rows archived at the previous close.
 */
export function buildReworkRegister(datasets, period, oldRows = [], bf = []) {
  const old = new Map();
  for (const o of oldRows) if (!blank(o.rid)) old.set(String(o.rid).toUpperCase(), o);
  const cur = collectFGSource(datasets, period);
  const rows = [];
  for (const v of cur) {
    const row = Object.fromEntries(RW_FIELDS.map((f) => [f, null]));
    Object.assign(row, { active: 'Y', period, rid: v.rid, erp: v.erp, doc: v.doc, srcRow: v.srcRow, issueDate: v.issueDate, fg: v.fg, fgName: v.fgName, itemType: v.itemType, loc: v.loc, uom: v.uom, issueQty: v.issueQty, erpRef: v.erpRef, reason: v.reason, jobKey: v.jobKey });
    const o = old.get(v.rid.toUpperCase()) || old.get(v.legacyRid.toUpperCase());
    if (o) {
      row.rwType = blank(o.rwType) ? 'NORMAL' : o.rwType;
      row.rwStatus = blank(o.rwStatus) ? 'OPEN' : o.rwStatus;
      row.pcNo = o.pcNo; row.outFG = blank(o.outFG) ? v.fg : o.outFG;
      row.compDate = o.compDate; row.compQty = o.compQty; row.scrapQty = o.scrapQty; row.note = o.note;
    } else { row.rwType = 'NORMAL'; row.rwStatus = 'OPEN'; row.outFG = v.fg; }
    row.inputCheck = rwInputCheck(row.rwType, row.rwStatus, row.pcNo, num(row.issueQty), num(row.compQty), num(row.scrapQty), txt(row.outFG));
    row.fifoStatus = 'NOT RUN'; row.fifoQty = 0; row.fifoCost = 0; row.closingWIP = 0; row.carryIn = 0; row.lastFifoRun = null;
    if (o) {
      const of = utxt(o.fifoStatus);
      if (of === 'PASS') {
        if (Math.abs(num(o.issueQty) - num(row.issueQty)) <= TOL_QTY && Math.abs(num(o.fifoQty) - num(row.issueQty)) <= TOL_QTY) {
          const t = num(o.fifoCost);
          row.fifoStatus = 'PASS'; row.fifoQty = num(o.fifoQty); row.fifoCost = t;
          if (utxt(row.rwStatus) === 'COMPLETED' && utxt(row.rwType) === 'NORMAL') { row.closingWIP = 0; row.carryIn = t; } else { row.closingWIP = t; row.carryIn = 0; }
          row.lastFifoRun = o.lastFifoRun;
        } else row.fifoStatus = 'RERUN FIFO - QTY CHANGED';
      } else if (of && of !== 'NOT RUN') row.fifoStatus = 'RERUN FIFO';
    }
    row.rowSource = 'CURRENT'; row.bfQty = 0; row.bfCost = 0; row.originPeriod = period;
    rows.push(row);
  }
  let bfCost = 0;
  for (const h of bf) {
    const row = Object.fromEntries(RW_FIELDS.map((f) => [f, null]));
    Object.assign(row, { active: 'B/F', period, rid: h.rid, erp: h.erp, doc: h.doc, srcRow: h.srcRow, issueDate: h.issueDate, fg: h.fg, fgName: h.fgName, itemType: h.itemType, loc: h.loc, uom: h.uom, issueQty: 0, erpRef: 0, reason: h.reason, jobKey: h.jobKey });
    const o = old.get(String(h.rid).toUpperCase());
    const src = o || h;
    row.rwType = blank(src.rwType) ? 'NORMAL' : src.rwType;
    row.rwStatus = blank(src.rwStatus) ? 'OPEN' : src.rwStatus;
    row.pcNo = src.pcNo; row.outFG = blank(src.outFG) ? h.fg : src.outFG;
    row.compDate = src.compDate; row.compQty = src.compQty; row.scrapQty = src.scrapQty; row.note = src.note;
    row.inputCheck = rwInputCheck(row.rwType, row.rwStatus, row.pcNo, num(h.bfQty), num(row.compQty), num(row.scrapQty), txt(row.outFG));
    row.fifoStatus = 'OPENING B/F'; row.fifoQty = 0; row.fifoCost = 0; row.closingWIP = num(h.carryCost); row.carryIn = 0; row.lastFifoRun = null;
    row.rowSource = 'OPENING B/F'; row.bfQty = num(h.bfQty); row.bfCost = num(h.carryCost); row.originPeriod = h.originPeriod;
    bfCost += num(h.carryCost);
    rows.push(row);
  }
  const curRows = rows.filter((r) => r.active === 'Y');
  return {
    period, refreshedAt: nowISO(), rows,
    stats: { rows: curRows.length, issueQty: rows.reduce((a, r) => a + num(r.issueQty), 0), erpRef: rows.reduce((a, r) => a + num(r.erpRef), 0), bfRows: bf.length, bfCost },
  };
}

/** Re-evaluate Input Check after the user edits manual columns. */
export function recheckRegisterRow(row) {
  const qty = row.active === 'B/F' ? num(row.bfQty) : num(row.issueQty);
  row.inputCheck = rwInputCheck(row.rwType, row.rwStatus, row.pcNo, qty, num(row.compQty), num(row.scrapQty), txt(row.outFG));
  if (utxt(row.fifoStatus) === 'PASS') {
    const t = num(row.fifoCost);
    if (utxt(row.rwStatus) === 'COMPLETED' && utxt(row.rwType) === 'NORMAL') { row.closingWIP = 0; row.carryIn = t; } else { row.closingWIP = t; row.carryIn = 0; }
  }
  return row;
}

/** RW_UpdateStep2Control — Stock Out classification block on 03_STOCK_OUT_ALLOCATION J4:N9. */
export function step2Classification(datasets, period, step2, register) {
  const raw = rawStockOutAmounts(datasets, period);
  const allocatedRM = step2 ? step2.total.alloc : 0;
  const rmDiff = raw.rm - allocatedRM;
  const fgRows = register ? register.rows.filter((r) => r.active === 'Y').length : 0;
  const fgQty = register ? register.rows.reduce((a, r) => a + num(r.issueQty), 0) : 0;
  return {
    totalRaw: raw.total, rmEligible: raw.rm, fgRef: raw.fg, allocatedRM, rmDiff, fgRows, fgQty, fgAllocated: 0,
    classCheck: Math.abs(raw.total - raw.rm - raw.fg) <= TOL_AMT ? 'PASS' : 'CHECK',
    gate: Math.abs(rmDiff) <= TOL_AMT ? 'PASS' : 'RERUN / CHECK',
  };
}
