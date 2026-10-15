// Dashboard doanh thu · giá vốn · lãi gộp theo khách hàng (v1.14.79).
// Reads the STEP 5 result through engine/custpl.js (the same numbers as the bút toán and the export):
//   KPI strip · revenue / COGS / gross profit of the top customers · GP % by customer · full ranking · checks.
import { customerPL, CONS_LABEL } from '../engine/custpl.js';
import { journalCheck } from '../engine/journal.js';

let A = null;
export function install(api) { A = api; }
const esc = (v) => A.esc(v);
const TOP = 12;
const money = (v) => A.fmtNum(v);
const pct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const short = (s, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

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

/** KPI card with a percentage value. */
function kpiPct(label, v, tone, sub, strong = false) {
  return `<div class="kpi t-${tone} ${strong ? 'strong' : ''}"><span>${esc(label)}</span><b class="${v !== null && v < 0 ? 'bad' : ''}">${pct(v)}</b><small>${esc(sub)}</small></div>`;
}

/** Horizontal stacked bars: cost (muted) + gross profit (accent); a loss is drawn in red after the cost. */
function chartRevenue(rows) {
  const LBL = 190, BAR = 380, RH = 26, W = LBL + BAR + 70, H = rows.length * RH + 14;
  const maxV = Math.max(1, ...rows.map((r) => Math.max(r.net, r.cogs, 0)));
  const k = BAR / maxV;
  const body = rows.map((r, i) => {
    const y = 8 + i * RH;
    const cw = Math.max(0, r.cogs) * k, gw = Math.max(0, r.gp) * k, lw = Math.max(0, -r.gp) * k;
    return `<g>
      <text x="${LBL - 8}" y="${y + 14}" text-anchor="end" class="dash-lbl"><title>${esc(r.cust)}</title>${esc(short(r.cust))}</text>
      <rect x="${LBL}" y="${y + 4}" width="${cw.toFixed(1)}" height="14" rx="2" class="dash-cogs"><title>${esc(r.cust)} · Giá vốn ${money(r.cogs)}</title></rect>
      <rect x="${(LBL + cw).toFixed(1)}" y="${y + 4}" width="${gw.toFixed(1)}" height="14" rx="2" class="dash-gp"><title>${esc(r.cust)} · Lãi gộp ${money(r.gp)}</title></rect>
      ${lw ? `<rect x="${(LBL + cw).toFixed(1)}" y="${y + 4}" width="${lw.toFixed(1)}" height="14" rx="2" class="dash-loss"><title>${esc(r.cust)} · Lỗ gộp ${money(r.gp)}</title></rect>` : ''}
      <text x="${(LBL + cw + gw + lw + 6).toFixed(1)}" y="${y + 15}" class="dash-val">${pct(r.gpPct)}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="dash-svg" role="img" aria-label="${esc('Giá vốn và lãi gộp theo khách hàng')}">${body}</svg>`;
}

/** GP % by customer on one axis; the dashed line is the company's overall GP %. */
function chartGp(rows, avg) {
  const LBL = 190, BAR = 380, RH = 26, W = LBL + BAR + 70, H = rows.length * RH + 14;
  const vals = rows.map((r) => (r.gpPct === null ? 0 : r.gpPct)).concat([0, avg === null ? 0 : avg]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (v) => LBL + ((v - lo) / span) * BAR;
  const zero = x(0);
  const body = rows.map((r, i) => {
    const y = 8 + i * RH;
    if (r.gpPct === null) return `<text x="${LBL - 8}" y="${y + 14}" text-anchor="end" class="dash-lbl">${esc(short(r.cust))}</text><text x="${LBL + 6}" y="${y + 15}" class="dash-val">—</text>`;
    const v = x(r.gpPct), w = Math.abs(v - zero);
    const cls = r.gpPct < 0 ? 'dash-loss' : 'dash-gp';
    return `<g>
      <text x="${LBL - 8}" y="${y + 14}" text-anchor="end" class="dash-lbl"><title>${esc(r.cust)}</title>${esc(short(r.cust))}</text>
      <rect x="${Math.min(v, zero).toFixed(1)}" y="${y + 4}" width="${Math.max(1, w).toFixed(1)}" height="14" rx="2" class="${cls}"><title>${esc(r.cust)} · GP ${pct(r.gpPct)}</title></rect>
      <text x="${(Math.max(v, zero) + 6).toFixed(1)}" y="${y + 15}" class="dash-val">${pct(r.gpPct)}</text>
    </g>`;
  }).join('');
  const avgLine = avg === null ? '' : `<line x1="${x(avg).toFixed(1)}" y1="2" x2="${x(avg).toFixed(1)}" y2="${H - 2}" class="dash-avg"><title>GP % tổng hợp ${pct(avg)}</title></line>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="dash-svg" role="img" aria-label="${esc('GP % theo khách hàng')}"><line x1="${zero.toFixed(1)}" y1="2" x2="${zero.toFixed(1)}" y2="${H - 2}" class="dash-axis"/>${body}${avgLine}</svg>`;
}

export function view(el) {
  const S = A.S; const D5 = A.derived().d5; const res = D5 ? D5.res : null;
  const pl = customerPL(res);
  const head = `<header class="ph"><div><h1>Dashboard · Doanh thu, giá vốn, lãi gộp</h1><p class="lead">Kỳ ${esc(S.period)} · theo khách hàng · lấy từ STEP 5 (FIFO COGS). Lãi gộp = doanh thu thuần − giá vốn; chưa trừ dự phòng TK 2294 (màn 5P).</p></div>${pl ? '<div><button class="btn" type="button" id="dash-export">Xuất Excel · Bảng tổng hợp hạch toán</button></div>' : ''}</header>`;
  if (!pl) {
    el.innerHTML = `<section class="page">${head}${A.emptyNote('Chưa có kết quả FIFO COGS (STEP 5.2) của kỳ này nên chưa có doanh thu và giá vốn theo khách hàng.', 'step5', 'Mở STEP 5.2')}</section>`;
    return;
  }
  const t = pl.total, cons = pl.cons;
  const top = pl.rows.slice(0, TOP);
  const top5 = pl.rows.slice(0, 5).reduce((a, r) => a + r.net, 0);
  const top5Share = Math.abs(t.net) > 1 ? top5 / t.net : null;
  const jc = journalCheck({ r5: res });
  const allChecks = [...pl.checks, { id: 'je07', label: 'JE07 theo khách hàng = JE07 (giá vốn bán hàng)', expected: jc.expected, actual: jc.actual, status: jc.status }];
  const worst = allChecks.some((c) => c.status === 'CHECK') ? 'CHECK' : allChecks.some((c) => c.status === 'REVIEW') ? 'REVIEW' : 'PASS';
  const op = (x) => `<i class="op" aria-hidden="true">${x}</i>`;
  const stale = D5 && D5.fresh && D5.fresh !== 'CURRENT' ? `<div class="alert review"><b>Số liệu STEP 5.2 có thể đã cũ</b> <span>${esc(D5.stale || D5.fresh)}</span>. Chạy lại STEP 5.2 để dashboard khớp với dữ liệu hiện tại.</div>` : '';
  const tableRows = [
    ...pl.rows.map((r, i) => ({ rank: i + 1, cust: r.cust, qty: r.qty, net: r.net, share: Math.abs(t.net) > 1 ? r.net / t.net : null, cogs: r.cogs, gp: r.gp, gpPct: r.gpPct })),
    { rank: '—', cust: cons.cust, qty: null, net: 0, share: null, cogs: cons.cogs, gp: cons.gp, gpPct: null },
  ];
  el.innerHTML = `<section class="page">
    ${head}
    ${stale}
    <div class="kpi-groups">
      <section class="kpi-group"><h3>Doanh thu → lãi gộp · kỳ ${esc(S.period)}</h3><div class="kpis kpi-flow">
        ${A.kpi('Doanh thu thuần', t.net, false, { tone: 'in', sub: 'Gộp − hàng trả lại − giảm giá' })}${op('−')}
        ${A.kpi('Giá vốn (632)', t.cogs, false, { tone: 'out', sub: 'FIFO, gồm tiêu dùng nội bộ' })}${op('=')}
        ${A.kpi('Lãi gộp', t.gp, true, { tone: 'res', sub: 'Trước dự phòng 2294' })}
      </div></section>
      <section class="kpi-group"><h3>Chỉ số tổng hợp</h3><div class="kpis wide">
        ${kpiPct('GP % tổng hợp', t.gpPct, 'res', 'Lãi gộp / doanh thu thuần', true)}
        ${A.kpi('Doanh thu gộp (511)', t.gross, false, { tone: 'base', sub: 'Trước hàng trả lại' })}
        ${A.kpi('Hàng trả lại & giảm giá', t.ret + t.disc, false, { tone: 'out', sub: 'TK 5212 · 5213' })}
        ${A.kpi('Tiêu dùng nội bộ (632 / 155)', cons.cogs, false, { tone: 'out', sub: 'Không thuộc khách hàng' })}
        ${A.kpi('Số khách hàng', pl.rows.length, false, { tone: 'cnt', sub: 'Có phát sinh trong kỳ' })}
        ${kpiPct('Top 5 chiếm DT thuần', top5Share, 'base', 'Tỷ trọng doanh thu thuần')}
      </div></section>
    </div>
    <div class="dash-grid">
      <section class="card"><h2>Giá vốn và lãi gộp · Top ${top.length} khách hàng</h2>
        <p class="muted dash-legend"><span><i class="dash-cogs"></i>Giá vốn</span><span><i class="dash-gp"></i>Lãi gộp</span><span><i class="dash-loss"></i>Lỗ gộp</span> · số cuối thanh là GP %</p>
        ${top.length ? `<div class="dash-scroll">${chartRevenue(top)}</div>` : A.emptyNote('Chưa có khách hàng trong kỳ.')}
      </section>
      <section class="card"><h2>GP % theo khách hàng · Top ${top.length}</h2>
        <p class="muted dash-legend"><span><i class="dash-gp"></i>GP % dương</span><span><i class="dash-loss"></i>GP % âm</span><span><i class="dash-avg-k"></i>GP % tổng hợp</span></p>
        ${top.length ? `<div class="dash-scroll">${chartGp(top, t.gpPct)}</div>` : A.emptyNote('Chưa có khách hàng trong kỳ.')}
      </section>
    </div>
    <section class="card dash-table"><h2>Chi tiết theo khách hàng</h2>
      <p class="muted">Sắp xếp theo doanh thu thuần. Dòng tiêu dùng nội bộ không thuộc khách hàng nào; giá vốn của nó nằm trong tổng 632.</p>
      <div id="dash-tbl"></div>
    </section>
    <section class="card"><h2>Đối chiếu</h2>
      <p class="muted">Trạng thái tổng hợp: ${A.pill(worst)}</p>
      <div class="dash-scroll"><table class="cp"><thead><tr><th>Kiểm tra</th><th class="r">Kỳ vọng</th><th class="r">Thực tế</th><th class="r">Chênh</th><th>Trạng thái</th></tr></thead><tbody>
        ${allChecks.map((c) => `<tr><td>${esc(c.label)}</td><td class="r">${money(c.expected)}</td><td class="r">${money(c.actual)}</td><td class="r">${money(c.actual - c.expected)}</td><td>${A.pill(c.status)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </section>`;
  const box = el.querySelector('#dash-tbl');
  A.mountTable(box, { columns: COLS, rows: tableRows, height: 520, totals: ['qty', 'net', 'cogs', 'gp'], onExport: A.exportTable('Dashboard_KhachHang', COLS) });
  const btn = el.querySelector('#dash-export');
  if (btn) btn.addEventListener('click', () => A.exportHachToan());
}
