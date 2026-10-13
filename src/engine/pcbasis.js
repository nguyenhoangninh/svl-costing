// PC cost basis — align PC-P lot Total Cost to the PC-M material ledger, per (PC No., Product Code).
// Used when PC-M and PC-P were exported from ERP at the same time but the lot cost differs slightly.
// Original cell values are kept so the adjustment can be undone and audited.
import { headerCol, ttxt, num, isNumeric, lastDataEnd, nowISO } from './util.js';

export const PCB_TOL = 0.005; // VND
const kOf = (pc, prod) => ttxt(pc).toUpperCase() + '|' + ttxt(prod).toUpperCase();

function sideMap(ds) {
  const m = new Map();
  if (!ds) return m;
  const h = ds.header;
  const cPC = headerCol(h, 'PC No.'), cV = headerCol(h, 'Total Cost'), cProd = headerCol(h, 'Product Code');
  if (cPC < 0 || cV < 0 || cProd < 0) return m;
  const cName = headerCol(h, 'Product Name'), cLoc = headerCol(h, 'Location'), cMO = headerCol(h, 'MO No.');
  const end = lastDataEnd(ds.rows, cPC);
  for (let i = 0; i < end; i++) {
    const r = ds.rows[i];
    const pc = ttxt(r[cPC]); if (!pc) continue;
    const prod = ttxt(r[cProd]);
    const v = isNumeric(r[cV]) ? num(r[cV]) : 0;
    const k = kOf(pc, prod);
    let o = m.get(k);
    if (!o) { o = { pc, prod, name: cName >= 0 ? ttxt(r[cName]) : '', loc: cLoc >= 0 ? ttxt(r[cLoc]) : '', mo: cMO >= 0 ? ttxt(r[cMO]) : '', cost: 0, rows: [] }; m.set(k, o); }
    o.cost += v; o.rows.push({ i, v, raw: r[cV] });
  }
  return m;
}

/** Compare PC-M with PC-P per (PC No., Product Code). Default systems T and O = same totals as checkpoint 08;
 *  STEP 1 (v1.14.26) also passes S. bySys = totals per system. */
export function pcBasisScan(datasets, systems = ['T', 'O']) {
  const lines = [], onlyPCM = [], onlyPCP = [], bySys = {};
  let pcm = 0, pcp = 0;
  for (const e of systems) {
    const M = sideMap(datasets[`PC-M-${e}`]), P = sideMap(datasets[`PC-P-${e}`]);
    let sm = 0, sp = 0;
    for (const o of M.values()) sm += o.cost;
    for (const o of P.values()) sp += o.cost;
    pcm += sm; pcp += sp; bySys[e] = { pcm: sm, pcp: sp, diff: sm - sp, pcsM: M.size, pcsP: P.size };
    for (const [k, mo] of M) if (!P.has(k)) onlyPCM.push({ erp: e, pcNo: mo.pc, prod: mo.prod, cost: mo.cost });
    for (const [k, po] of P) if (!M.has(k)) onlyPCP.push({ erp: e, pcNo: po.pc, prod: po.prod, cost: po.cost });
    for (const [k, po] of P) {
      const mo = M.get(k); if (!mo) continue;
      const diff = mo.cost - po.cost;
      if (Math.abs(diff) > PCB_TOL) lines.push({ erp: e, pcNo: po.pc, prod: po.prod, name: po.name, loc: po.loc, mo: po.mo, pcp: po.cost, pcm: mo.cost, diff, rows: po.rows });
    }
  }
  return { lines, onlyPCM, onlyPCP, bySys, totals: { pcm, pcp, diff: pcm - pcp }, ok: Math.abs(pcm - pcp) <= PCB_TOL };
}

const cloneDs = (ds, rows) => ({ ...ds, rows });

/** Set PC-P lot cost = PC-M cost for every gap. Refuses when a PC exists on only one side. Returns new datasets + change log. */
export function applyPcBasis(datasets, period) {
  const sc = pcBasisScan(datasets);
  if (sc.onlyPCM.length || sc.onlyPCP.length) {
    throw new Error(`Có ${sc.onlyPCM.length} PC chỉ có ở PC-M và ${sc.onlyPCP.length} PC chỉ có ở PC-P. Không tự điều chỉnh được; kiểm tra lại file ERP.`);
  }
  const out = { ...datasets }, changes = [];
  for (const e of ['T', 'O']) {
    const gaps = sc.lines.filter((g) => g.erp === e);
    if (!gaps.length) continue;
    const ds = datasets[`PC-P-${e}`];
    const cV = headerCol(ds.header, 'Total Cost');
    const rows = ds.rows.slice();
    for (const g of gaps) {
      // several PC-P rows for one (PC, product): split PC-M cost by their current cost; the last row takes the rounding so the sum equals PC-M exactly
      const n = g.rows.length;
      const vals = [];
      let sum = 0;
      for (let j = 0; j < n - 1; j++) {
        const val = Math.round((g.pcp ? g.rows[j].v * g.pcm / g.pcp : 0) * 100) / 100;
        vals.push(val); sum += val;
      }
      vals.push(Math.round((g.pcm - sum) * 100) / 100);
      g.rows.forEach((x, j) => {
        const row = [...rows[x.i]];
        row[cV] = vals[j];
        rows[x.i] = row;
        changes.push({ erp: e, rowIdx: x.i, pcNo: g.pcNo, prod: g.prod, orig: x.raw, adj: vals[j] });
      });
    }
    out[`PC-P-${e}`] = cloneDs(ds, rows);
  }
  const after = pcBasisScan(out);
  return { datasets: out, changes, before: sc.totals, after: after.totals, ok: after.ok, period, appliedAt: nowISO() };
}

/** Restore original cell values. Refuses if the PC-P rows no longer match the logged PC No. / Product Code. */
export function undoPcBasis(datasets, changes) {
  const out = { ...datasets };
  const byErp = {};
  for (const c of changes || []) (byErp[c.erp] ||= []).push(c);
  for (const [e, list] of Object.entries(byErp)) {
    const ds = datasets[`PC-P-${e}`];
    if (!ds) throw new Error(`Thiếu PC-P-${e} để hoàn tác.`);
    const cV = headerCol(ds.header, 'Total Cost'), cPC = headerCol(ds.header, 'PC No.'), cProd = headerCol(ds.header, 'Product Code');
    const rows = ds.rows.slice();
    for (const c of list) {
      const r = rows[c.rowIdx];
      if (!r || ttxt(r[cPC]) !== c.pcNo || ttxt(r[cProd]) !== c.prod) throw new Error(`PC-P đã thay đổi sau khi điều chỉnh (${c.pcNo}). Không hoàn tác tự động.`);
      const row = [...r]; row[cV] = c.orig; rows[c.rowIdx] = row;
    }
    out[`PC-P-${e}`] = cloneDs(ds, rows);
  }
  return out;
}

/** True when every logged adjustment is still in place (PC-P not re-imported since). */
export function pcBasisIntact(datasets, changes) {
  for (const c of changes || []) {
    const ds = datasets[`PC-P-${c.erp}`]; if (!ds) return false;
    const cV = headerCol(ds.header, 'Total Cost'), cPC = headerCol(ds.header, 'PC No.'), cProd = headerCol(ds.header, 'Product Code');
    const r = ds.rows[c.rowIdx];
    if (!r || ttxt(r[cPC]) !== c.pcNo || ttxt(r[cProd]) !== c.prod || Math.abs(num(r[cV]) - c.adj) > 0.001) return false;
  }
  return true;
}
