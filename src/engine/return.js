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

export function processReturnEvent({ sale, candidates, returnedNow, period, sequence, tol = RETURN_TOL }) {
  const prod = utxt(sale && sale.prod), q = -num(sale && sale.qty);
  if (!prod || !(q > tol)) return { ok: false, message: 'Return: Product / return quantity invalid; ' };
  const cand = aggregateOrigins(candidates).filter((o) => o.prod === prod && num(o.date) <= num(sale.date));
  let origin = null;
  if (ttxt(sale.origInv)) {
    origin = cand.find((o) => utxt(o.inv) === utxt(sale.origInv)) || null;
    if (!origin) return { ok: false, message: `Return: Original Invoice ${sale.origInv} not found for product ${prod}; no automatic fallback is allowed; ` };
  } else {
    const same = cand.filter((o) => utxt(o.cust) === utxt(sale.cust));
    if (same.length !== 1) return { ok: false, message: same.length ? 'Return: multiple possible original invoices – enter Original Invoice No.; ' : 'Return: original sale not found – enter Original Invoice No.; ' };
    origin = same[0];
  }
  const k = originKey(origin);
  const already = num(origin.returned) + num(returnedNow && returnedNow.get(k));
  const available = Math.max(0, num(origin.fq) - already);
  if (q > available + tol) return { ok: false, message: `Return qty ${q} exceeds remaining returnable qty ${available} of ${origin.inv}; `, origin, available };
  const f = q / num(origin.fq);
  const salePatch = {
    fq: -q,
    rm: -num(origin.rm) * f,
    c622: -num(origin.c622) * f,
    c627: -num(origin.c627) * f,
    tot: -num(origin.tot) * f,
    matchedOrigInv: origin.inv,
    status: 'RETURNED',
  };
  const lid = `RT-${String(period).replace('-', '')}-${ttxt(sale.inv) || 'NOINV'}-${pad(sequence, 3)}`;
  const layer = {
    lid, src: 'RETURN', sp: period, pc: origin.inv || '', dt: num(sale.date), mo: '', prod, name: ttxt(sale.name), loc: '', unit: '',
    qty: q, rm: -salePatch.rm, a622: -salePatch.c622, a627: -salePatch.c627, tot: -salePatch.tot,
    price: 0, prov: 0, cons: '', flag: `Sales return ${ttxt(sale.inv)}`, oq: 0, orm: 0, o622: 0, o627: 0, otot: 0, i: 900000 + sequence,
  };
  if (returnedNow) returnedNow.set(k, num(returnedNow.get(k)) + q);
  return { ok: true, origin, key: k, qty: q, availableBefore: available, salePatch, layer, lid, amount: layer.tot };
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

export function registerRows(sales) {
  const out = [];
  for (const s of sales || []) {
    if (utxt(s.type) !== 'SALES RETURN') continue;
    out.push({
      seq: s.seq, date: s.date, returnInv: ttxt(s.inv), customer: ttxt(s.cust), product: utxt(s.prod), productName: ttxt(s.name),
      originalInv: ttxt(s.origInv || s.matchedOrigInv), returnQty: Math.abs(num(s.qty)), cogsRM: num(s.rm), cogs622: num(s.c622),
      cogs627: num(s.c627), cogsTotal: num(s.tot), layerId: ttxt(s.returnLid), status: utxt(s.status) === 'RETURNED' ? 'PROCESSED' : 'BLOCK',
      message: ttxt(s.msg),
    });
  }
  return out;
}

export function controls(sales) {
  const rows = registerRows(sales);
  const processed = rows.filter((r) => r.status === 'PROCESSED');
  const blocked = rows.filter((r) => r.status !== 'PROCESSED');
  return {
    rows,
    total: rows.length,
    processed: processed.length,
    blocked: blocked.length,
    qty: processed.reduce((a, r) => a + num(r.returnQty), 0),
    cogsReversal: processed.reduce((a, r) => a + num(r.cogsTotal), 0),
    status: blocked.length ? 'BLOCK' : 'PASS',
  };
}
