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
  if (!src) return 'Chưa có số dư đầu kỳ. Nếu kỳ trước đã có số liệu trên hệ thống, bấm <b>Chuyển từ kỳ trước</b>; nếu không, nạp template PROVISION_OPENING (mỗi dòng phải khớp đúng một lớp FG đầu kỳ).';
  const onLayers = A.fmtNum(layerSum(op));
  if (src.kind === 'FILE') return `File ${esc(src.file)} · ${src.count} dòng · tổng ${A.fmtNum(src.sum)} VND = sổ cái ${A.fmtNum(src.glBalance)} · trên lớp FG ${onLayers} · nạp ${A.fmtTs(src.at)}`;
  if (src.legacy) return `Chuyển cùng FG đầu kỳ (roll forward từ kỳ trước) · trên lớp FG ${onLayers} VND.`;
  return `Chuyển từ số dư cuối kỳ ${esc(src.from)} · ${src.count} lớp · ${A.fmtNum(src.sum)} VND · trên lớp FG ${onLayers} · ${src.at ? A.fmtTs(src.at) : ''}`;
}

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
  const mvRow = (label, v, cls = '', note = '') => `<tr class="${cls}"><td>${label}</td><td class="r">${A.fmtNum(v)}</td><td class="muted">${note}</td></tr>`;

  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>Dự phòng FG · TK ${PROV.PROV_ACC}</h1><p class="lead">Số dư cuối kỳ = đầu kỳ + tăng (NRV được duyệt trong kỳ) − giảm (hoàn nhập theo sản phẩm bán ra và tiêu dùng nội bộ, trừ hàng bán trả lại). Số dư cuối kỳ chuyển sang đầu kỳ sau. Dự phòng đi theo hàng chuyển rework được tách riêng và chưa ghi sổ.</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(railStatus(S, D5))}<small>${src ? (src.kind === 'FILE' ? esc(src.file) : 'Chuyển từ kỳ trước') : 'Chưa có dự phòng đầu kỳ'}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    ${res && D5.fresh !== 'CURRENT' ? `<div class="alert review"><b>Kết quả FIFO đã cũ:</b> ${esc(D5.stale)}. Chạy lại RUN FIFO COGS (5.2) trước khi dùng số dự phòng.</div>` : ''}
    ${src && op && !String(op.status).startsWith('VALIDATED') ? `<div class="alert review">Dự phòng đầu kỳ đã có nhưng FG đầu kỳ chưa validate lại. Vào <a href="#fgopen">5.1 FG đầu kỳ</a> → Validate, rồi chạy lại FIFO (5.2).</div>` : ''}
    ${Math.abs(carryDiff) > 1 ? `<div class="alert review"><b>Đầu kỳ khác số dư cuối kỳ ${esc(src.from)}:</b> chênh ${A.fmtNum(carryDiff)} VND. Bấm Chuyển từ kỳ trước để lấy lại.</div>` : ''}

    <h2>1 · Số dư đầu kỳ</h2>
    ${edit ? `<div class="row">
      <button class="btn ghost" type="button" id="prov-carry">Chuyển từ kỳ trước (${esc(prevPeriod(S.period))})</button>
      <label class="btn ghost">Nạp dự phòng đầu kỳ (template)…<input type="file" id="f-provopen" accept=".xlsx,.xlsm,.xls" hidden></label>
      <a class="btn ghost" href="#fgopen">Mở FG đầu kỳ (5.1)</a>
    </div>` : ''}
    <p class="muted">${openingText(src, op)}</p>

    <h2>2 · Tăng · Quyết định NRV trong kỳ</h2>
    ${res ? (nrvBlock
    ? `<p class="muted">NRV đề xuất từ FIFO (5.2): ${A.fmtNum(res.totals.nrvProv)} VND (+ trích lập / − hoàn nhập). Chỉ quyết định <b>RECORDED</b> mới làm tăng dự phòng; số đã ghi FAST được phân bổ xuống từng lớp theo tỷ lệ đề xuất. <b>NO ADJUSTMENT APPROVED</b> = không thay đổi.</p>${P3.nrvDecisionHTML(S, res, closed)}`
    : '<p class="muted">Kỳ này không có NRV đề xuất (không lớp FG cuối kỳ nào có giá vốn sau dự phòng cao hơn NRV).</p>')
    : A.emptyNote('Chưa chạy FIFO COGS (5.2).')}

    <h2>3 · Biến động TK ${PROV.PROV_ACC}</h2>
    ${res ? `
      ${mv.ok ? '' : `<div class="alert review"><b>Dự phòng chưa khớp:</b> chênh lệch ${A.fmtNum(mv.check || c.trk.check)} VND giữa đầu kỳ + biến động và số dư theo lớp.</div>`}
      ${Math.abs(num(c.approved.unallocated)) > 1 ? `<div class="alert review">NRV đã ghi ${A.fmtNum(c.approved.unallocated)} VND nhưng kỳ này không có NRV đề xuất để phân bổ xuống lớp. Kiểm tra lại quyết định NRV.</div>` : ''}
      <div class="kpis">${A.kpi('Đầu kỳ', mv.open, true)}${A.kpi('Tăng (NRV duyệt)', mv.increase, true)}${A.kpi('Giảm (hoàn nhập)', mv.decrease, true)}${A.kpi('Cuối kỳ', mv.closeBooks, true)}</div>
      <table class="cp"><thead><tr><th>Chỉ tiêu</th><th class="r">VND</th><th>Ghi chú</th></tr></thead><tbody>
        ${mvRow('Số dư đầu kỳ', mv.open, '', src ? (src.kind === 'FILE' ? 'Theo file upload' : 'Chuyển từ cuối kỳ trước') : Math.abs(mv.open) > 1 ? 'Có sẵn trên lớp FG đầu kỳ, chưa xác nhận nguồn (upload hoặc chuyển từ kỳ trước)' : 'Chưa có')}
        ${mvRow('(+) Tăng: NRV được duyệt trong kỳ', mv.increase, '', nrvPending(S, res) ? `Chưa có quyết định – đề xuất ${A.fmtNum(mv.nrvProposed)}` : `Đề xuất ${A.fmtNum(mv.nrvProposed)}`)}
        ${mvRow('(−) Giảm: hoàn nhập dự phòng', mv.decrease, 'strong', '= bán + tiêu dùng − trả hàng')}
        ${mvRow('&nbsp;&nbsp;· Hoàn nhập theo sản phẩm bán ra', mv.relSale, 'muted')}
        ${mvRow('&nbsp;&nbsp;· Hoàn nhập theo tiêu dùng nội bộ', mv.relCons, 'muted')}
        ${mvRow('&nbsp;&nbsp;· Trừ: hàng bán bị trả lại (phục hồi)', -mv.restore, 'muted')}
        ${mvRow('<b>Số dư cuối kỳ</b> = đầu + tăng − giảm', mv.closeBooks, 'strong', 'Chuyển sang đầu kỳ sau')}
        ${mvRow('&nbsp;&nbsp;Trong đó: trên lớp FG cuối kỳ', mv.closeLayers, 'muted')}
        ${mvRow('&nbsp;&nbsp;Trong đó: đi theo hàng chuyển rework (mục 4)', mv.rework, 'muted', 'Chưa ghi sổ')}
      </tbody></table>
      <h3>Bút toán FAST (TK ${PROV.PROV_ACC} / ${PROV.PROV_COST_ACC})</h3>
      <table class="cp"><thead><tr><th>Mã</th><th>Diễn giải</th><th>Nợ</th><th>Có</th><th class="r">Số tiền (VND)</th></tr></thead><tbody>${jr.lines.map((l) => `<tr><td>${esc(l.code)}</td><td>${esc(l.desc)}</td><td>${esc(l.dr)}</td><td>${esc(l.cr)}</td><td class="r">${A.fmtNum(l.amount)}</td></tr>`).join('')}</tbody></table>
      <h3>Theo dõi theo lớp</h3><div id="t-prov"></div>`
    : A.emptyNote('Chưa chạy FIFO COGS (5.2). Số dự phòng hiển thị sau khi chạy.')}

    <h2>4 · Chuyển rework — tách riêng, chưa ghi sổ</h2>
    ${res ? `
      <p class="muted">Dự phòng đi theo số lượng FG chuyển sang rework (5B). Không tính vào hoàn nhập khi bán hay tiêu dùng, và chưa có trong bút toán FAST cho đến khi kế toán quyết định cách ghi.</p>
      <div class="kpis">${A.kpi('Chuyển rework (chờ)', tt.relRw, true)}</div>
      <table class="cp"><thead><tr><th>Mã</th><th>Diễn giải</th><th>Nợ</th><th>Có</th><th class="r">Số tiền (VND)</th></tr></thead><tbody><tr class="muted"><td>${esc(jr.pending.code)}</td><td>${esc(jr.pending.desc)}</td><td></td><td></td><td class="r">${A.fmtNum(jr.pending.amount)}</td></tr></tbody></table>
      <div id="t-rw"></div>`
    : A.emptyNote('Chưa chạy FIFO COGS (5.2).')}
  </section>`;

  const fi = el.querySelector('#f-provopen'); if (fi) fi.addEventListener('change', (e) => importProvFile(e.target.files[0]));
  const cb = el.querySelector('#prov-carry'); if (cb) cb.addEventListener('click', carryFromPrev);
  if (!res) return;
  if (nrvBlock) P3.mountNrvDecision(el, S, res);
  A.mountTable(el.querySelector('#t-prov'), { columns: MAIN_COLS, rows: c.trk.rows, filterKey: 'source', height: 520, totals: MAIN_TOTALS, onExport: A.exportTable('06_PROVISION_TRACK', MAIN_COLS) });
  A.mountTable(el.querySelector('#t-rw'), { columns: REWORK_COLS, rows: reworkRows, filterKey: 'source', height: 360, totals: ['qtyIn', 'qtyRem', 'relRw'], onExport: A.exportTable('06_PROVISION_REWORK', REWORK_COLS) });
}
