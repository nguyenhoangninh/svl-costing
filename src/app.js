// SVL Costing Web — application shell (state, persistence, views)
import { ERPS, REPORTS, dsKey, isPeriod, nextPeriod, prevPeriod, num, txt, ttxt, nowISO, serialToISO, parseUserNumber, fpRows } from './engine/util.js';
import { buildDataset, planImport, step1Status } from './engine/step1.js';
import { runStep2, buildReworkRegister, step2Classification, recheckRegisterRow, STEP2_RULES, STEP2_DETAIL_HEADERS, RW_FIELDS, RW_HEADERS } from './engine/step2.js';
import { validateOpening, detectOpeningSource, openingFromSource, openingFromClosing, runStep3, WIP_HEADERS } from './engine/step3.js';
import { step1Controls, step2Controls, step3Controls, accessLimitedCount, outOfPeriodRows, fallbackAlloc } from './engine/controls.js';
import { mountTable, esc } from './ui/table.js';
import { fmtCell, fmtNum, fmtTs, statusClass } from './ui/format.js';
import * as store from './store.js';
import { APP_VERSION } from './config.js';
import * as P2 from './views/phase2.js';
import * as P3 from './views/phase3.js';
import * as TRV from './views/trace.js';

// ======================= state =======================
const BLOBS = ['importLog', 'step2', 'register', 'opening', 'step3', 'audit', ...P2.PHASE2_BLOBS, ...P3.PHASE3_BLOBS];
const S = {
  period: '', periods: [], view: 'cc', busy: '',
  d: emptyData(), dirty: new Set(), sync: 'local', syncMsg: '',
  dsView: 'PC-P-T',
};
function emptyData() { return { datasets: {}, importLog: {}, step2: null, register: null, opening: null, step3: null, audit: [], erpMap: null, wipadj: null, salesImport: null, salesDB: null, soPrice: [], manualPrice: [], pm: null, gl: null, directAdj: [], step4: null, lotCheck: null, lotParams: null, fgRef: null, fgOpen: null, step5: null, fgHistory: null, fifoOverrides: null, s5cfg: null, fgItems: null, closed: null, closedEver: null, rwArchive: null }; }

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
  d.audit = d.audit || []; d.importLog = d.importLog || {}; d.soPrice = d.soPrice || []; d.manualPrice = d.manualPrice || []; d.directAdj = d.directAdj || [];
  return d;
}
/** Persist the given blobs of one period (serialised through saveChain). */
async function saveBlobs(p, data, list) {
  for (const b of list) {
    if (b.startsWith('ds:')) { const k = b.slice(3); if (data.datasets[k]) await store.localSet(lk(p, b), data.datasets[k]); else await store.localDel(lk(p, b)); }
    else if (data[b] === null || data[b] === undefined) await store.localDel(lk(p, b)); else await store.localSet(lk(p, b), data[b]);
  }
  await store.localSet(lk(p, 'savedAt'), nowISO());
  const set = new Set((await store.localGet('periods')) || []); set.add(p);
  await store.localSet('periods', [...set].sort());
}
let saveChain = Promise.resolve();
async function saveLocal() {
  const p = S.period; if (!p) return;
  const list = [...S.dirty]; S.dirty = new Set();
  const data = S.d;
  saveChain = saveChain.then(() => saveBlobs(p, data, list));
  await saveChain;
}
function blobsOf(d) {
  const o = {};
  for (const [k, v] of Object.entries(d.datasets)) o['ds:' + k] = v;
  for (const b of BLOBS) if (d[b] !== null && d[b] !== undefined) o[b] = d[b];
  return o;
}
const allBlobs = () => blobsOf(S.d);
let syncTimer = null;
const CLOSED_OK = new Set(['closed', 'audit', 'rwArchive']);
/**
 * Persist mutated blobs of the open period. Each call captures its own dirty snapshot and saves are serialised, so a fast
 * second edit can never be cleared before it is written (F-13). Mutations of a CLOSED period are refused (F-02).
 */
function markDirty(...blobs) {
  const p = S.period; if (!p) return;
  if (isClosed() && blobs.some((b) => !CLOSED_OK.has(b))) {
    toast(`Kỳ ${p} đã đóng – thay đổi KHÔNG được lưu. Quản trị viên mở lại kỳ ở màn hình 5.3 nếu cần sửa.`, 'block');
    openPeriod(p); return;
  }
  const list = [...new Set(blobs)]; const data = S.d;
  S.editSeq = (S.editSeq || 0) + 1;
  saveChain = saveChain
    .then(() => saveBlobs(p, data, list))
    .then(async () => { if (store.cloud.enabled) await store.localSet(lk(p, 'unsynced'), true); if (p === S.period) scheduleCloud(); })
    .catch((e) => toast('Lỗi lưu trên máy: ' + e.message, 'block'));
}
function scheduleCloud() {
  if (!store.cloud.user) { S.sync = 'local'; renderSync(); return; }
  if (!store.canEdit()) { S.sync = 'readonly'; renderSync(); return; }
  if (!S.period) { S.sync = 'synced'; renderSync(); return; }
  if (S.sync === 'conflict') { renderSync(); return; }
  S.sync = 'pending'; renderSync();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => { const r = await pushCloud(); if (!r.ok) toast((r.conflict ? 'Xung đột cloud: ' : 'Chưa lưu được lên cloud: ') + r.error, 'block'); }, 1500);
}
/** Push now (no debounce) and report whether the cloud committed it. */
async function syncNow() { clearTimeout(syncTimer); await saveChain; return pushCloud(); }
/** Returns {ok, meta} or {ok:false, error, conflict}. Never reports success unless the cloud commit is confirmed (F-09). */
async function pushCloud() {
  if (!store.cloud.user) return { ok: false, error: 'Chưa đăng nhập.' };
  if (!S.period) return { ok: false, error: 'Chưa chọn kỳ.' };
  if (!store.canEdit()) return { ok: false, error: 'Tài khoản chỉ có quyền xem.' };
  const p = S.period, data = S.d, seq = S.editSeq || 0;
  const meta0 = await store.cloudMeta(p).catch(() => null);
  if (meta0 && meta0.summary && meta0.summary.closed && !store.isAdmin()) { S.sync = 'synced'; S.syncMsg = 'Kỳ đã đóng trên cloud – chỉ quản trị viên ghi được.'; renderSync(); return { ok: false, error: 'Kỳ đã đóng trên cloud; chỉ quản trị viên được ghi.' }; }
  try {
    S.sync = 'saving'; renderSync();
    await saveChain;
    let baseRev = await store.localGet(lk(p, 'cloudRev'));
    if (baseRev === undefined || baseRev === null) baseRev = (await store.localGet(lk(p, 'cloudAt'))) || null; // legacy device state
    const blobs = blobsOf(data);
    const meta = await store.cloudSave(p, blobs, summaryForCloud(), (m) => { S.syncMsg = m; renderSync(); }, baseRev);
    await store.localSet(lk(p, 'cloudRev'), meta.rev); await store.localSet(lk(p, 'cloudAt'), meta.updatedAt);
    if ((S.editSeq || 0) === seq) await store.localDel(lk(p, 'unsynced'));
    S.sync = (S.editSeq || 0) === seq ? 'synced' : 'pending'; S.syncMsg = '';
    renderSync();
    if (S.sync === 'pending') scheduleCloud();
    return { ok: true, meta };
  } catch (e) {
    const conflict = e && e.name === 'ConflictError';
    S.sync = conflict ? 'conflict' : 'error'; S.syncMsg = e.message || String(e); renderSync();
    return { ok: false, error: S.syncMsg, conflict };
  }
}
function summaryForCloud() {
  const st = statusAll();
  const r5 = S.d.step5 && S.d.step5.period === S.period ? S.d.step5.totals : null;
  return { step1: st.s1c.result, step2: st.s2c.status, step3: st.s3c.status, step4: st.s4c.status, step5: st.s5c.status, closingWIP: S.d.step3 ? S.d.step3.summary.closingAmt : null, cogs: r5 ? r5.cogsA : null, closingFG: r5 ? r5.closeA : null, closed: S.d.closed && S.d.closed.period === S.period ? S.d.closed.closedAt : null, everClosed: !!S.d.closedEver || !!(S.d.closed && S.d.closed.period === S.period) };
}

async function openPeriod(p, { preferCloud = false } = {}) {
  await saveChain;
  S.period = p; S.d = await loadLocal(p);
  localStorage.setItem('svl.period', p);
  if (S.sync === 'conflict') { S.sync = 'local'; S.syncMsg = ''; }
  if (store.cloud.user) {
    try {
      const meta = await store.cloudMeta(p);
      const localRev = await store.localGet(lk(p, 'cloudRev'));
      const localCloudAt = await store.localGet(lk(p, 'cloudAt'));
      const unsynced = !!(await store.localGet(lk(p, 'unsynced')));
      const localEmpty = !Object.keys(S.d.datasets).length && !S.d.opening;
      const cloudNewer = !!meta && (meta.rev ? meta.rev !== localRev : (meta.updatedAt > (localCloudAt || '')));
      const ask = () => confirm(unsynced
        ? `Kỳ ${p}: cả máy này và cloud đều có thay đổi.\nCloud: cập nhật ${fmtTs(meta.updatedAt)} bởi ${meta.updatedBy}.\n\nOK = tải bản cloud về (BỎ các thay đổi chưa đồng bộ trên máy này).\nHuỷ = giữ bản trên máy, không ghi đè cloud.`
        : `Kỳ ${p} trên cloud mới hơn (cập nhật ${fmtTs(meta.updatedAt)} bởi ${meta.updatedBy}). Tải bản cloud về máy này?`);
      if (meta && (preferCloud || (localEmpty && !unsynced) || (cloudNewer && ask()))) {
        await busy('Đang tải dữ liệu từ cloud…', async () => {
          const r = await store.cloudLoad(p, (m) => setBusy(m));
          const d = emptyData();
          for (const [k, v] of Object.entries(r.blobs)) { if (k.startsWith('ds:')) d.datasets[k.slice(3)] = v; else d[k] = v; }
          d.audit = d.audit || []; d.importLog = d.importLog || {}; d.soPrice = d.soPrice || []; d.manualPrice = d.manualPrice || []; d.directAdj = d.directAdj || [];
          for (const k of await store.localKeys()) if (String(k).startsWith(`p/${p}/`)) await store.localDel(k);
          await saveBlobs(p, d, Object.keys(blobsOf(d)));
          S.d = d;
          await store.localSet(lk(p, 'cloudRev'), r.meta.rev || 0); await store.localSet(lk(p, 'cloudAt'), r.meta.updatedAt); await store.localDel(lk(p, 'unsynced'));
        });
        S.sync = 'synced';
      } else if (meta && cloudNewer) {
        S.sync = 'conflict'; S.syncMsg = 'Cloud có bản mới hơn bản trên máy – chưa tải về, thay đổi trên máy sẽ không được đẩy lên.';
      } else if (unsynced && store.canEdit()) scheduleCloud();
      else S.sync = meta ? 'synced' : 'local';
    } catch (e) { toast('Không đọc được cloud: ' + e.message, 'review'); }
  }
  await refreshPeriods();
  S.prevDrift = [];
  render();
  checkPrevDrift();
}
async function loadPeriodData(p) {
  if (p === S.period) return S.d;
  const d = await loadLocal(p);
  const empty = !d.step5 && !d.closed && !Object.keys(d.datasets).length;
  if (empty && store.cloud.user) {
    try { const r = await store.cloudLoad(p, () => {}); for (const [k, v] of Object.entries(r.blobs)) { if (k.startsWith('ds:')) d.datasets[k.slice(3)] = v; else d[k] = v; } } catch { /* not on cloud */ }
  }
  return d;
}
async function refreshPeriods() {
  const local = (await store.localGet('periods')) || [];
  let cloudP = [];
  try { cloudP = (await store.cloudPeriods()).map((x) => x.period); } catch { /* offline */ }
  S.periods = [...new Set([...local, ...cloudP, S.period].filter(isPeriod))].sort().reverse();
}

function audit(action, detail) {
  const e = { at: nowISO(), user: store.cloud.user ? store.cloud.user.email : 'thiết bị này', action, detail };
  S.d.audit.unshift(e);
  if (S.d.audit.length > 500) S.d.audit.length = 500;
  store.cloudAudit({ period: S.period, at: e.at, action, detail: String(detail ?? '').slice(0, 2000), app: APP_VERSION }); // append-only server copy (F-14)
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
  const s1c = step1Controls(s1, accessLimitedCount(S.d.datasets), outOfPeriodRows(S.d.datasets, S.period));
  const ctx = { period: S.period, step2: S.d.step2, register: S.d.register, latestImport: s1.latestImport, opening: S.d.opening, step3: S.d.step3, datasets: S.d.datasets };
  const p2 = S.period ? P2.derive(S) : { d3b: null, d4: null };
  const s3bc = p2.d3b ? p2.d3b.controls : { status: 'NOT RUN', okText: '', rows: [], next: 'Chạy STEP 3A trước' };
  const d5 = S.period ? P3.derive(S, p2) : null;
  return { s1, s1c, s2c: step2Controls(ctx), s3c: step3Controls(ctx), p2, d5, s3bc, s4c: p2.d4 ? p2.d4.controls : { status: 'NOT RUN', okText: '', rows: [], next: '' }, s5c: d5 ? d5.controls : { status: 'NOT RUN', okText: '', rows: [], next: '' } };
}
function derivedNow() { const p2 = P2.derive(S); return { ...p2, d5: P3.derive(S, p2) }; }

// ======================= permissions =======================
function guardEdit() {
  if (store.canEdit()) return true;
  toast(store.cloud.enabled && !store.cloud.user ? 'Đăng nhập Google để chỉnh sửa dữ liệu.' : 'Tài khoản của bạn chỉ có quyền xem. Nhờ quản trị viên cấp quyền Chỉnh sửa nếu cần.', 'review');
  return false;
}
/** Central period lock (F-02): a CLOSED period has no mutation path until an admin reopens it. */
const isClosed = () => !!(S.d && S.d.closed && S.d.closed.period === S.period);
function guardPeriod() {
  if (!isClosed()) return true;
  toast(`Kỳ ${S.period} đã đóng (${fmtTs(S.d.closed.closedAt)} · ${S.d.closed.closedBy}) – chỉ xem. Quản trị viên mở lại kỳ ở màn hình 5.3 nếu cần sửa.`, 'review');
  return false;
}
const guardMutate = () => guardEdit() && guardPeriod();
const canEditPeriod = () => store.canEdit() && !isClosed();
const WRITE_ACTS = new Set(['new-period', 'run-step2', 'approve-step2-fallback', 'run-step3', 'roll-wip', 'validate-wip', 'reset-wip', 'reset-erp', 'push-cloud', 'delete-period', '3b-sync', '3b-build', '3b-apply', '3b-all', 'sales-save', 'pm-update', 'run-step4', 's5-roll', 's5-validate', 's5-run', 's5-hist', 's5-close', 's5-reopen']);

/** Locale-safe number entry (F-16). Returns the number, null for blank, or undefined (after a toast) when ambiguous / invalid. */
function parseNum(v, label) {
  const r = parseUserNumber(v);
  if (!r.ok) { toast(`${label ? label + ': ' : ''}${r.error}`, 'block'); return undefined; }
  return r.value;
}
async function unsyncedPeriods() {
  return (await store.localKeys()).filter((k) => typeof k === 'string' && /^p\/.+\/unsynced$/.test(k)).map((k) => k.split('/')[1]);
}
async function clearLocal(silent) {
  if (!silent) {
    const uns = await unsyncedPeriods();
    if (!confirm(uns.length ? `Kỳ ${uns.join(', ')} còn thay đổi CHƯA đồng bộ lên cloud và sẽ MẤT. Vẫn xoá toàn bộ dữ liệu trên máy này?` : 'Xoá toàn bộ dữ liệu giá thành lưu trên máy này? Dữ liệu trên cloud không bị ảnh hưởng.')) return;
  }
  await saveChain;
  for (const k of await store.localKeys()) if (typeof k === 'string' && (k.startsWith('p/') || k === 'periods')) await store.localDel(k);
  localStorage.removeItem('svl.period');
  S.period = ''; S.d = emptyData(); S.periods = [];
  if (store.cloud.user) await refreshPeriods();
  toast('Đã xoá dữ liệu trên máy này.', 'pass');
  render();
}
window.addEventListener('beforeunload', (e) => {
  if (store.cloud.user && ['pending', 'saving', 'error', 'conflict'].includes(S.sync)) { e.preventDefault(); e.returnValue = ''; }
});

// ======================= UI helpers =======================
function toast(msg, kind = 'info') {
  const t = document.createElement('div'); t.className = `toast ${kind}`; t.textContent = msg; t.title = 'Bấm để đóng';
  t.addEventListener('click', () => t.remove());
  const box = $('#toasts'); box.appendChild(t);
  const keep = matchMedia('(max-width: 900px)').matches ? 2 : 4;
  while (box.children.length > keep) box.firstElementChild.remove(); setTimeout(() => t.remove(), kind === 'block' ? 9000 : 4500);
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
  const map = { local: ['Chỉ lưu trên máy này', 's-info'], pending: ['Chờ đồng bộ…', 's-rerun'], saving: [S.syncMsg || 'Đang lưu lên cloud…', 's-rerun'], synced: ['Đã đồng bộ cloud', 's-pass'], readonly: ['Chỉ xem – không lưu thay đổi', 's-info'], error: ['Lỗi đồng bộ: ' + S.syncMsg, 's-block'], conflict: ['Xung đột cloud – ' + S.syncMsg, 's-block'] };
  if (!navigator.onLine) { el.className = 'sync pill s-review'; el.textContent = 'Offline'; el.title = 'Không có mạng'; return; }
  const [t, c] = store.SANDBOX ? ['SANDBOX – dữ liệu thử, không đồng bộ cloud', 's-review'] : map[S.sync] || map.local;
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
  { id: 'p3b', no: '3B', label: 'Điều chỉnh WIP', sub: 'WIP âm → lô PC', key: 's3b' },
  { id: 'sales', no: '4.1', label: 'Doanh thu & giá', sub: 'Sales · Price Master', key: 'pm' },
  { id: 'gl', no: '4.2', label: 'FX / GL 622-627', sub: 'Tỷ giá · chi phí', key: 'gl' },
  { id: 'step4', no: '4.3', label: 'Phân bổ giá thành', sub: '622 / 627 theo lô', key: 's4' },
  { id: 'fgopen', no: '5.1', label: 'FG đầu kỳ', sub: 'Lớp FIFO đầu kỳ', key: 's5o' },
  { id: 'step5', no: '5.2', label: 'FIFO giá vốn', sub: 'COGS · rework 5B', key: 's5' },
  { id: 'close', no: '5.3', label: 'FG History & đóng kỳ', sub: 'Đóng kỳ', key: 's5c' },
];
const TOOLS = [
  { id: 'trace', label: 'Truy xuất giá thành sản phẩm' },
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
    s3b: st.s3bc.status, s4: st.s4c.status, ...(st.d5 ? P3.railStatus(S, st.d5) : { s5o: 'NOT RUN', s5: 'NOT RUN', s5c: 'NOT RUN' }),
    pm: !S.d.pm ? 'NOT RUN' : S.d.pm.status !== 'CURRENT' ? S.d.pm.status : S.d.pm.rows.some((r) => r.status === 'MISSING PRICE') ? 'BLOCK' : 'PASS',
    gl: S.d.gl && S.d.gl.period === S.period && num(S.d.gl.fx) > 0 ? 'PASS' : 'NOT RUN',
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
      ${NAV.map((n) => `<a href="#${n.id}" title="${esc(`${n.no ? n.no + ' · ' : ''}${n.label} – ${n.key ? rs[n.key] : n.sub}`)}" class="stop ${S.view === n.id ? 'on' : ''} ${n.later ? 'later' : ''}" ${S.view === n.id ? 'aria-current="page"' : ''}>
        <span class="node ${n.key ? statusClass(rs[n.key]) : n.later ? 's-none' : 's-cc'}">${esc(n.no || '◎')}</span>
        <span class="stop-t"><b>${esc(n.label)}</b><small>${esc(n.key ? rs[n.key] : n.sub)}</small></span></a>`).join('')}
    </nav>
    <nav class="tools" aria-label="Công cụ">${TOOLS.map((t) => `<a href="#${t.id}" class="${S.view === t.id ? 'on' : ''}">${esc(t.label)}</a>`).join('')}</nav>
    <div class="ver">${esc(APP_VERSION)}</div>`;
  const hp = $('#hdr-period');
  if (hp) hp.innerHTML = S.periods.map((p) => `<option ${p === S.period ? 'selected' : ''}>${p}</option>`).join('');
  const u = store.cloud.user;
  $('#account').innerHTML = !store.cloud.enabled ? (store.SANDBOX ? '<span class="muted">Sandbox (thử nghiệm)</span>' : '<span class="muted">Chế độ offline</span>')
    : u ? `<span class="who" title="${esc(u.email)}">${esc(u.displayName || u.email)} · ${esc(store.ROLES[store.cloud.role] || '')}</span><button class="btn ghost sm" data-act="signout" type="button">Đăng xuất</button>`
      : `<button class="btn sm" data-act="signin" type="button" ${store.cloud.ready ? '' : 'disabled'}>Đăng nhập Google</button>`;
  renderSync();
}

function render() {
  if (store.needsSignIn() || (store.cloud.enabled && !store.cloud.user && !store.cloud.offline)) {
    $('#rail').innerHTML = `<div class="ver">${esc(APP_VERSION)}</div>`;
    $('#account').innerHTML = `<button class="btn sm" data-act="signin" type="button" ${store.cloud.ready ? '' : 'disabled'}>Đăng nhập Google</button>`;
    renderSync();
    app().innerHTML = `<section class="page"><h1>Đăng nhập để dùng SVL Costing</h1><p class="lead">Dữ liệu giá thành chỉ hiển thị cho tài khoản đã được cấp quyền.</p>
      <div class="card"><p>${store.cloud.ready ? 'Bấm <b>Đăng nhập Google</b> ở góc trên bên phải.' : 'Đang kết nối…'}</p>${store.cloud.error ? `<p class="err">${esc(store.cloud.error)}</p>` : ''}</div></section>`;
    return;
  }
  renderShell();
  const view = VIEWS[S.view] || VIEWS.cc;
  if (!S.period && S.view !== 'settings') { app().innerHTML = viewWelcome(); return; }
  app().innerHTML = '';
  view(app());
  cardTables(app());
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
VIEWS.p3b = (el) => P2.view3b(el);
VIEWS.sales = (el) => P2.viewSales(el);
VIEWS.gl = (el) => P2.viewGL(el);
VIEWS.step4 = (el) => P2.view4(el);
VIEWS.fgopen = (el) => P3.viewOpen(el);
VIEWS.step5 = (el) => P3.viewFIFO(el);
VIEWS.close = (el) => P3.viewClose(el);
VIEWS.trace = (el) => TRV.viewTrace(el);

const driftHTML = () => ((S.prevDrift || []).length ? `<div class="alert block"><b>Số dư đầu kỳ cần chuyển lại</b><ul>${S.prevDrift.map((m) => `<li>${esc(m)}</li>`).join('')}</ul><a href="#opening">Mở Opening WIP → Roll forward</a></div>` : '');
VIEWS.cc = (el) => {
  const st = statusAll(); const rs = railStatus(st); const s2 = S.d.step2, s3 = S.d.step3;
  const steps = [
    ['1.0', 'Import ERP', st.s1c.result, `${st.s1c.coreReady} báo cáo`, st.s1.latestImport, st.s1c.next, 'step1'],
    ['2.0', 'Phân bổ Stock Out', st.s2c.status, s2 ? fmtNum(s2.total.alloc) : '', s2 && s2.runAt, st.s2c.next, 'step2'],
    ['2.B', 'Sổ FG Rework', railStatus(st).rw, S.d.register ? `${S.d.register.stats.rows} dòng · SL ${fmtNum(S.d.register.stats.issueQty)}` : '', S.d.register && S.d.register.refreshedAt, '', 'rework'],
    ['3.0', 'Material WIP (3A)', st.s3c.status, s3 ? fmtNum(s3.summary.closingAmt) : '', s3 && s3.runAt, st.s3c.next, 'step3'],
    ['3.B', 'Điều chỉnh WIP trực tiếp', st.s3bc.status, st.p2.d3b ? fmtNum(st.p2.d3b.wf.finalClosing) : '', S.d.wipadj && S.d.wipadj.control && (S.d.wipadj.control.appliedAt || S.d.wipadj.control.builtAt), st.s3bc.next, 'p3b'],
    ['4.1', 'Doanh thu & Price Master', rs.pm, S.d.pm ? `${S.d.pm.rows.length} sản phẩm` : '', S.d.pm && S.d.pm.updatedAt, S.d.pm ? '' : 'Import doanh thu → Validate & Save → Update Price Master', 'sales'],
    ['4.2', 'FX / GL 622-627', rs.gl, S.d.gl && S.d.gl.period === S.period ? `FX ${fmtNum(num(S.d.gl.fx), 2)}` : '', S.d.gl && S.d.gl.updatedAt, rs.gl === 'PASS' ? '' : 'Nhập tỷ giá, GL 622, GL 627 của kỳ', 'gl'],
    ['4.3', 'Phân bổ giá thành', st.s4c.status, st.p2.d4 && st.p2.d4.fl ? fmtNum(st.p2.d4.fl.totals.totalCost) : '', S.d.step4 && S.d.step4.runAt, st.s4c.next, 'step4'],
    ['5.1', 'FG đầu kỳ', rs.s5o, S.d.fgOpen && S.d.fgOpen.stats ? fmtNum(S.d.fgOpen.stats.amt) : '', S.d.fgOpen && (S.d.fgOpen.validatedAt || S.d.fgOpen.loadedAt), S.d.fgOpen ? '' : 'Roll forward / import FG đầu kỳ', 'fgopen'],
    ['5.2', 'FIFO giá vốn & rework', rs.s5, st.d5 && st.d5.res ? fmtNum(st.d5.res.totals.cogsA) : '', st.d5 && st.d5.res && st.d5.res.runAt, st.s5c.next, 'step5'],
    ['5.3', 'FG History & đóng kỳ', rs.s5c, st.d5 && st.d5.res ? st.d5.recon.finalStatus : '', S.d.closed && S.d.closed.period === S.period ? S.d.closed.closedAt : S.d.fgHistory && S.d.fgHistory.builtAt, S.d.closed && S.d.closed.period === S.period ? '' : st.d5 && st.d5.res ? (st.d5.closeReason || 'CLOSE MONTH') : '', 'close'],
  ];
  const next = steps.find((x) => !String(x[2]).startsWith('PASS') && x[2] !== 'CLOSED');
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>Tổng quan kỳ ${esc(S.period)}</h1><p class="lead">Chạy lần lượt từng bước; mỗi bước chỉ đi tiếp khi các checkpoint không còn BLOCK.</p></div>
      <div class="next"><span>Việc tiếp theo</span><b>${next ? `<a href="#${next[6]}">${esc(next[1])}</a> — ${esc(next[5] || 'xem checkpoint')}` : (S.d.closed && S.d.closed.period === S.period ? `Kỳ đã đóng. Tạo kỳ ${esc(nextPeriod(S.period))} và roll forward.` : 'Tất cả các bước đã PASS – CLOSE MONTH.')}</b></div></header>
    ${driftHTML()}
    <div class="kpis">
      ${kpi('Opening WIP', S.d.opening && S.d.opening.stats ? S.d.opening.stats.totalAmt : null)}
      ${kpi('WIP vào (MI + Stock Out)', s3 ? s3.summary.inAmt : null)}
      ${kpi('WIP ra (PC + MR + Stock Out)', s3 ? s3.summary.outAmt : null)}
      ${kpi('Closing WIP ERP', s3 ? s3.summary.closingAmt : null)}
      ${kpi('Closing WIP cuối (sau 3B)', st.p2.d3b ? st.p2.d3b.wf.finalClosing : null, true)}
      ${kpi('Giá thành SX (STEP 4)', st.p2.d4 && st.p2.d4.fl ? st.p2.d4.fl.totals.totalCost : null, true)}
      ${kpi('Giá vốn FIFO (STEP 5)', st.d5 && st.d5.res ? st.d5.res.totals.cogsA : null, true)}
      ${kpi('FG cuối kỳ', st.d5 && st.d5.res ? st.d5.res.totals.closeA : null)}
    </div>
    <h2>Quy trình tháng</h2>
    <ol class="steplist">${steps.map((x) => `<li><a href="#${x[6]}"><span class="node ${statusClass(x[2])}">${esc(x[0])}</span><span class="sl-t"><b>${esc(x[1])}</b><small>${esc(x[3] || '')}${x[5] ? ` · ${esc(x[5])}` : ''}</small></span>${pill(x[2])}</a></li>`).join('')}</ol>
    <table class="cp steptable"><thead><tr><th>Bước</th><th>Quy trình</th><th>Trạng thái</th><th class="r">Giá trị</th><th>Cập nhật</th><th>Việc tiếp theo</th></tr></thead><tbody>
    ${steps.map((x) => `<tr><td>${x[0]}</td><td><a href="#${x[6]}">${esc(x[1])}</a></td><td>${pill(x[2])}</td><td class="r">${esc(x[3])}</td><td>${fmtTs(x[4])}</td><td class="muted">${esc(x[5])}</td></tr>`).join('')}
    </tbody></table>
    <div>
      <details class="cpd" ${cpOpen(st.s2c.status)}><summary><h2>STEP 2 — checkpoint <small>${st.s2c.okText} · ${pill(st.s2c.status)}</small></h2></summary>${st.s2c.rows.length ? cpTable(st.s2c.rows) : emptyNote('Chưa chạy STEP 2.', 'step2', 'Mở STEP 2')}</details>
      <details class="cpd" ${cpOpen(st.s3c.status)}><summary><h2>STEP 3A — checkpoint <small>${st.s3c.okText} · ${pill(st.s3c.status)}</small></h2></summary>${cpTable(st.s3c.rows)}</details>
      ${st.s3bc.rows.length ? `<details class="cpd" ${cpOpen(st.s3bc.status)}><summary><h2>STEP 3B — checkpoint <small>${st.s3bc.okText} · ${pill(st.s3bc.status)}</small></h2></summary>${cpTable(st.s3bc.rows)}</details>` : ''}
      ${st.s4c.rows.length ? `<details class="cpd" ${cpOpen(st.s4c.status)}><summary><h2>STEP 4 — checkpoint <small>${st.s4c.okText} · ${pill(st.s4c.status)}</small></h2></summary>${cpTable(st.s4c.rows)}</details>` : ''}
      ${st.s5c.rows.length ? `<details class="cpd" ${cpOpen(st.s5c.status)}><summary><h2>STEP 5 — checkpoint <small>${st.s5c.okText} · ${pill(st.s5c.status)}</small></h2></summary>${cpTable(st.s5c.rows)}</details>` : ''}
    </div>
    ${journal(st)}
  </section>`;
};
function kpi(label, val, strong) {
  return `<div class="kpi ${strong ? 'strong' : ''}"><span>${esc(label)}</span><b>${val === null || val === undefined ? '—' : fmtNum(val)}</b><small>VND</small></div>`;
}
function emptyNote(msg, href, cta) { return `<div class="empty"><p>${esc(msg)}</p>${href ? `<a class="btn" href="#${href}">${esc(cta)}</a>` : ''}</div>`; }
function journal(st) {
  const s3 = S.d.step3; if (!s3) return '';
  const S3 = s3.summary;
  const je = [['JE01', '154', '152', 'Xuất NVL vào WIP – MI', S3.miAmt], ['JE02', '154', '152', 'Xuất NVL vào WIP – Stock Out', S3.soAmt], ['JE05', '152', '154', 'Nhập lại NVL từ WIP – MR', S3.mrAmt]];
  const s4 = S.d.step4, fl = st && st.p2.d4 && st.p2.d4.fl;
  if (s4 && !s4.blocked) je.push(['JE03', '154', '622', 'Kết chuyển nhân công trực tiếp', s4.alloc622], ['JE04', '154', '627', 'Kết chuyển chi phí SX chung', s4.alloc627]);
  if (fl) je.push(['JE06', '155', '154', 'Nhập kho thành phẩm theo giá thành STEP 4', fl.totals.totalCost]);
  const r5 = st && st.d5 && st.d5.res;
  if (r5) je.push(['JE07', '632', '155', 'Giá vốn hàng bán theo FIFO', r5.totals.cogsA]);
  if (r5 && r5.rework) je.push(['JE08', '154', '155', 'FG xuất đi rework (giá trị FIFO)', r5.rework.fifoCost]);
  return `<h2>Bút toán đề xuất</h2><table class="cp"><thead><tr><th>JE</th><th>Nợ</th><th>Có</th><th>Diễn giải</th><th class="r">Số tiền (VND)</th></tr></thead><tbody>
    ${je.map((j) => `<tr><td>${j[0]}</td><td>${j[1]}</td><td>${j[2]}</td><td>${esc(j[3])}</td><td class="r">${fmtNum(j[4])}</td></tr>`).join('')}</tbody></table>
    <p class="muted">Bút toán đề xuất để hạch toán trên FAST; doanh thu (131/511) đã ghi nhận trên FAST nên không lặp lại ở đây.</p>`;
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
    ${c.dateIssues && c.dateIssues.length ? `<div class="alert review"><b>Có dòng ngày ngoài kỳ ${esc(S.period)}</b> – kiểm tra file xuất ERP trước khi chạy STEP 2:<ul>${c.dateIssues.map((x) => `<li>${esc(x.key)}: ${fmtNum(x.n)} dòng (${esc(x.months.join(', '))})${x.amt ? ` · ${fmtNum(x.amt)} VND` : ''}</li>`).join('')}</ul></div>` : ''}
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
  if (!guardMutate()) return;
  const plan = planImport(files.map((f) => ({ name: f.name, lastModified: f.lastModified, file: f })), S.period);
  const planEl = $('#plan');
  if (plan.error) { planEl.innerHTML = `<div class="alert block"><b>Import bị chặn.</b> ${esc(plan.error)}</div>`; return; }
  if (plan.noToken && plan.noToken.length) toast(`${plan.noToken.length} file không có kỳ (YYMM) trong tên: ${plan.noToken.slice(0, 3).join(', ')}${plan.noToken.length > 3 ? '…' : ''}. Hệ thống sẽ kiểm tra ngày từng dòng sau khi import.`, 'review');
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
    <div class="row"><button class="btn" data-act="run-step2" type="button">Chạy STEP 2</button>${s2 ? `<span class="muted">Lần chạy gần nhất ${fmtTs(s2.runAt)}</span>` : ''}${s2 && st.s2c.rows.some((r) => String(r.status).startsWith('BLOCK - APPROVAL')) ? `<button class="btn danger ghost" data-act="approve-step2-fallback" type="button" ${store.isAdmin() ? '' : 'disabled'}>Xác nhận fallback &gt;5%</button>` : ''}</div>
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
  const periodIssues = outOfPeriodRows(S.d.datasets, S.period);
  if (periodIssues.length) {
    const sample = periodIssues.slice(0, 3).map((x) => {
      const p = []; if (x.outside) p.push(`ngoài kỳ ${x.outside}`); if (x.blank) p.push(`trống ngày ${x.blank}`); if (x.invalid) p.push(`ngày lỗi ${x.invalid}`); if (x.missingDateColumn) p.push(`thiếu cột Date ${x.missingDateColumn}`);
      return `${x.key}: ${p.join(', ')}${x.months && x.months.length ? ' [' + x.months.join(', ') + ']' : ''}`;
    }).join('; ');
    toast(`STEP 2 bị chặn bởi kiểm soát ngày ERP kỳ ${S.period}. ${sample}${periodIssues.length > 3 ? '…' : ''}. Sửa / xuất lại báo cáo rồi import lại.`, 'block');
    return;
  }
  try {
    const s2 = runStep2(S.d.datasets, S.period);
    S.d.step2 = s2;
    const bf = S.d.register ? S.d.register.rows.filter((r) => r.active === 'B/F').map(bfFromRow) : (S.d.bfSeed || []);
    const bfSrc = S.d.register ? S.d.register.bfSrc : null;
    S.d.register = buildReworkRegister(S.d.datasets, S.period, S.d.register ? S.d.register.rows : [], bf);
    if (bfSrc) S.d.register.bfSrc = bfSrc;
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
    <header class="ph"><div><h1>STEP 2B · Sổ FG Stock Out / Rework</h1><p class="lead">FG xuất kho đi rework không phải tiêu hao NVL. Cập nhật loại, trạng thái và lô PC rework ở đây; dữ liệu nhập tay được giữ khi chạy lại STEP 2. Giá trị FIFO được tính khi chạy STEP 5.2 (FIFO rework).</p></div>
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
    onEdit: !canEditPeriod() ? undefined : (row, k, val) => {
      if (k === 'compDate') row[k] = val ? ((Date.UTC(+val.slice(0, 4), +val.slice(5, 7) - 1, +val.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000) : null;
      else if (['compQty', 'scrapQty'].includes(k)) { const v = parseNum(val, k); if (v === undefined) return; row[k] = v; }
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
    ${driftHTML().replace(/<a href="#opening">.*?<\/a>/, '')}
    ${op && op.src ? `<p class="muted">Nguồn: Closing WIP ${esc(op.src.period)} ${op.src.closedAt ? `(đã đóng ${fmtTs(op.src.closedAt)})` : `– <b>kỳ ${esc(op.src.period)} chưa đóng khi chuyển</b>; lý do: ${esc(op.src.reason)}`} · chuyển lúc ${fmtTs(op.src.at)}</p>` : ''}
    <div class="row">
      <button class="btn" data-act="roll-wip" type="button">Roll forward từ ${esc(prev)} (WIP + Rework B/F)</button>
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
const kpiN = (label, n) => `<div class="kpi"><span>${esc(label)}</span><b>${n === undefined || n === null ? '—' : typeof n === 'string' ? esc(n) : fmtNum(n)}</b></div>`;

async function importOpening(file) {
  if (!file || !guardMutate()) return;
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
// ---------- inter-period roll-forward (audit F-06) ----------
const isClosedIn = (d, p) => !!(d && d.closed && d.closed.period === p);
/** Rework WIP the previous period hands over: the close-time archive when it is CLOSED, else its live register. */
function bfRowsOf(prevD, prevP) {
  if (isClosedIn(prevD, prevP) && Array.isArray(prevD.rwArchive)) return prevD.rwArchive.map((a) => ({ ...a, originPeriod: a.originPeriod || prevP }));
  return ((prevD && prevD.register && prevD.register.rows) || []).filter((r) => (r.active === 'Y' || r.active === 'B/F') && num(r.closingWIP) > 1)
    .map((r) => ({ ...bfFromRow(r), bfQty: r.active === 'B/F' ? r.bfQty : r.fifoQty, carryCost: num(r.closingWIP), originPeriod: r.active === 'B/F' ? r.originPeriod : r.period || prevP }));
}
const wipFp = (s3) => (s3 ? fpRows(openingFromClosing(s3, '').rows, (r) => `${ttxt(r.code).toUpperCase()}|${num(r.qty).toFixed(4)}|${num(r.amt).toFixed(0)}`) : '');
const bfFp = (rows) => fpRows(rows, (r) => `${r.rid}|${num(r.bfQty).toFixed(4)}|${num(r.carryCost).toFixed(0)}`);
const srcStamp = (prevD, prevP, reason) => ({ period: prevP, closedAt: isClosedIn(prevD, prevP) ? prevD.closed.closedAt : '', step3RunAt: prevD && prevD.step3 ? prevD.step3.runAt : '', wipFp: wipFp(prevD && prevD.step3), bfFp: bfFp(bfRowsOf(prevD, prevP)), reason: reason || '', at: nowISO() });
/** Ask for a reason when the previous period is still open; '' = do not roll. */
function openRollReason(prevD, prevP) {
  if (isClosedIn(prevD, prevP)) return 'CLOSED';
  return (prompt(`Kỳ ${prevP} CHƯA ĐÓNG. Số dư chuyển sang có thể còn thay đổi.\nNhập lý do để vẫn chuyển tạm Closing WIP / Rework WIP (bỏ trống = không chuyển; roll lại sau khi đóng kỳ ${prevP}):`) || '').trim();
}
/** Opening WIP (+ Rework B/F if the register has none yet) of S.period from the previous period's data. */
function rollFromPrev(prevD, prevP, reason, { wip = true, bf = true, replaceBF = false } = {}) {
  const stamp = srcStamp(prevD, prevP, reason === 'CLOSED' ? '' : reason);
  const done = [];
  if (wip && prevD.step3) {
    const op = openingFromClosing(prevD.step3, S.period); op.src = stamp;
    validateOpening(op, S.d.datasets, S.period); S.d.opening = op; done.push('opening');
    audit('OPENING WIP ROLL FORWARD', `Closing WIP ${prevP}${stamp.closedAt ? ' (CLOSED)' : ' (CHƯA ĐÓNG – lý do: ' + stamp.reason + ')'} → Opening ${S.period} · ${fmtNum(op.rows.reduce((a, r) => a + num(r.amt), 0))} VND`);
  }
  const rows = bf ? bfRowsOf(prevD, prevP) : [];
  const hasBF = !!(S.d.register && S.d.register.rows.some((r) => r.active === 'B/F'));
  const sameBF = hasBF && S.d.register.bfSrc && S.d.register.bfSrc.bfFp === stamp.bfFp;
  if (bf && (rows.length || hasBF) && !sameBF && (!hasBF || replaceBF)) {
    const base = S.d.register ? S.d.register.rows.filter((r) => r.active !== 'B/F') : [];
    if (S.d.step2) S.d.register = buildReworkRegister(S.d.datasets, S.period, base, rows);
    else S.d.register = { period: S.period, refreshedAt: '', rows: rows.map((b) => ({ active: 'B/F', ...b, bfCost: b.carryCost, closingWIP: b.carryCost, fifoStatus: 'OPENING B/F', rowSource: 'OPENING B/F' })), stats: { rows: 0, issueQty: 0, erpRef: 0, bfRows: rows.length, bfCost: rows.reduce((a, b) => a + b.carryCost, 0) } };
    S.d.register.bfSrc = stamp; S.d.bfSeed = rows; done.push('register');
    audit('REWORK WIP B/F', `${hasBF ? 'Thay B/F: ' : ''}${rows.length} dòng / ${fmtNum(rows.reduce((a, b) => a + num(b.carryCost), 0))} VND từ ${stamp.closedAt ? 'archive đóng kỳ' : 'register chưa đóng'} ${prevP}`);
  }
  if (done.length) markDirty(...done, 'audit');
  return done;
}
async function rollWIP() {
  const prev = prevPeriod(S.period);
  const prevD = await loadPeriodData(prev);
  if (!prevD || !prevD.step3) { toast(`Chưa có Material WIP (STEP 3) của kỳ ${prev}. Hãy import Opening WIP từ file.`, 'block'); return; }
  if (nextPeriod(prevD.step3.period) !== S.period) { toast(`Closing WIP hiện có là kỳ ${prevD.step3.period}, không phải kỳ liền trước.`, 'block'); return; }
  const reason = openRollReason(prevD, prev);
  if (!reason) { toast('Không chuyển số dư.', 'review'); return; }
  const done = rollFromPrev(prevD, prev, reason, { replaceBF: true });
  S.prevDrift = [];
  toast(`Đã roll forward từ kỳ ${prev}${reason === 'CLOSED' ? '' : ' (kỳ trước chưa đóng)'}: ${done.includes('opening') ? 'Opening WIP' : ''}${done.includes('register') ? ' + Rework WIP B/F' : ''}.`, reason === 'CLOSED' ? 'pass' : 'review');
  render(); checkPrevDrift();
}
/** Has the previous period changed since its balances were rolled into this one? (sets S.prevDrift) */
async function checkPrevDrift() {
  const out = [];
  const op = S.d.opening && S.d.opening.src, bs = S.d.register && S.d.register.bfSrc;
  const p = (op && op.period) || (bs && bs.period);
  if (p) {
    try {
      const prevD = await loadPeriodData(p);
      if (op && wipFp(prevD.step3) !== op.wipFp) out.push(`Closing WIP kỳ ${p} đã thay đổi sau khi chuyển sang Opening WIP kỳ ${S.period} – roll forward lại.`);
      else if (op && !op.closedAt && isClosedIn(prevD, p)) out.push(`Opening WIP được chuyển khi kỳ ${p} chưa đóng; kỳ ${p} nay đã đóng – roll forward lại để dùng số chính thức.`);
      if (bs && bfFp(bfRowsOf(prevD, p)) !== bs.bfFp) out.push(`Rework WIP cuối kỳ ${p} khác số đã chuyển sang B/F kỳ ${S.period}${isClosedIn(prevD, p) ? '' : ' (kỳ trước chưa đóng)'}.`);
    } catch { /* previous period not available on this device */ }
  }
  const changed = JSON.stringify(out) !== JSON.stringify(S.prevDrift || []);
  S.prevDrift = out;
  if (changed) render();
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
    const c2 = step2Controls({ period: S.period, step2: S.d.step2, register: S.d.register, latestImport: s1.latestImport });
    if (String(c2.status).startsWith('BLOCK')) throw new Error('STEP 2 còn checkpoint BLOCK. Xử lý/duyệt fallback trước khi chạy STEP 3.');
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
  if (store.cloud.user) {
    $('#t-audit').insertAdjacentHTML('beforebegin', '<div class="row"><button class="btn ghost" type="button" id="b-caudit">Xem nhật ký cloud (không sửa / xoá được)</button><span class="muted">Bảng dưới là nhật ký lưu cùng dữ liệu kỳ (500 dòng gần nhất).</span></div><div id="t-caudit"></div>');
    $('#b-caudit').addEventListener('click', async () => {
      try {
        const btn = $('#b-caudit'); btn.disabled = true;
        const { rows, truncated } = await store.cloudAuditList(S.period, { onProgress: (n) => { btn.textContent = `Đang tải nhật ký cloud… ${n}`; } });
        btn.disabled = false; btn.textContent = `Nhật ký cloud: ${rows.length} sự kiện${truncated ? ' (dừng ở giới hạn 20.000 – xuất Excel theo từng đợt)' : ' (đầy đủ)'}`;
        const c2 = [{ key: 'serverAt', label: 'Thời điểm (server)', type: 'ts', width: 160 }, { key: 'by', label: 'Người dùng', width: 200 }, { key: 'role', label: 'Vai trò', width: 80 }, { key: 'action', label: 'Hành động', width: 260 }, { key: 'detail', label: 'Chi tiết', width: 520 }, { key: 'app', label: 'Phiên bản', width: 200 }];
        mountTable($('#t-caudit'), { columns: c2, rows, height: 420, onExport: exportTable('AUDIT_CLOUD', c2) });
      } catch (e) { toast('Không đọc được nhật ký cloud: ' + e.message, 'block'); }
    });
  }
};

// ---------- settings / migration ----------
VIEWS.settings = (el) => {
  const c = store.cloud;
  el.innerHTML = `<section class="page"><header class="ph"><div><h1>Kỳ, cloud &amp; chuyển đổi</h1></div></header>
    ${installCard()}
    <div class="grid2">
      <div class="card"><h2>Nạp một kỳ từ file Costing Master (.xlsm)</h2>
        <p>Đọc 21 sheet ERP, WIP_OPENING và sổ 03_FG_REWORK_INPUT (giữ dữ liệu nhập tay) từ file Excel, rồi chạy lại STEP 2–3A trên web và đối chiếu với kết quả trong file.</p>
        <label class="btn">Chọn file .xlsm…<input type="file" id="f-xlsm" accept=".xlsm,.xlsx" hidden></label>
        <div id="mig"></div></div>
      <div class="card"><h2>Đồng bộ cloud</h2>
        ${!c.enabled ? '<p>Chưa cấu hình Firebase — dữ liệu chỉ nằm trong trình duyệt này.</p>' : c.user ? `<p>Đăng nhập: <b>${esc(c.user.email)}</b> · vai trò <b>${esc(store.ROLES[c.role] || '')}</b>${c.isOwner ? ' (chủ sở hữu)' : ''}. ${store.canEdit() ? 'Mọi thay đổi được tự động lưu lên Firestore (đã nén).' : 'Bạn chỉ xem được dữ liệu, không lưu thay đổi lên cloud.'}</p><div class="row"><button class="btn ghost" data-act="push-cloud" type="button">Lưu kỳ này lên cloud ngay</button><button class="btn ghost" data-act="pull-cloud" type="button">Tải lại kỳ này từ cloud</button></div>` : `<p>Đăng nhập Google để lưu và mở dữ liệu trên mọi máy. ${c.error ? `<span class="err">${esc(c.error)}</span>` : ''}</p>`}
        <h2>Kỳ hiện có</h2><ul class="plist">${S.periods.map((p) => `<li><a href="#cc" data-act="goto-period" data-p="${p}">${p}</a>${p === S.period ? ' (đang mở)' : ''}</li>`).join('')}</ul>
        <div class="row"><button class="btn ghost" data-act="new-period" type="button">Tạo kỳ mới…</button><button class="btn ghost" data-act="export-all" type="button">Xuất kết quả kỳ ra Excel</button>
        ${S.period && store.isAdmin() && !S.d.closedEver ? `<button class="btn danger ghost" data-act="delete-period" type="button">Xoá kỳ ${esc(S.period)}…</button>` : S.period && S.d.closedEver ? '<span class="muted">Kỳ đã từng CLOSED → hồ sơ lưu trữ, không hard-delete.</span>' : ''}
        <button class="btn ghost" data-act="clear-local" type="button">Xoá dữ liệu trên máy này…</button></div></div>
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
  const extra = ['00_CONTROL_CENTER', 'WIP_OPENING', '03_FG_REWORK_INPUT', '03_STOCK_OUT_ALLOCATION', '03_WIP_ALLOCATION', ...P2.PHASE2_SHEETS, ...P3.PHASE3_SHEETS];
  let report = '';
  await busy(`Đang đọc ${file.name} (file lớn có thể mất 10–30 giây)…`, async () => {
    try {
      const res = await parseFile(await file.arrayBuffer(), 'all', [...erpSheets, ...extra]);
      const g = res.grids; const cc = g['00_CONTROL_CENTER'];
      if (!cc) throw new Error('Không phải file SVL Costing Master (thiếu 00_CONTROL_CENTER).');
      const period = ttxt((cc[3] || [])[4]);
      if (!isPeriod(period)) throw new Error('Không đọc được kỳ báo cáo ở 00_CONTROL_CENTER!E4.');
      const tgt = period === S.period ? S.d : await loadLocal(period);
      if (tgt.closed && tgt.closed.period === period) throw new Error(`Kỳ ${period} trên web đã ĐÓNG – không ghi đè. Quản trị viên mở lại kỳ trước nếu thật sự cần.`);
      if (S.period !== period && !confirm(`File thuộc kỳ ${period}. Mở/ghi đè kỳ ${period} trên web?`)) return;
      if (store.cloud.user) { const m = await store.cloudMeta(period); if (m) await store.localSet(lk(period, 'cloudRev'), m.rev || 0); } // overwrite of the cloud copy is explicit here
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
      let p2msg = '';
      if (s3) {
        try { const m = P2.migratePhase2(g, S, period); cmp.push(...m.cmp); p2msg = m.msg; audit('STEP 3B + STEP 4 (sau chuyển đổi)', m.msg || 'OK'); } catch (e) { p2msg = 'STEP 3B/4: ' + e.message; }
        try { const m = await P3.migratePhase3(g, S, period); cmp.push(...m.cmp); p2msg = [p2msg, m.msg].filter(Boolean).join(' · '); audit('STEP 5 (sau chuyển đổi)', m.msg || 'OK'); } catch (e) { p2msg = [p2msg, 'STEP 5: ' + e.message].filter(Boolean).join(' · '); }
      }
      report = `<table class="cp"><thead><tr><th>Chỉ tiêu</th><th class="r">Web</th><th class="r">Excel</th><th class="r">Chênh lệch</th><th></th></tr></thead><tbody>${cmp.map(([l, a, b]) => {
        const d = typeof a === 'number' && typeof b === 'number' ? a - b : null;
        return `<tr><td>${esc(l)}</td><td class="r">${a === null || a === undefined ? '—' : fmtNum(a, Number.isInteger(a) ? 0 : 2)}</td><td class="r">${b === null || b === undefined ? "—" : fmtNum(b, Number.isInteger(b) ? 0 : 2)}</td><td class="r">${d === null ? '' : fmtNum(d, 2)}</td><td>${pill(d === null ? 'INFO' : Math.abs(d) < 1 ? 'PASS' : 'CHECK')}</td></tr>`;
      }).join('')}</tbody></table>${s3err ? `<div class="alert block">STEP 3: ${esc(s3err)}</div>` : ''}${p2msg ? `<div class="alert review">${esc(p2msg)}</div>` : ''}`;
      S.dirty = new Set(Object.keys(allBlobs()));
      await saveLocal(); if (store.cloud.enabled) await store.localSet(lk(period, 'unsynced'), true); scheduleCloud();
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
  const D = P2.derive(S);
  const tbl = (name, fields, headers, rows) => sheets.push({ name, aoa: [headers, ...rows.map((r) => fields.map((f) => r[f] ?? ''))] });
  if (S.d.wipadj && S.d.wipadj.control) {
    const cf = ['code', 'desc', 'erp', 'basisQty', 'basisAmt', 'method', 'nDetail', 'share', 'apc', 'adir', 'status', 'decision', 'note', 'gate', 'wipPostAmt', 'pcPostAmt', 'postCheck'];
    tbl('03_WIP_DIRECT_ADJ_CONTROL', cf, cf, S.d.wipadj.control.rows);
    if (D.d3b) { const wf = ['code', 'erp', 'erpSource', 'rule', 'adjQty', 'adjAmt', 'finalQty', 'finalAmt', 'postedPC', 'method', 'status']; tbl('03_WIP_FINAL', wf, wf, D.d3b.wf.rows); }
  }
  if (S.d.pm) tbl('04_PRICE_MASTER', P2.F.PM_FIELDS, P2.F.PM_HEADERS, S.d.pm.rows);
  if (D.d4 && D.d4.fl) tbl('04_COST_ALLOCATION', P2.F.CA_FIELDS, P2.F.CA_HEADERS, D.d4.fl.rows.map((r) => ({ ...r, date: typeof r.date === 'number' ? serialToISO(r.date) : r.date })));
  if (S.d.step4 && S.d.step4.recon) tbl('04_RECONCILIATION', ['label', 'expected', 'result', 'diff', 'status', 'note'], ['Control', 'Expected', 'Result', 'Difference', 'Status', 'Note'], S.d.step4.recon.rows);
  const r5 = S.d.step5 && S.d.step5.period === S.period ? S.d.step5 : null;
  if (S.d.fgOpen) tbl('05_FG_OPENING', P3.F5.LAYER_FIELDS, P3.F5.LAYER_HEADERS, S.d.fgOpen.rows);
  if (r5) {
    const dt = (rows, fs) => rows.map((r) => { const o = { ...r }; for (const f of fs) if (typeof o[f] === 'number') o[f] = serialToISO(o[f]); return o; });
    tbl('05_FG_LEDGER', P3.F5.LEDGER_FIELDS, P3.F5.LEDGER_HEADERS, dt(r5.ledger, ['date']));
    tbl('05_SALES_COGS', P3.F5.SALES_FIELDS, P3.F5.SALES_HEADERS, dt(r5.sales, ['date']));
    if (r5.returnRegister && r5.returnRegister.length) {
      const rf = ['seq', 'date', 'returnInv', 'customer', 'product', 'productName', 'originalInv', 'returnQty', 'cogsRM', 'cogs622', 'cogs627', 'cogsTotal', 'layerId', 'status', 'message'];
      const rh = ['Seq', 'Return Date', 'Return Invoice', 'Customer', 'Product', 'Product Name', 'Original Invoice', 'Return Qty', 'RM Reversal', '622 Reversal', '627 Reversal', 'COGS Reversal', 'Returned FG Layer', 'Status', 'Message'];
      tbl('05_SALES_RETURN', rf, rh, dt(r5.returnRegister, ['date']));
    }
    tbl('05_FIFO_DETAIL', P3.F5.DETAIL_FIELDS, P3.F5.DETAIL_HEADERS, dt(r5.detail, ['date']));
    if (r5.rework) tbl('05_FG_REWORK_FIFO', P3.F5.RWF_FIELDS, P3.F5.RWF_HEADERS, dt(r5.rework.rows, ['issueDate', 'layerDate']));
    tbl('05_FG_CLOSING', P3.F5.LAYER_FIELDS, P3.F5.LAYER_HEADERS, dt(r5.closing, ['date']));
    tbl('05_COGS_SUMMARY', P3.F5.SUM_FIELDS, P3.F5.SUM_HEADERS, r5.summary);
    if (r5.rollforward) tbl('05_FG_ROLLFORWARD', P3.F5.XNT_FIELDS, P3.F5.XNT_HEADERS, r5.rollforward.rows);
  }
  if (S.d.fgHistory) tbl('05_FG_HISTORY', P3.F5.HIST_FIELDS, P3.F5.HIST_HEADERS, S.d.fgHistory.rows.map((r) => ({ ...r, date: typeof r.date === 'number' ? serialToISO(r.date) : r.date })));
  if (!sheets.length) { toast('Chưa có kết quả để xuất.', 'review'); return; }
  await exportBook(`SVL_Costing_Web_${S.period}.xlsx`, sheets);
}

// ======================= actions =======================
async function newPeriod() {
  const sug = S.period ? nextPeriod(S.period) : '';
  const p = (prompt('Kỳ mới (YYYY-MM):', sug) || '').trim();
  if (!p) return;
  if (!isPeriod(p)) { toast('Kỳ phải có dạng YYYY-MM.', 'block'); return; }
  const adjP = S.period && nextPeriod(S.period) === p ? S.period : '';
  const adjD = adjP ? S.d : null;
  const prevD = S.period && S.period < p ? S.d : null;
  await openPeriod(p);
  if (adjD && (adjD.step3 || adjD.register) && !S.d.opening && !(S.d.register && S.d.register.rows.some((r) => r.active === 'B/F'))) {
    const reason = openRollReason(adjD, adjP);
    if (reason) rollFromPrev(adjD, adjP, reason);
    else toast(`Chưa chuyển Opening WIP / Rework B/F từ kỳ ${adjP} (chưa đóng). Dùng “Roll forward” ở STEP 3 sau khi đóng kỳ ${adjP}.`, 'review');
  }
  if (prevD) {
    const cf = { ...P2.carryForward(prevD, p), ...P3.carryForward(prevD, p) }; const took = [];
    for (const [k, val] of Object.entries(cf)) { const cur = S.d[k]; if (cur === null || cur === undefined || (Array.isArray(cur) && !cur.length)) { S.d[k] = val; took.push(k); } }
    if (took.length) { audit('CARRY FORWARD', `${S.period} ← ${took.join(', ')}`); markDirty(...took, 'audit'); }
  }
  S.view = 'cc'; location.hash = 'cc'; render();
}

document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (a.tagName === 'A') e.preventDefault();
  if (WRITE_ACTS.has(act) && !guardEdit()) return;
  if (P3.CLOSED_BLOCK.has(act) && isClosed()) { toast(`Kỳ ${S.period} đã đóng – không chạy lại được. Quản trị viên có thể mở lại kỳ ở màn hình 5.3.`, 'review'); return; }
  switch (act) {
    case 'signin': try { await store.signIn(); } catch (err) { toast('Đăng nhập lỗi: ' + err.message, 'block'); } break;
    case 'signout': {
      const uns = await unsyncedPeriods();
      const clear = confirm(uns.length
        ? `CẢNH BÁO: kỳ ${uns.join(', ')} còn thay đổi CHƯA đồng bộ lên cloud.\n\nOK = vẫn xoá dữ liệu trên máy này khi đăng xuất (mất các thay đổi đó).\nHuỷ = đăng xuất nhưng giữ dữ liệu trên máy.`
        : 'Xoá dữ liệu giá thành lưu trên máy này khi đăng xuất?\n(Nên chọn OK nếu là máy dùng chung. Dữ liệu trên cloud không bị ảnh hưởng.)');
      await store.signOut();
      if (clear) await clearLocal(true);
      render(); break;
    }
    case 'new-period': await newPeriod(); break;
    case 'run-step2': await busy('Đang chạy STEP 2…', async () => doStep2()); break;
    case 'approve-step2-fallback': {
      if (!store.isAdmin()) { toast('Chỉ Quản trị viên được xác nhận phân bổ fallback trọng yếu.', 'review'); break; }
      const s2 = S.d.step2; if (!s2) break;
      const amount = fallbackAlloc(s2), totalAlloc = num(s2.total && s2.total.alloc);
      const reason = (prompt(`Fallback rộng = ${fmtNum(amount)} VND (${totalAlloc ? (Math.abs(amount / totalAlloc) * 100).toFixed(1) : 0}% Stock Out đã phân bổ). Nhập lý do / bằng chứng review (bắt buộc):`, '') || '').trim();
      if (reason.length < 5) { toast('Cần lý do review ít nhất 5 ký tự.', 'review'); break; }
      s2.fallbackApproval = { amount, totalAlloc, by: store.cloud.user ? store.cloud.user.email : 'thiết bị này', at: nowISO(), reason };
      audit('STEP 2 FALLBACK APPROVAL', `${reason} · amount=${fmtNum(amount)} · ratio=${totalAlloc ? (Math.abs(amount / totalAlloc) * 100).toFixed(2) : 0}%`);
      markDirty('step2', 'audit'); render(); break;
    }
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
    case 'push-cloud': { const r = await pushCloud(); toast(r.ok ? `Đã lưu lên cloud (bản ${r.meta.rev}).` : (r.conflict ? 'KHÔNG ghi đè cloud: ' : 'Chưa lưu được lên cloud: ') + r.error, r.ok ? 'pass' : 'block'); break; }
    case 'clear-local': await clearLocal(false); break;
    case 'pull-cloud': await openPeriod(S.period, { preferCloud: true }); break;
    case 'export-all': await exportAll(); break;
    case '3b-sync': P2.do3bSync(); render(); break;
    case '3b-build': await busy('Đang BUILD STEP 3B…', async () => P2.do3bBuild()); render(); break;
    case '3b-apply': await busy('Đang APPLY STEP 3B…', async () => P2.do3bApply()); render(); break;
    case '3b-all': P2.do3bAll(a.dataset.dec); render(); break;
    case 'sales-save': await busy('Đang Validate & Save doanh thu…', async () => P2.doSalesSave()); render(); break;
    case 'pm-update': await busy('Đang cập nhật Price Master…', async () => P2.doPMUpdate()); render(); break;
    case 'run-step4': await busy('Đang chạy STEP 4…', async () => P2.doStep4()); render(); break;
    case 's5-roll': await P3.doRollOpen(); render(); break;
    case 's5-validate': P3.doValidateOpen(); render(); break;
    case 's5-template': await P3.doTemplate(); break;
    case 's5-run': await busy('Đang chạy FIFO COGS…', async () => P3.doRunFIFO()); render(); break;
    case 's5-hist': await busy('Đang tạo FG History…', async () => P3.doBuildHistory()); render(); break;
    case 's5-close': await P3.doClose(); render(); break;
    case 's5-reopen': await P3.doReopen(); render(); break;
    case 'delete-period':
      if (store.cloud.enabled && !store.isAdmin()) { toast('Chỉ quản trị viên được xoá kỳ.', 'review'); break; }
      if (S.d.closedEver) { toast(`Kỳ ${S.period} đã từng CLOSED nên là hồ sơ kế toán lưu trữ; không được hard-delete kể cả sau REOPEN.`, 'block'); break; }
      if (isClosed()) { toast(`Kỳ ${S.period} đang CLOSED và không được xoá.`, 'block'); break; }
      if (prompt(`Gõ ${S.period} để xoá toàn bộ dữ liệu kỳ OPEN này trên máy này${store.cloud.user ? ' và trên cloud' : ''}:`) === S.period) {
        for (const k of await store.localKeys()) if (String(k).startsWith(`p/${S.period}/`)) await store.localDel(k);
        await store.localSet('periods', ((await store.localGet('periods')) || []).filter((p) => p !== S.period));
        audit('DELETE PERIOD', `Xoá toàn bộ kỳ ${S.period}${store.cloud.user ? ' (máy này + cloud)' : ' (máy này)'}`);
        if (store.cloud.user) { try { await store.cloudDelete(S.period); } catch (err) { toast('Không xoá được trên cloud: ' + err.message, 'block'); break; } }
        toast(`Đã xoá kỳ ${S.period}.`, 'pass');
        await refreshPeriods(); S.period = S.periods[0] || ''; if (S.period) await openPeriod(S.period); else render();
      }
      break;
    default: break;
  }
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'period-sel' || e.target.id === 'hdr-period') await openPeriod(e.target.value);
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'f-new') { e.preventDefault(); const p = new FormData(e.target).get('p').trim(); if (!isPeriod(p)) { toast('Kỳ phải có dạng YYYY-MM.', 'block'); return; } await openPeriod(p); markDirty('audit'); }
});
/** '#view' or '#trace=PRODUCT' */
function routeFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const i = h.indexOf('=');
  if (i >= 0) { S.view = h.slice(0, i) || 'cc'; if (S.view === 'trace') S.traceProd = h.slice(i + 1); } else S.view = h || 'cc';
}
window.addEventListener('hashchange', () => { routeFromHash(); closeNav(); render(); window.scrollTo(0, 0); });

// ======================= installed app (PWA): drawer, install, update, offline =======================
const isPhone = () => matchMedia('(max-width: 699px)').matches;
/** Checkpoint sections stay open on larger screens; on phones only the ones that need attention are open. */
const cpOpen = (status) => (!isPhone() || !String(status).startsWith('PASS') ? 'open' : '');
/** Phone layout: checkpoint tables become label/value cards (labels taken from the table header). */
function cardTables(root) {
  for (const t of root.querySelectorAll('table.cp')) {
    if (t.classList.contains('el')) continue;
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    if (!heads.length) continue;
    t.classList.add('cards');
    for (const tr of t.querySelectorAll('tbody tr')) {
      const tds = [...tr.children];
      if (tds.length === 1) tr.classList.add('sep');
      tds.forEach((td, i) => {
        td.dataset.label = heads[i] || ''; const tx = td.textContent.trim();
        if ((!tx && !td.querySelector('select,input,button')) || (/^(Chênh lệch|Difference)$/i.test(heads[i] || '') && /^[–-]?$/.test(tx))) td.classList.add('empty');
      });
    }
  }
}
function closeNav() { document.body.classList.remove('nav-open'); const m = $('#menu'); if (m) m.setAttribute('aria-expanded', 'false'); const sc = $('#scrim'); if (sc) sc.hidden = true; }
$('#menu').addEventListener('click', () => {
  const open = !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open); $('#menu').setAttribute('aria-expanded', String(open)); $('#scrim').hidden = !open;
});
$('#scrim').addEventListener('click', closeNav);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
$('#rail').addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) closeNav(); });

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (S.view === 'settings') render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Đã cài SVL Costing lên thiết bị.', 'pass'); });
function installCard() {
  const img = '<img src="icons/icon-192.png" alt="">';
  if (isStandalone()) return `<div class="card install-card">${img}<div><b>Đang chạy như ứng dụng</b><div class="muted">Mở từ biểu tượng SVL Costing trên màn hình chính. Ứng dụng tự cập nhật khi có phiên bản mới.</div></div></div>`;
  if (installEvt) return `<div class="card install-card">${img}<div style="flex:1"><b>Cài SVL Costing lên máy</b><div class="muted">Có biểu tượng trên màn hình chính, mở toàn màn hình, xem được khi mất mạng.</div></div><button class="btn" data-act="install-app" type="button">Cài ứng dụng</button></div>`;
  if (isIOS()) return `<div class="card install-card">${img}<div><b>Cài lên iPhone / iPad</b><div class="muted">Mở trang này bằng <b>Safari</b> → bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) → <b>Thêm vào MH chính</b> → <b>Thêm</b>.</div></div></div>`;
  return `<div class="card install-card">${img}<div><b>Cài SVL Costing như ứng dụng</b><div class="muted">Android: mở bằng Chrome → menu ⋮ → <b>Cài đặt ứng dụng</b> (hoặc <b>Thêm vào màn hình chính</b>). Máy tính: biểu tượng cài đặt trên thanh địa chỉ Chrome / Edge.</div></div></div>`;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-act="install-app"]') || !installEvt) return;
  installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null;
  if (r.outcome !== 'accepted') toast('Đã huỷ cài đặt.', 'info');
  render();
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => {
      if (!w || !navigator.serviceWorker.controller || $('#update-bar')) return;
      const bar = document.createElement('div'); bar.id = 'update-bar'; bar.className = 'update-bar'; bar.setAttribute('role', 'status');
      bar.innerHTML = '<span>Đã có phiên bản mới của SVL Costing.</span><button class="btn sm" type="button">Cập nhật</button>';
      bar.querySelector('button').addEventListener('click', async () => { await saveChain; w.postMessage('skip-waiting'); });
      document.body.appendChild(bar);
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((err) => console.warn('SW', err));
  // reload only when an installed app switches to a new version (not on the very first install)
  let reloading = false; const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
}
window.addEventListener('online', () => { renderSync(); toast('Đã có mạng trở lại.', 'pass'); if (store.cloud.user) scheduleCloud(); });
window.addEventListener('offline', () => { renderSync(); toast('Mất kết nối mạng – xem được dữ liệu trên máy, thay đổi sẽ đồng bộ khi có mạng.', 'review'); });

P2.install({ S, esc, pill, fmtNum, fmtTs, cpVal, cpTable, kpi, kpiN, emptyNote, mountTable, exportTable, markDirty, audit, toast, busy, parseFile, guardEdit: guardMutate, canEdit: canEditPeriod, isAdmin: () => store.isAdmin(), who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), parseNum, dupStatus: () => P3.dupStatus(S), render, derived: derivedNow, latestImport: () => step1Status(datasetsMeta()).latestImport });
TRV.install({ S, esc, pill, fmtNum, fmtTs, kpi, kpiN, emptyNote, mountTable, exportTable, exportBook, toast, render, derived: derivedNow, loadPeriodData });
P3.install({ cloudOn: () => !!store.cloud.user, syncNow, S, esc, pill, fmtNum, fmtTs, cpVal, cpTable, kpi, kpiN, emptyNote, mountTable, exportTable, exportBook, markDirty, audit, toast, busy, parseFile, guardEdit: guardMutate, canEdit: canEditPeriod, parseNum, isAdmin: () => store.isAdmin(), who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), render, derived: derivedNow, loadPeriodData });

// ======================= boot =======================
(async function boot() {
  routeFromHash();
  await refreshPeriods();
  const last = localStorage.getItem('svl.period');
  if (last && isPeriod(last)) await openPeriod(last); else if (S.periods[0]) await openPeriod(S.periods[0]); else render();
  if (store.cloud.enabled) {
    store.initCloud(async (u) => {
      renderShell();
      accessDraft = null;
      if (u) { await refreshPeriods(); if (S.period) await openPeriod(S.period); else if (S.periods[0]) await openPeriod(S.periods[0]); }
      else if (store.cloud.error) toast(store.cloud.error, 'review');
      render();
    });
  }
})();
