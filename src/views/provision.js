// Dự phòng FG (TK 2294) — its own tab, 5P (v1.14.71). Opening provision import, roll-forward per FG layer, FAST entries,
// and the rework part kept apart (shown in its own block, not posted). Logic lives in engine/provision.js.
import * as PROV from '../engine/provision.js';
import * as P3 from './phase3.js';
import { num, nowISO } from '../engine/util.js';

let A = null;
export function install(api) { A = api; }
const esc = (v) => A.esc(v);

/** Rail status for the menu: NOT RUN until FIFO has run; PASS WITH REVIEW while the opening provision file is missing. */
export function railStatus(S, D5) {
  if (!D5 || !D5.res) return 'NOT RUN';
  if (!S.d.fgOpen || !S.d.fgOpen.provSource) return 'PASS WITH REVIEW';
  return PROV.provisionTrack(D5.res).ok ? 'PASS' : 'BLOCK';
}

/** Opening provision import: the PROVISION_OPENING file is the source of truth; the FG opening must be validated again. */
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
      S.d.fgOpen.provSource = { file: file.name, glBalance: parsed.glBalance, sum: parsed.sum, count: parsed.rows.length, matched: app.matched, zeroLayers: app.zeroLayers, by: A.who(), at: nowISO() };
      S.d.fgOpen.status = 'LOADED - NOT VALIDATED'; S.d.fgOpen.validatedAt = '';
      A.audit('STEP 5 - IMPORT OPENING PROVISION', `Lớp=${app.matched}; Dự phòng=${A.fmtNum(parsed.sum)}; Sổ cái=${A.fmtNum(parsed.glBalance)}; File=${file.name}`);
      A.markDirty('fgOpen', 'audit');
      A.toast(`Đã nạp dự phòng cho ${app.matched} lớp. Bước tiếp: Validate FG đầu kỳ (5.1).`, 'pass');
    } catch (e) { A.toast('Nạp dự phòng lỗi: ' + e.message, 'block'); }
  });
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
  { key: 'closePre', label: 'DP trước NRV', type: 'num', width: 130 }, { key: 'nrvAdj', label: 'NRV (+ trích / − hoàn)', type: 'num', width: 160 },
  { key: 'close', label: 'DP cuối kỳ (FG)', type: 'num', width: 140 },
];
const MAIN_COLS = [...LAYER_BASE, ...MOVE_COLS];
const MAIN_TOTALS = ['qtyIn', 'qtyRem', 'open', 'restore', 'relSale', 'relCons', 'closePre', 'nrvAdj', 'close'];
const REWORK_COLS = [...LAYER_BASE, { key: 'relRw', label: 'Chuyển rework (chờ, không ghi sổ)', type: 'num', width: 210 }];

export function view(el) {
  const S = A.S; const D5 = A.derived().d5; const res = D5 ? D5.res : null; const op = S.d.fgOpen;
  const closed = S.d.closed && S.d.closed.period === S.period;
  const src = op && op.provSource;
  const trk = res ? PROV.provisionTrack(res) : null;
  const tt = trk ? trk.totals : null;
  const jr = res ? PROV.provisionJournal(trk, P3.nrvRecordedAmount(S, res)) : null;
  const reworkRows = trk ? trk.rows.filter((r) => Math.abs(num(r.relRw)) > 0.005) : [];

  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>Dự phòng FG · TK ${PROV.PROV_ACC}</h1><p class="lead">Dự phòng là số dư Có của TK ${PROV.PROV_ACC} theo từng lớp FG (FIFO). Hoàn nhập theo số lượng bán và tiêu dùng nội bộ (Nợ ${PROV.PROV_ACC} / Có ${PROV.PROV_COST_ACC}); hàng bán trả lại khôi phục dự phòng của hoá đơn gốc; NRV theo quyết định ở 5.3. Phần chuyển rework được tách riêng và chưa ghi sổ.</p></div>
      <div class="result"><span>Trạng thái</span>${A.pill(railStatus(S, D5))}<small>${src ? esc(src.file) : 'Chưa nạp dự phòng đầu kỳ'}</small></div></header>
    ${closed ? `<div class="alert pass">Kỳ ${esc(S.period)} đã đóng – chỉ xem.</div>` : ''}
    ${res && D5.fresh !== 'CURRENT' ? `<div class="alert review"><b>Kết quả FIFO đã cũ:</b> ${esc(D5.stale)}. Chạy lại RUN FIFO COGS (5.2) trước khi dùng số dự phòng.</div>` : ''}
    ${src && op && !String(op.status).startsWith('VALIDATED') ? `<div class="alert review">Dự phòng đầu kỳ đã nạp nhưng FG đầu kỳ chưa validate lại. Vào <a href="#fgopen">5.1 FG đầu kỳ</a> → Validate.</div>` : ''}

    <h2>1 · Dự phòng đầu kỳ</h2>
    <div class="row">
      <label class="btn ghost">Nạp dự phòng đầu kỳ…<input type="file" id="f-provopen" accept=".xlsx,.xlsm,.xls" hidden></label>
      <a class="btn ghost" href="#fgopen">Mở FG đầu kỳ (5.1)</a>
    </div>
    <p class="muted">${src
    ? `${esc(src.file)} · ${src.count} dòng · tổng ${A.fmtNum(src.sum)} VND = sổ cái ${A.fmtNum(src.glBalance)} · nạp ${A.fmtTs(src.at)}`
    : 'Chưa nạp. Nạp sau khi đã nạp FG đầu kỳ (5.1), rồi Validate FG đầu kỳ. File là template PROVISION_OPENING; mọi dòng phải khớp đúng một lớp FG đầu kỳ.'}</p>

    <h2>2 · Biến động trong kỳ</h2>
    ${res ? `
      ${trk.ok ? '' : `<div class="alert review"><b>Dự phòng chưa khớp:</b> chênh lệch ${A.fmtNum(trk.check)} VND giữa đầu kỳ + biến động và số dư theo lớp.</div>`}
      <div class="kpis">${A.kpi('DP đầu kỳ', tt.open, true)}${A.kpi('Hoàn lại (trả hàng)', tt.restore, true)}${A.kpi('Hoàn nhập khi bán', tt.relSale, true)}${A.kpi('Hoàn nhập tiêu dùng', tt.relCons, true)}${A.kpi('NRV đề xuất', tt.nrvAdj, true)}${A.kpi('DP cuối kỳ (FG)', tt.close, true)}</div>
      <p class="muted">DP cuối kỳ (FG) = đầu kỳ + hoàn lại − hoàn nhập khi bán − hoàn nhập tiêu dùng − chuyển rework (mục 3, tách riêng) ± NRV.</p>
      <h3>Bút toán FAST (TK ${PROV.PROV_ACC} / ${PROV.PROV_COST_ACC})</h3>
      <table class="cp"><thead><tr><th>Mã</th><th>Diễn giải</th><th>Nợ</th><th>Có</th><th class="r">Số tiền (VND)</th></tr></thead><tbody>${jr.lines.map((l) => `<tr><td>${esc(l.code)}</td><td>${esc(l.desc)}</td><td>${esc(l.dr)}</td><td>${esc(l.cr)}</td><td class="r">${A.fmtNum(l.amount)}</td></tr>`).join('')}</tbody></table>
      <h3>Theo dõi theo lớp</h3><div id="t-prov"></div>`
    : A.emptyNote('Chưa chạy FIFO COGS (5.2). Số dự phòng hiển thị sau khi chạy.')}

    <h2>3 · Chuyển rework — tách riêng, chưa ghi sổ</h2>
    ${res ? `
      <p class="muted">Dự phòng đi theo số lượng FG chuyển sang rework (5B). Không tính vào hoàn nhập khi bán hay tiêu dùng, và chưa có trong bút toán FAST cho đến khi kế toán quyết định cách ghi.</p>
      <div class="kpis">${A.kpi('Chuyển rework (chờ)', tt.relRw, true)}</div>
      <table class="cp"><thead><tr><th>Mã</th><th>Diễn giải</th><th>Nợ</th><th>Có</th><th class="r">Số tiền (VND)</th></tr></thead><tbody><tr class="muted"><td>${esc(jr.pending.code)}</td><td>${esc(jr.pending.desc)}</td><td></td><td></td><td class="r">${A.fmtNum(jr.pending.amount)}</td></tr></tbody></table>
      <div id="t-rw"></div>`
    : A.emptyNote('Chưa chạy FIFO COGS (5.2).')}
  </section>`;

  el.querySelector('#f-provopen').addEventListener('change', (e) => importProvFile(e.target.files[0]));
  if (!res) return;
  A.mountTable(el.querySelector('#t-prov'), { columns: MAIN_COLS, rows: trk.rows, filterKey: 'source', height: 520, totals: MAIN_TOTALS, onExport: A.exportTable('06_PROVISION_TRACK', MAIN_COLS) });
  A.mountTable(el.querySelector('#t-rw'), { columns: REWORK_COLS, rows: reworkRows, filterKey: 'source', height: 360, totals: ['qtyIn', 'qtyRem', 'relRw'], onExport: A.exportTable('06_PROVISION_REWORK', REWORK_COLS) });
}
