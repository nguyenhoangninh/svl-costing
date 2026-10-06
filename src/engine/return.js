// STEP 5R — Sales Return engine.
// Physical returns are resolved against the original invoiced COGS, capped by remaining returnable quantity,
// and converted into dated FG layers that can be consumed by later STRICT_DATE sales / rework events.
import { num, ttxt, utxt } from './util.js';

export const RETURN_TOL = 0.000001;

export const originKey = (o, prod) => {
  if (typeof o === 'object' && o) return `${utxt(o.inv)}|${utxt(o.prod)}`;
  return `${utxt(o)}|${utxt(prod)}`;
};

export const isPhysicalReturn = (r) => utxt(r && (r.type ?? r.tranType)) === 'SALES RETURN' && num(r && r.qty) < 0;

export function groupReturnsByProduct(rows) {
  const out = new Map();
  for (const r of rows || []) {
    if (!isPhysicalReturn(r) && utxt(r && r.fin) !== 'RETURN') continue;
    const p = utxt(r.prod ?? r.product);
    if (!out.has(p)) out.set(p, []);
    out.get(p).push(r);
  }
  return out;
}

/** Aggregate multiple sales lines of one invoice + product into one origin with the original cost mix preserved. */
export function aggregateOrigins(rows) {
  const m = new Map();
  for (const x of rows || []) {
    const inv = ttxt(x.inv), prod = utxt(x.prod);
    if (!inv || !prod || !(num(x.fq) > RETURN_TOL)) continue;
    const k = originKey(inv, prod), o = m.get(k);
    if (o) {
      o.fq += num(x.fq); o.rm += num(x.rm); o.c622 += num(x.c622); o.c627 += num(x.c627); o.tot += num(x.tot);
      o.returned = Math.max(num(o.returned), num(x.returned));
      o.date = Math.min(num(o.date) || Number.MAX_SAFE_INTEGER, num(x.date) || Number.MAX_SAFE_INTEGER);
      if (!o.cust && x.cust) o.cust = x.cust;
    } else {
      m.set(k, { inv, cust: ttxt(x.cust), prod, date: num(x.date), fq: num(x.fq), rm: num(x.rm), c622: num(x.c622), c627: num(x.c627), tot: num(x.tot), period: ttxt(x.period), returned: num(x.returned) });
    }
  }
  return [...m.values()];
}

export function mergeOrigin(map, x) {
  const inv = ttxt(x.inv), prod = utxt(x.prod);
  if (!inv || !prod || !(num(x.fq) > RETURN_TOL)) return;
  const k = originKey(inv, prod), o = map.get(k);
  if (o) {
    o.fq += num(x.fq); o.rm += num(x.rm); o.c622 += num(x.c622); o.c627 += num(x.c627); o.tot += num(x.tot);
    o.date = Math.min(num(o.date), num(x.date));
  } else map.set(k, { ...x, inv, prod, fq: num(x.fq), rm: num(x.rm), c622: num(x.c622), c627: num(x.c627), tot: num(x.tot), returned: num(x.returned) });
}

const pad = (n, w) => String(Math.round(n)).padStart(w, '0');

/**
 * Resolve one physical return. Order of evidence:
 *  1. Original Invoice No. (from the user's resolution in STEP 5R, else from the sales file) → that invoice's FIFO cost;
 *  2. no invoice: the only / most recent earlier invoice of the same customer + product that still has returnable qty
 *     (several candidates → AUTO match flagged REVIEW, never a hard stop);
 *  3. manual unit cost entered in STEP 5R (sales made before the web era, or no proven origin).
 * match = { origInv?, unitCost?, note?, by? } from the STEP 5R resolution blob.
 */
export function processReturnEvent({ sale, candidates, returnedNow, period, sequence, tol = RETURN_TOL, match = null }) {
  const prod = utxt(sale && sale.prod), q = -num(sale && sale.qty);
  if (!prod || !(q > tol)) return { ok: false, message: 'Return: Product / return quantity invalid; ' };
  const cand = aggregateOrigins(candidates).filter((o) => o.prod === prod && num(o.date) <= num(sale.date));
  const left = (o) => Math.max(0, num(o.fq) - num(o.returned) - num(returnedNow && returnedNow.get(originKey(o))));
  const wantInv = ttxt(match && match.origInv) || ttxt(sale.origInv);
  const manualUnit = num(match && match.unitCost);
  let origin = null, mode = 'ORIGIN', note = '';
  if (wantInv) {
    origin = cand.find((o) => utxt(o.inv) === utxt(wantInv)) || null;
    if (!origin && !(manualUnit > 0)) return { ok: false, message: `Return: Original Invoice ${wantInv} not found for product ${prod} – chọn hoá đơn khác hoặc nhập đơn giá vốn ở STEP 5R; ` };
    if (origin && q > left(origin) + tol && !(manualUnit > 0)) return { ok: false, message: `Return qty ${q} exceeds remaining returnable qty ${left(origin)} of ${origin.inv}; `, origin, available: left(origin) };
    if (origin && q > left(origin) + tol) origin = null;
  } else if (!(manualUnit > 0)) {
    const same = cand.filter((o) => utxt(o.cust) === utxt(sale.cust) && left(o) >= q - tol).sort((a, b) => num(b.date) - num(a.date));
    if (same.length) { origin = same[0]; if (same.length > 1) { mode = 'AUTO'; note = `auto-matched to the latest of ${same.length} possible invoices`; } }
    else return { ok: false, message: 'Return: no earlier invoice of this customer/product with returnable quantity – chọn hoá đơn gốc hoặc nhập đơn giá vốn ở STEP 5R; ' };
  }
  let unit;
  if (origin) {
    const f = 1 / num(origin.fq);
    unit = { rm: num(origin.rm) * f, c622: num(origin.c622) * f, c627: num(origin.c627) * f, tot: num(origin.tot) * f };
  } else {
    // manual unit cost: split like the product's known FIFO cost mix, else all RM
    const mix = cand.reduce((a, o) => ({ rm: a.rm + num(o.rm), c622: a.c622 + num(o.c622), c627: a.c627 + num(o.c627), tot: a.tot + num(o.tot) }), { rm: 0, c622: 0, c627: 0, tot: 0 });
    const r = mix.tot > 0 ? { rm: mix.rm / mix.tot, c622: mix.c622 / mix.tot, c627: mix.c627 / mix.tot } : { rm: 1, c622: 0, c627: 0 };
    unit = { rm: manualUnit * r.rm, c622: manualUnit * r.c622, c627: manualUnit * r.c627, tot: manualUnit };
    mode = 'MANUAL'; note = `manual unit cost ${manualUnit}${match && match.note ? ' – ' + match.note : ''}`;
  }
  const salePatch = {
    fq: -q, rm: -unit.rm * q, c622: -unit.c622 * q, c627: -unit.c627 * q, tot: -unit.tot * q,
    matchedOrigInv: origin ? origin.inv : '', matchMode: mode, status: 'RETURNED',
  };
  const lid = `RT-${String(period).replace('-', '')}-${ttxt(sale.inv) || 'NOINV'}-${pad(sequence, 3)}`;
  const layer = {
    lid, src: 'RETURN', sp: period, pc: origin ? origin.inv : 'MANUAL', dt: num(sale.date), mo: '', prod, name: ttxt(sale.name), loc: '', unit: '',
    qty: q, rm: -salePatch.rm, a622: -salePatch.c622, a627: -salePatch.c627, tot: -salePatch.tot,
    price: 0, prov: 0, cons: '', flag: `Sales return ${ttxt(sale.inv)}`, oq: 0, orm: 0, o622: 0, o627: 0, otot: 0, i: 900000 + sequence,
  };
  const k = origin ? originKey(origin) : '';
  if (origin && returnedNow) returnedNow.set(k, num(returnedNow.get(k)) + q);
  return { ok: true, origin: origin || { inv: 'MANUAL', period }, key: k, qty: q, availableBefore: origin ? left(origin) + q : null, salePatch, layer, lid, amount: layer.tot, mode, note };
}

export function historyRows(sales, period, costMonth) {
  const out = [];
  for (const s of sales || []) {
    if (utxt(s.fin) !== 'RETURN' || utxt(s.status) !== 'RETURNED' || !(num(s.fq) < -RETURN_TOL)) continue;
    const lid = ttxt(s.returnLid) || `RET-${String(period).replace('-', '')}-${ttxt(s.inv) || s.seq}`;
    out.push({
      pc: ttxt(s.origInv || s.matchedOrigInv || ''), date: s.date, mo: '', prod: ttxt(s.prod), name: ttxt(s.name), loc: '', unit: '',
      qty: num(s.fq), rmSrc: num(s.rm), rmST: 0, tot: num(s.tot), rm: num(s.rm), a622: num(s.c622), a627: num(s.c627),
      price: 0, costMonth, provUSD: 0, pl7: 0, srcPeriod: period, provVND: 0, net: num(s.tot), cons: 0,
      hStatus: 'CURRENT COGS', archive: period, lid, source: 'SALES RETURN REVERSAL',
    });
  }
  return out;
}

export const historyCount = (sales) => (sales || []).filter((s) => utxt(s.fin) === 'RETURN' && utxt(s.status) === 'RETURNED' && num(s.fq) < -RETURN_TOL).length;

export const RETURN_FIELDS = ['seq', 'date', 'returnInv', 'customer', 'product', 'productName', 'originalInv', 'returnQty', 'cogsRM', 'cogs622', 'cogs627', 'cogsTotal', 'layerId', 'status', 'message'];
export const RETURN_HEADERS = ['Seq', 'Return Date', 'Return Invoice', 'Customer', 'Product', 'Product Name', 'Original Invoice', 'Return Qty', 'RM Reversal', '622 Reversal', '627 Reversal', 'COGS Reversal', 'Returned FG Layer', 'Status', 'Message'];

const STATUS_OF = (s) => {
  if (utxt(s.status) === 'RETURNED') return s.matchMode === 'AUTO' ? 'AUTO-MATCHED' : s.matchMode === 'MANUAL' ? 'MANUAL COST' : 'PROCESSED';
  if (utxt(s.fin) === 'NO COGS') return 'NO COGS (override)';
  return 'BLOCK';
};
/** Physical returns of the period (negative qty SALES RETURN). Amount-only credits are revenue reductions, not listed. */
export function registerRows(sales) {
  const out = [];
  for (const s of sales || []) {
    if (!(isPhysicalReturn(s) || utxt(s.fin) === 'RETURN')) continue;
    out.push({
      seq: s.seq, key: s.key, date: s.date, returnInv: ttxt(s.inv), customer: ttxt(s.cust), product: utxt(s.prod), productName: ttxt(s.name),
      originalInv: ttxt(s.matchedOrigInv || s.origInv), returnQty: Math.abs(num(s.qty)), cogsRM: num(s.rm), cogs622: num(s.c622),
      cogs627: num(s.c627), cogsTotal: num(s.tot), layerId: ttxt(s.returnLid), status: STATUS_OF(s), message: ttxt(s.msg),
    });
  }
  return out;
}

export function controls(sales) {
  const rows = registerRows(sales);
  const done = rows.filter((r) => r.status !== 'BLOCK');
  const blocked = rows.filter((r) => r.status === 'BLOCK');
  const review = rows.filter((r) => r.status === 'AUTO-MATCHED' || r.status === 'MANUAL COST');
  return {
    rows,
    total: rows.length,
    processed: done.length,
    blocked: blocked.length,
    review: review.length,
    qty: done.reduce((a, r) => a + num(r.returnQty), 0),
    cogsReversal: done.reduce((a, r) => a + num(r.cogsTotal), 0),
    status: blocked.length ? 'BLOCK' : review.length ? 'REVIEW' : 'PASS',
  };
}
