// STEP 3B — Direct WIP Adjustment (negative / residual WIP clean-up)
// Port of modSTEP3B: ERP ownership map, auto INPUT, ENGINE rebuild, DETAIL, CONTROL, BUILD / APPLY / no-adjustment close,
// DIRECT_632 register, WIP final layer (03_WIP_ALLOCATION Z:AF), PC-P / 04_PC_SOURCE direct-adjustment columns.
import { txt, ttxt, utxt, num, isNumeric, headerCol, nowISO } from './util.js';

export const TOL_Q = 0.000001; // SVL_WIPADJ_TOL_QTY
export const TOL_A = 1;        // SVL_WIPADJ_TOL_AMT
const k = (v) => ttxt(v);      // material key (text, as Q = B & "")
const ukey = (v) => ttxt(v).toUpperCase();

// ======================= ERP ownership map =======================
export const MAP_FIELDS = ['code', 'name', 'unit', 'erp', 'src', 'sheets', 'rowsN', 'rule', 'review', 'priority', 'reason', 'step3Status', 'override', 'overrideNote', 'approvedBy', 'approvedAt', 'effFrom', 'active', 'version', 'b2Review'];
export const MAP_HEADERS = ['Item Code', 'Item Name', 'Unit', 'ERP Assigned', 'ERP Source', 'Evidence Sheets', 'Evidence Rows', 'WIP Rule Candidate', 'Review Status', 'Priority', 'Review Reason', 'Current Step 3 Status', 'User ERP Override', 'Override Note', 'Approved By', 'Approved At', 'Effective From', 'Active Flag', 'Source Version', 'B2 Review Status'];

function evidence(datasets) {
  const ev = new Map(), evS = new Map();
  for (const e of ['T', 'S', 'O']) for (const s of ['PC-M', 'MI-M', 'MR-M', 'STOCK OUT']) {
    const ds = datasets[`${s}-${e}`]; if (!ds) continue;
    // M1_Col: exact (case-insensitive, trimmed) header text
    const find = (name) => ds.header.findIndex((h) => ttxt(h).toUpperCase() === name.toUpperCase());
    let c = find('Material Code'); if (c < 0) c = find('Item Code'); if (c < 0) continue;
    const sh = `${s}-${e}`;
    for (const r of ds.rows) {
      const code = ttxt(r[c]); if (!code) continue;
      const key = code + '|' + e;
      ev.set(key, (ev.get(key) || 0) + 1);
      const cur = evS.get(key) || '';
      if (!('; ' + cur + ';').includes('; ' + sh + ';')) evS.set(key, cur ? cur + '; ' + sh : sh);
    }
  }
  return { ev, evS };
}
function classify(code, ev, evS) {
  let erp = '', sheets = '', rowsN = 0, best = 0, nErp = 0;
  for (const e of ['T', 'S', 'O']) {
    const key = code + '|' + e;
    if (ev.has(key)) {
      const cnt = ev.get(key); nErp++; rowsN += cnt;
      sheets = sheets ? sheets + '; ' + evS.get(key) : evS.get(key);
      if (cnt > best) { best = cnt; erp = e; }
    }
  }
  if (nErp === 1) return { erp, src: 'MOVEMENT', sheets, rowsN, review: 'OK', reason: '' };
  if (nErp > 1) return { erp, src: 'MOVEMENT (REVIEW)', sheets, rowsN, review: 'REVIEW', reason: 'Movement found in more than one ERP; ERP with most rows assigned. Confirm or set User ERP Override.' };
  if (code.slice(0, 2).toUpperCase() === 'SV' || (code.length === 8 && isNumeric(code))) return { erp: 'T', src: 'CODE', sheets, rowsN, review: 'OK', reason: 'No current-period movement; T code pattern.' };
  if (code.length === 6 && isNumeric(code)) return { erp: 'O', src: 'CODE (REVIEW)', sheets, rowsN, review: 'REVIEW', reason: 'No current-period movement; 6-digit code inferred as O. S also uses 6 digits, so confirmation is required.' };
  return { erp: 'UNKNOWN', src: 'UNKNOWN', sheets, rowsN, review: 'REVIEW', reason: 'No movement and no code rule - set User ERP Override (col M).' };
}

/** STEP3B_RefreshErpMapCore — append WIP materials not yet in the map (existing rows never change). */
export function refreshErpMap(map, step3, datasets, period) {
  const rows = map && map.rows ? map.rows : [];
  const have = new Set(rows.map((r) => k(r.code)));
  const { ev, evS } = evidence(datasets);
  let added = 0, nRev = 0;
  for (const m of step3.rows) {
    const code = k(m.code); if (!code || have.has(code)) continue;
    have.add(code);
    const c = classify(code, ev, evS);
    const q = m.closingQty, a = m.closingAmt;
    const rule = q < 0 ? 'R1_NEG_QTY' : Math.abs(q) < 0.000001 && Math.abs(a) >= 0.5 ? 'R4_QTY_ZERO_AMT' : 'R0_NORMAL';
    rows.push({ code, name: txt(m.name), unit: txt(m.unit), erp: c.erp, src: c.src, sheets: c.sheets, rowsN: c.rowsN, rule, review: c.review, priority: c.review === 'OK' ? 'NORMAL' : 'REVIEW', reason: c.reason, step3Status: '', override: '', overrideNote: '', approvedBy: '', approvedAt: '', effFrom: `NEW ${period}`, active: 'Y', version: 'web-AUTO', b2Review: c.review });
    added++; if (c.review !== 'OK') nRev++;
  }
  return { map: { period, rows, refreshedAt: nowISO() }, added, nRev, msg: added ? `ERP MAP: ${added} vật tư mới, ${nRev} cần REVIEW.` : 'ERP MAP đã cập nhật – không có vật tư mới.' };
}
function mapIndex(map) {
  const m = new Map();
  for (const r of (map && map.rows) || []) { const c = k(r.code); if (c && !m.has(c)) m.set(c, r); }
  return m;
}

// ======================= INPUT =======================
export const INPUT_OPTIONS = ['ERP_AMOUNT', 'DIRECT_632'];

/** Negative materials of STEP 3A (Status = CHECK NEGATIVE) — LoadNegatives. */
export function negativeMaterials(step3) {
  const seen = new Set(); const out = [];
  for (const m of step3.rows) {
    const code = k(m.code);
    if (code && m.status === 'CHECK NEGATIVE' && !seen.has(code)) { seen.add(code); out.push({ code: m.code, name: m.name, qty: m.closingQty, amt: m.closingAmt }); }
  }
  return out;
}

/** Compare INPUT with current negatives (STEP3B_Build_Auto). */
export function inputSyncCheck(input, step3) {
  const neg = negativeMaterials(step3);
  const cur = new Map(); for (const r of input || []) { const c = k(r.code); if (c && !cur.has(c)) cur.set(c, r); }
  let added = 0, removed = 0, basisDiff = 0; const negSet = new Set();
  for (const n of neg) {
    const c = k(n.code); negSet.add(c);
    const r = cur.get(c);
    if (!r) added++; else if (Math.abs(num(r.basisQty) - n.qty) > 0.001 || Math.abs(num(r.basisAmt) - n.amt) > 1) basisDiff++;
  }
  for (const c of cur.keys()) if (!negSet.has(c)) removed++;
  return { neg, inputN: cur.size, added, removed, basisDiff, inSync: added + removed + basisDiff === 0 };
}

/** WriteInput: rebuild INPUT from negatives; keepOld keeps Option / Reason / Note per material. */
export function writeInput(input, step3, keepOld) {
  const old = new Map();
  if (keepOld) for (const r of input || []) { const c = k(r.code); if (c && !old.has(c)) old.set(c, r); }
  return negativeMaterials(step3).map((n) => {
    const o = old.get(k(n.code));
    return {
      code: n.code, desc: n.name, basisQty: n.qty, basisAmt: n.amt,
      option: o ? (ttxt(o.option) || 'ERP_AMOUNT') : 'ERP_AMOUNT',
      reason: o ? o.reason : 'AUTO: CHECK NEGATIVE in 03_WIP_ALLOCATION', note: o ? o.note : '', sourceVersion: 'web-AUTO',
    };
  });
}

/** Formula columns of 03_WIP_DIRECT_ADJ_INPUT (D, E, F, L, N, O, Q). */
export function deriveInput(input, map, step3, period) {
  const mi = mapIndex(map);
  const wi = new Map(); for (const m of step3 ? step3.rows : []) { const c = k(m.code); if (!wi.has(c)) wi.set(c, m); }
  const seen = new Set();
  return (input || []).map((r) => {
    const key = k(r.code);
    if (!key) return { ...r, key: '', period, erp: '', erpQty: '', erpAmt: '', check: '', erpSource: '', rule: '' };
    const mr = mi.get(key);
    const erp = mr ? (ttxt(mr.override) ? ttxt(mr.override) : txt(mr.erp)) : 'UNKNOWN';
    const w = wi.get(key);
    let check;
    if (ttxt(r.desc) === 'ITEM NOT FOUND') check = 'BLOCK - ITEM';
    else if (erp === 'UNKNOWN') check = 'BLOCK - ERP';
    else if ((typeof r.basisQty === 'number' ? r.basisQty : 0) === 0 && (typeof r.basisAmt === 'number' ? r.basisAmt : 0) === 0) check = 'BLOCK - ZERO ADJ';
    else if (seen.has(key)) check = 'BLOCK - DUPLICATE';
    else check = 'PASS';
    seen.add(key);
    return {
      ...r, key, period, erp: erp.toUpperCase() === erp ? erp : erp,
      erpQty: w ? w.closingQty : '', erpAmt: w ? w.closingAmt : '', check,
      erpSource: mr ? (ttxt(mr.override) ? 'USER OVERRIDE' : txt(mr.src)) : '', rule: mr ? txt(mr.rule) : '',
    };
  });
}

// ======================= ENGINE =======================
/** STEP3B_V4_RebuildEngineCore — static basis rows (current-period PC-P / PC-M). */
export function rebuildEngine(inputDerived, step2, datasets, period) {
  if (!step2 || step2.period !== period) throw new Error(`STEP 2 chưa chạy cho kỳ ${period}. Chạy STEP 2 trước.`);
  const inpErp = new Map(), inpDesc = new Map(), order = [];
  for (const r of inputDerived) {
    const key = r.key || k(r.code);
    if (key && !inpErp.has(key)) { inpErp.set(key, utxt(r.erp)); inpDesc.set(key, txt(r.desc)); order.push(key); }
  }
  if (!order.length) throw new Error('03_WIP_DIRECT_ADJ_INPUT chưa có vật tư nào.');
  // PC-P basis = RM Cost incl. Stock Out (Step 2 output), lots with "PC-" prefix, sheet order
  const pcp = { T: [], O: [] }, pcpTot = { T: 0, O: 0 }, pcSet = new Set();
  for (const e of ['T', 'O']) {
    for (const p of step2.pc.filter((x) => x.erp === e).sort((a, b) => a.rowIdx - b.rowIdx)) {
      const pc = ttxt(p.pcNo);
      if (pc.slice(0, 3).toUpperCase() !== 'PC-') continue;
      pcp[e].push([pc, ttxt(p.prod), txt(p.name), p.rmIncl]);
      pcpTot[e] += p.rmIncl; pcSet.add(e + '|' + pc);
    }
  }
  // PC-M usage
  const useD = new Map();
  for (const e of ['T', 'O']) {
    const ds = datasets[`PC-M-${e}`]; if (!ds) continue;
    const f = (n) => { const c = ds.header.findIndex((h) => ttxt(h).toUpperCase() === n.toUpperCase()); if (c < 0) throw new Error(`Column '${n}' not found in PC-M-${e}.`); return c; };
    const cPC = f('PC No.'), cProd = f('Product Code'), cName = f('Product Name'), cMat = f('Material Code'), cQty = f('Quantity');
    for (const r of ds.rows) {
      const pc = ttxt(r[cPC]);
      if (!pcSet.has(e + '|' + pc)) continue;
      const mat = ttxt(r[cMat]);
      if (!inpErp.has(mat) || inpErp.get(mat) !== e) continue;
      if (!useD.has(mat)) useD.set(mat, new Map());
      const d = useD.get(mat); const pk = pc + '|' + ttxt(r[cProd]);
      const q = isNumeric(r[cQty]) ? num(r[cQty]) : 0;
      if (d.has(pk)) d.get(pk)[3] += q; else d.set(pk, [pc, ttxt(r[cProd]), txt(r[cName]), q]);
    }
  }
  const rows = []; let nUse = 0, nNo = 0;
  const row = (key, erp, pc, prod, pname, qLot, qTot, bLot, bTot, share, note, type) => rows.push({ key, desc: inpDesc.get(key), erp, pc, prod, pname, qLot, qTot, bLot, bTot, share, note, type });
  for (const key of order) {
    const erp = inpErp.get(key); const d = useD.get(key);
    let totQ = 0; if (d) for (const v of d.values()) totQ += v[3];
    if (totQ > 0) {
      nUse++;
      for (const v of d.values()) row(key, erp, v[0], v[1], v[2], v[3], totQ, 0, 0, v[3] / totQ, 'Actual PC-M quantity ratio', 'USAGE');
    } else {
      nNo++;
      const tot = pcpTot[erp] || 0;
      row(key, erp, '', '', '', 0, 0, 0, tot, 0, 'No exact-code PC-M consumption in current period', 'METHOD');
      for (const it of pcp[erp] || []) row(key, erp, it[0], it[1], it[2], 0, 0, it[3], tot, tot !== 0 ? it[3] / tot : 0, 'Fallback: PC amount ratio within same ERP', 'ERP');
    }
  }
  if (!rows.length) throw new Error('No ENGINE rows could be built.');
  return { period, rows, nUse, nNo, rebuiltAt: nowISO() };
}

/** Engine formula columns (A, B, F, G, H, Q:V, X:AB) from current INPUT and CONTROL. */
export function engineDynamic(engine, inputDerived, control) {
  const inp = new Map(); inputDerived.forEach((r) => { if (r.key && !inp.has(r.key)) inp.set(r.key, r); });
  const ctl = new Map(); (control ? control.rows : []).forEach((r) => { const c = k(r.code); if (c && !ctl.has(c)) ctl.set(c, r); });
  return engine.rows.map((e) => {
    const i = inp.get(e.key);
    let active = 'N';
    if (i) {
      const opt = txt(i.option);
      const okOpt = e.type === 'ERP' ? opt === 'ERP_AMOUNT' : e.type === 'METHOD' ? opt !== 'ERP_AMOUNT' : true;
      if (i.check === 'PASS' && i.erp === e.erp && okOpt) active = 'Y';
    }
    const F = i ? num(i.basisQty) : 0, G = i ? num(i.basisAmt) : 0;
    const H = e.type === 'USAGE' ? 'ACTUAL_USAGE' : e.type === 'ERP' ? 'ERP_AMOUNT' : !i ? '' : txt(i.option) === 'DIRECT_632' ? 'DIRECT_632' : 'METHOD REQUIRED';
    const Q = active === 'Y' ? F * e.share : 0, R = active === 'Y' ? G * e.share : 0;
    const S = H === 'DIRECT_632' ? F : 0, T = H === 'DIRECT_632' ? G : 0;
    const U = i ? txt(i.option) : '';
    const V = active !== 'Y' ? '' : e.type === 'METHOD' ? (H === 'METHOD REQUIRED' ? 'METHOD REQUIRED' : 'READY TO REVIEW') : e.type === 'ERP' ? (e.bTot > 0 ? 'READY TO REVIEW' : 'BLOCK - ZERO ERP AMOUNT') : (e.share > 0 ? 'READY TO REVIEW' : 'BLOCK - ZERO SHARE');
    const c = ctl.get(e.key); const X = c ? c.gate : '';
    const Y = active === 'Y' && X === 'READY TO POST' && (H === 'ACTUAL_USAGE' || H === 'ERP_AMOUNT') ? 'Y' : 'N';
    const AB = active !== 'Y' ? '' : X !== 'READY TO POST' ? 'NOT POSTED' : H === 'DIRECT_632' ? 'DIRECT_632 - BATCH5' : Y === 'Y' ? 'POSTED - W4' : 'NOT POSTED';
    return { ...e, active, period: i ? i.period : '', F, G, H, Q, R, S, T, U, V, X, Y, Z: Y === 'Y' ? Q : 0, AA: Y === 'Y' ? R : 0, AB };
  });
}

// ======================= DETAIL / CONTROL =======================
export function buildDetail(engDyn, inputDerived) {
  const ok = new Map();
  inputDerived.forEach((r) => { if (r.key && r.check === 'PASS') ok.set(r.key, r); });
  const out = []; const seen = new Set();
  if (!ok.size) return out;
  for (const e of engDyn) {
    if (e.active === 'Y' && ok.has(e.key)) {
      out.push({ period: e.period, code: e.key, desc: e.desc, erp: e.erp, basisQty: e.F, basisAmt: e.G, method: e.H, pc: e.pc, prod: e.prod, pname: e.pname, qLot: e.qLot, qTot: e.qTot, bLot: e.bLot, bTot: e.bTot, share: e.share, allocQty: e.Q, allocAmt: e.R, dirQty: e.S, dirAmt: e.T, option: e.U, status: e.V, note: e.note });
      seen.add(e.key);
    }
  }
  for (const [key, r] of ok) {
    if (seen.has(key)) continue;
    const m = utxt(r.option);
    const d = { period: r.period, code: key, desc: r.desc, erp: r.erp, basisQty: r.basisQty, basisAmt: r.basisAmt, method: m || 'METHOD REQUIRED', pc: '', prod: '', pname: '', qLot: '', qTot: '', bLot: '', bTot: '', share: '', allocQty: '', allocAmt: '', dirQty: '', dirAmt: '', option: m, status: '', note: '' };
    if (m === 'DIRECT_632') { d.dirQty = r.basisQty; d.dirAmt = r.basisAmt; d.option = 'DIRECT_632'; d.status = 'READY TO REVIEW'; d.note = 'Direct route from INPUT'; }
    else { d.status = 'BLOCK - NO ALLOCATION BASIS'; d.note = 'No active ENGINE detail'; }
    out.push(d);
  }
  return out;
}

/** STEP3B_BuildControl + reviewer snapshot restore + await-apply gates (STEP3B_V21_BUILD). */
export function buildControl(detail, inputDerived, oldControl) {
  const old = new Map();
  for (const r of (oldControl && oldControl.rows) || []) { const c = k(r.code); if (c) old.set(txt(r.period) + '|' + c, r); }
  const ag = new Map();
  for (const d of detail) {
    const key = k(d.code); if (!key) continue;
    const v = ag.get(key) || { n: 0, share: 0, qpc: 0, apc: 0, qdir: 0, adir: 0, blocks: 0, method: '' };
    v.n++; v.share += num(d.share); v.qpc += num(d.allocQty); v.apc += num(d.allocAmt); v.qdir += num(d.dirQty); v.adir += num(d.dirAmt);
    if (utxt(d.status).slice(0, 5) === 'BLOCK') v.blocks++;
    if (utxt(d.method) === 'ACTUAL_USAGE') v.method = 'ACTUAL_USAGE'; else if (!v.method) v.method = utxt(d.method);
    ag.set(key, v);
  }
  const rows = [];
  for (const r of inputDerived) {
    const key = r.key; if (!key) continue;
    const tq = num(r.basisQty), ta = num(r.basisAmt);
    const v = ag.get(key) || { n: 0, share: 0, qpc: 0, apc: 0, qdir: 0, adir: 0, blocks: 0, method: '' };
    let method = v.method || utxt(r.option) || 'METHOD REQUIRED';
    const dq = tq - v.qpc - v.qdir, da = ta - v.apc - v.adir;
    let stat = 'PASS';
    if (utxt(r.check) !== 'PASS') stat = 'BLOCK - INPUT';
    else if (method === 'METHOD REQUIRED') stat = 'BLOCK - METHOD';
    else if (v.blocks > 0) stat = 'BLOCK - DETAIL';
    else if (Math.abs(dq) > TOL_Q) stat = 'BLOCK - QTY RECON';
    else if (Math.abs(da) > TOL_A) stat = 'BLOCK - AMOUNT RECON';
    else if (method !== 'DIRECT_632' && Math.abs(v.share - 1) > 0.000000001) stat = 'BLOCK - SHARE';
    let dec = '', note = '';
    const o = old.get(txt(r.period) + '|' + key);
    if (o && Math.abs(num(o.basisQty) - tq) <= TOL_Q && Math.abs(num(o.basisAmt) - ta) <= TOL_A && utxt(o.method) === method) { dec = txt(o.decision); note = txt(o.note); }
    const D = utxt(dec);
    const gate = stat !== 'PASS' ? stat : D === 'APPROVE' ? 'APPROVED - AWAIT APPLY' : D === 'HOLD' ? 'HOLD' : D === 'REVIEW' ? 'REVIEW' : 'REVIEW REQUIRED';
    rows.push({ active: 'Y', period: r.period, code: key, desc: r.desc, erp: r.erp, basisQty: tq, basisAmt: ta, method, nDetail: v.n, share: v.share, qpc: v.qpc, apc: v.apc, qdir: v.qdir, adir: v.adir, qRouted: v.qpc + v.qdir, aRouted: v.apc + v.adir, dq, da, methodReq: method === 'METHOD REQUIRED' ? 1 : 0, blocks: v.blocks, status: stat, decision: dec, note, gate, wipPostQty: null, wipPostAmt: null, pcPostQty: null, pcPostAmt: null, postCheck: 'NOT POSTED' });
  }
  return { rows, builtAt: nowISO(), appliedAt: oldControl ? oldControl.appliedAt || '' : '', noAdj: oldControl ? oldControl.noAdj || null : null };
}

/** Reviewer edit: keep gate text in sync like the sheet does between BUILD and APPLY. */
export function setDecision(row, decision, note) {
  row.decision = decision; if (note !== undefined) row.note = note;
  if (row.status !== 'PASS') { row.gate = row.status; return row; }
  if (row.gate === 'READY TO POST' || row.gate === 'HOLD' || row.gate === 'REVIEW' || row.gate === 'APPROVED - AWAIT APPLY' || row.gate === 'REVIEW REQUIRED') {
    const D = utxt(decision);
    row.gate = D === 'APPROVE' ? 'APPROVED - AWAIT APPLY' : D === 'HOLD' ? 'HOLD' : D === 'REVIEW' ? 'REVIEW' : 'REVIEW REQUIRED';
    row.wipPostQty = row.wipPostAmt = row.pcPostQty = row.pcPostAmt = null; row.postCheck = 'NOT POSTED';
  }
  return row;
}

const worsens = (erpV, finalV, tol) => Math.abs(finalV) > Math.abs(erpV) + tol;

/** B2_BalancePassCountCore (Control Center check 09). */
export function balancePassCount(control, step3) {
  const wi = new Map(); step3.rows.forEach((m) => wi.set(k(m.code), m));
  let n = 0;
  for (const r of control.rows) {
    if (utxt(r.method) === 'DIRECT_632') { n++; continue; }
    const w = wi.get(k(r.code)); if (!w) continue;
    const fq = w.closingQty - num(r.basisQty), fa = w.closingAmt - num(r.basisAmt);
    if (!worsens(w.closingQty, fq, TOL_Q) && !worsens(w.closingAmt, fa, TOL_A)) n++;
  }
  return n;
}

/** APPLY & SYNC. Returns {mode:'NO_ADJ'|'APPLIED'|'STOPPED', message, ...}. reason required for NO_ADJ. */
export function applyControl(control, step3, reason) {
  const rows = control.rows;
  const nApprove = rows.filter((r) => utxt(r.decision) === 'APPROVE').length;
  if (rows.length && nApprove === 0) {
    if (!ttxt(reason)) return { mode: 'NEED_REASON' };
    let nHold = 0, nReview = 0, nBlank = 0;
    for (const r of rows) {
      let dec = utxt(r.decision);
      if (!dec) { dec = 'HOLD'; r.decision = 'HOLD'; nBlank++; } else if (dec === 'HOLD') nHold++; else nReview++;
      if (!ttxt(r.note)) r.note = 'NO ADJ: ' + reason;
      if (utxt(r.status) === 'PASS') r.gate = dec === 'HOLD' ? 'HOLD' : 'REVIEW';
      r.wipPostQty = r.wipPostAmt = r.pcPostQty = r.pcPostAmt = null; r.postCheck = 'NOT POSTED';
    }
    control.appliedAt = nowISO(); control.noAdj = { at: control.appliedAt, reason };
    return { mode: 'NO_ADJ', nHold: nHold + nBlank, nReview, nBlank };
  }
  const wi = new Map(); step3.rows.forEach((m) => wi.set(k(m.code), m));
  let blocked = 0, unmapped = 0, warn = 0; const toApply = [];
  for (const r of rows) {
    if (utxt(r.decision) !== 'APPROVE') continue;
    const m = utxt(r.method);
    if (utxt(r.status) !== 'PASS' || !m || m === 'METHOD REQUIRED') { blocked++; continue; }
    if (m === 'DIRECT_632') { toApply.push(r); continue; }
    const w = wi.get(k(r.code)); if (!w) { unmapped++; continue; }
    const fq = w.closingQty - num(r.basisQty), fa = w.closingAmt - num(r.basisAmt);
    if (worsens(w.closingQty, fq, TOL_Q) || worsens(w.closingAmt, fa, TOL_A)) warn++;
    toApply.push(r);
  }
  if (blocked || unmapped) return { mode: 'STOPPED', message: `APPLY dừng, chưa post gì. Dòng APPROVE bị BLOCK: ${blocked}; vật tư không có trong WIP: ${unmapped}.` };
  if (warn) return { mode: 'STOPPED', message: `APPLY dừng bởi kiểm tra chiều số dư: ${warn} dòng làm tăng |WIP ERP|. Xem lại INPUT / CONTROL.` };
  let direct632 = 0;
  for (const r of toApply) {
    r.gate = 'READY TO POST';
    if (utxt(r.method) === 'DIRECT_632') { r.wipPostQty = 0; r.wipPostAmt = 0; r.pcPostQty = 0; r.pcPostAmt = 0; r.postCheck = '632 REGISTER READY'; direct632++; }
    else {
      r.wipPostQty = -num(r.basisQty); r.wipPostAmt = -num(r.basisAmt); r.pcPostQty = num(r.qpc); r.pcPostAmt = num(r.apc);
      r.postCheck = Math.abs(r.wipPostQty + r.pcPostQty) <= TOL_Q && Math.abs(r.wipPostAmt + r.pcPostAmt) <= TOL_A ? 'POSTED PASS' : 'POST CHECK';
    }
  }
  control.appliedAt = nowISO(); control.noAdj = null;
  return { mode: 'APPLIED', applied: toApply.length, direct632 };
}

/** B2_Build632 — DIRECT_632 accounting register (record fields kept when the source is unchanged). */
export function build632(control, inputDerived, old632) {
  const old = new Map(); (old632 || []).forEach((r) => old.set(txt(r.period) + '|' + k(r.code), r));
  const src = new Map(); inputDerived.forEach((r) => { if (r.key) src.set(r.key, r); });
  const out = [];
  for (const r of control.rows) {
    if (utxt(r.method) !== 'DIRECT_632' || r.gate !== 'READY TO POST') continue;
    const bq = num(r.basisQty), ba = num(r.basisAmt), dest = ba;
    const row = { active: 'Y', period: r.period, code: r.code, desc: r.desc, erp: r.erp, qty: bq, amt: ba, impact: dest, dr: dest > TOL_A ? '632' : dest < -TOL_A ? '154' : '', cr: dest > TOL_A ? '154' : dest < -TOL_A ? '632' : '', postAmt: Math.abs(dest), qtyHandling: Math.abs(bq) > TOL_Q ? 'ERP QTY CORRECTION REQUIRED' : 'NO QTY IMPACT', reason: src.get(r.code) ? src.get(r.code).reason : '', userNote: src.get(r.code) ? src.get(r.code).note : '', decision: r.decision, revNote: r.note, gate: r.gate };
    row.proposal = Math.abs(dest) <= TOL_A ? 'NO AMOUNT - QTY ONLY' : 'READY FOR ACCOUNTING';
    row.record = row.proposal; row.ref = ''; row.postDate = ''; row.postedBy = '';
    const o = old.get(txt(r.period) + '|' + k(r.code));
    if (o && Math.abs(num(o.qty) - bq) <= TOL_Q && Math.abs(num(o.amt) - ba) <= TOL_A) {
      row.ref = o.ref || ''; row.postDate = o.postDate || ''; row.postedBy = o.postedBy || '';
      if (ttxt(row.ref) && ttxt(row.postedBy)) row.record = 'RECORDED';
      else if (ttxt(row.ref)) row.record = 'PENDING RECORD INFO';
    }
    row.bridge = Math.abs(-ba + dest) <= TOL_A ? 'PASS' : 'CHECK';
    out.push(row);
  }
  return out;
}

// ======================= final layers =======================
/** 03_WIP_ALLOCATION W:AF per material + header bridge (X6, Z6, AB6, AD6, AF6, AD5, AF5). */
export function wipFinal(step3, control, map) {
  const ctl = new Map(); (control ? control.rows : []).forEach((r) => { const c = k(r.code); if (c && !ctl.has(c)) ctl.set(c, r); });
  const mi = mapIndex(map);
  let sumAA = 0, sumAC = 0, sumAD = 0, postCheck = 0, negFinal = 0;
  const rows = step3.rows.map((m) => {
    const c = ctl.get(k(m.code)); const mr = mi.get(k(m.code));
    const ready = c && c.gate === 'READY TO POST';
    const post = ready && utxt(c.method) !== 'DIRECT_632';
    const Z = post ? num(c.wipPostQty) : 0, AA = post ? num(c.wipPostAmt) : 0;
    const AD = c ? num(c.pcPostAmt) : 0;
    const AE = !c ? 'NONE' : ready ? c.method : 'NONE';
    const AF = !c ? 'NO ADJ' : !ready ? 'NOT POSTED' : utxt(c.method) === 'DIRECT_632' ? 'DIRECT_632 - OUTSIDE WIP' : Math.abs(AA + AD) <= TOL_A && Math.abs(Z + num(c.pcPostQty)) <= TOL_Q ? 'POSTED - W4' : 'POST CHECK';
    const AB = m.closingQty + Z, AC = m.closingAmt + AA;
    sumAA += AA; sumAC += AC; sumAD += AD;
    if (AF === 'POST CHECK') postCheck++;
    if (AB < -0.000001) negFinal++;
    return { code: m.code, erp: mr ? (ttxt(mr.override) || mr.erp) : '', erpSource: mr ? (ttxt(mr.override) ? 'USER OVERRIDE' : mr.src) : '', rule: mr ? mr.rule : '', adjQty: Z, adjAmt: AA, finalQty: AB, finalAmt: AC, postedPC: AD, method: AE, status: AF };
  });
  const erpClosing = step3.summary.closingAmt;
  const bridge = sumAC - erpClosing - sumAA;
  return { rows, approvedAdj: sumAA, erpClosing, finalClosing: sumAC, bridge, bridgeStatus: Math.abs(bridge) <= TOL_A ? 'PASS' : 'CHECK', postedPCTotal: sumAD, gateW4: postCheck ? 'CHECK' : 'POST LAYER READY', negFinal };
}

/** Engine posted amounts per (ERP, PC No., Product) → PC-P S:V / 04_PC_SOURCE N. */
export function postedByLot(engDyn) {
  const m = new Map();
  for (const e of engDyn) {
    if (e.Y !== 'Y') continue;
    const key = `${e.erp}|${e.pc}|${e.prod}`;
    const v = m.get(key) || { qty: 0, amt: 0 };
    v.qty += e.Z; v.amt += e.AA; m.set(key, v);
  }
  return m;
}

// ======================= full BUILD convenience =======================
export function runBuild(state, ctx) {
  const { step3, step2, datasets, period } = ctx;
  if (!step3 || step3.period !== period) throw new Error(`03_WIP_ALLOCATION chưa chạy cho kỳ ${period}. Chạy STEP 3A trước.`);
  const mapRes = refreshErpMap(state.erpMap || { rows: [] }, step3, datasets, period);
  const inputD = deriveInput(state.input, mapRes.map, step3, period);
  const engine = rebuildEngine(inputD, step2, datasets, period);
  // BUILD clears reviewer columns before the legacy builder runs, then restores the snapshot.
  const engDyn0 = engineDynamic(engine, inputD, null);
  const detail = buildDetail(engDyn0, inputD);
  const control = buildControl(detail, inputD, state.control);
  // 632 rows that were RECORDED but are no longer approved -> keep only RECORDED rows (B2_ClearUnrecorded632)
  const reg632 = (state.reg632 || []).filter((r) => r.record === 'RECORDED');
  return { erpMap: mapRes.map, engine, detail, control, reg632, mapMsg: mapRes.msg, builtAt: control.builtAt };
}
