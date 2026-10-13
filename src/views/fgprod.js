// STEP 4.4 view — Thành phẩm sản xuất lũy kế từ đầu năm (YTD finished-goods production).
import * as FP from '../engine/fgprod.js';
import * as FD from '../engine/fgdetail.js';
import * as TPL from '../engine/templates.js';
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
/** v1.14.27 detail table (Carol layout) and its reconciliation with STEP 5.1 / 5.2 – memoised on the stored objects. */
let memo = { k: null, v: null };
function detailOf(S) {
  const d = S.d; const k = [S.period, d.fgProd, d.fgProd && d.fgProd.opening, d.fgProd && d.fgProd.current, d.fgOpen, d.fgOpen && d.fgOpen.validatedAt, d.step5];
  if (memo.k && memo.k.length === k.length && memo.k.every((x, i) => x === k[i])) return memo.v;
  const det = FD.buildDetail(d.fgProd, S.period);
  const rec = FD.reconcile(det, d.fgOpen, d.step5 && d.step5.period === S.period ? d.step5 : null, S.period);
  memo = { k, v: { det, rec } };
  return memo.v;
}
export function status(S, D4 = null) {
  const x = state(S, D4);
  if (!x.posted) return 'NOT RUN';
  if (x.outdated || x.salesOutdated || (x.D4 && x.D4.freshness !== 'CURRENT')) return 'RERUN REQUIRED';
  if (!isJan(S.period) && (!x.opening || x.opening.status === 'BLOCKED')) return 'PASS WITH REVIEW';
  if (detailOf(S).rec.status === 'REVIEW') return 'PASS WITH REVIEW'; // 4.4 ↔ STEP 5 difference: review only, never blocks
  return 'PASS';
}
export function ccInfo(S, D4 = null) {
  const x = state(S, D4); const rows = FP.ytdRows(x.fp, S.period); const sm = FP.summarize(rows, S.period);
  return { status: status(S, x.D4), text: rows.length ? `YTD ${A.fmtNum(sm.ytd.total)}` : '', at: x.posted && x.posted.postedAt, next: !x.posted ? 'Chạy STEP 4.3 – kết quả tự chuyển vào bảng' : x.outdated || x.salesOutdated ? 'Cập nhật từ STEP 4.3 / FIFO' : !isJan(S.period) && !x.opening ? 'Roll forward / upload file đầu kỳ (mẫu chi tiết)' : detailOf(S).rec.status === 'REVIEW' ? 'Xem đối chiếu 4.4 ↔ STEP 5 (chênh lệch)' : '' };
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
  const rows = FP.ytdRows(x.fp, S.period); const sales = FP.ytdSales(x.fp, S.period);
  const detailMode = FD.isDetail(x.fp, S.period);
  const { det, rec } = detailOf(S);
  const sumSales = detailMode ? FD.issuesOfYear(det.rows, S.period) : sales; // detail model: issues of the year are in the rows
  const sm = FP.summarize(rows, S.period, sumSales);
  const al = FP.allocate(rows, FP.allocSales(x.fp, S.period));
  const soldYtd = sumSales.filter((r) => r.kind === 'SALE').reduce((a, r) => a + r.tot, 0);
  const st = status(S, x.D4); const tab = S.tabFP || 'detail'; const prev = prevPeriod(S.period);
  const op = x.opening;
  const ds = det.stats, os = det.openStats;
  const curIssued = det.rows.filter((r) => r.costMonth === S.period);
  const cogsCur = curIssued.filter((r) => r.kind === 'SALE').reduce((a, r) => a + r.total, 0);
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 4.4 · Thành phẩm sản xuất & tồn kho chi tiết ${esc(S.period.slice(0, 4))}</h1><p class="lead">Bảng chi tiết theo dòng (mẫu "FG month detail"): mỗi lô PC được tách thành các dòng theo tháng ghi nhận giá vốn (<b>Cost month</b>); dòng <b>không có Cost month là còn tồn</b> – tổng của chúng = FG đầu kỳ / cuối kỳ. Số đầu kỳ: upload file chi tiết hoặc roll forward từ kỳ trước. Kỳ này: lô từ STEP 4.3 thêm vào, số đã bán / xuất rework theo FIFO (STEP 5.2) tự tách dòng với Cost month ${esc(FD.cmText(S.period))}.</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(st)}<small>${x.posted ? 'Cập nhật ' + A.fmtTs(x.posted.postedAt) : 'Chưa có số kỳ này'}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    <div class="row">
      <button class="btn" type="button" data-act="fgp-post" ${edit ? '' : 'disabled'}>Cập nhật từ STEP 4.3 / FIFO</button>
      <button class="btn ghost" type="button" data-act="fgp-roll" ${edit ? '' : 'disabled'}>${isJan(S.period) ? 'Bắt đầu năm mới (mang tồn kho)' : `Roll forward từ ${esc(prev)}`}</button>
      <label class="btn ghost ${edit ? '' : 'disabled'}">Upload file đầu kỳ (chi tiết)…<input type="file" id="f-fgp" accept=".xlsx,.xlsm,.xls" hidden ${edit ? '' : 'disabled'}></label>
      <button class="btn ghost" type="button" data-act="fgp-tpl">Tải template trống</button>
      <button class="btn ghost" type="button" data-act="fgp-next" ${det.rows.length ? '' : 'disabled'}>Tải file đầu kỳ cho kỳ sau</button>
      <button class="btn ghost" type="button" data-act="fgp-export" ${det.rows.length || rows.length ? '' : 'disabled'}>Xuất Excel báo cáo</button>
    </div>
    ${!x.D4.fl ? '<div class="alert review">Chưa có kết quả STEP 4.3 – chạy Phân bổ giá thành; kết quả tự chuyển vào bảng này.</div>'
      : !x.posted ? `<div class="alert review">Kết quả STEP 4.3 kỳ ${esc(S.period)} chưa được chuyển vào bảng. Bấm <b>Cập nhật từ STEP 4.3 / FIFO</b>.</div>`
        : x.outdated ? '<div class="alert review"><b>STEP 4.3 đã thay đổi</b> sau lần chuyển gần nhất (chạy lại phân bổ / 3B / rework). Bấm <b>Cập nhật từ STEP 4.3 / FIFO</b>.</div>'
          : x.salesOutdated ? '<div class="alert review"><b>FIFO đã chạy lại</b> sau lần chuyển gần nhất – dòng tách theo Cost month chưa cập nhật. Bấm <b>Cập nhật từ STEP 4.3 / FIFO</b>.</div>'
          : !x.res ? `<p class="muted">Chưa chạy FIFO kỳ này – chưa có dòng Cost month ${esc(FD.cmText(S.period))}.</p>`
          : x.D4.freshness !== 'CURRENT' ? `<div class="alert review">STEP 4.3 đang ${esc(x.D4.freshness)} – số kỳ này có thể còn đổi. Chạy lại STEP 4.3.</div>` : ''}
    ${!op ? (isJan(S.period) ? '<p class="muted">Tháng 1: roll forward để mang các dòng còn tồn từ tháng 12 sang (hoặc upload file chi tiết).</p>' : `<div class="alert review"><b>Chưa có số đầu kỳ.</b> Roll forward từ ${esc(prev)} (kỳ trước đã có bảng 4.4), hoặc upload file chi tiết theo dòng (file "FG month detail" của kế toán, hoặc "Tải template trống").</div>`)
      : op.status === 'BLOCKED' ? `<div class="alert block"><b>File đầu kỳ có ${op.stats.block} dòng lỗi</b> – chưa được tính. Xem tab "Số đầu kỳ", sửa file rồi upload lại.</div>`
        : detailMode ? `<p class="muted">Số đầu kỳ: ${esc(op.source)} · ${A.fmtNum(op.stats.rows)} dòng · ${A.fmtNum(op.stats.lots)} lô · <b>còn tồn ${A.fmtNum(op.stats.stockRows)} dòng · SL ${A.fmtNum(op.stats.stockQty)} · ${A.fmtNum(op.stats.stockTot)} VND</b>${op.stats.priorRows ? ` (trong đó lô năm trước ${A.fmtNum(op.stats.priorRows)} dòng · ${A.fmtNum(op.stats.priorTot)} VND)` : ''}${op.stats.review ? ` · <b>${op.stats.review} dòng REVIEW</b>` : ''}.</p>`
          : `<p class="muted">Số đầu kỳ (mẫu cũ theo lô): ${esc(op.source)} · ${op.stats.rows} dòng · tháng ${esc(op.stats.months.join(', ') || '–')} · ${A.fmtNum(op.stats.total)} VND${op.stats.review ? ` · <b>${op.stats.review} dòng REVIEW</b>` : ''}. Bảng chi tiết được dựng từ số theo lô; để có đủ lô năm trước còn tồn, upload file chi tiết theo dòng.</p>`}
    ${rec.status === 'REVIEW' ? `<div class="alert review"><b>Đối chiếu 4.4 ↔ STEP 5 có chênh lệch</b> (${rec.rows.filter((r) => r.status === 'LỆCH').map((r) => esc(r.area)).join(', ')}; ${rec.lots.length} lô) – chỉ cảnh báo, không chặn. Xem tab <b>Đối chiếu 4.4 ↔ 5.1 / 5.2</b>.</div>` : ''}
    <div class="kpis wide">${A.kpi('Tồn FG đầu kỳ (4.4)', os.stockTot, true)}${A.kpi('Giá thành nhập kho kỳ này', sm.cur.total)}${A.kpi(`Giá vốn Cost month ${FD.cmText(S.period)}`, cogsCur)}${A.kpi('Tồn FG cuối kỳ (4.4)', ds.stockTot, true)}${A.kpi('Giá thành SX lũy kế năm', sm.ytd.total)}${A.kpi('Giá vốn đã xuất bán YTD', soldYtd)}</div>
    <p class="muted">Số lượng: tồn đầu kỳ <b>${A.fmtNum(os.stockQty)}</b> · nhập kho kỳ này <b>${A.fmtNum(sm.cur.qty)}</b> · xuất trong kỳ <b>${A.fmtNum(curIssued.reduce((a, r) => a + r.qty, 0))}</b> · tồn cuối kỳ <b>${A.fmtNum(ds.stockQty)}</b> (${A.fmtNum(ds.stockRows)} dòng chưa có Cost month).</p>
    ${tabsHTML(tab, [['detail', `Chi tiết theo dòng (${A.fmtNum(det.rows.length)})`], ['cogs', 'Theo Cost month'], ['recon', `Đối chiếu 4.4 ↔ 5.1 / 5.2${rec.status === 'REVIEW' ? ' ⚠' : ''}`], ['sum', 'Theo sản phẩm'], ['month', 'Theo tháng SX'], ['lots', `Chi tiết lô (${rows.length})`], ['alloc', `Phân bổ giá vốn theo hoá đơn (${sales.length})`], ['opening', 'Số đầu kỳ']])}
    <div id="tfp"></div></section>`;
  el.querySelectorAll('[data-tabfp]').forEach((b) => b.addEventListener('click', () => { S.tabFP = b.dataset.tabfp; A.render(); }));
  const f = el.querySelector('#f-fgp'); if (f) f.addEventListener('change', (e) => importFile(e.target.files[0]));
  const box = el.querySelector('#tfp');
  if (tab === 'detail') {
    if (!det.rows.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu – upload / roll forward số đầu kỳ và chuyển STEP 4.3.'); return; }
    const list = det.rows.map((r) => ({ ...r, cm: FD.cmText(r.costMonth) || 'CÒN TỒN', kindL: r.kind ? FD.KIND_LABEL[r.kind] || r.kind : '', unitCost: r.qty ? r.total / r.qty : null }));
    box.innerHTML = `<p class="muted">Lọc theo cột <b>Cost month</b>: "CÒN TỒN" = dòng chưa ghi nhận giá vốn. Dòng Cost month ${esc(FD.cmText(S.period))} được app tách từ FIFO kỳ này (cột Chứng từ xuất = hoá đơn / phiếu rework).</p><div id="tfp-d"></div>`;
    A.mountTable(box.querySelector('#tfp-d'), { columns: DET_VIEW_COLS, rows: list, filterKey: 'cm', height: 560, totals: ['qty', 'totalRM', 'c622', 'c627', 'total'], onExport: A.exportTable('TP_CHI_TIET_THEO_DONG', DET_VIEW_COLS) });
  } else if (tab === 'cogs') {
    const cm = FD.byCostMonth(det.rows, S.period);
    if (!cm.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    box.innerHTML = `<p class="muted">Mỗi dòng là một tháng ghi nhận giá vốn (Cost month); "CÒN TỒN" = tồn FG cuối kỳ ${esc(S.period)} theo 4.4.</p><div id="tfp-c"></div>`;
    A.mountTable(box.querySelector('#tfp-c'), { columns: CM_COLS, rows: cm, height: 460, totals: ['rows', 'qty', 'total', 'qtyY', 'totY', 'qtyP', 'totP', 'rwQty', 'rwTot'], onExport: A.exportTable('TP_THEO_COST_MONTH', CM_COLS) });
  } else if (tab === 'recon') {
    box.innerHTML = `<p class="muted">Chỉ để kiểm tra – <b>không chặn</b> các bước khác. Quy tắc: tổng dòng chưa có Cost month của 4.4 = FG đầu kỳ (STEP 5.1) và = FG cuối kỳ sau FIFO (STEP 5.2). Kết quả: ${A.pill(rec.status === 'REVIEW' ? 'REVIEW' : rec.status === 'PASS' ? 'PASS' : 'NOT RUN')}</p><div id="tfp-r"></div><h2>Chênh lệch theo lô (${rec.lots.length})</h2><div id="tfp-rl"></div>`;
    A.mountTable(box.querySelector('#tfp-r'), { columns: REC_COLS, rows: rec.rows, height: 300, onExport: A.exportTable('DOI_CHIEU_44_STEP5', REC_COLS) });
    if (!rec.lots.length) { box.querySelector('#tfp-rl').innerHTML = A.emptyNote(rec.has51 || rec.has52 ? 'Không có lô nào chênh lệch.' : 'Chưa có số STEP 5.1 / 5.2 để đối chiếu.'); return; }
    A.mountTable(box.querySelector('#tfp-rl'), { columns: REC_LOT_COLS, rows: rec.lots, filterKey: 'type', height: 480, totals: ['q44', 'a44', 'q5', 'a5', 'dq', 'da'], onExport: A.exportTable('DOI_CHIEU_44_STEP5_THEO_LO', REC_LOT_COLS) });
  } else if (tab === 'sum') {
    if (!sm.prods.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    const cols = SUM_COLS;
    A.mountTable(box, { columns: cols, rows: sm.prods, height: 540, totals: ['curQty', 'curTotal', 'ytdQty', 'ytdRM', 'ytd622', 'ytd627', 'ytdTotal', 'soldQty', 'soldTot', 'lots'], onExport: A.exportTable('TP_SX_LUY_KE_SP', cols) });
  } else if (tab === 'month') {
    if (!sm.months.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    A.mountTable(box, { columns: MONTH_COLS, rows: sm.months, height: 480, totals: ['lots', 'qty', 'totalRM', 'c622', 'c627', 'total', 'soldQty', 'soldTot'], onExport: A.exportTable('TP_SX_THEO_THANG', MONTH_COLS) });
  } else if (tab === 'lots') {
    if (!rows.length) { box.innerHTML = A.emptyNote('Chưa có dữ liệu.'); return; }
    box.innerHTML = '<p class="muted">Lô sản xuất trong năm (gộp các dòng của lô). Bấm vào một lô để xem các dòng chi tiết và hoá đơn kỳ này.</p><div id="tfp-l"></div><div id="tfp-ld"></div>';
    A.mountTable(box.querySelector('#tfp-l'), { columns: LOT_ALLOC_COLS, rows: al.lots, filterKey: 'period', height: 480, totals: ['qty', 'totalRM', 'c622', 'c627', 'total', 'soldQty', 'soldTot', 'rwQty', 'rwTot', 'remQty', 'remTot'], onExport: A.exportTable('TP_SX_CHI_TIET_LO', LOT_ALLOC_COLS),
      onRowClick: (r) => {
        const recs = sales.filter((y) => FD.lotOf(y) === FD.lotOf(r));
        const parts = det.rows.filter((y) => FD.lotOf(y) === FD.lotOf(r)).map((y) => ({ ...y, cm: FD.cmText(y.costMonth) || 'CÒN TỒN', kindL: y.kind ? FD.KIND_LABEL[y.kind] || y.kind : '', unitCost: y.qty ? y.total / y.qty : null }));
        const ld = box.querySelector('#tfp-ld');
        ld.innerHTML = `<h2>Lô ${esc(r.pc || '(không PC)')} · ${esc(r.prod)} · nhập kho ${esc(r.period)} · SL ${A.fmtNum(r.qty)}</h2><div id="tfp-ldp"></div>${recs.length ? '<h2>Hoá đơn / phiếu đã lấy lô (FIFO)</h2><div id="tfp-ldt"></div>' : ''}`;
        A.mountTable(ld.querySelector('#tfp-ldp'), { columns: DET_VIEW_COLS, rows: parts, height: Math.min(360, 30 * parts.length + 110), totals: ['qty', 'total'] });
        if (recs.length) A.mountTable(ld.querySelector('#tfp-ldt'), { columns: ALLOC_COLS, rows: recs, height: Math.min(420, 30 * recs.length + 110), totals: ['qty', 'tot'], onExport: A.exportTable(`TP_SX_LO_${r.pc}`, ALLOC_COLS) });
        ld.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } });
  } else if (tab === 'alloc') {
    if (!sales.length) { box.innerHTML = A.emptyNote('Chưa có phân bổ – chạy FIFO (STEP 5.2) rồi Cập nhật từ STEP 4.3 / FIFO.'); return; }
    const recs = sales.map((y) => ({ ...y, unit: y.qty ? y.tot / y.qty : null }));
    box.innerHTML = `<p class="muted">Mỗi dòng = một phần lô thành phẩm đã xuất cho một dòng hoá đơn (hoặc xuất rework) theo FIFO.${det.unmatched.length ? ` <b>${det.unmatched.length}</b> dòng FIFO kỳ này lấy từ lô không có / không đủ trong bảng 4.4 (xem tab Đối chiếu).` : ''}</p><div id="tfp-a"></div>`;
    A.mountTable(box.querySelector('#tfp-a'), { columns: ALLOC_COLS, rows: recs, filterKey: 'month', height: 540, totals: ['qty', 'tot'], onExport: A.exportTable('TP_SX_PHAN_BO_GIA_VON', ALLOC_COLS) });
  } else {
    if (!op) { box.innerHTML = A.emptyNote('Chưa có số đầu kỳ.'); return; }
    box.innerHTML = `<p class="muted">${esc(op.kind)} · ${esc(op.source)} · nạp ${A.fmtTs(op.loadedAt)} · ${A.pill(op.status)} · BLOCK ${op.stats.block || 0} · REVIEW ${op.stats.review || 0}</p><div id="tfp-op"></div>`;
    if (op.model === 'DETAIL') {
      const cols = [...DET_VIEW_COLS, { key: 'check', label: 'Kiểm tra', type: 'status', width: 90 }, { key: 'msg', label: 'Thông báo', width: 320 }, { key: 'srcRow', label: 'Dòng file', type: 'int', width: 80 }];
      const list = op.rows.map((r) => ({ ...r, cm: FD.cmText(r.costMonth) || 'CÒN TỒN', kindL: r.kind ? FD.KIND_LABEL[r.kind] || r.kind : '', unitCost: r.qty ? r.total / r.qty : null }));
      A.mountTable(box.querySelector('#tfp-op'), { columns: cols, rows: list, filterKey: 'check', height: 520, totals: ['qty', 'totalRM', 'c622', 'c627', 'total'], onExport: A.exportTable('TP_DAU_KY_CHI_TIET', cols) });
      return;
    }
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
const DET_VIEW_COLS = [{ key: 'period', label: 'Kỳ SX', width: 80 }, { key: 'erp', label: 'ERP', width: 50 }, { key: 'pc', label: 'PC No.', width: 140 }, { key: 'date', label: 'Date', type: 'date', width: 95 }, { key: 'mo', label: 'MO No.', width: 140 },
  { key: 'prod', label: 'Product code', width: 150, trace: true }, { key: 'name', label: 'Product Name', width: 200 }, { key: 'loc', label: 'Location', width: 90 }, { key: 'unit', label: 'Unit', width: 50 }, Q('qty', 'Complete Qty', 100),
  N('total', 'Total cost(VND)'), N('totalRM', 'RM cost'), N('c622', 'Direct labors', 120), N('c627', 'Production cost', 120), N('unitCost', 'Unit cost', 100), { key: 'cm', label: 'Cost month', width: 95 }, { key: 'kindL', label: 'Loại xuất', width: 130 }, { key: 'docs', label: 'Chứng từ xuất', width: 200 }, { key: 'note', label: 'Note', width: 160 }, { key: 'src', label: 'Nguồn dòng', width: 170 }];
const CM_COLS = [{ key: 'cm', label: 'Cost month', width: 100 }, { key: 'rows', label: 'Số dòng', type: 'int', width: 80 }, { key: 'lots', label: 'Số lô', type: 'int', width: 70 }, Q('qty', 'SL'), N('total', 'Giá trị (VND)', 160), N('unit', 'Đơn giá BQ', 110),
  Q('qtyY', 'SL – SX năm nay'), N('totY', 'Giá trị – SX năm nay'), Q('qtyP', 'SL – SX năm trước'), N('totP', 'Giá trị – SX năm trước'), Q('rwQty', 'Trong đó xuất rework – SL'), N('rwTot', 'Xuất rework – giá trị')];
const REC_COLS = [{ key: 'area', label: 'Thời điểm', width: 90 }, { key: 'label', label: 'Đối chiếu', width: 420 }, Q('q44', 'SL 4.4'), N('a44', 'Giá trị 4.4', 160), Q('q5', 'SL STEP 5'), N('a5', 'Giá trị STEP 5', 160), Q('dq', 'Chênh SL'), N('da', 'Chênh giá trị', 140), { key: 'status', label: 'Kết quả', type: 'status', width: 110 }, { key: 'note', label: 'Ghi chú', width: 320 }];
const REC_LOT_COLS = [{ key: 'side', label: 'Thời điểm', width: 90 }, { key: 'type', label: 'Loại chênh lệch', width: 150 }, { key: 'pc', label: 'PC No.', width: 140 }, { key: 'prod', label: 'Product code', width: 150, trace: true }, { key: 'name', label: 'Product Name', width: 200 },
  Q('q44', 'SL 4.4'), N('a44', 'Giá trị 4.4'), Q('q5', 'SL STEP 5'), N('a5', 'Giá trị STEP 5'), Q('dq', 'Chênh SL'), N('da', 'Chênh giá trị'), { key: 'info', label: 'Ghi chú (nguồn lớp STEP 5)', width: 200 }];
const ALLOC_COLS = [{ key: 'month', label: 'Tháng xuất', width: 90 }, { key: 'kind', label: 'Loại', width: 80 }, { key: 'sdate', label: 'Ngày HĐ / xuất', type: 'date', width: 100 }, { key: 'inv', label: 'Hoá đơn / phiếu', width: 170 }, { key: 'cust', label: 'Khách hàng', width: 200 },
  { key: 'prod', label: 'Product Code', width: 150, trace: true }, { key: 'lotPeriod', label: 'Kỳ nhập lô', width: 90 }, { key: 'pc', label: 'PC No. (lô)', width: 150 }, Q('qty', 'SL', 90), N('tot', 'Giá vốn'), N('unit', 'Giá vốn / đv', 110)];

async function importFile(file) {
  if (!file || !A.guardEdit()) return;
  const S = A.S;
  if (closedNow(S)) { A.toast(`Kỳ ${S.period} đã đóng.`, 'review'); return; }
  await A.busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const res = await A.parseFile(await file.arrayBuffer(), 'all');
      // v1.14.27: the detail layout (FG month detail / FG_DETAIL) first, the old lot template otherwise
      const detail = !!FD.findDetailSheet(res.grids);
      if (!detail && isJan(S.period)) { A.toast('Tháng 1: dùng file chi tiết theo dòng (mẫu cũ theo lô không dùng cho tháng 1).', 'review'); return; }
      const op = detail ? FD.importDetail(res.grids, file.name, S.period) : FP.importOpening(res.grids, file.name, S.period);
      const cur = S.d.fgProd && S.d.fgProd.opening && S.d.fgProd.opening.period === S.period ? S.d.fgProd.opening : null;
      if (cur && cur.rows.length && !confirm(`Đã có số đầu kỳ (${cur.source}, ${cur.rows.length} dòng). Thay bằng file ${file.name}?`)) return;
      op.by = A.who();
      S.d.fgProd = { ...(S.d.fgProd || {}), year: S.period.slice(0, 4), opening: op };
      A.audit('STEP 4.4 - UPLOAD OPENING', `${file.name} · ${detail ? 'CHI TIẾT' : 'THEO LÔ'} · ${op.status} · ${op.stats.rows} dòng · ${A.fmtNum(op.stats.total)} VND${detail ? ` · còn tồn ${op.stats.stockRows} dòng / SL ${A.fmtNum(op.stats.stockQty)} / ${A.fmtNum(op.stats.stockTot)} VND` : ''} · BLOCK ${op.stats.block} · REVIEW ${op.stats.review}`);
      A.markDirty('fgProd', 'audit');
      S.tabFP = 'opening';
      A.toast(op.status === 'BLOCKED' ? `File đầu kỳ có ${op.stats.block} dòng lỗi – xem tab Số đầu kỳ.` : detail ? `Đã nạp ${A.fmtNum(op.stats.rows)} dòng chi tiết · còn tồn (chưa có Cost month) SL ${A.fmtNum(op.stats.stockQty)} · ${A.fmtNum(op.stats.stockTot)} VND.` : `Đã nạp ${op.stats.rows} dòng số đầu kỳ (${op.stats.months.join(', ')}) · ${A.fmtNum(op.stats.total)} VND.`, op.status === 'BLOCKED' ? 'block' : op.stats.review ? 'review' : 'pass');
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
    const pd = await A.loadPeriodData(prev);
    if (isJan(S.period) && !(pd && pd.fgProd && pd.fgProd.opening && pd.fgProd.opening.model === 'DETAIL')) op = FP.rollOpening(null, prev, S.period);
    else {
      if (!pd) { A.toast(`Không có dữ liệu kỳ ${prev} trên web. Dùng Upload file đầu kỳ.`, 'block'); return; }
      if (!(pd.closed && pd.closed.period === prev) && !confirm(`Kỳ ${prev} chưa đóng – số liệu kỳ đó còn có thể thay đổi. Vẫn roll forward?`)) return;
      op = FP.rollOpening(pd.fgProd, prev, S.period);
    }
    if (cur && cur.rows.length && !confirm(`Đã có số đầu kỳ (${cur.source}, ${cur.rows.length} dòng). Thay bằng ${op.source}?`)) return;
    op.by = A.who();
    S.d.fgProd = { ...(S.d.fgProd || {}), year: S.period.slice(0, 4), opening: op };
    A.audit('STEP 4.4 - ROLL FORWARD', `${op.source} · ${op.stats.rows} dòng · ${A.fmtNum(op.stats.total)} VND`);
    A.markDirty('fgProd', 'audit');
    A.toast(op.model === 'DETAIL' ? `Đã ${op.kind === 'NEW YEAR' ? 'mang tồn kho sang năm mới' : 'roll forward'}: ${A.fmtNum(op.stats.rows)} dòng · còn tồn SL ${A.fmtNum(op.stats.stockQty)} · ${A.fmtNum(op.stats.stockTot)} VND từ ${prev}.` : op.kind === 'NEW YEAR' ? `Bắt đầu năm ${S.period.slice(0, 4)} – không có số đầu kỳ.` : `Đã roll forward ${op.stats.rows} dòng (${op.stats.months.join(', ')}) · ${A.fmtNum(op.stats.total)} VND từ ${prev}.`, 'pass');
  } catch (e) { A.toast(e.message, 'block'); }
}
export async function doTemplate(next) {
  const S = A.S; const x = state(S);
  if (!next) { await A.exportBook(`SVL_TP_ChiTiet_DauKy_Template_${S.period}.xlsx`, [...FD.detailSheets([], S.period), TPL.fgDetailGuide(S.period)]); return; }
  const { det, rec } = detailOf(S);
  const np = nextP(S.period);
  const rows = FD.nextOpeningRows(det.rows, np);
  const warn = x.outdated || !x.posted ? ' (CHÚ Ý: chưa cập nhật đủ từ STEP 4.3)' : x.salesOutdated || !x.res ? ' (CHÚ Ý: chưa có / chưa cập nhật FIFO kỳ này)' : '';
  await A.exportBook(`SVL_TP_ChiTiet_DauKy_${np}.xlsx`, [...FD.detailSheets(rows, np, `Đến hết ${S.period}${warn}`), TPL.fgDetailGuide(np), reconSheet(rec, S.period)]);
}
/** Reconciliation 4.4 ↔ STEP 5 as a report sheet. */
function reconSheet(rec, period) {
  const head = ['Thời điểm', 'Đối chiếu', 'SL 4.4', 'Giá trị 4.4 (VND)', 'SL STEP 5', 'Giá trị STEP 5 (VND)', 'Chênh SL', 'Chênh giá trị (VND)', 'Kết quả', 'Ghi chú'];
  const n = (v) => (v === null || v === undefined ? '' : v);
  const aoa = [head, ...rec.rows.map((r) => [r.area, r.label, r.q44, Math.round(r.a44), n(r.q5), r.a5 === null ? '' : Math.round(r.a5), n(r.dq), r.da === null ? '' : Math.round(r.da), r.status, r.note]), [],
    [`Chênh lệch theo lô (${rec.lots.length})`], FD.RECON_LOT_HEADERS, ...rec.lots.map((l) => FD.RECON_LOT_FIELDS.map((k) => (typeof l[k] === 'number' && /^a|^da/.test(k) ? Math.round(l[k]) : l[k] ?? '')))];
  return { name: 'DOI_CHIEU_STEP5', title: `ĐỐI CHIẾU 4.4 ↔ STEP 5.1 / 5.2 – kỳ ${period} (chỉ cảnh báo, không chặn)`, subtitle: 'Tổng dòng chưa có Cost month của 4.4 = FG đầu kỳ (5.1) và = FG cuối kỳ sau FIFO (5.2)', header: 4, aoa, cols: [12, 60, 13, 18, 13, 18, 12, 16, 14, 40, 18, 30] };
}
const nextP = (p) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
export async function doExport() {
  const S = A.S; const x = state(S); const rows = FP.ytdRows(x.fp, S.period); const sales = FP.ytdSales(x.fp, S.period);
  const { det, rec } = detailOf(S);
  const sm = FP.summarize(rows, S.period, FD.isDetail(x.fp, S.period) ? FD.issuesOfYear(det.rows, S.period) : sales);
  const al = FP.allocate(rows, FP.allocSales(x.fp, S.period));
  const aoa = (cols, list) => [cols.map((c) => c.label), ...list.map((r) => cols.map((c) => { const v = r[c.key]; return c.type === 'date' && typeof v === 'number' ? serialToISO(v) : v ?? ''; }))];
  const w = (cols) => cols.map((c) => Math.round((c.width || 120) / 7));
  const [detSheet, tong] = FD.detailSheets(det.rows, S.period, `Bảng 4.4 kỳ ${S.period} (gồm Cost month ${FD.cmText(S.period)})`);
  await A.exportBook(`SVL_TP_SX_LuyKe_${S.period}.xlsx`, [
    { ...detSheet, name: 'Chi tiet theo dong' }, ...(tong ? [{ ...tong, name: 'Theo cost month' }] : []), reconSheet(rec, S.period),
    { name: 'Theo san pham', aoa: aoa(SUM_COLS, sm.prods), cols: w(SUM_COLS) },
    { name: 'Theo thang SX', aoa: aoa(MONTH_COLS, sm.months), cols: w(MONTH_COLS) },
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
