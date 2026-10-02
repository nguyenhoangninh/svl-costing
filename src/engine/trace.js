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
  const pcmByPc = new Map(), miByMo = new Map(), pcmERP = new Set();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const e of ERPS_COST) {
    const P = datasets[`PC-M-${e}`];
    if (P) {
      const h = P.header, c = { pc: col(h, ['PC No.']), sub: col(h, ['Sub-MO', 'Sub-MO No.']), mo: col(h, ['MO No.']), prod: col(h, ['Product Code']), mat: col(h, ['Material Code']), name: col(h, ['Material Name']), unit: col(h, ['Unit(Qty)', 'Unit']), qty: col(h, ['Quantity']), amt: col(h, ['Total Cost']), date: col(h, ['Date']) };
      for (const r of P.rows) {
        // Rows are keyed by PC No. (same basis as the STEP 3 PC-M ↔ PC-P tie); Product Code / Sub-MO are only used to split a PC shared by several lots.
        const pc = c.pc >= 0 ? ttxt(r[c.pc]) : ''; if (!pc) continue;
        const prod = c.prod >= 0 ? utxt(r[c.prod]) : '';
        const o = { erp: e, pc, prod, sub: c.sub >= 0 ? ttxt(r[c.sub]) : '', mo: c.mo >= 0 ? ttxt(r[c.mo]) : '', mat: ttxt(r[c.mat]), name: c.name >= 0 ? ttxt(r[c.name]) : '', unit: c.unit >= 0 ? ttxt(r[c.unit]) : '', qty: num(r[c.qty]), amt: num(r[c.amt]), date: c.date >= 0 ? r[c.date] : null };
        pcmERP.add(e); push(pcmByPc, `${e}|${utxt(pc)}`, o); if (prod) push(pcm, prod, o);
      }
    }
    const M = datasets[`MI-M-${e}`];
    if (M) {
      const h = M.header, c = { doc: col(h, ['MI No.']), prod: col(h, ['Product Code']), mo: col(h, ['MO No.']), mat: col(h, ['Material Code']), name: col(h, ['Material Name']), unit: col(h, ['Unit']), qty: col(h, ['Current Issue Qty', 'Quantity']), amt: col(h, ['Total Cost']), date: col(h, ['Date']) };
      for (const r of M.rows) {
        const prod = c.prod >= 0 ? utxt(r[c.prod]) : ''; const mo = c.mo >= 0 ? ttxt(r[c.mo]) : '';
        if (!prod && !mo) continue;
        const o = { erp: e, doc: ttxt(r[c.doc]), mo, prod, mat: ttxt(r[c.mat]), name: c.name >= 0 ? ttxt(r[c.name]) : '', unit: c.unit >= 0 ? ttxt(r[c.unit]) : '', qty: num(r[c.qty]), amt: num(r[c.amt]), date: c.date >= 0 ? r[c.date] : null };
        if (prod) push(mi, prod, o); if (mo) push(miByMo, `${e}|${utxt(mo)}`, o);
      }
    }
    const R = datasets[`MR-M-${e}`];
    if (R) {
      const h = R.header, c = { doc: col(h, ['Code']), prod: col(h, ['Product Code']), mat: col(h, ['Material Code']), qty: col(h, ['Quantity']), amt: col(h, ['Total Cost']) };
      for (const r of R.rows) { const prod = utxt(r[c.prod]); if (!prod) continue; push(mr, prod, { erp: e, doc: ttxt(r[c.doc]), mat: ttxt(r[c.mat]), qty: Math.abs(num(r[c.qty])), amt: Math.abs(num(r[c.amt])) }); }
    }
  }
  return { pcm, mi, mr, pcp, pcmByPc, miByMo, pcmERP };
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
  // PC-M rows → lots. Primary key ERP + PC No.; when one PC holds several lots, split by Product Code, then Sub-MO.
  const idx = ctx.index;
  const lotsPerPc = new Map();
  for (const r of (ctx.fl && ctx.fl.rows) || []) { const k = `${r.erp}|${utxt(r.pc)}`; lotsPerPc.set(k, (lotsPerPc.get(k) || 0) + 1); }
  const pcmByLot = new Map(); let looseLots = 0;
  for (const r of lotsCA) {
    const k = lotKey(r.erp, r.pc, r.sub, P);
    let rows = (idx.pcmByPc && idx.pcmByPc.get(`${r.erp}|${utxt(r.pc)}`)) || [];
    if ((lotsPerPc.get(`${r.erp}|${utxt(r.pc)}`) || 0) > 1) {
      rows = rows.filter((x) => x.prod === P);
      const bySub = rows.filter((x) => utxt(x.sub) === utxt(r.sub));
      if (bySub.length && bySub.length < rows.length) rows = bySub;
    }
    if (rows.some((x) => x.prod !== P || utxt(x.sub) !== utxt(r.sub))) looseLots++;
    pcmByLot.set(k, rows);
  }
  const pcm = [...pcmByLot.entries()].flatMap(([k, rows]) => rows.map((x) => ({ ...x, lotK: k })));
  const pcmMissing = [...new Set(lotsCA.map((r) => r.erp))].filter((e) => idx.pcmERP && !idx.pcmERP.has(e));
  // lots
  const lots = lotsCA.map((r) => {
    const k = lotKey(r.erp, r.pc, r.sub, P); const mats = pcmByLot.get(k) || [];
    const pcmSum = mats.reduce((a, x) => a + x.amt, 0);
    const q = num(r.qty);
    return { key: k, erp: r.erp, pc: r.pc, date: r.date, mo: r.mo, sub: r.sub, name: r.name, qty: q, pcRM: num(r.pcRM), so: num(r.so), wipAdj: num(r.wipAdj), carryIn: num(r.carryIn), totalRM: num(r.totalRM), t622: num(r.t622), t627: num(r.t627), d622: num(r.d622), d627: num(r.d627), totalCost: num(r.totalCost),
      unit: q ? num(r.totalCost) / q : null, rmUnit: q ? num(r.totalRM) / q : null, u622: q ? num(r.t622) / q : null, u627: q ? num(r.t627) / q : null,
      price: num(r.price), priceSrc: r.priceSrc, fx: num(r.fx), salesVND: num(r.salesVND), gpPct: r.salesVND ? (num(r.salesVND) - num(r.totalCost)) / num(r.salesVND) : null, statusText: txt(r.statusText),
      pcmSum, pcmDiff: pcmMissing.includes(r.erp) ? 0 : num(r.pcRM) - pcmSum, nMat: new Set(mats.map((x) => x.mat)).size, flags: [] };
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
      if (ratio > RULES.lotUnitHi || ratio < RULES.lotUnitLo) { const imp = (l.unit - medUnit) * l.qty; l.flags.push(`Giá thành/đv ${ratio > 1 ? 'cao' : 'thấp'} ${Math.round((ratio - 1) * 100)}% so với trung vị`); flag('REVIEW', 'Lô', `Lô ${l.pc}: giá thành đơn vị ${fmt(l.unit)} = ${pct(ratio - 1)} so với trung vị các lô (${fmt(medUnit)}). Ảnh hưởng ${fmt(imp)} VND.`, { kind: 'lot', lk: l.key, pc: l.pc, impact: imp }); }
    }
    if (pcmMissing.includes(l.erp)) { /* reported once below */ }
    else if (!l.nMat && l.pcRM) { l.flags.push('Không có chi tiết PC-M'); flag('REVIEW', 'Báo cáo PC', `Lô ${l.pc}: PC-P có NVL ${fmt(l.pcRM)} nhưng PC-M-${l.erp} không có dòng nào cùng PC No.`, { kind: 'lot', lk: l.key, pc: l.pc, impact: l.pcRM }); }
    else if (Math.abs(l.pcmDiff) > 1) { l.flags.push('PC-P ≠ tổng PC-M'); flag('REVIEW', 'Báo cáo PC', `Lô ${l.pc}: Total Cost trên PC-P (${fmt(l.pcRM)}) khác tổng chi tiết PC-M (${fmt(l.pcmSum)}), chênh ${fmt(l.pcmDiff)} VND.`, { kind: 'lot', lk: l.key, pc: l.pc, impact: l.pcmDiff }); }
    if (/NON-POSITIVE/i.test(l.statusText)) { l.flags.push('Không nhận 622/627'); flag('REVIEW', 'Phân bổ 622/627', `Lô ${l.pc}: đóng góp ≤ 0 (doanh thu theo giá bán − RM) nên không nhận 622/627 chung. Kiểm tra giá bán / RM.`, { kind: 'lot', lk: l.key, pc: l.pc }); }
    if (l.gpPct !== null && l.gpPct < 0) { l.flags.push('Giá thành > giá bán'); flag('REVIEW', 'Biên lợi nhuận', `Lô ${l.pc}: giá thành ${fmt(l.unit)} > giá bán quy đổi ${fmt(l.price * l.fx)} VND/đv (GP ${pct(l.gpPct)}).`, { kind: 'lot', lk: l.key, pc: l.pc }); }
    if (l.totalRM && l.so / l.totalRM > RULES.soShare) { l.flags.push('Stock Out lớn'); flag('INFO', 'Stock Out', `Lô ${l.pc}: Stock Out phân bổ ${fmt(l.so)} VND = ${pct(l.so / l.totalRM)} RM của lô.`, { kind: 'lot', lk: l.key, pc: l.pc }); }
    if (Math.abs(l.wipAdj) > 1) { l.flags.push('Có điều chỉnh WIP 3B'); flag('INFO', 'Điều chỉnh WIP', `Lô ${l.pc}: nhận điều chỉnh WIP trực tiếp (3B) ${fmt(l.wipAdj)} VND.`, { kind: 'lot', lk: l.key, pc: l.pc }); }
    if (Math.abs(l.carryIn) > 1) { l.flags.push('Có rework chuyển vào'); flag('INFO', 'Rework', `Lô ${l.pc}: nhận giá trị rework hoàn thành ${fmt(l.carryIn)} VND.`, { kind: 'lot', lk: l.key, pc: l.pc }); }
  }
  for (const e of pcmMissing) flag('REVIEW', 'Báo cáo PC', `Kỳ này chưa có dữ liệu PC-M-${e} (chưa import hoặc đã bị xoá) – không xem được chi tiết vật tư và không đối chiếu được PC-P ↔ PC-M cho các lô ${e}. Import lại PC-M-${e} ở STEP 1.`, { kind: 'pcmAll' });
  if (looseLots) flag('INFO', 'Báo cáo PC', `${looseLots} lô: dòng PC-M ghi Product Code / Sub-MO khác PC-P – đã ghép theo PC No. (cùng cách đối chiếu ở STEP 3).`, { kind: 'pcmAll' });
  for (const r of (ctx.lotCheck && ctx.lotCheck.rows) || []) if (utxt(r.prod) === P) flag('REVIEW', 'Kiểm tra đơn giá RM', `Lô ${r.pc}: đơn giá RM ${fmt(r.unit)} = ${r.ratio.toFixed(2)}× trung vị (${fmt(r.median)}). ${r.flag}. Ảnh hưởng ${fmt(r.impact)} VND.`, { kind: 'lot', lk: (lots.find((l) => utxt(l.pc) === utxt(r.pc)) || {}).key, pc: r.pc, impact: r.impact, ref: { unit: r.unit, median: r.median, ratio: r.ratio, impact: r.impact, basis: r.flag, closingQty: r.closingQty, closingImpact: r.closingImpact } });
  if (overview.price === 0 || overview.price === null) flag('REVIEW', 'Giá bán', 'Không có giá bán trong Price Master – 622/627 không phân bổ được theo đóng góp.');
  else if (overview.priceSrc && !/CURRENT|LATEST/i.test(overview.priceSrc)) flag('INFO', 'Giá bán', `Giá bán dùng để phân bổ lấy từ: ${overview.priceSrc}.`);

  // ---- materials (PC-M consumption vs MI issue / MR return)
  const lotQty = new Map(lots.map((l) => [lotKey(l.erp, l.pc, l.sub, P), l.qty]));
  const lotSub = new Map(lots.map((l) => [lotKey(l.erp, l.pc, l.sub, P), l.sub]));
  const mats = new Map();
  const mget = (code, name, unitTxt) => { if (!mats.has(code)) mats.set(code, { mat: code, name, unit: unitTxt, qty: 0, amt: 0, lots: new Map(), miQty: 0, miAmt: 0, mrQty: 0, mrAmt: 0, flags: [] }); const o = mats.get(code); if (!o.name && name) o.name = name; if (!o.unit && unitTxt) o.unit = unitTxt; return o; };
  const matLots = [];
  for (const r of pcm) {
    const k = r.lotK;
    const o = mget(r.mat, r.name, r.unit); o.qty += r.qty; o.amt += r.amt;
    const lq = lotQty.get(k) || 0;
    const ml = o.lots.get(k) || { lk: k, erp: r.erp, pc: r.pc, sub: lotSub.get(k), date: r.date, lotQty: lq, qty: 0, amt: 0 };
    ml.qty += r.qty; ml.amt += r.amt; o.lots.set(k, ml);
  }
  let miRows = idx.mi.get(P) || [];
  if (!miRows.length && idx.miByMo) { const seen = new Set(); for (const l of lots) { const k = `${l.erp}|${utxt(l.mo)}`; if (l.mo && !seen.has(k)) { seen.add(k); miRows = miRows.concat(idx.miByMo.get(k) || []); } } }
  for (const r of miRows) { const o = mget(r.mat, r.name, r.unit); o.miQty += r.qty; o.miAmt += r.amt; }
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
    if (devP.length) { const lo = Math.min(...ls.map((x) => x.price ?? Infinity)), hi = Math.max(...ls.map((x) => x.price ?? -Infinity)); flag('REVIEW', 'Đơn giá vật tư', `${o.mat} ${o.name}: đơn giá giữa các lô dao động ${fmt(lo, 2)} → ${fmt(hi, 2)} (bình quân ${fmt(avgPrice, 2)}); ${devP.length}/${ls.length} lô lệch > ${Math.round(RULES.priceDev * 100)}%: ${devP.map((d) => d.x.pc).join(', ')}.`, { kind: 'mat', mat: o.mat, impact: absSum(devP) }); }
    if (devU.length) flag('REVIEW', 'Định mức tiêu hao', `${o.mat} ${o.name}: số lượng/sp lệch > ${Math.round(RULES.usageDev * 100)}% so với trung vị ${fmt(medUse, 4)} ${o.unit}/sp ở ${devU.length} lô: ${devU.map((d) => `${d.x.pc} (${fmt(d.x.perFG, 4)})`).join(', ')}.`, { kind: 'mat', mat: o.mat, impact: absSum(devU) });
    if (neg) flag('REVIEW', 'Báo cáo PC', `${o.mat} ${o.name}: ${neg} dòng PC-M có số lượng hoặc giá trị âm.`, { kind: 'mat', mat: o.mat });
    if (zero) flag('INFO', 'Báo cáo PC', `${o.mat} ${o.name}: tiêu hao ${fmt(o.qty, 4)} ${o.unit} nhưng giá trị 0 ở ${zero} lô (vật tư không tính giá / hàng miễn phí?).`, { kind: 'mat', mat: o.mat });
    const minP = Math.min(...ls.filter((x) => x.price !== null).map((x) => x.price)), maxP = Math.max(...ls.filter((x) => x.price !== null).map((x) => x.price));
    if (o.miQty && !o.qty) flag('INFO', 'Xuất kho', `${o.mat} ${o.name}: đã xuất kho ${fmt(o.miQty, 4)} ${o.unit} (${fmt(o.miAmt)} VND) cho sản phẩm nhưng chưa tiêu hao vào lô nào trong kỳ – nằm lại WIP.`, { kind: 'mat', mat: o.mat });
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
      flag('REVIEW', 'So với kỳ trước', `Giá thành đơn vị ${fmt(cu)} ${d > 0 ? 'tăng' : 'giảm'} ${pct(Math.abs(d))} so với ${pr.period} (${fmt(pu)} – ${pr.source}). Thay đổi chủ yếu do ${parts[0][0]} (${parts[0][1] > 0 ? '+' : ''}${fmt(parts[0][1])}/đv).`, { kind: 'prior' });
    }
  }
  const order = { BLOCK: 0, REVIEW: 1, INFO: 2 };
  A.sort((a, b) => order[a.level] - order[b.level] || Math.abs(num(b.impact)) - Math.abs(num(a.impact)));
  return { overview, lots, materials, matLots, stockOut, wipAdj, rework, anomalies: A, pcmRows: pcm, miRows, mrRows: idx.mr.get(P) || [] };
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
  if (overview.margin < 0) flag('REVIEW', 'Biên lợi nhuận', `Giá vốn ${fmt(T.tot)} > doanh thu ${fmt(T.rev)} VND – lỗ gộp ${fmt(-overview.margin)} (${pct(overview.gm)}).`, { kind: 'margin' });
  for (const s of sales) {
    if (s.fin === 'FIFO COGS' && s.margin < 0) flag('REVIEW', 'Dòng bán', `${s.inv} (${s.cust}): giá vốn ${fmt(s.tot)} > doanh thu ${fmt(s.vnd)} VND (lỗ ${fmt(-s.margin)}).`, { kind: 'sale', seq: s.seq, inv: s.inv });
    if (s.fin !== 'FIFO COGS') flag(s.fin === 'REVIEW' ? 'REVIEW' : 'INFO', 'Dòng bán', `${s.inv}: ${s.fin}${s.ovr ? ' (override)' : ''} – ${s.msg || 'không tính giá vốn FIFO'}.`, { kind: 'sale', seq: s.seq, inv: s.inv });
    if (s.status === 'INSUFFICIENT FG') flag('BLOCK', 'Thiếu FG', `${s.inv}: không đủ tồn kho FG để xuất bán (${s.msg}).`, { kind: 'sale', seq: s.seq, inv: s.inv });
  }
  if (prodUnit && overview.unitCOGS && Math.abs(overview.unitCOGS / prodUnit - 1) > 0.2) flag('INFO', 'Lớp FIFO', `Giá vốn đơn vị ${fmt(overview.unitCOGS)} khác giá thành SX kỳ này ${fmt(prodUnit)} (${pct(overview.unitCOGS / prodUnit - 1)}) do xuất bán từ lớp cũ theo FIFO.`, { kind: 'layers' });
  const soldUnits = detail.filter((d) => num(d.qty) > 0).map((d) => num(d.unit));
  if (soldUnits.length >= 2) { const mx = Math.max(...soldUnits), mn = Math.min(...soldUnits); if (mn > 0 && mx / mn > RULES.layerSpread) flag('REVIEW', 'Lớp FIFO', `Các lớp đã xuất bán có đơn giá chênh lớn: ${fmt(mn)} → ${fmt(mx)} (${(mx / mn).toFixed(2)}×). Kiểm tra lô có giá thành bất thường.`, { kind: 'layers' }); }
  for (const c of closing) {
    if (/REVIEW/.test(c.status)) flag('REVIEW', 'NRV', `Lớp ${c.lid}: ${c.msg}`, { kind: 'layer', lid: c.lid });
    const age = c.date && end ? end - c.date : 0;
    if (age > RULES.agingDays) flag('INFO', 'Tồn lâu', `Lớp ${c.lid} (lô ${c.pc}, ngày ${new Date(Date.UTC(1899, 11, 30) + c.date * 86400000).toISOString().slice(0, 10)}): còn ${fmt(c.qty)} sp sau ${Math.round(age)} ngày.`, { kind: 'layer', lid: c.lid });
  }
  if (rwRows.length) flag('INFO', 'Rework', `${fmt(rwRows.reduce((a, r) => a + num(r.qty), 0))} sp xuất đi rework theo FIFO, giá trị ${fmt(rwRows.reduce((a, r) => a + num(r.tot), 0))} VND.`, { kind: 'rework' });
  const order = { BLOCK: 0, REVIEW: 1, INFO: 2 };
  A.sort((a, b) => order[a.level] - order[b.level]);
  return { overview, sales, detail, layers, closing, rework: rwRows, anomalies: A };
}

// ---------------------------------------------------------------- anomaly drill-down ("Chi tiết")
/**
 * Evidence report for one anomaly. Returns null when the anomaly has nothing more to show than its message.
 * { title, lead, facts: [{l, v, t, bad}], tables: [{title, note, cols: [[key, label, width, type]], rows, totals, hl}], checks: [text] }
 */
export function anomalyDetail(a, t, c) {
  if (!a || !a.kind) return null;
  const F = (l, v, ty = 'num', bad = false) => ({ l, v, t: ty, bad });
  if (t && a.kind === 'lot') return lotDetail(a, t, F);
  if (t && a.kind === 'mat') return matDetail(a, t, F);
  if (t && a.kind === 'pcmAll') {
    const rows = t.lots.map((l) => ({ ...l, diff: l.pcmDiff }));
    return { title: 'Đối chiếu PC-P ↔ PC-M theo lô', lead: 'Tổng giá trị NVL trên PC-P của từng lô so với tổng các dòng vật tư PC-M cùng PC No.', facts: [F('NVL theo PC-P', t.overview.pcRM), F('Tổng PC-M', rows.reduce((x, r) => x + r.pcmSum, 0)), F('Số lô lệch', rows.filter((r) => Math.abs(r.diff) > 1).length, 'int')],
      tables: [{ title: 'Các lô', cols: [['erp', 'ERP', 50], ['pc', 'PC No.', 120], ['sub', 'Sub-MO', 140], ['qty', 'SL', 70, 'qty'], ['pcRM', 'NVL PC-P', 130, 'num'], ['pcmSum', 'Tổng PC-M', 130, 'num'], ['diff', 'Chênh', 120, 'num'], ['nMat', 'Số vật tư', 70, 'int']], rows, totals: ['qty', 'pcRM', 'pcmSum', 'diff'], hl: (r) => Math.abs(r.diff) > 1 }],
      checks: ['Lô lệch: mở PC-P và PC-M của PC No. đó trên ERP, cộng cột Total Cost của PC-M và so với PC-P.', 'Nếu PC-M thiếu hẳn: import lại file PC-M của hệ tương ứng ở STEP 1.'] };
  }
  if (t && a.kind === 'prior') {
    const o = t.overview, pr = o.prior; if (!pr || !pr.qty || !o.qty) return null;
    const rows = [['NVL', o.totalRM, pr.rm], ['Nhân công 622', o.t622, pr.a622], ['SX chung 627', o.t627, pr.a627], ['Tổng giá thành', o.totalCost, pr.tot]].map(([k, cur, prv]) => ({ k, cur: cur / o.qty, prv: prv / pr.qty, diff: cur / o.qty - prv / pr.qty, chg: prv ? (cur / o.qty) / (prv / pr.qty) - 1 : null }));
    return { title: `So sánh giá thành đơn vị với ${pr.period}`, lead: `Kỳ trước lấy từ ${pr.source} (${fmt(pr.qty)} sp).`, facts: [F('Giá thành/đv kỳ này', o.unit), F(`Giá thành/đv ${pr.period}`, pr.tot / pr.qty), F('Thay đổi', o.priorChange, 'pct', true)],
      tables: [{ title: 'Theo khoản mục (VND/sp)', cols: [['k', 'Khoản mục', 160], ['prv', pr.period, 130, 'num'], ['cur', 'Kỳ này', 130, 'num'], ['diff', 'Chênh /đv', 120, 'num'], ['chg', '%', 80, 'pct1']], rows, hl: (r) => Math.abs(r.chg || 0) > RULES.priorDev },
        { title: 'Các lô kỳ này', cols: [['pc', 'PC No.', 120], ['date', 'Ngày', 95, 'date'], ['qty', 'SL', 70, 'qty'], ['rmUnit', 'NVL/đv', 110, 'num'], ['u622', '622/đv', 100, 'num'], ['u627', '627/đv', 100, 'num'], ['unit', 'Giá thành/đv', 120, 'num']], rows: t.lots, totals: ['qty'] }],
      checks: ['Khoản mục thay đổi nhiều nhất là nơi cần xem trước: NVL → xem bảng Vật tư (đơn giá, định mức); 622/627 → xem tổng chi phí GL kỳ và cơ sở phân bổ (STEP 4.2–4.3).'] };
  }
  if (c && a.kind === 'sale') {
    const s0 = c.sales.find((x) => x.seq === a.seq); if (!s0) return null;
    const rows = c.detail.filter((d) => d.line === s0.seq);
    const up = s0.qty ? s0.vnd / s0.qty : null;
    return { title: `Dòng bán ${s0.inv}`, lead: `${s0.cust} · ${s0.name || ''}`, facts: [F('Ngày HĐ', s0.date, 'date'), F('Số lượng', s0.qty, 'qty'), F('Doanh thu VND', s0.vnd), F('Giá bán / đv', up), F('Giá vốn', s0.tot), F('Giá vốn / đv', s0.unit), F('Lãi gộp', s0.margin, 'num', s0.margin < 0), F('Lãi gộp %', s0.gm, 'pct', s0.gm < 0), F('Xử lý', s0.fin, 'text'), F('Trạng thái', s0.status, 'text')],
      tables: [{ title: 'Các lớp FIFO đã lấy cho dòng bán này', cols: [['source', 'Nguồn', 100], ['pc', 'Lô PC', 120], ['date', 'Ngày lô', 95, 'date'], ['layerQty', 'SL lớp', 80, 'qty'], ['qty', 'SL lấy', 80, 'qty'], ['unit', 'Giá vốn/đv', 110, 'num'], ['rm', 'NVL', 120, 'num'], ['a622', '622', 110, 'num'], ['a627', '627', 110, 'num'], ['tot', 'Giá vốn', 130, 'num'], ['lid', 'Layer ID', 220]], rows, totals: ['qty', 'rm', 'a622', 'a627', 'tot'], hl: (r) => up !== null && r.unit > up }],
      checks: [s0.msg ? `Ghi chú FIFO: ${s0.msg}` : '', 'Lớp tô màu: giá vốn/đv cao hơn giá bán/đv. Mở "Truy xuất" của lô đó (tab Giá thành sản xuất) để xem vì sao giá thành cao.', 'Kiểm tra giá bán và tỷ giá trên hoá đơn (Sales DB) nếu doanh thu thấp bất thường.'].filter(Boolean) };
  }
  if (c && a.kind === 'margin') {
    return { title: 'Lãi gộp theo dòng bán', lead: 'Sắp xếp từ dòng lỗ nhiều nhất.', facts: [F('Doanh thu', c.overview.revenue), F('Giá vốn', c.overview.cogsA), F('Lãi gộp', c.overview.margin, 'num', c.overview.margin < 0), F('Lãi gộp %', c.overview.gm, 'pct', c.overview.gm < 0)],
      tables: [{ title: 'Dòng bán', cols: [['date', 'Ngày HĐ', 95, 'date'], ['inv', 'Hoá đơn', 140], ['cust', 'Khách hàng', 200], ['qty', 'SL', 80, 'qty'], ['vnd', 'Doanh thu', 130, 'num'], ['tot', 'Giá vốn', 130, 'num'], ['unit', 'Giá vốn/đv', 110, 'num'], ['margin', 'Lãi gộp', 120, 'num'], ['gm', '%', 70, 'pct1']], rows: c.sales.filter((x) => x.fin === 'FIFO COGS').slice().sort((x, y) => x.margin - y.margin), totals: ['qty', 'vnd', 'tot', 'margin'], hl: (r) => r.margin < 0 }], checks: [] };
  }
  if (c && a.kind === 'layers') {
    const rows = c.detail.filter((d) => num(d.qty) > 0).slice().sort((x, y) => num(y.unit) - num(x.unit));
    return { title: 'Đơn giá các lớp FIFO đã xuất bán', lead: 'Sắp xếp từ lớp có giá vốn/đv cao nhất.', facts: [F('Giá vốn / đv bình quân', c.overview.unitCOGS), F('Giá thành SX kỳ này / đv', c.overview.prodUnit), F('Cao nhất', rows.length ? rows[0].unit : null), F('Thấp nhất', rows.length ? rows[rows.length - 1].unit : null)],
      tables: [{ title: 'Lớp đã xuất bán', cols: [['source', 'Nguồn', 100], ['pc', 'Lô PC', 120], ['date', 'Ngày lô', 95, 'date'], ['qty', 'SL lấy', 80, 'qty'], ['unit', 'Giá vốn/đv', 110, 'num'], ['rm', 'NVL', 120, 'num'], ['a622', '622', 110, 'num'], ['a627', '627', 110, 'num'], ['tot', 'Giá vốn', 130, 'num'], ['lid', 'Layer ID', 220]], rows, totals: ['qty', 'rm', 'a622', 'a627', 'tot'] },
        { title: 'Tất cả lớp FIFO của sản phẩm', cols: [['source', 'Nguồn', 100], ['srcPeriod', 'Kỳ gốc', 80], ['pc', 'Lô PC', 120], ['qtyIn', 'SL vào', 80, 'qty'], ['unit', 'Đơn giá', 110, 'num'], ['rmUnit', 'NVL/đv', 100, 'num'], ['sold', 'Đã bán', 80, 'qty'], ['remQ', 'Còn lại', 80, 'qty']], rows: c.layers, totals: ['qtyIn', 'sold', 'remQ'] }],
      checks: ['Lớp đầu kỳ (OPENING) mang giá thành của kỳ gốc; lớp PRODUCTION mang giá thành kỳ này. Chênh lớn giữa các lớp thường do một lô có NVL/đv bất thường – mở tab Giá thành sản xuất để xem lô đó.'] };
  }
  if (c && a.kind === 'layer') {
    const L = c.layers.find((x) => x.lid === a.lid); const cl = c.closing.find((x) => x.lid === a.lid);
    if (!L && !cl) return null;
    return { title: `Lớp FIFO ${a.lid}`, lead: cl && cl.msg ? cl.msg : '', facts: [F('Nguồn', L ? L.source : '', 'text'), F('Kỳ gốc', L ? L.srcPeriod : '', 'text'), F('Lô PC', L ? L.pc : cl.pc, 'text'), F('Ngày lô', L ? L.date : cl.date, 'date'), F('SL vào', L ? L.qtyIn : null, 'qty'), F('Đơn giá', L ? L.unit : cl.unitCost), F('Đã bán kỳ này', L ? L.sold : null, 'qty'), F('Còn lại', cl ? cl.qty : L.remQ, 'qty'), F('Giá trị còn lại', cl ? cl.tot : L.remTot), F('Tuổi (ngày)', L ? L.age : null, 'int', L && L.age > RULES.agingDays), F('Giá bán USD', cl ? cl.price : null, 'qty')],
      tables: [{ title: 'Các lần xuất bán từ lớp này trong kỳ', cols: [['line', 'Dòng bán #', 80, 'int'], ['qty', 'SL lấy', 80, 'qty'], ['unit', 'Giá vốn/đv', 110, 'num'], ['tot', 'Giá vốn', 130, 'num'], ['take', 'Kiểu', 80]], rows: c.detail.filter((d) => d.lid === a.lid), totals: ['qty', 'tot'] }],
      checks: ['NRV: so giá thành/đv của lớp với giá bán quy đổi (Price Master × tỷ giá). Tồn lâu: xác nhận với kho/bán hàng khả năng tiêu thụ, cân nhắc trích lập dự phòng.'] };
  }
  if (c && a.kind === 'rework') {
    return { title: 'Thành phẩm xuất đi rework (FIFO)', lead: '', facts: [F('SL', c.rework.reduce((x, r) => x + num(r.qty), 0), 'qty'), F('Giá trị', c.rework.reduce((x, r) => x + num(r.tot), 0))],
      tables: [{ title: 'Dòng rework', cols: [['rid', 'Rework ID', 260], ['pcNo', 'Lô rework', 120], ['lid', 'Layer', 200], ['qty', 'SL', 70, 'qty'], ['unit', 'Đơn giá', 110, 'num'], ['tot', 'Giá trị', 130, 'num'], ['rwStatus', 'Trạng thái', 110]], rows: c.rework, totals: ['qty', 'tot'] }], checks: [] };
  }
  return null;
}

function lotDetail(a, t, F) {
  const l = t.lots.find((x) => x.key === a.lk) || t.lots.find((x) => utxt(x.pc) === utxt(a.pc));
  if (!l) return null;
  const n = t.lots.length;
  const medRM = median(t.lots.filter((x) => x.qty > 0).map((x) => x.rmUnit));
  const medUnit = median(t.lots.filter((x) => x.qty > 0).map((x) => x.unit));
  const inLot = new Map(t.matLots.filter((x) => x.lk === l.key).map((x) => [x.mat, x]));
  const mats = [];
  for (const m of t.materials) {
    const r = inLot.get(m.mat); const act = r ? r.qty : 0; const actAmt = r ? r.amt : 0;
    const common = m.nLots / n >= 0.5 && m.medUse > 0;
    if (!common && !r) continue;
    const exp = common ? m.medUse * l.qty : null;
    const ratio = exp ? act / exp : null;
    const status = !common ? 'Ít lô dùng' : !r ? 'KHÔNG CÓ trong lô' : ratio < 1 - RULES.usageDev ? 'THIẾU' : ratio > 1 + RULES.usageDev ? 'VƯỢT' : 'OK';
    const expAmt = exp !== null && m.price !== null ? exp * m.price : null;
    mats.push({ mat: m.mat, name: m.name, unit: m.unit, used: `${m.nLots}/${n}`, med: m.medUse, exp, act, diffQ: exp !== null ? act - exp : null, ratio, avgPrice: m.price, lotPrice: act ? actAmt / act : null, actAmt, expAmt, diffAmt: expAmt !== null ? actAmt - expAmt : null, status });
  }
  const rank = { 'KHÔNG CÓ trong lô': 0, THIẾU: 1, VƯỢT: 2, 'Ít lô dùng': 3, OK: 4 };
  mats.sort((x, y) => rank[x.status] - rank[y.status] || Math.abs(num(y.diffAmt)) - Math.abs(num(x.diffAmt)));
  const expTot = mats.reduce((s, m) => s + num(m.expAmt), 0), actCommon = mats.filter((m) => m.exp !== null).reduce((s, m) => s + m.actAmt, 0);
  const miss = mats.filter((m) => m.status === 'KHÔNG CÓ trong lô'), low = mats.filter((m) => m.status === 'THIẾU'), high = mats.filter((m) => m.status === 'VƯỢT');
  const facts = [F('Ngày lô', l.date, 'date'), F('Sub-MO', l.sub || '–', 'text'), F('SL hoàn thành', l.qty, 'qty'), F('NVL theo PC-P', l.pcRM), F('Tổng chi tiết PC-M', l.pcmSum), F('Chênh PC-P − PC-M', l.pcmDiff, 'num', Math.abs(l.pcmDiff) > 1),
    F('Stock Out phân bổ', l.so), F('Điều chỉnh WIP 3B', l.wipAdj), F('Rework chuyển vào', l.carryIn), F('NVL / đv', l.rmUnit, 'num', medRM && Math.abs(l.rmUnit / medRM - 1) > 0.3), F('Trung vị NVL / đv các lô', medRM), F('622 / đv', l.u622), F('627 / đv', l.u627),
    F('Giá thành / đv', l.unit, 'num', medUnit && Math.abs(l.unit / medUnit - 1) > 0.3), F('Trung vị giá thành / đv', medUnit), F('NVL vật tư chung theo định mức', expTot), F('NVL vật tư chung thực tế', actCommon, 'num', expTot && Math.abs(actCommon / expTot - 1) > RULES.usageDev)];
  if (a.ref) facts.push(F('Đơn giá RM (kiểm tra STEP 4)', a.ref.unit), F('Trung vị (STEP 4)', a.ref.median), F('Tỷ lệ', a.ref.ratio, 'qty', true), F('Ảnh hưởng', a.ref.impact, 'num', true), F('SL còn tồn cuối của lô', a.ref.closingQty, 'qty'), F('Ảnh hưởng trên tồn cuối', a.ref.closingImpact));
  const checks = [];
  if (Math.abs(l.pcmDiff) > 1) checks.push(`PC-P và PC-M lệch ${fmt(l.pcmDiff)} VND: mở PC ${l.pc} trên ERP, cộng Total Cost các dòng vật tư và so với Total Cost thành phẩm.`);
  if (miss.length) checks.push(`${miss.length} vật tư mà phần lớn các lô khác đều dùng nhưng lô này không có (giá trị theo định mức ≈ ${fmt(miss.reduce((s, m) => s + num(m.expAmt), 0))} VND): kiểm tra phiếu xuất kho MI của MO ${l.mo || ''} đã được ghi vào PC chưa, hoặc PC hoàn thành trước khi xuất vật tư.`);
  if (low.length) checks.push(`${low.length} vật tư tiêu hao thấp hơn định mức > ${Math.round(RULES.usageDev * 100)}%: kiểm tra số lượng xuất kho, ĐVT, xuất bổ sung ở kỳ sau.`);
  if (high.length) checks.push(`${high.length} vật tư tiêu hao cao hơn định mức > ${Math.round(RULES.usageDev * 100)}%: kiểm tra hao hụt, xuất dư, hoặc vật tư của lô/MO khác bị ghi nhầm vào lô này.`);
  if (/NON-POSITIVE/i.test(l.statusText)) checks.push('Lô không nhận 622/627 chung vì doanh thu theo giá bán − NVL ≤ 0: kiểm tra giá bán trong Price Master và NVL của lô.');
  if (!checks.length) checks.push('Các vật tư chung của lô nằm trong định mức; chênh lệch giá thành đến từ đơn giá vật tư, Stock Out, 3B hoặc phân bổ 622/627 – xem các dòng số liệu ở trên.');
  const moMI = t.miRows.filter((r) => r.mo && utxt(r.mo) === utxt(l.mo));
  return { title: `Lô ${l.pc}`, lead: `${l.erp} · MO ${l.mo || '–'} · ${l.flags.join(' · ') || 'không có cờ'}`, facts, checks,
    tables: [
      { title: 'Vật tư của lô so với định mức các lô khác', note: `Định mức = trung vị SL/sp của vật tư ở các lô có dùng (chỉ tính vật tư có ở ≥ 50% số lô). Giá trị theo định mức = định mức × SL lô × đơn giá bình quân của sản phẩm.`,
        cols: [['status', 'Đánh giá', 130], ['mat', 'Mã vật tư', 100], ['name', 'Tên vật tư', 240], ['unit', 'ĐVT', 50], ['used', 'Số lô dùng', 80], ['med', 'Định mức /sp', 90, 'qty'], ['exp', 'SL theo định mức', 110, 'qty'], ['act', 'SL thực tế', 100, 'qty'], ['diffQ', 'Chênh SL', 100, 'qty'], ['ratio', 'Thực tế / định mức', 100, 'qty'], ['avgPrice', 'Đơn giá BQ', 100, 'qty'], ['lotPrice', 'Đơn giá lô', 100, 'qty'], ['expAmt', 'Giá trị theo định mức', 130, 'num'], ['actAmt', 'Giá trị thực tế', 130, 'num'], ['diffAmt', 'Chênh giá trị', 130, 'num']],
        rows: mats, totals: ['expAmt', 'actAmt', 'diffAmt'], hl: (r) => r.status !== 'OK' && r.status !== 'Ít lô dùng' },
      { title: 'So sánh với các lô khác của sản phẩm', cols: [['pc', 'PC No.', 120], ['date', 'Ngày', 95, 'date'], ['sub', 'Sub-MO', 140], ['qty', 'SL', 70, 'qty'], ['rmUnit', 'NVL/đv', 110, 'num'], ['rmR', 'NVL/đv ÷ trung vị', 110, 'qty'], ['unit', 'Giá thành/đv', 120, 'num'], ['unitR', 'Giá thành ÷ trung vị', 110, 'qty'], ['nMat', 'Số vật tư', 70, 'int']],
        rows: t.lots.map((x) => ({ ...x, rmR: medRM ? x.rmUnit / medRM : null, unitR: medUnit ? x.unit / medUnit : null })), totals: ['qty'], hl: (r) => r.key === l.key },
      { title: 'Dòng PC-M của lô (chứng từ gốc)', cols: [['pc', 'PC No.', 120], ['sub', 'Sub-MO', 140], ['prod', 'Product Code', 130], ['mat', 'Mã vật tư', 100], ['name', 'Tên vật tư', 240], ['unit', 'ĐVT', 50], ['qty', 'SL', 90, 'qty'], ['amt', 'Total Cost', 130, 'num'], ['price', 'Đơn giá', 100, 'qty']],
        rows: t.pcmRows.filter((r) => r.lotK === l.key).map((r) => ({ ...r, price: r.qty ? r.amt / r.qty : null })), totals: ['qty', 'amt'] },
      { title: `Phiếu xuất kho MI-M theo MO ${l.mo || ''}`, note: 'Toàn bộ vật tư xuất cho MO trong kỳ (một MO có thể gồm nhiều lô PC).', cols: [['doc', 'MI No.', 130], ['date', 'Ngày', 95, 'date'], ['mat', 'Mã vật tư', 100], ['name', 'Tên vật tư', 240], ['unit', 'ĐVT', 50], ['qty', 'SL xuất', 90, 'qty'], ['amt', 'Giá trị', 130, 'num']], rows: moMI, totals: ['qty', 'amt'], hl: (r) => miss.some((m) => m.mat === r.mat) },
    ] };
}

function matDetail(a, t, F) {
  const m = t.materials.find((x) => x.mat === a.mat); if (!m) return null;
  const avg = m.price; const med = m.medUse;
  const rows = t.matLots.filter((x) => x.mat === m.mat).map((x) => {
    const exp = med ? med * x.lotQty : null;
    return { ...x, exp, diffQ: exp !== null ? x.qty - exp : null, useDev: med && x.perFG !== null ? x.perFG / med - 1 : null, priceDev: avg && x.price !== null ? x.price / avg - 1 : null, impU: exp !== null && avg ? (x.qty - exp) * avg : null, impP: avg && x.price !== null ? (x.price - avg) * x.qty : null };
  });
  const mi = t.miRows.filter((r) => r.mat === m.mat).map((r) => ({ ...r, price: r.qty ? r.amt / r.qty : null }));
  const mr = t.mrRows.filter((r) => r.mat === m.mat);
  const miQ = mi.reduce((s, r) => s + r.qty, 0), miA = mi.reduce((s, r) => s + r.amt, 0);
  const checks = [];
  if (rows.some((r) => r.flags.some((f) => f.startsWith('Đơn giá')))) checks.push(`Đơn giá trên PC-M là giá xuất kho ERP tính cho từng lô. So sánh với đơn giá trên phiếu MI (bình quân ${fmt(miQ ? miA / miQ : null, 2)}) và giá mua trong kỳ; lô lệch nhiều thường do xuất từ lô hàng nhập giá khác hoặc giá tạm tính.`);
  if (rows.some((r) => r.flags.some((f) => f.startsWith('Định mức')))) checks.push(`Định mức trung vị ${fmt(med, 4)} ${m.unit}/sp. Lô lệch: kiểm tra BOM, ĐVT trên phiếu, xuất bổ sung / trả lại, hoặc vật tư của lô khác ghi nhầm vào lô này.`);
  if (rows.some((r) => r.qty < 0 || r.amt < 0)) checks.push('Dòng âm trên PC-M: thường là điều chỉnh / trả lại vật tư – kiểm tra chứng từ gốc của dòng đó.');
  if (m.miQty && !m.qty) checks.push('Vật tư đã xuất kho nhưng chưa vào lô hoàn thành nào: phần này nằm trong WIP cuối kỳ (STEP 3).');
  return { title: `${m.mat} · ${m.name}`, lead: `Vật tư của ${t.overview.prod} trong kỳ – ${m.nLots}/${t.lots.length} lô có dùng.`, checks,
    facts: [F('ĐVT', m.unit, 'text'), F('Xuất kho (MI) SL', m.miQty, 'qty'), F('Xuất kho giá trị', m.miAmt), F('Đơn giá xuất kho BQ', m.miQty ? m.miAmt / m.miQty : null, 'qty'), F('Trả lại (MR) SL', m.mrQty, 'qty'), F('Tiêu hao (PC-M) SL', m.qty, 'qty'), F('Tiêu hao giá trị', m.amt), F('Còn lại WIP (SL)', m.toWipQty, 'qty'),
      F('Đơn giá tiêu hao BQ', avg, 'qty'), F('Đơn giá thấp nhất', m.minPrice, 'qty'), F('Đơn giá cao nhất', m.maxPrice, 'qty'), F('Định mức trung vị /sp', med, 'qty'), F('SL / sp bình quân', m.perFG, 'qty')],
    tables: [
      { title: 'Theo từng lô', note: 'Chênh SL = thực tế − định mức trung vị × SL lô. Ảnh hưởng định mức = chênh SL × đơn giá BQ; ảnh hưởng đơn giá = (đơn giá lô − BQ) × SL.',
        cols: [['pc', 'PC No.', 120], ['date', 'Ngày', 95, 'date'], ['lotQty', 'SL lô', 70, 'qty'], ['qty', 'SL tiêu hao', 100, 'qty'], ['perFG', 'SL/sp', 80, 'qty'], ['useDev', 'Lệch định mức', 90, 'pct1'], ['exp', 'SL theo định mức', 110, 'qty'], ['diffQ', 'Chênh SL', 100, 'qty'], ['price', 'Đơn giá lô', 100, 'qty'], ['priceDev', 'Lệch đơn giá', 90, 'pct1'], ['amt', 'Giá trị', 120, 'num'], ['impU', 'Ảnh hưởng định mức', 130, 'num'], ['impP', 'Ảnh hưởng đơn giá', 130, 'num'], ['flagText', 'Bất thường', 200]],
        rows, totals: ['lotQty', 'qty', 'amt', 'impU', 'impP'], hl: (r) => r.flags.length > 0 },
      { title: 'Phiếu xuất kho (MI-M) của vật tư cho sản phẩm', cols: [['doc', 'MI No.', 130], ['date', 'Ngày', 95, 'date'], ['mo', 'MO No.', 130], ['qty', 'SL', 90, 'qty'], ['amt', 'Giá trị', 130, 'num'], ['price', 'Đơn giá', 100, 'qty']], rows: mi, totals: ['qty', 'amt'] },
      { title: 'Phiếu trả lại (MR-M)', cols: [['doc', 'Chứng từ', 130], ['qty', 'SL', 90, 'qty'], ['amt', 'Giá trị', 130, 'num']], rows: mr, totals: ['qty', 'amt'] },
      { title: 'Dòng PC-M (chứng từ gốc)', cols: [['pc', 'PC No.', 120], ['sub', 'Sub-MO', 140], ['qty', 'SL', 90, 'qty'], ['amt', 'Total Cost', 130, 'num'], ['price', 'Đơn giá', 100, 'qty']], rows: t.pcmRows.filter((r) => r.mat === m.mat).map((r) => ({ ...r, price: r.qty ? r.amt / r.qty : null })), totals: ['qty', 'amt'] },
    ] };
}

// ---------------------------------------------------------------- formatting helpers for messages
function fmt(x, d = 0) { if (x === null || x === undefined || !isFinite(x)) return '–'; return Number(x).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: d }); }
function pct(x) { if (x === null || x === undefined || !isFinite(x)) return '–'; return `${x > 0 ? '+' : ''}${(x * 100).toFixed(1).replace('.', ',')}%`; }
