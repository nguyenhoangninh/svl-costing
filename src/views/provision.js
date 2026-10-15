// Dự phòng FG (TK 2294) — its own step, 5P (v1.14.71; roll-forward and NRV decision v1.14.73).
//   opening  : uploaded with the PROVISION_OPENING template, or carried from last period's closing when it exists
//   increase : NRV approved in the period (decision RECORDED here in 5P)
//   decrease : release on the products sold and used internally (FIFO), net of sales returns
//   closing  : opening + increase − decrease; the rework part is kept apart (not posted until accounting decides)
// Logic lives in engine/provision.js; the NRV decision helpers in engine/nrvdecision.js.
import * as PROV from '../engine/provision.js';
import * as P3 from './phase3.js';
import { num, nowISO, prevPeriod } from '../engine/util.js';

let A = null;
export function install(api) { A = api; }
const esc = (v) => A.esc(v);

/** Where the opening provision came from: the uploaded file, last period's closing, or (older data) a roll forward of FG. */
function openingSource(op) {
  if (!op) return null;
  if (op.provSource) return op.provSource.kind ? op.provSource : { kind: 'FILE', ...op.provSource };
  if (op.srcKind === 'ROLL FORWARD') return { kind: 'CARRY', legacy: true };
  return null;
}
const layerSum = (op) => -((op && op.rows) || []).reduce((a, r) => a + num(r.prov), 0);
const nrvPending = (S, res) => res && Math.abs(num(res.totals && res.totals.nrvProv)) > 1 && !P3.currentNrv(S, res);

function compute(S, res) {
  if (!res) return null;
  const approved = P3.nrvApprovedFor(S, res);
  const trk = PROV.provisionTrack(res, approved.byLayer);
  const mv = PROV.provisionMovement(trk, approved);
  const jr = PROV.provisionJournal(trk, approved.total);
  return { approved, trk, mv, jr };
}

/** Rail status: NOT RUN before FIFO; PASS WITH REVIEW while the opening is missing or NRV waits for a decision. */
export function railStatus(S, D5) {
  if (!D5 || !D5.res) return 'NOT RUN';
  const c = compute(S, D5.res);
  if (!c.mv.ok) return 'BLOCK';
  if (!openingSource(S.d.fgOpen) || nrvPending(S, D5.res)) return 'PASS WITH REVIEW';
  return 'PASS';
}

/** Opening provision from the PROVISION_OPENING template; the FG opening must be validated again afterwards. */
async function importProvFile(file) {
  if (!file || !A.guardEdit() || P3.closedGuard()) return;
  const S = A.S;
  if (!S.d.fgOpen || !S.d.fgOpen.rows.length) { A.toast('Nạp FG đầu kỳ trước (5.1), rồi nạp dự phòng.', 'block'); return; }
  await A.busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const res = await A.parseFile(await file.arrayBuffer(), 'all');
      const parsed = PROV.parseOpeningProvision(res.grids, file.name, S.period);
      if (!parsed.ok) { A.toast('Chưa nạp dự phòng: ' + parsed.errors.slice(0, 3).join(' · '), 'block'); return; }
      const app = PROV.applyOpeningProvision(S.d.fgOpen, parsed);
      if (!app.ok) { A.toast('Chưa nạp dự phòng: ' + app.errors.slice(0, 3).join(' · '), 'block'); return; }
      S.d.fgOpen.provSource = { kind: 'FILE', file: file.name, glBalance: parsed.glBalance, sum: parsed.sum, count: parsed.rows.length, matched: app.matched, zeroLayers: app.zeroLayers, by: A.who(), at: nowISO() };
      S.d.fgOpen.status = 'LOADED - NOT VALIDATED'; S.d.fgOpen.validatedAt = '';
      A.audit('STEP 5 - IMPORT OPENING PROVISION', `Lớp=${app.matched}; Dự phòng=${A.fmtNum(parsed.sum)}; Sổ cái=${A.fmtNum(parsed.glBalance)}; File=${file.name}`);
      A.markDirty('fgOpen', 'audit');
      A.toast(`Đã nạp dự phòng cho ${app.matched} lớp. Bước tiếp: Validate FG đầu kỳ (5.1).`, 'pass');
    } catch (e) { A.toast('Nạp dự phòng lỗi: ' + e.message, 'block'); }
  });
  A.render();
}

/** Opening provision = last period's closing provision (layers + NRV approved there), matched onto this period's FG opening. */
async function carryFromPrev() {
  if (!A.guardEdit() || P3.closedGuard()) return;
  const S = A.S; const prev = prevPeriod(S.period);
  if (!S.d.fgOpen || !S.d.fgOpen.rows.length) { A.toast('Nạp hoặc roll forward FG đầu kỳ (5.1) trước, rồi chuyển dự phòng.', 'block'); return; }
  const pd = await A.loadPeriodData(prev);
  if (!pd || !pd.step5 || !(pd.step5.closing || []).length) { A.toast(`Kỳ ${prev} chưa có số liệu STEP 5 trên hệ thống. Nạp dự phòng đầu kỳ bằng template.`, 'block'); return; }
  if (!(pd.closed && pd.closed.period === prev) && !confirm(`Kỳ ${prev} chưa đóng, số dư cuối kỳ có thể còn thay đổi. Vẫn chuyển sang đầu kỳ ${S.period}?`)) return;
  const cur = openingSource(S.d.fgOpen);
  if (cur && !cur.legacy && !confirm(`Đầu kỳ đã có dự phòng (${cur.kind === 'FILE' ? 'file ' + (cur.file || '') : 'chuyển từ ' + (cur.from || 'kỳ trước')}). Thay bằng số dư cuối kỳ ${prev}?`)) return;
  const decision = pd.nrvDecision && pd.nrvDecision.key === P3.nrvKey(pd.step5) ? pd.nrvDecision : null;
  const r = PROV.carryOpeningProvision(S.d.fgOpen, pd.step5, decision);
  if (!r.ok) { A.toast('Chưa chuyển được: ' + r.errors.slice(0, 2).join(' · '), 'block'); return; }
  S.d.fgOpen.provSource = { kind: 'CARRY', from: prev, expected: r.expected, sum: r.sum, count: r.matched, by: A.who(), at: nowISO() };
  S.d.fgOpen.status = 'LOADED - NOT VALIDATED'; S.d.fgOpen.validatedAt = '';
  A.audit('STEP 5 - CARRY OPENING PROVISION', `Từ ${prev}; Lớp=${r.matched}; Dự phòng=${A.fmtNum(r.sum)}`);
  A.markDirty('fgOpen', 'audit');
  A.toast(`Đã chuyển dự phòng ${A.fmtNum(r.sum)} VND (${r.matched} lớp) từ ${prev}. Bước tiếp: Validate FG đầu kỳ (5.1).`, 'pass');
  A.render();
}

const LAYER_BASE = [
  { key: 'lid', label: 'Layer ID', width: 220 }, { key: 'source', label: 'Nguồn', width: 110 }, { key: 'pc', label: 'PC No.', width: 120 },
  { key: 'prod', label: 'Mã SP', width: 130 }, { key: 'loc', label: 'Location', width: 90 }, { key: 'date', label: 'Ngày lô', type: 'date', width: 95 },
  { key: 'qtyIn', label: 'SL vào', type: 'qty', width: 100 }, { key: 'qtyRem', label: 'SL còn', type: 'qty', width: 100 },
];
const MOVE_COLS = [
  { key: 'open', label: 'DP đầu kỳ', type: 'num', width: 130 }, { key: 'restore', label: 'Hoàn lại (trả hàng)', type: 'num', width: 150 },
  { key: 'relSale', label: 'Hoàn nhập khi bán', type: 'num', width: 150 }, { key: 'relCons', label: 'Hoàn nhập tiêu dùng', type: 'num', width: 150 },
  { key: 'closePre', label: 'DP trước NRV', type: 'num', width: 130 }, { key: 'nrvProp', label: 'NRV đề xuất', type: 'num', width: 130 },
  { key: 'nrvAdj', label: 'NRV đã duyệt (tăng)', type: 'num', width: 150 }, { key: 'close', label: 'DP cuối kỳ (FG)', type: 'num', width: 140 },
];
const MAIN_COLS = [...LAYER_BASE, ...MOVE_COLS];
const MAIN_TOTALS = ['qtyIn', 'qtyRem', 'open', 'restore', 'relSale', 'relCons', 'closePre', 'nrvProp', 'nrvAdj', 'close'];
const REWORK_COLS = [...LAYER_BASE, { key: 'relRw', label: 'Chuyển rework (chờ, không ghi sổ)', type: 'num', width: 210 }];

function openingText(src, op) {
  if (!src) return Math.abs(layerSum(op)) > 1
    ? `Có sẵn ${A.fmtNum(layerSum(op))} VND trên lớp FG đầu kỳ, chưa xác nhận nguồn. Chuyển từ kỳ trước hoặc nạp template.`
    : 'Chưa có. Chuyển từ kỳ trước (nếu đã có số liệu) hoặc nạp template PROVISION_OPENING.';
  if (src.kind === 'FILE') return `File ${esc(src.file)} · ${src.count} dòng · ${A.fmtNum(src.sum)} VND = sổ cái ${A.fmtNum(src.glBalance)} · ${A.fmtTs(src.at)}`;
  if (src.legacy) return `Chuyển cùng FG đầu kỳ (roll forward) · ${A.fmtNum(layerSum(op))} VND`;
  return `Chuyển từ cuối kỳ ${esc(src.from)} · ${src.count} lớp · ${A.fmtNum(src.sum)} VND`;
}
const tabsHTML = (cur, tabs) => `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab ${id === cur ? 'on' : ''}" data-tabp="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join('')}</div>`;

// v1.14.74: compact layout — one equation strip, opening and NRV side by side, details in tabs
export function view(el) {
  const S = A.S; const D5 = A.derived().d5; const res = D5 ? D5.res : null; const op = S.d.fgOpen;
  const closed = S.d.closed && S.d.closed.period === S.period;
  const src = openingSource(op);
  const c = compute(S, res);
  const tt = c ? c.trk.totals : null, mv = c ? c.mv : null, jr = c ? c.jr : null;
  const reworkRows = c ? c.trk.rows.filter((r) => Math.abs(num(r.relRw)) > 0.005) : [];
  const carryDiff = src && src.kind === 'CARRY' && !src.legacy ? layerSum(op) - num(src.expected) : 0;
  const edit = A.canEdit() && !closed;
  const nrvBlock = res && Math.abs(num(res.totals && res.totals.nrvProv)) > 1;
  const pending = nrvPending(S, res);
  const tab = ['move', 'je', 'layers', 'rw'].includes(S.tabP) ? S.tabP : 'move';
  const opx = (x) => `<i class="op" aria-hidden="true">${x}</i>`;
  const mvRow = (label, v, cls = '', note = '') => `<tr class="${cls}"><td>${label}</td><td class="r">${A.fmtNum(v)}</td><td class="muted">${note}</td></tr>`;

  const strip = res ? `<div class="kpi-groups"><section class="kpi-group"><h3>TK ${PROV.PROV_ACC} · kỳ ${esc(S.period)}</h3><div class="kpis kpi-flow">
      ${A.kpi('Đầu kỳ', mv.open, false, { tone: 'base', sub: src ? (src.kind === 'FILE' ? 'Theo file upload' : 'Chuyển từ kỳ trước') : 'Chưa xác nhận nguồn' })}${opx('+')}
      ${A.kpi('Tăng (NRV duyệt)', mv.increase, false, { tone: 'in', sub: pending ? `Chờ quyết định · đề xuất ${A.fmtNum(mv.nrvProposed)}` : `Đề xuất ${A.fmtNum(mv.nrvProposed)}` })}${opx('−')}
      ${A.kpi('Giảm (hoàn nhập)', mv.decrease, false, { tone: 'out', sub: 'Bán + tiêu dùng − trả hàng' })}${opx('=')}
      ${A.kpi('Cuối kỳ', mv.closeBooks, true, { tone: 'res', sub: mv.ok ? (Math.abs(mv.rework) > 0.5 ? `<i class="ok">✓</i> gồm rework ${A.fmtNum(mv.rework)}` : '<i class="ok">✓ khớp theo lớp</i> · sang kỳ sau') : `<i class="warn">Lệch ${A.fmtNum(mv.check)}</i>` })}
    </div></section></div>` : '';

  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>Dự phòng FG · TK ${PROV.PROV_ACC}</h1><p class="lead">Cuối kỳ = đầu kỳ + tăng (NRV duyệt) − giảm (hoàn nhập khi bán, tiêu dùng, trừ trả hàng); chuyển sang đầu kỳ sau. Rework tách riêng, chưa ghi sổ.</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(railStatus(S, D5))}<small>${src ? (src.kind === 'FILE' ? esc(src.file) : 'Chuyển từ kỳ trước') : 'Chưa có dự phòng đầu kỳ'}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    ${res && D5.fresh !== 'CURRENT' ? `<div class="alert review"><b>Kết quả FIFO đã cũ:</b> ${esc(D5.stale)}. Chạy lại RUN FIFO COGS (5.2) trước khi dùng số dự phòng.</div>` : ''}
    ${src && op && !String(op.status).startsWith('VALIDATED') ? `<div class="alert review">Dự phòng đầu kỳ đã có nhưng FG đầu kỳ chưa validate lại. Vào <a href="#fgopen">5.1 FG đầu kỳ</a> → Validate, rồi chạy lại FIFO (5.2).</div>` : ''}
    ${Math.abs(carryDiff) > 1 ? `<div class="alert review"><b>Đầu kỳ khác số dư cuối kỳ ${esc(src.from)}:</b> chênh ${A.fmtNum(carryDiff)} VND. Bấm Chuyển từ kỳ trước để lấy lại.</div>` : ''}
    ${c && Math.abs(num(c.approved.unallocated)) > 1 ? `<div class="alert review">NRV đã ghi ${A.fmtNum(c.approved.unallocated)} VND nhưng kỳ này không có NRV đề xuất để phân bổ xuống lớp. Kiểm tra lại quyết định NRV.</div>` : ''}
    ${strip}
    <div class="grid2">
      <div><h2>1 · Đầu kỳ</h2>
        <p class="muted">${openingText(src, op)}</p>
        ${edit ? `<div class="row">
          <button class="btn ghost sm" type="button" id="prov-carry">Chuyển từ kỳ trước (${esc(prevPeriod(S.period))})</button>
          <label class="btn ghost sm">Nạp template…<input type="file" id="f-provopen" accept=".xlsx,.xlsm,.xls" hidden></label>
          <a class="btn ghost sm" href="#fgopen">FG đầu kỳ (5.1)</a>
        </div>` : ''}
      </div>
      <div><h2>2 · Tăng · NRV</h2>
        ${res ? (nrvBlock
    ? `<p class="muted">Đề xuất ${A.fmtNum(res.totals.nrvProv)} VND (+ trích / − hoàn). Chỉ RECORDED làm tăng; số ghi FAST chia xuống lớp theo tỷ lệ đề xuất.</p>${P3.nrvDecisionHTML(S, res, closed)}`
    : '<p class="muted">Kỳ này không có NRV đề xuất.</p>')
    : '<p class="muted">Chưa chạy FIFO COGS (5.2).</p>'}
      </div>
    </div>
    ${res ? `<h2>3 · Chi tiết</h2>
      ${tabsHTML(tab, [['move', 'Biến động'], ['je', 'Bút toán FAST'], ['layers', `Theo lớp (${c.trk.rows.length})`], ['rw', `Rework · chờ (${reworkRows.length})`]])}
      <div id="tp"></div>` : A.emptyNote('Chưa chạy FIFO COGS (5.2). Số dự phòng hiển thị sau khi chạy.')}
  </section>`;

  const fi = el.querySelector('#f-provopen'); if (fi) fi.addEventListener('change', (e) => importProvFile(e.target.files[0]));
  const cb = el.querySelector('#prov-carry'); if (cb) cb.addEventListener('click', carryFromPrev);
  if (!res) return;
  if (nrvBlock) P3.mountNrvDecision(el, S, res);
  el.querySelectorAll('[data-tabp]').forEach((b) => b.addEventListener('click', () => { S.tabP = b.dataset.tabp; A.render(); }));
  const box = el.querySelector('#tp');
  if (tab === 'move') {
    box.innerHTML = `<table class="cp"><thead><tr><th>Chỉ tiêu</th><th class="r">VND</th><th>Ghi chú</th></tr></thead><tbody>
      ${mvRow('Số dư đầu kỳ', mv.open, '', src ? (src.kind === 'FILE' ? 'Theo file upload' : 'Chuyển từ cuối kỳ trước') : 'Chưa xác nhận nguồn')}
      ${mvRow('(+) Tăng: NRV được duyệt trong kỳ', mv.increase, '', pending ? `Chưa có quyết định – đề xuất ${A.fmtNum(mv.nrvProposed)}` : `Đề xuất ${A.fmtNum(mv.nrvProposed)}`)}
      ${mvRow('(−) Giảm: hoàn nhập dự phòng', mv.decrease, '', '= bán + tiêu dùng − trả hàng')}
      ${mvRow('&nbsp;&nbsp;· Hoàn nhập theo sản phẩm bán ra', mv.relSale, 'muted')}
      ${mvRow('&nbsp;&nbsp;· Hoàn nhập theo tiêu dùng nội bộ', mv.relCons, 'muted')}
      ${mvRow('&nbsp;&nbsp;· Trừ: hàng bán bị trả lại (phục hồi)', -mv.restore, 'muted')}
      ${mvRow('<b>Số dư cuối kỳ</b> = đầu + tăng − giảm', mv.closeBooks, '', 'Chuyển sang đầu kỳ sau')}
      ${mvRow('&nbsp;&nbsp;Trong đó: trên lớp FG cuối kỳ', mv.closeLayers, 'muted')}
      ${mvRow('&nbsp;&nbsp;Trong đó: đi theo hàng chuyển rework', mv.rework, 'muted', 'Chưa ghi sổ')}
    </tbody></table>`;
  } else if (tab === 'je') {
    box.innerHTML = `<table class="cp"><thead><tr><th>Mã</th><th>Diễn giải</th><th>Nợ</th><th>Có</th><th class="r">Số tiền (VND)</th></tr></thead><tbody>${jr.lines.map((l) => `<tr><td>${esc(l.code)}</td><td>${esc(l.desc)}</td><td>${esc(l.dr)}</td><td>${esc(l.cr)}</td><td class="r">${A.fmtNum(l.amount)}</td></tr>`).join('')}
      <tr class="muted"><td>${esc(jr.pending.code)}</td><td>${esc(jr.pending.desc)}</td><td></td><td></td><td class="r">${A.fmtNum(jr.pending.amount)}</td></tr></tbody></table>`;
  } else if (tab === 'layers') {
    A.mountTable(box, { columns: MAIN_COLS, rows: c.trk.rows, filterKey: 'source', height: 520, totals: MAIN_TOTALS, onExport: A.exportTable('06_PROVISION_TRACK', MAIN_COLS) });
  } else {
    box.innerHTML = `<p class="muted">Dự phòng đi theo FG chuyển sang rework (5B): không tính vào hoàn nhập, chưa có trong bút toán FAST cho đến khi kế toán quyết định. Tổng chờ: <b>${A.fmtNum(tt.relRw)}</b> VND.</p><div id="t-rw"></div>`;
    A.mountTable(box.querySelector('#t-rw'), { columns: REWORK_COLS, rows: reworkRows, filterKey: 'source', height: 360, totals: ['qtyIn', 'qtyRem', 'relRw'], onExport: A.exportTable('06_PROVISION_REWORK', REWORK_COLS) });
  }
}
