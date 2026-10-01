// SVL Costing Web — application shell (state, persistence, views)
import { ERPS, REPORTS, dsKey, isPeriod, nextPeriod, prevPeriod, num, txt, ttxt, nowISO, serialToISO } from './engine/util.js';
import { buildDataset, planImport, step1Status } from './engine/step1.js';
import { runStep2, buildReworkRegister, step2Classification, recheckRegisterRow, STEP2_RULES, STEP2_DETAIL_HEADERS, RW_FIELDS, RW_HEADERS } from './engine/step2.js';
import { validateOpening, detectOpeningSource, openingFromSource, openingFromClosing, runStep3, WIP_HEADERS } from './engine/step3.js';
import { step1Controls, step2Controls, step3Controls, accessLimitedCount } from './engine/controls.js';
import { mountTable, esc } from './ui/table.js';
import { fmtCell, fmtNum, fmtTs, statusClass } from './ui/format.js';
import * as store from './store.js';
import { APP_VERSION } from './config.js';

// ======================= state =======================
const BLOBS = ['importLog', 'step2', 'register', 'opening', 'step3', 'audit'];
const S = {
  period: '', periods: [], view: 'cc', busy: '',
  d: emptyData(), dirty: new Set(), sync: 'local', syncMsg: '',
  dsView: 'PC-P-T',
};
function emptyData() { return { datasets: {}, importLog: {}, step2: null, register: null, opening: null, step3: null, audit: [] }; }

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $('#main');

// ======================= worker =======================
let worker = null, wid = 0; const pending = new Map();
function parseFile(buf, mode = 'first', sheets) {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.ok ? p.res(e.data) : p.rej(new Error(e.data.error)); };
    worker.onerror = (e) => { for (const p of pending.values()) p.rej(new Error(e.message || 'Worker lỗi')); pending.clear(); };
  }
  const id = ++wid;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); worker.postMessage({ id, buf, mode, sheets }, [buf]); });
}
let XLSXmod = null;
async function xlsx() { if (!XLSXmod) XLSXmod = await import('../lib/xlsx.mjs'); return XLSXmod; }

// ======================= persistence =======================
const lk = (p, b) => `p/${p}/${b}`;
async function loadLocal(period) {
  const d = emptyData();
  const keys = (await store.localKeys()).filter((k) => typeof k === 'string' && k.startsWith(`p/${period}/`));
  for (const k of keys) {
    const b = k.slice(`p/${period}/`.length); const v = await store.localGet(k);
    if (b.startsWith('ds:')) d.datasets[b.slice(3)] = v; else if (BLOBS.includes(b)) d[b] = v;
  }
  d.audit = d.audit || []; d.importLog = d.importLog || {};
  return d;
}
async function saveLocal() {
  const p = S.period; if (!p) return;
  for (const b of S.dirty) {
    if (b.startsWith('ds:')) { const k = b.slice(3); if (S.d.datasets[k]) await store.localSet(lk(p, b), S.d.datasets[k]); else await store.localDel(lk(p, b)); }
    else if (S.d[b] === null || S.d[b] === undefined) await store.localDel(lk(p, b)); else await store.localSet(lk(p, b), S.d[b]);
  }
  await store.localSet(lk(p, 'savedAt'), nowISO());
  const list = new Set((await store.localGet('periods')) || []); list.add(p);
  await store.localSet('periods', [...list].sort());
}
function allBlobs() {
  const o = {};
  for (const [k, v] of Object.entries(S.d.datasets)) o['ds:' + k] = v;
  for (const b of BLOBS) if (S.d[b] !== null && S.d[b] !== undefined) o[b] = S.d[b];
  return o;
}
let syncTimer = null;
function markDirty(...blobs) {
  blobs.forEach((b) => S.dirty.add(b));
  saveLocal().then(() => { S.dirty.clear(); scheduleCloud(); }).catch((e) => toast('Lỗi lưu trên máy: ' + e.message, 'block'));
}
function scheduleCloud() {
  if (!store.cloud.user) { S.sync = 'local'; renderSync(); return; }
  if (!store.canEdit()) { S.sync = 'readonly'; renderSync(); return; }
  if (!S.period) { S.sync = 'synced'; renderSync(); return; }
  S.sync = 'pending'; renderSync();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushCloud, 1500);
}
async function pushCloud() {
  if (!store.cloud.user || !S.period || !store.canEdit()) return;
  try {
    S.sync = 'saving'; renderSync();
    const meta = await store.cloudSave(S.period, allBlobs(), summaryForCloud(), (m) => { S.syncMsg = m; renderSync(); });
    if (meta) await store.localSet(lk(S.period, 'cloudAt'), meta.updatedAt);
    S.sync = 'synced'; S.syncMsg = '';
  } catch (e) { S.sync = 'error'; S.syncMsg = e.message; }
  renderSync();
}
function summaryForCloud() {
  const st = statusAll();
  return { step1: st.s1c.result, step2: st.s2c.status, step3: st.s3c.status, closingWIP: S.d.step3 ? S.d.step3.summary.closingAmt : null };
}

async function openPeriod(p, { preferCloud = false } = {}) {
  S.period = p; S.d = await loadLocal(p);
  localStorage.setItem('svl.period', p);
  if (store.cloud.user) {
    try {
      const meta = await store.cloudMeta(p);
      const localCloudAt = await store.localGet(lk(p, 'cloudAt'));
      const localEmpty = !Object.keys(S.d.datasets).length && !S.d.opening;
      if (meta && (preferCloud || localEmpty || (meta.updatedAt > (localCloudAt || '') && confirm(`Kỳ ${p} trên cloud mới hơn (cập nhật ${fmtTs(meta.updatedAt)} bởi ${meta.updatedBy}). Tải bản cloud về máy này?`)))) {
        await busy('Đang tải dữ liệu từ cloud…', async () => {
          const r = await store.cloudLoad(p, (m) => setBusy(m));
          const d = emptyData();
          for (const [k, v] of Object.entries(r.blobs)) { if (k.startsWith('ds:')) d.datasets[k.slice(3)] = v; else d[k] = v; }
          d.audit = d.audit || []; d.importLog = d.importLog || {};
          S.d = d;
          S.dirty = new Set(Object.keys(allBlobs())); await saveLocal(); S.dirty.clear();
          await store.localSet(lk(p, 'cloudAt'), r.meta.updatedAt);
        });
        S.sync = 'synced';
      }
    } catch (e) { toast('Không đọc được cloud: ' + e.message, 'review'); }
  }
  await refreshPeriods();
  render();
}
async function refreshPeriods() {
  const local = (await store.localGet('periods')) || [];
  let cloudP = [];
  try { cloudP = (await store.cloudPeriods()).map((x) => x.period); } catch { /* offline */ }
  S.periods = [...new Set([...local, ...cloudP, S.period].filter(isPeriod))].sort().reverse();
}

function audit(action, detail) {
  S.d.audit.unshift({ at: nowISO(), user: store.cloud.user ? store.cloud.user.email : 'thiết bị này', action, detail });
  if (S.d.audit.length > 500) S.d.audit.length = 500;
}

// ======================= derived status =======================
function datasetsMeta() {
  const m = {};
  for (const [k, l] of Object.entries(S.d.importLog)) m[k] = l;
  for (const [k, d] of Object.entries(S.d.datasets)) m[k] = { status: d.status, dataRows: d.dataRows, fileName: d.fileName, importedAt: d.importedAt };
  return m;
}
function statusAll() {
  const s1 = step1Status(datasetsMeta());
  const s1c = step1Controls(s1, accessLimitedCount(S.d.datasets));
  const ctx = { period: S.period, step2: S.d.step2, register: S.d.register, latestImport: s1.latestImport, opening: S.d.opening, step3: S.d.step3 };
  return { s1, s1c, s2c: step2Controls(ctx), s3c: step3Controls(ctx) };
}

// ======================= permissions =======================
function guardEdit() {
  if (store.canEdit()) return true;
  toast('Tài khoản của bạn chỉ có quyền xem. Nhờ quản trị viên cấp quyền Chỉnh sửa nếu cần.', 'review');
  return false;
}
const WRITE_ACTS = new Set(['new-period', 'run-step2', 'run-step3', 'roll-wip', 'validate-wip', 'reset-wip', 'reset-erp', 'push-cloud', 'delete-period']);

// ======================= UI helpers =======================
function toast(msg, kind = 'info') {
  const t = document.createElement('div'); t.className = `toast ${kind}`; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), kind === 'block' ? 9000 : 4500);
}
function setBusy(msg) { S.busy = msg; const b = $('#busy'); b.hidden = !msg; $('#busy-msg').textContent = msg || ''; }
async function busy(msg, fn) {
  setBusy(msg); await new Promise((r) => setTimeout(r, 30));
  try { return await fn(); } finally { setBusy(''); }
}
const pill = (s) => `<span class="pill ${statusClass(s)}">${esc(s ?? '')}</span>`;
const v = (x, t = 'num') => (typeof x === 'number' ? fmtCell(x, t) : esc(x ?? ''));
function renderSync() {
  const el = $('#sync'); if (!el) return;
  const map = { local: ['Chỉ lưu trên máy này', 's-info'], pending: ['Chờ đồng bộ…', 's-rerun'], saving: [S.syncMsg || 'Đang lưu lên cloud…', 's-rerun'], synced: ['Đã đồng bộ cloud', 's-pass'], readonly: ['Chỉ xem – không lưu thay đổi', 's-info'], error: ['Lỗi đồng bộ: ' + S.syncMsg, 's-block'] };
  const [t, c] = map[S.sync] || map.local;
  el.className = `sync pill ${c}`; el.textContent = t; el.title = t;
}
function cpTable(rows) {
  return `<table class="cp"><thead><tr><th>Checkpoint</th><th class="r">Kỳ vọng / Nguồn</th><th class="r">Thực tế</th><th class="r">Chênh lệch</th><th>Trạng thái</th><th>Quy tắc</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td><span class="cp-no">${r.no}</span> ${esc(r.label)}</td><td class="r">${cpVal(r.expected)}</td><td class="r">${cpVal(r.actual)}</td><td class="r">${r.diff === '' ? '' : cpVal(r.diff)}</td><td>${pill(r.status)}</td><td class="muted">${esc(r.rule)}</td></tr>`).join('')}
  </tbody></table>`;
}
function cpVal(x) {
  if (typeof x === 'number') return fmtNum(x, Math.abs(x) < 1000 && !Number.isInteger(x) ? 2 : 0);
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x)) return fmtTs(x);
  return esc(x ?? '');
}

async function exportBook(fileName, sheets) {
  const X = await xlsx();
  const wb = X.utils.book_new();
  for (const s of sheets) {
    const ws = X.utils.aoa_to_sheet(s.aoa);
    if (s.cols) ws['!cols'] = s.cols.map((w) => ({ wch: w }));
    X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  X.writeFile(wb, fileName);
}
const exportTable = (name, columns) => (rows) => exportBook(`${name}_${S.period}.xlsx`, [{ name, aoa: [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => { const x = Array.isArray(r) ? r[c.key] : r[c.key]; return c.type === 'date' && typeof x === 'number' ? serialToISO(x) : x ?? ''; }))], cols: columns.map((c) => Math.round((c.width || 120) / 7)) }]);

// ======================= layout =======================
const NAV = [
  { id: 'cc', no: '', label: 'Tổng quan kỳ', sub: 'Control Center' },
  { id: 'step1', no: '1', label: 'Import dữ liệu ERP', sub: '21 báo cáo T · S · O', key: 's1' },
  { id: 'step2', no: '2', label: 'Phân bổ Stock Out', sub: 'Stock Out → lô PC', key: 's2' },
  { id: 'rework', no: '2B', label: 'Sổ FG Rework', sub: 'FG xuất đi rework', key: 'rw' },
  { id: 'opening', no: '3A', label: 'Opening WIP', sub: 'Số dư đầu kỳ', key: 'op' },
  { id: 'step3', no: '3A', label: 'Material WIP', sub: 'WIP theo vật tư', key: 's3' },
  { id: 'p3b', no: '3B', label: 'Điều chỉnh WIP', sub: 'Giai đoạn 2', later: true },
  { id: 'p4', no: '4', label: 'Phân bổ giá thành', sub: 'Giai đoạn 2', later: true },
  { id: 'p5', no: '5', label: 'FG & FIFO COGS', sub: 'Giai đoạn 3', later: true },
];
const TOOLS = [
  { id: 'data', label: 'Dữ liệu ERP đã import' },
  { id: 'audit', label: 'Nhật ký' },
  { id: 'settings', label: 'Kỳ, cloud & chuyển đổi' },
];

function railStatus(st) {
  const op = S.d.opening ? S.d.opening.status : 'NO DATA';
  const blocks = S.d.register ? S.d.register.rows.filter((r) => String(r.inputCheck).startsWith('BLOCK')).length : 0;
  return {
    s1: st.s1c.result, s2: st.s2c.status, rw: !S.d.register ? 'NOT RUN' : blocks ? 'BLOCK' : 'PASS',
    op: op === 'READY' ? 'PASS' : op === 'READY WITH WARNINGS' ? 'PASS WITH REVIEW' : op === 'NO DATA' ? 'NOT RUN' : 'BLOCK', s3: st.s3c.status,
  };
}

function renderShell() {
  const st = statusAll(); const rs = railStatus(st);
  $('#rail').innerHTML = `
    <div class="period-box">
      <label for="period-sel">Kỳ giá thành</label>
      <div class="period-row">
        <select id="period-sel">${S.periods.map((p) => `<option ${p === S.period ? 'selected' : ''}>${p}</option>`).join('')}</select>
        <button class="btn ghost sm" data-act="new-period" type="button" title="Tạo kỳ mới">+ Kỳ</button>
      </div>
    </div>
    <nav class="line" aria-label="Quy trình tháng">
      ${NAV.map((n) => `<a href="#${n.id}" class="stop ${S.view === n.id ? 'on' : ''} ${n.later ? 'later' : ''}" ${S.view === n.id ? 'aria-current="page"' : ''}>
        <span class="node ${n.key ? statusClass(rs[n.key]) : n.later ? 's-none' : 's-cc'}">${esc(n.no || '◎')}</span>
        <span class="stop-t"><b>${esc(n.label)}</b><small>${esc(n.key ? rs[n.key] : n.sub)}</small></span></a>`).join('')}
    </nav>
    <nav class="tools" aria-label="Công cụ">${TOOLS.map((t) => `<a href="#${t.id}" class="${S.view === t.id ? 'on' : ''}">${esc(t.label)}</a>`).join('')}</nav>
    <div class="ver">${esc(APP_VERSION)}</div>`;
  const u = store.cloud.user;
  $('#account').innerHTML = !store.cloud.enabled ? '<span class="muted">Chế độ offline</span>'
    : u ? `<span class="who" title="${esc(u.email)}">${esc(u.displayName || u.email)} · ${esc(store.ROLES[store.cloud.role] || '')}</span><button class="btn ghost sm" data-act="signout" type="button">Đăng xuất</button>`
      : `<button class="btn sm" data-act="signin" type="button" ${store.cloud.ready ? '' : 'disabled'}>Đăng nhập Google</button>`;
  renderSync();
}

function render() {
  renderShell();
  const view = VIEWS[S.view] || VIEWS.cc;
  if (!S.period && S.view !== 'settings') { app().innerHTML = viewWelcome(); return; }
  app().innerHTML = '';
  view(app());
  app().focus({ preventScroll: true });
}

// ======================= views =======================
function viewWelcome() {
  return `<section class="page"><h1>Bắt đầu một kỳ giá thành</h1>
  <p class="lead">Chọn kỳ báo cáo (YYYY-MM). Dữ liệu ERP, kết quả từng bước và sổ rework được lưu theo kỳ.</p>
  <div class="card"><form id="f-new" class="inline"><label>Kỳ <input name="p" placeholder="2026-09" pattern="\\d{4}-\\d{2}" required></label><button class="btn" type="submit">Tạo kỳ</button></form>
  <p class="muted">Đang dùng file Excel Costing Master? Vào <a href="#settings">Kỳ, cloud &amp; chuyển đổi</a> để nạp nguyên một kỳ từ file .xlsm.</p></div></section>`;
}

const VIEWS = {};

VIEWS.cc = (el) => {
  const st = statusAll(); const s2 = S.d.step2, s3 = S.d.step3;
  const steps = [
    ['1.0', 'Import ERP', st.s1c.result, `${st.s1c.coreReady} báo cáo`, st.s1.latestImport, st.s1c.next, 'step1'],
    ['2.0', 'Phân bổ Stock Out', st.s2c.status, s2 ? fmtNum(s2.total.alloc) : '', s2 && s2.runAt, st.s2c.next, 'step2'],
    ['2.B', 'Sổ FG Rework', railStatus(st).rw, S.d.register ? `${S.d.register.stats.rows} dòng · SL ${fmtNum(S.d.register.stats.issueQty)}` : '', S.d.register && S.d.register.refreshedAt, '', 'rework'],
    ['3.0', 'Material WIP (3A)', st.s3c.status, s3 ? fmtNum(s3.summary.closingAmt) : '', s3 && s3.runAt, st.s3c.next, 'step3'],
  ];
  const next = steps.find((x) => !String(x[2]).startsWith('PASS'));
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>Tổng quan kỳ ${esc(S.period)}</h1><p class="lead">Chạy lần lượt từng bước; mỗi bước chỉ đi tiếp khi các checkpoint không còn BLOCK.</p></div>
      <div class="next"><span>Việc tiếp theo</span><b>${next ? `<a href="#${next[6]}">${esc(next[1])}</a> — ${esc(next[5] || 'xem checkpoint')}` : 'Bước 1–3A đã PASS. Bước 3B/4/5 vẫn chạy trong Excel ở giai đoạn này.'}</b></div></header>
    <div class="kpis">
      ${kpi('Opening WIP', S.d.opening && S.d.opening.stats ? S.d.opening.stats.totalAmt : null)}
      ${kpi('WIP vào (MI + Stock Out)', s3 ? s3.summary.inAmt : null)}
      ${kpi('WIP ra (PC + MR + Stock Out)', s3 ? s3.summary.outAmt : null)}
      ${kpi('Closing WIP ERP', s3 ? s3.summary.closingAmt : null, true)}
      ${kpi('Stock Out NVL đã phân bổ', s2 ? s2.total.alloc : null)}
    </div>
    <h2>Quy trình tháng</h2>
    <table class="cp"><thead><tr><th>Bước</th><th>Quy trình</th><th>Trạng thái</th><th class="r">Giá trị</th><th>Cập nhật</th><th>Việc tiếp theo</th></tr></thead><tbody>
    ${steps.map((x) => `<tr><td>${x[0]}</td><td><a href="#${x[6]}">${esc(x[1])}</a></td><td>${pill(x[2])}</td><td class="r">${esc(x[3])}</td><td>${fmtTs(x[4])}</td><td class="muted">${esc(x[5])}</td></tr>`).join('')}
    <tr class="later"><td>3.B → 5</td><td>Điều chỉnh WIP, phân bổ 622/627, FIFO COGS, đóng kỳ</td><td>${pill('EXCEL')}</td><td></td><td></td><td class="muted">Giai đoạn 2–3 của bản web</td></tr>
    </tbody></table>
    <div>
      <div><h2>STEP 2 — checkpoint <small>${st.s2c.okText} · ${pill(st.s2c.status)}</small></h2>${st.s2c.rows.length ? cpTable(st.s2c.rows) : emptyNote('Chưa chạy STEP 2.', 'step2', 'Mở STEP 2')}</div>
      <div><h2>STEP 3A — checkpoint <small>${st.s3c.okText} · ${pill(st.s3c.status)}</small></h2>${cpTable(st.s3c.rows)}</div>
    </div>
    ${journal()}
  </section>`;
};
function kpi(label, val, strong) {
  return `<div class="kpi ${strong ? 'strong' : ''}"><span>${esc(label)}</span><b>${val === null || val === undefined ? '—' : fmtNum(val)}</b><small>VND</small></div>`;
}
function emptyNote(msg, href, cta) { return `<div class="empty"><p>${esc(msg)}</p>${href ? `<a class="btn" href="#${href}">${esc(cta)}</a>` : ''}</div>`; }
function journal() {
  const s3 = S.d.step3; if (!s3) return '';
  const S3 = s3.summary;
  const je = [['JE01', '154', '152', 'Xuất NVL vào WIP – MI', S3.miAmt], ['JE02', '154', '152', 'Xuất NVL vào WIP – Stock Out', S3.soAmt], ['JE05', '152', '154', 'Nhập lại NVL từ WIP – MR', S3.mrAmt]];
  return `<h2>Bút toán từ STEP 3A</h2><table class="cp"><thead><tr><th>JE</th><th>Nợ</th><th>Có</th><th>Diễn giải</th><th class="r">Số tiền (VND)</th></tr></thead><tbody>
    ${je.map((j) => `<tr><td>${j[0]}</td><td>${j[1]}</td><td>${j[2]}</td><td>${esc(j[3])}</td><td class="r">${fmtNum(j[4])}</td></tr>`).join('')}</tbody></table>
    <p class="muted">JE03/JE04 (622/627), JE06 (155) và JE07–JE08 (COGS, rework) có sau STEP 4–5.</p>`;
}

// ---------- STEP 1 ----------
VIEWS.step1 = (el) => {
  const st = statusAll(); const c = st.s1c;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 1 · Import dữ liệu ERP</h1><p class="lead">Chọn các file báo cáo ERP của kỳ ${esc(S.period)} (PC-P, PC-M, MI-P, MI-M, STOCK OUT, MR-P, MR-M cho hệ T, S, O). Tên file phải chứa loại báo cáo, hệ và kỳ, ví dụ <code>PC-M-T-202608.xlsx</code>. Import lại cùng báo cáo sẽ thay thế dữ liệu cũ.</p></div>
    <div class="result"><span>Kết quả</span>${pill(c.result)}<small>${esc(c.coreReady)} báo cáo · ${esc(c.sysReady)} hệ</small></div></header>
    <div class="drop" id="drop" tabindex="0">
      <p><b>Kéo thả file ERP vào đây</b> hoặc</p>
      <div class="row"><label class="btn">Chọn file…<input type="file" id="f-files" multiple accept=".xlsx,.xlsm,.xls" hidden></label>
      <label class="btn ghost">Chọn cả thư mục…<input type="file" id="f-dir" webkitdirectory hidden></label></div>
      <p class="muted">File được đọc ngay trong trình duyệt; chỉ dữ liệu đã chuẩn hoá được lưu.</p>
    </div>
    <div id="plan"></div>
    <div class="grid3">${ERPS.map((e) => { const b = st.s1.bySys[e]; return `<div class="sys sys-${e}"><b>Hệ ${e}</b>${pill(b.status)}<span>${b.files} file · ${fmtNum(b.rows)} dòng</span><small>${fmtTs(b.lastImport)}</small></div>`; }).join('')}</div>
    <h2>Danh mục 21 báo cáo bắt buộc</h2>
    <table class="cp"><thead><tr><th>Hệ</th><th>Báo cáo</th><th>Trạng thái</th><th class="r">Số dòng</th><th>File nguồn</th><th>Thời điểm import</th><th></th></tr></thead><tbody>
    ${st.s1.checklist.map((x) => `<tr><td><span class="erp erp-${x.erp}">${x.erp}</span></td><td>${esc(x.report)}</td><td>${pill(x.status)}${x.error ? `<div class="err">${esc(x.error)}</div>` : ''}</td><td class="r">${fmtNum(x.dataRows)}</td><td>${esc(x.fileName)}</td><td>${fmtTs(x.importedAt)}</td><td>${S.d.datasets[x.key] ? `<a href="#data" data-act="view-ds" data-k="${esc(x.key)}">Xem</a>` : ''}</td></tr>`).join('')}
    </tbody></table>
    <div class="row end"><span class="muted">Dòng báo "access right" từ ERP: ${c.accessLimited}</span>
      <button class="btn danger ghost" data-act="reset-erp" type="button">Xoá dữ liệu ERP…</button></div>
  </section>`;
  const handle = (files) => importERP([...files]);
  $('#f-files').addEventListener('change', (e) => handle(e.target.files));
  $('#f-dir').addEventListener('change', (e) => handle(e.target.files));
  const dz = $('#drop');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); handle(e.dataTransfer.files); });
};

async function importERP(files) {
  if (!guardEdit()) return;
  const plan = planImport(files.map((f) => ({ name: f.name, lastModified: f.lastModified, file: f })), S.period);
  const planEl = $('#plan');
  if (plan.error) { planEl.innerHTML = `<div class="alert block"><b>Import bị chặn.</b> ${esc(plan.error)}</div>`; return; }
  const items = Object.entries(plan.slots);
  let ok = 0, errs = [], nNew = 0, nRep = 0;
  await busy('Đang đọc file ERP…', async () => {
    let i = 0;
    for (const [k, f] of items) {
      i++; setBusy(`Đang đọc ${f.name} (${i}/${items.length})…`);
      const prior = S.d.datasets[k] || S.d.importLog[k];
      try {
        const res = await parseFile(await f.file.arrayBuffer(), 'first');
        const grid = Object.values(res.grids)[0] || [];
        const ds = buildDataset(grid, f.name, S.period);
        S.d.datasets[k] = ds; delete S.d.importLog[k];
        ok++; prior ? nRep++ : nNew++;
        S.dirty.add('ds:' + k);
        audit(`${prior ? 'REPLACE' : 'NEW'} ${ds.erp} / ${ds.report}`, `${ds.fileName} · ${ds.status} · ${ds.dataRows} dòng`);
      } catch (e) {
        const c = k.split('-'); delete S.d.datasets[k]; S.dirty.add('ds:' + k);
        S.d.importLog[k] = { status: 'ERROR', error: e.message, fileName: f.name, importedAt: nowISO(), dataRows: 0 };
        errs.push(`${f.name}: ${e.message}`);
        audit(`ERROR ${c[c.length - 1]} / ${k}`, `${f.name} · ${e.message}`);
      }
    }
  });
  markDirty('importLog', 'audit');
  render();
  const msg = [`Đã import ${ok}/${items.length} báo cáo (mới ${nNew}, thay thế ${nRep}).`];
  if (plan.dups.length) msg.push('Trùng: ' + plan.dups.join('; '));
  if (plan.skipped.length) msg.push('Bỏ qua: ' + plan.skipped.join('; '));
  $('#plan').innerHTML = `<div class="alert ${errs.length ? 'block' : 'pass'}">${msg.map(esc).join('<br>')}${errs.length ? '<br><b>Lỗi:</b><br>' + errs.map(esc).join('<br>') : ''}${ok ? '<br>Dữ liệu ERP đã thay đổi — cần chạy lại STEP 2 và STEP 3.' : ''}</div>`;
}

// ---------- STEP 2 ----------
VIEWS.step2 = (el) => {
  const st = statusAll(); const s2 = S.d.step2;
  const cls = s2 ? step2Classification(S.d.datasets, S.period, s2, S.d.register) : null;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 2 · Phân bổ Stock Out vào lô PC</h1><p class="lead">Stock Out NVL được phân bổ vào các lô PC-P theo quy tắc khách hàng / job code / location. Stock Out thành phẩm (FG) không phải NVL — được tách sang sổ Rework (2B).</p></div>
      <div class="result"><span>Kết quả</span>${pill(st.s2c.status)}<small>${esc(st.s2c.okText)}</small></div></header>
    <div class="row"><button class="btn" data-act="run-step2" type="button">Chạy STEP 2</button>${s2 ? `<span class="muted">Lần chạy gần nhất ${fmtTs(s2.runAt)}</span>` : ''}</div>
    ${s2 ? `
    <div class="grid2">
      <div><h2>Đối chiếu theo hệ nguồn</h2><table class="cp"><thead><tr><th>Hệ</th><th class="r">Stock Out nguồn</th><th class="r">Đã phân bổ</th><th class="r">Chưa phân bổ</th><th class="r">Chênh lệch</th><th>Trạng thái</th></tr></thead><tbody>
      ${[...s2.summary, s2.total].map((r) => `<tr class="${r.erp === 'TOTAL' ? 'tot' : ''}"><td>${r.erp === 'TOTAL' ? 'Tổng' : `<span class="erp erp-${r.erp}">${r.erp}</span>`}</td><td class="r">${v(r.src)}</td><td class="r">${v(r.alloc)}</td><td class="r">${v(r.unalloc)}</td><td class="r">${v(r.diff)}</td><td>${pill(r.status)}</td></tr>`).join('')}
      </tbody></table></div>
      <div><h2>Phân loại Stock Out (NVL / FG)</h2><table class="cp"><tbody>
        <tr><td>Tổng Stock Out thô</td><td class="r">${v(cls.totalRaw)}</td><td>Số dòng FG</td><td class="r">${cls.fgRows}</td></tr>
        <tr><td>NVL / non-FG đủ điều kiện</td><td class="r">${v(cls.rmEligible)}</td><td>SL FG rework</td><td class="r">${fmtNum(cls.fgQty)}</td></tr>
        <tr><td>FG Rework – giá ERP (memo)</td><td class="r">${v(cls.fgRef)}</td><td>FG phân bổ vào PC</td><td class="r">${v(cls.fgAllocated)}</td></tr>
        <tr><td>NVL đã phân bổ vào PC</td><td class="r">${v(cls.allocatedRM)}</td><td>Kiểm tra phân loại</td><td>${pill(cls.classCheck)}</td></tr>
        <tr><td>Chênh lệch phân bổ NVL</td><td class="r">${v(cls.rmDiff)}</td><td>Cổng STEP 2</td><td>${pill(cls.gate)}</td></tr>
      </tbody></table></div>
    </div>
    <h2>Checkpoint</h2>${cpTable(st.s2c.rows)}
    <details><summary>Quy tắc phân bổ</summary><table class="cp"><thead><tr><th>Ưu tiên</th><th>Nguồn</th><th>Điều kiện nguồn</th><th>Đích</th><th>Nhóm lô đích</th><th>Tiêu thức</th><th>Xử lý</th></tr></thead><tbody>
      ${STEP2_RULES.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td><td>${esc(r[7])}</td></tr>`).join('')}</tbody></table></details>
    <h2>Chi tiết phân bổ</h2><div id="t-detail"></div>
    <h2>Kết quả theo lô PC-P (T và O)</h2><div id="t-pc"></div>` : emptyNote('Chưa có kết quả. Cần đủ PC-P-T, PC-P-O và STOCK OUT T/S/O rồi bấm Chạy STEP 2.')}
  </section>`;
  if (s2) {
    const dc = STEP2_DETAIL_HEADERS.map((h, i) => ({ key: i, label: h, type: [4, 13, 15].includes(i) ? 'num' : i === 14 ? 'pct' : i === 3 ? 'int' : i === 16 ? 'status' : 'text', width: [11].includes(i) ? 260 : [17].includes(i) ? 180 : [4, 13, 15].includes(i) ? 140 : 110 }));
    mountTable($('#t-detail'), { columns: dc, rows: s2.detail, filterKey: 16, totals: [15], height: 460, onExport: exportTable('03_STOCK_OUT_ALLOCATION', dc) });
    const pc = [
      { key: 'erp', label: 'Hệ', width: 50 }, { key: 'pcNo', label: 'PC No.', width: 120 }, { key: 'mo', label: 'MO No.', width: 120 }, { key: 'prod', label: 'Product Code', width: 150 },
      { key: 'name', label: 'Product Name', width: 260 }, { key: 'loc', label: 'Location', width: 100 }, { key: 'qty', label: 'SL hoàn thành', type: 'qty', width: 100 },
      { key: 'cost', label: 'Total Cost', type: 'num', width: 150 }, { key: 'allocT', label: 'Stock Out từ T', type: 'num', width: 130 }, { key: 'allocS', label: 'Stock Out từ S', type: 'num', width: 130 },
      { key: 'allocO', label: 'Stock Out từ O', type: 'num', width: 130 }, { key: 'alloc', label: 'Tổng Stock Out', type: 'num', width: 140 }, { key: 'rmIncl', label: 'RM gồm Stock Out', type: 'num', width: 150 }, { key: 'src', label: 'Nguồn', width: 70 },
    ];
    mountTable($('#t-pc'), { columns: pc, rows: s2.pc, totals: ['cost', 'allocT', 'allocS', 'allocO', 'alloc', 'rmIncl'], height: 420, onExport: exportTable('PC-P_StockOut', pc) });
  }
};

function doStep2() {
  try {
    const s2 = runStep2(S.d.datasets, S.period);
    S.d.step2 = s2;
    const bf = S.d.register ? S.d.register.rows.filter((r) => r.active === 'B/F').map(bfFromRow) : (S.d.bfSeed || []);
    S.d.register = buildReworkRegister(S.d.datasets, S.period, S.d.register ? S.d.register.rows : [], bf);
    audit('STEP 2 - STOCK OUT (RM / FG SPLIT)', `${s2.status} · NVL phân bổ ${fmtNum(s2.total.alloc)} · FG rework ${S.d.register.stats.rows} dòng`);
    markDirty('step2', 'register', 'audit');
    toast(`STEP 2 xong: ${s2.status}. Đã phân bổ ${fmtNum(s2.total.alloc)} VND.`, s2.status === 'PASS' ? 'pass' : 'review');
  } catch (e) { toast('STEP 2 dừng: ' + e.message, 'block'); }
  render();
}
function bfFromRow(r) {
  return { rid: r.rid, erp: r.erp, doc: r.doc, srcRow: r.srcRow, issueDate: r.issueDate, fg: r.fg, fgName: r.fgName, itemType: r.itemType, loc: r.loc, uom: r.uom, bfQty: r.bfQty, carryCost: r.bfCost, reason: r.reason, jobKey: r.jobKey, rwType: r.rwType, rwStatus: r.rwStatus, pcNo: r.pcNo, outFG: r.outFG, compDate: r.compDate, compQty: r.compQty, scrapQty: r.scrapQty, note: r.note, originPeriod: r.originPeriod };
}

// ---------- 2B register ----------
VIEWS.rework = (el) => {
  const reg = S.d.register;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 2B · Sổ FG Stock Out / Rework</h1><p class="lead">FG xuất kho đi rework không phải tiêu hao NVL. Cập nhật loại, trạng thái và lô PC rework ở đây; dữ liệu nhập tay được giữ khi chạy lại STEP 2. Giá trị FIFO sẽ được tính ở STEP 5B (giai đoạn 3).</p></div>
    ${reg ? `<div class="result"><span>Kiểm tra dữ liệu nhập</span>${pill(reg.rows.filter((r) => String(r.inputCheck).startsWith('BLOCK')).length ? 'BLOCK' : 'PASS')}<small>${reg.stats.rows} dòng kỳ này · ${reg.stats.bfRows} dòng B/F</small></div>` : ''}</header>
    ${reg ? `<div class="kpis">${kpiN('Số lượng FG xuất', reg.stats.issueQty)}${kpi('Giá trị ERP (memo)', reg.stats.erpRef)}${kpi('Rework WIP chuyển sang (B/F)', reg.stats.bfCost)}${kpi('Closing Rework WIP', reg.rows.reduce((a, r) => a + num(r.closingWIP), 0))}</div>
    <div id="t-rw"></div>` : emptyNote('Sổ được tạo khi chạy STEP 2.', 'step2', 'Mở STEP 2')}
  </section>`;
  if (!reg) return;
  const types = { issueQty: 'qty', erpRef: 'num', compQty: 'qty', scrapQty: 'qty', fifoQty: 'qty', fifoCost: 'num', closingWIP: 'num', carryIn: 'num', bfQty: 'qty', bfCost: 'num', issueDate: 'date', compDate: 'date', srcRow: 'int', inputCheck: 'status', fifoStatus: 'status', lastFifoRun: 'date' };
  const editable = { rwType: ['NORMAL', 'ABNORMAL'], rwStatus: ['OPEN', 'HOLD', 'COMPLETED'], pcNo: null, outFG: null, compDate: null, compQty: null, scrapQty: null, note: null };
  const cols = RW_FIELDS.map((f, i) => ({ key: f, label: RW_HEADERS[i], type: types[f] || 'text', width: f === 'rid' ? 250 : f === 'fgName' ? 240 : f === 'note' ? 200 : ['inputCheck', 'fifoStatus'].includes(f) ? 190 : 110, editable: f in editable, options: editable[f] || undefined }))
    .filter((c) => !['period'].includes(c.key));
  mountTable($('#t-rw'), {
    columns: cols, rows: reg.rows, filterKey: 'inputCheck', height: 520, totals: ['issueQty', 'erpRef', 'closingWIP', 'carryIn'],
    onExport: exportTable('03_FG_REWORK_INPUT', cols),
    onEdit: !store.canEdit() ? undefined : (row, k, val) => {
      if (k === 'compDate') row[k] = val ? ((Date.UTC(+val.slice(0, 4), +val.slice(5, 7) - 1, +val.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000) : null;
      else if (['compQty', 'scrapQty'].includes(k)) row[k] = val === '' ? null : num(val);
      else row[k] = val;
      recheckRegisterRow(row);
      audit('2B REGISTER EDIT', `${row.rid} · ${k} = ${val}`);
      markDirty('register', 'audit');
    },
  });
};

// ---------- Opening WIP ----------
VIEWS.opening = (el) => {
  const op = S.d.opening; const prev = prevPeriod(S.period);
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 3A · Opening WIP</h1><p class="lead">Số dư WIP vật tư đầu kỳ ${esc(S.period)}. Quy tắc: Opening ERP = Opening giá thành (chỉ một số dư đầu kỳ). Lấy từ Closing WIP kỳ ${esc(prev)} hoặc import từ file.</p></div>
      <div class="result"><span>Trạng thái</span>${pill(op ? op.status : 'NO DATA')}<small>${op && op.stats ? `${fmtNum(op.stats.materials)} vật tư` : ''}</small></div></header>
    <div class="row">
      <button class="btn" data-act="roll-wip" type="button">Roll forward từ ${esc(prev)}</button>
      <label class="btn ghost">Import từ file…<input type="file" id="f-open" accept=".xlsx,.xlsm,.xls" hidden></label>
      <button class="btn ghost" data-act="validate-wip" type="button" ${op ? '' : 'disabled'}>Validate &amp; lưu</button>
      <button class="btn ghost" data-act="template-wip" type="button">Tải file mẫu</button>
      <span class="spacer"></span>
      <button class="btn danger ghost" data-act="reset-wip" type="button" ${op ? '' : 'disabled'}>Xoá Opening WIP</button>
    </div>
    <p class="muted">Import nhận file Costing Master tháng trước (sheet 03_WIP_ALLOCATION hoặc WIP_OPENING), file WIP cũ (sheet "WIP- ONLY RM") hoặc bất kỳ bảng nào có cột Item/Material Code, Closing/Opening Qty và Amount.</p>
    ${op ? `<div class="kpis">${kpi('Opening Amount', op.stats ? op.stats.totalAmt : null, true)}${kpiN('Vật tư', op.stats && op.stats.materials)}${kpiN('Lỗi chặn', op.stats && op.stats.errors)}${kpiN('Thiếu tên', op.stats && op.stats.missingName)}${kpiN('Thiếu ĐVT', op.stats && op.stats.missingUnit)}</div>
      <p class="muted">Nguồn: ${esc(op.source || '')} · Kỳ: ${esc(op.period)} · Thay đổi lúc ${fmtTs(op.changedAt)}</p><div id="t-op"></div>` : emptyNote('Chưa có Opening WIP cho kỳ này.')}
  </section>`;
  $('#f-open').addEventListener('change', (e) => importOpening(e.target.files[0]));
  if (op) {
    const cols = [{ key: 'code', label: 'Material Code', width: 130 }, { key: 'name', label: 'Material Name', width: 320 }, { key: 'unit', label: 'Unit', width: 70 }, { key: 'qty', label: 'Opening Qty', type: 'qty', width: 130 },
      { key: 'amt', label: 'Opening Amount', type: 'num', width: 160 }, { key: 'source', label: 'Source', width: 200 }, { key: 'note', label: 'Note', width: 220 }, { key: 'status', label: 'Status', type: 'status', width: 170 }];
    mountTable($('#t-op'), { columns: cols, rows: op.rows, filterKey: 'status', totals: ['qty', 'amt'], height: 520, onExport: exportTable('WIP_OPENING', cols) });
  }
};
const kpiN = (label, n) => `<div class="kpi"><span>${esc(label)}</span><b>${n === undefined || n === null ? '—' : fmtNum(n)}</b></div>`;

async function importOpening(file) {
  if (!file || !guardEdit()) return;
  await busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const buf = await file.arrayBuffer();
      let res = await parseFile(buf.slice(0), 'all', ['03_WIP_ALLOCATION', 'WIP_OPENING', 'WIP- ONLY RM']);
      let det = detectOpeningSource(res.grids);
      if (!det) { res = await parseFile(buf, 'all'); det = detectOpeningSource(res.grids); }
      if (!det) throw new Error('Không tìm thấy bảng WIP closing/opening trong file.');
      const { opening, warn } = openingFromSource(res.grids, det, file.name, S.period);
      if (warn && !confirm(warn + '\nVẫn import?')) return;
      validateOpening(opening, S.d.datasets, S.period);
      S.d.opening = opening;
      audit('OPENING WIP IMPORT', `${opening.source} · ${opening.rows.length} dòng · ${fmtNum(opening.stats.totalAmt)} VND · ${opening.status}`);
      markDirty('opening', 'audit');
      toast(`Đã import Opening WIP: ${opening.rows.length} dòng, ${opening.status}.`, opening.status === 'NOT READY' ? 'block' : 'pass');
    } catch (e) { toast('Import Opening WIP lỗi: ' + e.message, 'block'); }
  });
  render();
}
async function rollWIP() {
  const prev = prevPeriod(S.period);
  let s3 = null;
  s3 = await store.localGet(lk(prev, 'step3'));
  if (!s3 && store.cloud.user) {
    try { const r = await store.cloudLoad(prev); s3 = r && r.blobs.step3; } catch { /* ignore */ }
  }
  if (!s3) { toast(`Chưa có Material WIP (STEP 3) của kỳ ${prev}. Hãy import Opening WIP từ file.`, 'block'); return; }
  if (nextPeriod(s3.period) !== S.period) { toast(`Closing WIP hiện có là kỳ ${s3.period}, không phải kỳ liền trước.`, 'block'); return; }
  const op = openingFromClosing(s3, S.period);
  validateOpening(op, S.d.datasets, S.period);
  S.d.opening = op;
  audit('OPENING WIP ROLL FORWARD', `Closing WIP ${prev} → Opening ${S.period} · ${fmtNum(op.stats.totalAmt)} VND`);
  markDirty('opening', 'audit');
  toast(`Đã roll forward Closing WIP ${prev} sang Opening ${S.period}.`, 'pass');
  render();
}

// ---------- STEP 3 ----------
VIEWS.step3 = (el) => {
  const st = statusAll(); const s3 = S.d.step3;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 3A · Material WIP</h1><p class="lead">Opening WIP + MI + Stock Out − PC − MR = Closing WIP ERP theo từng vật tư. FG Stock Out không đi vào WIP.</p></div>
      <div class="result"><span>Kết quả</span>${pill(st.s3c.status)}<small>${esc(st.s3c.okText)}</small></div></header>
    <div class="row"><button class="btn" data-act="run-step3" type="button">Chạy STEP 3</button>${s3 ? `<span class="muted">Lần chạy gần nhất ${fmtTs(s3.runAt)} · Nguồn opening: ${esc(s3.openingSource)}</span>` : ''}</div>
    ${s3 ? `<div class="flow">
      ${flowBox('Opening WIP', s3.summary.opening)}<i>+</i>${flowBox('MI', s3.summary.miAmt)}<i>+</i>${flowBox('Stock Out', s3.summary.soAmt)}<i>−</i>${flowBox('PC', s3.summary.pcAmt)}<i>−</i>${flowBox('MR', s3.summary.mrAmt)}<i>−</i>${flowBox('Stock Out', s3.summary.soOutAmt)}<i>=</i>${flowBox('Closing WIP', s3.summary.closingAmt, true)}
    </div>
    <div class="kpis">${kpiN('Vật tư', s3.rows.length)}${kpiN('Vật tư mới', s3.summary.newMat)}${kpiN('Ngoại lệ', s3.summary.exceptions)}${kpiN('WIP âm', s3.summary.negative)}${kpiN('Dòng MR SL = 0 có giá trị', s3.checks.mrQty.lines)}</div>
    ${s3.checks.mrQty.lines ? `<div class="alert review">MR-M: ${s3.checks.mrQty.lines} dòng có Quantity = 0 nhưng Total Cost = ${fmtNum(s3.checks.mrQty.cost)} VND. Kiểm tra file MR-M xuất từ ERP. (Nguồn SL: T, O = Quantity; S = Bad Quantity; không dùng Req. Qty.)</div>` : ''}
    <h2>Checkpoint</h2>${cpTable(st.s3c.rows)}
    <h2>WIP theo vật tư</h2><div id="t-wip"></div>` : `<h2>Checkpoint</h2>${cpTable(st.s3c.rows)}${emptyNote('Chưa chạy STEP 3. Cần STEP 2 = PASS và Opening WIP đã validate.')}`}
  </section>`;
  if (s3) {
    const keys = ['code', 'name', 'unit', 'opQty', 'opAmt', 'miQty', 'miAmt', 'soQty', 'soAmt', 'inQty', 'inAmt', 'pcQty', 'pcAmt', 'mrQty', 'mrAmt', 'soOutQty', 'soOutAmt', 'outQty', 'outAmt', 'closingQty', 'closingAmt', 'status'];
    const cols = keys.map((k, i) => ({ key: k, label: WIP_HEADERS[i], type: i === 21 ? 'status' : i >= 3 ? (i % 2 ? 'qty' : 'num') : 'text', width: i === 1 ? 280 : i === 2 ? 60 : i === 21 ? 170 : i >= 3 ? (i % 2 ? 110 : 140) : 120 }));
    mountTable($('#t-wip'), { columns: cols, rows: s3.rows, filterKey: 'status', totals: keys.filter((k, i) => i >= 3 && i <= 20 && i % 2 === 0), height: 540, onExport: exportTable('03_WIP_ALLOCATION', cols) });
  }
};
const flowBox = (l, x, strong) => `<div class="fb ${strong ? 'strong' : ''}"><span>${esc(l)}</span><b>${fmtNum(x)}</b></div>`;

function doStep3() {
  try {
    const s1 = step1Status(datasetsMeta());
    const s3 = runStep3(S.d.datasets, S.d.opening, S.d.step2, S.period, s1.latestImport);
    S.d.step3 = s3;
    audit('STEP 3 - MATERIAL WIP', `Vật tư=${s3.rows.length}; Mới=${s3.summary.newMat}; Closing=${fmtNum(s3.summary.closingAmt)}`);
    markDirty('step3', 'opening', 'audit');
    toast(`STEP 3 xong. Closing WIP ${fmtNum(s3.summary.closingAmt)} VND.`, 'pass');
  } catch (e) { toast('STEP 3 dừng: ' + e.message, 'block'); }
  render();
}

// ---------- ERP data viewer ----------
VIEWS.data = (el) => {
  const keys = ERPS.flatMap((e) => REPORTS.map((r) => dsKey(e, r)));
  const ds = S.d.datasets[S.dsView];
  el.innerHTML = `<section class="page"><header class="ph"><div><h1>Dữ liệu ERP đã import</h1><p class="lead">Dữ liệu gốc của từng báo cáo sau khi chuẩn hoá (từ dòng tiêu đề trở xuống).</p></div></header>
    <div class="tabs" role="tablist">${keys.map((k) => `<button type="button" role="tab" class="tab ${k === S.dsView ? 'on' : ''} ${S.d.datasets[k] ? '' : 'off'}" data-act="view-ds" data-k="${k}" aria-selected="${k === S.dsView}">${k}</button>`).join('')}</div>
    ${ds ? `<p class="muted">${esc(ds.fileName)} · dòng tiêu đề ${ds.headerRow} · ${fmtNum(ds.dataRows)} dòng · import ${fmtTs(ds.importedAt)}</p><div id="t-ds"></div>` : emptyNote('Báo cáo này chưa được import.', 'step1', 'Mở STEP 1')}</section>`;
  if (ds) {
    const cols = ds.header.map((h, i) => {
      const u = String(h || '').toUpperCase();
      const type = u.includes('DATE') ? 'date' : /COST|AMOUNT|PRICE|VALUE/.test(u) ? 'num' : /QTY|QUANTITY/.test(u) ? 'qty' : 'text';
      return { key: i, label: h ?? `(cột ${i + 1})`, type, width: /NAME|DESCRIPTION/.test(u) ? 260 : type === 'num' ? 140 : 120 };
    });
    mountTable($('#t-ds'), { columns: cols, rows: ds.rows, height: 560, onExport: exportTable(ds.key, cols) });
  }
};

// ---------- audit ----------
VIEWS.audit = (el) => {
  el.innerHTML = `<section class="page"><header class="ph"><div><h1>Nhật ký kỳ ${esc(S.period)}</h1><p class="lead">Mọi lần import, chạy bước và chỉnh sửa sổ rework.</p></div></header><div id="t-audit"></div></section>`;
  const cols = [{ key: 'at', label: 'Thời điểm', type: 'ts', width: 150 }, { key: 'user', label: 'Người dùng', width: 180 }, { key: 'action', label: 'Hành động', width: 280 }, { key: 'detail', label: 'Chi tiết', width: 520 }];
  mountTable($('#t-audit'), { columns: cols, rows: S.d.audit, height: 560, onExport: exportTable('AUDIT_LOG', cols) });
};

// ---------- settings / migration ----------
VIEWS.settings = (el) => {
  const c = store.cloud;
  el.innerHTML = `<section class="page"><header class="ph"><div><h1>Kỳ, cloud &amp; chuyển đổi</h1></div></header>
    <div class="grid2">
      <div class="card"><h2>Nạp một kỳ từ file Costing Master (.xlsm)</h2>
        <p>Đọc 21 sheet ERP, WIP_OPENING và sổ 03_FG_REWORK_INPUT (giữ dữ liệu nhập tay) từ file Excel, rồi chạy lại STEP 2–3A trên web và đối chiếu với kết quả trong file.</p>
        <label class="btn">Chọn file .xlsm…<input type="file" id="f-xlsm" accept=".xlsm,.xlsx" hidden></label>
        <div id="mig"></div></div>
      <div class="card"><h2>Đồng bộ cloud</h2>
        ${!c.enabled ? '<p>Chưa cấu hình Firebase — dữ liệu chỉ nằm trong trình duyệt này.</p>' : c.user ? `<p>Đăng nhập: <b>${esc(c.user.email)}</b> · vai trò <b>${esc(store.ROLES[c.role] || '')}</b>${c.isOwner ? ' (chủ sở hữu)' : ''}. ${store.canEdit() ? 'Mọi thay đổi được tự động lưu lên Firestore (đã nén).' : 'Bạn chỉ xem được dữ liệu, không lưu thay đổi lên cloud.'}</p><div class="row"><button class="btn ghost" data-act="push-cloud" type="button">Lưu kỳ này lên cloud ngay</button><button class="btn ghost" data-act="pull-cloud" type="button">Tải lại kỳ này từ cloud</button></div>` : `<p>Đăng nhập Google để lưu và mở dữ liệu trên mọi máy. ${c.error ? `<span class="err">${esc(c.error)}</span>` : ''}</p>`}
        <h2>Kỳ hiện có</h2><ul class="plist">${S.periods.map((p) => `<li><a href="#cc" data-act="goto-period" data-p="${p}">${p}</a>${p === S.period ? ' (đang mở)' : ''}</li>`).join('')}</ul>
        <div class="row"><button class="btn ghost" data-act="new-period" type="button">Tạo kỳ mới…</button><button class="btn ghost" data-act="export-all" type="button">Xuất kết quả kỳ ra Excel</button>
        ${S.period ? `<button class="btn danger ghost" data-act="delete-period" type="button">Xoá kỳ ${esc(S.period)}…</button>` : ''}</div></div>
    </div>
    ${store.isAdmin() ? `<div class="card" id="users"><h2>Người dùng &amp; phân quyền</h2><p class="muted">Đang tải danh sách…</p></div>` : ''}
    </section>`;
  $('#f-xlsm').addEventListener('change', (e) => migrateWorkbook(e.target.files[0]));
  if (store.isAdmin()) renderUsers();
};

let accessDraft = null;
async function renderUsers() {
  const box = $('#users'); if (!box) return;
  if (!accessDraft) {
    try { const a = await store.getAccess(); accessDraft = { members: { ...(a.members || {}) }, updatedAt: a.updatedAt, updatedBy: a.updatedBy, dirty: false }; }
    catch (e) { box.innerHTML = `<h2>Người dùng &amp; phân quyền</h2><div class="alert block">Không đọc được danh sách: ${esc(e.message)}</div>`; return; }
  }
  const me = String(store.cloud.user.email).toLowerCase();
  const rows = Object.entries(accessDraft.members).sort((a, b) => a[0].localeCompare(b[0]));
  const opt = (sel) => Object.entries(store.ROLES).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');
  box.innerHTML = `<h2>Người dùng &amp; phân quyền</h2>
    <p class="muted">Người trong danh sách đăng nhập Google bằng đúng email này là dùng được dữ liệu trên cloud. <b>Quản trị</b>: toàn quyền và quản lý người dùng · <b>Chỉnh sửa</b>: import, chạy các bước, sửa sổ rework · <b>Chỉ xem</b>: xem và xuất Excel. Chủ sở hữu khai báo trong Firestore Rules luôn có quyền Quản trị.</p>
    <table class="cp"><thead><tr><th>Email Google</th><th>Vai trò</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map(([e, r]) => `<tr><td>${esc(e)}${e === me ? ' <span class="muted">(bạn)</span>' : ''}</td><td><select data-user="${esc(e)}" aria-label="Vai trò của ${esc(e)}">${opt(r)}</select></td><td class="r"><button class="btn ghost sm danger" type="button" data-del-user="${esc(e)}">Xoá</button></td></tr>`).join('')
        : '<tr><td colspan="3" class="muted">Chưa có ai ngoài chủ sở hữu.</td></tr>'}
    </tbody></table>
    <form id="f-user" class="inline" style="margin-top:12px">
      <label>Email <input name="email" type="email" required placeholder="ten@gmail.com" style="min-width:260px"></label>
      <label>Vai trò <select name="role" style="display:block;padding:6px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--panel)">${opt('editor')}</select></label>
      <button class="btn ghost" type="submit">Thêm vào danh sách</button>
    </form>
    <div class="row"><button class="btn" type="button" id="save-users" ${accessDraft.dirty ? '' : 'disabled'}>Lưu thay đổi</button>
      <span class="muted">${accessDraft.dirty ? 'Có thay đổi chưa lưu.' : accessDraft.updatedAt ? `Cập nhật lần cuối ${fmtTs(accessDraft.updatedAt)} bởi ${esc(accessDraft.updatedBy || '')}` : ''}</span></div>`;
  box.querySelectorAll('[data-user]').forEach((s) => s.addEventListener('change', () => { accessDraft.members[s.dataset.user] = s.value; accessDraft.dirty = true; renderUsers(); }));
  box.querySelectorAll('[data-del-user]').forEach((b) => b.addEventListener('click', () => {
    const e = b.dataset.delUser;
    if (e === me && !store.cloud.isOwner && !confirm('Xoá chính bạn khỏi danh sách? Bạn sẽ mất quyền truy cập sau khi lưu.')) return;
    delete accessDraft.members[e]; accessDraft.dirty = true; renderUsers();
  }));
  $('#f-user').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target); const e = String(f.get('email')).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('Email không hợp lệ.', 'block'); return; }
    accessDraft.members[e] = f.get('role'); accessDraft.dirty = true; renderUsers();
  });
  $('#save-users').addEventListener('click', async () => {
    try {
      const saved = await store.saveAccess(accessDraft.members);
      audit('USER ACCESS UPDATE', Object.entries(saved).map(([e, r]) => `${e}=${r}`).join(', ') || '(trống)');
      markDirty('audit');
      accessDraft = null; toast('Đã lưu danh sách người dùng.', 'pass'); renderUsers();
    } catch (e) { toast('Không lưu được: ' + e.message, 'block'); }
  });
}

async function migrateWorkbook(file) {
  if (!file || !guardEdit()) return;
  const erpSheets = ERPS.flatMap((e) => REPORTS.map((r) => dsKey(e, r)));
  const extra = ['00_CONTROL_CENTER', 'WIP_OPENING', '03_FG_REWORK_INPUT', '03_STOCK_OUT_ALLOCATION', '03_WIP_ALLOCATION'];
  let report = '';
  await busy(`Đang đọc ${file.name} (file lớn có thể mất 10–30 giây)…`, async () => {
    try {
      const res = await parseFile(await file.arrayBuffer(), 'all', [...erpSheets, ...extra]);
      const g = res.grids; const cc = g['00_CONTROL_CENTER'];
      if (!cc) throw new Error('Không phải file SVL Costing Master (thiếu 00_CONTROL_CENTER).');
      const period = ttxt((cc[3] || [])[4]);
      if (!isPeriod(period)) throw new Error('Không đọc được kỳ báo cáo ở 00_CONTROL_CENTER!E4.');
      if (S.period !== period && !confirm(`File thuộc kỳ ${period}. Mở/ghi đè kỳ ${period} trên web?`)) return;
      if (S.period === period && (Object.keys(S.d.datasets).length) && !confirm(`Kỳ ${period} đã có dữ liệu trên web. Ghi đè bằng dữ liệu từ file?`)) return;
      S.period = period; S.d = emptyData();
      const statusByKey = {};
      for (let r = 15; r <= 35; r++) { const row = cc[r] || []; statusByKey[`${row[4]}-${row[3]}`] = { status: row[5], rows: row[6] }; }
      for (const k of erpSheets) {
        const grid = g[k]; if (!grid || grid.length < 4) continue;
        let header = grid[3].slice(); let cut = header.length;
        if (k.startsWith('PC-P-')) { const i = header.indexOf('Stock Out from T'); if (i > 0) cut = i; }
        while (cut > 0 && grid.slice(3).every((r) => r[cut - 1] === null || r[cut - 1] === undefined || r[cut - 1] === '')) cut--;
        header = header.slice(0, cut);
        const rows = grid.slice(4).map((r) => { const x = r.slice(0, cut); while (x.length < cut) x.push(null); return x; });
        const meta = grid[1] || [];
        const st = statusByKey[k] || {};
        const [rpt, erp] = [k.slice(0, k.length - 2), k.slice(-1)];
        S.d.datasets[k] = { key: k, erp, report: rpt, period, fileName: txt(meta[3]) || file.name, importedAt: typeof meta[4] === 'number' ? new Date(Date.UTC(1899, 11, 30) + meta[4] * 86400000 - 7 * 3600000).toISOString() : nowISO(), headerRow: num(meta[5]) || 4, status: st.status || (rows.length ? 'IMPORTED' : 'NO DATA'), dataRows: typeof st.rows === 'number' ? st.rows : rows.length, header, rows };
      }
      const wo = g['WIP_OPENING'];
      if (wo) {
        const rows = [];
        for (let r = 5; r < wo.length; r++) { const x = wo[r] || []; if ([0, 1, 2, 3, 4].every((i) => x[i] === null || x[i] === '')) continue; rows.push({ code: x[0], name: x[1], unit: x[2], qty: x[3], amt: x[4], source: x[5], note: x[6], status: '' }); }
        S.d.opening = { period: ttxt((wo[1] || [])[1]) || period, source: txt((wo[1] || [])[7]), rows, status: 'NOT VALIDATED', changedAt: new Date(Date.now() - 60000).toISOString() };
        validateOpening(S.d.opening, S.d.datasets, period);
      }
      const ri = g['03_FG_REWORK_INPUT']; const oldRows = [];
      if (ri) for (let r = 8; r < ri.length; r++) { const x = ri[r] || []; if (!x[2]) continue; oldRows.push(Object.fromEntries(RW_FIELDS.map((f, i) => [f, x[i] ?? null]))); }
      S.d.register = { period, refreshedAt: '', rows: oldRows, stats: {} };
      audit('MIGRATE FROM EXCEL', `${file.name} · ${Object.keys(S.d.datasets).length} báo cáo ERP · Opening ${S.d.opening ? S.d.opening.rows.length : 0} dòng · Rework ${oldRows.length} dòng`);
      // re-run engine
      const s2 = runStep2(S.d.datasets, period); S.d.step2 = s2;
      const bf = oldRows.filter((r) => r.active === 'B/F').map(bfFromRow);
      S.d.register = buildReworkRegister(S.d.datasets, period, oldRows, bf);
      let s3 = null, s3err = '';
      try { s3 = runStep3(S.d.datasets, S.d.opening, s2, period, ''); S.d.step3 = s3; } catch (e) { s3err = e.message; }
      audit('STEP 2 + STEP 3 (sau chuyển đổi)', `${s2.status} · Closing WIP ${s3 ? fmtNum(s3.summary.closingAmt) : s3err}`);
      // compare with workbook values
      const cellv = (gr, r, c) => (gr && gr[r - 1] ? gr[r - 1][c - 1] : null);
      const sa = g['03_STOCK_OUT_ALLOCATION'], wa = g['03_WIP_ALLOCATION'];
      const cmp = [
        ['STEP 2 · Stock Out nguồn (TOTAL)', s2.total.src, cellv(sa, 8, 2)], ['STEP 2 · Đã phân bổ', s2.total.alloc, cellv(sa, 8, 3)],
        ['STEP 2 · Số dòng chi tiết', s2.detail.length, sa ? sa.slice(19).filter((r) => r && r[0] !== null && r[0] !== undefined).length : null],
        ['STEP 3 · Opening WIP', s3 && s3.summary.opening, cellv(wa, 5, 1)], ['STEP 3 · WIP vào', s3 && s3.summary.inAmt, cellv(wa, 5, 5)],
        ['STEP 3 · WIP ra', s3 && s3.summary.outAmt, cellv(wa, 5, 9)], ['STEP 3 · Closing WIP', s3 && s3.summary.closingAmt, cellv(wa, 5, 15)],
        ['STEP 3 · Số vật tư', s3 && s3.rows.length, wa ? wa.slice(11).filter((r) => r && r[0] !== null && r[0] !== undefined && r[0] !== '').length : null],
      ];
      report = `<table class="cp"><thead><tr><th>Chỉ tiêu</th><th class="r">Web</th><th class="r">Excel</th><th class="r">Chênh lệch</th><th></th></tr></thead><tbody>${cmp.map(([l, a, b]) => {
        const d = typeof a === 'number' && typeof b === 'number' ? a - b : null;
        return `<tr><td>${esc(l)}</td><td class="r">${a === null || a === undefined ? '—' : fmtNum(a, Number.isInteger(a) ? 0 : 2)}</td><td class="r">${b === null || b === undefined ? "—" : fmtNum(b, Number.isInteger(b) ? 0 : 2)}</td><td class="r">${d === null ? '' : fmtNum(d, 2)}</td><td>${pill(d === null ? 'INFO' : Math.abs(d) < 1 ? 'PASS' : 'CHECK')}</td></tr>`;
      }).join('')}</tbody></table>${s3err ? `<div class="alert block">STEP 3: ${esc(s3err)}</div>` : ''}`;
      S.dirty = new Set(Object.keys(allBlobs()));
      await saveLocal(); S.dirty.clear(); scheduleCloud();
      await refreshPeriods();
      toast(`Đã nạp kỳ ${period} từ Excel.`, 'pass');
    } catch (e) { toast('Chuyển đổi lỗi: ' + e.message, 'block'); }
  });
  render();
  if (report && S.view === 'settings') $('#mig').innerHTML = `<h2>Đối chiếu Web ↔ Excel</h2>${report}`;
}

async function exportAll() {
  const sheets = [];
  const s2 = S.d.step2, s3 = S.d.step3, reg = S.d.register, op = S.d.opening;
  if (s2) {
    sheets.push({ name: '03_STOCK_OUT_ALLOCATION', aoa: [['STOCK OUT ALLOCATION TO PC-P'], ['Reporting Period', S.period, '', 'Run Time', s2.runAt], [], ['Source ERP', 'Source Stock Out', 'Allocated', 'Unallocated / WIP', 'Difference', 'Status'], ...[...s2.summary, s2.total].map((r) => [r.erp, r.src, r.alloc, r.unalloc, r.diff, r.status]), [], STEP2_DETAIL_HEADERS, ...s2.detail] });
    sheets.push({ name: 'PC-P_StockOut', aoa: [['ERP', 'PC No.', 'MO No.', 'Product Code', 'Product Name', 'Location', 'Current Complete Qty', 'Total Cost', 'Stock Out from T', 'Stock Out from S', 'Stock Out from O', 'Total Stock Out Allocated', 'RM Cost incl. Stock Out', 'ST Allocation Source'], ...s2.pc.map((p) => [p.erp, p.pcNo, p.mo, p.prod, p.name, p.loc, p.qty, p.cost, p.allocT, p.allocS, p.allocO, p.alloc, p.rmIncl, p.src || '-'])] });
  }
  if (reg) sheets.push({ name: '03_FG_REWORK_INPUT', aoa: [RW_HEADERS, ...reg.rows.map((r) => RW_FIELDS.map((f) => (['issueDate', 'compDate'].includes(f) && typeof r[f] === 'number' ? serialToISO(r[f]) : r[f] ?? '')))] });
  if (op) sheets.push({ name: 'WIP_OPENING', aoa: [['WIP OPENING BALANCE CONTROL'], ['Opening Period', op.period, '', 'Status', op.status, '', 'Source', op.source], [], [], ['Material Code', 'Material Name', 'Unit', 'Opening Qty', 'Opening Amount', 'Source', 'Note', 'Status'], ...op.rows.map((r) => [r.code, r.name, r.unit, r.qty, r.amt, r.source, r.note, r.status])] });
  if (s3) {
    const keys = ['code', 'name', 'unit', 'opQty', 'opAmt', 'miQty', 'miAmt', 'soQty', 'soAmt', 'inQty', 'inAmt', 'pcQty', 'pcAmt', 'mrQty', 'mrAmt', 'soOutQty', 'soOutAmt', 'outQty', 'outAmt', 'closingQty', 'closingAmt', 'status'];
    const pad = Array(10).fill([]);
    sheets.push({ name: '03_WIP_ALLOCATION', aoa: [['STEP 3 - MATERIAL WIP'], ['Reporting Period', S.period, '', 'Run Time', s3.runAt, '', 'Opening Source', s3.openingSource], ...pad.slice(0, 8), WIP_HEADERS, ...s3.rows.map((r) => keys.map((k) => r[k]))] });
  }
  if (!sheets.length) { toast('Chưa có kết quả để xuất.', 'review'); return; }
  await exportBook(`SVL_Costing_Web_${S.period}.xlsx`, sheets);
}

// ======================= actions =======================
async function newPeriod() {
  const sug = S.period ? nextPeriod(S.period) : '';
  const p = (prompt('Kỳ mới (YYYY-MM):', sug) || '').trim();
  if (!p) return;
  if (!isPeriod(p)) { toast('Kỳ phải có dạng YYYY-MM.', 'block'); return; }
  const prev = S.period && nextPeriod(S.period) === p ? { step3: S.d.step3, register: S.d.register } : null;
  await openPeriod(p);
  if (prev && !S.d.opening && prev.step3) {
    S.d.opening = openingFromClosing(prev.step3, p); validateOpening(S.d.opening, S.d.datasets, p);
    audit('OPENING WIP ROLL FORWARD', `Closing WIP ${prev.step3.period} → Opening ${p}`);
    markDirty('opening', 'audit');
  }
  if (prev && prev.register && !S.d.register) {
    // Closing Rework WIP of the previous period becomes B/F rows (RW_ArchiveClosingReworkWIP → RW_CollectBroughtForward)
    S.d.bfSeed = prev.register.rows.filter((r) => (r.active === 'Y' || r.active === 'B/F') && num(r.closingWIP) > 1).map((r) => ({ ...bfFromRow(r), bfQty: r.active === 'B/F' ? r.bfQty : r.fifoQty, carryCost: num(r.closingWIP), originPeriod: r.active === 'B/F' ? r.originPeriod : r.period }));
    if (S.d.bfSeed.length) { S.d.register = { period: p, refreshedAt: '', rows: S.d.bfSeed.map((b) => ({ active: 'B/F', ...b, bfCost: b.carryCost, closingWIP: b.carryCost, fifoStatus: 'OPENING B/F', rowSource: 'OPENING B/F' })), stats: { rows: 0, issueQty: 0, erpRef: 0, bfRows: S.d.bfSeed.length, bfCost: S.d.bfSeed.reduce((a, b) => a + b.carryCost, 0) } }; markDirty('register'); }
  }
  S.view = 'cc'; location.hash = 'cc'; render();
}

document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (a.tagName === 'A') e.preventDefault();
  if (WRITE_ACTS.has(act) && !guardEdit()) return;
  switch (act) {
    case 'signin': try { await store.signIn(); } catch (err) { toast('Đăng nhập lỗi: ' + err.message, 'block'); } break;
    case 'signout': await store.signOut(); break;
    case 'new-period': await newPeriod(); break;
    case 'run-step2': await busy('Đang chạy STEP 2…', async () => doStep2()); break;
    case 'run-step3': await busy('Đang chạy STEP 3…', async () => doStep3()); break;
    case 'roll-wip': await rollWIP(); break;
    case 'validate-wip':
      validateOpening(S.d.opening, S.d.datasets, S.period); S.d.opening.changedAt = nowISO();
      audit('OPENING WIP VALIDATE', `${S.d.opening.status} · lỗi ${S.d.opening.stats.errors}`); markDirty('opening', 'audit'); render(); break;
    case 'reset-wip':
      if (confirm(`Xoá Opening WIP kỳ ${S.period}? (Không xoá dữ liệu ERP)`)) { S.d.opening = null; audit('OPENING WIP RESET', ''); markDirty('opening', 'audit'); render(); } break;
    case 'template-wip':
      exportBook('SVL_WIP_Opening_Template.xlsx', [{ name: 'WIP_OPENING', aoa: [['WIP OPENING BALANCE CONTROL'], ['Opening Period', S.period], [], [], ['Material Code', 'Material Name', 'Unit', 'Opening Qty', 'Opening Amount', 'Source', 'Note']] }]); break;
    case 'reset-erp': {
      const sc = (prompt('Xoá dữ liệu ERP đã import (giữ kỳ báo cáo). Nhập ALL, T, S hoặc O:', '') || '').trim().toUpperCase();
      if (!['ALL', 'T', 'S', 'O'].includes(sc)) break;
      let n = 0;
      for (const k of Object.keys({ ...S.d.datasets, ...S.d.importLog })) if (sc === 'ALL' || k.endsWith('-' + sc)) { delete S.d.datasets[k]; delete S.d.importLog[k]; S.dirty.add('ds:' + k); n++; }
      audit('RESET ERP DATA - ' + sc, `Đã xoá ${n} báo cáo`); markDirty('importLog', 'audit'); render(); break;
    }
    case 'view-ds': S.dsView = a.dataset.k; if (S.view !== 'data') location.hash = 'data'; else render(); break;
    case 'goto-period': await openPeriod(a.dataset.p); break;
    case 'push-cloud': await pushCloud(); toast('Đã lưu lên cloud.', 'pass'); break;
    case 'pull-cloud': await openPeriod(S.period, { preferCloud: true }); break;
    case 'export-all': await exportAll(); break;
    case 'delete-period':
      if (prompt(`Gõ ${S.period} để xoá toàn bộ dữ liệu kỳ này trên máy này${store.cloud.user ? ' và trên cloud' : ''}:`) === S.period) {
        for (const k of await store.localKeys()) if (String(k).startsWith(`p/${S.period}/`)) await store.localDel(k);
        await store.localSet('periods', ((await store.localGet('periods')) || []).filter((p) => p !== S.period));
        if (store.cloud.user) await store.cloudDelete(S.period);
        toast(`Đã xoá kỳ ${S.period}.`, 'pass');
        await refreshPeriods(); S.period = S.periods[0] || ''; if (S.period) await openPeriod(S.period); else render();
      }
      break;
    default: break;
  }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'period-sel') await openPeriod(e.target.value);
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'f-new') { e.preventDefault(); const p = new FormData(e.target).get('p').trim(); if (!isPeriod(p)) { toast('Kỳ phải có dạng YYYY-MM.', 'block'); return; } await openPeriod(p); markDirty('audit'); }
});
window.addEventListener('hashchange', () => { S.view = location.hash.slice(1) || 'cc'; render(); });

// ======================= boot =======================
(async function boot() {
  S.view = location.hash.slice(1) || 'cc';
  await refreshPeriods();
  const last = localStorage.getItem('svl.period');
  if (last && isPeriod(last)) await openPeriod(last); else if (S.periods[0]) await openPeriod(S.periods[0]); else render();
  if (store.cloud.enabled) {
    store.initCloud(async (u) => {
      renderShell();
      accessDraft = null;
      if (u) { await refreshPeriods(); if (S.period) await openPeriod(S.period); else if (S.periods[0]) await openPeriod(S.periods[0]); scheduleCloud(); }
      else if (store.cloud.error) toast(store.cloud.error, 'review');
      render();
    });
  }
})();
