// STEP 4.4 view — Thành phẩm sản xuất lũy kế từ đầu năm (YTD finished-goods production).
import * as FP from '../engine/fgprod.js';
import * as P2 from './phase2.js';
import { nowISO, prevPeriod, serialToISO } from '../engine/util.js';

let A = null;
export function install(api) { A = api; }
const esc = (s) => A.esc(s);
export const FGP_BLOBS = ['fgProd'];
const isJan = (p) => p.slice(5) === '01';
const closedNow = (S) => !!(S.d.closed && S.d.closed.period === S.period);
const tabsHTML = (cur, tabs) => `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab ${id === cur ? 'on' : ''}" data-tabfp="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join('')}</div>`;

/** Current month rows straight from STEP 4.3 (not yet posted) and the posted snapshot. */
function state(S, D4 = null) {
  const d = S.d; D4 = D4 || P2.derive(S).d4;
  const live = D4.fl ? FP.rowsFromFinalLayer(D4.fl, S.period) : null;
  const fp = d.fgProd || null;
  const posted = fp && fp.current && fp.current.period === S.period ? fp.current : null;
  const opening = fp && fp.opening && fp.opening.period === S.period ? fp.opening : null;
  const outdated = !!(posted && live && posted.key !== FP.rowsKey(live));
  const res = d.step5 && d.step5.period === S.period ? d.step5 : null;
  const salesOutdated = !!(posted && res && posted.salesAt !== res.runAt); // FIFO ran again after the last post
  return { D4, live, fp, posted, opening, outdated, res, salesOutdated };
}
export function status(S, D4 = null) {
  const x = state(S, D4);
  if (!x.posted) return 'NOT RUN';
  if (x.outdated || x.salesOutdated || (x.D4 && x.D4.freshness !== 'CURRENT')) return 'RERUN REQUIRED';
  if (!isJan(S.period) && (!x.opening || x.opening.status === 'BLOCKED')) return 'PASS WITH REVIEW';
  return 'PASS';
}
export function ccInfo(S, D4 = null) {
  const x = state(S, D4); const rows = FP.ytdRows(x.fp, S.period); const sm = FP.summarize(rows, S.period);
  return { status: status(S, x.D4), text: rows.length ? `YTD ${A.fmtNum(sm.ytd.total)}` : '', at: x.posted && x.posted.postedAt, next: !x.posted ? 'Chạy STEP 4.3 – kết quả tự chuyển vào bảng' : x.outdated || x.salesOutdated ? 'Cập nhật từ STEP 4.3 / FIFO' : !isJan(S.period) && !x.opening ? 'Roll forward / upload số đầu năm đến tháng trước' : '' };
}

/** Post the STEP 4.3 final layer of this month into the YTD table (called after STEP 4 / FIFO and before CLOSE). */
export function postCurrent(S, { silent = false } = {}) {
  if (closedNow(S)) return false;
  const d = S.d; const D4 = P2.derive(S).d4;
  if (!D4.fl) { if (!silent) A.toast('Chưa có kết quả STEP 4.3 (Phân bổ giá thành).', 'block'); return false; }
  const rows = FP.rowsFromFinalLayer(D4.fl, S.period); const key = FP.rowsKey(rows);
  // FIFO consumption of the month (which invoice / rework took which lot) – from the latest STEP 5 run of this period
  const res = d.step5 && d.step5.period === S.period ? d.step5 : null;
  const sales = FP.consumptionFromStep5(res, S.period); const salesAt = res ? res.runAt : '';
  const cur = d.fgProd && d.fgProd.current;
  if (cur && cur.period === S.period && cur.key === key && (cur.salesAt || '') === salesAt) { if (!silent) A.toast('Bảng tổng hợp đã khớp STEP 4.3 và FIFO.', 'pass'); return false; }
  const sm = FP.summarize(rows, S.period);
  d.fgProd = { ...(d.fgProd || {}), year: S.period.slice(0, 4), current: { period: S.period, rows, key, sales, salesAt, step4RunAt: d.step4 ? d.step4.runAt : '', step4Freshness: D4.freshness, postedAt: nowISO(), by: A.who() } };
  A.audit('STEP 4.4 - POST FG PRODUCTION', `${S.period}: ${rows.length} lô · SL ${A.fmtNum(sm.cur.qty)} · ${A.fmtNum(sm.cur.total)} VND · FIFO ${sales.length} dòng phân bổ`);
  A.markDirty('fgProd', 'audit');
  if (!silent) A.toast(`Đã chuyển ${rows.length} lô thành phẩm kỳ ${S.period} (${A.fmtNum(sm.cur.total)} VND) vào bảng lũy kế.`, 'pass');
  return true;
}

export function view(el) {
  const S = A.S; const x = state(S, A.derived().d4); const closed = closedNow(S); const edit = A.canEdit() && !closed;
  const rows = FP.ytdRows(x.fp, S.period); const sales = FP.ytdSales(x.fp, S.period); const sm = FP.summarize(rows, S.period, sales);
  const al = FP.allocate(rows, sales);
  const soldYtd = sales.filter((r) => r.kind === 'SALE').reduce((a, r) => a + r.tot, 0);
  const st = status(S, x.D4); const tab = S.tabFP || 'sum'; const prev = prevPeriod(S.period);
  const op = x.opening;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 4.4 · Thành phẩm sản xuất lũy kế ${esc(S.period.slice(0, 4))}</h1><p class="lead">Tổng hợp thành phẩm nhập kho từ đầu năm đến kỳ ${esc(S.period)}: số các tháng trước (roll forward từ kỳ trước, hoặc upload file đầu kỳ cho các tháng trước khi dùng web) + kỳ này lấy từ STEP 4.3 sau phân bổ giá thành (đã gồm điều chỉnh WIP 3B và rework chuyển vào). Tháng 1 bắt đầu năm mới.</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(st)}<small>${x.posted ? 'Cập nhật ' + A.fmtTs(x.posted.postedAt) : 'Chưa có số kỳ này'}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    <div class="row">
      <button class="btn" type="button" data-act="fgp-post" ${edit ? '' : 'disabled'}>Cập nhật từ STEP 4.3</button>
      <button class="btn ghost" type="button" data-act="fgp-roll" ${edit ? '' : 'disabled'}>${isJan(S.period) ? 'Bắt đầu năm mới' : `Roll forward từ ${esc(prev)}`}</button>
      <label class="btn ghost ${edit ? '' : 'disabled'}">Upload file đầu kỳ…<input type="file" id="f-fgp" accept=".xlsx,.xlsm,.xls" hidden ${edit ? '' : 'disabled'}></label>
      <button class="btn ghost" type="button" data-act="fgp-tpl">Tải template trống</button>
      <button class="btn ghost" type="button" data-act="fgp-next" ${rows.length ? '' : 'disabled'}>Tải file đầu kỳ cho kỳ sau</button>
      <button class="btn ghost" type="button" data-act="fgp-export" ${rows.length ? '' : 'disabled'}>Xuất Excel báo cáo</button>
    </div>
    ${!x.D4.fl ? '<div class="alert review">Chưa có kết quả STEP 4.3 – chạy Phân bổ giá thành; kết quả tự chuyển vào bảng này.</div>'
      : !x.posted ? `<div class="alert review">Kết quả STEP 4.3 kỳ ${esc(S.period)} chưa được chuyển vào bảng. Bấm <b>Cập nhật từ STEP 4.3</b>.</div>`
        : x.outdated ? '<div class="alert review"><b>STEP 4.3 đã thay đổi</b> sau lần chuyển gần nhất (chạy lại phân bổ / 3B / rework). Bấm <b>Cập nhật từ STEP 4.3</b>.</div>'
          : x.salesOutdated ? '<div class="alert review"><b>FIFO đã chạy lại</b> sau lần chuyển gần nhất – phân bổ giá vốn theo hoá đơn chưa cập nhật. Bấm <b>Cập nhật từ STEP 4.3</b>.</div>'
          : !x.res ? '<p class="muted">Chưa chạy FIFO kỳ này – cột "đã xuất" chỉ gồm các tháng trước.</p>'
          : x.D4.freshness !== 'CURRENT' ? `<div class="alert review">STEP 4.3 đang ${esc(x.D4.freshness)} – số kỳ này có thể còn đổi. Chạy lại STEP 4.3.</div>` : ''}
    ${isJan(S.period) ? '<p class="muted">Tháng 1: không có số đầu kỳ (năm mới).</p>'
      : !op ? `<div class="alert review"><b>Chưa có số các tháng trước (01 → ${esc(prev.slice(5))}/${esc(S.period.slice(0, 4))}).</b> Roll forward từ ${esc(prev)} (kỳ trước đã có bảng 4.4), hoặc upload file đầu kỳ (dùng "Tải template trống" – mỗi dòng một lô hoặc một sản phẩm / tháng).</div>`
        : op.status === 'BLOCKED' ? `<div class="alert block"><b>File đầu kỳ có ${op.stats.block} dòng lỗi</b> – chưa được tính. Xem tab "Số đầu kỳ", sửa file rồi upload lại.</div>`
          : `<p class="muted">Số đầu kỳ: ${esc(op.source)} · ${op.stats.rows} dòng · tháng ${esc(op.stats.months.join(', ') || '–')} · ${A.fmtNum(op.stats.total)} VND${op.stats.review ? ` · <b>${op.stats.review} dòng REVIEW</b>` : ''}.</p>`}
    <div class="kpis">${A.kpiN('SL nhập kho kỳ này', sm.cur.qty)}${A.kpi('Giá thành kỳ này', sm.cur.total, true)}${A.kpiN('SL lũy kế từ đầu năm', sm.ytd.qty)}${A.kpi('Giá thành lũy kế', sm.ytd.total, true)}${A.kpi('Giá vốn đã xuất bán YTD (FIFO)', soldYtd)}${A.kpiN('Số tháng', sm.months.length)}${A.kpiN('Số sản phẩm', sm.prods.length)}</div>
    ${tabsHTML(tab, [['sum', 'Theo sản phẩm'], ['month', 'Theo tháng'], ['lots', `Chi tiết lô (${rows.length})`], ['alloc', `Phân bổ giá vốn theo hoá đơn (${sales.length})`], ['opening', 'Số đầu kỳ']])}
    <div id="tfp"></div></section>`;
  el.querySelectorAll('[data-tabfp]').forEach((b) => b.addEventListener('click', () => { S.tabFP = b.dataset.tabfp; A.render(); }));
  const f = el.querySelector('#f-fgp'); if (f) f.addEventListener('change', (e) => importFile(e.target.files[0]));
  const box = el.querySelector('#tfp');
  if (tab === 'sum') {
    if (!sm.prods.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    const cols = SUM_COLS;
    A.mountTable(box, { columns: cols, rows: sm.prods, height: 540, totals: ['curQty', 'curTotal', 'ytdQty', 'ytdRM', 'ytd622', 'ytd627', 'ytdTotal', 'soldQty', 'soldTot', 'lots'], onExport: A.exportTable('TP_SX_LUY_KE_SP', cols) });
  } else if (tab === 'month') {
    if (!sm.months.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    A.mountTable(box, { columns: MONTH_COLS, rows: sm.months, height: 480, totals: ['lots', 'qty', 'totalRM', 'c622', 'c627', 'total', 'soldQty', 'soldTot'], onExport: A.exportTable('TP_SX_THEO_THANG', MONTH_COLS) });
  } else if (tab === 'lots') {
    if (!rows.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    box.innerHTML = '<p class="muted">Bấm vào một lô để xem lô đó đã phân bổ giá vốn cho những hoá đơn / tháng nào.</p><div id="tfp-l"></div><div id="tfp-ld"></div>';
    A.mountTable(box.querySelector('#tfp-l'), { columns: LOT_ALLOC_COLS, rows: al.lots, filterKey: 'period', height: 480, totals: ['qty', 'totalRM', 'c622', 'c627', 'total', 'soldQty', 'soldTot', 'rwQty', 'rwTot', 'remQty', 'remTot'], onExport: A.exportTable('TP_SX_CHI_TIET_LO', LOT_ALLOC_COLS),
      onRowClick: (r) => {
        const recs = sales.filter((x) => FP.lotKey(x.lotPeriod, x.pc, x.prod) === FP.lotKey(r.period, r.pc, r.prod));
        const ld = box.querySelector('#tfp-ld');
        ld.innerHTML = `<h2>Lô ${esc(r.pc || '(không PC)')} · ${esc(r.prod)} · nhập kho ${esc(r.period)} · SL ${A.fmtNum(r.qty)}</h2>${r.soldQty0 ? `<p class="muted">Đã xuất trước khi dùng web (file đầu kỳ): SL ${A.fmtNum(r.soldQty0)} · ${A.fmtNum(r.soldTot0)} VND.</p>` : ''}<div id="tfp-ldt"></div>`;
        if (!recs.length) { ld.querySelector('#tfp-ldt').innerHTML = A.emptyNote('Lô này chưa xuất cho hoá đơn nào.'); return; }
        A.mountTable(ld.querySelector('#tfp-ldt'), { columns: ALLOC_COLS, rows: recs, height: Math.min(420, 30 * recs.length + 110), totals: ['qty', 'tot'], onExport: A.exportTable(`TP_SX_LO_${r.pc}`, ALLOC_COLS) });
        ld.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } });
  } else if (tab === 'alloc') {
    if (!sales.length) { box.innerHTML = A.emptyNote('Chưa có phân bổ – chạy FIFO (STEP 5.2) rồi Cập nhật từ STEP 4.3.'); return; }
    const recs = sales.map((x) => ({ ...x, unit: x.qty ? x.tot / x.qty : null, inTable: FP.lotKey(x.lotPeriod, x.pc, x.prod) && al.unmatched.includes(x) ? 'Ngoài bảng (FG đầu kỳ cũ)' : 'Lô trong bảng' }));
    box.innerHTML = `<p class="muted">Mỗi dòng = một phần lô thành phẩm đã xuất cho một dòng hoá đơn (hoặc xuất rework) trong tháng, theo FIFO. ${al.unmatched.length ? `<b>${al.unmatched.length}</b> dòng lấy từ lô không có trong bảng (FG tồn từ trước năm / chưa upload số đầu kỳ của lô đó).` : ''}</p><div id="tfp-a"></div>`;
    A.mountTable(box.querySelector('#tfp-a'), { columns: [...ALLOC_COLS, { key: 'inTable', label: 'Lô', width: 170 }], rows: recs, filterKey: 'month', height: 540, totals: ['qty', 'tot'], onExport: A.exportTable('TP_SX_PHAN_BO_GIA_VON', ALLOC_COLS) });
  } else {
    if (isJan(S.period)) { box.innerHTML = A.emptyNote('Tháng 1 – không cần số đầu kỳ.'); return; }
    if (!op) { box.innerHTML = A.emptyNote('Chưa có số đầu kỳ.'); return; }
    box.innerHTML = `<p class="muted">${esc(op.kind)} · ${esc(op.source)} · nạp ${A.fmtTs(op.loadedAt)} · ${A.pill(op.status)} · BLOCK ${op.stats.block || 0} · REVIEW ${op.stats.review || 0}</p><div id="tfp-op"></div>`;
    const cols = [...LOT_COLS, { key: 'check', label: 'Kiểm tra', type: 'status', width: 90 }, { key: 'msg', label: 'Thông báo', width: 300 }, { key: 'srcRow', label: 'Dòng file', type: 'int', width: 80 }];
    A.mountTable(box.querySelector('#tfp-op'), { columns: cols, rows: op.rows, filterKey: 'check', height: 520, totals: ['qty', 'totalRM', 'c622', 'c627', 'total'], onExport: A.exportTable('TP_SX_DAU_KY', cols) });
  }
}
const N = (key, label, width = 140) => ({ key, label, type: 'num', width });
const Q = (key, label, width = 110) => ({ key, label, type: 'qty', width });
const SUM_COLS = [{ key: 'prod', label: 'Product Code', width: 150, trace: true }, { key: 'name', label: 'Product Name', width: 240 }, { key: 'unit', label: 'Unit', width: 60 },
  Q('curQty', 'SL kỳ này'), N('curTotal', 'Giá thành kỳ này'), N('curUnit', 'Đơn giá kỳ này', 120), Q('ytdQty', 'SL lũy kế'), N('ytdRM', 'RM lũy kế'), N('ytd622', '622 lũy kế'), N('ytd627', '627 lũy kế'), N('ytdTotal', 'Giá thành lũy kế'), N('ytdUnit', 'Đơn giá bình quân YTD', 130), Q('soldQty', 'SL đã xuất bán YTD'), N('soldTot', 'Giá vốn đã xuất YTD'), { key: 'lots', label: 'Số lô', type: 'int', width: 70 }];
const MONTH_COLS = [{ key: 'period', label: 'Kỳ', width: 90 }, { key: 'products', label: 'Số SP', type: 'int', width: 70 }, { key: 'lots', label: 'Số lô', type: 'int', width: 70 }, Q('qty', 'SL nhập kho'), N('totalRM', 'RM'), N('c622', '622'), N('c627', '627'), N('total', 'Tổng giá thành'), N('unitAvg', 'Đơn giá bình quân', 120), Q('cumQty', 'SL lũy kế'), N('cumTotal', 'Giá thành lũy kế'), Q('soldQty', 'SL xuất bán trong tháng'), N('soldTot', 'Giá vốn xuất bán trong tháng')];
const LOT_COLS = [{ key: 'period', label: 'Kỳ', width: 80 }, { key: 'erp', label: 'ERP', width: 50 }, { key: 'pc', label: 'PC No.', width: 150 }, { key: 'date', label: 'PC Date', type: 'date', width: 95 }, { key: 'mo', label: 'MO No.', width: 140 },
  { key: 'prod', label: 'Product Code', width: 150, trace: true }, { key: 'name', label: 'Product Name', width: 220 }, { key: 'unit', label: 'Unit', width: 60 }, Q('qty', 'Complete Qty', 100),
  N('baseRM', 'RM gốc'), N('wipAdj', 'Điều chỉnh 3B', 120), N('carryIn', 'Rework chuyển vào', 120), N('totalRM', 'Total RM'), N('c622', '622'), N('c627', '627'), N('total', 'Tổng giá thành'), N('unitCost', 'Giá thành / đv', 110), { key: 'source', label: 'Nguồn', width: 130 }, { key: 'note', label: 'Ghi chú', width: 180 }];
const LOT_ALLOC_COLS = [{ key: 'period', label: 'Kỳ nhập kho', width: 90 }, { key: 'pc', label: 'PC No.', width: 150 }, { key: 'date', label: 'PC Date', type: 'date', width: 95 }, { key: 'prod', label: 'Product Code', width: 150, trace: true }, { key: 'name', label: 'Product Name', width: 200 }, Q('qty', 'SL nhập kho', 100),
  N('totalRM', 'Total RM'), N('c622', '622'), N('c627', '627'), N('total', 'Tổng giá thành'), N('unitCost', 'Giá thành / đv', 110),
  Q('soldQty', 'SL đã xuất bán', 100), N('soldTot', 'Giá vốn đã xuất'), Q('rwQty', 'SL xuất rework', 90), N('rwTot', 'Giá trị xuất rework', 120), Q('remQty', 'SL còn lại', 90), N('remTot', 'Giá trị còn lại'),
  { key: 'issuedMonths', label: 'Xuất theo tháng (SL)', width: 260 }, { key: 'invCount', label: 'Số HĐ', type: 'int', width: 70 }, { key: 'source', label: 'Nguồn', width: 120 }];
const ALLOC_COLS = [{ key: 'month', label: 'Tháng xuất', width: 90 }, { key: 'kind', label: 'Loại', width: 80 }, { key: 'sdate', label: 'Ngày HĐ / xuất', type: 'date', width: 100 }, { key: 'inv', label: 'Hoá đơn / phiếu', width: 170 }, { key: 'cust', label: 'Khách hàng', width: 200 },
  { key: 'prod', label: 'Product Code', width: 150, trace: true }, { key: 'lotPeriod', label: 'Kỳ nhập lô', width: 90 }, { key: 'pc', label: 'PC No. (lô)', width: 150 }, Q('qty', 'SL', 90), N('tot', 'Giá vốn'), N('unit', 'Giá vốn / đv', 110)];

async function importFile(file) {
  if (!file || !A.guardEdit()) return;
  const S = A.S;
  if (closedNow(S)) { A.toast(`Kỳ ${S.period} đã đóng.`, 'review'); return; }
  if (isJan(S.period)) { A.toast('Tháng 1 không cần số đầu kỳ.', 'review'); return; }
  await A.busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const res = await A.parseFile(await file.arrayBuffer(), 'all');
      const op = FP.importOpening(res.grids, file.name, S.period);
      const cur = S.d.fgProd && S.d.fgProd.opening && S.d.fgProd.opening.period === S.period ? S.d.fgProd.opening : null;
      if (cur && cur.rows.length && !confirm(`Đã có số đầu kỳ (${cur.source}, ${cur.rows.length} dòng). Thay bằng file ${file.name}?`)) return;
      op.by = A.who();
      S.d.fgProd = { ...(S.d.fgProd || {}), year: S.period.slice(0, 4), opening: op };
      A.audit('STEP 4.4 - UPLOAD OPENING', `${file.name} · ${op.status} · ${op.stats.rows} dòng · tháng ${op.stats.months.join(',')} · ${A.fmtNum(op.stats.total)} VND · BLOCK ${op.stats.block} · REVIEW ${op.stats.review}`);
      A.markDirty('fgProd', 'audit');
      S.tabFP = 'opening';
      A.toast(op.status === 'BLOCKED' ? `File đầu kỳ có ${op.stats.block} dòng lỗi – xem tab Số đầu kỳ.` : `Đã nạp ${op.stats.rows} dòng số đầu kỳ (${op.stats.months.join(', ')}) · ${A.fmtNum(op.stats.total)} VND.`, op.status === 'BLOCKED' ? 'block' : op.stats.review ? 'review' : 'pass');
    } catch (e) { A.toast('Upload file đầu kỳ lỗi: ' + e.message, 'block'); }
  });
  A.render();
}
export async function doRoll() {
  const S = A.S;
  if (closedNow(S)) { A.toast(`Kỳ ${S.period} đã đóng.`, 'review'); return; }
  const prev = prevPeriod(S.period);
  const cur = S.d.fgProd && S.d.fgProd.opening && S.d.fgProd.opening.period === S.period ? S.d.fgProd.opening : null;
  try {
    let op;
    if (isJan(S.period)) op = FP.rollOpening(null, prev, S.period);
    else {
      const pd = await A.loadPeriodData(prev);
      if (!pd) { A.toast(`Không có dữ liệu kỳ ${prev} trên web. Dùng Upload file đầu kỳ.`, 'block'); return; }
      if (!(pd.closed && pd.closed.period === prev) && !confirm(`Kỳ ${prev} chưa đóng – số liệu kỳ đó còn có thể thay đổi. Vẫn roll forward?`)) return;
      op = FP.rollOpening(pd.fgProd, prev, S.period);
    }
    if (cur && cur.rows.length && !confirm(`Đã có số đầu kỳ (${cur.source}, ${cur.rows.length} dòng). Thay bằng ${op.source}?`)) return;
    op.by = A.who();
    S.d.fgProd = { ...(S.d.fgProd || {}), year: S.period.slice(0, 4), opening: op };
    A.audit('STEP 4.4 - ROLL FORWARD', `${op.source} · ${op.stats.rows} dòng · ${A.fmtNum(op.stats.total)} VND`);
    A.markDirty('fgProd', 'audit');
    A.toast(op.kind === 'NEW YEAR' ? `Bắt đầu năm ${S.period.slice(0, 4)} – không có số đầu kỳ.` : `Đã roll forward ${op.stats.rows} dòng (${op.stats.months.join(', ')}) · ${A.fmtNum(op.stats.total)} VND từ ${prev}.`, 'pass');
  } catch (e) { A.toast(e.message, 'block'); }
}
export async function doTemplate(next) {
  const S = A.S; const x = state(S);
  if (!next) { await A.exportBook(`SVL_TP_SX_DauKy_Template_${S.period}.xlsx`, [{ name: 'FG_PRODUCTION', aoa: FP.templateAOA([], S.period), cols: COLW }]); return; }
  const rows = FP.allocate(FP.ytdRows(x.fp, S.period), FP.ytdSales(x.fp, S.period)).lots;
  const np = nextP(S.period);
  if (np.slice(5) === '01') { A.toast(`Kỳ sau (${np}) là tháng 1 – bắt đầu năm mới, không cần file đầu kỳ.`, 'review'); return; }
  await A.exportBook(`SVL_TP_SX_DauKy_${np}.xlsx`, [{ name: 'FG_PRODUCTION', aoa: FP.templateAOA(rows, np, `Lũy kế đến hết ${S.period}${x.outdated || !x.posted ? ' (CHÚ Ý: chưa cập nhật đủ từ STEP 4.3)' : ''}`), cols: COLW }]);
}
const COLW = [12, 6, 18, 12, 18, 18, 30, 14, 12, 8, 12, 16, 16, 16, 18, 24];
const nextP = (p) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
export async function doExport() {
  const S = A.S; const x = state(S); const rows = FP.ytdRows(x.fp, S.period); const sales = FP.ytdSales(x.fp, S.period); const sm = FP.summarize(rows, S.period, sales);
  const al = FP.allocate(rows, sales);
  const aoa = (cols, list) => [cols.map((c) => c.label), ...list.map((r) => cols.map((c) => { const v = r[c.key]; return c.type === 'date' && typeof v === 'number' ? serialToISO(v) : v ?? ''; }))];
  const w = (cols) => cols.map((c) => Math.round((c.width || 120) / 7));
  await A.exportBook(`SVL_TP_SX_LuyKe_${S.period}.xlsx`, [
    { name: 'Theo san pham', aoa: aoa(SUM_COLS, sm.prods), cols: w(SUM_COLS) },
    { name: 'Theo thang', aoa: aoa(MONTH_COLS, sm.months), cols: w(MONTH_COLS) },
    { name: 'Chi tiet lo', aoa: aoa(LOT_ALLOC_COLS, al.lots), cols: w(LOT_ALLOC_COLS) },
    { name: 'Phan bo gia von', aoa: aoa(ALLOC_COLS, sales.map((r) => ({ ...r, unit: r.qty ? r.tot / r.qty : null }))), cols: w(ALLOC_COLS) },
  ]);
}
/** New period: roll the YTD table forward automatically when the previous month was closed. */
export function carryForward(prev, newPeriod) {
  const pp = prevPeriod(newPeriod);
  if (!prev || !prev.fgProd || !(prev.closed && prev.closed.period === pp)) return {};
  try { return { fgProd: { year: newPeriod.slice(0, 4), opening: { ...FP.rollOpening(prev.fgProd, pp, newPeriod), by: 'carry-forward' } } }; } catch { return {}; }
}
