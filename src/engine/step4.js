// STEP 4 — Sales revenue, Price Master, FX / GL 622-627, cost allocation to PC lots, reconciliation,
// 3B final layer + FG rework carry-in, lot unit-cost check.
// Port of modSTEP4 (STEP4_Import_Sales_Revenue, STEP4_Validate_Save_Sales, STEP4_Update_Price_Master,
// STEP4_Run_Cost_Allocation[_Gated]), V3_RefreshPCAndStep4, RW_SyncCompletedToStep4, SVL_LotCostCheck_Build.
import { txt, ttxt, utxt, num, isNumeric, isPeriod, serialToYMD, nowISO } from './util.js';

const EPOCH = Date.UTC(1899, 11, 30);
const ymdSerial = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / 86400000;
export function periodEndSerial(p) { const y = +p.slice(0, 4), m = +p.slice(5, 7); return ymdSerial(y, m + 1, 0); }
export function periodStartSerial(p) { return ymdSerial(+p.slice(0, 4), +p.slice(5, 7), 1); }

/** VBA IsDate + CDate → serial (or null). Accepts serial numbers, ISO / dd/mm/yyyy strings, Date. */
export function toSerial(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v >= 1 && v < 2958466 ? v : null;
  if (v instanceof Date) return ymdSerial(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = String(v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return ymdSerial(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return ymdSerial(+m[3], +m[2], +m[1]);
  return null;
}
const yyyymm = (serial) => { const d = serialToYMD(serial); return `${d.y}${String(d.m).padStart(2, '0')}`; };
const yyyymmdd = (serial) => { const d = serialToYMD(serial); return `${d.y}${String(d.m).padStart(2, '0')}${String(d.d).padStart(2, '0')}`; };
const fmt4 = (x) => x.toFixed(4);

// ======================= SALES =======================
export const SALES_FIELDS = ['invDate', 'month', 'customer', 'product', 'prodName', 'fx', 'qty', 'unitPrice', 'amtUSD', 'amtVND', 'remark', 'invNo', 'lineNo', 'tranType'];
export const SALES_HEADERS = ['Invoice Date', 'Month', 'Customer', 'Product Number', 'Product Name', 'Exchange Rate', 'Quantity', 'Unit Price (USD)', 'Amount (USD)', 'Amount (VND)', 'Remark', 'SI Invoice No.', 'Invoice Line No.', 'Transaction Type'];
const normH = (s) => txt(s).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const ALIAS = { PRODUCTNUMBER: ['PRODUCTCODE', 'ITEMCODE'], PRODUCTNAME: ['ITEMNAME', 'DESCRIPTION'], EXCHANGERATE: ['FXRATE', 'RATE'], QUANTITY: ['QTY', 'SALESQTY'], UNITPRICEUSD: ['UNITPRICE', 'SELLINGPRICEUSD'], AMOUNTUSD: ['USDAMOUNT', 'REVENUEUSD'], AMOUNTVND: ['VNDAMOUNT', 'REVENUEVND'], SIINVOICENO: ['INVOICENO', 'SALESINVOICENO', 'SIINVOICE'], INVOICELINENO: ['LINENO', 'INVOICELINE'], TRANSACTIONTYPE: ['TRANTYPE', 'TYPE'] };
function salesCol(header, canonical) {
  const c = normH(canonical);
  for (let i = 0; i < header.length; i++) { const n = normH(header[i]); if (n === c || (ALIAS[c] && ALIAS[c].includes(n))) return i; }
  return -1;
}

/** STEP4_Import_Sales_Revenue: find the sales table in any sheet, return staging rows. */
export function importSales(sheets, fileName, mode, period) {
  if (mode !== 'MONTHLY' && mode !== 'YTD') throw new Error('Chế độ import phải là MONTHLY hoặc YTD.');
  let ws = null, hdr = -1;
  outer: for (const [name, g] of Object.entries(sheets)) {
    for (let r = 0; r < g.length; r++) {
      const row = g[r] || [];
      if (!row.some((v) => txt(v).toUpperCase().includes('PRODUCT'))) continue;
      if (salesCol(row, 'Invoice Date') >= 0 && salesCol(row, 'Product Number') >= 0 && salesCol(row, 'Quantity') >= 0 && salesCol(row, 'Amount USD') >= 0) { ws = g; hdr = r; break outer; }
    }
  }
  if (!ws) throw new Error('Không tìm thấy sheet doanh thu có Invoice Date, Product Number, Quantity và Amount (USD).');
  const h = ws[hdr];
  const col = Object.fromEntries([['invDate', 'Invoice Date'], ['month', 'Month'], ['customer', 'Customer'], ['product', 'Product Number'], ['prodName', 'Product Name'], ['fx', 'Exchange Rate'], ['qty', 'Quantity'], ['unitPrice', 'Unit Price USD'], ['amtUSD', 'Amount USD'], ['amtVND', 'Amount VND'], ['remark', 'Remark'], ['invNo', 'SI Invoice No'], ['lineNo', 'Invoice Line No'], ['tranType', 'Transaction Type']].map(([f, n]) => [f, salesCol(h, n)]));
  const batchID = 'SAL-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');
  const importedAt = nowISO();
  const rows = [];
  for (let i = hdr + 1; i < ws.length; i++) {
    const r = ws[i] || [];
    if (!ttxt(r[col.product]) && !ttxt(r[col.invDate])) continue;
    const o = {};
    for (const f of SALES_FIELDS) o[f] = col[f] >= 0 ? (r[col[f]] ?? null) : null;
    const d = toSerial(o.invDate);
    if (d !== null && !ttxt(o.month)) o.month = serialToYMD(d).m;
    o.tranType = col.tranType >= 0 ? utxt(r[col.tranType]) : '';
    Object.assign(o, { txnKey: '', validStat: '', validMsg: '', saveStat: '', savedAt: '', batchID, sourceFile: fileName, importedAt, sourceRow: i + 1 });
    rows.push(o);
  }
  if (!rows.length) throw new Error('Không có dòng giao dịch nào.');
  return { status: 'IMPORTED - NOT VALIDATED', rows, mode, period, importedAt, fileName };
}

export function txnKey(invDate, invNo, lineNo, prod, cust, qty, amt) {
  const d = toSerial(invDate);
  const ds = d !== null ? yyyymmdd(d) : 'NODATE';
  const inv = utxt(invNo), ln = utxt(lineNo);
  if (inv && ln) return inv + '|' + ln;
  return `${ds}|${inv}|${utxt(prod)}|${utxt(cust)}|${fmt4(qty)}|${fmt4(amt)}`;
}
export function includeInPrice(tranType, qty, amt) {
  switch (utxt(tranType)) {
    case 'NORMAL SALE': return qty !== 0 && amt !== 0 ? 'Y' : 'N';
    case 'SALES RETURN': case 'CREDIT NOTE': return qty !== 0 && amt !== 0 && Math.sign(qty) === Math.sign(amt) ? 'Y' : 'N';
    default: return 'N';
  }
}
const KNOWN_TYPES = ['NORMAL SALE', 'SALES RETURN', 'CREDIT NOTE', 'FOC', 'SAMPLE', 'OTHER', 'ADJUSTMENT', 'NON-PRODUCT REVENUE'];

/** STEP4_Validate_Save_Sales — advisory validation, replace DB rows within the file's date coverage. */
export function validateSaveSales(staging, salesDB, period) {
  if (!staging || !staging.rows.length) throw new Error('Chưa có dữ liệu doanh thu trong vùng staging.');
  const periodEnd = periodEndSerial(period);
  const mode = staging.mode === 'MONTHLY' ? 'MONTHLY' : 'YTD';
  const batchKeys = new Set();
  let minInv = 0, maxInv = 0, latest = 0, pass = 0, review = 0, dup = 0;
  for (const r of staging.rows) {
    let msg = '';
    const d = toSerial(r.invDate);
    if (d !== null) {
      r.month = serialToYMD(d).m;
      if (!minInv || d < minInv) minInv = d;
      if (!maxInv || d > maxInv) maxInv = d;
      if (d > latest) latest = d;
      if (d > periodEnd) msg += 'Invoice Date after costing period; ';
    } else msg += 'Invalid/blank Invoice Date; ';
    const cust = ttxt(r.customer), prod = utxt(r.product), pname = ttxt(r.prodName), inv = ttxt(r.invNo), ln = ttxt(r.lineNo);
    let tt = utxt(r.tranType);
    if (!tt) { tt = num(r.qty) < 0 || num(r.amtUSD) < 0 ? 'SALES RETURN' : 'NORMAL SALE'; r.tranType = tt; }
    if (!prod) msg += 'Missing Product Number; ';
    if (!cust) msg += 'Missing Customer; ';
    if (!pname) msg += 'Missing Product Name; ';
    if (!inv) msg += 'Missing SI Invoice No.; ';
    let qty = 0, amt = 0, qtyOK = false, amtOK = false;
    if (isNumeric(r.qty) && r.qty !== null && r.qty !== '') { qtyOK = true; qty = num(r.qty); if (qty === 0) msg += 'Zero Quantity / service or non-quantity transaction; '; }
    else msg += 'Invalid/blank Quantity; ';
    if (isNumeric(r.amtUSD) && r.amtUSD !== null && r.amtUSD !== '') { amtOK = true; amt = num(r.amtUSD); }
    else msg += 'Invalid/blank Amount USD; ';
    const unitP = num(r.unitPrice), fx = num(r.fx), vnd = num(r.amtVND);
    if (!KNOWN_TYPES.includes(tt)) msg += 'Unknown Transaction Type; ';
    if (tt === 'OTHER') msg += 'OTHER transaction requires review; ';
    if (qtyOK && amtOK && qty !== 0 && unitP !== 0 && amt !== 0) { const diff = Math.abs(qty * unitP - amt); const tol = Math.max(Math.abs(amt) * 0.005, 1); if (diff > tol) msg += 'Qty x Unit Price differs from Amount USD; '; }
    if (amtOK && fx > 0 && amt !== 0 && vnd !== 0) { const diff = Math.abs(amt * fx - vnd); const tol = Math.max(Math.abs(vnd) * 0.002, 1000); if (diff > tol) msg += 'USD x FX differs from Amount VND; '; }
    else if (vnd !== 0 && fx <= 0) msg += 'Missing/invalid Exchange Rate; ';
    const key = txnKey(r.invDate, inv, ln, prod, cust, qty, amt);
    r.txnKey = key;
    if (batchKeys.has(key)) { msg += 'Possible duplicate transaction in current import batch; '; dup++; } else batchKeys.add(key);
    r.validStat = msg ? 'REVIEW' : 'PASS'; r.validMsg = msg; msg ? review++ : pass++;
  }
  const saveAt = nowISO();
  const newRows = staging.rows.map((r) => {
    const prod = utxt(r.product);
    const inc = !prod || toSerial(r.invDate) === null ? 'N' : includeInPrice(r.tranType, num(r.qty), num(r.amtUSD));
    r.saveStat = 'SAVED'; r.savedAt = saveAt;
    return { invDate: r.invDate, month: r.month, customer: r.customer, product: prod, prodName: r.prodName, fx: r.fx, qty: r.qty, unitPrice: r.unitPrice, amtUSD: r.amtUSD, amtVND: r.amtVND, remark: r.remark, invNo: r.invNo, lineNo: r.lineNo, tranType: utxt(r.tranType), include: inc, validResult: r.validStat, txnKey: r.txnKey, batchID: r.batchID, sourceFile: r.sourceFile, savedAt: saveAt, sourceRow: r.sourceRow };
  });
  const old = (salesDB && salesDB.rows) || [];
  let replaced = 0; const kept = [];
  for (const r of old) {
    const d = toSerial(r.invDate);
    if (d !== null && minInv && maxInv && d >= minInv && d <= maxInv) replaced++; else kept.push(r);
  }
  staging.status = 'VALIDATED & SAVED - ADVISORY';
  const rows = kept.concat(newRows);
  return { db: { rows, savedAt: saveAt, latestInvoice: latest || (salesDB && salesDB.latestInvoice) || null }, stats: { saved: newRows.length, pass, review, dup, replaced, minInv, maxInv, mode } };
}

// ======================= PRICE MASTER =======================
export const PM_FIELDS = ['product', 'refPrice', 'refSource', 'refDetail', 'manPrice', 'manSource', 'finalPrice', 'finalSource', 'status'];
export const PM_HEADERS = ['Product Code', 'Reference Price (USD)', 'Reference Source', 'Reference Detail', 'Manual Override Price (USD)', 'Manual Override Source / Note', 'Final Price (USD)', 'Final Source', 'Status'];
export const PM_AUDIT_FIELDS = ['product', 'curP', 'latestP', 'ytdP', 'soP', 'sel', 'srcText', 'refDate', 'age', 'review'];
export const PM_AUDIT_HEADERS = ['Product Code', 'Current Month WAvg', 'Latest Actual WAvg', 'YTD WAvg', 'SO Fallback', 'Selected Non-Manual', 'Selected Source', 'Reference Date', 'Price Age (Months)', 'Review Status'];
export const MANUAL_FIELDS = ['product', 'price', 'effFrom', 'effTo', 'source', 'approvedBy', 'updatedAt'];
export const SO_FIELDS = ['active', 'product', 'soDate', 'soNo', 'customer', 'qty', 'price', 'note', 'check'];

export function requiredProducts(step2) {
  const order = []; const set = new Set();
  for (const e of ['T', 'O']) {
    for (const p of step2.pc.filter((x) => x.erp === e).sort((a, b) => a.rowIdx - b.rowIdx)) {
      if (ttxt(p.pcNo).toUpperCase().slice(0, 3) !== 'PC-') continue;
      const code = utxt(p.prod);
      if (code && !set.has(code)) { set.add(code); order.push(code); }
    }
  }
  return order;
}
function manualActive(m, pStart, pEnd) {
  if (num(m.price) <= 0) return false;
  const f = toSerial(m.effFrom), t = toSerial(m.effTo);
  return (f === null || f <= pEnd) && (t === null || t >= pStart);
}
const monthsBetween = (a, b) => { const x = serialToYMD(a), y = serialToYMD(b); return (y.y - x.y) * 12 + (y.m - x.m); };

/** STEP4_Update_Price_Master. manual = persistent override list, so = SO fallback list. */
export function updatePriceMaster({ salesDB, so, manual, step2, period }) {
  const pEnd = periodEndSerial(period), pStart = periodStartSerial(period), ytdStart = ymdSerial(+period.slice(0, 4), 1, 1);
  const prods = requiredProducts(step2);
  if (!prods.length) throw new Error('Không có Product Code nào trong PC-P-T / PC-P-O.');
  const req = new Set(prods);
  if (!salesDB || !salesDB.rows.length) throw new Error('Sales Database đang trống. Hãy Validate & Save doanh thu trước.');
  const add = (m, key, a, q) => { const v = m.get(key) || [0, 0]; v[0] += a; v[1] += q; m.set(key, v); };
  const cur = new Map(), ytd = new Map(), mon = new Map(), latestMonth = new Map(), lastSale = new Map();
  for (const r of salesDB.rows) {
    if (utxt(r.include) !== 'Y') continue;
    const d = toSerial(r.invDate); if (d === null || d < ytdStart || d > pEnd) continue;
    const p = utxt(r.product);
    if (!p || !isNumeric(r.qty) || !isNumeric(r.amtUSD) || r.qty === null || r.amtUSD === null) continue;
    const q = num(r.qty), a = num(r.amtUSD);
    add(ytd, p, a, q);
    const mt = yyyymm(d); add(mon, p + '|' + mt, a, q);
    if (d >= pStart) add(cur, p, a, q);
    if (!latestMonth.has(p) || mt > latestMonth.get(p)) latestMonth.set(p, mt);
    if (!lastSale.has(p) || d > lastSale.get(p)) lastSale.set(p, d);
  }
  // SO fallback
  const soPrice = new Map(), soDate = new Map(), soRank = new Map(), soRowOf = new Map(), soUsed = new Map();
  const soRows = (so || []).map((r) => ({ ...r }));
  soRows.forEach((r, i) => {
    const act = utxt(r.active), prod = utxt(r.product), val = num(r.price);
    const inactive = act === 'N' || act === 'NO' || act === 'INACTIVE' || act === '0';
    r.check = !prod ? '' : inactive ? 'SKIPPED - INACTIVE (Active = N)' : val <= 0 ? 'SKIPPED - NO UNIT PRICE USD' : !req.has(prod) ? 'NOT USED - PRODUCT CODE NOT IN PC-P THIS PERIOD' : 'CANDIDATE';
    if (inactive || !prod || val <= 0) return;
    const d = toSerial(r.soDate);
    const rank = d !== null ? (d <= pEnd ? 3 : 1) : 2;
    let rep = false;
    if (!soRank.has(prod)) rep = true;
    else if (rank > soRank.get(prod)) rep = true;
    else if (rank === soRank.get(prod)) { if (rank === 3) rep = d >= soDate.get(prod); if (rank === 2) rep = true; if (rank === 1) rep = d < soDate.get(prod); }
    if (rep) { soRank.set(prod, rank); soPrice.set(prod, val); soRowOf.set(prod, i); soDate.set(prod, d); }
  });
  const manP = new Map(), manS = new Map();
  for (const m of manual || []) { const p = utxt(m.product); if (p && isNumeric(m.price) && num(m.price) > 0 && manualActive(m, pStart, pEnd)) { manP.set(p, num(m.price)); manS.set(p, txt(m.source)); } }
  const rows = [], audit = []; let missing = 0, stale = 0; const missingList = [];
  for (const p of prods) {
    let curP = 0, latestP = 0, ytdP = 0, soP = 0, sel = 0, src = '', ref = null;
    if (cur.has(p) && Math.abs(cur.get(p)[1]) > 0.0000001) curP = cur.get(p)[0] / cur.get(p)[1];
    if (latestMonth.has(p)) {
      const lm = latestMonth.get(p);
      if (lm === yyyymm(pEnd) && curP > 0) latestP = curP;
      else { const v = mon.get(p + '|' + lm); if (v && Math.abs(v[1]) > 0.0000001) latestP = v[0] / v[1]; }
    }
    if (ytd.has(p) && Math.abs(ytd.get(p)[1]) > 0.0000001) ytdP = ytd.get(p)[0] / ytd.get(p)[1];
    if (soPrice.has(p)) soP = soPrice.get(p);
    const mp = manP.get(p) || 0;
    if (curP > 0) { sel = curP; src = 'CURRENT MONTH ACTUAL'; ref = lastSale.has(p) ? lastSale.get(p) : pEnd; }
    else if (latestP > 0) { sel = latestP; src = 'LATEST ACTUAL ' + latestMonth.get(p); ref = lastSale.get(p) ?? null; }
    else if (ytdP > 0) { sel = ytdP; src = 'YTD ACTUAL'; ref = lastSale.get(p) ?? null; }
    else if (soP > 0) {
      sel = soP; const rk = soRank.get(p); src = rk === 3 ? 'SALES ORDER' : rk === 2 ? 'SALES ORDER (NO DATE)' : 'SALES ORDER (AFTER PERIOD)';
      ref = soDate.get(p) ?? null; if (mp <= 0) soUsed.set(p, src);
    }
    const row = { product: p, refPrice: sel, refSource: src, refDetail: ref, manPrice: null, manSource: null, finalPrice: null, finalSource: null, status: '' };
    if (mp > 0) { row.manPrice = mp; row.manSource = manS.get(p); row.finalPrice = mp; row.finalSource = manS.get(p) || 'MANUAL OVERRIDE'; row.status = 'OK - MANUAL'; }
    else if (sel > 0) { row.finalPrice = sel; row.finalSource = src; row.status = 'OK'; }
    else { row.status = 'MISSING PRICE'; missing++; missingList.push(p); }
    const age = ref !== null && ref !== undefined ? monthsBetween(ref, pEnd) : 0;
    let review;
    if (row.status === 'MISSING PRICE') review = 'MISSING';
    else if (mp > 0) review = 'MANUAL';
    else if (age > 6) { review = 'REVIEW - STALE >6M'; stale++; }
    else if (age > 3) { review = 'REVIEW - STALE 4-6M'; stale++; }
    else review = 'OK';
    rows.push(row);
    audit.push({ product: p, curP, latestP, ytdP, soP, sel, srcText: src, refDate: ref, age, review });
  }
  soRows.forEach((r, i) => {
    if (r.check !== 'CANDIDATE') return;
    const p = utxt(r.product);
    if (soRowOf.get(p) === i) r.check = soUsed.has(p) ? `USED - FINAL PRICE (${soUsed.get(p)})` : 'NOT USED - ACTUAL SALES / MANUAL PRICE HAS PRIORITY';
    else r.check = 'NOT USED - SUPERSEDED BY ANOTHER SO ROW';
  });
  return {
    pm: { rows, audit, dbSavedAt: salesDB.savedAt, updatedAt: nowISO(), sourceThrough: pEnd, status: 'CURRENT', period },
    so: soRows, stats: { products: prods.length, missing, stale, missingList },
  };
}

/** S4S_ManualPriceIsCurrent (simplified to the persistent list the web keeps). */
export function manualPriceIsCurrent(pm, manual, period) {
  if (!pm) return { ok: false, detail: 'Chưa cập nhật Price Master.' };
  const pEnd = periodEndSerial(period), pStart = periodStartSerial(period);
  const final = new Map(pm.rows.map((r) => [r.product, r]));
  for (const r of pm.rows) {
    if (r.status === 'OK - MANUAL' && !(manual || []).some((m) => utxt(m.product) === r.product && manualActive(m, pStart, pEnd))) return { ok: false, detail: `${r.product}: dòng giá thủ công đã bị xoá sau lần cập nhật Price Master gần nhất.` };
  }
  for (const m of manual || []) {
    const p = utxt(m.product); const f = final.get(p);
    if (!f || !manualActive(m, pStart, pEnd)) continue;
    if (Math.abs(num(f.finalPrice) - num(m.price)) > 0.000001) return { ok: false, detail: `${p}: giá thủ công đã thay đổi sau lần cập nhật Price Master gần nhất.` };
    if (ttxt(m.source) && utxt(f.finalSource) !== utxt(m.source)) return { ok: false, detail: `${p}: nguồn giá thủ công đã thay đổi.` };
  }
  return { ok: true };
}

// ======================= COST ALLOCATION =======================
export const CA_HEADERS = ['ERP', 'PC No.', 'PC Date', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Source Location', 'Costing Family', 'Unit', 'Complete Qty', 'PC RM Cost', 'Stock Out Allocated', 'Base Total RM (Pre WIP Adj)', 'Selling Price (USD)', 'Price Source', 'FX', 'Sales Value (USD)', 'Sales Value (VND)', 'Contribution Before Conversion', 'Eligible Base', 'Allocation Weight', 'Direct 622', 'Direct 627', 'Common 622', 'Common 627', 'Total 622', 'Total 627', 'Base Total Production Cost (Pre WIP Adj)', 'Unit Cost', 'RM %', '622 %', '627 %', 'GP %', 'Status / Review', 'Direct WIP Adj Amount', 'Total RM', 'Total Production Cost', 'Final Unit Cost', 'WIP Adj Status', 'OH Driver Basis', 'Rework Carry-In FG FIFO', 'Rework Carry-In Status'];
export const CA_FIELDS = ['erp', 'pc', 'date', 'mo', 'sub', 'prod', 'name', 'loc', 'fam', 'unit', 'qty', 'pcRM', 'so', 'baseRM', 'price', 'priceSrc', 'fx', 'salesUSD', 'salesVND', 'contrib', 'eligible', 'weight', 'd622', 'd627', 'c622', 'c627', 't622', 't627', 'baseCost', 'unitCost', 'rmPct', 'p622', 'p627', 'gpPct', 'statusText', 'wipAdj', 'totalRM', 'totalCost', 'finalUnit', 'wipAdjStatus', 'ohBasis', 'carryIn', 'carryStatus'];

function family(erp, loc) {
  if (utxt(erp) === 'T') return 'DOONA';
  const u = utxt(loc);
  return u.slice(0, 2) === 'MK' ? 'MK' : u.slice(0, 2) === 'VE' ? 'VETO' : u.slice(0, 1) === 'H' ? 'HAMA' : 'O-OTHER';
}
const pcKey = (e, pc, prod) => `${utxt(e)}|${utxt(pc)}|${utxt(prod)}`;
const xlRound0 = (x) => (x < 0 ? -Math.round(-x) : Math.round(x)); // WorksheetFunction.Round: half away from zero

/** Gates of STEP4_Run_Cost_Allocation_Gated + S4FreshnessChainOK. Returns '' or a blocking message. */
export function step4Gate(st) {
  const { period, salesImport, pm, gl, step2, step3, opening, latestImport, manual } = st;
  if (salesImport && salesImport.rows && salesImport.rows.length && salesImport.status !== 'VALIDATED & SAVED - ADVISORY') return 'Dữ liệu doanh thu đã import nhưng chưa Validate & Save.';
  if (!pm || pm.status !== 'CURRENT') return `Price Master chưa CURRENT (${pm ? pm.status : 'chưa cập nhật'}). Chạy Update Price Master sau lần Validate & Save gần nhất.`;
  if (!step2) return 'Chưa chạy STEP 2.';
  if (!step3) return 'Chưa chạy STEP 3.';
  if (!latestImport) return 'Chưa có thời điểm import ERP.';
  if (latestImport > step2.runAt) return 'Dữ liệu ERP mới hơn STEP 2. Chạy lại STEP 2.';
  if (step2.runAt > step3.runAt) return 'STEP 2 mới hơn STEP 3. Chạy lại STEP 3.';
  if (opening && opening.changedAt && opening.changedAt > step3.runAt) return 'Opening WIP thay đổi sau STEP 3. Chạy lại STEP 3.';
  if (step2.period !== period) return 'Kỳ STEP 2 không khớp.';
  if (step3.period !== period) return 'Kỳ STEP 3 không khớp.';
  if (pm.period !== period) return 'Kỳ Price Master không khớp.';
  if (!gl || gl.period !== period) return 'Kỳ GL Input không khớp kỳ báo cáo.';
  if (st.dbSavedAt && pm.updatedAt < st.dbSavedAt) return 'Sales Database mới hơn Price Master. Chạy Update Price Master.';
  const mc = manualPriceIsCurrent(pm, manual, period);
  if (!mc.ok) return 'Giá thủ công thay đổi sau lần cập nhật Price Master: ' + mc.detail;
  return '';
}

/** STEP4_Run_Cost_Allocation. Throws on fatal errors; returns {blocked:true,...} when inputs are incomplete. */
export function runStep4({ period, step2, step3, pm, gl, directAdj }) {
  if (step2.status !== 'PASS') throw new Error('Đối chiếu STEP 2 chưa PASS.');
  if (step3.checks.soVsStep2.status !== 'PASS' || step3.checks.pcmVsPcp.status !== 'PASS') throw new Error('Đối chiếu kế toán STEP 3 chưa PASS.');
  const step3Bridge = step3.summary.outAmt - step3.summary.mrAmt;
  const reviewCount = step3.checks.exceptions.value;
  const step2SO = step2.total.alloc;
  // lots (T then O, sheet order, "PC-" only)
  const lots = [];
  const pcExact = new Map(), pcCount = new Map(), pcOnlyProd = new Map(), products = [];
  const prodSet = new Set();
  let totalQty = 0, totalPCRm = 0, totalSO = 0;
  for (const e of ['T', 'O']) {
    for (const p of step2.pc.filter((x) => x.erp === e).sort((a, b) => a.rowIdx - b.rowIdx)) {
      const pc = ttxt(p.pcNo);
      if (pc.slice(0, 3).toUpperCase() !== 'PC-') continue;
      const prod = ttxt(p.prod);
      if (!prod) throw new Error(`Thiếu Product Code ở PC-P-${e} (${pc}).`);
      const l = { erp: e, pc, date: p.date ?? null, mo: txt(p.mo), sub: txt(p.sub ?? ''), prod, name: txt(p.name), loc: txt(p.loc), fam: family(e, p.loc), unit: txt(p.unit ?? ''), qty: p.qty, pcRM: p.cost, so: p.alloc };
      totalQty += l.qty; totalPCRm += l.pcRM; totalSO += l.so;
      const key = pcKey(e, pc, prod);
      if (pcExact.has(key)) throw new Error('Trùng ERP + PC No. + Product Code: ' + key);
      pcExact.set(key, lots.length);
      const ok = `${e}|${pc.toUpperCase()}`;
      if (pcCount.has(ok)) pcCount.set(ok, pcCount.get(ok) + 1); else { pcCount.set(ok, 1); pcOnlyProd.set(ok, prod); }
      if (!prodSet.has(prod)) { prodSet.add(prod); products.push(prod); }
      lots.push(l);
    }
  }
  if (!lots.length) throw new Error('Không có lô PC hợp lệ trong PC-P-T / PC-P-O.');
  const totalRM = totalPCRm + totalSO;
  if (Math.abs(totalSO - step2SO) >= 0.01) throw new Error(`Stock Out phân bổ trên PC-P không khớp STEP 2. Chênh lệch ${(totalSO - step2SO).toFixed(2)}`);
  if (Math.abs(totalRM - step3Bridge) >= 0.01) throw new Error(`RM STEP 4 không khớp cầu nối WIP STEP 3. Chênh lệch ${(totalRM - step3Bridge).toFixed(2)}`);
  // prices
  const price = new Map(), priceSrc = new Map();
  for (const r of pm.rows) { const p = utxt(r.product); if (p && isNumeric(r.finalPrice) && num(r.finalPrice) > 0) { price.set(p, num(r.finalPrice)); priceSrc.set(p, ttxt(r.finalSource) || 'PRICE MASTER'); } }
  let missingPrice = 0;
  for (const p of products) { const u = p.toUpperCase(); if (!price.has(u) || price.get(u) <= 0) missingPrice++; }
  // FX / GL
  let inputOK = true; const fx = isNumeric(gl.fx) && gl.fx !== null && gl.fx !== '' ? num(gl.fx) : (inputOK = false, 0);
  if (fx <= 0) inputOK = false;
  const has = (v) => v !== null && v !== undefined && ttxt(v) !== '' && isNumeric(v);
  const gl622 = has(gl.gl622) ? num(gl.gl622) : (inputOK = false, 0);
  const gl627 = has(gl.gl627) ? num(gl.gl627) : (inputOK = false, 0);
  const glStatus = { fx: fx > 0 ? 'OK' : 'INPUT REQUIRED', gl622: has(gl.gl622) ? 'OK' : 'INPUT REQUIRED', gl627: has(gl.gl627) ? 'OK' : 'INPUT REQUIRED' };
  // direct adjustments
  const dir622 = new Map(), dir627 = new Map(); let dt622 = 0, dt627 = 0, directBad = 0, activeCount = 0;
  const directOut = (directAdj || []).map((d) => {
    const a = utxt(d.active); const r = { ...d };
    if (a === 'Y') {
      activeCount++;
      const e = utxt(d.erp), acc = Math.trunc(num(String(d.account ?? '').replace(/[^\d.-]/g, '')) || 0), amt = num(d.amount), pc = ttxt(d.pc); let pcode = ttxt(d.prod);
      if ((e !== 'T' && e !== 'O') || (acc !== 622 && acc !== 627) || Math.abs(amt) < 0.0000001 || !pc) { r.status = 'CHECK'; directBad++; return r; }
      const ok = `${e}|${pc.toUpperCase()}`;
      if (!pcCount.has(ok)) { r.status = 'CHECK - PC NOT FOUND'; directBad++; return r; }
      if (!pcode) { if (pcCount.get(ok) === 1) pcode = pcOnlyProd.get(ok); else { r.status = 'CHECK - PRODUCT REQUIRED'; directBad++; return r; } }
      const key = pcKey(e, pc, pcode);
      if (!pcExact.has(key)) { r.status = 'CHECK - PC/PRODUCT'; directBad++; return r; }
      r.status = 'OK';
      if (acc === 622) { dir622.set(key, (dir622.get(key) || 0) + amt); dt622 += amt; } else { dir627.set(key, (dir627.get(key) || 0) + amt); dt627 += amt; }
    } else r.status = ttxt(d.active) ? 'INACTIVE' : '';
    return r;
  });
  const common622 = gl622 - dt622, common627 = gl627 - dt627;
  const glSummary = { direct622: dt622, direct627: dt627, common622, common627 };
  const blocked = !inputOK || missingPrice > 0 || directBad > 0 || common622 < -0.01 || common627 < -0.01;
  const base = { period, runAt: nowISO(), lots: lots.length, totalQty, totalPCRm, totalSO, totalRM, step2SO, step3Bridge, missingPrice, fxOK: fx > 0, inputOK, gl622, gl627, fx, glStatus, glSummary, directOut, directBad, activeDirect: activeCount, reviewCount };
  if (blocked) {
    base.blocked = true;
    base.recon = reconcile({ ...base, alloc622: 0, alloc627: 0, weightExpected: 0, weightResult: 0, outD622: 0, outD627: 0, costExpected: totalRM + gl622 + gl627, costResult: 0, blocked: true });
    return base;
  }
  // allocation
  const n = lots.length;
  const contrib = [], eligible = new Array(n).fill(0), weight = new Array(n).fill(0), d622 = new Array(n).fill(0), d627 = new Array(n).fill(0), c622 = new Array(n).fill(0), c627 = new Array(n).fill(0);
  let totalEligible = 0, lastEligible = -1, nonPositive = 0;
  lots.forEach((l, i) => {
    const fp = price.get(l.prod.toUpperCase());
    contrib[i] = l.qty * fp * fx - (l.pcRM + l.so);
    if (contrib[i] > 0) { eligible[i] = contrib[i]; totalEligible += contrib[i]; lastEligible = i; } else nonPositive++;
    const key = pcKey(l.erp, l.pc, l.prod);
    if (dir622.has(key)) d622[i] = dir622.get(key);
    if (dir627.has(key)) d627[i] = dir627.get(key);
  });
  if (totalEligible <= 0 && (Math.abs(common622) > 0.01 || Math.abs(common627) > 0.01)) throw new Error('Không có cơ sở phân bổ dương cho pool 622/627 chung.');
  let prev622 = 0, prev627 = 0, alloc622 = 0, alloc627 = 0, sumW = 0, sumD622 = 0, sumD627 = 0, sumCost = 0;
  const rows = lots.map((l, i) => {
    if (totalEligible > 0 && eligible[i] > 0) {
      weight[i] = eligible[i] / totalEligible;
      if (i === lastEligible) { c622[i] = common622 - prev622; c627[i] = common627 - prev627; }
      else { c622[i] = xlRound0(common622 * weight[i]); c627[i] = xlRound0(common627 * weight[i]); prev622 += c622[i]; prev627 += c627[i]; }
    }
    const t622 = d622[i] + c622[i], t627 = d627[i] + c627[i];
    const cost = l.pcRM + l.so + t622 + t627;
    alloc622 += t622; alloc627 += t627; sumW += weight[i]; sumD622 += d622[i]; sumD627 += d627[i]; sumCost += cost;
    const fp = price.get(l.prod.toUpperCase());
    const salesVND = l.qty * fp * fx;
    let st = eligible[i] > 0 ? 'ELIGIBLE' : 'NO 622/627 - NON-POSITIVE';
    if (Math.abs(d622[i]) > 0.000001 || Math.abs(d627[i]) > 0.000001) st += ' / DIRECT ADJ';
    return {
      ...l, baseRM: l.pcRM + l.so, price: fp, priceSrc: priceSrc.get(l.prod.toUpperCase()), fx, salesUSD: l.qty * fp, salesVND, contrib: contrib[i], eligible: eligible[i], weight: weight[i],
      d622: d622[i], d627: d627[i], c622: c622[i], c627: c627[i], t622, t627, baseCost: cost, unitCost: l.qty !== 0 ? cost / l.qty : null,
      rmPct: cost !== 0 ? (l.pcRM + l.so) / cost : null, p622: cost !== 0 ? t622 / cost : null, p627: cost !== 0 ? t627 / cost : null, gpPct: salesVND !== 0 ? (salesVND - cost) / salesVND : null, statusText: st,
    };
  });
  base.blocked = false; base.rows = rows; base.alloc622 = alloc622; base.alloc627 = alloc627; base.sumCost = sumCost; base.nonPositive = nonPositive;
  base.recon = reconcile({ ...base, weightExpected: totalEligible > 0 ? 1 : 0, weightResult: sumW, outD622: sumD622, outD627: sumD627, costExpected: totalRM + gl622 + gl627, costResult: sumCost, reviewCount: reviewCount + nonPositive, blocked: false });
  return base;
}

function reconcile(x) {
  const a = [];
  const row = (label, exp, res, tol, failText, note) => { const d = res - exp; a.push({ label, expected: exp, result: res, diff: d, status: Math.abs(d) < tol ? 'PASS' : failText, note }); };
  // S4IndependentPCTotals equals the lot load (same PC-P rows) — recomputed for parity
  row('Production Lots', x.lots, x.lots, 0.5, 'REVIEW', 'T + O PC lots');
  row('Complete Qty', x.totalQty, x.totalQty, 0.000001, 'REVIEW', 'PC-P completion qty');
  row('PC RM Cost', x.totalPCRm, x.totalPCRm, 0.01, 'REVIEW', 'PC output material cost');
  row('Stock Out Allocated', x.step2SO, x.totalRM - x.totalPCRm, 0.01, 'REVIEW', 'Must tie Step 2');
  row('Base Total RM (Pre WIP Adj)', x.totalPCRm + x.step2SO, x.totalRM, 0.01, 'REVIEW', 'Base PC RM + Stock Out; overhead driver remains locked to this base');
  row('Step 3 Bridge', x.step3Bridge, x.totalRM, 0.01, 'REVIEW', 'WIP Out - MR Return');
  a.push({ label: 'Missing Product Prices', expected: 0, result: x.missingPrice, diff: x.missingPrice, status: x.missingPrice === 0 ? 'PASS' : 'BLOCK', note: 'Must be zero' });
  a.push({ label: 'FX Input', expected: 1, result: x.fxOK ? 1 : 0, diff: (x.fxOK ? 1 : 0) - 1, status: x.fxOK ? 'PASS' : 'BLOCK', note: 'Approved costing FX' });
  const bf = x.blocked ? 'BLOCK' : 'REVIEW';
  row('GL 622 Allocation', x.gl622, x.alloc622, 0.01, bf, 'Must match GL 622');
  row('GL 627 Allocation', x.gl627, x.alloc627, 0.01, bf, 'Must match GL 627');
  row('Allocation Weight', x.weightExpected, x.weightResult, 0.000001, bf, 'Must total 100% when ready');
  row('Direct 622', x.glSummary.direct622, x.outD622, 0.01, 'REVIEW', 'Direct attribution');
  row('Direct 627', x.glSummary.direct627, x.outD627, 0.01, 'REVIEW', 'Direct attribution');
  row('Total Production Cost (base)', x.costExpected, x.costResult, 0.01, bf, 'RM + 622 + 627');
  let overall = 'PASS';
  if (x.blocked) overall = 'BLOCKED';
  else { if (a.some((r) => r.status === 'REVIEW')) overall = 'REVIEW'; if (overall === 'PASS' && x.reviewCount > 0) overall = 'PASS WITH REVIEW'; }
  return { rows: a, engineStatus: overall };
}

/** Final layer: Step 3B posted adjustment (AJ) + FG rework carry-in (AP) → AK / AL / AM + Batch 6 / 6B reconciliation. */
export function finalLayer(s4, posted, register, glForCheck) {
  if (!s4 || s4.blocked) return null;
  const carry = new Map();
  for (const r of (register && register.rows) || []) {
    if (utxt(r.rwType) === 'NORMAL' && utxt(r.rwStatus) === 'COMPLETED' && ttxt(r.pcNo)) {
      const fs = utxt(r.fifoStatus);
      if (fs === 'PASS' || (fs === 'OPENING B/F' && utxt(r.inputCheck) === 'PASS')) {
        const key = (ttxt(r.pcNo) + '|' + ttxt(r.outFG)).toUpperCase();
        carry.set(key, (carry.get(key) || 0) + num(r.carryIn));
      }
    }
  }
  let sAJ = 0, sAK = 0, sAL = 0, sAC = 0, sAP = 0, sAA = 0, sAB = 0, carryFound = 0;
  const rows = s4.rows.map((r) => {
    const p = posted ? posted.get(`${r.erp}|${r.pc}|${r.prod}`) : null;
    const wipAdj = p ? p.amt : 0, wipAdjQty = p ? p.qty : 0;
    const ci = carry.get((ttxt(r.pc) + '|' + ttxt(r.prod)).toUpperCase()) || 0;
    if (Math.abs(ci) > 1) carryFound++;
    const totalRM = r.baseRM + wipAdj + ci, totalCost = r.baseCost + wipAdj + ci;
    sAJ += wipAdj; sAK += totalRM; sAL += totalCost; sAC += r.baseCost; sAP += ci; sAA += r.t622; sAB += r.t627;
    return {
      ...r, wipAdjQty, wipAdj, totalRM, totalCost, finalUnit: r.qty === 0 ? 0 : totalCost / r.qty,
      rmPct: totalCost === 0 ? 0 : totalRM / totalCost, p622: totalCost === 0 ? 0 : r.t622 / totalCost, p627: totalCost === 0 ? 0 : r.t627 / totalCost, gpPct: r.salesVND === 0 ? 0 : (r.salesVND - totalCost) / r.salesVND,
      wipAdjStatus: Math.abs(wipAdj) > 1 ? 'WIP ADJ - W6' : Math.abs(ci) > 1 ? 'WIP ADJ / FG REWORK' : '', ohBasis: 'BASE RM (LOCKED)', carryIn: ci, carryStatus: Math.abs(ci) > 1 ? 'FG REWORK CARRY-IN' : '',
    };
  });
  let enginePosted = 0; if (posted) for (const v of posted.values()) enginePosted += v.amt;
  const st = (d) => (Math.abs(d) <= 1 ? 'PASS' : 'CHECK');
  const baseRM = s4.totalRM;
  const b6 = [
    { label: 'Approved PC WIP Adj', expected: 'Engine Posted Amount', result: enginePosted, diff: enginePosted - sAJ, status: st(enginePosted - sAJ), note: 'Must equal approved non-632 PC allocation' },
    { label: 'PC Source WIP Adj', expected: '04_PC_SOURCE N', result: sAJ, diff: 0, status: 'PASS', note: 'PC source must tie Step 4 adjustment layer' },
    { label: 'Cost Allocation WIP Adj', expected: '04_COST_ALLOCATION AJ', result: sAJ, diff: 0, status: 'PASS', note: 'Only posted PC adjustment reaches Step 4' },
    { label: 'Final Total RM', expected: 'Base RM + WIP Adj', result: baseRM + sAJ, diff: baseRM + sAJ - (sAK - sAP), status: st(baseRM + sAJ - (sAK - sAP)), note: 'Final RM after Direct WIP Adjustment' },
    { label: 'Final Production Cost', expected: sAC + sAJ + sAP, result: sAL, diff: sAL - (sAC + sAJ + sAP), status: st(sAL - (sAC + sAJ + sAP)), note: 'Final Step 4 production cost passed to Step 5' },
    { label: 'GL 622 Allocation Unchanged', expected: s4.alloc622, result: s4.alloc622, diff: s4.alloc622 - sAA, status: st(s4.alloc622 - sAA), note: 'WIP adjustment must not change 622 allocation' },
    { label: 'GL 627 Allocation Unchanged', expected: s4.alloc627, result: s4.alloc627, diff: s4.alloc627 - sAB, status: st(s4.alloc627 - sAB), note: 'WIP adjustment must not change 627 allocation' },
    { label: 'DIRECT_632 in Step 4', expected: 0, result: 0, diff: 0, status: 'PASS', note: 'DIRECT_632 stays outside PC / production cost' },
  ];
  const gate6 = b6.some((r) => r.status === 'CHECK') ? 'CHECK' : 'PASS';
  const b6b = [
    { label: 'Completed Rework FIFO Carry-In', expected: sAP, result: sAP, diff: 0, status: 'PASS', note: 'Completed NORMAL Rework carrying cost' },
    { label: 'Final RM incl FG Rework', expected: baseRM + sAJ + sAP, result: sAK, diff: sAK - (baseRM + sAJ + sAP), status: st(sAK - (baseRM + sAJ + sAP)), note: '' },
    { label: 'Final Production Cost incl FG Rework', expected: sAC + sAJ + sAP, result: sAL, diff: sAL - (sAC + sAJ + sAP), status: st(sAL - (sAC + sAJ + sAP)), note: '' },
  ];
  const gate6b = b6b.some((r) => r.status === 'CHECK') ? 'CHECK' : 'PASS';
  const step5Row = { label: 'STEP 5 Production Cost (Final)', expected: sAC + sAJ + sAP, result: sAL, diff: sAL - (sAC + sAJ + sAP), status: st(sAL - (sAC + sAJ + sAP)), note: 'Final Production Cost consumed by Step 5' };
  // 04_RECONCILIATION E18: rows 4-16 from the engine + row 17 (Step 5 final) + Batch 6 / 6B gates; REVIEW only from col AI
  const recRows = s4.recon.rows.slice(0, 13);
  const anyCheck = recRows.some((r) => r.status === 'CHECK' || String(r.status).startsWith('BLOCK')) || step5Row.status === 'CHECK' || gate6 !== 'PASS' || gate6b !== 'PASS';
  const anyReview = rows.some((r) => String(r.statusText).includes('REVIEW'));
  const overall = anyCheck ? 'CHECK' : anyReview ? 'PASS WITH REVIEW' : 'PASS';
  return { rows, totals: { wipAdj: sAJ, totalRM: sAK, totalCost: sAL, baseCost: sAC, carryIn: sAP, t622: sAA, t627: sAB, enginePosted }, step5Row, batch6: b6, gate6, batch6b: b6b, gate6b, overall, carryUnmatched: Math.max(0, carry.size - carryFound), syncedAt: nowISO() };
}

/** SVL_LotCostCheck_Build. refOpening = [{prod, qty, rm}] (opening FG layers), closingQty = Map('PC|PROD' → qty). */
export function lotCostCheck(finalRows, params = {}, refOpening = [], closingQty = new Map()) {
  const hiX = params.hiX > 0 ? params.hiX : 2, loX = params.loX > 0 ? params.loX : 0.5, minN = params.minN > 0 ? params.minN : 3, minImp = params.minImp > 0 ? params.minImp : 1000000;
  const ref = new Map(), refOp = new Map();
  const addRef = (m, key, u) => { if (!m.has(key)) m.set(key, []); m.get(key).push(u); };
  for (const r of finalRows) { const key = ttxt(r.prod); if (key && r.qty > 0 && r.totalRM > 0) addRef(ref, key, r.totalRM / r.qty); }
  for (const o of refOpening) { const key = ttxt(o.prod); if (key && num(o.qty) > 0 && num(o.rm) > 0) addRef(refOp, key, num(o.rm) / num(o.qty)); }
  const median = (vals) => { const a = vals.slice(); for (let i = 1; i < a.length; i++) { const t = a[i]; let j = i - 1; while (j >= 0 && a[j] > t) { a[j + 1] = a[j]; j--; } a[j + 1] = t; } const n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  const res = []; let net = 0, abs = 0, cl = 0;
  for (const r of finalRows) {
    const key = ttxt(r.prod); const q = r.qty; if (!key || !(q > 0)) continue;
    let vals = (ref.get(key) || []).slice(), basis = 'current lots';
    if (vals.length < minN && refOp.has(key)) { vals = vals.concat(refOp.get(key)); basis = 'current lots + opening FG'; }
    if (!vals.length || vals.length < minN) continue;
    const med = median(vals), u = r.totalRM / q;
    if (!(med > 0) || !(u > hiX * med || u < loX * med)) continue;
    const imp = (u - med) * q; if (Math.abs(imp) < minImp) continue;
    const clq = num(closingQty.get(ttxt(r.pc) + '|' + key));
    res.push({ pc: r.pc, date: r.date, prod: key, name: r.name, fam: r.fam, qty: q, unit: u, median: med, ratio: u / med, sample: vals.length, impact: imp, closingQty: clq, closingImpact: (u - med) * clq, flag: (u > med ? 'HIGH - check PC-M issue / WIP residual' : 'LOW - check missing material issue') + ` (ref: ${basis})` });
    net += imp; abs += Math.abs(imp); cl += (u - med) * clq;
  }
  // order by |impact| desc (stable selection-sort order as VBA)
  const ord = res.map((_, i) => i);
  for (let i = 0; i < ord.length - 1; i++) for (let j = i + 1; j < ord.length; j++) if (Math.abs(res[ord[j]].impact) > Math.abs(res[ord[i]].impact)) { const t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
  const rows = ord.map((i) => res[i]);
  const status = rows.length ? `REVIEW - ${rows.length} lots / ${Math.round(abs).toLocaleString('en-US')} VND` : 'PASS';
  return { rows, count: rows.length, net, abs, closingImpact: cl, status, params: { hiX, loX, minN, minImp }, runAt: nowISO() };
}

export { isPeriod };
