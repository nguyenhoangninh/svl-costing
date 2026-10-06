// 5B · Xử lý Rework — own flow for FG issued to rework (owner request 06/10/2026).
// FG issued to rework leaves FG (155) at FIFO cost into rework WIP (154). While OPEN / HOLD it is NOT costed into any product
// and NOT expensed; it rolls to the next period. Each line ends in one disposition:
//   COMPLETED → carry-in to the rework PC lot (STEP 4.3) · RETURNED TO FG → back to FG at the same cost · WRITTEN OFF → 632 / 811.
import { recheckRegisterRow, RW_STATUSES } from '../engine/step2.js';
import { num, ttxt, utxt, nowISO, serialToISO, isoToSerial } from '../engine/util.js';

let A = null;
export function install(api) { A = api; }
const esc = (s) => A.esc(s);
export const RWV_BLOBS = ['rwCfg'];
const cfg = (S) => ({ agingMonths: 3, woAccount: '632', erpDiffPct: 20, ...(S.d.rwCfg || {}) });
const closedNow = (S) => !!(S.d.closed && S.d.closed.period === S.period);
const monthsBetween = (a, b) => (/^\d{4}-\d{2}$/.test(a) && /^\d{4}-\d{2}$/.test(b) ? (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5) - +a.slice(5)) : 0);
const PENDING = new Set(['OPEN', 'HOLD']);
const ST_VI = { OPEN: 'Đang treo', HOLD: 'Tạm giữ', COMPLETED: 'Hoàn thành → lô mới', 'RETURNED TO FG': 'Trả về kho', 'WRITTEN OFF': 'Ra chi phí' };
const tabsHTML = (cur, tabs) => `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab ${id === cur ? 'on' : ''}" data-tabrw="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join('')}</div>`;

/** Rows enriched for display: cost basis, age, ERP vs FIFO unit cost. */
export function rows(S) {
  const c = cfg(S);
  const rmByRid = new Map(); const res = S.d.step5 && S.d.step5.period === S.period ? S.d.step5 : null;
  for (const f of (res && res.rework && res.rework.rows) || []) rmByRid.set(f.rid, num(rmByRid.get(f.rid)) + num(f.rm));
  return ((S.d.register && S.d.register.rows) || []).map((r) => {
    const bf = r.active === 'B/F';
    const qty = bf ? num(r.bfQty) : num(r.issueQty);
    const cost = bf ? num(r.bfCost) : num(r.fifoCost);
    const origin = ttxt(r.originPeriod) || S.period;
    const age = monthsBetween(origin, S.period);
    const erpUnit = !bf && num(r.issueQty) ? num(r.erpRef) / num(r.issueQty) : null;
    const fifoUnit = qty && cost ? cost / qty : null;
    const fifoRM = rmByRid.has(r.rid) && qty ? rmByRid.get(r.rid) / qty : null;
    const erpDiff = erpUnit !== null && fifoUnit ? (erpUnit - fifoUnit) / fifoUnit : null;
    // ERP Stock Out cost = raw material only (no 622 / 627): normally ERP ≈ FIFO RM ≤ FIFO full cost
    const erpCheck = erpUnit === null || !fifoUnit ? '' : erpUnit > fifoUnit * 1.02 ? 'BẤT THƯỜNG: ERP > giá thành đầy đủ' : fifoRM && Math.abs(erpUnit - fifoRM) <= fifoRM * 0.05 ? 'Khớp NVL' : fifoRM && erpUnit < fifoRM * 0.95 ? 'ERP thấp hơn NVL' : 'Trong khoảng NVL – giá thành';
    const pending = PENDING.has(utxt(r.rwStatus)) || (num(r.closingWIP) > 1);
    return { ...r, qty, cost, origin, age, erpUnit, fifoUnit, fifoRM, erpCheck, erpDiff, erpFlag: erpDiff !== null && Math.abs(erpDiff) * 100 > c.erpDiffPct ? 'LỆCH' : '', pending, stVi: ST_VI[utxt(r.rwStatus)] || r.rwStatus, aged: pending && age >= c.agingMonths };
  });
}
export function summary(S) {
  const R = rows(S); const c = cfg(S);
  const sum = (f, p = () => true) => R.filter(p).reduce((a, r) => a + num(r[f]), 0);
  const res = S.d.step5 && S.d.step5.period === S.period ? S.d.step5 : null;
  const o = {
    bf: sum('bfCost', (r) => r.active === 'B/F'), transfer: sum('fifoCost', (r) => r.active === 'Y'), erp: sum('erpRef', (r) => r.active === 'Y'),
    completed: sum('carryIn'), returned: sum('returnedFG'), writeOff: sum('writeOff'), closing: sum('closingWIP'),
    erpAbn: R.filter((r) => r.erpCheck.startsWith('BẤT')).reduce((a, r) => a + num(r.erpRef), 0), erpAbnFifo: R.filter((r) => r.erpCheck.startsWith('BẤT')).reduce((a, r) => a + num(r.cost), 0), erpAbnN: R.filter((r) => r.erpCheck.startsWith('BẤT')).length,
    pending: R.filter((r) => r.pending).length, aged: R.filter((r) => r.aged).length, notRun: R.some((r) => r.active === 'Y' && !['PASS'].includes(utxt(r.fifoStatus)) && !utxt(r.fifoStatus).startsWith('BLOCK')),
    woByAcc: {}, agingMonths: c.agingMonths, runAt: res && res.rework ? res.rework.runAt : '',
  };
  for (const r of R) if (num(r.writeOff) > 1) { const a = ttxt(r.woAccount) || '632'; o.woByAcc[a] = num(o.woByAcc[a]) + num(r.writeOff); }
  o.roll = o.bf + o.transfer - o.completed - o.returned - o.writeOff - o.closing;
  return o;
}
export function status(S) {
  if (!S.d.register || !S.d.register.rows.length) return 'PASS';
  const sm = summary(S);
  if (sm.notRun) return 'NOT RUN';
  if (Math.abs(sm.roll) > 1) return 'CHECK';
  if (sm.aged || rows(S).some((r) => String(r.inputCheck).startsWith('REVIEW'))) return 'PASS WITH REVIEW';
  return 'PASS';
}

export function view(el) {
  const S = A.S; const d = S.d; const reg = d.register; const c = cfg(S);
  const closed = closedNow(S); const edit = A.canEdit() && !closed;
  if (!reg) { el.innerHTML = `<section class="page"><header class="ph"><div><h1>5B · Xử lý Rework</h1></div></header>${A.emptyNote('Sổ FG Rework được tạo khi chạy STEP 2.', 'step2', 'Mở STEP 2')}</section>`; return; }
  const R = rows(S); const sm = summary(S); const tab = S.tabRW || 'pending';
  const sel = S.rwSel ? R.find((r) => r.rid === S.rwSel) : null;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>5B · Xử lý Rework</h1><p class="lead">FG xuất đi rework rời kho thành phẩm (155) theo <b>giá FIFO của lô</b> và nằm ở <b>WIP rework (154)</b>. Khi còn treo (OPEN / HOLD) thì <b>không tính vào giá thành sản phẩm nào và không vào giá vốn</b> – chỉ chuyển sang kỳ sau. Mỗi dòng kết thúc bằng một hướng xử lý: hoàn thành → vào lô mới (STEP 4.3), trả về kho nguyên trạng, hoặc ra chi phí.</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(status(S))}<small>${sm.pending} dòng treo${sm.aged ? ` · ${sm.aged} quá ${c.agingMonths} tháng` : ''}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    ${sm.notRun ? '<div class="alert review">Có dòng xuất rework kỳ này chưa có giá FIFO – chạy STEP 5.2 RUN FIFO COGS.</div>' : ''}
    <div class="kpis">${A.kpi('WIP rework đầu kỳ (B/F)', sm.bf)}${A.kpi('FG xuất rework kỳ này (FIFO)', sm.transfer)}${A.kpi('Hoàn thành → lô mới', sm.completed)}${A.kpi('Trả về kho', sm.returned)}${A.kpi('Ra chi phí', sm.writeOff)}${A.kpi('WIP rework cuối kỳ (154)', sm.closing, true)}</div>
    <div class="alert ${sm.erpAbnN ? 'review' : 'info'}"><b>ERP Stock Out so với giá FIFO.</b> Giá ERP trên phiếu Stock Out chỉ gồm nguyên vật liệu (không có 622 / 627), nên bình thường <b>ERP ≈ phần NVL của lô FIFO ≤ giá thành FIFO đầy đủ</b>. Web dùng giá FIFO của chính lô thành phẩm (gồm NVL + 622 + 627) cho 154 / 155.${sm.erpAbnN ? ` Kỳ này có <b>${sm.erpAbnN} dòng ERP cao hơn cả giá thành đầy đủ</b> (ERP ${A.fmtNum(sm.erpAbn)} so với FIFO ${A.fmtNum(sm.erpAbnFifo)} VND) – đơn giá ERP của các dòng này bất thường, cần kiểm tra giá xuất kho trên ERP (tab "ERP vs FIFO", lọc "BẤT THƯỜNG"). Không tính các dòng đó, ERP ${A.fmtNum(sm.erp - sm.erpAbn)} ≤ FIFO ${A.fmtNum(sm.transfer - sm.erpAbnFifo)} VND đúng như nguyên tắc.` : ''}</div>
    <div class="row"><label>Cảnh báo treo quá <input id="rw-age" inputmode="numeric" value="${c.agingMonths}" style="width:50px;text-align:right" ${edit ? '' : 'disabled'}> tháng</label>
      <label>TK chi phí mặc định <select id="rw-acc" ${edit ? '' : 'disabled'}>${['632', '811'].map((a) => `<option ${c.woAccount === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <a class="btn ghost" href="#rework">Mở sổ 2B</a><a class="btn ghost" href="#step5">STEP 5.2 RUN FIFO</a></div>
    <div id="rw-form"></div>
    ${tabsHTML(tab, [['pending', `Đang treo (${sm.pending})`], ['done', `Đã xử lý (${R.filter((r) => !r.pending).length})`], ['erp', 'ERP vs FIFO'], ['roll', 'Luân chuyển 154 & bút toán']])}
    <div id="rw-box"></div></section>`;
  el.querySelectorAll('[data-tabrw]').forEach((b) => b.addEventListener('click', () => { S.tabRW = b.dataset.tabrw; A.render(); }));
  const ageIn = el.querySelector('#rw-age'), accIn = el.querySelector('#rw-acc');
  if (ageIn) ageIn.addEventListener('change', () => { if (!A.guardEdit()) return; const v = Math.max(1, Math.round(num(ageIn.value))); d.rwCfg = { ...(d.rwCfg || {}), agingMonths: v }; A.audit('REWORK CONFIG', `Cảnh báo treo quá ${v} tháng`); A.markDirty('rwCfg', 'audit'); A.render(); });
  if (accIn) accIn.addEventListener('change', () => { if (!A.guardEdit()) return; d.rwCfg = { ...(d.rwCfg || {}), woAccount: accIn.value }; A.audit('REWORK CONFIG', `TK chi phí mặc định ${accIn.value}`); A.markDirty('rwCfg', 'audit'); A.render(); });
  if (sel && edit) form(el.querySelector('#rw-form'), S, sel, c);
  const box = el.querySelector('#rw-box');
  const N = (key, label, width = 130) => ({ key, label, type: 'num', width });
  const base = [{ key: 'rid', label: 'Rework ID', width: 230 }, { key: 'active', label: 'Nguồn', width: 60 }, { key: 'doc', label: 'Phiếu Stock Out', width: 140 }, { key: 'issueDate', label: 'Ngày xuất', type: 'date', width: 95 }, { key: 'origin', label: 'Kỳ xuất', width: 80 }, { key: 'age', label: 'Tuổi (tháng)', type: 'int', width: 80 },
    { key: 'fg', label: 'FG Code', width: 140 }, { key: 'fgName', label: 'FG Name', width: 200 }, { key: 'qty', label: 'SL', type: 'qty', width: 70 }, N('cost', 'Giá trị (FIFO)')];
  if (tab === 'pending') {
    const list = R.filter((r) => r.pending);
    if (!list.length) { box.innerHTML = A.emptyNote('Không có rework đang treo.'); return; }
    box.innerHTML = `<p class="muted">${edit ? 'Bấm một dòng để xử lý.' : ''} Dòng treo từ ${c.agingMonths} tháng trở lên được đánh dấu.</p><div id="rw-t"></div>`;
    const cols = [...base, N('closingWIP', 'Đang ở 154'), { key: 'stVi', label: 'Trạng thái', width: 110 }, { key: 'rwType', label: 'Loại', width: 90 }, { key: 'inputCheck', label: 'Kiểm tra', type: 'status', width: 150 }, { key: 'agedTxt', label: 'Cảnh báo', width: 120 }, { key: 'note', label: 'Ghi chú', width: 200 }];
    A.mountTable(box.querySelector('#rw-t'), { columns: cols, rows: list.map((r) => ({ ...r, agedTxt: r.aged ? `Treo ≥ ${c.agingMonths} tháng` : '' })), height: 460, totals: ['qty', 'cost', 'closingWIP'], onExport: A.exportTable('REWORK_DANG_TREO', cols), onRowClick: edit ? (r) => { S.rwSel = r.rid; A.render(); } : undefined });
  } else if (tab === 'done') {
    const list = R.filter((r) => !r.pending);
    if (!list.length) { box.innerHTML = A.emptyNote('Chưa có dòng nào được xử lý.'); return; }
    box.innerHTML = `<p class="muted">${edit ? 'Bấm một dòng để sửa hoặc mở lại (OPEN).' : ''}</p><div id="rw-t"></div>`;
    const cols = [...base, { key: 'stVi', label: 'Hướng xử lý', width: 140 }, N('carryIn', 'Vào lô mới'), { key: 'pcNo', label: 'PC rework', width: 130 }, N('returnedFG', 'Trả về kho'), N('writeOff', 'Ra chi phí'), { key: 'woAccount', label: 'TK', width: 60 }, { key: 'scrapQty', label: 'SL hỏng', type: 'qty', width: 80 }, { key: 'scrapTreat', label: 'Hỏng tính vào', width: 110 }, { key: 'dispNote', label: 'Lý do / căn cứ', width: 220 }, { key: 'dispBy', label: 'Người xử lý', width: 160 }];
    A.mountTable(box.querySelector('#rw-t'), { columns: cols, rows: list, height: 460, totals: ['qty', 'cost', 'carryIn', 'returnedFG', 'writeOff'], onExport: A.exportTable('REWORK_DA_XU_LY', cols), onRowClick: edit ? (r) => { S.rwSel = r.rid; A.render(); } : undefined });
  } else if (tab === 'erp') {
    const list = R.filter((r) => r.active === 'Y');
    box.innerHTML = `<p class="muted">Đơn giá ERP = ERP Amount / SL trên phiếu Stock Out (chỉ NVL). So với lô FIFO thực tế lấy ra: <b>Khớp NVL</b> = ERP trong ±5% phần NVL của lô; <b>BẤT THƯỜNG</b> = ERP cao hơn cả giá thành đầy đủ (NVL + 622 + 627) – không thể đúng nếu ERP chỉ có NVL, cần kiểm tra giá xuất kho trên ERP; <b>ERP thấp hơn NVL</b> = ERP dùng giá NVL cũ / bình quân thấp hơn lô thực tế.</p><div id="rw-t"></div>`;
    const cols = [...base.filter((x) => !['age', 'origin'].includes(x.key)), N('erpRef', 'ERP Amount (memo)'), N('erpUnit', 'Đơn giá ERP', 120), N('fifoRM', 'FIFO – phần NVL / đv', 130), N('fifoUnit', 'FIFO – giá thành đầy đủ / đv', 150), { key: 'erpDiffPct', label: 'ERP so với giá thành', type: 'pct', width: 100 }, N('erpGap', 'Chênh (ERP − FIFO)'), { key: 'erpCheck', label: 'Đánh giá', width: 230 }];
    A.mountTable(box.querySelector('#rw-t'), { columns: cols, rows: list.map((r) => ({ ...r, erpDiffPct: r.erpDiff, erpGap: num(r.erpRef) - num(r.fifoCost) })), filterKey: 'erpCheck', height: 480, totals: ['qty', 'cost', 'erpRef', 'erpGap'], onExport: A.exportTable('REWORK_ERP_VS_FIFO', cols) });
  } else {
    const tr = (l, v, b) => `<tr><td>${b ? '<b>' + esc(l) + '</b>' : esc(l)}</td><td class="r">${b ? '<b>' + A.fmtNum(v) + '</b>' : A.fmtNum(v)}</td></tr>`;
    const je = [['FG xuất đi rework (theo FIFO)', '154 (rework)', '155', sm.transfer], ['Rework hoàn thành – vào giá thành lô mới (qua STEP 4.3)', '155', '154 (rework)', sm.completed], ['Rework trả về kho nguyên trạng', '155', '154 (rework)', sm.returned],
      ...Object.entries(sm.woByAcc).map(([a, v]) => [`Rework ra chi phí (hủy / không sửa được / hàng hỏng)`, a, '154 (rework)', v])].filter((x) => Math.abs(x[3]) > 1);
    box.innerHTML = `<h2>Luân chuyển WIP rework (TK 154)</h2><table class="cp"><tbody>${tr('Đầu kỳ (B/F)', sm.bf)}${tr('+ FG xuất rework kỳ này', sm.transfer)}${tr('− Hoàn thành → lô mới', sm.completed)}${tr('− Trả về kho', sm.returned)}${tr('− Ra chi phí', sm.writeOff)}${tr('= Cuối kỳ (chuyển kỳ sau)', sm.closing, true)}<tr><td>Chênh lệch kiểm tra</td><td class="r">${A.pill(Math.abs(sm.roll) <= 1 ? 'PASS' : 'CHECK')} ${A.fmtNum(sm.roll)}</td></tr></tbody></table>
      <h2>Bút toán đề xuất trên FAST</h2>${je.length ? `<table class="cp"><thead><tr><th>Nghiệp vụ</th><th>Nợ</th><th>Có</th><th class="r">Số tiền</th></tr></thead><tbody>${je.map(([l, dr, cr, v]) => `<tr><td>${esc(l)}</td><td>${esc(dr)}</td><td>${esc(cr)}</td><td class="r">${A.fmtNum(v)}</td></tr>`).join('')}</tbody></table>` : A.emptyNote('Không có phát sinh.')}
      <p class="muted">Giá trị đang treo không đi vào giá thành sản phẩm hay giá vốn của kỳ. Khi đóng kỳ, các dòng còn treo được chuyển sang kỳ sau (B/F) với đúng giá trị này.</p>`;
  }
}

function form(box, S, r, c) {
  const st = utxt(r.rwStatus);
  const v = (x) => esc(x ?? '');
  const dt = typeof r.compDate === 'number' ? serialToISO(r.compDate) : '';
  box.innerHTML = `<form id="f-rw" class="card" style="padding:12px;margin:8px 0;border:1px solid var(--line, #ccc);border-radius:10px">
    <h2 style="margin-top:0">Xử lý: ${esc(r.rid)}</h2>
    <p class="muted">${esc(r.fg)} · ${esc(r.fgName || '')} · SL ${A.fmtNum(r.qty)} · giá trị FIFO ${A.fmtNum(r.cost)} VND · xuất ${esc(r.origin)} (${r.age} tháng)</p>
    <div class="row" style="flex-wrap:wrap;gap:12px">
      <label>Hướng xử lý <select name="st">${RW_STATUSES.map((x) => `<option value="${x}" ${x === st ? 'selected' : ''}>${esc(ST_VI[x])} (${x})</option>`).join('')}</select></label>
      <label>Loại <select name="ty">${['NORMAL', 'ABNORMAL'].map((x) => `<option ${x === utxt(r.rwType) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label data-for="COMPLETED">PC rework <input name="pc" value="${v(r.pcNo)}" style="width:140px"></label>
      <label data-for="COMPLETED">FG đầu ra <input name="out" value="${v(r.outFG || r.fg)}" style="width:140px"></label>
      <label data-for="COMPLETED|RETURNED TO FG|WRITTEN OFF">Ngày <input type="date" name="dt" value="${dt}"></label>
      <label data-for="COMPLETED">SL hoàn thành <input name="cq" inputmode="decimal" value="${r.compQty ?? ''}" style="width:90px;text-align:right"></label>
      <label data-for="COMPLETED">SL hỏng <input name="sq" inputmode="decimal" value="${r.scrapQty ?? ''}" style="width:80px;text-align:right"></label>
      <label data-for="COMPLETED">Hàng hỏng tính vào <select name="tr"><option value="ABSORB" ${utxt(r.scrapTreat) !== 'EXPENSE' ? 'selected' : ''}>Giá thành lô mới</option><option value="EXPENSE" ${utxt(r.scrapTreat) === 'EXPENSE' ? 'selected' : ''}>Chi phí</option></select></label>
      <label data-for="WRITTEN OFF|COMPLETED">TK chi phí <select name="acc">${['632', '811'].map((a) => `<option ${(ttxt(r.woAccount) || c.woAccount) === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <label style="flex:1;min-width:260px">Lý do / căn cứ <input name="note" value="${v(r.dispNote || '')}" placeholder="Bắt buộc khi trả về kho / ra chi phí (≥ 5 ký tự)" style="width:100%"></label>
    </div>
    <div class="row"><button class="btn" type="submit">Lưu xử lý</button><button class="btn ghost" type="button" id="rw-cancel">Đóng</button>
      <span class="muted">Sau khi lưu: chạy lại STEP 4 (nếu hoàn thành → lô mới) rồi RUN FIFO để cập nhật giá trị.</span></div></form>`;
  const f = box.querySelector('#f-rw');
  const sync = () => { const s = f.elements.st.value; f.querySelectorAll('[data-for]').forEach((l) => { l.style.display = l.dataset.for.split('|').includes(s) ? '' : 'none'; }); };
  f.elements.st.addEventListener('change', sync); sync();
  box.querySelector('#rw-cancel').addEventListener('click', () => { S.rwSel = null; A.render(); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!A.guardEdit() || closedNow(S)) return;
    const row = S.d.register.rows.find((x) => x.rid === r.rid); if (!row) return;
    const s = f.elements.st.value, note = f.elements.note.value.trim();
    const qn = (name, label) => { const raw = f.elements[name].value.trim(); if (!raw) return null; const x = A.parseNum(raw, label); return x === undefined ? NaN : x; };
    if ((s === 'RETURNED TO FG' || s === 'WRITTEN OFF') && note.length < 5) { A.toast('Nhập lý do / căn cứ (ít nhất 5 ký tự).', 'review'); return; }
    if (s === 'COMPLETED') {
      const cq = qn('cq', 'SL hoàn thành'), sq = qn('sq', 'SL hỏng'); if (Number.isNaN(cq) || Number.isNaN(sq)) return;
      if (!f.elements.pc.value.trim()) { A.toast('Nhập PC rework (lô thành phẩm sau rework).', 'review'); return; }
      if (!(num(cq) > 0)) { A.toast('Nhập SL hoàn thành.', 'review'); return; }
      if (Math.abs(num(cq) + num(sq) - r.qty) > 0.000001) { A.toast(`SL hoàn thành + SL hỏng phải bằng SL xuất rework (${A.fmtNum(r.qty)}).`, 'review'); return; }
      Object.assign(row, { pcNo: f.elements.pc.value.trim(), outFG: f.elements.out.value.trim() || row.fg, compQty: cq, scrapQty: sq || 0, scrapTreat: f.elements.tr.value, woAccount: f.elements.acc.value });
    }
    if (s === 'WRITTEN OFF') row.woAccount = f.elements.acc.value;
    const ds = f.elements.dt.value; if (ds) row.compDate = isoToSerial(ds);
    Object.assign(row, { rwStatus: s, rwType: f.elements.ty.value, dispNote: note || row.dispNote || null, dispBy: A.who(), dispAt: nowISO() });
    if (!row.outFG) row.outFG = row.fg;
    recheckRegisterRow(row);
    A.audit('REWORK DISPOSITION', `${row.rid}: ${s}${s === 'COMPLETED' ? ` → ${row.pcNo} (hỏng ${num(row.scrapQty)} → ${row.scrapTreat})` : ''}${s === 'WRITTEN OFF' ? ` → TK ${row.woAccount}` : ''} · ${note}`);
    A.markDirty('register', 'audit');
    S.rwSel = null;
    A.toast(`Đã lưu: ${ST_VI[s]}. ${s === 'COMPLETED' ? 'Chạy lại STEP 4.3 rồi RUN FIFO.' : s === 'OPEN' || s === 'HOLD' ? 'Giá trị vẫn treo ở 154.' : 'Chạy lại RUN FIFO (STEP 5.2) để cập nhật tồn kho / 154.'}`, 'pass');
    A.render();
  });
}
