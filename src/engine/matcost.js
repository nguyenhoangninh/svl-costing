// STEP 1 — Đơn giá xuất nguyên liệu từ MI-M (phiếu xuất NVL cho lệnh SX), hệ T · S · O.
// Pure: không đọc / ghi store. Đơn giá dòng = Total Cost / Current Issue Qty (dòng SL > 0);
// đơn giá bình quân = Σ Total Cost / Σ SL trên các dòng có cost (theo hệ + mã VT + ĐVT).
// Dòng bất thường: thành tiền ≥ MATCOST_MIN_COST và lệch > MATCOST_DEV so với đơn giá chuẩn = trung vị các đơn giá dòng
// (trung vị không bị kéo lệch bởi chính dòng bất thường, nên không gắn cờ oan các dòng bình thường).
import { headerCol, lastDataEnd, num, ttxt, cellYM, serialToISO, cellDateSerial } from './util.js';

export const MATCOST_DEV = 0.3;          // ngưỡng lệch 30 %
export const MATCOST_MIN_COST = 1000000; // chỉ xét dòng có thành tiền ≥ 1.000.000 VND (tránh nhiễu từ dòng nhỏ)

const median = (xs) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };

/** Đọc các dòng MI-M có SL > 0 trong kỳ của một hệ. */
function miLines(ds, erp, period) {
  const h = ds.header;
  const cCode = headerCol(h, 'Material Code'), cQty = headerCol(h, 'Current Issue Qty'), cCost = headerCol(h, 'Total Cost');
  if (cCode < 0 || cQty < 0 || cCost < 0) return null;
  const cName = headerCol(h, 'Material Name'), cUnit = headerCol(h, 'Unit'), cDate = headerCol(h, 'Date');
  const cMI = headerCol(h, 'MI No.'), cMO = headerCol(h, 'MO No.'), cProd = headerCol(h, 'Product Code'), cLot = headerCol(h, 'Lot Number');
  const out = [];
  const end = lastDataEnd(ds.rows, cCode);
  for (let i = 0; i < end; i++) {
    const r = ds.rows[i];
    const code = ttxt(r[cCode]);
    if (!code) continue;
    const qty = num(r[cQty]);
    if (qty === 0) continue;
    const date = cDate >= 0 ? cellDateSerial(r[cDate]) : null;
    if (cDate >= 0 && cellYM(r[cDate]) !== period) continue;
    out.push({
      erp, mi: cMI >= 0 ? ttxt(r[cMI]) : '', date, dateISO: date === null ? '' : serialToISO(date),
      mo: cMO >= 0 ? ttxt(r[cMO]) : '', prod: cProd >= 0 ? ttxt(r[cProd]) : '', code,
      name: cName >= 0 ? ttxt(r[cName]) : '', unit: cUnit >= 0 ? ttxt(r[cUnit]) : '', lot: cLot >= 0 ? ttxt(r[cLot]) : '',
      qty, cost: num(r[cCost]),
    });
  }
  return out;
}

/**
 * Đơn giá xuất NVL trong kỳ và danh sách vật tư / dòng biến động bất thường.
 * Trả về { materials, lines, summary, missing } — materials sắp theo mức độ bất thường.
 */
export function materialIssueCosts(datasets, period) {
  const all = []; const missing = [];
  for (const erp of ['T', 'S', 'O']) {
    const ds = datasets && datasets[`MI-M-${erp}`];
    if (!ds || !ds.header) { missing.push(erp); continue; }
    const lines = miLines(ds, erp, period);
    if (!lines) { missing.push(erp); continue; }
    all.push(...lines);
  }
  // đơn giá bình quân chỉ từ dòng có cost (dòng cost = 0 được báo riêng là thiếu cost)
  const groups = new Map();
  for (const l of all) {
    const k = `${l.erp}|${l.code}|${l.unit}`;
    let g = groups.get(k);
    if (!g) { g = { erp: l.erp, code: l.code, name: l.name, unit: l.unit, lines: [], costed: [] }; groups.set(k, g); }
    g.lines.push(l);
    if (l.qty > 0 && l.cost > 0) g.costed.push(l);
  }
  const materials = [], flaggedLines = [];
  for (const g of groups.values()) {
    const qtyAll = g.lines.reduce((a, l) => a + l.qty, 0), costAll = g.lines.reduce((a, l) => a + l.cost, 0);
    const cQty = g.costed.reduce((a, l) => a + l.qty, 0), cCost = g.costed.reduce((a, l) => a + l.cost, 0);
    const bq = cQty > 0 ? cCost / cQty : 0;
    const nZero = g.lines.filter((l) => l.qty > 0 && l.cost === 0).length;
    const nNeg = g.lines.filter((l) => l.qty < 0).length;
    const unit = g.costed.map((l) => l.cost / l.qty);
    const ref = median(unit); // đơn giá chuẩn để so lệch
    let nDev = 0, maxDev = 0;
    for (const l of g.costed) {
      const u = l.cost / l.qty, dev = ref > 0 ? u / ref - 1 : 0;
      if (l.cost >= MATCOST_MIN_COST && Math.abs(dev) > MATCOST_DEV) {
        nDev++;
        if (Math.abs(dev) > Math.abs(maxDev)) maxDev = dev;
        flaggedLines.push({ ...l, unitCost: u, bq, ref, dev, flag: 'REVIEW - BẤT THƯỜNG' });
      }
    }
    const flag = nDev > 0 ? 'REVIEW - BẤT THƯỜNG' : nZero > 0 ? 'REVIEW - THIẾU COST' : 'PASS';
    materials.push({
      erp: g.erp, code: g.code, name: g.name, unit: g.unit, nLines: g.lines.length, qty: qtyAll, cost: costAll,
      bq, ref, uMin: unit.length ? Math.min(...unit) : 0, uMax: unit.length ? Math.max(...unit) : 0,
      nDev, maxDev, nZero, nNeg, flag,
    });
  }
  const rank = { 'REVIEW - BẤT THƯỜNG': 0, 'REVIEW - THIẾU COST': 1, 'PASS': 2 };
  materials.sort((a, b) => rank[a.flag] - rank[b.flag] || Math.abs(b.maxDev) - Math.abs(a.maxDev) || b.cost - a.cost || a.code.localeCompare(b.code));
  // dòng lệch: lệch lớn nhất trước
  flaggedLines.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
  const summary = {
    materials: materials.length, flagged: materials.filter((m) => m.flag === 'REVIEW - BẤT THƯỜNG').length,
    missingCost: materials.filter((m) => m.flag === 'REVIEW - THIẾU COST').length,
    flaggedLines: flaggedLines.length, zeroCostLines: materials.reduce((a, m) => a + m.nZero, 0),
    lines: all.length, dev: MATCOST_DEV, minCost: MATCOST_MIN_COST,
  };
  return { materials, lines: flaggedLines, summary, missing };
}
