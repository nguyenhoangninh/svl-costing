// STEP 1 — Đơn giá thành phẩm theo lô PC (PC-P), hệ T · S · O. Pure: không đọc / ghi store.
// Đơn giá lô = Total Cost ÷ Current Complete Qty. Đơn giá chuẩn = trung vị đơn giá các lô (SL > 0, cost > 0)
// cùng hệ + cùng mã sản phẩm trong kỳ. Bất thường: lệch > MATCOST_DEV và Total Cost ≥ MATCOST_MIN_COST,
// hoặc SL ≤ 0 nhưng có cost, hoặc SL > 0 nhưng Total Cost = 0. Chỉ để rà soát, không chặn STEP 2.
import { headerCol, lastDataEnd, num, ttxt, cellYM, serialToISO, cellDateSerial } from './util.js';
import { MATCOST_DEV, MATCOST_MIN_COST } from './matcost.js';

const median = (xs) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
export const PC_FLAG_REVIEW = 'REVIEW - BẤT THƯỜNG';
export const PC_FLAG_OK = 'OK - BÌNH THƯỜNG';
export const PC_KIND = { DEV: 'Đơn giá lệch so với chuẩn', QTY0: 'SL ≤ 0 nhưng có Total Cost', COST0: 'SL > 0 nhưng Total Cost = 0' };

/** Đọc các lô PC-P của kỳ (một hệ). null nếu thiếu cột bắt buộc. */
function pcpLots(ds, erp, period) {
  const h = ds.header;
  const cPC = headerCol(h, 'PC No.'), cProd = headerCol(h, 'Product Code'), cQty = headerCol(h, 'Current Complete Qty'), cCost = headerCol(h, 'Total Cost');
  if (cPC < 0 || cProd < 0 || cQty < 0 || cCost < 0) return null;
  const cName = headerCol(h, 'Product Name'), cUnit = headerCol(h, 'Unit'), cDate = headerCol(h, 'Date');
  const out = [];
  const end = lastDataEnd(ds.rows, cProd);
  for (let i = 0; i < end; i++) {
    const r = ds.rows[i];
    const prod = ttxt(r[cProd]);
    if (!prod) continue;
    if (cDate >= 0 && cellYM(r[cDate]) !== period) continue;
    const qty = num(r[cQty]), cost = num(r[cCost]);
    if (qty === 0 && cost === 0) continue;
    const date = cDate >= 0 ? cellDateSerial(r[cDate]) : null;
    out.push({ erp, pc: ttxt(r[cPC]), prod, name: cName >= 0 ? ttxt(r[cName]) : '', unit: cUnit >= 0 ? ttxt(r[cUnit]) : '', dateISO: date === null ? '' : serialToISO(date), qty, cost });
  }
  return out;
}

/**
 * Đơn giá lô PC trong kỳ. Trả về { lots (mọi lô, kèm flag), flagged, summary, missing }.
 * opts.dev / opts.minCost: ngưỡng (mặc định như MI-M).
 */
export function pcUnitCosts(datasets, period, opts = {}) {
  const DEV = Number.isFinite(opts.dev) ? opts.dev : MATCOST_DEV;
  const MIN = Number.isFinite(opts.minCost) ? opts.minCost : MATCOST_MIN_COST;
  const all = [], missing = [];
  for (const erp of ['T', 'S', 'O']) {
    const ds = datasets && datasets[`PC-P-${erp}`];
    if (!ds || !ds.header) { missing.push(erp); continue; }
    const lots = pcpLots(ds, erp, period);
    if (!lots) { missing.push(erp); continue; }
    all.push(...lots);
  }
  const groups = new Map();
  for (const l of all) {
    const k = `${l.erp}|${l.prod}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  const lots = [];
  for (const L of groups.values()) {
    const ref = median(L.filter((l) => l.qty > 0 && l.cost > 0).map((l) => l.cost / l.qty));
    for (const l of L) {
      const unitCost = l.qty > 0 && l.cost > 0 ? l.cost / l.qty : null;
      const dev = unitCost !== null && ref > 0 ? unitCost / ref - 1 : null;
      let reason = '', kind = '';
      if (l.qty <= 0 && l.cost > 0) { kind = 'QTY0'; reason = PC_KIND.QTY0; }
      else if (l.qty > 0 && l.cost <= 0) { kind = 'COST0'; reason = PC_KIND.COST0; }
      else if (dev !== null && Math.abs(dev) > DEV && l.cost >= MIN) { kind = 'DEV'; reason = `Đơn giá lệch ${dev > 0 ? '+' : ''}${(dev * 100).toFixed(1)} % so với chuẩn`; }
      lots.push({ ...l, unitCost, ref, dev, kind, reason, flag: reason ? PC_FLAG_REVIEW : PC_FLAG_OK });
    }
  }
  lots.sort((a, b) => a.erp.localeCompare(b.erp) || a.prod.localeCompare(b.prod, 'vi', { numeric: true }) || a.pc.localeCompare(b.pc, 'vi', { numeric: true }));
  const flagged = lots.filter((l) => l.flag === PC_FLAG_REVIEW);
  return {
    lots, flagged,
    summary: { lots: lots.length, flagged: flagged.length, products: groups.size, dev: DEV, minCost: MIN },
    missing,
  };
}
