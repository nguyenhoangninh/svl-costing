// Dashboard điều hành · doanh thu, giá vốn, lãi gộp (v1.14.79, bố cục mới v1.14.80).
// Reads the STEP 5 result through engine/custpl.js (the same numbers as the bút toán and the export):
//   filter bar (khách hàng · sản phẩm) · 6 KPI cards with the change against the previous period · monthly trend
//   (Sales / Returns Database, GP from the periods that have STEP 5 on this device) · revenue plan gauge · GP % by customer ·
//   top products · top customers · revenue mix · lowest GP % · detail tables · checks.
import { customerPL, productPL, filterRes, monthlyRevenue, prevMonth, growth, NO_PROD } from '../engine/custpl.js';
import { journalCheck } from '../engine/journal.js';
import { dashboardQuality, comparableAverageUnit } from '../engine/dashboard-quality.js';
import { invoiceDetail, gpBridge, profitSignals } from '../engine/dashboard-intelligence.js';

let A = null;
export function install(api) { A = api; }
/** Revenue plan of the period (kế hoạch doanh thu / GP %), saved with the period like the other blobs. */
export const DASH_BLOBS = ['dashPlan'];

const F = { period: '', cust: '', prod: '', detail: false };   // filters of the open period
const HIST = new Map();                          // other periods → their STEP 5 result (null when none on this device)
let loading = '';

const esc = (v) => A.esc(v);
const money = (v) => A.fmtNum(v);
const nf = (x, d) => x.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${nf(v * 100, d)}%`);
/** 24.830.000.000 → "24,83 tỷ"; 850.000.000 → "850 tr" */
function short(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf(v / 1e9, a >= 1e11 ? 1 : 2)} tỷ`;
  if (a >= 1e6) return `${nf(v / 1e6, a >= 1e8 ? 0 : 1)} tr`;
  return nf(v, 0);
}
const cut = (s, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const TOL = 1;

// ---------------- icons (stroke, currentColor)
const ICON = {
  rev: '<path d="M12 2v20"/><path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"/>',
  gp: '<path d="M4 20V14"/><path d="M10 20V9"/><path d="M16 20V12"/><path d="M22 20V4"/>',
  pct: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  up: '<path d="M2 18l7-7 4 4 9-9"/><path d="M16 6h6v6"/>',
  box: '<path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

/** One KPI card: icon, label, big value, full value, change against the comparison period. */
function card({ ic, tone, label, value, full, delta, deltaTxt, vs }) {
  const dir = delta === null || delta === undefined || !Number.isFinite(delta) ? '' : delta > 0.0005 ? 'up' : delta < -0.0005 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : dir === 'flat' ? '■' : '';
  return `<div class="dx-kpi t-${tone}">
    <div class="dx-ic">${icon(ic)}</div>
    <div class="dx-body"><span class="dx-lbl">${esc(label)}</span><b class="dx-val">${esc(value)}</b>${full ? `<small class="dx-full">${esc(full)}</small>` : ''}
      <div class="dx-delta"><span>${esc(vs)}</span><em class="${dir}">${arrow} ${esc(deltaTxt)}</em></div></div>
  </div>`;
}

// ---------------- charts
/** Monthly revenue of the year (line + area), last year (dotted) and gross profit (bars) where STEP 5 is available. */
function chartTrend(pts, curMonth) {
  const W = 760, H = 270, L = 62, R = 14, T = 26, B = 30;
  const vals = pts.flatMap((p) => [p.cur, p.last, p.gp]).filter((v) => v !== null && Number.isFinite(v));
  let hi = Math.max(1, ...vals), lo = Math.min(0, ...vals);
  const step = niceStep((hi - lo) / 4); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step;
  const x = (m) => L + ((m - 0.5) / 12) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const grid = []; for (let v = lo; v <= hi + step / 2; v += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="dx-grid"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="dx-ax">${esc(short(v))}</text>`);
  const months = pts.map((p) => `<text x="${x(p.m).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="dx-ax${p.m === curMonth ? ' cur' : ''}">T${p.m}</text>`).join('');
  const bw = Math.min(26, ((W - L - R) / 12) * 0.42);
  const bars = pts.filter((p) => p.gp !== null).map((p) => { const y0 = y(0), y1 = y(p.gp); return `<rect x="${(x(p.m) - bw / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="3" class="${p.gp < 0 ? 'dx-gp-bar neg' : 'dx-gp-bar'}"><title>T${p.m} · Lãi gộp ${money(p.gp)}${p.gpPct === null ? '' : ` (${pct(p.gpPct)})`}</title></rect>`; }).join('');
  const line = (key, cls) => { const q = pts.filter((p) => p[key] !== null); if (!q.length) return ''; return `<polyline class="${cls}" points="${q.map((p) => `${x(p.m).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')}"/>`; };
  const cur = pts.filter((p) => p.cur !== null);
  const area = cur.length > 1 ? `<path class="dx-area" d="M${x(cur[0].m).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} ${cur.map((p) => `L${x(p.m).toFixed(1)},${y(p.cur).toFixed(1)}`).join(' ')} L${x(cur[cur.length - 1].m).toFixed(1)},${y(Math.max(lo, 0)).toFixed(1)} Z"/>` : '';
  const dots = cur.map((p) => `<circle cx="${x(p.m).toFixed(1)}" cy="${y(p.cur).toFixed(1)}" r="${p.m === curMonth ? 5 : 3.5}" class="dx-dot${p.m === curMonth ? ' cur' : ''}"><title>T${p.m} · Doanh thu thuần ${money(p.cur)}</title></circle><text x="${x(p.m).toFixed(1)}" y="${(y(p.cur) - 10).toFixed(1)}" text-anchor="middle" class="dx-pt">${esc(short(p.cur))}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="dx-svg dx-trend" role="img" aria-label="${esc('Doanh thu thuần theo tháng')}">${grid.join('')}${bars}${area}${line('last', 'dx-last')}${line('cur', 'dx-cur')}${dots}${months}</svg>`;
}
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Half-circle gauge 0–150 % of the plan. */
function gauge(ratio) {
  const W = 260, H = 150, cx = 130, cy = 132, r = 104;
  const pt = (f) => { const a = Math.PI * (1 - Math.min(1.5, Math.max(0, f)) / 1.5); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const arc = (f0, f1) => { const [x0, y0] = pt(f0), [x1, y1] = pt(f1); return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  const v = ratio === null ? 0 : ratio;
  const [mx, my] = pt(v), [tx, ty] = pt(1);
  const [tx2, ty2] = [cx + (r + 12) * (tx - cx) / r, cy + (r + 12) * (ty - cy) / r];
  return `<svg viewBox="0 0 ${W} ${H}" class="dx-gauge" role="img" aria-label="${esc('Mức đạt kế hoạch doanh thu')}">
    <path d="${arc(0, 1.5)}" class="dx-g-bg"/>
    ${ratio === null ? '' : `<path d="${arc(0, v)}" class="dx-g-val${v < 0.9 ? ' low' : v < 1 ? ' mid' : ''}"/>`}
    <line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${tx2.toFixed(1)}" y2="${ty2.toFixed(1)}" class="dx-g-tick"/>
    ${ratio === null ? '' : `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6" class="dx-g-knob"/>`}
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" class="dx-g-num">${esc(ratio === null ? '—' : pct(ratio))}</text>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" class="dx-g-sub">${esc('kế hoạch doanh thu')}</text>
    <text x="${cx - r}" y="${cy + 16}" text-anchor="middle" class="dx-ax">0%</text><text x="${cx + r}" y="${cy + 16}" text-anchor="middle" class="dx-ax">150%</text>
  </svg>`;
}

/** Revenue mix: donut of the top customers plus "Khác". */
const MIX_CLS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
function donut(parts, total) {
  const R = 70, r = 46, C = 90;
  let a0 = -Math.PI / 2;
  const seg = parts.map((p, i) => {
    const f = total > 0 ? p.v / total : 0, a1 = a0 + f * 2 * Math.PI;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const P = (a, rad) => `${(C + rad * Math.cos(a)).toFixed(2)},${(C + rad * Math.sin(a)).toFixed(2)}`;
    const d = f >= 0.9999 ? `M${C - R},${C} a${R},${R} 0 1 0 ${2 * R},0 a${R},${R} 0 1 0 ${-2 * R},0 M${C - r},${C} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r},0`
      : `M${P(a0, R)} A${R},${R} 0 ${big} 1 ${P(a1, R)} L${P(a1, r)} A${r},${r} 0 ${big} 0 ${P(a0, r)} Z`;
    a0 = a1;
    return `<path d="${d}" class="dx-seg ${MIX_CLS[i % MIX_CLS.length]}" fill-rule="evenodd"><title>${esc(p.label)} · ${money(p.v)} (${pct(f)})</title></path>`;
  }).join('');
  return `<svg viewBox="0 0 180 180" class="dx-donut" role="img" aria-label="${esc('Cơ cấu doanh thu theo khách hàng')}">${seg}
    <text x="${C}" y="${C - 2}" text-anchor="middle" class="dx-d-num">${esc(short(total))}</text><text x="${C}" y="${C + 16}" text-anchor="middle" class="dx-d-sub">${esc('DT thuần')}</text></svg>`;
}

/** GP % by customer on one axis; the dashed line is the overall GP %. */
function chartGp(rows, avg) {
  const LBL = 190, BAR = 380, RH = 26, W = LBL + BAR + 70, H = rows.length * RH + 14;
  const vals = rows.map((r) => (r.gpPct === null ? 0 : r.gpPct)).concat([0, avg === null ? 0 : avg]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (v) => LBL + ((v - lo) / span) * BAR;
  const zero = x(0);
  const body = rows.map((r, i) => {
    const y = 8 + i * RH;
    if (r.gpPct === null) return `<text x="${LBL - 8}" y="${y + 14}" text-anchor="end" class="dash-lbl">${esc(cut(r.cust))}</text><text x="${LBL + 6}" y="${y + 15}" class="dash-val">—</text>`;
    const v = x(r.gpPct), w = Math.abs(v - zero);
    return `<g>
      <text x="${LBL - 8}" y="${y + 14}" text-anchor="end" class="dash-lbl"><title>${esc(r.cust)}</title>${esc(cut(r.cust))}</text>
      <rect x="${Math.min(v, zero).toFixed(1)}" y="${y + 4}" width="${Math.max(1, w).toFixed(1)}" height="14" rx="3" class="${r.gpPct < 0 ? 'dash-loss' : 'dash-gp'}"><title>${esc(r.cust)} · GP ${pct(r.gpPct)}</title></rect>
      <text x="${(Math.max(v, zero) + 6).toFixed(1)}" y="${y + 15}" class="dash-val">${pct(r.gpPct)}</text>
    </g>`;
  }).join('');
  const avgLine = avg === null ? '' : `<line x1="${x(avg).toFixed(1)}" y1="2" x2="${x(avg).toFixed(1)}" y2="${H - 2}" class="dash-avg"><title>GP % tổng hợp ${pct(avg)}</title></line>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="dash-svg" role="img" aria-label="${esc('GP % theo khách hàng')}"><line x1="${zero.toFixed(1)}" y1="2" x2="${zero.toFixed(1)}" y2="${H - 2}" class="dash-axis"/>${body}${avgLine}</svg>`;
}

const gpCls = (v, avg) => (v === null ? '' : v < 0 ? 'neg' : avg !== null && v < avg ? 'low' : 'ok');

// ---------------- columns of the detail tables
const COLS = [
  { key: 'rank', label: '#', type: 'int', width: 56 },
  { key: 'cust', label: 'Khách hàng', type: 'text', width: 230 },
  { key: 'qty', label: 'SL xuất (FIFO)', type: 'qty', width: 130 },
  { key: 'net', label: 'Doanh thu thuần', type: 'num', width: 160 },
  { key: 'share', label: 'Tỷ trọng DT', type: 'pct1', width: 120 },
  { key: 'cogs', label: 'Giá vốn', type: 'num', width: 150 },
  { key: 'gp', label: 'Lãi gộp', type: 'num', width: 150 },
  { key: 'gpPct', label: 'GP %', type: 'pct1', width: 110 },
];
const PCOLS = [
  { key: 'rank', label: '#', type: 'int', width: 56 },
  { key: 'prod', label: 'Mã sản phẩm', type: 'text', width: 150 },
  { key: 'name', label: 'Tên sản phẩm', type: 'text', width: 230 },
  { key: 'qty', label: 'SL xuất (FIFO)', type: 'qty', width: 130 },
  { key: 'net', label: 'Doanh thu thuần', type: 'num', width: 160 },
  { key: 'cogs', label: 'Giá vốn', type: 'num', width: 150 },
  { key: 'gp', label: 'Lãi gộp', type: 'num', width: 150 },
  { key: 'gpPct', label: 'GP %', type: 'pct1', width: 110 },
];

// ---------------- data of other periods (trend GP, previous-period comparison)
async function loadHistory(period, el) {
  if (loading === period) return;
  const known = new Set(A.periods ? A.periods() : []);
  const prev = prevMonth(period), y = period.slice(0, 4);
  const want = [...known].filter((p) => p < period && p.slice(0, 4) === y);
  if (known.has(prev)) want.push(prev);
  const todo = [...new Set(want)].filter((p) => !HIST.has(p));
  if (!todo.length) return;
  loading = period;
  try {
    for (const p of todo) {
      let r = null;
      // STEP 5 of the period on this device; the previous period is also looked up on the cloud when this device has nothing
      try { r = A.loadStep5 ? await A.loadStep5(p) : null; } catch { r = null; }
      if (!(r && r.period === p) && p === prev && A.loadPeriodData) { try { const d = await A.loadPeriodData(p); r = d && d.step5; } catch { r = null; } }
      HIST.set(p, r && r.period === p ? r : null);
    }
  } finally { loading = ''; }
  if (el.isConnected && A.S.period === period) view(el);
}

/** Totals of a STEP 5 result under the current filter. */
const totalsOf = (res) => { const pl = res ? customerPL(filterRes(res, F)) : null; return pl ? pl.total : null; };

export function view(el) {
  const S = A.S; const D5 = A.derived().d5; const res0 = D5 ? D5.res : null;
  if (F.period !== S.period) { F.period = S.period; F.cust = ''; F.prod = ''; HIST.clear(); }
  const full = customerPL(res0);
  const head = (right) => `<header class="ph dx-head"><div><h1>Dashboard điều hành · Doanh thu & lãi gộp</h1><p class="lead">Kỳ ${esc(S.period)} · theo khách hàng và sản phẩm · lấy từ STEP 5 (FIFO COGS). Lãi gộp = doanh thu thuần − giá vốn; chưa trừ dự phòng TK 2294 (màn 5P).</p></div>${right || ''}</header>`;
  if (!full) {
    el.innerHTML = `<section class="page">${head('')}${A.emptyNote('Chưa có kết quả FIFO COGS (STEP 5.2) của kỳ này nên chưa có doanh thu và giá vốn theo khách hàng.', 'step5', 'Mở STEP 5.2')}</section>`;
    return;
  }
  if (F.cust && !full.rows.some((r) => r.cust === F.cust)) F.cust = '';
  const prods0 = productPL(res0).rows;
  if (F.prod && !prods0.some((r) => r.prod === F.prod)) F.prod = '';
  const filtered = !!(F.cust || F.prod);
  const res = filterRes(res0, F);
  const pl = customerPL(res), pp = productPL(res);
  const t = pl.total;
  const [yy, mm] = S.period.split('-').map(Number);
  const prev = prevMonth(S.period);

  // ---- comparisons: previous period (STEP 5 when available, else the Sales Database), same month last year (Sales Database)
  const db = monthlyRevenue(S.d.salesDB, S.d.returnsDB, F);
  const prevRes = HIST.get(prev) || null;
  const comparisonSource = prevRes ? 'STEP 5 kỳ trước' : 'Sales Database kỳ trước · chỉ dùng đối chiếu doanh thu';
  const pT = totalsOf(prevRes);
  const pDb = db.get(prev) || null;
  const prevNet = pT ? pT.net : pDb ? pDb.net : null;
  const prevQty = pT ? pT.qty : pDb ? pDb.qty : null;
  const lyDb = db.get(`${yy - 1}-${String(mm).padStart(2, '0')}`) || null;
  let ytd = 0, ytdLy = 0, hasLy = false;
  for (let m = 1; m <= mm; m++) {
    const k = `${yy}-${String(m).padStart(2, '0')}`, kl = `${yy - 1}-${String(m).padStart(2, '0')}`;
    ytd += m === mm ? t.net : (db.get(k) || { net: 0 }).net;
    if (db.has(kl)) { hasLy = true; ytdLy += db.get(kl).net; }
  }
  // Company-wide VND / quantity is misleading when the mix has different products or UOM.
  const unit = comparableAverageUnit(res);
  const price = unit.value;
  const pUnit = comparableAverageUnit(prevRes);
  const pPrice = pUnit.value;
  const [py, pm] = prev.split('-').map(Number);
  const vsPrev = py === yy ? `so với T${pm}` : `so với T${pm}/${py}`;
  const fmtG = (g) => (g === null ? 'chưa có số kỳ trước' : pct(g));
  const kpis = [
    card({ ic: 'rev', tone: 'info', label: 'Doanh thu thuần', value: short(t.net), full: `${money(t.net)} VND`, delta: growth(t.net, prevNet), deltaTxt: fmtG(growth(t.net, prevNet)), vs: vsPrev }),
    card({ ic: 'gp', tone: 'pass', label: 'Lãi gộp', value: short(t.gp), full: `${money(t.gp)} VND`, delta: pT ? growth(t.gp, pT.gp) : null, deltaTxt: pT ? pct(growth(t.gp, pT.gp)) : 'chưa có STEP 5 kỳ trước', vs: vsPrev }),
    card({ ic: 'pct', tone: 'rerun', label: 'GP %', value: pct(t.gpPct), full: 'Lãi gộp / doanh thu thuần', delta: pT && t.gpPct !== null && pT.gpPct !== null ? t.gpPct - pT.gpPct : null, deltaTxt: pT && t.gpPct !== null && pT.gpPct !== null ? `${nf((t.gpPct - pT.gpPct) * 100, 1)} điểm %` : 'chưa có STEP 5 kỳ trước', vs: vsPrev }),
    card({ ic: 'up', tone: 'review', label: 'Tăng trưởng DT cùng kỳ', value: lyDb ? pct(growth(t.net, lyDb.net)) : '—', full: lyDb ? `T${mm}/${yy - 1}: ${short(lyDb.net)}` : `Chưa có doanh thu T${mm}/${yy - 1}`, delta: hasLy ? growth(ytd, ytdLy) : null, deltaTxt: hasLy ? pct(growth(ytd, ytdLy)) : '—', vs: 'lũy kế năm' }),
    card({ ic: 'box', tone: 'accent', label: 'SL bán (FIFO)', value: nf(t.qty, 0), full: 'Đơn vị · sau hàng trả lại', delta: growth(t.qty, prevQty), deltaTxt: fmtG(growth(t.qty, prevQty)), vs: vsPrev }),
    card({ ic: 'tag', tone: 'block', label: 'Giá bán BQ / đơn vị', value: price === null ? '—' : nf(price, 0), full: unit.label, delta: growth(price, pPrice), deltaTxt: fmtG(growth(price, pPrice)), vs: vsPrev }),
  ].join('');

  // ---- monthly trend of the year
  const pts = [];
  for (let m = 1; m <= 12; m++) {
    const k = `${yy}-${String(m).padStart(2, '0')}`, kl = `${yy - 1}-${String(m).padStart(2, '0')}`;
    const h = m === mm ? t : m < mm ? totalsOf(HIST.get(k)) : null;
    pts.push({
      m,
      cur: m === mm ? t.net : m < mm ? (h ? h.net : db.has(k) ? db.get(k).net : null) : null,
      last: db.has(kl) ? db.get(kl).net : null,
      gp: h ? h.gp : null, gpPct: h ? h.gpPct : null,
    });
  }
  const gpMonths = pts.filter((p) => p.gp !== null).length;

  // ---- plan
  const plan = S.d.dashPlan && S.d.dashPlan.period === S.period ? S.d.dashPlan : null;
  const ratio = plan && !filtered && plan.revenue > 0 ? t.net / plan.revenue : null;
  const planBox = filtered
    ? `<p class="muted">Kế hoạch áp dụng cho toàn công ty. Bỏ bộ lọc để xem mức đạt kế hoạch.</p>`
    : `${gauge(ratio)}
      <div class="dx-g-stats">
        <div><b>${esc(short(t.net))}</b><span>Thực tế</span></div>
        <div><b>${esc(plan ? short(plan.revenue) : '—')}</b><span>Kế hoạch</span></div>
        <div><b class="${plan ? (t.net - plan.revenue >= 0 ? 'pos' : 'neg') : ''}">${esc(plan ? short(t.net - plan.revenue) : '—')}</b><span>Chênh lệch</span></div>
      </div>
      ${plan && plan.gpPct !== null && plan.gpPct !== undefined ? `<p class="muted dx-center">GP % kế hoạch ${pct(plan.gpPct)} · thực tế <b class="${t.gpPct !== null && t.gpPct >= plan.gpPct ? 'pos' : 'neg'}">${pct(t.gpPct)}</b></p>` : ''}
      <details class="dx-plan"${plan ? '' : ' open'}><summary>${plan ? 'Sửa kế hoạch kỳ' : 'Đặt kế hoạch kỳ'}</summary>
        <div class="dx-plan-f">
          <label>Doanh thu thuần kế hoạch (VND) <input id="dx-plan-rev" type="text" inputmode="numeric" autocomplete="off" value="${plan ? money(plan.revenue) : ''}"></label>
          <label>GP % kế hoạch <input id="dx-plan-gp" type="text" inputmode="decimal" autocomplete="off" value="${plan && plan.gpPct !== null && plan.gpPct !== undefined ? nf(plan.gpPct * 100, 1) : ''}"></label>
          <button class="btn" type="button" id="dx-plan-save">Lưu kế hoạch</button>
        </div>
        ${plan ? `<p class="muted">Cập nhật ${esc(plan.by || '')} · ${esc(A.fmtTs ? A.fmtTs(plan.at) : plan.at || '')}</p>` : ''}
      </details>`;

  // ---- rankings
  const avg = t.gpPct;
  const topC = pl.rows.slice(0, 8);
  const topP = pp.rows.slice(0, 8);
  const maxP = Math.max(1, ...topP.map((r) => Math.abs(r.net)));
  const posRows = pl.rows.filter((r) => r.net > TOL);
  const mixTop = posRows.slice(0, 5), rest = posRows.slice(5).reduce((a, r) => a + r.net, 0);
  const mixTotal = posRows.reduce((a, r) => a + r.net, 0);
  const mix = [...mixTop.map((r) => ({ label: r.cust, v: r.net })), ...(rest > TOL ? [{ label: 'Khác', v: rest }] : [])];
  const lowGp = pp.rows.filter((r) => r.net > TOL && r.gpPct !== null).sort((a, b) => a.gpPct - b.gpPct).slice(0, 6);

  // ---- checks
  const quality = dashboardQuality(res0, D5 && D5.fresh || 'CURRENT');
  const bridge = gpBridge(res, prevRes ? filterRes(prevRes, F) : null);
  const alerts = profitSignals(res);
  const invoiceRows = F.detail ? invoiceDetail(res, F) : [];
  const invoiceCols = [
    { key:'row', label:'#', type:'int', width:50 },
    { key:'customer', label:'Khách hàng', type:'text', width:190 },
    { key:'product', label:'Mã SP', type:'text', width:110 },
    { key:'invoice', label:'Hóa đơn', type:'text', width:140 },
    { key:'account', label:'TK', type:'text', width:60 },
    { key:'quantity', label:'SL', type:'qty', width:95 },
    { key:'revenue', label:'Doanh thu', type:'num', width:165 },
    { key:'cogs', label:'Giá vốn', type:'num', width:165 },
    { key:'profit', label:'Chênh lệch DT–GV', type:'num', width:165 },
    { key:'status', label:'Trạng thái', type:'text', width:105 },
  ];
  const jc = journalCheck({ r5: res0 });
  const allChecks = [...full.checks, { id: 'je07', label: 'JE07 theo khách hàng = JE07 (giá vốn bán hàng)', expected: jc.expected, actual: jc.actual, status: jc.status }];
  const worst = allChecks.some((c) => c.status === 'CHECK') ? 'CHECK' : allChecks.some((c) => c.status === 'REVIEW') ? 'REVIEW' : 'PASS';
  const qualityBox = `<section class="dx-quality" aria-label="Data Quality">
    <div class="dx-quality-top"><div><span class="dx-eyebrow">DATA QUALITY & INSIGHTS</span>
      <h2>Chất lượng dữ liệu và cảnh báo</h2><p>Đọc trực tiếp từ STEP 5 · Không thay đổi kết quả giá thành hoặc hạch toán</p></div>
      <span class="dx-quality-status ${quality.status.toLowerCase()}">${quality.status === 'PASS' ? 'Đã kiểm tra' : quality.status === 'BLOCK' ? 'Cần xử lý' : 'Cần rà soát'} · ${quality.issues.length}</span></div>
    ${quality.issues.length ? `<div class="dx-insight-grid">${quality.issues.slice(0, 6).map((i) =>
      `<div class="dx-insight ${i.severity}"><span class="dx-insight-icon" aria-hidden="true">${i.severity === 'critical' ? '!' : 'i'}</span><div><b>${esc(i.title)}</b><p>${esc(i.detail)}</p></div></div>`).join('')}</div>`
      : '<div class="dx-quality-ok">Không phát hiện bất thường trong các kiểm tra tự động hiện có.</div>'}
    <p class="dx-quality-note">${esc(quality.note)}</p>
   </section>`;
  const intelBox = `<section class="card dx-card dx-intel" aria-label="Phân tích biến động lợi nhuận">
    <div class="dx-ch"><h2>Phân tích biến động lợi nhuận gộp</h2></div>
    ${bridge ? `<div class="dx-bridge">
      <div><small>GP kỳ trước (STEP 5)</small><b>${esc(short(bridge.oldGP))}</b></div>
      <div><small>Thay đổi doanh thu</small><b class="${bridge.revenueEffect>=0?'pos':'neg'}">${esc(short(bridge.revenueEffect))}</b></div>
      <div><small>Tác động biến động COGS</small><b class="${bridge.cogsEffect>=0?'pos':'neg'}">${esc(short(bridge.cogsEffect))}</b></div>
      <div><small>GP kỳ hiện tại</small><b>${esc(short(bridge.newGP))}</b></div>
    </div><p class="muted dx-note">${esc(bridge.note)} ${bridge.reconciles?'Cầu nối khớp.':'CẦN KIỂM TRA CHÊNH LỆCH.'}</p>`
      : '<p class="muted">Chưa có STEP 5 kỳ trước đủ điều kiện so sánh; không tự suy diễn nguyên nhân biến động GP.</p>'}
    ${alerts.length ? `<div class="dx-intel-alert"><b>${alerts.length} giao dịch cần kiểm tra COGS/GP</b><p>${esc(alerts.slice(0,3).map(x=>x.invoice+' ('+x.product+')').join(' · '))}</p></div>` : ''}
  </section>`;
  const stale = D5 && D5.fresh && D5.fresh !== 'CURRENT' ? `<div class="alert review"><b>Số liệu STEP 5.2 có thể đã cũ</b> <span>${esc(D5.stale || D5.fresh)}</span>. Chạy lại STEP 5.2 để dashboard khớp với dữ liệu hiện tại.</div>` : '';

  const filters = `<div class="dx-filters" role="group" aria-label="${esc('Bộ lọc')}">
      <span class="dx-chip"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Kỳ ${esc(S.period)}</span>
      <label class="dx-sel"><span>Khách hàng</span><select id="dx-cust"><option value="">Tất cả khách hàng</option>${full.rows.map((r) => `<option ${r.cust === F.cust ? 'selected' : ''} value="${esc(r.cust)}">${esc(r.cust)}</option>`).join('')}</select></label>
      <label class="dx-sel"><span>Sản phẩm</span><select id="dx-prod"><option value="">Tất cả sản phẩm</option>${prods0.map((r) => `<option ${r.prod === F.prod ? 'selected' : ''} value="${esc(r.prod)}">${esc(r.prod)}${r.name ? ` · ${esc(cut(r.name, 30))}` : ''}</option>`).join('')}</select></label>
      <button class="btn ghost" type="button" id="dx-reset"${filtered ? '' : ' disabled'}>↺ Đặt lại</button>
      <button class="btn" type="button" id="dash-export">Xuất Excel · Bảng tổng hợp hạch toán</button>
    </div>`;

  el.innerHTML = `<section class="page dx">
    ${head(filters)}
    ${stale}
    ${filtered ? `<div class="alert info dx-filtered">Đang lọc: ${F.cust ? `khách hàng <b>${esc(F.cust)}</b>` : ''}${F.cust && F.prod ? ' · ' : ''}${F.prod ? `sản phẩm <b>${esc(F.prod)}</b>` : ''}. Tiêu dùng nội bộ không thuộc khách hàng / bán hàng nên không nằm trong số liệu lọc.</div>` : ''}
    <div class="dx-section-label"><div><span class="dx-eyebrow">FINANCIAL SNAPSHOT</span><h2>Tổng quan hiệu quả kinh doanh</h2></div><span class="dx-unit-label">VND · kỳ ${esc(S.period)}</span></div>
    <div class="dx-kpis">${kpis}</div>
    <p class="dx-source-line">Nguồn so sánh: ${esc(comparisonSource)} · GP kỳ trước chỉ hiển thị khi có STEP 5 · Nhấn tên khách hàng / mã sản phẩm để truy xuất hóa đơn.</p>
    ${qualityBox}
    ${intelBox}

    <div class="dx-section-label"><div><span class="dx-eyebrow">PERFORMANCE</span><h2>Xu hướng và kế hoạch</h2></div></div>
    <div class="dx-row r-trend">
      <section class="card dx-card"><div class="dx-ch"><h2>Xu hướng doanh thu theo tháng · ${yy}</h2></div>
        <p class="muted dash-legend"><span><i class="dx-k-cur"></i>Doanh thu thuần ${yy}</span><span><i class="dx-k-last"></i>Năm ${yy - 1}</span><span><i class="dash-gp"></i>Lãi gộp (kỳ đã có STEP 5)</span></p>
        <div class="dash-scroll">${chartTrend(pts, mm)}</div>
        <p class="muted dx-note">Doanh thu các tháng lấy từ Sales / Returns Database; tháng ${esc(S.period)} lấy từ STEP 5. Lãi gộp có ở ${gpMonths} tháng (kỳ đã chạy STEP 5 trên máy này)${loading ? ' · đang tải dữ liệu các kỳ trước…' : ''}.</p>
      </section>
      <section class="card dx-card dx-plan-card"><div class="dx-ch"><h2>Mức đạt kế hoạch</h2></div>${planBox}</section>
    </div>

    <div class="dx-section-label"><div><span class="dx-eyebrow">PROFITABILITY</span><h2>Hiệu quả khách hàng và sản phẩm</h2></div></div>
    <div class="dx-row r-2">
      <section class="card dx-card"><div class="dx-ch"><h2>GP % theo khách hàng · Top ${Math.min(10, pl.rows.length)}</h2></div>
        <p class="muted dash-legend"><span><i class="dash-gp"></i>GP % dương</span><span><i class="dash-loss"></i>GP % âm</span><span><i class="dash-avg-k"></i>GP % tổng hợp</span></p>
        ${pl.rows.length ? `<div class="dash-scroll">${chartGp(pl.rows.slice(0, 10), avg)}</div>` : A.emptyNote('Chưa có khách hàng trong kỳ.')}
      </section>
      <section class="card dx-card"><div class="dx-ch"><h2>Top sản phẩm theo doanh thu</h2></div>
        ${topP.length ? `<ol class="dx-bars">${topP.map((r, i) => `<li><span class="dx-rank">${i + 1}</span><button type="button" class="dx-name dx-drill-action" data-dx-prod="${esc(r.prod)}" aria-label="Lọc sản phẩm ${esc(r.prod)}" title="${esc(r.name)}">${esc(r.prod)}<small>${esc(cut(r.name || '', 34))}</small></button><span class="dx-track"><i style="width:${(Math.max(0, r.net) / maxP * 100).toFixed(1)}%"></i></span><b>${esc(short(r.net))}</b><em class="dx-gpp ${gpCls(r.gpPct, avg)}">${pct(r.gpPct)}</em></li>`).join('')}</ol>` : A.emptyNote('Chưa có sản phẩm trong kỳ.')}
      </section>
    </div>

    <div class="dx-row r-3">
      <section class="card dx-card"><div class="dx-ch"><h2>Top khách hàng theo doanh thu</h2></div>
        <div class="dash-scroll"><table class="cp dx-t"><thead><tr><th>Khách hàng</th><th class="r">Doanh thu</th><th class="r">% DT</th><th class="r">Lãi gộp</th><th class="r">GP %</th></tr></thead><tbody>
          ${topC.map((r) => `<tr><td><button type="button" class="dx-drill-action dx-customer-link" data-dx-cust="${esc(r.cust)}" title="Xem khách hàng ${esc(r.cust)}">${esc(cut(r.cust, 28))}</button></td><td class="r">${esc(short(r.net))}</td><td class="r">${pct(Math.abs(t.net) > TOL ? r.net / t.net : null)}</td><td class="r">${esc(short(r.gp))}</td><td class="r"><em class="dx-gpp ${gpCls(r.gpPct, avg)}">${pct(r.gpPct)}</em></td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="card dx-card"><div class="dx-ch"><h2>Cơ cấu doanh thu theo khách hàng</h2></div>
        ${mix.length ? `<div class="dx-mix">${donut(mix, mixTotal)}<ul class="dx-legend">${mix.map((p, i) => `<li><i class="dx-seg-k ${MIX_CLS[i % MIX_CLS.length]}"></i><span title="${esc(p.label)}">${esc(cut(p.label, 30))}</span><b>${esc(short(p.v))}</b><small>${pct(mixTotal > 0 ? p.v / mixTotal : null)}</small></li>`).join('')}</ul></div>` : A.emptyNote('Chưa có doanh thu dương trong kỳ.')}
      </section>
      <section class="card dx-card"><div class="dx-ch"><h2>Sản phẩm GP % thấp nhất</h2></div>
        ${lowGp.length ? `<table class="cp dx-t"><thead><tr><th>Sản phẩm</th><th class="r">Doanh thu</th><th class="r">Lãi gộp</th><th class="r">GP %</th></tr></thead><tbody>
          ${lowGp.map((r) => `<tr><td><button type="button" class="dx-drill-action dx-customer-link" data-dx-prod="${esc(r.prod)}" title="Xem sản phẩm ${esc(r.prod)}">${esc(r.prod)}</button></td><td class="r">${esc(short(r.net))}</td><td class="r">${esc(short(r.gp))}</td><td class="r"><em class="dx-gpp ${gpCls(r.gpPct, avg)}">${pct(r.gpPct)}</em></td></tr>`).join('')}
        </tbody></table><p class="muted dx-note">Đỏ: lỗ gộp · cam: dưới GP % tổng hợp (${pct(avg)}).</p>` : A.emptyNote('Chưa có sản phẩm trong kỳ.')}
      </section>
    </div>

    <div class="dx-section-label"><div><span class="dx-eyebrow">FINANCIAL DETAIL</span><h2>Dữ liệu chi tiết</h2></div></div>
    <section class="card dash-table"><h2>Chi tiết theo khách hàng</h2>
      <p class="muted">Sắp xếp theo doanh thu thuần. Dòng tiêu dùng nội bộ không thuộc khách hàng nào; giá vốn của nó nằm trong tổng 632.</p>
      <div id="dash-tbl"></div>
    </section>
    <section class="card dash-table"><h2>Chi tiết theo sản phẩm</h2>
      <p class="muted">Doanh thu, giá vốn FIFO và lãi gộp của từng mã sản phẩm (hàng trả lại trừ vào sản phẩm của nó).</p>
      <div id="dash-ptbl"></div>
    </section>
    <section class="card dx-drill"><div class="dx-ch dx-drill-head"><h2>Truy xuất hóa đơn và giá vốn từ STEP 5</h2>
      <button class="btn ghost" type="button" id="dx-toggle-detail">${F.detail ? 'Ẩn chi tiết giao dịch' : 'Xem chi tiết hóa đơn & FIFO'}</button></div>
      <p class="muted">Bảng truy vết đọc trực tiếp các dòng STEP 5, không sửa dữ liệu. Mã lô FIFO chỉ hiển thị khi dữ liệu nguồn có trường nhận diện.</p>
      ${F.detail ? '<div id="dx-invoice-table"></div>' : ''}
    </section>
    <section class="card"><h2>Đối chiếu</h2>
      <p class="muted">Trạng thái tổng hợp: ${A.pill(worst)}${filtered ? ' · kiểm tra trên toàn kỳ, không theo bộ lọc' : ''}</p>
      <div class="dash-scroll"><table class="cp"><thead><tr><th>Kiểm tra</th><th class="r">Kỳ vọng</th><th class="r">Thực tế</th><th class="r">Chênh</th><th>Trạng thái</th></tr></thead><tbody>
        ${allChecks.map((c) => `<tr><td>${esc(c.label)}</td><td class="r">${money(c.expected)}</td><td class="r">${money(c.actual)}</td><td class="r">${money(c.actual - c.expected)}</td><td>${A.pill(c.status)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </section>`;

  const crow = [...pl.rows.map((r, i) => ({ rank: i + 1, cust: r.cust, qty: r.qty, net: r.net, share: Math.abs(t.net) > TOL ? r.net / t.net : null, cogs: r.cogs, gp: r.gp, gpPct: r.gpPct }))];
  if (!filtered) crow.push({ rank: '—', cust: pl.cons.cust, qty: null, net: 0, share: null, cogs: pl.cons.cogs, gp: pl.cons.gp, gpPct: null });
  A.mountTable(el.querySelector('#dash-tbl'), { columns: COLS, rows: crow, height: 460, totals: ['qty', 'net', 'cogs', 'gp'], onExport: A.exportTable('Dashboard_KhachHang', COLS) });
  const prow = pp.rows.map((r, i) => ({ rank: i + 1, prod: r.prod === NO_PROD ? r.prod : r.prod, name: r.name, qty: r.qty, net: r.net, cogs: r.cogs, gp: r.gp, gpPct: r.gpPct }));
  A.mountTable(el.querySelector('#dash-ptbl'), { columns: PCOLS, rows: prow, height: 460, totals: ['qty', 'net', 'cogs', 'gp'], onExport: A.exportTable('Dashboard_SanPham', PCOLS) });

  if (F.detail) A.mountTable(el.querySelector('#dx-invoice-table'), {
    columns: invoiceCols, rows: invoiceRows, height: 520,
    onExport: A.exportTable('Dashboard_Invoice_Detail', invoiceCols),
  });
  const on = (sel, ev, fn) => { const n = el.querySelector(sel); if (n) n.addEventListener(ev, fn); };
  on('#dx-cust', 'change', (e) => { F.cust = e.target.value; view(el); });
  on('#dx-prod', 'change', (e) => { F.prod = e.target.value; view(el); });
  on('#dx-reset', 'click', () => { F.cust = ''; F.prod = ''; view(el); });
  on('#dx-toggle-detail', 'click', () => { F.detail = !F.detail; view(el); });
  // Event delegation survives dashboard re-render. Each click selects the entity and opens
  // the existing STEP 5 invoice detail, without changing original costing/revenue lines.
  el.querySelectorAll('[data-dx-cust], [data-dx-prod]').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.hasAttribute('data-dx-cust')) { F.cust = btn.getAttribute('data-dx-cust'); F.prod = ''; }
    else { F.prod = btn.getAttribute('data-dx-prod'); F.cust = ''; }
    F.detail = true;
    view(el);
    el.querySelector('.dx-drill')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }));
  on('#dash-export', 'click', () => A.exportHachToan());
  on('#dx-plan-save', 'click', () => savePlan(el));
  loadHistory(S.period, el);
}

function savePlan(el) {
  if (A.guardEdit && !A.guardEdit()) return;
  if (A.closedGuard && A.closedGuard()) return;
  const rev = A.parseNum(el.querySelector('#dx-plan-rev').value, 'Doanh thu kế hoạch');
  if (rev === undefined) return;
  const gpTxt = el.querySelector('#dx-plan-gp').value.trim();
  const gp = gpTxt === '' ? null : A.parseNum(gpTxt, 'GP % kế hoạch');
  if (gp === undefined) return;
  if (!(rev > 0)) { A.toast('Nhập doanh thu thuần kế hoạch lớn hơn 0.', 'review'); return; }
  if (gp !== null && !(Number.isFinite(gp) && gp > -100 && gp < 100)) { A.toast('GP % kế hoạch phải nằm trong khoảng −100 đến 100.', 'review'); return; }
  const S = A.S;
  S.d.dashPlan = { period: S.period, revenue: rev, gpPct: gp === null ? null : gp / 100, by: A.who ? A.who() : '', at: new Date().toISOString() };
  A.audit('DASHBOARD - KẾ HOẠCH KỲ', `Doanh thu thuần ${A.fmtNum(rev)}${gp === null ? '' : `; GP % ${gp}`}`);
  A.markDirty('dashPlan', 'audit');
  A.toast('Đã lưu kế hoạch kỳ.', 'pass');
  view(el);
}
