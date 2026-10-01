// STEP 3A — Opening WIP + Material WIP
// Port of WIPValidateOpeningCore, WIPEnrichOpeningMaster, WIPDetectOpeningSource, STEP3_Import_Opening_WIP,
// WIPSaveClosingAsOpening, WIPLoadMovement, WIPPrepareOutput, WIPPCMTieDifference, STEP3_Build_Material_WIP.
import { txt, ttxt, num, isNumeric, headerCol, headerColAny, lastDataEnd, nextPeriod, nowISO } from './util.js';
import { fgMask, soCell } from './step2.js';

// ---------------- Opening WIP ----------------
function masterMaps(datasets) {
  const name = new Map(), unit = new Map();
  const addFrom = (key, codeN, nameN, unitN) => {
    const ds = datasets[key]; if (!ds) return;
    const cC = headerColAny(ds.header, codeN); if (cC < 0) return;
    const cN = headerColAny(ds.header, nameN), cU = headerColAny(ds.header, unitN);
    const end = lastDataEnd(ds.rows, cC);
    for (let i = 0; i < end; i++) {
      const r = ds.rows[i]; const code = ttxt(r[cC]); if (!code) continue;
      const k = code.toUpperCase();
      const nm = cN >= 0 ? ttxt(r[cN]) : '', un = cU >= 0 ? ttxt(r[cU]) : '';
      if (nm && !name.has(k)) name.set(k, [nm, key]);
      if (un && !unit.has(k)) unit.set(k, [un, key]);
    }
  };
  for (const e of ['T', 'O', 'S']) addFrom(`MI-M-${e}`, ['Material Code'], ['Material Name'], ['Unit', 'Unit(Qty)', 'Base Unit']);
  for (const e of ['T', 'O', 'S']) addFrom(`PC-M-${e}`, ['Material Code'], ['Material Name'], ['Unit(Qty)', 'Unit', 'Base Unit']);
  for (const e of ['T', 'O', 'S']) addFrom(`MR-M-${e}`, ['Material Code'], ['Material Name'], ['Unit', 'Unit(Qty)', 'Base Unit']);
  for (const e of ['T', 'O', 'S']) addFrom(`STOCK OUT-${e}`, ['Item Code'], ['Item Name(English)', 'Item Name (English)', 'Item Name'], ['Unit', 'Base Unit']);
  return { name, unit };
}

/**
 * Validate (and enrich name / unit of) an opening WIP object in place.
 * opening = {period, source, rows: [{code, name, unit, qty, amt, source, note, status}]}
 */
export function validateOpening(opening, datasets, controlPeriod) {
  if (!opening.period) opening.period = controlPeriod;
  const res = { materials: 0, totalQty: 0, totalAmt: 0, errors: 0, warnings: 0, missingName: 0, missingUnit: 0 };
  if (opening.period !== controlPeriod) { opening.status = 'PERIOD MISMATCH'; opening.stats = res; return false; }
  if (!opening.rows || !opening.rows.length) { opening.status = 'NO DATA'; opening.stats = res; return false; }
  const mm = masterMaps(datasets || {});
  for (const row of opening.rows) {
    const code = ttxt(row.code);
    if (code) {
      let note = ttxt(row.note);
      if (!ttxt(row.name)) { const m = mm.name.get(code.toUpperCase()); if (m) { row.name = m[0]; note = (note ? note + '; ' : '') + 'Name auto-filled from ' + m[1]; } }
      if (!ttxt(row.unit)) { const m = mm.unit.get(code.toUpperCase()); if (m) { row.unit = m[0]; note = (note ? note + '; ' : '') + 'Unit auto-filled from ' + m[1]; } }
      if (note) row.note = note;
    }
  }
  const seen = new Set();
  for (const row of opening.rows) {
    const code = ttxt(row.code), nm = ttxt(row.name), un = ttxt(row.unit), tq = ttxt(row.qty), ta = ttxt(row.amt);
    let st = '';
    if (!code) {
      if (nm || un || tq || ta) { st = 'ERROR - MISSING CODE'; res.errors++; }
    } else {
      res.materials++;
      const k = code.toUpperCase();
      if (seen.has(k)) { st = 'ERROR - DUPLICATE'; res.errors++; } else seen.add(k);
      if (tq && !isNumeric(tq)) { st = 'ERROR - INVALID QTY'; res.errors++; }
      if (ta && !isNumeric(ta)) { st = 'ERROR - INVALID AMOUNT'; res.errors++; }
      const q = num(row.qty), a = num(row.amt);
      res.totalQty += q; res.totalAmt += a;
      if (!nm) res.missingName++;
      if (!un) res.missingUnit++;
      if (!st) {
        if (q < -0.0000001 || a < -0.01) { st = 'CHECK NEGATIVE'; res.warnings++; }
        else if (!nm || !un) { st = 'MASTER DATA MISSING'; res.warnings++; row.note = !nm && !un ? 'Missing Name & Unit' : !nm ? 'Missing Name' : 'Missing Unit'; }
        else st = 'OK';
      }
    }
    row.status = st;
  }
  opening.stats = res;
  const ok = res.errors === 0 && res.materials > 0;
  opening.status = ok ? (res.warnings > 0 ? 'READY WITH WARNINGS' : 'READY') : 'NOT READY';
  opening.validatedAt = nowISO();
  return ok;
}

/**
 * WIPDetectOpeningSource on a parsed workbook: sheets = {name: grid (rows from row 1)}.
 * Returns {sheet, hdrRow(1-based), cols, sourceType, sourcePeriod} or null.
 */
export function detectOpeningSource(sheets) {
  const cell = (g, r, c) => (g[r - 1] || [])[c - 1];
  const tryAt = (g, hdrRow, spec) => {
    const h = g[hdrRow - 1] || [];
    const cols = {};
    for (const [k, names] of Object.entries(spec)) cols[k] = headerColAny(h, names);
    return cols.code >= 0 && cols.qty >= 0 && cols.amt >= 0 ? cols : null;
  };
  let g = sheets['03_WIP_ALLOCATION'];
  if (g) {
    const c = tryAt(g, 11, { code: ['Item Code'], name: ['Item Name'], unit: ['Unit'], qty: ['Closing Qty'], amt: ['Closing Amount'] });
    if (c) return { sheet: '03_WIP_ALLOCATION', hdrRow: 11, cols: c, sourceType: 'STEP 3 Closing WIP', sourcePeriod: ttxt(cell(g, 2, 2)) };
  }
  g = sheets['WIP_OPENING'];
  if (g) {
    const c = tryAt(g, 5, { code: ['Material Code'], name: ['Material Name'], unit: ['Unit'], qty: ['Opening Qty'], amt: ['Opening Amount'] });
    if (c) return { sheet: 'WIP_OPENING', hdrRow: 5, cols: c, sourceType: 'WIP Opening', sourcePeriod: ttxt(cell(g, 2, 2)) };
  }
  g = sheets['WIP- ONLY RM'];
  if (g) {
    const c = tryAt(g, 4, { code: ['Item Code'], name: ['Item Name(English)', 'Item Name'], unit: ['Base Unit', 'Unit'], qty: ['QTY BAL'], amt: ['AMT BAL'] });
    if (c) return { sheet: 'WIP- ONLY RM', hdrRow: 4, cols: c, sourceType: 'Legacy WIP Closing', sourcePeriod: '' };
  }
  for (const [name, grid] of Object.entries(sheets)) {
    for (let r = 1; r <= grid.length; r++) {
      const c = tryAt(grid, r, { code: ['Item Code', 'Material Code'], name: ['Item Name', 'Item Name(English)', 'Material Name'], unit: ['Unit', 'Base Unit'], qty: ['Closing Qty', 'QTY BAL', 'Opening Qty'], amt: ['Closing Amount', 'AMT BAL', 'Opening Amount'] });
      if (c) return { sheet: name, hdrRow: r, cols: c, sourceType: 'Detected WIP table', sourcePeriod: '' };
    }
  }
  return null;
}

/** STEP3_Import_Opening_WIP body: build opening rows from a detected source table. */
export function openingFromSource(sheets, det, fileName, targetPeriod) {
  const g = sheets[det.sheet]; const body = g.slice(det.hdrRow);
  const end = lastDataEnd(body, det.cols.code);
  const rows = [];
  for (let i = 0; i < end; i++) {
    const r = body[i] || []; const code = ttxt(r[det.cols.code]); if (!code) continue;
    const q = num(r[det.cols.qty]), a = num(r[det.cols.amt]);
    if (Math.abs(q) > 0.0000001 || Math.abs(a) > 0.01) {
      rows.push({ code, name: det.cols.name >= 0 ? txt(r[det.cols.name]) : '', unit: det.cols.unit >= 0 ? txt(r[det.cols.unit]) : '', qty: q, amt: a, source: fileName, note: det.sourceType, status: '' });
    }
  }
  let warn = '';
  if (det.sourceType === 'STEP 3 Closing WIP' && det.sourcePeriod && nextPeriod(det.sourcePeriod) !== targetPeriod) warn = `Closing WIP được chọn là kỳ ${det.sourcePeriod}, trong khi kỳ mở là ${targetPeriod}.`;
  if (det.sourceType === 'WIP Opening' && det.sourcePeriod && det.sourcePeriod !== targetPeriod) warn = `Opening WIP được chọn là kỳ ${det.sourcePeriod}, trong khi kỳ báo cáo là ${targetPeriod}.`;
  return { opening: { period: targetPeriod, source: `${fileName} / ${det.sheet}`, rows, status: 'NOT VALIDATED', changedAt: nowISO() }, warn };
}

/** WIPSaveClosingAsOpening: closing of the prior period's STEP 3 → opening of the next. */
export function openingFromClosing(step3Prev, newPeriod) {
  const rows = [];
  for (const m of step3Prev.rows) {
    const q = m.closingQty, a = m.closingAmt;
    if (Math.abs(q) > 0.0000001 || Math.abs(a) > 0.01) rows.push({ code: m.code, name: m.name, unit: m.unit, qty: q, amt: a, source: `Closing WIP ${step3Prev.period}`, note: 'Auto roll-forward', status: '' });
  }
  return { period: newPeriod, source: `Closing WIP ${step3Prev.period}`, rows, status: 'NOT VALIDATED', changedAt: nowISO() };
}

// ---------------- Material WIP ----------------
const MOVES = [
  ['MI-M-T', 'MI', ['Material Code'], ['Material Name'], ['Unit'], ['Current Issue Qty', 'Quantity'], ['Total Cost']],
  ['MI-M-O', 'MI', ['Material Code'], ['Material Name'], ['Unit'], ['Current Issue Qty', 'Base Qty', 'Quantity'], ['Total Cost']],
  ['STOCK OUT-T', 'SO', ['Item Code'], ['Item Name(English)', 'Item Name'], ['Unit', 'Base Unit'], ['Quantity', 'Base Qty'], ['Total Cost']],
  ['STOCK OUT-O', 'SO', ['Item Code'], ['Item Name(English)', 'Item Name'], ['Base Unit', 'Unit'], ['Base Qty', 'Quantity'], ['Total Cost']],
  ['STOCK OUT-S', 'SO', ['Item Code'], ['Item Name(English)', 'Item Name'], ['Unit', 'Base Unit'], ['Quantity', 'Base Qty'], ['Total Cost']],
  ['PC-M-T', 'PC', ['Material Code'], ['Material Name'], ['Unit(Qty)', 'Unit'], ['Quantity'], ['Total Cost', 'RM Cost']],
  ['PC-M-O', 'PC', ['Material Code'], ['Material Name'], ['Unit(Qty)', 'Unit'], ['Quantity'], ['Total Cost', 'RM Cost']],
  // v30.6.1: MR returned qty = Quantity (T, O) / Bad Quantity (S). Req. Qty is never used.
  ['MR-M-T', 'MR', ['Material Code'], ['Material Name'], ['Unit'], ['Quantity'], ['Total Cost']],
  ['MR-M-O', 'MR', ['Material Code'], ['Material Name'], ['Unit'], ['Quantity'], ['Total Cost']],
  ['MR-M-S', 'MR', ['Material Code'], ['Material Name'], ['Unit'], ['Bad Quantity'], ['Total Cost']],
];

function sumCol(ds, valH, keyH) {
  if (!ds) return 0;
  const cV = headerCol(ds.header, valH), cK = headerCol(ds.header, keyH);
  if (cV < 0 || cK < 0) return 0;
  const end = lastDataEnd(ds.rows, cK); let s = 0;
  for (let i = 0; i < end; i++) { const r = ds.rows[i]; if (ttxt(r[cK]) && isNumeric(r[cV])) s += num(r[cV]); }
  return s;
}

export function pcmTieDifference(datasets) {
  const pcm = sumCol(datasets['PC-M-T'], 'Total Cost', 'PC No.') + sumCol(datasets['PC-M-O'], 'Total Cost', 'PC No.');
  const pcp = sumCol(datasets['PC-P-T'], 'Total Cost', 'PC No.') + sumCol(datasets['PC-P-O'], 'Total Cost', 'PC No.');
  return pcm - pcp;
}

export const WIP_HEADERS = ['Item Code', 'Item Name', 'Unit', 'Opening Qty', 'Opening Amount', 'MI Qty', 'MI Amount', 'Stock Out Qty', 'Stock Out Amount', 'Total IN Qty', 'Total IN Amount', 'PC Qty', 'PC Amount', 'MR Qty', 'MR Amount', 'Stock Out OUT Qty', 'Stock Out OUT Amount', 'Total OUT Qty', 'Total OUT Amount', 'Closing Qty', 'Closing Amount', 'Status'];

/**
 * STEP3_Build_Material_WIP (with FG Stock Out excluded, as the FG-rework wrapper does).
 * Gates: STEP 2 current & PASS, no unallocated, opening validated for the period.
 */
export function runStep3(datasets, opening, step2, period, latestImport) {
  if (!step2) throw new Error('Chưa có kết quả STEP 2. Hãy chạy phân bổ Stock Out trước.');
  if (step2.period !== period) throw new Error('Kỳ của STEP 2 không phải kỳ hiện tại. Chạy lại STEP 2.');
  if (step2.status !== 'PASS') throw new Error('Trạng thái STEP 2 chưa PASS.');
  if (latestImport && latestImport > step2.runAt) throw new Error('Dữ liệu ERP được import sau lần chạy STEP 2 gần nhất. Chạy lại STEP 2 trước STEP 3.');
  if (Math.abs(step2.total.unalloc) > 0.01) throw new Error(`STEP 2 còn Stock Out chưa phân bổ ${step2.total.unalloc.toLocaleString()}.`);
  if (!opening || opening.period !== period) throw new Error(`Chưa có Opening WIP cho kỳ ${period}. Import hoặc roll forward Opening WIP rồi Validate.`);
  if (!validateOpening(opening, datasets, period)) throw new Error(`Opening WIP kỳ ${period} chưa sẵn sàng (${opening.status}).`);

  const mask = fgMask(datasets, period);
  const idx = new Map(); const mats = [];
  const getM = (code, nm, un) => {
    code = code.trim(); if (!code) return null;
    const k = code.toUpperCase(); let m = idx.get(k);
    if (!m) {
      m = { code, name: nm, unit: un, opQty: 0, opAmt: 0, miQty: 0, miAmt: 0, soQty: 0, soAmt: 0, pcQty: 0, pcAmt: 0, mrQty: 0, mrAmt: 0 };
      idx.set(k, m); mats.push(m);
    } else {
      if (!m.name && nm) m.name = nm;
      if (!m.unit && un) m.unit = un;
    }
    return m;
  };
  for (const r of opening.rows) {
    const code = ttxt(r.code); if (!code) continue;
    const m = getM(code, txt(r.name), txt(r.unit));
    m.opQty += num(r.qty); m.opAmt += num(r.amt);
  }
  let mrZeroLines = 0, mrZeroCost = 0;
  for (const [key, type, codeN, nameN, unitN, qtyN, amtN] of MOVES) {
    const ds = datasets[key];
    if (!ds) throw new Error(`Thiếu dữ liệu ${key}.`);
    const h = ds.header;
    const cC = headerColAny(h, codeN), cN = headerColAny(h, nameN), cU = headerColAny(h, unitN), cQ = headerColAny(h, qtyN), cA = headerColAny(h, amtN);
    if (cC < 0 || cQ < 0 || cA < 0) throw new Error(`Required WIP headers not found in ${key}. Qty source is explicit; no first-non-zero fallback is allowed.`);
    const erp = key.slice(-1);
    const end = lastDataEnd(ds.rows, cC);
    for (let i = 0; i < end; i++) {
      const r = ds.rows[i];
      const code = txt(r[cC]).trim(); if (!code) continue;
      const m = getM(code, cN >= 0 ? txt(r[cN]) : '', cU >= 0 ? txt(r[cU]) : '');
      let qv = r[cQ], av = r[cA];
      if (type === 'SO') { qv = soCell(mask, erp, i, cQ, qv); av = soCell(mask, erp, i, cA, av); }
      let q = isNumeric(qv) ? num(qv) : 0, a = isNumeric(av) ? num(av) : 0;
      if (type === 'SO') { q = -q; a = -a; }
      if (type === 'MR' && Math.abs(q) < 0.0001 && Math.abs(a) > 0.01) { mrZeroLines++; mrZeroCost += a; }
      if (type === 'MI') { m.miQty += q; m.miAmt += a; }
      else if (type === 'SO') { m.soQty += q; m.soAmt += a; }
      else if (type === 'PC') { m.pcQty += q; m.pcAmt += a; }
      else { m.mrQty += q; m.mrAmt += a; }
    }
  }

  const rows = []; let totalSO = 0;
  const S = { opening: 0, inAmt: 0, miAmt: 0, soAmt: 0, outAmt: 0, pcAmt: 0, mrAmt: 0, soOutAmt: 0, closingAmt: 0, newMat: 0, exceptions: 0, negative: 0, masterMissing: 0 };
  for (const m of mats) {
    const inQ = m.miQty + m.soQty, inA = m.miAmt + m.soAmt;
    const outQ = m.pcQty + m.mrQty + m.soQty, outA = m.pcAmt + m.mrAmt + m.soAmt;
    const cQ = m.opQty + inQ - outQ, cA = m.opAmt + inA - outA;
    let st;
    if (cQ < -0.0001 || cA < -0.01) st = 'CHECK NEGATIVE';
    else if (!m.name || !m.unit) st = 'MASTER DATA MISSING';
    else if (Math.abs(m.opQty) < 0.0001 && Math.abs(m.opAmt) < 0.01 && (Math.abs(inQ) > 0.0001 || Math.abs(inA) > 0.01 || Math.abs(outQ) > 0.0001 || Math.abs(outA) > 0.01)) st = 'NEW MATERIAL';
    else st = 'OK';
    totalSO += m.soAmt;
    rows.push({ code: m.code, name: m.name, unit: m.unit, opQty: m.opQty, opAmt: m.opAmt, miQty: m.miQty, miAmt: m.miAmt, soQty: m.soQty, soAmt: m.soAmt, inQty: inQ, inAmt: inA, pcQty: m.pcQty, pcAmt: m.pcAmt, mrQty: m.mrQty, mrAmt: m.mrAmt, soOutQty: m.soQty, soOutAmt: m.soAmt, outQty: outQ, outAmt: outA, closingQty: cQ, closingAmt: cA, status: st });
  }
  // Summary = worksheet SUM formulas (column order of summation as Excel: top to bottom)
  for (const r of rows) {
    S.opening += r.opAmt; S.inAmt += r.inAmt; S.miAmt += r.miAmt; S.soAmt += r.soAmt; S.outAmt += r.outAmt;
    S.pcAmt += r.pcAmt; S.mrAmt += r.mrAmt; S.soOutAmt += r.soOutAmt; S.closingAmt += r.closingAmt;
    if (r.status === 'NEW MATERIAL') S.newMat++;
    if (r.status.startsWith('CHECK') || r.status === 'MASTER DATA MISSING') S.exceptions++;
    if (r.status === 'CHECK NEGATIVE') S.negative++;
    if (r.status === 'MASTER DATA MISSING') S.masterMissing++;
  }
  const recon = S.opening + S.inAmt - S.outAmt - S.closingAmt;
  const soTie = totalSO - step2.total.alloc;
  const pcTie = pcmTieDifference(datasets);
  const checks = {
    wipRecon: { value: recon, status: Math.abs(recon) < 0.01 ? 'PASS' : 'CHECK' },
    soVsStep2: { value: soTie, status: Math.abs(soTie) < 0.01 ? 'PASS' : 'CHECK' },
    pcmVsPcp: { value: pcTie, status: Math.abs(pcTie) < 0.01 ? 'PASS' : 'CHECK' },
    exceptions: { value: S.exceptions, status: S.exceptions === 0 ? 'PASS' : 'CHECK' },
    mrQty: { lines: mrZeroLines, cost: mrZeroCost, status: mrZeroLines === 0 ? 'PASS' : 'REVIEW' },
  };
  return { period, runAt: nowISO(), openingSource: opening.source || '', openingStatus: opening.status, openingAmt: opening.stats ? opening.stats.totalAmt : 0, rows, summary: S, checks, step2RunAt: step2.runAt };
}
