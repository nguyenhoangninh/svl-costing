// Product cost trace: drill-down of one product's production cost (STEP 1–4) and cost of goods sold (STEP 5),
// with rule-based anomaly checks. Pure functions over the period state; nothing here changes any result.
import { txt, ttxt, utxt, num, headerColAny } from './util.js';

const ERPS_COST = ['T', 'O']; // Step 3/4 cost scope (ERP S is out of the 154 costing)

/** Anomaly thresholds (shown on screen so a reviewer knows what was tested). */
export const RULES = {
  lotUnitHi: 1.3, lotUnitLo: 0.7,     // lot total unit cost vs product median
  priceDev: 0.10,                     // material unit price vs weighted average of the product
  usageDev: 0.20,                     // material qty per FG unit vs median of the lots
  minImpact: 100000,                  // VND – ignore smaller material deviations
  priorDev: 0.15,                     // unit cost vs previous period
  soShare: 0.05,                      // Stock Out share of RM
  layerSpread: 1.5,                   // max/min unit cost of layers sold
  agingDays: 180,                     // closing layer age
};

const median = (vals) => { const a = vals.filter((v) => isFinite(v)).sort((x, y) => x - y); const n = a.length; if (!n) return null; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const lotKey = (erp, pc, sub, prod) => `${erp}|${utxt(pc)}|${utxt(sub)}|${utxt(prod)}`;

// ---------------------------------------------------------------- indexes (built once per period state)
function col(header, names) { return headerColAny(header, names); }
/** Index ERP material rows (PC-M consumption, MI-M issue, MR-M return) by product code. */
export function buildIndex(datasets) {
  const pcm = new Map(), mi = new Map(), mr = new Map(), pcp = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const e of ERPS_COST) {
    const P = datasets[`PC-M-${e}`];
    if (P) {
      const h = P.header, c = { pc: col(h, ['PC No.']), sub: col(h, ['Sub-MO', 'Sub-MO No.']), mo: col(h, ['MO No.']), prod: col(h, ['Product Code']), mat: col(h, ['Material Code']), name: col(h, ['Material Name']), unit: col(h, ['Unit(Qty)', 'Unit']), qty: col(h, ['Quantity']), amt: col(h, ['Total Cost']), date: col(h, ['Date']) };
      for (const r of P.rows) {
        const prod = utxt(r[c.prod]); if (!prod) continue;
        push(pcm, prod, { erp: e, pc: ttxt(r[c.pc]), sub: c.sub >= 0 ? ttxt(r[c.sub]) : '', mo: c.mo >= 0 ? ttxt(r[c.mo]) : '', mat: ttxt(r[c.mat]), name: c.name >= 0 ? ttxt(r[c.name]) : '', unit: c.unit >= 0 ? ttxt(r[c.unit]) : '', qty: num(r[c.qty]), amt: num(r[c.amt]), date: c.date >= 0 ? r[c.date] : null });
      }
    }
    const M = datasets[`MI-M-${e}`];
    if (M) {
      const h = M.header, c = { doc: col(h, ['MI No.']), prod: col(h, ['Product Code']), mo: col(h, ['MO No.']), mat: col(h, ['Material Code']), name: col(h, ['Material Name']), unit: col(h, ['Unit']), qty: col(h, ['Current Issue Qty', 'Quantity']), amt: col(h, ['Total Cost']), date: col(h, ['Date']) };
      for (const r of M.rows) {
        const prod = utxt(r[c.prod]); if (!prod) continue;
        push(mi, prod, { erp: e, doc: ttxt(r[c.doc]), mo: ttxt(r[c.mo]), mat: ttxt(r[c.mat]), name: c.name >= 0 ? ttxt(r[c.name]) : '', unit: c.unit >= 0 ? ttxt(r[c.unit]) : '', qty: num(r[c.qty]), amt: num(r[c.amt]), date: c.date >= 0 ? r[c.date] : null });
      }
    }
    const R = datasets[`MR-M-${e}`];
    if (R) {
      const h = R.header, c = { doc: col(h, ['Code']), prod: col(h, ['Product Code']), mat: col(h, ['Material Code']), qty: col(h, ['Quantity']), amt: col(h, ['Total Cost']) };
      for (const r of R.rows) { const prod = utxt(r[c.prod]); if (!prod) continue; push(mr, prod, { erp: e, doc: ttxt(r[c.doc]), mat: ttxt(r[c.mat]), qty: Math.abs(num(r[c.qty])), amt: Math.abs(num(r[c.amt])) }); }
    }
  }
  return { pcm, mi, mr, pcp };
}

// ---------------------------------------------------------------- product list
export function productList(ctx) {
  const m = new Map();
  const get = (p, name) => { const k = utxt(p); if (!k) return null; if (!m.has(k)) m.set(k, { prod: k, name: name || '', lots: 0, qty: 0, cost: 0, soldQty: 0, cogs: 0, revenue: 0, closeQ: 0, closeA: 0 }); const o = m.get(k); if (!o.name && name) o.name = name; return o; };
  for (const r of (ctx.fl && ctx.fl.rows) || []) { const o = get(r.prod, ttxt(r.name)); if (!o) continue; o.lots++; o.qty += num(r.qty); o.cost += num(r.totalCost); }
  const res = ctx.res;
  if (res) {
    for (const k of res.summary) { const o = get(k.prod, ttxt(k.name)); if (!o) continue; o.soldQty = num(k.cogsQ); o.cogs = num(k.cogsA); o.closeQ = num(k.closeQ); o.closeA = num(k.closeA); }
    for (const s of res.sales) if (s.fin === 'FIFO COGS') { const o = get(s.prod, s.name); if (o) o.revenue += num(s.vnd); }
  }
  return [...m.values()].sort((a, b) => b.cost + b.cogs - (a.cost + a.cogs));
}

// ---------------------------------------------------------------- production cost trace
/**
 * ctx = { prod, period, fl (Step 4 final layer), index (buildIndex), step2, engDyn, register, lotCheck, prior: {period, qty, rm, a622, a627, tot, source} | null }
 */
export function costTrace(ctx) {
  const P = utxt(ctx.prod); const A = [];
  const flag = (level, area, msg, extra = {}) => A.push({ level, area, msg, ...extra });
  const lotsCA = ((ctx.fl && ctx.fl.rows) || []).filter((r) => utxt(r.prod) === P);
  const pcm = ctx.index.pcm.get(P) || [];
  // PC-M by lot
  const pcmByLot = new Map();
  for (const r of pcm) { const k = lotKey(r.erp, r.pc, r.sub, P); if (!pcmByLot.has(k)) pcmByLot.set(k, []); pcmByLot.get(k).push(r); }
  // lots
  const lots = lotsCA.map((r) => {
    const k = lotKey(r.erp, r.pc, r.sub, P); const mats = pcmByLot.get(k) || [];
    const pcmSum = mats.reduce((a, x) => a + x.amt, 0);
    const q = num(r.qty);
    return { erp: r.erp, pc: r.pc, date: r.date, mo: r.mo, sub: r.sub, name: r.name, qty: q, pcRM: num(r.pcRM), so: num(r.so), wipAdj: num(r.wipAdj), carryIn: num(r.carryIn), totalRM: num(r.totalRM), t622: num(r.t622), t627: num(r.t627), d622: num(r.d622), d627: num(r.d627), totalCost: num(r.totalCost),
      unit: q ? num(r.totalCost) / q : null, rmUnit: q ? num(r.totalRM) / q : null, u622: q ? num(r.t622) / q : null, u627: q ? num(r.t627) / q : null,
      price: num(r.price), priceSrc: r.priceSrc, fx: num(r.fx), salesVND: num(r.salesVND), gpPct: r.salesVND ? (num(r.salesVND) - num(r.totalCost)) / num(r.salesVND) : null, statusText: txt(r.statusText),
      pcmSum, pcmDiff: num(r.pcRM) - pcmSum, nMat: new Set(mats.map((x) => x.mat)).size, flags: [] };
  });
  const T = lots.reduce((a, l) => { for (const f of ['qty', 'pcRM', 'so', 'wipAdj', 'carryIn', 'totalRM', 't622', 't627', 'd622', 'd627', 'totalCost', 'salesVND']) a[f] += l[f]; return a; }, { qty: 0, pcRM: 0, so: 0, wipAdj: 0, carryIn: 0, totalRM: 0, t622: 0, t627: 0, d622: 0, d627: 0, totalCost: 0, salesVND: 0 });
  const unit = (v) => (T.qty ? v / T.qty : null);
  const overview = { prod: P, name: lots[0] ? lots[0].name : '', nLots: lots.length, ...T, unit: unit(T.totalCost), rmUnit: unit(T.totalRM), u622: unit(T.t622), u627: unit(T.t627),
    rmPct: T.totalCost ? T.totalRM / T.totalCost : null, p622: T.totalCost ? T.t622 / T.totalCost : null, p627: T.totalCost ? T.t627 / T.totalCost : null, gpPct: T.salesVND ? (T.salesVND - T.totalCost) / T.salesVND : null,
    price: lots[0] ? lots[0].price : null, priceSrc: lots[0] ? lots[0].priceSrc : '', fx: lots[0] ? lots[0].fx : null, prior: ctx.prior || null };

  // ---- lot checks
  const medUnit = median(lots.filter((l) => l.qty > 0).map((l) => l.unit));
  for (const l of lots) {
    if (lots.length >= 3 && medUnit > 0 && l.unit !== null) {
      const ratio = l.unit / medUnit;
      if (ratio > RULES.lotUnitHi || ratio < RULES.lotUnitLo) { const imp = (l.unit - medUnit) * l.qty; l.flags.push(`Giá thành/đv ${ratio > 1 ? 'cao' : 'thấp'} ${Math.round((ratio - 1) * 100)}% so với trung vị`); flag('REVIEW', 'Lô', `Lô ${l.pc}: giá thành đơn vị ${fmt(l.unit)} = ${pct(ratio - 1)} so với trung vị các lô (${fmt(medUnit)}). Ảnh hưởng ${fmt(imp)} VND.`, { pc: l.pc, impact: imp }); }
    }
    if (Math.abs(l.pcmDiff) > 1) { l.flags.push('PC-P ≠ tổng PC-M'); flag('REVIEW', 'Báo cáo PC', `Lô ${l.pc}: Total Cost trên PC-P (${fmt(l.pcRM)}) khác tổng chi tiết PC-M (${fmt(l.pcmSum)}), chênh ${fmt(l.pcmDiff)} VND.`, { pc: l.pc, impact: l.pcmDiff }); }
    if (!l.nMat && l.pcRM) { l.flags.push('Không có chi tiết PC-M'); flag('REVIEW', 'Báo cáo PC', `Lô ${l.pc}: có giá trị RM ${fmt(l.pcRM)} nhưng không có dòng vật tư nào trên PC-M.`, { pc: l.pc }); }
    if (/NON-POSITIVE/i.test(l.statusText)) { l.flags.push('Không nhận 622/627'); flag('REVIEW', 'Phân bổ 622/627', `Lô ${l.pc}: đóng góp ≤ 0 (doanh thu theo giá bán − RM) nên không nhận 622/627 chung. Kiểm tra giá bán / RM.`, { pc: l.pc }); }
    if (l.gpPct !== null && l.gpPct < 0) { l.flags.push('Giá thành > giá bán'); flag('REVIEW', 'Biên lợi nhuận', `Lô ${l.pc}: giá thành ${fmt(l.unit)} > giá bán quy đổi ${fmt(l.price * l.fx)} VND/đv (GP ${pct(l.gpPct)}).`, { pc: l.pc }); }
    if (l.totalRM && l.so / l.totalRM > RULES.soShare) { l.flags.push('Stock Out lớn'); flag('INFO', 'Stock Out', `Lô ${l.pc}: Stock Out phân bổ ${fmt(l.so)} VND = ${pct(l.so / l.totalRM)} RM của lô.`, { pc: l.pc }); }
    if (Math.abs(l.wipAdj) > 1) { l.flags.push('Có điều chỉnh WIP 3B'); flag('INFO', 'Điều chỉnh WIP', `Lô ${l.pc}: nhận điều chỉnh WIP trực tiếp (3B) ${fmt(l.wipAdj)} VND.`, { pc: l.pc }); }
    if (Math.abs(l.carryIn) > 1) { l.flags.push('Có rework chuyển vào'); flag('INFO', 'Rework', `Lô ${l.pc}: nhận giá trị rework hoàn thành ${fmt(l.carryIn)} VND.`, { pc: l.pc }); }
  }
  for (const r of (ctx.lotCheck && ctx.lotCheck.rows) || []) if (utxt(r.prod) === P) flag('REVIEW', 'Kiểm tra đơn giá RM', `Lô ${r.pc}: đơn giá RM ${fmt(r.unit)} = ${r.ratio.toFixed(2)}× trung vị (${fmt(r.median)}). ${r.flag}. Ảnh hưởng ${fmt(r.impact)} VND.`, { pc: r.pc, impact: r.impact });
  if (overview.price === 0 || overview.price === null) flag('REVIEW', 'Giá bán', 'Không có giá bán trong Price Master – 622/627 không phân bổ được theo đóng góp.');
  else if (overview.priceSrc && !/CURRENT|LATEST/i.test(overview.priceSrc)) flag('INFO', 'Giá bán', `Giá bán dùng để phân bổ lấy từ: ${overview.priceSrc}.`);

  // ---- materials (PC-M consumption vs MI issue / MR return)
  const lotQty = new Map(lots.map((l) => [lotKey(l.erp, l.pc, l.sub, P), l.qty]));
  const mats = new Map();
  const mget = (code, name, unitTxt) => { if (!mats.has(code)) mats.set(code, { mat: code, name, unit: unitTxt, qty: 0, amt: 0, lots: new Map(), miQty: 0, miAmt: 0, mrQty: 0, mrAmt: 0, flags: [] }); const o = mats.get(code); if (!o.name && name) o.name = name; if (!o.unit && unitTxt) o.unit = unitTxt; return o; };
  const matLots = [];
  for (const r of pcm) {
    const k = lotKey(r.erp, r.pc, r.sub, P);
    const o = mget(r.mat, r.name, r.unit); o.qty += r.qty; o.amt += r.amt;
    const lq = lotQty.get(k) || 0;
    const ml = o.lots.get(k) || { erp: r.erp, pc: r.pc, sub: r.sub, date: r.date, lotQty: lq, qty: 0, amt: 0 };
    ml.qty += r.qty; ml.amt += r.amt; o.lots.set(k, ml);
  }
  for (const r of ctx.index.mi.get(P) || []) { const o = mget(r.mat, r.name, r.unit); o.miQty += r.qty; o.miAmt += r.amt; }
  for (const r of ctx.index.mr.get(P) || []) { const o = mget(r.mat, '', ''); o.mrQty += r.qty; o.mrAmt += r.amt; }
  const totalRMpcm = [...mats.values()].reduce((a, o) => a + o.amt, 0);
  const materials = [...mats.values()].map((o) => {
    const avgPrice = o.qty ? o.amt / o.qty : null;
    const ls = [...o.lots.values()].map((ml) => ({ ...ml, price: ml.qty ? ml.amt / ml.qty : null, perFG: ml.lotQty ? ml.qty / ml.lotQty : null }));
    const medUse = median(ls.filter((x) => x.perFG !== null).map((x) => x.perFG));
    const devP = [], devU = []; let zero = 0, neg = 0;
    for (const x of ls) {
      x.flags = [];
      if (ls.length >= 2 && avgPrice && x.price !== null && Math.abs(x.price / avgPrice - 1) > RULES.priceDev) {
        const imp = (x.price - avgPrice) * x.qty;
        if (Math.abs(imp) >= RULES.minImpact) { x.flags.push(`Đơn giá ${pct(x.price / avgPrice - 1)}`); devP.push({ x, imp }); }
      }
      if (ls.length >= 3 && medUse > 0 && x.perFG !== null && Math.abs(x.perFG / medUse - 1) > RULES.usageDev) {
        const imp = (x.perFG - medUse) * x.lotQty * (avgPrice || 0);
        if (Math.abs(imp) >= RULES.minImpact) { x.flags.push(`Định mức ${pct(x.perFG / medUse - 1)}`); devU.push({ x, imp }); }
      }
      if (x.qty < 0 || x.amt < 0) { x.flags.push('SL / giá trị âm'); neg++; }
      else if (x.qty > 0 && x.amt === 0) { x.flags.push('Giá trị 0'); zero++; }
      matLots.push({ mat: o.mat, name: o.name, unit: o.unit, ...x, flagText: x.flags.join(' · ') });
    }
    const absSum = (arr) => arr.reduce((a, d) => a + Math.abs(d.imp), 0);
    if (devP.length) { const lo = Math.min(...ls.map((x) => x.price ?? Infinity)), hi = Math.max(...ls.map((x) => x.price ?? -Infinity)); flag('REVIEW', 'Đơn giá vật tư', `${o.mat} ${o.name}: đơn giá giữa các lô dao động ${fmt(lo, 2)} → ${fmt(hi, 2)} (bình quân ${fmt(avgPrice, 2)}); ${devP.length}/${ls.length} lô lệch > ${Math.round(RULES.priceDev * 100)}%: ${devP.map((d) => d.x.pc).join(', ')}.`, { mat: o.mat, impact: absSum(devP) }); }
    if (devU.length) flag('REVIEW', 'Định mức tiêu hao', `${o.mat} ${o.name}: số lượng/sp lệch > ${Math.round(RULES.usageDev * 100)}% so với trung vị ${fmt(medUse, 4)} ${o.unit}/sp ở ${devU.length} lô: ${devU.map((d) => `${d.x.pc} (${fmt(d.x.perFG, 4)})`).join(', ')}.`, { mat: o.mat, impact: absSum(devU) });
    if (neg) flag('REVIEW', 'Báo cáo PC', `${o.mat} ${o.name}: ${neg} dòng PC-M có số lượng hoặc giá trị âm.`, { mat: o.mat });
    if (zero) flag('INFO', 'Báo cáo PC', `${o.mat} ${o.name}: tiêu hao ${fmt(o.qty, 4)} ${o.unit} nhưng giá trị 0 ở ${zero} lô (vật tư không tính giá / hàng miễn phí?).`, { mat: o.mat });
    const minP = Math.min(...ls.filter((x) => x.price !== null).map((x) => x.price)), maxP = Math.max(...ls.filter((x) => x.price !== null).map((x) => x.price));
    if (o.miQty && !o.qty) flag('INFO', 'Xuất kho', `${o.mat} ${o.name}: đã xuất kho ${fmt(o.miQty, 4)} ${o.unit} (${fmt(o.miAmt)} VND) cho sản phẩm nhưng chưa tiêu hao vào lô nào trong kỳ – nằm lại WIP.`, { mat: o.mat });
    return { mat: o.mat, name: o.name, unit: o.unit, qty: o.qty, amt: o.amt, price: avgPrice, perFG: T.qty ? o.qty / T.qty : null, share: totalRMpcm ? o.amt / totalRMpcm : null, nLots: ls.length,
      minPrice: isFinite(minP) ? minP : null, maxPrice: isFinite(maxP) ? maxP : null, medUse, miQty: o.miQty, miAmt: o.miAmt, mrQty: o.mrQty, mrAmt: o.mrAmt, toWipQty: o.miQty - o.mrQty - o.qty, toWipAmt: o.miAmt - o.mrAmt - o.amt,
      flagText: ls.flatMap((x) => x.flags).length ? `${ls.filter((x) => x.flags.length).length} lô bất thường` : '' };
  }).sort((a, b) => b.amt - a.amt);

  // ---- stock out, 3B adjustments, rework carry-in
  const stockOut = [];
  for (const d of (ctx.step2 && ctx.step2.detail) || []) if (utxt(d[10]) === P && num(d[15])) stockOut.push({ srcERP: d[0], srcKey: d[1], keyType: d[2], fam: d[5], erp: d[6], pc: d[8], mo: d[9], pcRM: num(d[13]), pct: num(d[14]), amt: num(d[15]), status: d[16] });
  const wipAdj = [];
  for (const e of ctx.engDyn || []) if (e.Y === 'Y' && utxt(e.prod) === P) wipAdj.push({ mat: e.key, erp: e.erp, pc: e.pc, qty: num(e.Z), amt: num(e.AA), method: e.type || '' });
  const rework = [];
  for (const r of (ctx.register && ctx.register.rows) || []) if (utxt(r.outFG) === P && num(r.carryIn)) rework.push({ rid: r.rid, pcNo: r.pcNo, status: r.rwStatus, carryIn: num(r.carryIn) });

  // ---- vs prior period
  const pr = ctx.prior;
  if (pr && pr.qty > 0 && T.qty > 0) {
    const pu = pr.tot / pr.qty, cu = T.totalCost / T.qty;
    const d = cu / pu - 1;
    overview.priorUnit = pu; overview.priorChange = d;
    if (Math.abs(d) > RULES.priorDev) {
      const parts = [['RM', T.totalRM / T.qty - pr.rm / pr.qty], ['622', T.t622 / T.qty - pr.a622 / pr.qty], ['627', T.t627 / T.qty - pr.a627 / pr.qty]].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      flag('REVIEW', 'So với kỳ trước', `Giá thành đơn vị ${fmt(cu)} ${d > 0 ? 'tăng' : 'giảm'} ${pct(Math.abs(d))} so với ${pr.period} (${fmt(pu)} – ${pr.source}). Thay đổi chủ yếu do ${parts[0][0]} (${parts[0][1] > 0 ? '+' : ''}${fmt(parts[0][1])}/đv).`);
    }
  }
  const order = { BLOCK: 0, REVIEW: 1, INFO: 2 };
  A.sort((a, b) => order[a.level] - order[b.level] || Math.abs(num(b.impact)) - Math.abs(num(a.impact)));
  return { overview, lots, materials, matLots, stockOut, wipAdj, rework, anomalies: A };
}

/** Unit-cost reference from the previous period: its production layers (web) or this period's opening FG layers. */
export function priorFrom(prod, prevStep5, opening) {
  const P = utxt(prod);
  const sum = (rows) => rows.reduce((a, r) => ({ qty: a.qty + num(r.qty), rm: a.rm + num(r.rm), a622: a.a622 + num(r.a622), a627: a.a627 + num(r.a627), tot: a.tot + num(r.tot) }), { qty: 0, rm: 0, a622: 0, a627: 0, tot: 0 });
  if (prevStep5) {
    const rows = prevStep5.ledger.filter((l) => l.source === 'PRODUCTION' && utxt(l.prod) === P).map((l) => ({ qty: l.qtyIn, rm: l.rm, a622: l.a622, a627: l.a627, tot: l.tot }));
    if (rows.length) return { period: prevStep5.period, source: 'lô sản xuất kỳ trước', ...sum(rows) };
  }
  const op = ((opening && opening.rows) || []).filter((r) => utxt(r.prod) === P && num(r.qty) > 0);
  if (!op.length) return null;
  const latest = op.map((r) => ttxt(r.srcPeriod)).sort().pop();
  const rows = op.filter((r) => ttxt(r.srcPeriod) === latest);
  return { period: latest, source: 'lớp FG đầu kỳ', ...sum(rows) };
}

// ---------------------------------------------------------------- cost of goods sold trace
export function cogsTrace(ctx) {
  const P = utxt(ctx.prod); const res = ctx.res; const A = [];
  const flag = (level, area, msg, extra = {}) => A.push({ level, area, msg, ...extra });
  if (!res) return null;
  const sum = res.summary.find((k) => utxt(k.prod) === P) || null;
  const sales = res.sales.filter((s) => s.prod === P).map((s) => ({ ...s, margin: s.fin === 'FIFO COGS' ? num(s.vnd) - num(s.tot) : null, gm: s.fin === 'FIFO COGS' && num(s.vnd) ? (num(s.vnd) - num(s.tot)) / num(s.vnd) : null }));
  const detail = res.detail.filter((d) => d.prod === P);
  const ledger = res.ledger.filter((l) => utxt(l.prod) === P);
  const closing = res.closing.filter((c) => utxt(c.prod) === P);
  const rwRows = res.rework ? res.rework.rows.filter((r) => utxt(r.fg) === P) : [];
  const rwByLid = new Map(); for (const r of rwRows) rwByLid.set(r.lid, (rwByLid.get(r.lid) || 0) + num(r.qty));
  const soldByLid = new Map(); for (const d of detail) soldByLid.set(d.lid, (soldByLid.get(d.lid) || 0) + num(d.qty));
  const end = ctx.periodEnd || 0;
  const layers = ledger.map((l) => ({ lid: l.lid, source: l.source, srcPeriod: l.srcPeriod, pc: l.pc, date: l.date, qtyIn: num(l.qtyIn), unit: num(l.qtyIn) ? num(l.tot) / num(l.qtyIn) : null, rmUnit: num(l.qtyIn) ? num(l.rm) / num(l.qtyIn) : null, sold: soldByLid.get(l.lid) || 0, rework: rwByLid.get(l.lid) || 0, remQ: num(l.remQ), remTot: num(l.remTot), age: l.date && end ? Math.round(end - l.date) : null, flag: l.flag || '' }));
  const fifo = sales.filter((s) => s.fin === 'FIFO COGS');
  const T = { qty: fifo.reduce((a, s) => a + num(s.fq), 0), rm: fifo.reduce((a, s) => a + num(s.rm), 0), c622: fifo.reduce((a, s) => a + num(s.c622), 0), c627: fifo.reduce((a, s) => a + num(s.c627), 0), tot: fifo.reduce((a, s) => a + num(s.tot), 0), rev: fifo.reduce((a, s) => a + num(s.vnd), 0), revUSD: fifo.reduce((a, s) => a + num(s.usd), 0) };
  const prodLayers = layers.filter((l) => l.source === 'PRODUCTION');
  const prodUnit = prodLayers.reduce((a, l) => a + l.qtyIn, 0) ? prodLayers.reduce((a, l) => a + l.qtyIn * l.unit, 0) / prodLayers.reduce((a, l) => a + l.qtyIn, 0) : null;
  const overview = { prod: P, name: sum ? sum.name : (sales[0] ? sales[0].name : ''), openQ: sum ? num(sum.openQ) : 0, openA: sum ? num(sum.openA) : 0, prodQ: sum ? num(sum.prodQ) : 0, prodA: sum ? num(sum.prodA) : 0,
    cogsQ: T.qty, cogsRM: T.rm, cogs622: T.c622, cogs627: T.c627, cogsA: T.tot, unitCOGS: T.qty ? T.tot / T.qty : null, revenue: T.rev, margin: T.rev - T.tot, gm: T.rev ? (T.rev - T.tot) / T.rev : null,
    rwQ: sum ? num(sum.rwQ) : 0, rwTot: sum ? num(sum.rwTot) : 0, closeQ: sum ? num(sum.closeQ) : 0, closeA: sum ? num(sum.closeA) : 0, closeUnit: sum && num(sum.closeQ) ? num(sum.closeA) / num(sum.closeQ) : null, prodUnit, status: sum ? sum.status : '' };
  // checks
  if (overview.margin < 0) flag('REVIEW', 'Biên lợi nhuận', `Giá vốn ${fmt(T.tot)} > doanh thu ${fmt(T.rev)} VND – lỗ gộp ${fmt(-overview.margin)} (${pct(overview.gm)}).`);
  for (const s of sales) {
    if (s.fin === 'FIFO COGS' && s.margin < 0) flag('REVIEW', 'Dòng bán', `${s.inv} (${s.cust}): giá vốn ${fmt(s.tot)} > doanh thu ${fmt(s.vnd)} VND (lỗ ${fmt(-s.margin)}).`, { inv: s.inv });
    if (s.fin !== 'FIFO COGS') flag(s.fin === 'REVIEW' ? 'REVIEW' : 'INFO', 'Dòng bán', `${s.inv}: ${s.fin}${s.ovr ? ' (override)' : ''} – ${s.msg || 'không tính giá vốn FIFO'}.`, { inv: s.inv });
    if (s.status === 'INSUFFICIENT FG') flag('BLOCK', 'Thiếu FG', `${s.inv}: không đủ tồn kho FG để xuất bán (${s.msg}).`, { inv: s.inv });
  }
  if (prodUnit && overview.unitCOGS && Math.abs(overview.unitCOGS / prodUnit - 1) > 0.2) flag('INFO', 'Lớp FIFO', `Giá vốn đơn vị ${fmt(overview.unitCOGS)} khác giá thành SX kỳ này ${fmt(prodUnit)} (${pct(overview.unitCOGS / prodUnit - 1)}) do xuất bán từ lớp cũ theo FIFO.`);
  const soldUnits = detail.filter((d) => num(d.qty) > 0).map((d) => num(d.unit));
  if (soldUnits.length >= 2) { const mx = Math.max(...soldUnits), mn = Math.min(...soldUnits); if (mn > 0 && mx / mn > RULES.layerSpread) flag('REVIEW', 'Lớp FIFO', `Các lớp đã xuất bán có đơn giá chênh lớn: ${fmt(mn)} → ${fmt(mx)} (${(mx / mn).toFixed(2)}×). Kiểm tra lô có giá thành bất thường.`); }
  for (const c of closing) {
    if (/REVIEW/.test(c.status)) flag('REVIEW', 'NRV', `Lớp ${c.lid}: ${c.msg}`, { lid: c.lid });
    const age = c.date && end ? end - c.date : 0;
    if (age > RULES.agingDays) flag('INFO', 'Tồn lâu', `Lớp ${c.lid} (lô ${c.pc}, ngày ${new Date(Date.UTC(1899, 11, 30) + c.date * 86400000).toISOString().slice(0, 10)}): còn ${fmt(c.qty)} sp sau ${Math.round(age)} ngày.`, { lid: c.lid });
  }
  if (rwRows.length) flag('INFO', 'Rework', `${fmt(rwRows.reduce((a, r) => a + num(r.qty), 0))} sp xuất đi rework theo FIFO, giá trị ${fmt(rwRows.reduce((a, r) => a + num(r.tot), 0))} VND.`);
  const order = { BLOCK: 0, REVIEW: 1, INFO: 2 };
  A.sort((a, b) => order[a.level] - order[b.level]);
  return { overview, sales, detail, layers, closing, rework: rwRows, anomalies: A };
}

// ---------------------------------------------------------------- formatting helpers for messages
function fmt(x, d = 0) { if (x === null || x === undefined || !isFinite(x)) return '–'; return Number(x).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: d }); }
function pct(x) { if (x === null || x === undefined || !isFinite(x)) return '–'; return `${x > 0 ? '+' : ''}${(x * 100).toFixed(1).replace('.', ',')}%`; }
