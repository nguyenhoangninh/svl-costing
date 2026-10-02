// "Truy xuất giá thành sản phẩm": one product's production cost (STEP 1–4) and cost of goods sold (STEP 5), with anomaly checks.
import * as TR from '../engine/trace.js';
import { num, prevPeriod, serialToISO, utxt } from '../engine/util.js';
import { fmtCell } from '../ui/format.js';

let A = null;
export function install(api) { A = api; }
const esc = (s) => A.esc(s);
const f0 = (x) => A.fmtNum(x);
const pc = (x) => (x === null || x === undefined || !isFinite(x) ? '–' : `${(x * 100).toFixed(1).replace('.', ',')}%`);
const tabsHTML = (cur, tabs, attr) => `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab ${id === cur ? 'on' : ''}" ${attr}="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join('')}</div>`;

// ---------------- caches (rebuilt when the period data changes)
let cache = { key: '', index: null, list: null, counts: null };
const priorCache = new Map();
function ctxBase() {
  const S = A.S; const D = A.derived();
  const fl = D.d4 ? D.d4.fl : null; const res = D.d5 ? D.d5.res : null;
  const key = [S.period, Object.keys(S.d.datasets).length, S.d.step4 && S.d.step4.runAt, res && res.runAt, S.d.wipadj && S.d.wipadj.control && S.d.wipadj.control.appliedAt].join('|');
  if (cache.key !== key) cache = { key, index: TR.buildIndex(S.d.datasets), list: null, counts: null };
  return { S, D, fl, res, index: cache.index };
}
function priorFor(prod) {
  const S = A.S; const p = prevPeriod(S.period);
  if (!priorCache.has(p)) {
    priorCache.set(p, 'loading');
    A.loadPeriodData(p).then((d) => { priorCache.set(p, d && d.step5 && d.step5.period === p ? d.step5 : null); if (S.view === 'trace') A.render(); }).catch(() => priorCache.set(p, null));
  }
  const prev = priorCache.get(p);
  return TR.priorFrom(prod, prev && prev !== 'loading' ? prev : null, S.d.fgOpen);
}
function traceOf(prod, b) {
  return TR.costTrace({ prod, fl: b.fl, index: b.index, step2: b.S.d.step2, engDyn: b.D.d3b ? b.D.d3b.engDyn : [], register: b.S.d.register, lotCheck: b.S.d.lotCheck, prior: priorFor(prod) });
}
const periodEnd = (p) => (Date.UTC(+p.slice(0, 4), +p.slice(5, 7), 0) - Date.UTC(1899, 11, 30)) / 86400000;

// ======================= view =======================
export function viewTrace(el) {
  const b = ctxBase(); const S = b.S;
  if (!b.fl && !b.res) { el.innerHTML = `<section class="page"><h1>Truy xuất giá thành sản phẩm</h1>${A.emptyNote('Cần chạy STEP 4 (và STEP 5 cho giá vốn) của kỳ này trước.', 'step4', 'Mở STEP 4')}</section>`; return; }
  if (!cache.list) cache.list = TR.productList({ fl: b.fl, res: b.res });
  const list = cache.list;
  const prod = S.traceProd && list.some((p) => p.prod === utxt(S.traceProd)) ? utxt(S.traceProd) : '';
  el.innerHTML = `<section class="page trace">
    <header class="ph"><div><h1>Truy xuất giá thành sản phẩm</h1><p class="lead">Chọn một mã thành phẩm để xem giá thành sản xuất kỳ ${esc(S.period)} đến từng lô PC và từng vật tư, giá vốn hàng bán đến từng lớp FIFO, kèm các điểm bất thường cần kiểm tra.</p></div></header>
    <form id="f-trace" class="trace-search" autocomplete="off"><input id="tr-q" list="tr-list" placeholder="Nhập mã hoặc tên sản phẩm…" value="${esc(prod)}" aria-label="Mã sản phẩm"><datalist id="tr-list">${list.map((p) => `<option value="${esc(p.prod)}">${esc(p.name)}</option>`).join('')}</datalist><button class="btn" type="submit">Truy xuất</button>${prod ? '<a class="btn ghost" href="#trace=">Danh sách sản phẩm</a>' : ''}</form>
    <div id="tr-body"></div></section>`;
  el.querySelector('#f-trace').addEventListener('submit', (e) => {
    e.preventDefault(); const q = el.querySelector('#tr-q').value.trim(); if (!q) return;
    const u = utxt(q); const hit = list.find((p) => p.prod === u) || list.find((p) => p.prod.includes(u) || utxt(p.name).includes(u));
    if (!hit) { A.toast(`Không tìm thấy sản phẩm "${q}" trong kỳ ${S.period}.`, 'review'); return; }
    location.hash = 'trace=' + encodeURIComponent(hit.prod);
  });
  const box = el.querySelector('#tr-body');
  if (!prod) return viewList(box, b, list);
  return viewProduct(box, b, prod);
}

function viewList(box, b, list) {
  if (!cache.counts) {
    cache.counts = new Map();
    for (const p of list) {
      const t = p.lots ? traceOf(p.prod, b) : null; const c = b.res ? TR.cogsTrace({ prod: p.prod, res: b.res, periodEnd: periodEnd(A.S.period) }) : null;
      const all = [...(t ? t.anomalies : []), ...(c ? c.anomalies : [])];
      cache.counts.set(p.prod, { review: all.filter((a) => a.level !== 'INFO').length, info: all.filter((a) => a.level === 'INFO').length });
    }
  }
  const rows = list.map((p) => { const c = cache.counts.get(p.prod) || {}; return { ...p, unit: p.qty ? p.cost / p.qty : null, gm: p.revenue ? (p.revenue - p.cogs) / p.revenue : null, review: c.review || 0, info: c.info || 0 }; });
  box.innerHTML = `<p class="muted">${rows.length} sản phẩm có sản xuất hoặc xuất bán trong kỳ. Bấm vào một dòng để xem chi tiết. Cột “Cần xem” đếm các điểm bất thường mức REVIEW (giá thành và giá vốn).</p><div id="tr-list-t"></div>`;
  const cols = [{ key: 'prod', label: 'Mã sản phẩm', width: 160, trace: true }, { key: 'name', label: 'Tên sản phẩm', width: 260 }, { key: 'review', label: 'Cần xem', type: 'int', width: 80 }, { key: 'lots', label: 'Số lô', type: 'int', width: 70 }, { key: 'qty', label: 'SL sản xuất', type: 'qty', width: 100 }, { key: 'cost', label: 'Giá thành SX', type: 'num', width: 140 }, { key: 'unit', label: 'Giá thành/đv', type: 'num', width: 120 },
    { key: 'soldQty', label: 'SL bán', type: 'qty', width: 90 }, { key: 'cogs', label: 'Giá vốn', type: 'num', width: 140 }, { key: 'revenue', label: 'Doanh thu VND', type: 'num', width: 140 }, { key: 'gm', label: 'Lãi gộp %', type: 'pct', width: 90 }, { key: 'closeQ', label: 'Tồn cuối SL', type: 'qty', width: 100 }, { key: 'closeA', label: 'Tồn cuối giá trị', type: 'num', width: 140 }];
  A.mountTable(box.querySelector('#tr-list-t'), { columns: cols, rows: rows.sort((a, b2) => b2.review - a.review || b2.cost - a.cost), height: 560, totals: ['qty', 'cost', 'soldQty', 'cogs', 'revenue', 'closeA'], onExport: A.exportTable('TRUY_XUAT_SAN_PHAM', cols), onRowClick: (r) => { location.hash = 'trace=' + encodeURIComponent(r.prod); } });
}

const anomStore = { cost: [], cogs: [] };
let curTrace = { t: null, c: null, prod: '' };
function anomaliesHTML(list, key) {
  anomStore[key] = list;
  if (!list.length) return '<div class="alert pass">Không phát hiện điểm bất thường theo các quy tắc kiểm tra.</div>';
  const nR = list.filter((a) => a.level !== 'INFO').length, nI = list.length - nR;
  const open = A.S['trOpen' + key];
  const shown = open ? list : list.slice(0, 8);
  return `<div class="anoms"><div class="anoms-h"><b>Điểm cần kiểm tra</b> ${nR ? A.pill(`REVIEW ${nR}`) : ''} ${nI ? `<span class="pill s-info">INFO ${nI}</span>` : ''}</div>
    <ul>${shown.map((a, i) => `<li class="an-${a.level.toLowerCase()}"><span class="an-area">${esc(a.area)}</span><span class="an-msg">${esc(a.msg)}</span>${a.kind ? `<button type="button" class="btn ghost sm an-more" data-an="${key}:${i}">Chi tiết</button>` : ''}</li>`).join('')}</ul>
    ${list.length > 8 ? `<button class="btn ghost sm" type="button" data-tr-more="${key}">${open ? 'Thu gọn' : `Xem tất cả ${list.length}`}</button>` : ''}</div>`;
}
function barHTML(parts, total) {
  const seg = parts.filter((p) => Math.abs(p.v) > 0.5);
  return `<div class="cbar" role="img" aria-label="Cơ cấu giá thành">${seg.map((p) => `<span style="flex:${Math.max(Math.abs(p.v), 0)};background:${p.c}" title="${esc(p.l)}: ${f0(p.v)} VND (${pc(total ? p.v / total : null)})"></span>`).join('')}</div>
    <div class="cbar-leg">${seg.map((p) => `<span><i style="background:${p.c}"></i>${esc(p.l)} <b>${f0(p.v)}</b> <small>${pc(total ? p.v / total : null)}</small></span>`).join('')}</div>`;
}

function viewProduct(box, b, prod) {
  const S = A.S; const tab = S.trTab || 'cost';
  const t = b.fl ? traceOf(prod, b) : null;
  const c = b.res ? TR.cogsTrace({ prod, res: b.res, periodEnd: periodEnd(S.period) }) : null;
  const name = (t && t.overview.name) || (c && c.overview.name) || '';
  box.innerHTML = `<div class="tr-head"><div><span class="tr-code">${esc(prod)}</span><span class="tr-name">${esc(name)}</span></div><button class="btn ghost" type="button" id="tr-export">Xuất Excel hồ sơ sản phẩm</button></div>
    ${tabsHTML(tab, [['cost', `Giá thành sản xuất${t ? ` (${t.lots.length} lô)` : ''}`], ['cogs', 'Giá vốn hàng bán'], ['trend', 'Qua các kỳ']], 'data-trtab')}<div id="tr-tab"></div>`;
  box.querySelectorAll('[data-trtab]').forEach((x) => x.addEventListener('click', () => { S.trTab = x.dataset.trtab; A.render(); }));
  box.querySelector('#tr-export').addEventListener('click', () => exportProduct(prod, t, c));
  const tb = box.querySelector('#tr-tab');
  if (tab === 'cost') costTab(tb, t, prod); else if (tab === 'cogs') cogsTab(tb, c); else trendTab(tb, prod, t, c);
  box.querySelectorAll('[data-tr-more]').forEach((x) => x.addEventListener('click', () => { S['trOpen' + x.dataset.trMore] = !S['trOpen' + x.dataset.trMore]; A.render(); }));
  curTrace = { t, c, prod };
  box.querySelectorAll('[data-an]').forEach((x) => x.addEventListener('click', () => { const [k, i] = x.dataset.an.split(':'); openDetail(anomStore[k][+i]); }));
}

function costTab(el, t, prod) {
  const S = A.S;
  if (!t || !t.lots.length) { el.innerHTML = A.emptyNote(`Kỳ ${S.period} không có lô sản xuất nào của ${prod} (sản phẩm chỉ có xuất bán từ tồn kho).`); return; }
  const o = t.overview; const pr = o.prior;
  const sub = S.trSub || 'lots';
  el.innerHTML = `<div class="kpis">${A.kpiN('Số lô / SL hoàn thành', `${o.nLots} lô · ${f0(o.qty)}`)}${A.kpi('Tổng giá thành', o.totalCost, true)}${A.kpi('Giá thành / đv', o.unit, true)}${A.kpi('NVL / đv', o.rmUnit)}${A.kpi('Nhân công 622 / đv', o.u622)}${A.kpi('SX chung 627 / đv', o.u627)}
      <div class="kpi"><span>So với ${pr ? esc(pr.period) : 'kỳ trước'}</span><b class="${o.priorChange > 0 ? 'bad' : 'good'}">${o.priorChange === undefined ? '—' : (o.priorChange > 0 ? '▲ ' : '▼ ') + pc(Math.abs(o.priorChange))}</b><small>${pr ? `${f0(pr.tot / pr.qty)}/đv · ${esc(pr.source)}` : 'chưa có số liệu'}</small></div>
      <div class="kpi"><span>Lãi gộp theo giá bán</span><b>${pc(o.gpPct)}</b><small>Giá ${A.fmtNum(o.price, 2)} USD · ${esc(o.priceSrc || '')}</small></div></div>
    <h2>Cơ cấu giá thành</h2>
    ${barHTML([{ l: 'NVL theo PC', v: o.pcRM, c: '#2f7d64' }, { l: 'Stock Out phân bổ', v: o.so, c: '#5fa88c' }, { l: 'Điều chỉnh WIP 3B', v: o.wipAdj, c: '#9cc9b7' }, { l: 'Rework chuyển vào', v: o.carryIn, c: '#c7e0d5' }, { l: 'Nhân công 622', v: o.t622, c: '#c58b2b' }, { l: 'SX chung 627', v: o.t627, c: '#7b6ab0' }], o.totalCost)}
    <p class="muted">NVL ${pc(o.rmPct)} · 622 ${pc(o.p622)} (trực tiếp ${f0(o.d622)}) · 627 ${pc(o.p627)} (trực tiếp ${f0(o.d627)}). 622/627 chung phân bổ theo đóng góp dương = doanh thu theo giá bán − NVL.</p>
    ${anomaliesHTML(t.anomalies, 'cost')}
    ${tabsHTML(sub, [['lots', `Lô PC (${t.lots.length})`], ['mats', `Vật tư (${t.materials.length})`], ['matlots', 'Vật tư × lô'], ['so', 'Stock Out, 3B & rework']], 'data-trsub')}
    <div id="tr-sub"></div>`;
  el.querySelectorAll('[data-trsub]').forEach((x) => x.addEventListener('click', () => { S.trSub = x.dataset.trsub; A.render(); }));
  const box = el.querySelector('#tr-sub');
  if (sub === 'lots') {
    const rows = t.lots.map((l) => ({ ...l, flagText: l.flags.join(' · ') }));
    const cols = [['erp', 'ERP', 50], ['pc', 'PC No.', 120], ['date', 'Ngày', 95, 'date'], ['sub', 'Sub-MO', 140], ['qty', 'SL', 80, 'qty'], ['pcRM', 'NVL theo PC-P', 130, 'num'], ['pcmSum', 'Tổng PC-M', 130, 'num'], ['so', 'Stock Out', 110, 'num'], ['wipAdj', 'Điều chỉnh 3B', 110, 'num'], ['carryIn', 'Rework', 100, 'num'], ['t622', '622', 120, 'num'], ['t627', '627', 120, 'num'], ['totalCost', 'Tổng giá thành', 140, 'num'], ['unit', 'Giá thành/đv', 110, 'num'], ['rmUnit', 'NVL/đv', 100, 'num'], ['u622', '622/đv', 90, 'num'], ['u627', '627/đv', 90, 'num'], ['gpPct', 'GP %', 70, 'pct'], ['nMat', 'Số vật tư', 70, 'int'], ['flagText', 'Bất thường', 280, 'flag']]
      .map(([key, label, width, type]) => ({ key, label, width, type: type === 'flag' ? 'text' : type, flag: type === 'flag' }));
    A.mountTable(box, { columns: cols, rows, height: 420, totals: ['qty', 'pcRM', 'pcmSum', 'so', 'wipAdj', 'carryIn', 't622', 't627', 'totalCost'], onExport: A.exportTable(`LO_${prod}`, cols), onRowClick: (r) => { S.trSub = 'matlots'; S.trQuery = r.pc; A.render(); } });
    box.insertAdjacentHTML('beforeend', '<p class="muted">Bấm một lô để xem vật tư của lô đó.</p>');
  } else if (sub === 'mats') {
    const cols = [['mat', 'Mã vật tư', 110], ['name', 'Tên vật tư', 260], ['unit', 'ĐVT', 60], ['miQty', 'Xuất kho (MI) SL', 110, 'qty'], ['miAmt', 'Xuất kho giá trị', 130, 'num'], ['mrQty', 'Trả lại (MR) SL', 100, 'qty'], ['qty', 'Tiêu hao (PC-M) SL', 120, 'qty'], ['amt', 'Tiêu hao giá trị', 130, 'num'], ['price', 'Đơn giá BQ', 110, 'num2'], ['minPrice', 'Đơn giá thấp nhất', 110, 'num2'], ['maxPrice', 'Đơn giá cao nhất', 110, 'num2'], ['perFG', 'SL / sản phẩm', 100, 'qty'], ['share', '% NVL', 70, 'pct'], ['toWipQty', 'Còn lại WIP (SL)', 110, 'qty'], ['nLots', 'Số lô', 60, 'int'], ['flagText', 'Bất thường', 160, 'flag']]
      .map(([key, label, width, type]) => ({ key, label, width, type: type === 'flag' ? 'text' : type === 'num2' ? 'qty' : type, flag: type === 'flag' }));
    A.mountTable(box, { columns: cols, rows: t.materials, height: 460, totals: ['miAmt', 'amt'], onExport: A.exportTable(`VAT_TU_${prod}`, cols), onRowClick: (r) => { S.trSub = 'matlots'; S.trQuery = r.mat; A.render(); } });
    box.insertAdjacentHTML('beforeend', '<p class="muted">Xuất kho (MI) và trả lại (MR) là chứng từ kỳ này theo mã sản phẩm; tiêu hao (PC-M) là phần đã vào lô hoàn thành. Phần còn lại nằm trong WIP. Bấm một vật tư để xem theo từng lô.</p>');
  } else if (sub === 'matlots') {
    const cols = [['mat', 'Mã vật tư', 110], ['name', 'Tên vật tư', 240], ['pc', 'PC No.', 120], ['date', 'Ngày', 95, 'date'], ['lotQty', 'SL lô', 70, 'qty'], ['qty', 'SL tiêu hao', 100, 'qty'], ['perFG', 'SL / sp', 90, 'qty'], ['amt', 'Giá trị', 120, 'num'], ['price', 'Đơn giá', 110, 'qty'], ['flagText', 'Bất thường', 220, 'flag']]
      .map(([key, label, width, type]) => ({ key, label, width, type: type === 'flag' ? 'text' : type, flag: type === 'flag' }));
    A.mountTable(box, { columns: cols, rows: t.matLots, height: 460, totals: ['qty', 'amt'], query: S.trQuery || '', onExport: A.exportTable(`VAT_TU_LO_${prod}`, cols) });
    S.trQuery = '';
  } else {
    const soCols = [['srcERP', 'Hệ nguồn', 70], ['srcKey', 'Nhóm Stock Out', 200], ['fam', 'Họ', 60], ['pc', 'PC No.', 120], ['pct', 'Tỷ lệ', 80, 'pct'], ['amt', 'Phân bổ (VND)', 130, 'num'], ['status', 'Trạng thái', 120, 'status']].map(([key, label, width, type]) => ({ key, label, width, type }));
    box.innerHTML = `<h2>Stock Out NVL phân bổ vào các lô <small>${f0(t.stockOut.reduce((a, r) => a + r.amt, 0))} VND</small></h2><div id="tr-so"></div>
      <h2>Điều chỉnh WIP trực tiếp (3B) đã post <small>${f0(t.wipAdj.reduce((a, r) => a + r.amt, 0))} VND</small></h2><div id="tr-3b"></div>
      <h2>Rework hoàn thành chuyển vào <small>${f0(t.rework.reduce((a, r) => a + r.carryIn, 0))} VND</small></h2><div id="tr-rw"></div>`;
    t.stockOut.length ? A.mountTable(box.querySelector('#tr-so'), { columns: soCols, rows: t.stockOut, height: 260, totals: ['amt'] }) : (box.querySelector('#tr-so').innerHTML = '<p class="muted">Không có.</p>');
    const c3 = [['mat', 'Vật tư', 120], ['erp', 'ERP', 50], ['pc', 'PC No.', 120], ['qty', 'SL', 90, 'qty'], ['amt', 'Giá trị', 130, 'num']].map(([key, label, width, type]) => ({ key, label, width, type }));
    t.wipAdj.length ? A.mountTable(box.querySelector('#tr-3b'), { columns: c3, rows: t.wipAdj, height: 220, totals: ['amt'] }) : (box.querySelector('#tr-3b').innerHTML = '<p class="muted">Không có.</p>');
    const cr = [['rid', 'Rework ID', 280], ['pcNo', 'Lô rework', 120], ['status', 'Trạng thái', 110], ['carryIn', 'Giá trị chuyển vào', 140, 'num']].map(([key, label, width, type]) => ({ key, label, width, type }));
    t.rework.length ? A.mountTable(box.querySelector('#tr-rw'), { columns: cr, rows: t.rework, height: 200, totals: ['carryIn'] }) : (box.querySelector('#tr-rw').innerHTML = '<p class="muted">Không có.</p>');
  }
}

function cogsTab(el, c) {
  const S = A.S;
  if (!c) { el.innerHTML = A.emptyNote('Chưa chạy STEP 5 (FIFO giá vốn) cho kỳ này.', 'step5', 'Mở STEP 5'); return; }
  const o = c.overview; const sub = S.trCsub || 'sales';
  el.innerHTML = `<div class="kpis">${A.kpiN('SL xuất bán', o.cogsQ)}${A.kpi('Giá vốn (632)', o.cogsA, true)}${A.kpi('Giá vốn / đv', o.unitCOGS, true)}${A.kpi('Doanh thu', o.revenue)}
      <div class="kpi"><span>Lãi gộp</span><b class="${o.margin < 0 ? 'bad' : ''}">${f0(o.margin)}</b><small>${pc(o.gm)}</small></div>${A.kpi('Giá thành SX kỳ này / đv', o.prodUnit)}</div>
    <h2>Luân chuyển thành phẩm</h2>
    <table class="cp fg-flow"><thead><tr><th></th><th class="r">Số lượng</th><th class="r">Giá trị (VND)</th><th class="r">Đơn giá</th></tr></thead><tbody>
      <tr><td>Tồn đầu kỳ</td><td class="r">${f0(o.openQ)}</td><td class="r">${f0(o.openA)}</td><td class="r">${o.openQ ? f0(o.openA / o.openQ) : '–'}</td></tr>
      <tr><td>+ Nhập kho từ sản xuất</td><td class="r">${f0(o.prodQ)}</td><td class="r">${f0(o.prodA)}</td><td class="r">${o.prodQ ? f0(o.prodA / o.prodQ) : '–'}</td></tr>
      <tr><td>− Xuất bán (FIFO)</td><td class="r">${f0(o.cogsQ)}</td><td class="r">${f0(o.cogsA)}</td><td class="r">${f0(o.unitCOGS)}</td></tr>
      <tr><td>− Xuất rework</td><td class="r">${f0(o.rwQ)}</td><td class="r">${f0(o.rwTot)}</td><td class="r">${o.rwQ ? f0(o.rwTot / o.rwQ) : '–'}</td></tr>
      <tr class="tot"><td>= Tồn cuối kỳ</td><td class="r">${f0(o.closeQ)}</td><td class="r">${f0(o.closeA)}</td><td class="r">${f0(o.closeUnit)}</td></tr></tbody></table>
    ${barHTML([{ l: 'NVL', v: o.cogsRM, c: '#2f7d64' }, { l: 'Nhân công 622', v: o.cogs622, c: '#c58b2b' }, { l: 'SX chung 627', v: o.cogs627, c: '#7b6ab0' }], o.cogsA)}
    ${anomaliesHTML(c.anomalies, 'cogs')}
    ${tabsHTML(sub, [['sales', `Dòng bán (${c.sales.length})`], ['layers', `Lớp FIFO (${c.layers.length})`], ['detail', `Lớp đã xuất bán (${c.detail.length})`], ['closing', `Tồn cuối (${c.closing.length})`]], 'data-trcsub')}
    <div id="tr-csub"></div>`;
  el.querySelectorAll('[data-trcsub]').forEach((x) => x.addEventListener('click', () => { S.trCsub = x.dataset.trcsub; A.render(); }));
  const box = el.querySelector('#tr-csub');
  const mk = (defs) => defs.map(([key, label, width, type]) => ({ key, label, width, type }));
  if (sub === 'sales') {
    const cols = mk([['date', 'Ngày HĐ', 95, 'date'], ['inv', 'Hoá đơn', 140], ['cust', 'Khách hàng', 200], ['qty', 'SL', 80, 'qty'], ['usd', 'USD', 100, 'num'], ['vnd', 'Doanh thu VND', 130, 'num'], ['fin', 'Xử lý', 100], ['fq', 'SL FIFO', 80, 'qty'], ['rm', 'NVL', 120, 'num'], ['c622', '622', 110, 'num'], ['c627', '627', 110, 'num'], ['tot', 'Giá vốn', 130, 'num'], ['unit', 'Giá vốn/đv', 110, 'num'], ['margin', 'Lãi gộp', 120, 'num'], ['gm', 'Lãi gộp %', 80, 'pct'], ['status', 'Trạng thái', 110, 'status']]);
    A.mountTable(box, { columns: cols, rows: c.sales, height: 420, totals: ['qty', 'usd', 'vnd', 'fq', 'rm', 'c622', 'c627', 'tot', 'margin'], onExport: A.exportTable(`GIA_VON_${o.prod}`, cols) });
  } else if (sub === 'layers') {
    const cols = mk([['source', 'Nguồn', 100], ['srcPeriod', 'Kỳ gốc', 80], ['pc', 'Lô PC', 120], ['date', 'Ngày lô', 95, 'date'], ['qtyIn', 'SL vào', 80, 'qty'], ['unit', 'Đơn giá', 110, 'num'], ['rmUnit', 'NVL/đv', 100, 'num'], ['sold', 'Đã bán', 80, 'qty'], ['rework', 'Rework', 70, 'qty'], ['remQ', 'Còn lại', 80, 'qty'], ['remTot', 'Giá trị còn lại', 130, 'num'], ['age', 'Tuổi (ngày)', 80, 'int'], ['lid', 'Layer ID', 220]]);
    A.mountTable(box, { columns: cols, rows: c.layers, height: 420, totals: ['qtyIn', 'sold', 'rework', 'remQ', 'remTot'], onExport: A.exportTable(`LOP_FIFO_${o.prod}`, cols) });
    box.insertAdjacentHTML('beforeend', '<p class="muted">Thứ tự FIFO: lớp cũ nhất trước (ngày lô, lớp đầu kỳ trước lớp sản xuất).</p>');
  } else if (sub === 'detail') {
    const cols = mk([['seq', '#', 50, 'int'], ['source', 'Nguồn', 100], ['pc', 'Lô PC', 120], ['date', 'Ngày lô', 95, 'date'], ['layerQty', 'SL lớp', 80, 'qty'], ['qty', 'SL lấy', 80, 'qty'], ['rm', 'NVL', 120, 'num'], ['a622', '622', 110, 'num'], ['a627', '627', 110, 'num'], ['tot', 'Giá vốn', 130, 'num'], ['unit', 'Đơn giá', 110, 'num'], ['take', 'Kiểu', 80], ['lid', 'Layer ID', 220]]);
    A.mountTable(box, { columns: cols, rows: c.detail, height: 420, totals: ['qty', 'rm', 'a622', 'a627', 'tot'] });
  } else {
    const cols = mk([['pc', 'Lô PC', 120], ['srcPeriod', 'Kỳ gốc', 80], ['date', 'Ngày lô', 95, 'date'], ['qty', 'SL', 80, 'qty'], ['tot', 'Giá trị', 130, 'num'], ['unitCost', 'Đơn giá', 110, 'num'], ['price', 'Giá bán USD', 90, 'qty'], ['status', 'Trạng thái', 160, 'status'], ['msg', 'Ghi chú', 300]]);
    A.mountTable(box, { columns: cols, rows: c.closing, height: 380, totals: ['qty', 'tot'] });
  }
}

// ---------------- trend over periods (from each period's STEP 5 result)
const TREND_N = 6;
const trendCache = new Map(); // period → step5 | null | 'loading'
function periodsBack(p, n) { const out = []; let x = p; for (let i = 0; i < n; i++) { out.unshift(x); x = prevPeriod(x); } return out; }
function trendTab(el, prod, t, c) {
  const S = A.S; const ps = periodsBack(S.period, TREND_N);
  let pending = 0;
  for (const p of ps) {
    if (p === S.period) continue;
    if (!trendCache.has(p)) { trendCache.set(p, 'loading'); A.loadPeriodData(p).then((d) => { trendCache.set(p, d && d.step5 && d.step5.period === p ? d.step5 : null); if (S.view === 'trace' && S.trTab === 'trend') A.render(); }).catch(() => trendCache.set(p, null)); }
    if (trendCache.get(p) === 'loading') pending++;
  }
  const rows = ps.map((p) => {
    const r5 = p === S.period ? (A.derived().d5 ? A.derived().d5.res : null) : trendCache.get(p);
    const o = { period: p, qty: null, unit: null, rmU: null, u622: null, u627: null, soldQ: null, cogsU: null, revU: null, gm: null };
    if (p === S.period && t && t.lots.length) Object.assign(o, { qty: t.overview.qty, unit: t.overview.unit, rmU: t.overview.rmUnit, u622: t.overview.u622, u627: t.overview.u627 });
    else if (r5 && r5 !== 'loading') {
      const L = (r5.ledger || []).filter((l) => l.source === 'PRODUCTION' && utxt(l.prod) === prod);
      const q = L.reduce((a, l) => a + num(l.qtyIn), 0);
      if (q) Object.assign(o, { qty: q, unit: L.reduce((a, l) => a + num(l.tot), 0) / q, rmU: L.reduce((a, l) => a + num(l.rm), 0) / q, u622: L.reduce((a, l) => a + num(l.a622), 0) / q, u627: L.reduce((a, l) => a + num(l.a627), 0) / q });
    }
    const sales = p === S.period && c ? c.sales : r5 && r5 !== 'loading' ? (r5.sales || []).filter((x) => x.prod === prod) : [];
    const f = sales.filter((x) => x.fin === 'FIFO COGS');
    const sq = f.reduce((a, x) => a + num(x.fq), 0), st = f.reduce((a, x) => a + num(x.tot), 0), sv = f.reduce((a, x) => a + num(x.vnd), 0);
    if (sq) Object.assign(o, { soldQ: sq, cogsU: st / sq, revU: sv / sq, gm: sv ? (sv - st) / sv : null });
    o.state = p === S.period ? 'kỳ đang xem' : trendCache.get(p) === 'loading' ? 'đang tải…' : r5 ? '' : 'chưa có STEP 5';
    return o;
  });
  const have = rows.filter((r) => r.unit !== null || r.cogsU !== null);
  el.innerHTML = `<p class="muted">Giá thành đơn vị (lô sản xuất), giá vốn và giá bán bình quân / sp của ${esc(prod)} trong ${TREND_N} kỳ gần nhất, lấy từ kết quả STEP 5 từng kỳ${pending ? ` – đang tải ${pending} kỳ…` : ''}.</p>
    ${have.length >= 2 ? trendSVG(rows) : '<div class="alert info">Cần ít nhất 2 kỳ có số liệu để vẽ xu hướng.</div>'}
    <div id="tr-trend"></div>`;
  const cols = [['period', 'Kỳ', 80], ['qty', 'SL sản xuất', 100, 'qty'], ['unit', 'Giá thành/đv', 120, 'num'], ['rmU', 'NVL/đv', 110, 'num'], ['u622', '622/đv', 100, 'num'], ['u627', '627/đv', 100, 'num'], ['soldQ', 'SL bán', 90, 'qty'], ['cogsU', 'Giá vốn/đv', 120, 'num'], ['revU', 'Giá bán/đv (VND)', 130, 'num'], ['gm', 'Lãi gộp %', 90, 'pct1'], ['state', 'Ghi chú', 140]]
    .map(([key, label, width, type]) => ({ key, label, width, type }));
  A.mountTable(el.querySelector('#tr-trend'), { columns: cols, rows, height: 30 * rows.length + 90, onExport: A.exportTable(`XU_HUONG_${prod}`, cols) });
}
function trendSVG(rows) {
  const W = 760, H = 220, pl = 70, pr = 16, pt = 14, pb = 34;
  const series = [['unit', 'Giá thành/đv', 'var(--accent, #2f7d64)'], ['cogsU', 'Giá vốn/đv', '#c58b2b'], ['revU', 'Giá bán/đv', '#7b6ab0']];
  const vals = rows.flatMap((r) => series.map(([k]) => r[k])).filter((v) => v !== null && isFinite(v));
  if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi === lo) { hi += 1; lo -= 1; } const pad = (hi - lo) * 0.1; lo = Math.max(0, lo - pad); hi += pad;
  const x = (i) => pl + (rows.length === 1 ? 0 : (i * (W - pl - pr)) / (rows.length - 1));
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const grid = [0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f; return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${A.fmtNum(v)}</text>`; }).join('');
  const lines = series.map(([k, , col]) => {
    const pts = rows.map((r, i) => (r[k] !== null && isFinite(r[k]) ? [x(i), y(r[k])] : null));
    const segs = []; let cur = [];
    for (const p of pts) { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } } if (cur.length) segs.push(cur);
    return segs.map((sg) => `<polyline fill="none" stroke="${col}" stroke-width="2" points="${sg.map((p) => p.join(',')).join(' ')}"/>`).join('') + pts.filter(Boolean).map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${col}"/>`).join('');
  }).join('');
  const xl = rows.map((r, i) => `<text x="${x(i)}" y="${H - 12}" text-anchor="${i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}" font-size="11" fill="var(--muted)">${r.period}</text>`).join('');
  return `<figure class="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Xu hướng giá thành, giá vốn và giá bán">${grid}${lines}${xl}</svg>
    <figcaption class="cbar-leg">${series.map(([, l, col]) => `<span><i style="background:${col}"></i>${esc(l)}</span>`).join('')}</figcaption></figure>`;
}

// ---------------- anomaly drill-down (modal report)
function factHTML(f) {
  const v = f.t === 'text' ? esc(f.v ?? '–') : f.t === 'pct' ? pc(f.v) : f.v === null || f.v === undefined ? '–' : fmtCell(f.v, f.t === 'num' ? 'vnd' : f.t);
  return `<div class="df${f.bad ? ' bad' : ''}"><span>${esc(f.l)}</span><b>${v || '–'}</b></div>`;
}
function openDetail(a) {
  const { t, c, prod } = curTrace;
  const d = TR.anomalyDetail(a, t, c);
  if (!d) { A.toast('Dòng này không có thêm số liệu chi tiết.', 'review'); return; }
  closeDetail();
  const wrap = document.createElement('div');
  wrap.className = 'tr-modal'; wrap.id = 'tr-modal';
  wrap.innerHTML = `<div class="tr-modal-box" role="dialog" aria-modal="true" aria-labelledby="trm-h">
    <header class="trm-head"><div><span class="an-area ${a.level === 'INFO' ? 'i' : a.level === 'BLOCK' ? 'b' : ''}">${esc(a.area)}</span><h2 id="trm-h">${esc(d.title)}</h2><p class="muted">${esc(prod)} · kỳ ${esc(A.S.period)}${d.lead ? ' · ' + esc(d.lead) : ''}</p></div>
      <div class="trm-act"><button type="button" class="btn ghost" id="trm-x">Xuất Excel</button><button type="button" class="btn" id="trm-close" aria-label="Đóng">Đóng</button></div></header>
    <div class="trm-body">
      <div class="alert ${a.level === 'INFO' ? 'info' : 'review'}">${esc(a.msg)}</div>
      ${d.facts.length ? `<div class="dfacts">${d.facts.map(factHTML).join('')}</div>` : ''}
      ${d.checks.length ? `<div class="trm-checks"><b>Gợi ý kiểm tra</b><ol>${d.checks.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
      ${d.tables.map((tb, i) => `<h3>${esc(tb.title)} <small>${tb.rows.length} dòng</small></h3>${tb.note ? `<p class="muted">${esc(tb.note)}</p>` : ''}<div id="trm-t${i}"></div>`).join('')}
    </div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');
  d.tables.forEach((tb, i) => {
    const box = wrap.querySelector('#trm-t' + i);
    if (!tb.rows.length) { box.innerHTML = '<p class="muted">Không có dòng nào.</p>'; return; }
    const cols = tb.cols.map(([key, label, width, type]) => ({ key, label, width, type }));
    A.mountTable(box, { columns: cols, rows: tb.rows, height: Math.min(30 * tb.rows.length + 90, 380), totals: tb.totals || [], rowClass: tb.hl ? (r) => (tb.hl(r) ? 'hl' : '') : null });
  });
  wrap.querySelector('#trm-close').addEventListener('click', closeDetail);
  wrap.querySelector('#trm-x').addEventListener('click', () => exportDetail(a, d, prod));
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeDetail(); });
  document.addEventListener('keydown', escClose);
  wrap.querySelector('#trm-close').focus();
}
function escClose(e) { if (e.key === 'Escape') closeDetail(); }
function closeDetail() {
  const w = document.getElementById('tr-modal'); if (w) w.remove();
  document.body.classList.remove('modal-open'); document.removeEventListener('keydown', escClose);
}
async function exportDetail(a, d, prod) {
  const cell = (v, ty) => (ty === 'date' && typeof v === 'number' ? serialToISO(v) : v ?? '');
  const sheets = [{ name: 'Tom tat', cols: [36, 22, 60], aoa: [['Truy xuất chi tiết', prod, A.S.period], [a.level, a.area, a.msg], [d.title, d.lead || ''], [], ['Chỉ tiêu', 'Giá trị'], ...d.facts.map((f) => [f.l, cell(f.v, f.t)]), [], ['Gợi ý kiểm tra'], ...d.checks.map((x, i) => [`${i + 1}.`, x])] }];
  d.tables.forEach((tb, i) => sheets.push({ name: `${i + 1} ${tb.title}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), cols: tb.cols.map((x) => Math.round((x[2] || 120) / 7)),
    aoa: [[...tb.cols.map((x) => x[1]), ...(tb.hl ? ['Cần xem'] : [])], ...tb.rows.map((r) => [...tb.cols.map(([k, , , ty]) => cell(r[k], ty)), ...(tb.hl ? [tb.hl(r) ? 'x' : ''] : [])])] }));
  await A.exportBook(`Chi_tiet_${prod}_${A.S.period}.xlsx`, sheets);
}

async function exportProduct(prod, t, c) {
  const sheets = [];
  const aoa = (rows, fields, heads) => [heads, ...rows.map((r) => fields.map((f) => { const v = r[f]; return (f === 'date' || f === 'layerDate') && typeof v === 'number' ? serialToISO(v) : v ?? ''; }))];
  if (t && t.lots.length) {
    const o = t.overview;
    sheets.push({ name: 'Tong quan', aoa: [['Truy xuất giá thành', prod, o.name], ['Kỳ', A.S.period], [], ['Chỉ tiêu', 'Giá trị (VND)', 'Đơn giá / sp'], ['Số lượng hoàn thành', o.qty], ['NVL theo PC', o.pcRM, o.pcRM / o.qty], ['Stock Out phân bổ', o.so, o.so / o.qty], ['Điều chỉnh WIP 3B', o.wipAdj, o.wipAdj / o.qty], ['Rework chuyển vào', o.carryIn, o.carryIn / o.qty], ['Tổng NVL', o.totalRM, o.rmUnit], ['Nhân công 622', o.t622, o.u622], ['SX chung 627', o.t627, o.u627], ['TỔNG GIÁ THÀNH', o.totalCost, o.unit], [], ['Kỳ trước', o.prior ? o.prior.period : '', o.prior ? o.prior.tot / o.prior.qty : ''], ['Thay đổi', o.priorChange ?? '']], cols: [28, 18, 16] });
    sheets.push({ name: 'Lo PC', aoa: aoa(t.lots.map((l) => ({ ...l, flags: l.flags.join(' · ') })), ['erp', 'pc', 'date', 'sub', 'qty', 'pcRM', 'pcmSum', 'so', 'wipAdj', 'carryIn', 't622', 't627', 'totalCost', 'unit', 'flags'], ['ERP', 'PC No.', 'Ngày', 'Sub-MO', 'SL', 'NVL PC-P', 'Tổng PC-M', 'Stock Out', '3B', 'Rework', '622', '627', 'Tổng', 'Giá thành/đv', 'Bất thường']) });
    sheets.push({ name: 'Vat tu', aoa: aoa(t.materials, ['mat', 'name', 'unit', 'miQty', 'miAmt', 'mrQty', 'qty', 'amt', 'price', 'minPrice', 'maxPrice', 'perFG', 'share', 'toWipQty'], ['Mã', 'Tên', 'ĐVT', 'Xuất kho SL', 'Xuất kho GT', 'Trả lại SL', 'Tiêu hao SL', 'Tiêu hao GT', 'Đơn giá BQ', 'Min', 'Max', 'SL/sp', '% NVL', 'Còn WIP SL']) });
    sheets.push({ name: 'Vat tu x lo', aoa: aoa(t.matLots, ['mat', 'name', 'pc', 'date', 'lotQty', 'qty', 'perFG', 'amt', 'price', 'flagText'], ['Mã', 'Tên', 'PC No.', 'Ngày', 'SL lô', 'SL', 'SL/sp', 'Giá trị', 'Đơn giá', 'Bất thường']) });
    sheets.push({ name: 'Bat thuong GT', aoa: aoa(t.anomalies, ['level', 'area', 'msg'], ['Mức', 'Nhóm', 'Nội dung']) });
  }
  if (c) {
    sheets.push({ name: 'Gia von', aoa: aoa(c.sales, ['date', 'inv', 'cust', 'qty', 'vnd', 'fin', 'fq', 'rm', 'c622', 'c627', 'tot', 'margin'], ['Ngày', 'Hoá đơn', 'Khách hàng', 'SL', 'Doanh thu VND', 'Xử lý', 'SL FIFO', 'NVL', '622', '627', 'Giá vốn', 'Lãi gộp']) });
    sheets.push({ name: 'Lop FIFO', aoa: aoa(c.layers, ['source', 'srcPeriod', 'pc', 'date', 'qtyIn', 'unit', 'sold', 'rework', 'remQ', 'remTot', 'lid'], ['Nguồn', 'Kỳ gốc', 'Lô', 'Ngày', 'SL vào', 'Đơn giá', 'Đã bán', 'Rework', 'Còn lại', 'GT còn lại', 'Layer ID']) });
    sheets.push({ name: 'Bat thuong GV', aoa: aoa(c.anomalies, ['level', 'area', 'msg'], ['Mức', 'Nhóm', 'Nội dung']) });
  }
  await A.exportBook(`Truy_xuat_${prod}_${A.S.period}.xlsx`, sheets);
}
