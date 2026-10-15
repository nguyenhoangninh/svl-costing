// SVL Costing Web — application shell (state, persistence, views)
import { ERPS, REPORTS, dsKey, isPeriod, nextPeriod, prevPeriod, num, txt, ttxt, utxt, nowISO, serialToISO, parseUserNumber, fpRows } from './engine/util.js';
import { buildDataset, planImport, step1Status } from './engine/step1.js';
import * as SP from './engine/syncpolicy.js';
import { runStep2, buildReworkRegister, step2Classification, recheckRegisterRow, stockOutLines, consSnap, consumeReconcile, STEP2_RULES, STEP2_DETAIL_HEADERS, RW_FIELDS, RW_HEADERS, confirmConsFg, undoConsFg, consFgEligible, consFgConfirmed, consFgPendingCount } from './engine/step2.js';
import { validateOpening, detectOpeningSource, openingFromSource, openingFromClosing, runStep3, WIP_HEADERS, step3Stale } from './engine/step3.js';
import { step1Controls, step2Controls, step3Controls, accessLimitedCount, outOfPeriodRows, fallbackAlloc } from './engine/controls.js';
import { mountTable, esc } from './ui/table.js';
import { fmtCell, fmtNum, fmtTs, statusClass } from './ui/format.js';
import * as store from './store.js';
import { APP_VERSION } from './config.js';
import * as I18N from './i18n.js';
import * as NT from './engine/notifications.js';
import { createNotificationUI } from './ui/notifications.js';
import * as P2 from './views/phase2.js';
import * as P3 from './views/phase3.js';
import * as PV from './views/provision.js';
import * as TRV from './views/trace.js';
import * as FGP from './views/fgprod.js';
import * as RWV from './views/rework.js';
import { step2ReportSheets, ruleSummary, ruleOf } from './engine/step2report.js';
import { materialIssueCosts, MATCOST_DEV, MATCOST_MIN_COST } from './engine/matcost.js';
// v1.14.46: ngưỡng bất thường của bảng đơn giá xuất NVL (chỉ ảnh hưởng hiển thị, không ảnh hưởng tính giá thành)
const MC_KEY = 'svl.matcostOpts';
function mcOpts() {
  try {
    const o = JSON.parse(localStorage.getItem(MC_KEY) || 'null');
    if (o && Number.isFinite(o.dev) && o.dev > 0 && Number.isFinite(o.minCost) && o.minCost >= 0) return { dev: o.dev, minCost: o.minCost };
  } catch { /* localStorage không dùng được: dùng mặc định */ }
  return { dev: MATCOST_DEV, minCost: MATCOST_MIN_COST };
}
function setMcOpts(o) { try { if (o) localStorage.setItem(MC_KEY, JSON.stringify(o)); else localStorage.removeItem(MC_KEY); } catch { /* bỏ qua */ } render(); }
import * as TPL from './engine/templates.js';
import * as DQ from './engine/dataquality.js';
import { exportStyledBook } from './ui/xlsxstyle.js';
import { pcBasisScan, applyPcBasis, undoPcBasis, pcBasisIntact } from './engine/pcbasis.js';
import { costAllocationSheet, fgLayerSheet, provisionTrackSheet, provisionJournalSheet } from './engine/exportform.js';
import { provisionTrack, provisionJournal } from './engine/provision.js';
import { customerPL, plSheetRows, PL_HEADERS, productPL, prodSheetRows, PROD_HEADERS } from './engine/custpl.js';
import { journalWithCustomers, journalCheck } from './engine/journal.js';
import * as DBV from './views/dashboard.js';

// ======================= state =======================
const BLOBS = ['importLog', 'importAck', 'step2', 'consumeCfg', 'consFg', 'register', 'opening', 'step3', 'audit', 'pcAdj', ...P2.PHASE2_BLOBS, ...P3.PHASE3_BLOBS, ...FGP.FGP_BLOBS, ...RWV.RWV_BLOBS, ...DBV.DASH_BLOBS];
const S = {
  period: '', periods: [], view: 'cc', busy: '',
  d: emptyData(), dirty: new Set(), sync: 'local', syncMsg: '',
  dsView: 'PC-P-T',
};
function emptyData() { return { datasets: {}, importLog: {}, importAck: null, step2: null, consumeCfg: null, consFg: null, register: null, opening: null, step3: null, audit: [], erpMap: null, wipadj: null, salesImport: null, salesDB: null, returnsImport: null, returnsDB: null, fgProd: null, rwCfg: null, soPrice: [], manualPrice: [], pm: null, gl: null, directAdj: [], step4: null, lotCheck: null, lotParams: null, fgRef: null, fgOpen: null, step5: null, fgHistory: null, fifoOverrides: null, s5cfg: null, fgItems: null, closed: null, closedEver: null, rwArchive: null, pcAdj: null, dashPlan: null }; }

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $('#main');
const notices = createNotificationUI({
  store, toast,
  navigate: async ({ period, view }) => {
    if (period && period !== S.period) await openPeriod(period);
    if (period && period !== S.period) return;
    const target = view || 'cc';
    if (location.hash === '#' + target) { S.view = target; render(); } else location.hash = target;
  },
});
let stopLivePeriod = null;
function showLiveConflict() {
  app()?.querySelector('#live-conflict')?.remove();
  if (!S.remoteConflict || !app()) return;
  const b = document.createElement('section');
  b.id = 'live-conflict'; b.className = 'live-conflict'; b.setAttribute('role', 'alert');
  b.innerHTML = `<p><b>Cloud có revision mới (#${esc(S.remoteConflict.rev)}).</b> ${esc(S.remoteConflict.updatedBy || 'Người dùng khác')} đã cập nhật kỳ ${esc(S.period)}${S.remoteConflict.closed ? ' và ĐÓNG KỲ' : ''}. Dữ liệu trên màn hình có thể đã cũ; hệ thống chặn chỉnh sửa để tránh ghi đè.</p>
    <button class="btn" data-act="refresh-remote" type="button">Kiểm tra & tải bản Cloud</button>`;
  app().prepend(b);
}
function stopPeriodWatch() { if (stopLivePeriod) stopLivePeriod(); stopLivePeriod = null; }
function startPeriodWatch(period) {
  stopPeriodWatch();
  if (!store.cloud.user || !period) return;
  const onMeta = async (meta, metadata) => {
    if (!meta || metadata.fromCache || period !== S.period) return;
    const rev = Number(meta.rev || 0);
    if (!rev) return;
    // Firestore may publish OUR commit while compression/upload + localRev persistence is
    // still in flight. Wait until the writer has finished; a fixed 900-ms delay is unsafe
    // for large costing periods and creates a false conflict against our own committed save.
    if (S.sync === 'saving') {
      setTimeout(() => { if (S.period === period) onMeta(meta, metadata).catch((e) => console.warn('Live sync check', e)); }, 1100);
      return;
    }
    if (period !== S.period) return;
    const localRev = Number((await store.localGet(lk(period, 'cloudRev'))) || 0);
    if (rev <= localRev) return;
    const alertKey = period + ':' + rev;
    if (S.remoteConflict && S.remoteConflict.key === alertKey) return;
    S.remoteConflict = { key: alertKey, rev, updatedBy: meta.updatedBy, closed: !!(meta.summary && meta.summary.closed) };
    S.sync = 'conflict'; S.syncMsg = 'Có bản Cloud mới hơn #' + rev + '. Cần kiểm tra trước khi tiếp tục.';
    clearTimeout(syncTimer); renderSync(); showLiveConflict();
    toast(`Kỳ ${period} có thay đổi trên Cloud (rev #${rev})${S.remoteConflict.closed ? ' – đã đóng kỳ' : ''}. Hãy tải phiên bản mới trước khi thao tác.`, 'block');
  };
  stopLivePeriod = store.watchPeriodMeta(period, onMeta, (e) => { console.warn('live period watch', e); });
}

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
const CLOSED_OK = new Set(['closed', 'closedEver', 'audit', 'rwArchive']);
/**
 * Persist mutated blobs of the open period. Each call captures its own dirty snapshot and saves are serialised, so a fast
 * second edit can never be cleared before it is written (F-13). Mutations of a CLOSED period are refused (F-02).
 */
function markDirty(...blobs) {
  const p = S.period; if (!p) return;
  // ERP datasets touched by import / delete are queued in S.dirty as 'ds:<key>' – persist (or delete) them in the same save,
  // otherwise a deleted report would come back from this device's storage on the next reload.
  if (S.dirty && S.dirty.size) { blobs = [...blobs, ...S.dirty]; S.dirty = new Set(); }
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
  clearTimeout(syncTimer); clearTimeout(retryTimer);
  syncTimer = setTimeout(autoPush, 1500);
}
/** ENH-07 (v1.14.36): a failed automatic push is retried with exponential backoff and never reported as SYNCED. */
let retryTimer = null, retryN = 0;
async function autoPush() {
  if (!S.period || !(await store.localGet(lk(S.period, 'unsynced')))) { retryN = 0; return; } // nothing waiting: no empty revision
  const r = await pushCloud();
  if (r.ok) { retryN = 0; clearTimeout(retryTimer); return; }
  if (r.conflict) { toast('Xung đột cloud: ' + r.error, 'block'); return; }
  retryN++;
  if (retryN === 1) toast('Chưa lưu được lên cloud: ' + r.error + ' – sẽ tự thử lại.', 'block');
  if (!SP.shouldRetry(retryN)) { toast('Chưa đồng bộ được sau nhiều lần thử. Bấm Đồng bộ khi có mạng.', 'block'); return; }
  clearTimeout(retryTimer);
  retryTimer = setTimeout(autoPush, SP.retryDelayMs(retryN));
}
/** Push now (no debounce) and report whether the cloud committed it. */
async function syncNow() { await saveChain; clearTimeout(syncTimer); return pushCloud(); }
let pushChain = Promise.resolve();
/** Cloud pushes run one at a time (a debounced push can never race a CLOSE / REOPEN push). */
function pushCloud() { const run = pushChain.then(pushCloudOnce, pushCloudOnce); pushChain = run.catch(() => {}); return run; }
/** Returns {ok, meta} or {ok:false, error, conflict}. Never reports success unless the cloud commit is confirmed (F-09). */
async function pushCloudOnce() {
  if (!store.cloud.user) return { ok: false, error: 'Chưa đăng nhập.' };
  if (!S.period) return { ok: false, error: 'Chưa chọn kỳ.' };
  if (!store.canEdit()) return { ok: false, error: 'Tài khoản chỉ có quyền xem.' };
  const p = S.period, data = S.d, seq = S.editSeq || 0;
  if (S.remoteConflict && S.remoteConflict.key.startsWith(p + ':')) {
    return { ok: false, conflict: true, error: 'Cloud đã có revision mới. Tải lại bản Cloud trước khi ghi.' };
  }
  const meta0 = await store.cloudMeta(p).catch(() => null);
  const cloudClosed = !!(meta0 && meta0.summary && meta0.summary.closed), localClosed = isClosed();
  if (cloudClosed && !store.isAdmin()) { S.sync = 'synced'; S.syncMsg = 'Kỳ đã đóng trên cloud – chỉ quản trị viên ghi được.'; renderSync(); return { ok: false, error: 'Kỳ đã đóng trên cloud; chỉ quản trị viên được ghi.' }; }
  if (cloudClosed && localClosed) {
    // CLOSED → CLOSED: the cloud record is immutable (rules). Local notes stay on this device; the audit trail is in svl_costing_audit.
    await store.localDel(lk(p, 'unsynced')); S.sync = 'synced'; S.syncMsg = 'Kỳ đã đóng – cloud giữ nguyên bản đóng kỳ.'; renderSync();
    return { ok: true, skipped: true };
  }
  const reopen = cloudClosed && !localClosed;
  try {
    S.sync = 'saving'; renderSync();
    await saveChain;
    let baseRev = await store.localGet(lk(p, 'cloudRev'));
    if (baseRev === undefined || baseRev === null) baseRev = (await store.localGet(lk(p, 'cloudAt'))) || null; // legacy device state
    const blobs = blobsOf(data);
    const live = summaryForCloud();
    // REOPEN changes only the 'closed' blob and summary.closed / everClosed. That is allowed by every published version of
    // firestore.rules (v1.10.0 did not allow summary.step5 to change in the REOPEN revision). The live step5 status follows
    // in the next normal save, which the rules allow once the period is OPEN.
    const summary = reopen ? { ...meta0.summary, closed: null, everClosed: true } : live;
    const notice = NT.buildCommitNotice({
      period: p, rev: (meta0 && meta0.rev || 0) + 1,
      actor: store.cloud.user.email, actorUid: store.cloud.user.uid, previous: meta0,
      summary, audit: data.audit, changed: true,
    });
    // v1.14.89 (audit AUD-01 / 09 / 10): a pending CLOSE / REOPEN of this period is committed with its transition id
    const tr = S.pendingTransition && S.pendingTransition.period === p ? S.pendingTransition : null;
    const meta = await store.cloudSave(p, blobs, summary, (m) => { S.syncMsg = m; renderSync(); }, baseRev,
      reopen ? { keepAllExcept: ['closed'], notice, transition: tr || undefined } : { notice, transition: tr || undefined });
    if (tr && S.pendingTransition === tr) S.pendingTransition = null;
    await store.localSet(lk(p, 'cloudRev'), meta.rev); await store.localSet(lk(p, 'cloudAt'), meta.updatedAt);
    if (meta.noticeDisabled && !S.noticeRuleWarned) {
      S.noticeRuleWarned = true;
      toast('Dữ liệu đã lên Cloud, nhưng chức năng chuông đang chờ cập nhật Firestore Rules. Đề nghị Admin kiểm tra việc publish rules.', 'review');
    }
    if ((S.editSeq || 0) === seq && !reopen) await store.localDel(lk(p, 'unsynced'));
    S.sync = (S.editSeq || 0) === seq && !reopen ? 'synced' : 'pending'; S.syncMsg = '';
    renderSync();
    if (S.sync === 'pending') scheduleCloud();
    return { ok: true, meta, writtenId: meta && meta.transition ? meta.transition.id : null };
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

/** v1.14.41 (maker–checker): receipts of a period; empty when signed out or unreadable. */
async function loadApprovals(p) {
  if (!store.cloud.user) return {};
  return store.cloudApprovals(p).catch(() => ({}));
}
/** Write one receipt for the open period, then reload them. Returns { ok, error } for the view. */
async function approvalWrite(op, payload) {
  try {
    await store.cloudWriteApproval(S.period, op, payload);
    S.approvals = await loadApprovals(S.period);
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}
async function openPeriod(p, { preferCloud = false } = {}) {
  await saveChain;
  // ENH-07: push the period being left while its data is still loaded; if the cloud refuses, the user decides
  if (S.period && p !== S.period && store.cloud.user && store.canEdit() && (await store.localGet(lk(S.period, 'unsynced')))) {
    const r = await syncNow();
    if (!r.ok && !r.skipped && !confirm(`Kỳ ${S.period} CHƯA lên được cloud: ${r.error}\n\nOK = chuyển sang kỳ ${p}; thay đổi của kỳ ${S.period} vẫn được giữ trên máy và đẩy lên khi mở lại kỳ này.\nHuỷ = ở lại kỳ ${S.period}.`)) { render(); return; }
  }
  stopPeriodWatch();
  S.remoteConflict = null;
  S.period = p; S.d = await loadLocal(p);
  S.approvals = await loadApprovals(p);
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
          // DATA-01: one IndexedDB transaction; the prior local snapshot stays
          // intact on quota, storage or browser interruption. Only adopt in-memory
          // state after the complete Cloud payload has passed chunk hash checks.
          await store.localReplacePeriod(p, blobsOf(d), r.meta);
          S.d = d;
        });
        S.sync = 'synced';
      } else if (meta && cloudNewer) {
        S.sync = 'conflict'; S.syncMsg = 'Cloud có bản mới hơn bản trên máy – chưa tải về, thay đổi trên máy sẽ không được đẩy lên.';
      } else if (unsynced && store.canEdit()) scheduleCloud();
      else S.sync = meta ? 'synced' : 'local';
    } catch (e) { toast('Không đọc được cloud: ' + e.message, 'review'); }
  }
  await refreshPeriods();
  S.prevDrift = []; S.prevVerifyErr = '';
  notices.setPeriod(p);
  startPeriodWatch(p);
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
const hiddenList = () => (store.cloud.enabled ? store.cloud.hiddenPeriods || [] : (() => { try { return JSON.parse(localStorage.getItem('svl.hiddenPeriods') || '[]'); } catch { return []; } })());
async function refreshPeriods() {
  const local = (await store.localGet('periods')) || [];
  S.outbox = [];
  for (const p of local) if (p !== S.period && (await store.localGet(lk(p, 'unsynced')))) S.outbox.push(p);
  let cloudP = [];
  try { cloudP = await store.cloudPeriods(); } catch { /* offline */ }
  S.periodInfo = Object.fromEntries(cloudP.map((x) => [x.period, { closed: !!(x.summary && x.summary.closed), everClosed: !!(x.summary && (x.summary.everClosed || x.summary.closed)), updatedAt: x.updatedAt, updatedBy: x.updatedBy, cloud: true }]));
  S.allPeriods = [...new Set([...local, ...cloudP.map((x) => x.period), S.period].filter(isPeriod))].sort().reverse();
  for (const p of local) { // status from this device too (works offline / without cloud)
    if (!isPeriod(p)) continue;
    const c = await store.localGet(lk(p, 'closed')).catch(() => null), ce = await store.localGet(lk(p, 'closedEver')).catch(() => null);
    const i = S.periodInfo[p] || (S.periodInfo[p] = {});
    if (c && c.period === p) { i.closed = true; i.everClosed = true; }
    if (ce) i.everClosed = true;
  }
  const hid = new Set(hiddenList());
  // hidden periods stay out of the period pickers (the one being worked on is always listed)
  S.periods = S.allPeriods.filter((p) => !hid.has(p) || p === S.period);
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
  const dq = DQ.erpAnomalies(S.d.datasets, S.period);
  const s1c = step1Controls(s1, accessLimitedCount(S.d.datasets), outOfPeriodRows(S.d.datasets, S.period), { ...dq, status: DQ.anomalyStatus(dq, S.d.importAck), blocking: DQ.blockingParts(dq, S.d.importAck) });
  const ctx = { period: S.period, step2: S.d.step2, register: S.d.register, latestImport: s1.latestImport, opening: S.d.opening, step3: S.d.step3, datasets: S.d.datasets };
  const p2 = S.period ? P2.derive(S) : { d3b: null, d4: null };
  const s3bc = p2.d3b ? p2.d3b.controls : { status: 'NOT RUN', okText: '', rows: [], next: 'Chạy STEP 3A trước' };
  const d5 = S.period ? P3.derive(S, p2) : null;
  return { s1, s1c, s2c: step2Controls(ctx), s3c: step3Controls(ctx), p2, d5, s3bc, s4c: p2.d4 ? p2.d4.controls : { status: 'NOT RUN', okText: '', rows: [], next: '' }, s5c: d5 ? d5.controls : { status: 'NOT RUN', okText: '', rows: [], next: '' } };
}
function derivedNow() { const p2 = P2.derive(S); return { ...p2, d5: P3.derive(S, p2) }; }

// ======================= permissions =======================
function guardEdit() {
  if (S.remoteConflict) {
    toast('Cloud đã có bản mới. Hãy bấm “Kiểm tra & tải bản Cloud” trước khi chỉnh sửa / chạy Step.', 'block');
    return false;
  }
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
const who = () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này');
const canEditPeriod = () => store.canEdit() && !isClosed();
const WRITE_ACTS = new Set(['new-period', 'dq-confirm', 'dq-unconfirm', 'cfg-fg-save', 'cfg-fg-confirm', 'cfg-fg-undo', 'run-step2', 'cons-reconcile', 'pc-basis-apply', 'pc-basis-undo', 'approve-step2-fallback', 'run-step3', 'roll-wip', 'validate-wip', 'reset-wip', 'reset-erp', 'push-cloud', 'delete-period', '3b-sync', '3b-build', '3b-apply', '3b-all', 'sales-save', 'ret-save', 'pm-update', 'run-step4', 'fgp-post', 'fgp-roll', 's5-roll', 's5-validate', 's5-run', 's5r-run', 's5-hist', 's5-close', 's5-reopen']);

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
  let [t, c] = store.SANDBOX ? ['SANDBOX – dữ liệu thử, không đồng bộ cloud', 's-review'] : map[S.sync] || map.local;
  const waiting = store.cloud.user ? SP.outboxOthers(S.outbox, S.period) : [];
  if (waiting.length) { t = `${t} · chờ đồng bộ kỳ ${waiting.join(', ')}`; if (c === 's-pass') c = 's-review'; }
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

// Every export is written with the styled workbook (src/ui/xlsxstyle.js). Sheets with keep:true are import templates and keep their cell positions.
async function exportBook(fileName, sheets) {
  const when = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const subtitle = `SVL – Starry Vietnam Co., Ltd.   ·   Kỳ ${S.period}   ·   ${APP_VERSION.split('·')[0].trim()}   ·   Xuất lúc ${when}`;
  await exportStyledBook(fileName, sheets, { title: fileName.replace(/\.xlsx$/, ''), subtitle, company: 'SVL – Starry Vietnam Co., Ltd.' });
}
// v1.14.61: a 'pct' / 'pct1' column carries its own Excel format (0.00% / 0.0%), so the export does not depend on the header text
const PCT_Z = { pct: '0.00%', pct1: '0.0%' };
const exportTable = (name, columns) => (rows) => exportBook(`${name}_${S.period}.xlsx`, [{ name, title: `${name.replace(/_/g, ' ')}`, aoa: [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => { const x = Array.isArray(r) ? r[c.key] : r[c.key]; if (c.type === 'date' && typeof x === 'number') return serialToISO(x); if (PCT_Z[c.type] && typeof x === 'number' && Number.isFinite(x)) return { v: x, z: PCT_Z[c.type] }; return x ?? ''; }))], cols: columns.map((c) => Math.round((c.width || 120) / 7)) }]);

// ======================= layout =======================
const NAV = [
  { id: 'cc', no: '', label: 'Tổng quan kỳ', sub: 'Control Center' },
  { id: 'dashboard', no: '', label: 'Dashboard doanh thu & GP', sub: 'Theo khách hàng · GP %' },
  { id: 'step1', no: '1', label: 'Import dữ liệu ERP', sub: '21 báo cáo T · S · O', key: 's1' },
  { id: 'step2', no: '2', label: 'Phân bổ Stock Out', sub: 'Stock Out → lô PC', key: 's2' },
  { id: 'rework', no: '2B', label: 'Sổ FG Rework', sub: 'FG xuất đi rework', key: 'rw' },
  { id: 'opening', no: '3A', label: 'Opening WIP', sub: 'Số dư đầu kỳ', key: 'op' },
  { id: 'step3', no: '3A', label: 'Material WIP', sub: 'WIP theo vật tư', key: 's3' },
  { id: 'p3b', no: '3B', label: 'Điều chỉnh WIP', sub: 'WIP âm → lô PC', key: 's3b' },
  { id: 'sales', no: '4.1', label: 'Doanh thu & giá', sub: 'Sales · Price Master', key: 'pm' },
  { id: 'gl', no: '4.2', label: 'FX / GL 622-627', sub: 'Tỷ giá · chi phí', key: 'gl' },
  { id: 'step4', no: '4.3', label: 'Phân bổ giá thành', sub: '622 / 627 theo lô', key: 's4' },
  { id: 'fgprod', no: '4.4', label: 'Thành phẩm SX lũy kế', sub: 'YTD · đầu kỳ · roll', key: 'fgp' },
  { id: 'fgopen', no: '5.1', label: 'FG đầu kỳ', sub: 'Lớp FIFO đầu kỳ', key: 's5o' },
  { id: 'step5', no: '5.2', label: 'FIFO giá vốn', sub: 'COGS · rework 5B', key: 's5' },
  { id: 'rwflow', no: '5B', label: 'Xử lý Rework', sub: 'Treo · hoàn thành · chi phí', key: 'rwf' },
  { id: 'salesreturn', no: '5R', label: 'Hàng trả lại & giảm giá', sub: 'Sales Return 5212 · 5213', key: 's5r' },
  { id: 'provision', no: '5P', label: 'Dự phòng FG', sub: 'TK 2294 · nạp đầu kỳ · FAST', key: 'prov' },
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
    s3b: st.s3bc.status, s4: st.s4c.status, ...(st.d5 ? P3.railStatus(S, st.d5) : { s5o: 'NOT RUN', s5: 'NOT RUN', s5r: 'NOT RUN', s5c: 'NOT RUN' }), prov: PV.railStatus(S, st.d5),
    pm: !S.d.pm ? 'NOT RUN' : S.d.pm.status !== 'CURRENT' ? S.d.pm.status : S.d.pm.rows.some((r) => r.status === 'MISSING PRICE') ? 'BLOCK' : 'PASS',
    gl: S.d.gl && S.d.gl.period === S.period && num(S.d.gl.fx) > 0 ? 'PASS' : 'NOT RUN',
    fgp: FGP.status(S, st.p2.d4),
    rwf: RWV.status(S),
  };
}

function renderShell() {
  document.body.classList.remove('auth-screen');
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
    `;
  const hp = $('#hdr-period');
  if (hp) hp.innerHTML = S.periods.map((p) => `<option ${p === S.period ? 'selected' : ''}>${p}</option>`).join('');
  const u = store.cloud.user;
  $('#account').innerHTML = !store.cloud.enabled ? (store.SANDBOX ? '<span class="muted">Sandbox (thử nghiệm)</span>' : '<span class="muted">Chế độ offline</span>')
    : u ? `<span class="who" title="${esc(u.email)}">${esc(u.displayName || u.email)} · ${esc(store.ROLES[store.cloud.role] || '')}</span><button class="btn ghost sm" data-act="signout" type="button">Đăng xuất</button>`
      : `<button class="btn sm" data-act="signin" type="button" ${store.cloud.ready ? '' : 'disabled'}>Đăng nhập Google</button>`;
  renderSync();
}

// v1.14.55: each process stage has its own table-header hue (body[data-stage]); overview and tools stay slate
const STAGE_OF = { step1: 's1', step2: 's2', rework: 's2', opening: 's3', step3: 's3', p3b: 's3', sales: 's4', gl: 's4', step4: 's4', fgprod: 's4', fgopen: 's5', step5: 's5', rwflow: 's5', salesreturn: 's5', provision: 's5', close: 's5' };
function render() {
  document.body.dataset.stage = STAGE_OF[S.view] || 's0';
  // v1.14.35 (audit ENH-05): no local accounting data is shown until a Firebase session is confirmed (no offline bypass)
  if (store.needsSignIn() || (store.cloud.enabled && !store.cloud.user)) {
    document.body.classList.add('auth-screen');
    $('#rail').innerHTML = '';
    $('#account').innerHTML = '';
    renderSync();
    app().innerHTML = `<section class="auth-login" aria-labelledby="auth-title">
      <div class="auth-card">
        <div class="auth-logo"><img src="icon.svg" alt="" width="72" height="72"></div>
        <div class="auth-kicker">STARRY VIETNAM · FINANCE</div>
        <h1 id="auth-title">SVL Costing</h1>
        <p class="auth-sub">Hệ thống giá thành sản xuất tháng</p>
        <p class="auth-desc">Import ERP, kiểm soát WIP, phân bổ giá thành, FIFO COGS, Sales Return và đóng kỳ trên một quy trình có kiểm soát.</p>
        <button class="btn auth-signin" data-act="signin" type="button" ${store.cloud.ready ? '' : 'disabled'}>
          <span class="auth-g">G</span><span>${store.cloud.ready ? 'Đăng nhập bằng Google' : 'Đang kết nối Google…'}</span>
        </button>
        <div class="auth-note">Chỉ tài khoản đã được cấp quyền mới có thể xem dữ liệu giá thành trên cloud.</div>
        ${store.cloud.error ? `<div class="alert block auth-error">${esc(store.cloud.error)}</div>` : ''}
        <div class="auth-version">${esc(APP_VERSION)}</div>
      </div>
    </section>`;
    return;
  }
  renderShell();
  const view = VIEWS[S.view] || VIEWS.cc;
  if (!S.period && S.view !== 'settings') { app().innerHTML = viewWelcome(); return; }
  app().innerHTML = '';
  view(app());
  zoneSections(app());
  cardTables(app());
  showLiveConflict();
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
VIEWS.fgprod = (el) => FGP.view(el);
VIEWS.rwflow = (el) => RWV.view(el);
VIEWS.fgopen = (el) => P3.viewOpen(el);
VIEWS.step5 = (el) => P3.viewFIFO(el);
VIEWS.salesreturn = (el) => P3.viewReturns(el);
VIEWS.provision = (el) => PV.view(el);
VIEWS.dashboard = (el) => DBV.view(el);
VIEWS.close = (el) => P3.viewClose(el);
VIEWS.trace = (el) => TRV.viewTrace(el);

const driftHTML = () => (S.prevVerifyErr ? `<div class="alert block"><b>Chưa xác minh được kỳ trước</b> ${esc(S.prevVerifyErr)}</div>` : '') + ((S.prevDrift || []).length ? `<div class="alert block"><b>Số dư đầu kỳ cần chuyển lại</b><ul>${S.prevDrift.map((m) => `<li>${esc(m)}</li>`).join('')}</ul><a href="#opening">Mở Opening WIP → Roll forward</a></div>` : '');
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
    (() => { const c = FGP.ccInfo(S, st.p2.d4); return ['4.4', 'Thành phẩm SX lũy kế', c.status, c.text, c.at, c.next, 'fgprod']; })(),
    ['5.1', 'FG đầu kỳ', rs.s5o, S.d.fgOpen && S.d.fgOpen.stats ? fmtNum(S.d.fgOpen.stats.amt) : '', S.d.fgOpen && (S.d.fgOpen.validatedAt || S.d.fgOpen.loadedAt), S.d.fgOpen ? '' : 'Roll forward / import FG đầu kỳ', 'fgopen'],
    ['5.2', 'FIFO giá vốn & rework', rs.s5, st.d5 && st.d5.res ? fmtNum(st.d5.res.totals.cogsA) : '', st.d5 && st.d5.res && st.d5.res.runAt, st.s5c.next, 'step5'],
    (() => { const r = RWV.summary(S); return ['5B', 'Xử lý Rework', rs.rwf, S.d.register && S.d.register.rows.length ? `154 rework ${fmtNum(r.closing)} · ${r.pending} treo` : '', r.runAt, rs.rwf === 'NOT RUN' ? 'RUN FIFO để tính giá rework' : r.aged ? `${r.aged} dòng treo quá ${r.agingMonths} tháng` : '', 'rwflow']; })(),
    ['5R', 'Hàng trả lại & giảm giá', rs.s5r, st.d5 && st.d5.res && st.d5.res.withReturns && st.d5.res.returnControl ? `${st.d5.res.returnControl.processed}/${st.d5.res.returnControl.total} đã xử lý` : '', st.d5 && st.d5.res && st.d5.res.withReturns && st.d5.res.runAt, rs.s5r === 'PASS' ? '' : rs.s5r === 'NOT RUN' || rs.s5r === 'RERUN REQUIRED' ? 'RUN STEP 5R' : 'Kiểm tra hoá đơn gốc / SL trả / giảm giá vốn', 'salesreturn'],
    ['5.3', 'FG History & đóng kỳ', rs.s5c, st.d5 && st.d5.res ? st.d5.recon.finalStatus : '', S.d.closed && S.d.closed.period === S.period ? S.d.closed.closedAt : S.d.fgHistory && S.d.fgHistory.builtAt, S.d.closed && S.d.closed.period === S.period ? '' : st.d5 && st.d5.res ? (st.d5.closeReason || 'CLOSE MONTH') : '', 'close'],
  ];
  const next = steps.find((x) => !String(x[2]).startsWith('PASS') && x[2] !== 'CLOSED');
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>Tổng quan kỳ ${esc(S.period)}</h1><p class="lead">Chạy lần lượt từng bước; mỗi bước chỉ đi tiếp khi các checkpoint không còn BLOCK.</p></div>
      <div class="next"><span>Việc tiếp theo</span><b>${next ? `<a href="#${next[6]}">${esc(next[1])}</a> — ${esc(next[5] || 'xem checkpoint')}` : (S.d.closed && S.d.closed.period === S.period ? `Kỳ đã đóng. Tạo kỳ ${esc(nextPeriod(S.period))} và roll forward.` : 'Tất cả các bước đã PASS – CLOSE MONTH.')}</b></div></header>
    ${driftHTML()}
    ${overviewKpis(st, s3)}
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
/** v1.14.54: KPI tile with a meaning colour — in (nhập / vào), out (xuất / ra / giá vốn), result (cuối kỳ / kết quả), base (đầu kỳ, khác).
 *  opts.tone overrides the guess from the label; opts.sub adds one context line (formula, check, comparison). */
const KPI_TONE = [
  [/cuối|closing|lãi gộp/i, 'res'],
  [/đầu kỳ|opening|b\/f/i, 'base'],
  [/giá vốn|\bra\b|xuất|chuyển rework|ra chi phí|giảm giá|trả lại|5212|5213/i, 'out'],
  [/vào|nhập kho|giá thành|doanh thu|622|627|tổng rm|hoàn thành/i, 'in'],
];
function kpiTone(label, strong) { for (const [re, t] of KPI_TONE) if (re.test(label)) return t; return strong ? 'res' : 'base'; }
function kpi(label, val, strong, opts = {}) {
  const tone = opts.tone || kpiTone(String(label), strong);
  const neg = typeof val === 'number' && val < -0.5;
  const shown = val === null || val === undefined ? '—' : typeof val === 'number' && Math.abs(val) < 0.005 ? '0' : fmtNum(val);
  return `<div class="kpi t-${tone} ${strong ? 'strong' : ''}"><span>${esc(label)}</span><b class="${neg ? 'bad' : ''}">${shown}</b><small>${opts.sub ? opts.sub : 'VND'}</small></div>`;
}
/** v1.14.54: overview figures in two groups (WIP, thành phẩm) with the check behind each figure. */
function overviewKpis(st, s3) {
  const f = (v) => fmtNum(v), has = (v) => typeof v === 'number' && isFinite(v);
  const op0 = S.d.opening && S.d.opening.stats ? S.d.opening.stats.totalAmt : null;
  const inA = s3 ? s3.summary.inAmt : null, outA = s3 ? s3.summary.outAmt : null, clERP = s3 ? s3.summary.closingAmt : null;
  const fin = st.p2.d3b ? st.p2.d3b.wf.finalClosing : null;
  const roll = has(op0) && has(inA) && has(outA) && has(clERP) ? op0 + inA - outA - clERP : null;
  const chk = (d, okText) => (d === null ? '' : Math.abs(d) < 1 ? `<i class="ok">✓ ${okText}</i>` : `<i class="warn">Lệch ${f(d)}</i>`);
  const res = st.d5 && st.d5.res ? st.d5.res.totals : null;
  const prodA = st.p2.d4 && st.p2.d4.fl ? st.p2.d4.fl.totals.totalCost : null;
  const avail = res ? num(res.openA) + num(res.prodA) : null;
  const pct = (a, b) => (has(a) && b ? `${(a / b * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} %` : '');
  const rw = res ? num(res.rwTot) : 0;
  const op = (x) => `<i class="op" aria-hidden="true">${x}</i>`;
  return `<div class="kpi-groups">
    <section class="kpi-group"><h3>WIP · sản phẩm dở dang</h3><div class="kpis kpi-flow">
      ${kpi('Opening WIP', op0, false, { tone: 'base', sub: op0 === null ? 'Chưa nhập (3A)' : 'Số dư đầu kỳ' })}${op('+')}
      ${kpi('WIP vào (MI + Stock Out)', inA, false, { tone: 'in', sub: s3 ? 'Xuất NVL vào sản xuất' : 'Chưa chạy STEP 3A' })}${op('−')}
      ${kpi('WIP ra (PC + MR + Stock Out)', outA, false, { tone: 'out', sub: s3 ? 'Kết chuyển và nhập lại' : 'Chưa chạy STEP 3A' })}${op('=')}
      ${kpi('Closing WIP ERP', clERP, false, { tone: 'base', sub: roll === null ? 'Chưa đủ số liệu' : chk(roll, 'khớp đầu kỳ + vào − ra') })}${op('→')}
      ${kpi('Closing WIP cuối (sau 3B)', fin, true, { tone: 'res', sub: has(fin) && has(clERP) ? (Math.abs(fin - clERP) < 1 ? 'Không điều chỉnh 3B' : `Điều chỉnh 3B: ${fin - clERP > 0 ? '+' : ''}${f(fin - clERP)}`) : 'Chưa chạy STEP 3B' })}
    </div></section>
    <section class="kpi-group"><h3>Thành phẩm · giá vốn</h3><div class="kpis kpi-flow">
      ${kpi('FG đầu kỳ', res ? res.openA : null, false, { tone: 'base', sub: res ? 'Lớp FIFO đầu kỳ (5.1)' : 'Chưa chạy STEP 5' })}${op('+')}
      ${kpi('Giá thành SX (STEP 4)', prodA, true, { tone: 'in', sub: prodA === null ? 'Chưa chạy STEP 4' : 'Nhập kho thành phẩm (155)' })}${op('−')}
      ${kpi('Giá vốn FIFO (STEP 5)', res ? res.cogsA : null, true, { tone: 'out', sub: res ? `${pct(res.cogsA, avail)} FG khả dụng` : 'Chưa chạy STEP 5' })}${op('−')}
      ${kpi('Chuyển rework (5B)', res ? rw : null, false, { tone: 'out', sub: res ? 'FG xuất đi rework' : 'Chưa chạy STEP 5' })}${op('=')}
      ${kpi('FG cuối kỳ', res ? res.closeA : null, false, { tone: 'res', sub: res ? 'Tồn kho thành phẩm (155)' : 'Chưa chạy STEP 5' })}
    </div></section>
  </div>`;
}
function emptyNote(msg, href, cta) { return `<div class="empty"><p>${esc(msg)}</p>${href ? `<a class="btn" href="#${href}">${esc(cta)}</a>` : ''}</div>`; }
function journal(st) {
  const s3 = S.d.step3; if (!s3) return '';
  const r5 = st && st.d5 && st.d5.res;
  const ctx = { s3, s2: S.d.step2, s4: S.d.step4, fl: st && st.p2.d4 && st.p2.d4.fl, r5 };
  // v1.14.79: JE07 is split by customer (its lines add up to JE07); the same lines go to the bảng tổng hợp hạch toán
  const lines = journalWithCustomers(ctx);
  const chk = journalCheck(ctx);
  const tag = chk.status === 'PASS' ? 'khớp JE07' : 'lệch JE07 – xem Dashboard';
  return `<h2>Bút toán đề xuất</h2><table class="cp"><thead><tr><th>JE</th><th>Nợ</th><th>Có</th><th>Khách hàng</th><th>Diễn giải</th><th class="r">Số tiền (VND)</th></tr></thead><tbody>
    ${lines.map((j) => `<tr><td>${esc(j.je)}</td><td>${esc(j.dr)}</td><td>${esc(j.cr)}</td><td>${esc(j.cust || '—')}</td><td>${esc(j.desc)}</td><td class="r">${fmtNum(j.amount)}</td></tr>`).join('')}</tbody></table>
    <p class="muted">Bút toán đề xuất để hạch toán trên FAST. Giá vốn (JE07) chia theo khách hàng: <span>${esc(tag)}</span>. Doanh thu (DT / TL / GG) đã ghi nhận trên FAST, chỉ để đối chiếu. Xem thêm <a href="#dashboard">Dashboard</a>.</p>`;
}

// ---------- STEP 1 ----------
/** v1.14.30: STEP 1 ERP check in three colour-coded cards A / B / C; each part is confirmed (or its confirmation cleared) on its own. */
const DQ_PART_LBL = { CONFIRMED: 'ĐÃ XÁC NHẬN', CHANGED: 'THAY ĐỔI – XÁC NHẬN LẠI', 'NOT CONFIRMED': 'CHƯA XÁC NHẬN' };
const DQ_PART_CLS = { CONFIRMED: 's-pass', CHANGED: 's-block', 'NOT CONFIRMED': 's-block' };
function dqSection(dq) {
  if (!dq) return '';
  const rc = dq.recon || { bySys: [], issues: [] };
  const nL = dq.lines.length, nR = rc.issues.length;
  if (!nL && !nR && !(dq.mcAll || []).length && !(dq.pcLots || []).length) return rc.bySys.length || S.d.datasets['PC-M-T'] || S.d.datasets['PC-M-O'] ? `<div class="alert pass">Kiểm tra dữ liệu ERP: PC-P = PC-M ở mọi hệ (${rc.bySys.map((x) => `${x.erp} ${fmtNum(x.pcsP)} PC`).join(' · ')}); không có dòng vật tư bất thường ở PC-M / MI-M / MR-M.</div>` : '';
  const zeroLines = dq.lines.filter((l) => l.type === 'ZERO COST'), negLines = dq.lines.filter((l) => l.type !== 'ZERO COST');
  const mcLines = dq.mcLines || [], mcAll = dq.mcAll || [];
  const pcAll = dq.pcLots || [], pcFlagged = dq.pcFlagged || [];
  const zeroSum = dq.summary.filter((g) => g.type === 'ZERO COST'), negSum = dq.summary.filter((g) => g.type !== 'ZERO COST');
  const ack = S.d.importAck; const ok = DQ.anomalyStatus(dq, ack) === 'REVIEW - CONFIRMED';
  const parts = DQ.ackParts(ack, dq);
  const st = (k) => DQ.partStatus(dq, ack, k);
  const head = [nR ? `${fmtNum(nR)} PC lệch PC-P / PC-M` : '', zeroLines.length ? `${fmtNum(zeroLines.length)} dòng SL ≠ 0 nhưng Total Cost = 0` : '', negLines.length ? `${fmtNum(negLines.length)} dòng số âm / sai kiểu` : '', mcLines.length ? `${fmtNum(mcLines.length)} dòng xuất NVL đơn giá bất thường` : '', pcFlagged.length ? `${fmtNum(pcFlagged.length)} lô PC bất thường (PC-P)` : ''].filter(Boolean).join(' · ') || 'không có dòng cần xác nhận';
  // confirmation bar of one part: status, who confirmed / what changed, confirm and clear buttons
  const bar = (k) => {
    const s = st(k);
    if (s === 'NONE') return '';
    const pc = parts[k];
    const info = s === 'CONFIRMED' ? `<span>Đã xác nhận bởi <b>${esc(pc.by)}</b> lúc ${fmtTs(pc.at)}: ${esc(pc.note)}</span>`
      : s === 'CHANGED' ? `<span><b>Danh sách đã thay đổi</b> sau lần xác nhận ${fmtTs(pc.at)} của ${esc(pc.by)} – cần xác nhận lại.${S.d.pcAdj && new Date(S.d.pcAdj.at) > new Date(pc.at) ? ` Nguyên nhân: điều chỉnh PC-P theo PC-M ở STEP 3 lúc ${fmtTs(S.d.pcAdj.at)} đã đổi đơn giá lô PC-P.` : ''}</span>`
      : '<span class="muted">Chưa xác nhận phần này.</span>';
    const btnOk = s === 'CONFIRMED' ? '' : `<button class="btn" type="button" data-act="dq-confirm" data-part="${k}">${s === 'CHANGED' ? `Xác nhận lại phần ${k}` : `Xác nhận phần ${k}`}</button>`;
    const btnClear = pc ? `<button class="btn danger ghost" type="button" data-act="dq-unconfirm" data-part="${k}">Xóa xác nhận</button>` : '';
    return `<div class="dq-bar"><div class="dq-info-line">${pill(s === 'CONFIRMED' ? 'REVIEW - CONFIRMED' : 'BLOCK - CONFIRM')} ${info}</div><div class="row">${btnOk}${btnClear}</div></div>`;
  };
  const summaryLine = ['A', 'B', 'C', 'D'].filter((k) => st(k) !== 'NONE').map((k) => `<span class="dq-chip ${DQ_PART_CLS[st(k)]}">${k} · ${esc(DQ_PART_LBL[st(k)])}</span>`).join(' ');
  const cardA = rc.bySys.length ? `<section class="dq-card dq-info">
    <h3>A · Chênh lệch PC-P và PC-M ${pill(nR ? 'CHECK' : 'PASS')}</h3>
    <p class="muted">Total Cost của lô trên PC-P phải bằng tổng Total Cost vật tư của lô trên PC-M (theo PC No. và Product Code). Lệch nghĩa là hai báo cáo không được xuất cùng thời điểm hoặc có chứng từ chưa đủ.</p>
    ${bar('A')}
    <table class="cp"><thead><tr><th>Hệ</th><th class="r">Total Cost PC-P</th><th class="r">Tổng PC-M</th><th class="r">Chênh PC-M − PC-P</th><th class="r">Số PC (P / M)</th><th class="r">PC lệch</th><th class="r">Chỉ có ở PC-M</th><th class="r">Chỉ có ở PC-P</th><th>Trạng thái</th></tr></thead><tbody>
      ${rc.bySys.map((x) => `<tr><td><span class="erp erp-${x.erp}">${x.erp}</span></td><td class="r">${fmtNum(x.pcp)}</td><td class="r">${fmtNum(x.pcm)}</td><td class="r">${fmtNum(x.diff, Math.abs(x.diff) < 1000 && x.diff ? 2 : 0)}</td><td class="r">${fmtNum(x.pcsP)} / ${fmtNum(x.pcsM)}</td><td class="r">${fmtNum(x.gaps)}</td><td class="r">${fmtNum(x.onlyM)}</td><td class="r">${fmtNum(x.onlyP)}</td><td>${pill(x.status)}</td></tr>`).join('')}
    </tbody></table>${nR ? '<div id="t-pcrec"></div><p class="muted">Cách xử lý: xuất lại PC-P và PC-M cùng lúc từ ERP rồi import lại. Nếu chênh lệch nhỏ đã được giải trình, STEP 3 có chức năng "Điều chỉnh PC-P theo PC-M" (có lưu số gốc để hoàn tác).</p>' : ''}
  </section>` : '';
  const cardB = zeroLines.length ? `<section class="dq-card dq-warn">
    <h3>B · Vật tư SL ≠ 0 nhưng Total Cost = 0 ${pill('CHECK')}</h3>
    <p class="muted">STEP 3B không định giá được vật tư có SL nhưng Total Cost = 0 (ví dụ hàng khách cấp, hàng chưa có giá). Rà soát với ERP / kho: sửa và import lại, hoặc xác nhận là đúng thực tế.</p>
    ${bar('B')}
    <table class="cp"><thead><tr><th>Báo cáo</th><th>Loại bất thường</th><th class="r">Số dòng</th><th class="r">Số vật tư</th><th>Mã vật tư (ví dụ)</th></tr></thead><tbody>
      ${zeroSum.map((g) => `<tr><td>${esc(g.report)}</td><td>${esc(g.label)}</td><td class="r">${fmtNum(g.lines)}</td><td class="r">${fmtNum(g.materials)}</td><td class="muted">${esc(g.sample)}${g.materials > 12 ? '…' : ''}</td></tr>`).join('')}
    </tbody></table><div id="t-dq-zero"></div>
  </section>` : '';
  // v1.14.48: C gồm dòng số âm / sai kiểu (phải sửa ERP) và dòng xuất NVL đơn giá bất thường (MI-M, ngưỡng mặc định); một nút xác nhận
  // C: số âm / sai kiểu dữ liệu và đơn giá xuất NVL (MI-M) bất thường – chặn STEP 2 cho tới khi xác nhận (v1.14.65)
  const cCount = negLines.length + mcLines.length;
  const cardC = cCount || mcAll.length ? `<section class="dq-card ${cCount ? 'dq-block' : 'dq-info'}">
    <h3>C · Vật tư số âm, sai kiểu dữ liệu hoặc đơn giá xuất NVL bất thường ${pill(cCount ? 'BLOCK' : 'CHECK')}</h3>
    <p class="muted">Số âm, hoặc ô là chữ thay vì số: sửa trên ERP rồi import lại. Đơn giá xuất NVL (MI-M): dòng có thành tiền ≥ 1.000.000 VND và đơn giá lệch > 30 % so với đơn giá chuẩn (trung vị đơn giá các dòng cùng hệ, mã VT và ĐVT trong kỳ). Đúng thì xác nhận; sai thì sửa ERP và import lại. Danh sách cần được xác nhận trước khi chạy STEP 2.</p>
    ${bar('C')}
    ${negLines.length ? `<table class="cp"><thead><tr><th>Báo cáo</th><th>Loại bất thường</th><th class="r">Số dòng</th><th class="r">Số vật tư</th><th>Mã vật tư (ví dụ)</th></tr></thead><tbody>
      ${negSum.map((g) => `<tr><td>${esc(g.report)}</td><td>${esc(g.label)}</td><td class="r">${fmtNum(g.lines)}</td><td class="r">${fmtNum(g.materials)}</td><td class="muted">${esc(g.sample)}${g.materials > 12 ? '…' : ''}</td></tr>`).join('')}
    </tbody></table><div id="t-dq-neg"></div>` : ''}
    ${mcAll.length ? `<h4 class="dq-sub">Đơn giá xuất NVL (MI-M) · ${fmtNum(mcAll.length)} dòng · ${fmtNum(mcLines.length)} bất thường</h4>
      <p class="muted">Đơn giá dòng = Thành tiền ÷ SL xuất. Đơn giá chuẩn = trung vị đơn giá các dòng cùng hệ, mã VT và ĐVT trong kỳ.</p>
      <div id="t-dq-mc"></div>` : ''}
  </section>` : '';
  // D: đơn giá thành phẩm theo lô PC (PC-P) – như thẻ C: bất thường phải được xác nhận trước khi chạy STEP 2
  const pcKinds = [['DEV', 'Đơn giá lệch so với chuẩn'], ['QTY0', 'SL ≤ 0 nhưng có Total Cost'], ['COST0', 'SL > 0 nhưng Total Cost = 0']];
  const pcSum = pcKinds.map(([k, label]) => { const L = pcFlagged.filter((l) => l.kind === k); return L.length ? { erp: [...new Set(L.map((l) => l.erp))].join(', '), label, lots: L.length, prods: new Set(L.map((l) => `${l.erp}|${l.prod}`)).size, sample: [...new Set(L.map((l) => l.prod))].slice(0, 12).join(', ') } : null; }).filter(Boolean);
  const cardD = pcAll.length ? `<section class="dq-card ${pcFlagged.length ? 'dq-block' : 'dq-info'}">
    <h3>D · Đơn giá thành phẩm theo lô PC bất thường (PC-P) ${pill(pcFlagged.length ? 'BLOCK' : 'CHECK')}</h3>
    <p class="muted">Đơn giá lô = Total Cost ÷ SL hoàn thành, so với trung vị đơn giá các lô cùng hệ và cùng mã sản phẩm trong kỳ. Bất thường: lệch > 30 % và Total Cost ≥ 1.000.000 VND; hoặc SL ≤ 0 nhưng có cost; hoặc SL > 0 nhưng Total Cost = 0. Đúng thì xác nhận; sai thì sửa ERP và import lại. Danh sách cần được xác nhận trước khi chạy STEP 2.</p>
    ${bar('D')}
    ${pcSum.length ? `<table class="cp"><thead><tr><th>Hệ</th><th>Loại bất thường</th><th class="r">Số lô</th><th class="r">Số mã SP</th><th>Mã SP (ví dụ)</th></tr></thead><tbody>
      ${pcSum.map((g) => `<tr><td>${esc(g.erp)}</td><td>${esc(g.label)}</td><td class="r">${fmtNum(g.lots)}</td><td class="r">${fmtNum(g.prods)}</td><td class="muted">${esc(g.sample)}${g.prods > 12 ? '…' : ''}</td></tr>`).join('')}
    </tbody></table>` : ''}
    <h4 class="dq-sub">Đơn giá lô PC (PC-P) · ${fmtNum(pcAll.length)} lô · ${fmtNum(pcFlagged.length)} bất thường</h4>
    <div id="t-dq-pc"></div>
  </section>` : '';
  return `<div class="alert ${ok ? 'review' : 'block'}"><h2 style="margin:0 0 6px">Kiểm tra dữ liệu ERP: ${head} ${pill(ok ? 'REVIEW - CONFIRMED' : 'BLOCK - CONFIRM')}</h2>
    <p><b>STEP 2 chỉ chạy được khi mọi phần có bất thường đã được xác nhận.</b> Xác nhận từng phần trong thẻ bên dưới; có thể xóa xác nhận của từng phần để làm lại.</p>
    ${summaryLine ? `<div class="dq-chips">${summaryLine}</div>` : ''}
  </div>
  <div class="dq-cards">${cardA}${cardB}${cardC}${cardD}</div>`;
}
VIEWS.step1 = (el) => {
  const st = statusAll(); const c = st.s1c;
  const mcO = mcOpts();
  const mc = materialIssueCosts(S.d.datasets, S.period, mcO); // v1.14.43: đơn giá xuất NVL (MI-M) và dòng bất thường
  const mcSec = `<h2>Đơn giá xuất NVL trong kỳ (MI-M)</h2>
    <div class="row"><label>Ngưỡng lệch (%) <input id="mc-dev" type="number" min="1" step="1" value="${Math.round(mcO.dev * 100)}" style="width:90px"></label>
    <label>Thành tiền tối thiểu (VND) <input id="mc-min" type="text" inputmode="numeric" autocomplete="off" value="${fmtNum(mcO.minCost)}" style="width:150px"></label>
    <button class="btn ghost" id="mc-reset" type="button">Mặc định</button></div>
    ${mc.materials.length ? `<p class="muted">Đơn giá = Total Cost ÷ SL xuất (dòng SL > 0). Đơn giá BQ = tổng cost ÷ tổng SL của các dòng có cost. Đơn giá chuẩn = trung vị các đơn giá dòng. Bất thường: dòng có thành tiền ≥ ${fmtNum(mcO.minCost)} VND lệch > ${Math.round(mcO.dev * 100)}% so với đơn giá chuẩn. Thiếu cost: dòng SL > 0 nhưng Total Cost = 0 (không tính vào BQ). Ngưỡng chỉ ảnh hưởng bảng này, không ảnh hưởng tính giá thành.</p>
    <p class="muted">${fmtNum(mc.summary.materials)} vật tư · ${fmtNum(mc.summary.flagged)} vật tư bất thường · ${fmtNum(mc.summary.missingCost)} vật tư thiếu cost · ${fmtNum(mc.summary.flaggedLines)} dòng lệch · ${fmtNum(mc.summary.zeroCostLines)} dòng cost = 0${mc.missing.length ? ` · chưa có MI-M hệ ${esc(mc.missing.join(', '))}` : ''}</p>
    <div id="t-mc"></div>
    <p class="muted">Các dòng xuất lệch bất thường được liệt kê ở thẻ C phía trên (ngưỡng mặc định, cần xác nhận).</p>` : `<p class="muted">Chưa có dữ liệu MI-M trong kỳ ${esc(S.period)}.</p>`}`;
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
    ${dqSection(c.dq)}
    ${mcSec}
    ${c.dateIssues && c.dateIssues.length ? `<div class="alert review"><b>Có dòng ngày ngoài kỳ ${esc(S.period)}</b> – kiểm tra file xuất ERP trước khi chạy STEP 2:<ul>${c.dateIssues.map((x) => `<li>${esc(x.key)}: ${fmtNum(x.n)} dòng (${esc(x.months.join(', '))})${x.amt ? ` · ${fmtNum(x.amt)} VND` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="grid3">${ERPS.map((e) => { const b = st.s1.bySys[e]; return `<div class="sys sys-${e}"><b>Hệ ${e}</b>${pill(b.status)}<span>${b.files} file · ${fmtNum(b.rows)} dòng</span><small>${fmtTs(b.lastImport)}</small></div>`; }).join('')}</div>
    <h2>Danh mục 21 báo cáo bắt buộc</h2>
    <table class="cp"><thead><tr><th>Hệ</th><th>Báo cáo</th><th>Trạng thái</th><th class="r">Số dòng</th><th>File nguồn</th><th>Thời điểm import</th><th></th></tr></thead><tbody>
    ${st.s1.checklist.map((x) => `<tr><td><span class="erp erp-${x.erp}">${x.erp}</span></td><td>${esc(x.report)}</td><td>${pill(x.status)}${x.error ? `<div class="err">${esc(x.error)}</div>` : ''}</td><td class="r">${fmtNum(x.dataRows)}</td><td>${esc(x.fileName)}</td><td>${fmtTs(x.importedAt)}</td><td>${S.d.datasets[x.key] ? `<a href="#data" data-act="view-ds" data-k="${esc(x.key)}">Xem</a>` : ''}</td></tr>`).join('')}
    </tbody></table>
    <div class="row end"><span class="muted">Dòng báo "access right" từ ERP: ${c.accessLimited}</span>
      <button class="btn danger ghost" data-act="reset-erp" type="button" ${isClosed() ? 'disabled title="Kỳ đã đóng – mở lại kỳ (5.3) nếu cần xoá"' : ''}>Xoá dữ liệu ERP…</button></div>
  </section>`;
  if (c.dq && c.dq.recon && c.dq.recon.issues.length && $('#t-pcrec')) {
    const pcols = DQ.PCR_FIELDS.map((f, i) => ({ key: f, label: DQ.PCR_HEADERS[i], type: ['pcp', 'pcm', 'diff'].includes(f) ? 'num' : f === 'type' ? 'status' : 'text', width: f === 'name' ? 260 : f === 'erp' ? 50 : ['pcp', 'pcm', 'diff'].includes(f) ? 170 : 130 }));
    mountTable($('#t-pcrec'), { columns: pcols, rows: c.dq.recon.issues, filterKey: 'type', height: 300, totals: ['pcp', 'pcm', 'diff'], onExport: exportTable('01_DOI_CHIEU_PCP_PCM', pcols) });
  }
  const mcDev = $('#mc-dev'), mcMin = $('#mc-min');
  const mcApply = () => {
    const dv = Number(mcDev && mcDev.value), mn = Number(String(mcMin ? mcMin.value : '').replace(/[^\d]/g, ''));
    if (!(dv > 0) || !(mn >= 0) || !Number.isFinite(dv) || !Number.isFinite(mn)) { toast('Ngưỡng lệch phải > 0 và thành tiền tối thiểu ≥ 0.', 'review'); return; }
    setMcOpts({ dev: dv / 100, minCost: mn });
  };
  if (mcDev) mcDev.addEventListener('change', mcApply);
  if (mcMin) mcMin.addEventListener('change', mcApply);
  const mcReset = $('#mc-reset');
  if (mcReset) mcReset.addEventListener('click', () => setMcOpts(null));
  if (mc.materials.length && $('#t-mc')) {
    const mcCols = [{ key: 'erp', label: 'Hệ', width: 60 }, { key: 'code', label: 'Mã VT', width: 130 }, { key: 'name', label: 'Tên vật tư', width: 300 }, { key: 'unit', label: 'ĐVT', width: 70 },
      { key: 'nLines', label: 'Số dòng', type: 'int', width: 90 }, { key: 'qty', label: 'SL xuất', type: 'qty', width: 120 }, { key: 'cost', label: 'Giá trị xuất', type: 'num', width: 150 },
      { key: 'bq', label: 'Đơn giá BQ', type: 'num', width: 130 }, { key: 'ref', label: 'Đơn giá chuẩn', type: 'num', width: 130 }, { key: 'uMin', label: 'Đơn giá thấp nhất', type: 'num', width: 140 }, { key: 'uMax', label: 'Đơn giá cao nhất', type: 'num', width: 140 },
      { key: 'nDev', label: 'Dòng lệch', type: 'int', width: 90 }, { key: 'maxDev', label: 'Lệch lớn nhất', type: 'pct', width: 120 }, { key: 'nZero', label: 'Dòng cost = 0', type: 'int', width: 120 },
      { key: 'flag', label: 'Trạng thái', type: 'status', width: 190 }];
    mountTable($('#t-mc'), { columns: mcCols, rows: mc.materials, filterKey: 'flag', height: 420, totals: ['cost'], onExport: exportTable('01_DON_GIA_XUAT_NVL_MI_M', mcCols) });
  }
  if (c.dq && c.dq.pcLots && c.dq.pcLots.length && $('#t-dq-pc')) {
    const pcCols = [{ key: 'erp', label: 'Hệ', width: 60 }, { key: 'pc', label: 'PC No.', width: 130 }, { key: 'prod', label: 'Mã SP', width: 150 }, { key: 'name', label: 'Tên sản phẩm', width: 260 },
      { key: 'unit', label: 'ĐVT', width: 70 }, { key: 'dateISO', label: 'Ngày', width: 100 }, { key: 'qty', label: 'SL hoàn thành', type: 'qty', width: 120 }, { key: 'cost', label: 'Total Cost', type: 'num', width: 150 },
      { key: 'unitCost', label: 'Đơn giá lô', type: 'num', width: 140 }, { key: 'ref', label: 'Đơn giá chuẩn', type: 'num', width: 140 }, { key: 'dev', label: 'Lệch so với chuẩn', type: 'pct', width: 150 },
      { key: 'reason', label: 'Lý do', width: 300 }, { key: 'flag', label: 'Trạng thái', type: 'status', width: 170 }];
    mountTable($('#t-dq-pc'), { columns: pcCols, rows: c.dq.pcLots, filters: [
      { key: 'erp', label: 'Tất cả hệ', aria: 'Lọc theo hệ' },
      { key: 'flag', label: 'Tất cả trạng thái', aria: 'Lọc theo trạng thái', options: [['REVIEW - BẤT THƯỜNG', 'Review - Abnormal'], ['OK - BÌNH THƯỜNG', 'OK - Normal']] },
    ], height: 360, totals: ['cost'], onExport: exportTable('01_DON_GIA_LO_PC_PC_P', pcCols) });
  }
  if (c.dq && c.dq.mcAll && c.dq.mcAll.length && $('#t-dq-mc')) {
    const lnCols = [{ key: 'erp', label: 'Hệ', width: 60 }, { key: 'mi', label: 'MI No.', width: 130 }, { key: 'dateISO', label: 'Ngày', width: 100 }, { key: 'mo', label: 'MO No.', width: 130 },
      { key: 'code', label: 'Mã VT', width: 130 }, { key: 'name', label: 'Tên vật tư', width: 280 }, { key: 'lot', label: 'Lot', width: 120 }, { key: 'qty', label: 'SL xuất', type: 'qty', width: 110 },
      { key: 'cost', label: 'Thành tiền', type: 'num', width: 150 }, { key: 'unitCost', label: 'Đơn giá dòng', type: 'num', width: 140 }, { key: 'ref', label: 'Đơn giá chuẩn', type: 'num', width: 130 },
      { key: 'dev', label: 'Lệch so với chuẩn', type: 'pct', width: 150 }, { key: 'flag', label: 'Trạng thái', type: 'status', width: 170 }];
    mountTable($('#t-dq-mc'), { columns: lnCols, rows: c.dq.mcAll, filters: [
      { key: 'erp', label: 'Tất cả hệ', aria: 'Lọc theo hệ' },
      { key: 'flag', label: 'Tất cả trạng thái', aria: 'Lọc theo trạng thái', options: [['REVIEW - BẤT THƯỜNG', 'Review - Abnormal'], ['OK - BÌNH THƯỜNG', 'OK - Normal']] },
    ], height: 360, totals: ['cost'], onExport: exportTable('01_DON_GIA_XUAT_NVL_MI_M_DONG', lnCols) });
  }
  const dqCols = () => DQ.DQ_FIELDS.map((f, i) => ({ key: f, label: DQ.DQ_HEADERS[i], type: f === 'row' ? 'int' : f === 'qty' ? 'qty' : f === 'amt' ? 'num' : f === 'type' ? 'status' : 'text', width: f === 'name' ? 280 : f === 'type' ? 120 : f === 'doc' ? 150 : 110 }));
  if (c.dq && c.dq.lines.length) {
    const zero = c.dq.lines.filter((l) => l.type === 'ZERO COST'), neg = c.dq.lines.filter((l) => l.type !== 'ZERO COST');
    if (zero.length && $('#t-dq-zero')) mountTable($('#t-dq-zero'), { columns: dqCols(), rows: zero, filterKey: 'report', filterLabel: 'Tất cả báo cáo', filterAria: 'Lọc theo báo cáo', height: 300, totals: ['qty'], onExport: exportTable('01_DU_LIEU_ERP_SL_KHAC0_TOTAL_COST_0', dqCols()) });
    if (neg.length && $('#t-dq-neg')) mountTable($('#t-dq-neg'), { columns: dqCols(), rows: neg, filterKey: 'report', filterLabel: 'Tất cả báo cáo', filterAria: 'Lọc theo báo cáo', height: 300, totals: ['qty'], onExport: exportTable('01_DU_LIEU_ERP_AM_HOAC_SAI_KIEU', dqCols()) });
  }
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
  let ok = 0, errs = [], nNew = 0, nRep = 0; const warns = [];
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
        if (ds.warnings) {
          const w = ds.warnings, shown = w.zeroCostMaterials.slice(0, 40).join(', ') + (w.zeroCostMaterials.length > 40 ? `… (+${w.zeroCostMaterials.length - 40} mã)` : '');
          warns.push(`${ds.fileName}: ${w.zeroCostLines} dòng SL ≠ 0 nhưng Total Cost = 0 (${w.zeroCostMaterials.length} vật tư: ${shown}). Xem và xác nhận ở mục "Dữ liệu ERP bất thường" bên dưới.`);
          audit(`WARN ${ds.erp} / ${ds.report}`, `${ds.fileName} · ${w.zeroCostLines} dòng Total Cost = 0 · ${w.zeroCostMaterials.length} vật tư`);
        }
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
  if (warns.length) msg.push('Cảnh báo (đã import):', ...warns);
  // v1.14.59: the user may have left STEP 1 while the files were read – then show the result as a toast instead of failing
  const planBox = $('#plan');
  if (!planBox) { toast(msg.join(' ') + (errs.length ? ' Lỗi: ' + errs.join('; ') : ''), errs.length ? 'block' : 'pass'); return; }
  planBox.innerHTML = `<div class="alert ${errs.length ? 'block' : 'pass'}">${msg.map(esc).join('<br>')}${errs.length ? '<br><b>Lỗi — file bị chặn, chưa import:</b><br>' + errs.map(esc).join('<br>') : ''}${ok ? '<br>Dữ liệu ERP đã thay đổi — cần chạy lại STEP 2 và STEP 3.' : ''}</div>`;
}

// ---------- STEP 2 ----------
/** v1.14.29: Stock Out LINES marked "tiêu hao" (keys from soLineKeys) – posted Nợ 632 / Có 152 and kept out of PC-P lots. */
const consumeLineKeys = () => (S.d.consumeCfg && Array.isArray(S.d.consumeCfg.lines) ? S.d.consumeCfg.lines : []);
/* v1.14.32: khối tiêu hao NVL – lọc theo phân hệ, dòng đã chọn được tô màu, thống kê theo phân hệ, tiêu đề cố định khi cuộn.
   Tick là lưu ngay và cập nhật tại chỗ (không dựng lại màn hình, nên không mất vị trí cuộn / bộ lọc). */
let consLines = [];                 // dòng Stock Out NVL của lần render gần nhất
const CONS_ERPS = ['T', 'S', 'O'];
/** v1.14.88 (AUD-06): snapshot of the marked lines (kept from the previous save when a line is not in the reports now). */
function consSnapOf(set) {
  const by = new Map(stockOutLines(S.d.datasets, S.period).map((c) => [c.key, c]));
  const old = (S.d.consumeCfg && S.d.consumeCfg.snap) || {};
  return Object.fromEntries([...set].map((k) => [k, by.has(k) ? consSnap(by.get(k)) : old[k] || null]).filter(([, v]) => v));
}
const consRec = () => consumeReconcile(stockOutLines(S.d.datasets, S.period), S.d.consumeCfg);
function consRecHtml(rec) {
  if (rec.ok) return '';
  const f = (x) => (x ? `${esc(x.date || '')} · SL ${fmtNum(x.qty, 4)} · ${fmtNum(x.amt)} VND` : 'không có ảnh chụp');
  const li = [...rec.missing.slice(0, 8).map((m) => `<li><b>Không còn trong báo cáo</b> ${esc(m.key)} (lúc chọn: ${f(m.was)})</li>`),
    ...rec.changed.slice(0, 8).map((c) => `<li><b>Đã đổi số liệu</b> ${esc(c.key)}: ${f(c.was)} → ${f(c.now)}</li>`)].join('');
  return `<div class="alert block" id="cons-rec"><b>Danh sách tiêu hao không còn khớp báo cáo Stock Out đã import lại</b> – ${rec.missing.length} dòng không còn (UNMAPPED), ${rec.changed.length} dòng đổi số liệu. STEP 2 bị chặn cho tới khi xác nhận lại.<ul>${li}</ul>
    <button class="btn" type="button" data-act="cons-reconcile" ${canEditPeriod() ? '' : 'disabled'}>Xác nhận lại danh sách tiêu hao</button> <span class="muted">Bỏ các dòng không còn, nhận số liệu mới cho các dòng đổi; cần lý do.</span></div>`;
}
const consStale = (s2, sel) => !!s2 && JSON.stringify([...(s2.consumeLines || [])].sort()) !== JSON.stringify([...sel].sort());
const consStaleHtml = (stale) => (stale ? '<div class="alert review">Danh sách tiêu hao đã thay đổi sau lần chạy STEP 2 gần nhất – bấm <b>Chạy STEP 2</b> để cập nhật số liệu.</div>' : '');
const consSumTxt = (lines, sel) => `Chọn dòng tiêu hao · ${fmtNum(lines.length)} dòng Stock Out NVL kỳ này · đã chọn ${fmtNum(sel.size)} dòng`;
function consStatBody(lines, sel, s2) {
  const rows = CONS_ERPS.map((erp) => {
    const L = lines.filter((c) => c.erp === erp), P = L.filter((c) => sel.has(c.key));
    const hit = s2 && s2.summary ? s2.summary.find((x) => x.erp === erp) : null;
    return { erp, n: L.length, nSel: P.length, amt: L.reduce((a, c) => a + c.amt, 0), selAmt: P.reduce((a, c) => a + c.amt, 0), posted: s2 ? (hit ? hit.cons || 0 : 0) : null };
  });
  const sumOf = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  rows.push({ erp: 'TOTAL', n: sumOf('n'), nSel: sumOf('nSel'), amt: sumOf('amt'), selAmt: sumOf('selAmt'), posted: s2 ? sumOf('posted') : null });
  return rows.map((r) => {
    const tot = r.erp === 'TOTAL', pct = r.amt ? r.selAmt / r.amt : 0;
    return `<tr class="${tot ? 'tot' : ''}"><td>${tot ? 'Tổng' : `<span class="erp erp-${r.erp}">${r.erp}</span>`}</td><td class="r">${fmtNum(r.n)}</td><td class="r">${fmtNum(r.nSel)}</td><td class="r">${fmtNum(r.amt)}</td><td class="r"><b>${fmtNum(r.selAmt)}</b></td><td class="r">${fmtNum(pct * 100, 2)} %</td><td class="r">${r.posted === null ? '<span class="muted">chưa chạy STEP 2</span>' : fmtNum(r.posted)}</td></tr>`;
  }).join('');
}
function consumptionSection(s2) {
  const hasSO = ['T', 'O', 'S'].some((e) => S.d.datasets[`STOCK OUT-${e}`]);
  if (!hasSO) return '';
  const lines = stockOutLines(S.d.datasets, S.period); consLines = lines;
  const sel = new Set(consumeLineKeys());
  const rowsHtml = lines.map((c) => {
    const on = sel.has(c.key);
    return `<tr class="${on ? 'is-cons' : ''}" data-q="${esc((c.doc + ' ' + c.item + ' ' + c.name).toLowerCase())}" data-erp="${esc(c.erp)}">
      <td class="c"><input type="checkbox" data-cons="${esc(c.key)}" ${on ? 'checked' : ''} aria-label="Tiêu hao ${esc(c.doc)} dòng ${esc(c.line)}"></td>
      <td><span class="erp erp-${c.erp}">${c.erp}</span></td><td>${esc(c.doc)}</td><td class="r">${esc(c.line)}</td><td>${esc(c.item)}</td><td>${esc(c.name)}</td><td>${esc(c.loc)}</td><td class="r">${fmtNum(c.amt)}</td></tr>`;
  }).join('');
  return `<section class="cons-card">
    <h2>Tiêu hao NVL (consumption)</h2>
    <p class="muted">Dòng Stock Out được đánh dấu <b>tiêu hao</b> không phân bổ vào lô PC-P; số tiền ghi thẳng <b>Nợ 632 / Có 152</b>. Tick là lưu ngay, chỉ có hiệu lực trong kỳ này. Sau khi đổi lựa chọn, <b>chạy lại STEP 2</b> để áp dụng.</p>
    ${consRecHtml(consRec())}
    <div id="cons-stale">${consStaleHtml(consStale(s2, sel))}</div>
    <div class="cons-wrap-stats"><table class="cp cons-stats" id="cons-stats"><thead><tr><th>Phân hệ</th><th class="r">Dòng Stock Out NVL</th><th class="r">Dòng tiêu hao</th><th class="r">Giá trị Stock Out NVL</th><th class="r">Giá trị tiêu hao (đang chọn)</th><th class="r">% tiêu hao</th><th class="r">Đã ghi 632 / 152 (STEP 2 gần nhất)</th></tr></thead><tbody>${consStatBody(lines, sel, s2)}</tbody></table></div>
    <details class="cons-pick" ${sel.size ? 'open' : ''}>
      <summary id="cons-sum-txt">${consSumTxt(lines, sel)}</summary>
      ${lines.length ? `<div class="cons-bar">
        <label>Phân hệ<select id="cons-erp"><option value="ALL">Tất cả (T, S, O)</option>${CONS_ERPS.map((e) => `<option value="${e}">Hệ ${e}</option>`).join('')}</select></label>
        <label class="grow">Tìm kiếm<input type="search" id="cons-q" placeholder="Chứng từ, mã vật tư, tên…"></label>
        <button class="btn ghost" type="button" id="cons-all">Chọn tất cả đang hiện</button>
        <button class="btn ghost" type="button" id="cons-none">Bỏ chọn đang hiện</button>
        <span class="muted cons-vis" id="cons-vis"></span></div>
        <div class="cons-wrap"><table class="cp s2-cons"><thead><tr><th class="c">Tiêu hao</th><th>Hệ</th><th>Chứng từ</th><th class="r">Dòng</th><th>Item Code</th><th>Tên vật tư</th><th>Location</th><th class="r">Stock Out (VND)</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`
      : emptyNote('Chưa có dòng Stock Out vật tư (non-FG) trong kỳ.')}
    </details>
  </section>`;
}
function bindConsSection(el) {
  const root = el.querySelector('.cons-card'); if (!root) return;
  const apply = () => {
    const erp = root.querySelector('#cons-erp').value, q = root.querySelector('#cons-q').value.trim().toLowerCase();
    let n = 0;
    root.querySelectorAll('.s2-cons tbody tr[data-q]').forEach((tr) => {
      const show = (erp === 'ALL' || tr.dataset.erp === erp) && (!q || tr.dataset.q.includes(q));
      tr.style.display = show ? '' : 'none'; if (show) n++;
    });
    root.querySelector('#cons-vis').textContent = `Đang hiện ${fmtNum(n)} dòng`;
  };
  const refresh = () => {
    const sel = new Set(consumeLineKeys());
    root.querySelector('#cons-stats tbody').innerHTML = consStatBody(consLines, sel, S.d.step2);
    root.querySelector('#cons-sum-txt').textContent = consSumTxt(consLines, sel);
    root.querySelector('#cons-stale').innerHTML = consStaleHtml(consStale(S.d.step2, sel));
  };
  const save = (set, why) => {
    S.d.consumeCfg = { lines: [...set].sort(), snap: consSnapOf(set), by: who(), at: nowISO() };
    audit('STEP 2 - TIÊU HAO NVL', `${why} · ${who()}`);
    markDirty('consumeCfg', 'audit');
  };
  root.querySelectorAll('input[data-cons]').forEach((cb) => cb.addEventListener('change', () => {
    if (!guardMutate()) { cb.checked = !cb.checked; return; }
    const key = cb.dataset.cons, on = cb.checked;
    const set = new Set(consumeLineKeys()); if (on) set.add(key); else set.delete(key);
    save(set, `${key} · ${on ? 'BẬT tiêu hao (Nợ 632 / Có 152)' : 'TẮT tiêu hao (phân bổ vào lô PC)'}`);
    cb.closest('tr').classList.toggle('is-cons', on);
    refresh();
  }));
  const bulk = (on) => {
    if (!guardMutate()) return;
    const set = new Set(consumeLineKeys()); let n = 0;
    root.querySelectorAll('.s2-cons tbody tr[data-q]').forEach((tr) => {
      if (tr.style.display === 'none') return;
      const cb = tr.querySelector('input[data-cons]'); if (cb.checked === on) return;
      cb.checked = on; tr.classList.toggle('is-cons', on); if (on) set.add(cb.dataset.cons); else set.delete(cb.dataset.cons); n++;
    });
    if (!n) { toast('Không có dòng nào cần đổi trong danh sách đang hiện.', 'review'); return; }
    const hs = root.querySelector('#cons-erp').value;
    save(set, `${on ? 'BẬT' : 'TẮT'} hàng loạt ${n} dòng (${hs === 'ALL' ? 'tất cả hệ' : 'hệ ' + hs})`);
    refresh(); toast(`${on ? 'Đã chọn' : 'Đã bỏ chọn'} ${n} dòng tiêu hao. Chạy lại STEP 2 để áp dụng.`, 'review');
  };
  root.querySelector('#cons-all')?.addEventListener('click', () => bulk(true));
  root.querySelector('#cons-none')?.addEventListener('click', () => bulk(false));
  root.querySelector('#cons-erp')?.addEventListener('change', apply);
  root.querySelector('#cons-q')?.addEventListener('input', apply);
  apply();
}
VIEWS.step2 = (el) => {
  const st = statusAll(); const s2 = S.d.step2;
  const cls = s2 ? step2Classification(S.d.datasets, S.period, s2, S.d.register) : null;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 2 · Phân bổ Stock Out vào lô PC</h1><p class="lead">Stock Out NVL được phân bổ vào các lô PC-P theo quy tắc khách hàng / job code / location. Stock Out thành phẩm (FG) không phải NVL — được tách sang sổ Rework (2B).</p></div>
      <div class="result"><span>Kết quả</span>${pill(st.s2c.status)}<small>${esc(st.s2c.okText)}</small></div></header>
    <div class="row"><button class="btn" data-act="run-step2" type="button">Chạy STEP 2</button>${s2 ? `<button class="btn ghost" data-act="s2-report" type="button">Xuất Excel tổng hợp phân bổ</button><span class="muted">Lần chạy gần nhất ${fmtTs(s2.runAt)}</span>` : ''}${s2 && st.s2c.rows.some((r) => String(r.status).startsWith('BLOCK - APPROVAL')) ? `<button class="btn danger ghost" data-act="approve-step2-fallback" type="button" ${canEditPeriod() ? '' : 'disabled'}>Xác nhận fallback &gt;5%</button>` : ''}</div>
    ${consumptionSection(s2)}
    ${s2 ? `
    <div class="s2-stack">
      <div class="s2-block"><h2>Đối chiếu theo hệ nguồn</h2><table class="cp s2-rec"><thead><tr><th rowspan="2">Hệ nguồn</th><th class="r" rowspan="2">Stock Out nguồn</th><th class="grp" colspan="3">Đã phân bổ vào lô PC của hệ</th><th class="r" rowspan="2">Tổng đã phân bổ</th><th class="r" rowspan="2">Chưa phân bổ</th><th class="r" rowspan="2">Chênh lệch</th><th rowspan="2">Trạng thái</th></tr>
        <tr><th class="r sys-col"><span class="erp erp-T">T</span></th><th class="r sys-col"><span class="erp erp-S">S</span></th><th class="r sys-col"><span class="erp erp-O">O</span></th></tr></thead><tbody>
      ${(() => {
        // allocated amount by source system × system of the receiving PC lot (detail col 0 = source, 6 = PC system, 8 = PC No., 15 = amount)
        const m = {}; for (const x of s2.detail) if (x[8]) { const k = x[0] + '>' + x[6]; m[k] = (m[k] || 0) + num(x[15]); }
        const cell = (src, t) => (src === 'TOTAL' ? ['T', 'S', 'O'].reduce((a, e) => a + (m[e + '>' + t] || 0), 0) : m[src + '>' + t] || 0);
        return [...s2.summary, s2.total].map((r) => `<tr class="${r.erp === 'TOTAL' ? 'tot' : ''}"><td>${r.erp === 'TOTAL' ? 'Tổng' : `<span class="erp erp-${r.erp}">${r.erp}</span>`}</td><td class="r">${v(r.src)}</td>${['T', 'S', 'O'].map((t) => { const x = cell(r.erp, t); return `<td class="r sys-col${Math.abs(x) < 0.005 ? ' zero' : ''}">${v(x)}</td>`; }).join('')}<td class="r">${v(r.alloc)}</td><td class="r">${v(r.unalloc)}</td><td class="r">${v(r.diff)}</td><td>${pill(r.status)}</td></tr>`).join('');
      })()}
      </tbody></table><p class="muted">Hệ S không có lô PC-P nên Stock Out hệ S được phân bổ sang lô hệ T (location DS/DN → mã SP*) hoặc hệ O (VE*, MK*); location khác chia đều cho T + O.</p></div>
      <div class="s2-block"><h2>Phân loại Stock Out (NVL / FG)</h2><table class="cp s2-cls"><tbody>
        <tr><td>Tổng Stock Out thô</td><td class="r">${v(cls.totalRaw)}</td><td>Số dòng FG</td><td class="r">${cls.fgRows}</td></tr>
        <tr><td>NVL / non-FG đủ điều kiện</td><td class="r">${v(cls.rmEligible)}</td><td>SL FG rework</td><td class="r">${fmtNum(cls.fgQty)}</td></tr>
        <tr><td>FG Rework – giá ERP (memo)</td><td class="r">${v(cls.fgRef)}</td><td>FG phân bổ vào PC</td><td class="r">${v(cls.fgAllocated)}</td></tr>
        <tr><td>NVL đã phân bổ vào PC</td><td class="r">${v(cls.allocatedRM)}</td><td>Kiểm tra phân loại</td><td>${pill(cls.classCheck)}</td></tr>
        <tr><td>NVL tiêu hao (Nợ 632 / Có 152)</td><td class="r">${v(cls.consumedRM)}</td><td></td><td></td></tr>
        <tr><td>Chênh lệch phân bổ NVL</td><td class="r">${v(cls.rmDiff)}</td><td>Cổng STEP 2</td><td>${pill(cls.gate)}</td></tr>
      </tbody></table></div>
    </div>
    <h2>Checkpoint</h2>${cpTable(st.s2c.rows)}
    <details><summary>Quy tắc phân bổ</summary><table class="cp"><thead><tr><th>Ưu tiên</th><th>Nguồn</th><th>Điều kiện nguồn</th><th>Đích</th><th>Nhóm lô đích</th><th>Tiêu thức</th><th>Xử lý</th></tr></thead><tbody>
      ${STEP2_RULES.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td><td>${esc(r[7])}</td></tr>`).join('')}</tbody></table></details>
    <h2>Số tiền theo rule</h2><p class="muted">Toàn bộ quy tắc phân bổ, kể cả quy tắc không phát sinh trong kỳ (= 0). Cột Ưu tiên đối chiếu với bảng "Quy tắc phân bổ" (1–9); R0 = nhóm 0 VND, RX = Customer hệ T không nhận diện được (chưa phân bổ). Dự phòng = R4c và R6, được tính vào ngưỡng 5%.</p><div id="t-rule"></div>
    <h2>Chi tiết phân bổ</h2><p class="muted"><label>Lọc theo rule: <select id="s2-rule"><option value="">Tất cả rule</option>${ruleSummary(s2).map((r) => `<option value="${esc(r.code)}">${esc(r.code)} · ${esc(r.label)}${r.used ? '' : ' (không phát sinh)'}</option>`).join('')}</select></label></p><div id="t-detail"></div>
    <h2>Kết quả theo lô PC-P (T và O)</h2><div id="t-pc"></div>` : emptyNote('Chưa có kết quả. Cần đủ PC-P-T, PC-P-O và STOCK OUT T/S/O rồi bấm Chạy STEP 2.')}
  </section>`;
  bindConsSection(el);
  if (s2) {
    const dc = STEP2_DETAIL_HEADERS.map((h, i) => ({ key: i, label: h, type: [4, 13, 15].includes(i) ? 'num' : i === 14 ? 'pct' : i === 3 ? 'int' : i === 16 ? 'status' : 'text', width: [11].includes(i) ? 260 : [17].includes(i) ? 180 : [4, 13, 15].includes(i) ? 140 : 110 }));
    const rs = ruleSummary(s2);
    // v1.14.22: every rule is listed (0 when it has no Stock Out this period) so the whole rule book is visible
    const ruleCols = [
      { key: 0, label: 'Ưu tiên', width: 70 }, { key: 1, label: 'Rule', width: 60 }, { key: 2, label: 'Hệ nguồn', width: 80 }, { key: 3, label: 'Mô tả', width: 330 },
      { key: 4, label: 'Loại', width: 100 }, { key: 5, label: 'Phát sinh kỳ này', type: 'status', width: 150 }, { key: 6, label: 'Nhóm nguồn', type: 'int', width: 95 },
      { key: 7, label: 'Số dòng PC', type: 'int', width: 95 }, { key: 8, label: 'Stock Out nguồn', type: 'num', width: 145 },
      // v1.14.54: allocated amount split by the system of the receiving PC lot
      { key: 9, label: 'Vào lô hệ T', type: 'num', width: 140 }, { key: 10, label: 'Vào lô hệ S', type: 'num', width: 120 }, { key: 11, label: 'Vào lô hệ O', type: 'num', width: 140 },
      { key: 12, label: 'Tổng đã phân bổ', type: 'num', width: 150 }, { key: 13, label: '% tổng phân bổ', type: 'pct', width: 120 },
    ];
    mountTable($('#t-rule'), { columns: ruleCols, rows: rs.map((r) => [r.screen, r.code, r.erp, r.label, r.kind, r.used ? 'CÓ' : 'KHÔNG PHÁT SINH', r.groups, r.lines, r.src, r.allocT, r.allocS, r.allocO, r.alloc, r.share]), filterKey: 5, totals: [6, 7, 8, 9, 10, 11, 12, 13], height: 470,
      onExport: exportTable('02_STEP2_SO_TIEN_THEO_RULE', ruleCols) });
    // Detail table: column 18 = rule code (derived from the note), filtered by the rule selector
    const dcRule = [...dc, { key: 18, label: 'Rule', width: 80 }];
    const mountDetail = () => {
      const code = ($('#s2-rule') || {}).value || '';
      const rows = s2.detail.map((r) => [...r, ruleOf(r[17]).code]).filter((r) => !code || r[18] === code);
      mountTable($('#t-detail'), { columns: dcRule, rows, filterKey: 16, totals: [15], height: 460, onExport: exportTable('03_STOCK_OUT_ALLOCATION', dcRule) });
    };
    mountDetail();
    $('#s2-rule').addEventListener('change', mountDetail);
    const pc = [
      { key: 'erp', label: 'Hệ', width: 50 }, { key: 'pcNo', label: 'PC No.', width: 120 }, { key: 'mo', label: 'MO No.', width: 120 }, { key: 'prod', label: 'Product Code', width: 150 },
      { key: 'name', label: 'Product Name', width: 260 }, { key: 'loc', label: 'Location', width: 100 }, { key: 'qty', label: 'SL hoàn thành', type: 'qty', width: 100 },
      { key: 'cost', label: 'Total Cost', type: 'num', width: 150 }, { key: 'allocT', label: 'Stock Out từ T', type: 'num', width: 130 }, { key: 'allocS', label: 'Stock Out từ S', type: 'num', width: 130 },
      { key: 'allocO', label: 'Stock Out từ O', type: 'num', width: 130 }, { key: 'alloc', label: 'Tổng Stock Out', type: 'num', width: 140 }, { key: 'rmIncl', label: 'RM gồm Stock Out', type: 'num', width: 150 }, { key: 'src', label: 'Nguồn', width: 70 },
    ];
    mountTable($('#t-pc'), { columns: pc, rows: s2.pc, totals: ['cost', 'allocT', 'allocS', 'allocO', 'alloc', 'rmIncl'], height: 420, onExport: exportTable('PC-P_StockOut', pc) });
  }
};

/** v1.14.77: STEP 3 keeps the result of the STEP 2 run it was built on. When STEP 2 runs again (e.g. after the consumption
 *  lines changed), STEP 3 is rebuilt at once so WIP never keeps lines that are now marked as consumption. */
function refreshStep3AfterStep2() {
  if (!S.d.step3) return '';
  try {
    const latestImport = step1Status(datasetsMeta()).latestImport;
    // same gate as doStep3: no STEP 3 while STEP 2 still has a BLOCK checkpoint
    const c2 = step2Controls({ period: S.period, step2: S.d.step2, register: S.d.register, latestImport });
    if (String(c2.status).startsWith('BLOCK')) throw new Error('STEP 2 còn checkpoint BLOCK');
    S.d.step3 = runStep3(S.d.datasets, S.d.opening, S.d.step2, S.period, latestImport);
    markDirty('step3');
    return ' STEP 3 đã tính lại theo STEP 2 mới.';
  } catch (e) {
    S.d.step3 = null; markDirty('step3');
    return ` STEP 3 cũ đã bỏ (${e.message}) – chạy lại STEP 3.`;
  }
}

function doStep2() {
  const dq = DQ.erpAnomalies(S.d.datasets, S.period);
  if (DQ.anomalyStatus(dq, S.d.importAck) === 'BLOCK - CONFIRM') {
    toast(`STEP 2 bị chặn: STEP 1 có kết quả kiểm tra dữ liệu ERP chưa được xác nhận – ${DQ.blockingSummary(DQ.blockingParts(dq, S.d.importAck))}. Mở STEP 1 → "Kiểm tra dữ liệu ERP", rà soát rồi bấm Xác nhận.`, 'block');
    location.hash = '#step1'; return;
  }
  const periodIssues = outOfPeriodRows(S.d.datasets, S.period);
  if (periodIssues.length) {
    const sample = periodIssues.slice(0, 3).map((x) => {
      const p = []; if (x.outside) p.push(`ngoài kỳ ${x.outside}`); if (x.blank) p.push(`trống ngày ${x.blank}`); if (x.invalid) p.push(`ngày lỗi ${x.invalid}`); if (x.missingDateColumn) p.push(`thiếu cột Date ${x.missingDateColumn}`);
      return `${x.key}: ${p.join(', ')}${x.months && x.months.length ? ' [' + x.months.join(', ') + ']' : ''}`;
    }).join('; ');
    toast(`STEP 2 bị chặn bởi kiểm soát ngày ERP kỳ ${S.period}. ${sample}${periodIssues.length > 3 ? '…' : ''}. Sửa / xuất lại báo cáo rồi import lại.`, 'block');
    return;
  }
  // v1.14.88 (audit AUD-06): marked lines that left or changed with a re-import must be confirmed first
  const rec = consRec();
  if (!rec.ok) { toast(`STEP 2 bị chặn: danh sách tiêu hao NVL không còn khớp báo cáo Stock Out (${rec.missing.length} dòng không còn, ${rec.changed.length} dòng đổi số liệu). Xem khối Tiêu hao NVL → Xác nhận lại danh sách tiêu hao.`, 'block'); return; }
  try {
    const s2 = runStep2(S.d.datasets, S.period, { consumeLines: consumeLineKeys() });
    S.d.step2 = s2;
    const bf = S.d.register ? S.d.register.rows.filter((r) => r.active === 'B/F').map(bfFromRow) : (S.d.bfSeed || []);
    const bfSrc = S.d.register ? S.d.register.bfSrc : null;
    S.d.register = buildReworkRegister(S.d.datasets, S.period, S.d.register ? S.d.register.rows : [], bf);
    if (bfSrc) S.d.register.bfSrc = bfSrc;
    audit('STEP 2 - STOCK OUT (RM / FG SPLIT)', `${s2.status} · NVL phân bổ ${fmtNum(s2.total.alloc)} · FG rework ${S.d.register.stats.rows} dòng`);
    const s3note = refreshStep3AfterStep2();
    markDirty('step2', 'register', 'audit');
    toast(`STEP 2 xong: ${s2.status}. Đã phân bổ ${fmtNum(s2.total.alloc)} VND.${s3note}`, s2.status === 'PASS' ? 'pass' : 'review');
  } catch (e) { toast('STEP 2 dừng: ' + e.message, 'block'); }
  render();
}
function bfFromRow(r) {
  return { rid: r.rid, erp: r.erp, doc: r.doc, srcRow: r.srcRow, issueDate: r.issueDate, fg: r.fg, fgName: r.fgName, itemType: r.itemType, loc: r.loc, uom: r.uom, bfQty: r.bfQty, carryCost: r.bfCost, reason: r.reason, jobKey: r.jobKey, rwType: r.rwType, rwStatus: r.rwStatus, pcNo: r.pcNo, outFG: r.outFG, compDate: r.compDate, compQty: r.compQty, scrapQty: r.scrapQty, note: r.note, originPeriod: r.originPeriod, scrapTreat: r.scrapTreat, woAccount: r.woAccount, dispNote: r.dispNote, dispBy: r.dispBy, dispAt: r.dispAt };
}

// ---------- 2B register ----------
/** v1.14.31 / v1.14.32: khối tiêu dùng nội bộ (CONSUMPTION) – tick, lưu nháp, xác nhận, hoàn tác. Dòng được tick / đã xác nhận được tô màu. */
const cfgChecked = () => [...document.querySelectorAll('input[data-cfg-fg]:checked')].map((i) => i.dataset.cfgFg);
function cfgSumText(root) {
  const boxes = [...root.querySelectorAll('input[data-cfg-fg]:checked')];
  return `Đã tick ${fmtNum(boxes.length)} dòng · SL ${fmtNum(boxes.reduce((a, b) => a + num(b.dataset.qty), 0))}`;
}
function consFgPanel(reg) {
  const canEdit = canEditPeriod();
  const draft = S.d.consFg || { rids: [], reason: '' };
  const draftSet = new Set(draft.rids || []);
  const rows = reg.rows.filter((r) => consFgEligible(r) || consFgConfirmed(r));
  const confirmed = reg.rows.filter(consFgConfirmed);
  const pending = consFgPendingCount(reg.rows);
  const fifoSum = confirmed.filter((r) => utxt(r.fifoStatus) === 'PASS').reduce((a, r) => a + num(r.fifoCost), 0);
  const dis = canEdit ? '' : 'disabled';
  const tr = (r) => {
    const conf = consFgConfirmed(r), on = draftSet.has(r.rid);
    const chk = conf ? '<span class="pill s-pass">ĐÃ XÁC NHẬN</span>' : `<input type="checkbox" data-cfg-fg="${esc(r.rid)}" data-qty="${num(r.issueQty)}" ${on ? 'checked' : ''} ${dis} aria-label="Chọn ${esc(r.rid)}">`;
    const undo = conf && canEdit ? `<button class="btn ghost" type="button" data-act="cfg-fg-undo" data-rid="${esc(r.rid)}">Hoàn tác</button>` : '';
    return `<tr class="${conf ? 'is-done' : on ? 'is-cons' : ''}" data-q="${esc(`${r.rid} ${r.fg} ${r.fgName || ''}`.toLowerCase())}"><td class="c">${chk}</td><td>${esc(r.rid)}</td><td>${fmtCell(r.issueDate, 'date')}</td><td>${esc(r.fg)}</td><td>${esc(r.fgName || '')}</td><td class="r">${fmtNum(num(r.issueQty))}</td><td class="r">${fmtNum(num(r.erpRef))}</td><td class="r">${conf ? fmtNum(num(r.fifoCost)) : '–'}</td><td>${conf ? pill(r.fifoStatus) : ''}</td><td>${undo}</td></tr>`;
  };
  return `<section class="cons-card cfg-fg">
    <h2>Tiêu dùng nội bộ (632 / 155)</h2>
    <p class="muted">FG xuất ra dùng nội bộ: không bán và không đi qua rework WIP (154). Tick dòng → nhập lý do → <b>Lưu nháp</b> (chỉ lưu danh sách) hoặc <b>Xác nhận tiêu dùng nội bộ</b> (chuyển các dòng sang CONSUMPTION). Sau đó chạy <b>RUN FIFO (STEP 5.2)</b> để tính giá theo ngày xuất.</p>
    ${pending ? `<div class="alert review">${fmtNum(pending)} dòng tiêu dùng nội bộ chưa được tính giá – chạy RUN FIFO (STEP 5.2) để ghi Nợ 632 / Có 155.</div>` : ''}
    ${canEdit ? '' : '<div class="alert review">Kỳ đã đóng hoặc bạn không có quyền sửa – chỉ xem.</div>'}
    <div class="kpis">${kpiN('Đã xác nhận (dòng)', confirmed.length, { sub: 'Dòng FG chuyển sang tiêu dùng nội bộ' })}${kpi('Giá FIFO đã tính (632 / 155)', fifoSum, false, { tone: 'out', sub: 'Nợ 632 / Có 155 sau STEP 5.2' })}</div>
    ${rows.length ? `<div class="cons-bar">
        <label class="grow">Tìm kiếm<input type="search" id="cfg-q" placeholder="Rework ID, mã FG, tên…"></label>
        <span class="muted cons-vis" id="cfg-sum"></span></div>
      <div class="cons-wrap"><table class="cp"><thead><tr><th class="c">Chọn</th><th>Rework ID</th><th>Ngày xuất</th><th>FG Code</th><th>Tên FG</th><th class="r">SL xuất</th><th class="r">ERP memo</th><th class="r">Giá FIFO (VND)</th><th>Trạng thái FIFO</th><th></th></tr></thead>
      <tbody>${rows.map(tr).join('')}</tbody></table></div>
      <div class="cons-bar cfg-act">
        <label class="grow">Lý do<input id="cfg-reason" class="cfg-reason-in" value="${esc(draft.reason || '')}" ${dis} placeholder="Bắt buộc khi xác nhận (≥ 5 ký tự), ví dụ: Dùng làm mẫu thử nội bộ"></label>
        <button class="btn ghost" type="button" data-act="cfg-fg-save" ${dis}>Lưu nháp</button>
        <button class="btn" type="button" data-act="cfg-fg-confirm" ${dis}>Xác nhận tiêu dùng nội bộ</button>
      </div>` : emptyNote('Chưa có dòng FG nào đang hoạt động trong kỳ này để chọn tiêu dùng nội bộ.')}
  </section>`;
}
function bindConsFg(el) {
  const root = el.querySelector('.cfg-fg'); if (!root) return;
  const sum = () => { const t = root.querySelector('#cfg-sum'); if (t) t.textContent = cfgSumText(root); };
  root.querySelectorAll('input[data-cfg-fg]').forEach((cb) => cb.addEventListener('change', () => { cb.closest('tr').classList.toggle('is-cons', cb.checked); sum(); }));
  const q = root.querySelector('#cfg-q');
  if (q) q.addEventListener('input', () => {
    const t = q.value.trim().toLowerCase();
    root.querySelectorAll('tbody tr[data-q]').forEach((row) => { row.style.display = !t || row.dataset.q.includes(t) ? '' : 'none'; });
  });
  sum();
}
VIEWS.rework = (el) => {
  const reg = S.d.register;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 2B · Sổ FG Stock Out / Rework</h1><p class="lead">Sổ gồm FG xuất đi rework (bảng bên dưới) và FG tiêu dùng nội bộ (khối trên, có xác nhận riêng). Cập nhật loại, trạng thái và lô PC rework ở bảng; dữ liệu nhập tay được giữ khi chạy lại STEP 2. Giá trị FIFO được tính khi chạy STEP 5.2 (FIFO rework). Xử lý dòng treo (hoàn thành / trả về kho / ra chi phí) ở <a href="#rwflow">màn hình 5B · Xử lý Rework</a>.</p></div>
    ${reg ? `<div class="result"><span>Kiểm tra dữ liệu nhập</span>${pill(reg.rows.filter((r) => String(r.inputCheck).startsWith('BLOCK')).length ? 'BLOCK' : 'PASS')}<small>${reg.stats.rows} dòng kỳ này · ${reg.stats.bfRows} dòng B/F</small></div>` : ''}</header>
    ${reg ? `<div class="kpis">${kpiN('Số lượng FG xuất', reg.stats.issueQty, { sub: `${fmtNum(reg.rows.length) || 0} dòng trong sổ` })}${kpi('Giá trị ERP (memo)', reg.stats.erpRef, false, { tone: 'base', sub: 'Chỉ để đối chiếu, không dùng tính giá' })}${kpi('Giá trị FIFO (dùng tính giá)', reg.rows.filter((r) => r.active === 'Y').reduce((a, r) => a + num(r.fifoCost), 0), false, { tone: 'out', sub: 'Tính khi chạy STEP 5.2' })}${kpi('Rework WIP chuyển sang (B/F)', reg.stats.bfCost, false, { tone: 'base', sub: 'Số dư rework kỳ trước' })}${kpi('Closing Rework WIP', reg.rows.reduce((a, r) => a + num(r.closingWIP), 0), true, { tone: 'res', sub: 'TK 154 rework cuối kỳ' })}</div>
    ${consFgPanel(reg)}
    <div id="t-rw"></div>` : emptyNote('Sổ được tạo khi chạy STEP 2.', 'step2', 'Mở STEP 2')}
  </section>`;
  if (!reg) return;
  bindConsFg(el);
  const types = { issueQty: 'qty', erpRef: 'num', compQty: 'qty', scrapQty: 'qty', fifoQty: 'qty', fifoCost: 'num', closingWIP: 'num', carryIn: 'num', bfQty: 'qty', bfCost: 'num', issueDate: 'date', compDate: 'date', srcRow: 'int', inputCheck: 'status', fifoStatus: 'status', lastFifoRun: 'date' };
  const editable = { rwType: ['NORMAL', 'ABNORMAL'], rwStatus: ['OPEN', 'HOLD', 'COMPLETED', 'RETURNED TO FG', 'WRITTEN OFF', 'CONSUMPTION'], pcNo: null, outFG: null, compDate: null, compQty: null, scrapQty: null, note: null };
  const cols = RW_FIELDS.map((f, i) => ({ key: f, label: RW_HEADERS[i], type: types[f] || 'text', width: f === 'rid' ? 250 : f === 'fgName' ? 240 : f === 'note' ? 200 : ['inputCheck', 'fifoStatus'].includes(f) ? 190 : 110, editable: f in editable, options: editable[f] || undefined }))
    .filter((c) => !['period'].includes(c.key));
  mountTable($('#t-rw'), {
    columns: cols, rows: reg.rows, filterKey: 'inputCheck', height: 520, totals: ['issueQty', 'erpRef', 'closingWIP', 'carryIn'],
    onExport: exportTable('03_FG_REWORK_INPUT', cols),
    onEdit: !canEditPeriod() ? undefined : (row, k, val) => {
      if (k === 'rwStatus' && (utxt(val) === 'CONSUMPTION' || consFgConfirmed(row))) {
        // v1.14.31: tiêu dùng nội bộ chỉ thao tác ở khối phía trên (xác nhận / hoàn tác), không qua dropdown của bảng
        toast(consFgConfirmed(row) && utxt(val) !== 'CONSUMPTION' ? 'Dòng đang là tiêu dùng nội bộ: dùng nút Hoàn tác ở khối phía trên.' : 'Chọn tiêu dùng nội bộ ở khối "Tiêu dùng nội bộ (632 / 155)" phía trên.', 'review');
        render(); return;
      }
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
const kpiN = (label, n, opts = {}) => `<div class="kpi t-${opts.tone || 'cnt'}"><span>${esc(label)}</span><b>${n === undefined || n === null ? '—' : typeof n === 'string' ? esc(n) : n === 0 ? '0' : fmtNum(n)}</b><small>${opts.sub || ''}</small></div>`;

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
  S.prevDrift = []; S.prevVerifyErr = '';
  toast(`Đã roll forward từ kỳ ${prev}${reason === 'CLOSED' ? '' : ' (kỳ trước chưa đóng)'}: ${done.includes('opening') ? 'Opening WIP' : ''}${done.includes('register') ? ' + Rework WIP B/F' : ''}.`, reason === 'CLOSED' ? 'pass' : 'review');
  render(); checkPrevDrift();
}
/** Has the previous period changed since its balances were rolled into this one? (sets S.prevDrift) */
/**
 * v1.14.86 (audit AUD-02 / AUD-03 / NEW-05): another period as the cloud holds it NOW, not this device's cache.
 * Signed in: the cloud revision is read; when this device's copy is older (or missing) the listed blobs are loaded from
 * the cloud. Returns { d, source: 'OPEN'|'LOCAL'|'CLOUD', verified, rev, offline, error }.
 * verified = false with an error means the cloud could not be read – callers must not treat the local copy as current.
 */
async function readPeriodVerified(p, names = null) {
  if (p === S.period) return { d: S.d, source: 'OPEN', verified: true };
  const local = await loadLocal(p);
  let meta = null, metaError = null;
  if (store.cloud.user) { try { meta = await store.cloudMeta(p); } catch (e) { metaError = (e && e.message) || String(e) || 'error'; } }
  const localRev = store.cloud.user ? await store.localGet(lk(p, 'cloudRev')) : null;
  const plan = SP.periodReadPlan({ signedIn: !!store.cloud.user, metaError, meta, localRev });
  if (plan === 'OFFLINE') return { d: local, source: 'LOCAL', verified: false, offline: true };
  if (plan === 'ERROR') return { d: local, source: 'LOCAL', verified: false, error: metaError };
  if (plan === 'NO_CLOUD') return { d: local, source: 'LOCAL', verified: true, rev: null };
  if (plan === 'LOCAL') return { d: local, source: 'LOCAL', verified: true, rev: meta.rev };
  try {
    const r = await store.cloudLoad(p, () => {}, names);
    const d = emptyData();
    for (const [k, v] of Object.entries((r && r.blobs) || {})) { if (k.startsWith('ds:')) d.datasets[k.slice(3)] = v; else d[k] = v; }
    d.audit = d.audit || [];
    return { d, source: 'CLOUD', verified: true, rev: r.meta.rev, localRev: localRev ?? null };
  } catch (e) { return { d: local, source: 'LOCAL', verified: false, error: (e && e.message) || String(e), rev: meta.rev }; }
}

async function checkPrevDrift() {
  const out = [];
  const op = S.d.opening && S.d.opening.src, bs = S.d.register && S.d.register.bfSrc;
  const fgRoll = S.d.fgOpen && S.d.fgOpen.srcKind === 'ROLL FORWARD' && S.period ? prevPeriod(S.period) : '';
  const p = (op && op.period) || (bs && bs.period) || fgRoll;
  let verifyErr = '';
  S.prevVerifiedPeriod = ''; S.prevVerifiedRev = null;
  if (p) {
    // v1.14.86 (AUD-02): read the previous period as the cloud holds it now; never fall back silently to a stale copy
    const rv = await readPeriodVerified(p, ['step3', 'register', 'closed', 'step5', 'nrvDecision']).catch((e) => ({ verified: false, error: (e && e.message) || String(e) }));
    if (!rv.verified && !rv.offline) verifyErr = `Không xác minh được kỳ ${p} trên cloud (${rv.error || 'không đọc được'}). Số dư đầu kỳ ${S.period} chưa được đối chiếu với số mới nhất của kỳ ${p}; kiểm tra kết nối rồi mở lại màn hình trước khi CLOSE.`;
    if (rv.verified && !rv.offline) { S.prevVerifiedPeriod = p; S.prevVerifiedRev = rv.rev ?? null; }
    const prevD = rv.d;
    if (prevD) {
      if (op && wipFp(prevD.step3) !== op.wipFp) out.push(`Closing WIP kỳ ${p} đã thay đổi sau khi chuyển sang Opening WIP kỳ ${S.period} – roll forward lại.`);
      else if (op && !op.closedAt && isClosedIn(prevD, p)) out.push(`Opening WIP được chuyển khi kỳ ${p} chưa đóng; kỳ ${p} nay đã đóng – roll forward lại để dùng số chính thức.`);
      else if (op && op.closedAt && !isClosedIn(prevD, p)) out.push(`Kỳ ${p} đã MỞ LẠI sau khi số dư được chuyển sang kỳ ${S.period} – đóng lại kỳ ${p}, rồi roll forward lại trước khi đóng kỳ này.`);
      if (bs && bfFp(bfRowsOf(prevD, p)) !== bs.bfFp) out.push(`Rework WIP cuối kỳ ${p} khác số đã chuyển sang B/F kỳ ${S.period}${isClosedIn(prevD, p) ? '' : ' (kỳ trước chưa đóng)'}.`);
      if (fgRoll === p) { const fg = P3.fgOpenDrift(S, prevD, p); if (fg) out.push(fg); }
    }
  }
  const changed = JSON.stringify(out) !== JSON.stringify(S.prevDrift || []) || verifyErr !== (S.prevVerifyErr || '');
  S.prevDrift = out; S.prevVerifyErr = verifyErr;
  if (changed) render();
}

// ---------- STEP 3 ----------
/** PC-P lot cost vs PC-M material ledger (checkpoint 08). Applying aligns PC-P to PC-M; original values are kept for undo. */
function pcBasisPanel() {
  if (!S.d.datasets || !(S.d.datasets['PC-M-T'] || S.d.datasets['PC-M-O'] || S.d.datasets['PC-P-T'] || S.d.datasets['PC-P-O'])) return '';
  const sc = pcBasisScan(S.d.datasets), adj = S.d.pcAdj, intact = !!adj && pcBasisIntact(S.d.datasets, adj.changes);
  const dis = canEditPeriod() ? '' : 'disabled';
  let body = '';
  if (adj) {
    body += `<div class="alert review">Đã điều chỉnh ${adj.changes.length} dòng PC-P về PC-M · tổng ${fmtNum(adj.total)} VND · ${esc(adj.by)} · ${fmtTs(adj.at)} · lý do: ${esc(adj.note)}${intact ? '' : ' — PC-P đã import lại sau điều chỉnh, điều chỉnh không còn khớp dữ liệu.'}</div>`;
    if (intact) body += `<div class="row"><button class="btn danger ghost" data-act="pc-basis-undo" type="button" ${dis}>Hoàn tác điều chỉnh</button></div>`;
  }
  if (sc.onlyPCM.length || sc.onlyPCP.length) {
    body += `<div class="alert block">Có ${sc.onlyPCM.length} PC chỉ có ở PC-M và ${sc.onlyPCP.length} PC chỉ có ở PC-P. Không điều chỉnh tự động được; kiểm tra lại file ERP.</div>`;
  } else if (!sc.lines.length) {
    if (!adj) body += `<p class="muted">PC-M và PC-P khớp theo từng PC và sản phẩm.</p>`;
  } else {
    body += `<p class="muted">Chênh lệch PC-M − PC-P: ${fmtNum(sc.totals.diff)} VND ở ${sc.lines.length} dòng. Áp dụng sẽ đặt Total Cost PC-P bằng PC-M cho từng PC và sản phẩm; số gốc được lưu để hoàn tác.</p>
      <table class="cp"><thead><tr><th>Hệ</th><th>PC No.</th><th>Product Code</th><th>Location</th><th class="r">PC-P</th><th class="r">PC-M</th><th class="r">Điều chỉnh</th></tr></thead><tbody>
      ${sc.lines.map((g) => `<tr><td>${esc(g.erp)}</td><td>${esc(g.pcNo)}</td><td>${esc(g.prod)}</td><td>${esc(g.loc)}</td><td class="r">${fmtNum(g.pcp)}</td><td class="r">${fmtNum(g.pcm)}</td><td class="r">${fmtNum(g.diff)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="4">Tổng</td><td class="r">${fmtNum(sc.totals.pcp)}</td><td class="r">${fmtNum(sc.totals.pcm)}</td><td class="r">${fmtNum(sc.totals.diff)}</td></tr></tbody></table>
      <div class="alert review">Áp dụng sẽ đổi đơn giá lô PC-P dùng để tính giá, nên thẻ D (đơn giá thành phẩm theo lô PC) có thể thay đổi. Khi đó STEP 1 phải xác nhận lại thẻ D trước khi chạy STEP 2.</div>
      <div class="row"><input id="pcb-note" type="text" placeholder="Lý do điều chỉnh (tối thiểu 5 ký tự)" style="min-width:340px" ${dis}/><button class="btn" data-act="pc-basis-apply" type="button" ${dis}>Áp dụng điều chỉnh về PC-M</button></div>`;
  }
  if (!body) return '';
  return `<h2>Điều chỉnh PC-P theo PC-M</h2>${body}`;
}

VIEWS.step3 = (el) => {
  const st = statusAll(); const s3 = S.d.step3;
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 3A · Material WIP</h1><p class="lead">Opening WIP + MI + Stock Out − PC − MR = Closing WIP ERP theo từng vật tư. FG Stock Out và Stock Out tiêu hao (Nợ 632 / Có 152) không đi vào WIP.</p></div>
      <div class="result"><span>Kết quả</span>${pill(st.s3c.status)}<small>${esc(st.s3c.okText)}</small></div></header>
    <div class="row"><button class="btn" data-act="run-step3" type="button">Chạy STEP 3</button>${s3 ? `<span class="muted">Lần chạy gần nhất ${fmtTs(s3.runAt)} · Nguồn opening: ${esc(s3.openingSource)}</span>` : ''}</div>
    ${pcBasisPanel()}
    ${s3 ? `<div class="flow">
      ${flowBox('Opening WIP', s3.summary.opening)}<i>+</i>${flowBox('MI', s3.summary.miAmt)}<i>+</i>${flowBox('Stock Out', s3.summary.soAmt)}<i>−</i>${flowBox('PC', s3.summary.pcAmt)}<i>−</i>${flowBox('MR', s3.summary.mrAmt)}<i>−</i>${flowBox('Stock Out', s3.summary.soOutAmt)}<i>=</i>${flowBox('Closing WIP', s3.summary.closingAmt, true)}
    </div>
    <div class="kpis">${kpiN('Vật tư', s3.rows.length)}${kpiN('Vật tư mới', s3.summary.newMat)}${kpiN('Ngoại lệ', s3.summary.exceptions)}${kpiN('WIP âm', s3.summary.negative)}${kpiN('Dòng MR SL = 0 có giá trị', s3.checks.mrQty.lines)}</div>
    ${s3.consExcluded && s3.consumptionLinesExcluded ? `<div class="alert info">Tiêu hao NVL không qua WIP: ${s3.consumptionLinesExcluded} dòng Stock Out đánh dấu tiêu hao ở STEP 2 (${fmtNum(s3.consumptionAmt)} VND) ghi thẳng Nợ 632 / Có 152, không tính vào Stock Out của WIP.</div>` : ''}
    ${!s3.consExcluded && S.d.step2 && Math.abs(num(S.d.step2.total.cons)) > 0.5 ? `<div class="alert review"><b>Kết quả STEP 3 cũ còn tính tiêu hao NVL vào WIP.</b> Chạy lại STEP 3 để tiêu hao (632 / 152) không đi qua TK 154.</div>` : ''}
    ${step3Stale(s3, S.d.step2) || consStale(S.d.step2, new Set(consumeLineKeys())) ? `<div class="alert review"><b>WIP chưa khớp STEP 2 hiện tại.</b> Danh sách tiêu hao hoặc STEP 2 đã đổi sau lần chạy STEP 3 gần nhất. Bấm Chạy STEP 2 để WIP khớp (STEP 3 tự tính lại).</div>` : ''}
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
    // v1.14.77: STEP 3 must use the consumption lines as they are now; a change not yet run through STEP 2 is refused
    if (consStale(S.d.step2, new Set(consumeLineKeys()))) throw new Error('Danh sách tiêu hao đã đổi sau STEP 2 gần nhất. Bấm Chạy STEP 2 trước.');
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
/** Period list with status and per-period actions (open / delete / hide). */
function periodTable() {
  const hid = new Set(hiddenList()); const admin = store.isAdmin(); const show = !!S.showHidden;
  const rows = (S.allPeriods || S.periods).filter((p) => show || !hid.has(p) || p === S.period);
  const st = (p) => { const i = (S.periodInfo || {})[p] || {}; const local = p === S.period ? S.d : null; const closed = i.closed || !!(local && local.closed && local.closed.period === p); const ever = i.everClosed || closed || !!(local && local.closedEver); return { closed, ever }; };
  return `<table class="cp"><thead><tr><th>Kỳ</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map((p) => { const x = st(p); const h = hid.has(p);
    return `<tr><td><a href="#cc" data-act="goto-period" data-p="${p}"><b>${p}</b></a>${p === S.period ? ' <span class="muted">(đang mở)</span>' : ''}${h ? ' <span class="muted">(đã ẩn)</span>' : ''}</td>
      <td>${x.closed ? pill('CLOSED') : x.ever ? `${pill('REVIEW')} <small>đã từng đóng – đang mở lại</small>` : pill('OPEN')}</td>
      <td class="r">${admin && !x.ever ? `<button class="btn danger ghost sm" data-act="delete-period" data-p="${p}" type="button">Xoá kỳ…</button>` : ''}
        ${admin && x.ever && !h ? `<button class="btn ghost sm" data-act="hide-period" data-p="${p}" type="button" title="Kỳ đã từng đóng không xoá được (hồ sơ lưu trữ) – chỉ ẩn khỏi danh sách">Ẩn kỳ…</button>` : ''}
        ${admin && h ? `<button class="btn ghost sm" data-act="unhide-period" data-p="${p}" type="button">Hiện lại</button>` : ''}</td></tr>`; }).join('')}</tbody></table>
    ${hid.size ? `<p class="muted"><label><input type="checkbox" id="show-hidden" ${show ? 'checked' : ''}> Hiện cả ${hid.size} kỳ đã ẩn</label></p>` : ''}
    <p class="muted">Kỳ <b>chưa từng đóng</b>: Xoá kỳ (xoá hẳn trên máy này và cloud). Kỳ <b>đã từng đóng</b> là hồ sơ kế toán – không xoá được, chỉ <b>Ẩn kỳ</b> khỏi danh sách (dữ liệu và lịch sử vẫn giữ trên cloud, hiện lại được).</p>`;
}
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
        <h2>Kỳ hiện có</h2>${periodTable()}
        <div class="row"><button class="btn ghost" data-act="new-period" type="button">Tạo kỳ mới…</button><button class="btn ghost" data-act="export-all" type="button">Xuất kết quả kỳ ra Excel</button>
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
    if (!box.isConnected) return; // đã chuyển màn hình trong lúc đọc danh sách
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
  box.querySelector('#f-user').addEventListener('submit', (ev) => {
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
      if (ri) for (let r = 8; r < ri.length; r++) { const x = ri[r] || []; if (!x[2]) continue; oldRows.push(Object.fromEntries(RW_FIELDS.slice(0, RW_FIELDS.indexOf('originPeriod') + 1).map((f, i) => [f, x[i] ?? null]))); }
      S.d.register = { period, refreshedAt: '', rows: oldRows, stats: {} };
      audit('MIGRATE FROM EXCEL', `${file.name} · ${Object.keys(S.d.datasets).length} báo cáo ERP · Opening ${S.d.opening ? S.d.opening.rows.length : 0} dòng · Rework ${oldRows.length} dòng`);
      // re-run engine
      const s2 = runStep2(S.d.datasets, period, { consumeLines: consumeLineKeys() }); S.d.step2 = s2;
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
    if (s2.consumption && s2.consumption.length) sheets.push({ name: '03B_TIEU_HAO_NVL', aoa: [['TIÊU HAO NVL – Nợ 632 / Có 152 (không phân bổ vào lô PC)'], ['Reporting Period', S.period, '', 'Run Time', s2.runAt], [], ['Hệ nguồn', 'Item Code', 'Tên vật tư', 'Số dòng', 'Tiêu hao (VND)'], ...s2.consumption.map((c) => [c.erp, c.code, c.name, c.rows, c.amt]), [], ['Tổng', '', '', '', s2.total.cons || 0]] });
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
  if (S.d.pm && S.d.step2) tbl('04_PC_PRICE_CHECK', P2.F.PC_PRICE_FIELDS, P2.F.PC_PRICE_HEADERS, P2.F.pcPriceCheck(S.d.step2, S.d.pm, S.period).rows);
  if (D.d4 && D.d4.fl) sheets.push(costAllocationSheet(D.d4.fl.rows, S.period)); // template layout (exportform.js)
  if (S.d.step4 && S.d.step4.recon) tbl('04_RECONCILIATION', ['label', 'expected', 'result', 'diff', 'status', 'note'], ['Control', 'Expected', 'Result', 'Difference', 'Status', 'Note'], S.d.step4.recon.rows);
  const r5 = S.d.step5 && S.d.step5.period === S.period ? S.d.step5 : null;
  if (S.d.fgOpen) sheets.push(fgLayerSheet(S.d.fgOpen.rows, 'opening', S.period));
  if (r5) {
    const dt = (rows, fs) => rows.map((r) => { const o = { ...r }; for (const f of fs) if (typeof o[f] === 'number') o[f] = serialToISO(o[f]); return o; });
    tbl('05_FG_LEDGER', P3.F5.LEDGER_FIELDS, P3.F5.LEDGER_HEADERS, dt(r5.ledger, ['date']));
    tbl('05_SALES_COGS', P3.F5.SALES_VIEW_FIELDS, P3.F5.SALES_VIEW_HEADERS, dt(r5.sales, ['date']));
    if (r5.returnRegister && r5.returnRegister.length) {
      const rf = ['seq', 'date', 'returnInv', 'customer', 'product', 'productName', 'originalInv', 'returnQty', 'cogsRM', 'cogs622', 'cogs627', 'cogsTotal', 'layerId', 'status', 'message'];
      const rh = ['Seq', 'Return Date', 'Return Invoice', 'Customer', 'Product', 'Product Name', 'Original Invoice', 'Return Qty', 'RM Reversal', '622 Reversal', '627 Reversal', 'COGS Reversal', 'Returned FG Layer', 'Status', 'Message'];
      tbl('05_SALES_RETURN', rf, rh, dt(r5.returnRegister, ['date']));
    }
    tbl('05_FIFO_DETAIL', P3.F5.DETAIL_FIELDS, P3.F5.DETAIL_HEADERS, dt(r5.detail, ['date']));
    if (r5.rework) tbl('05_FG_REWORK_FIFO', P3.F5.RWF_FIELDS, P3.F5.RWF_HEADERS, dt(r5.rework.rows, ['issueDate', 'layerDate']));
    sheets.push(fgLayerSheet(r5.closing, 'closing', S.period));
    tbl('05_COGS_SUMMARY', P3.F5.SUM_FIELDS, P3.F5.SUM_HEADERS, r5.summary);
    if (r5.rollforward) tbl('05_FG_ROLLFORWARD', P3.F5.XNT_FIELDS, P3.F5.XNT_HEADERS, r5.rollforward.rows);
    // provision on FG (v1.14.70): roll-forward per layer and the FAST entries (TK 2294 / 632)
    // v1.14.73: NRV column = NRV approved in 5P (spread over the layers); the proposal is its own column
    const nrvOk = P3.nrvApprovedFor(S, r5);
    const trk = provisionTrack(r5, nrvOk.byLayer);
    sheets.push(provisionTrackSheet(trk, S.period));
    sheets.push(provisionJournalSheet(provisionJournal(trk, nrvOk.total), S.period));
  }
  if (S.d.fgHistory) tbl('05_FG_HISTORY', P3.F5.HIST_FIELDS, P3.F5.HIST_HEADERS, S.d.fgHistory.rows.map((r) => ({ ...r, date: typeof r.date === 'number' ? serialToISO(r.date) : r.date })));
  if (!sheets.length) { toast('Chưa có kết quả để xuất.', 'review'); return; }
  await exportBook(`SVL_Costing_Web_${S.period}.xlsx`, sheets);
}

// ======================= actions =======================
/** v1.14.79: Bảng tổng hợp hạch toán – doanh thu, giá vốn, lãi gộp theo khách hàng; bút toán theo khách hàng; kiểm tra. */
async function exportHachToan() {
  const r5 = S.d.step5 && S.d.step5.period === S.period ? S.d.step5 : null;
  if (!r5) { toast('Chưa có kết quả FIFO COGS (STEP 5.2) để xuất bảng tổng hợp hạch toán.', 'review'); return; }
  const D = P2.derive(S);
  const ctx = { s3: S.d.step3, s2: S.d.step2, s4: S.d.step4, fl: D.d4 && D.d4.fl, r5 };
  const pl = customerPL(r5);
  const lines = journalWithCustomers(ctx);
  const jc = journalCheck(ctx);
  const checks = [...pl.checks, { label: 'JE07 theo khách hàng = JE07 (giá vốn bán hàng)', expected: jc.expected, actual: jc.actual, status: jc.status }];
  await exportBook(`SVL_Bang_Tong_Hop_Hach_Toan_${S.period}.xlsx`, [
    { name: '1_TongHop_KhachHang', aoa: [PL_HEADERS, ...plSheetRows(pl)] },
    { name: '2_ButToan_KhachHang', aoa: [['JE', 'Nợ', 'Có', 'Khách hàng', 'Diễn giải', 'Số tiền (VND)'], ...lines.map((j) => [j.je, j.dr, j.cr, j.cust || '—', j.desc, j.amount])] },
    { name: '3_TongHop_SanPham', aoa: [PROD_HEADERS, ...prodSheetRows(productPL(r5))] },
    { name: '4_KiemTra', aoa: [['Kiểm tra', 'Kỳ vọng', 'Thực tế', 'Chênh', 'Trạng thái'], ...checks.map((c) => [c.label, c.expected, c.actual, num(c.actual) - num(c.expected), c.status])] },
  ]);
}
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
    const cf = { ...P2.carryForward(prevD, p), ...P3.carryForward(prevD, p), ...FGP.carryForward(prevD, p) }; const took = [];
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
    case 'refresh-remote': {
      if (!S.remoteConflict) break;
      const yes = confirm(`Kỳ ${S.period} trên Cloud đã thay đổi. Tải bản Cloud sẽ thay thế dữ liệu trên màn hình và bỏ các thay đổi CHƯA đồng bộ trên máy này.\n\nBạn đã kiểm tra và muốn tiếp tục?`);
      if (!yes) break;
      clearTimeout(syncTimer);
      await saveChain;
      try { await openPeriod(S.period, { preferCloud: true }); toast('Đã tải lại kỳ từ Cloud.', 'pass'); }
      catch (err) { toast('Không tải được Cloud: ' + (err.message || err), 'block'); }
      break;
    }
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
    case 'cons-reconcile': {
      if (!canEditPeriod()) break;
      const rec = consRec(); if (rec.ok) { render(); break; }
      const reason = (prompt(`Xác nhận lại danh sách tiêu hao NVL: bỏ ${rec.missing.length} dòng không còn trong báo cáo, nhận số liệu mới cho ${rec.changed.length} dòng. Nhập lý do (bắt buộc):`, '') || '').trim();
      if (reason.length < 5) { toast('Cần lý do ít nhất 5 ký tự.', 'review'); break; }
      const gone = new Set(rec.missing.map((m) => m.key));
      const set = new Set(consumeLineKeys().filter((k) => !gone.has(k)));
      S.d.consumeCfg = { lines: [...set].sort(), snap: consSnapOf(set), by: who(), at: nowISO() };
      audit('STEP 2 - TIÊU HAO NVL ĐỐI CHIẾU LẠI', `${reason} · bỏ ${rec.missing.length} dòng (${rec.missing.map((m) => m.key).slice(0, 10).join(', ')}) · nhận số mới ${rec.changed.length} dòng · ${who()}`);
      markDirty('consumeCfg', 'audit'); toast('Đã xác nhận lại danh sách tiêu hao. Bấm Chạy STEP 2 để cập nhật số liệu.', 'pass'); render(); break;
    }
    case 'approve-step2-fallback': {
      if (!canEditPeriod()) break; // owner decision #8: anyone with edit rights approves
      const s2 = S.d.step2; if (!s2) break;
      const amount = fallbackAlloc(s2), totalAlloc = num(s2.total && s2.total.alloc);
      const reason = (prompt(`Fallback rộng = ${fmtNum(amount)} VND (${totalAlloc ? (Math.abs(amount / totalAlloc) * 100).toFixed(1) : 0}% Stock Out đã phân bổ). Nhập lý do / bằng chứng review (bắt buộc):`, '') || '').trim();
      if (reason.length < 5) { toast('Cần lý do review ít nhất 5 ký tự.', 'review'); break; }
      s2.fallbackApproval = { amount, totalAlloc, by: store.cloud.user ? store.cloud.user.email : 'thiết bị này', at: nowISO(), reason };
      audit('STEP 2 FALLBACK APPROVAL', `${reason} · amount=${fmtNum(amount)} · ratio=${totalAlloc ? (Math.abs(amount / totalAlloc) * 100).toFixed(2) : 0}%`);
      markDirty('step2', 'audit'); render(); break;
    }
    case 'run-step3': await busy('Đang chạy STEP 3…', async () => doStep3()); break;
    case 'pc-basis-apply': {
      if (!canEditPeriod()) break;
      const reason = String((document.querySelector('#pcb-note') || {}).value || '').trim();
      if (reason.length < 5) { toast('Cần lý do điều chỉnh ít nhất 5 ký tự.', 'review'); break; }
      try {
        const res = applyPcBasis(S.d.datasets, S.period);
        const total = res.changes.reduce((a, c) => a + (num(c.adj) - num(c.orig)), 0);
        S.d.datasets = res.datasets;
        for (const e of ['T', 'O']) S.dirty.add('ds:PC-P-' + e);
        S.d.pcAdj = { period: S.period, at: nowISO(), by: store.cloud.user ? store.cloud.user.email : 'thiết bị này', note: reason, total: Math.round(total * 100) / 100, changes: res.changes, before: res.before, after: res.after };
        S.d.step2 = null; S.d.step3 = null; S.d.register = null;
        audit('PC-P COST BASIS → PC-M', `${res.changes.length} dòng · tổng ${fmtNum(total)} VND · ${reason}`);
        markDirty('pcAdj', 'step2', 'step3', 'register', 'audit');
        const blk = DQ.blockingParts(DQ.erpAnomalies(S.d.datasets, S.period), S.d.importAck);
        toast(blk.length
          ? `Đã điều chỉnh ${res.changes.length} dòng PC-P về PC-M. Cần xác nhận lại ở STEP 1 trước khi chạy STEP 2: ${DQ.blockingSummary(blk)}.`
          : `Đã điều chỉnh ${res.changes.length} dòng PC-P về PC-M. Chạy lại STEP 2 và STEP 3.`, blk.length ? 'review' : 'pass');
      } catch (e) { toast('Không điều chỉnh được: ' + e.message, 'block'); }
      render(); break;
    }
    case 'pc-basis-undo': {
      if (!canEditPeriod() || !S.d.pcAdj) break;
      if (!confirm('Hoàn tác điều chỉnh PC-P về số liệu ERP gốc?')) break;
      try {
        S.d.datasets = undoPcBasis(S.d.datasets, S.d.pcAdj.changes);
        for (const e of ['T', 'O']) S.dirty.add('ds:PC-P-' + e);
        audit('PC-P COST BASIS UNDO', `${S.d.pcAdj.changes.length} dòng · ${S.d.pcAdj.note}`);
        S.d.pcAdj = null; S.d.step2 = null; S.d.step3 = null; S.d.register = null;
        markDirty('pcAdj', 'step2', 'step3', 'register', 'audit');
        toast('Đã hoàn tác. Chạy lại STEP 2 và STEP 3.', 'pass');
      } catch (e) { toast('Không hoàn tác được: ' + e.message, 'block'); }
      render(); break;
    }
    case 'roll-wip': await rollWIP(); break;
    case 'validate-wip':
      validateOpening(S.d.opening, S.d.datasets, S.period); S.d.opening.changedAt = nowISO();
      audit('OPENING WIP VALIDATE', `${S.d.opening.status} · lỗi ${S.d.opening.stats.errors}`); markDirty('opening', 'audit'); render(); break;
    case 'reset-wip':
      if (confirm(`Xoá Opening WIP kỳ ${S.period}? (Không xoá dữ liệu ERP)`)) { S.d.opening = null; audit('OPENING WIP RESET', ''); markDirty('opening', 'audit'); render(); } break;
    case 'template-wip':
      exportBook(`SVL_WIP_Opening_Template_${S.period}.xlsx`, TPL.wipOpeningTemplate(S.period)); break;
    case 'dq-confirm': {
      if (!guardMutate()) break;
      const key = a.dataset.part; const dq = DQ.erpAnomalies(S.d.datasets, S.period); const p = dq.parts && dq.parts[key];
      if (!p || !p.count || DQ.partStatus(dq, S.d.importAck, key) === 'CONFIRMED') break;
      const mcTxt = [...new Set((dq.mcLines || []).map((l) => `${l.erp}|${l.code}|${l.name}`))].slice(0, 30).map((k) => { const [e, c, n] = k.split('|'); const ls = (dq.mcLines || []).filter((l) => l.erp === e && l.code === c); return `• MI-M ${e} ${c} ${n}: ${ls.length} dòng, lệch lớn nhất ${fmtNum(Math.max(...ls.map((l) => Math.abs(l.dev))) * 100, 0)} %`; });
      const listTxt = key === 'A'
        ? dq.recon.bySys.filter((x) => x.status !== 'PASS').map((x) => `• PC-P vs PC-M hệ ${x.erp}: chênh ${fmtNum(x.diff, 2)} VND – ${x.gaps} PC lệch, ${x.onlyM} chỉ ở PC-M, ${x.onlyP} chỉ ở PC-P`)
        : key === 'C'
          ? [...dq.summary.filter((g) => g.type !== 'ZERO COST').map((g) => `• ${g.report}: ${g.label} – ${g.lines} dòng, ${g.materials} vật tư`), ...mcTxt]
        : key === 'D'
          ? ['T', 'S', 'O'].filter((e) => dq.pcFlagged.some((l) => l.erp === e)).map((e) => { const L = dq.pcFlagged.filter((l) => l.erp === e); return `• PC-P hệ ${e}: ${L.length} lô bất thường, ${new Set(L.map((l) => l.prod)).size} mã SP`; })
          : dq.summary.filter((g) => g.type === 'ZERO COST').map((g) => `• ${g.report}: ${g.label} – ${g.lines} dòng, ${g.materials} vật tư`);
      const prev = DQ.ackParts(S.d.importAck, dq)[key];
      const note = (prompt(`Xác nhận phần ${key} – ${DQ.DQ_PARTS[key]}?\n${listTxt.join('\n')}\n\nGhi chú / kết luận (bắt buộc, ≥ 5 ký tự), ví dụ: "Hàng khách cấp – ERP giá trị 0 là đúng":`, prev ? prev.note : '') || '').trim();
      if (!note) break;
      if (note.length < 5) { toast('Ghi chú cần ít nhất 5 ký tự.', 'review'); break; }
      const parts = DQ.ackParts(S.d.importAck, dq);
      parts[key] = { fp: p.fp, count: p.count, by: who(), at: nowISO(), note };
      S.d.importAck = { parts, by: who(), at: nowISO() };
      audit('ERP DATA ANOMALY CONFIRM', `Phần ${key} (${DQ.DQ_PARTS[key]}) · ${p.count} mục · ${note}`);
      markDirty('importAck', 'audit'); toast(`Đã xác nhận phần ${key}.`, 'pass'); render(); break;
    }
    case 'dq-unconfirm': {
      if (!guardMutate()) break;
      const key = a.dataset.part; const dq = DQ.erpAnomalies(S.d.datasets, S.period);
      const parts = DQ.ackParts(S.d.importAck, dq);
      if (!parts[key]) break;
      if (!confirm(`Xóa xác nhận phần ${key} (${DQ.DQ_PARTS[key]})? STEP 2 sẽ bị chặn cho đến khi phần này được xác nhận lại.`)) break;
      delete parts[key];
      S.d.importAck = { parts, by: who(), at: nowISO() };
      audit('ERP DATA ANOMALY UNCONFIRM', `Phần ${key} (${DQ.DQ_PARTS[key]}) · xóa xác nhận · ${who()}`);
      markDirty('importAck', 'audit'); toast(`Đã xóa xác nhận phần ${key}. STEP 2 bị chặn cho đến khi xác nhận lại.`, 'review'); render(); break;
    }
    case 'cfg-fg-save': {
      if (!guardMutate()) break;
      const ids = cfgChecked(); const reason = (document.querySelector('#cfg-reason')?.value || '').trim();
      S.d.consFg = { rids: ids, reason, by: who(), at: nowISO() };
      audit('2B CONSUMPTION DRAFT', `${ids.length} dòng tick · ${reason || '(chưa có lý do)'}`);
      markDirty('consFg', 'audit'); toast(`Đã lưu nháp ${ids.length} dòng. Chưa đổi trạng thái hay số liệu – bấm Xác nhận để áp dụng.`, 'pass'); render(); break;
    }
    case 'cfg-fg-confirm': {
      if (!guardMutate()) break;
      const ids = cfgChecked(); const reason = (document.querySelector('#cfg-reason')?.value || '').trim();
      if (!ids.length) { toast('Chưa tick dòng nào để xác nhận.', 'review'); break; }
      if (reason.length < 5) { toast('Nhập lý do (ít nhất 5 ký tự) trước khi xác nhận.', 'review'); break; }
      const qty = S.d.register.rows.filter((r) => ids.includes(r.rid)).reduce((a, r) => a + num(r.issueQty), 0);
      if (!confirm(`Xác nhận ${ids.length} dòng FG làm tiêu dùng nội bộ (SL ${fmtNum(qty)})?\nSố tiền ghi Nợ 632 / Có 155 sẽ được tính khi chạy RUN FIFO (STEP 5.2).`)) break;
      const res = confirmConsFg(S.d.register.rows, ids, reason, who(), nowISO());
      if (!res.ok) { toast(res.error, 'review'); break; }
      S.d.consFg = null;
      audit('2B CONSUMPTION CONFIRM', `${res.rows.length} dòng · SL ${fmtNum(qty)} · ${reason} · ${res.rows.map((r) => r.rid).join(', ')}`);
      markDirty('register', 'consFg', 'audit'); toast(`Đã xác nhận ${res.rows.length} dòng tiêu dùng nội bộ. Chạy RUN FIFO (STEP 5.2) để tính giá.`, 'pass'); render(); break;
    }
    case 'cfg-fg-undo': {
      if (!guardMutate()) break;
      const row = S.d.register && S.d.register.rows.find((x) => x.rid === a.dataset.rid);
      if (!row) break;
      if (!confirm(`Hoàn tác tiêu dùng nội bộ dòng ${row.rid}? Dòng trở về OPEN và phải chạy lại RUN FIFO (STEP 5.2).`)) break;
      const res = undoConsFg(row, who(), nowISO());
      if (!res.ok) { toast(res.error, 'review'); break; }
      audit('2B CONSUMPTION UNDO', `${row.rid} → OPEN`);
      markDirty('register', 'audit'); toast(`Đã hoàn tác ${row.rid}.`, 'review'); render(); break;
    }
    case 'sales-tpl': await exportBook(`SVL_Sales_Revenue_Import_Template_v2_${S.period}.xlsx`, TPL.salesTemplate(S.period)); break;
    case 'ret-tpl': await exportBook(`SVL_Sales_Returns_Import_Template_v1_${S.period}.xlsx`, TPL.returnsTemplate(S.period)); break;
    case 'so-tpl': await exportBook(`SVL_SO_Price_Import_Template_v1_${S.period}.xlsx`, TPL.soTemplate(S.period)); break;
    case 'reset-erp': {
      const has = (sc) => Object.keys({ ...S.d.datasets, ...S.d.importLog }).filter((k) => sc === 'ALL' || k.endsWith('-' + sc));
      const sc = (prompt(`Xoá dữ liệu ERP đã import của kỳ ${S.period}.\n\nBước 1/2 – nhập PHẠM VI cần xoá:\n  ALL = cả 3 hệ (${has('ALL').length} báo cáo)\n  T = hệ T (${has('T').length})   S = hệ S (${has('S').length})   O = hệ O (${has('O').length})`, 'ALL') || '').trim().toUpperCase();
      if (!sc) break;
      if (!['ALL', 'T', 'S', 'O'].includes(sc)) { toast(`Phạm vi “${sc}” không hợp lệ – chỉ nhập ALL, T, S hoặc O (lý do nhập ở bước 2).`, 'review'); break; }
      const keys = has(sc);
      if (!keys.length) { toast(`Không có báo cáo ERP nào của phạm vi ${sc} để xoá.`, 'review'); break; }
      const reason = (prompt(`Bước 2/2 – nhập LÝ DO xoá ${keys.length} báo cáo (${sc}) của kỳ ${S.period}:`, '') || '').trim();
      if (!reason) break;
      if (reason.length < 3) { toast('Lý do quá ngắn (ít nhất 3 ký tự).', 'review'); break; }
      for (const k of keys) { delete S.d.datasets[k]; delete S.d.importLog[k]; S.dirty.add('ds:' + k); }
      audit('RESET ERP DATA - ' + sc, `Đã xoá ${keys.length} báo cáo: ${keys.join(', ')} · Lý do: ${reason}`);
      markDirty('importLog', 'audit');
      toast(`Đã xoá ${keys.length} báo cáo ERP (${sc}) của kỳ ${S.period}. Import lại file ERP rồi chạy lại STEP 2 → 3 → 3B → 4.`, 'pass');
      render(); break;
    }
    case 's2-report': {
      const s2 = S.d.step2; if (!s2) { toast('Chưa chạy STEP 2.', 'review'); break; }
      const cls = step2Classification(S.d.datasets, S.period, s2, S.d.register);
      const { sheets } = step2ReportSheets(s2, cls, S.period, APP_VERSION);
      try {
        await exportStyledBook(`SVL_STEP2_PhanBo_StockOut_${S.period}.xlsx`, sheets, { title: `Tổng hợp phân bổ Stock Out · kỳ ${S.period}`, subject: 'STEP 2 – Phân bổ Stock Out vào lô PC', company: 'SVL – Starry Vietnam Co., Ltd.' });
      } catch (err) { toast(`Không xuất được Excel: ${err.message}`, 'block'); }
      break;
    }
    case 'view-ds': S.dsView = a.dataset.k; if (S.view !== 'data') location.hash = 'data'; else render(); break;
    case 'goto-period': await openPeriod(a.dataset.p); break;
    case 'push-cloud': { const r = await pushCloud(); toast(r.ok ? `Đã lưu lên cloud (bản ${r.meta.rev}).` : (r.conflict ? 'KHÔNG ghi đè cloud: ' : 'Chưa lưu được lên cloud: ') + r.error, r.ok ? 'pass' : 'block'); break; }
    case 'clear-local': await clearLocal(false); break;
    case 'pull-cloud': await openPeriod(S.period, { preferCloud: true }); break;
    case 'export-all': await exportAll(); break;
    case '3b-sync': P2.do3bSync(); render(); break;
    case '3b-build': try { await busy('Đang BUILD STEP 3B…', async () => P2.do3bBuild()); } catch (err) { toast('STEP 3B BUILD dừng: ' + (err && err.message || err), 'block'); console.error(err); } render(); break;
    case '3b-apply': try { await busy('Đang APPLY STEP 3B…', async () => P2.do3bApply()); } catch (err) { toast('STEP 3B APPLY dừng: ' + (err && err.message || err), 'block'); console.error(err); } render(); break;
    case '3b-all': P2.do3bAll(a.dataset.dec); render(); break;
    case 'sales-save': await busy('Đang Validate & Save doanh thu…', async () => P2.doSalesSave()); render(); break;
    case 'pm-update': await busy('Đang cập nhật Price Master…', async () => P2.doPMUpdate()); render(); break;
    case 'run-step4': await busy('Đang chạy STEP 4…', async () => { P2.doStep4(); FGP.postCurrent(S, { silent: true }); }); render(); break;
    case 'fgp-post': FGP.postCurrent(S); render(); break;
    case 'fgp-roll': await FGP.doRoll(); render(); break;
    case 'fgp-tpl': await FGP.doTemplate(false); break;
    case 'fgp-next': await FGP.doTemplate(true); break;
    case 'fgp-export': await FGP.doExport(); break;
    case 's5-roll': await P3.doRollOpen(); render(); break;
    case 's5-validate': P3.doValidateOpen(); render(); break;
    case 's5-template': await P3.doTemplate(); break;
    case 's5-run': await busy('Đang chạy FIFO COGS (bán hàng)…', async () => { await P3.doRunFIFO(false); FGP.postCurrent(S, { silent: true }); }); render(); break;
    case 's5r-run': await busy('Đang chạy STEP 5R – hàng bán bị trả lại…', async () => { await P3.doRun5R(); FGP.postCurrent(S, { silent: true }); }); render(); break;
    case 'ret-save': await busy('Đang Validate & Save hàng trả lại / giảm giá…', async () => P3.doReturnsSave()); render(); break;
    case 's5-hist': await busy('Đang tạo FG History…', async () => P3.doBuildHistory()); render(); break;
    case 's5-close': await P3.doClose(); render(); break;
    case 's5-reopen': await P3.doReopen(); render(); break;
    case 'hide-period': case 'unhide-period': {
      if (store.cloud.enabled && !store.isAdmin()) { toast('Chỉ quản trị viên được ẩn / hiện kỳ.', 'review'); break; }
      const hp = a.dataset.p; const hide = act === 'hide-period';
      if (hide && !confirm(`Ẩn kỳ ${hp} khỏi danh sách kỳ?\n\nKỳ đã từng đóng là hồ sơ kế toán nên không xoá được; ẩn chỉ làm kỳ không còn hiện trong danh sách chọn kỳ. Dữ liệu và lịch sử trên cloud vẫn giữ nguyên, hiện lại được ở màn hình này.`)) break;
      const next = hide ? [...hiddenList(), hp] : hiddenList().filter((x) => x !== hp);
      try {
        if (store.cloud.enabled) await store.saveHiddenPeriods(next); else localStorage.setItem('svl.hiddenPeriods', JSON.stringify([...new Set(next)]));
        audit(hide ? 'HIDE PERIOD' : 'UNHIDE PERIOD', hp);
        toast(hide ? `Đã ẩn kỳ ${hp}.` : `Kỳ ${hp} hiện lại trong danh sách.`, 'pass');
      } catch (err) { toast('Không lưu được: ' + err.message, 'block'); break; }
      if (hide && hp === S.period) { await refreshPeriods(); const other = S.periods.find((x) => x !== hp); if (other) { await openPeriod(other); location.hash = 'settings'; break; } }
      await refreshPeriods(); render(); break;
    }
    case 'delete-period':
      if (store.cloud.enabled && !store.isAdmin()) { toast('Chỉ quản trị viên được xoá kỳ.', 'review'); break; }
      if (a.dataset.p && a.dataset.p !== S.period) { await openPeriod(a.dataset.p); location.hash = 'settings'; }
      if (S.d.closedEver) { toast(`Kỳ ${S.period} đã từng CLOSED nên là hồ sơ kế toán lưu trữ; không được hard-delete kể cả sau REOPEN. Dùng “Ẩn kỳ” để bỏ khỏi danh sách.`, 'block'); break; }
      if (isClosed()) { toast(`Kỳ ${S.period} đang CLOSED và không được xoá.`, 'block'); break; }
      if (prompt(`Gõ ${S.period} để xoá toàn bộ dữ liệu kỳ OPEN này trên máy này${store.cloud.user ? ' và trên cloud' : ''}:`) === S.period) {
        const delP = S.period;
        clearTimeout(syncTimer); await saveChain; await pushChain; // no queued save may recreate the period after deletion
        // cloud first: if the cloud refuses, nothing is removed on this device either
        if (store.cloud.user) { try { await store.cloudDelete(delP); } catch (err) { toast('Không xoá được trên cloud (dữ liệu trên máy giữ nguyên): ' + err.message + (/CLOSED/.test(err.message) ? ' → dùng “Ẩn kỳ”.' : ''), 'block'); await refreshPeriods(); render(); break; } }
        audit('DELETE PERIOD', `Xoá toàn bộ kỳ ${delP}${store.cloud.user ? ' (máy này + cloud)' : ' (máy này)'}`);
        for (const k of await store.localKeys()) if (String(k).startsWith(`p/${delP}/`)) await store.localDel(k);
        await store.localSet('periods', ((await store.localGet('periods')) || []).filter((x) => x !== delP));
        toast(`Đã xoá kỳ ${delP}.`, 'pass');
        await refreshPeriods(); S.period = S.periods.filter((x) => x !== delP)[0] || ''; if (S.period) await openPeriod(S.period); else render();
      }
      break;
    default: break;
  }
});
// Safety net: an error thrown by an app action must never disappear silently (the screen would just not change).
window.addEventListener('unhandledrejection', (ev) => {
  const err = ev.reason; const stack = String((err && err.stack) || '');
  if (!stack.includes('/src/')) return; // network / Firebase noise is reported by its own handlers
  setBusy(''); toast('Thao tác dừng do lỗi: ' + ((err && err.message) || err), 'block'); console.error(err);
});
document.addEventListener('change', async (e) => {
  if (e.target.id === 'show-hidden') { S.showHidden = e.target.checked; render(); return; }
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
/** Column labels of a header that may span several rows (rowspan / colspan): "Group · Column" per body column. */
function headLabels(t) {
  const grid = [];
  [...t.querySelectorAll('thead tr')].forEach((tr, ri) => {
    let c = 0;
    for (const th of tr.children) {
      while (grid[ri] && grid[ri][c] !== undefined) c++;
      const rs = th.rowSpan || 1, cs = th.colSpan || 1, tx = th.textContent.trim();
      for (let r = ri; r < ri + rs; r++) { grid[r] = grid[r] || []; for (let k = c; k < c + cs; k++) grid[r][k] = tx; }
      c += cs;
    }
  });
  const n = Math.max(0, ...grid.map((r) => r.length));
  return Array.from({ length: n }, (_, k) => [...new Set(grid.map((r) => r[k]).filter(Boolean))].join(' · '));
}
/** Phone layout: checkpoint tables become label/value cards (labels taken from the table header). */
/** v1.14.56: each h2 section of a page becomes a tinted zone (like the STEP 1 cards A/B/C); tones cycle blue → amber → green → violet.
 *  Existing nodes are moved, not re-created, so mounted tables and listeners keep working. */
const ZONE_TONES = ['blue', 'amber', 'green', 'violet'];
function zoneSections(root) {
  const page = root.querySelector('section.page'); if (!page) return;
  let zone = null, n = 0;
  const tone = () => `z-${ZONE_TONES[n++ % ZONE_TONES.length]}`;
  for (const el of [...page.children]) {
    if (el.tagName === 'H2') { zone = document.createElement('section'); zone.className = `zone ${tone()}`; page.insertBefore(zone, el); zone.appendChild(el); continue; }
    if (el.matches('header.ph, .dq-cards, .kpi-groups')) { zone = null; continue; }
    if (el.matches('.tabs') && !zone) { zone = document.createElement('section'); zone.className = `zone ${tone()}`; page.insertBefore(zone, el); zone.appendChild(el); continue; } // a tab bar opens a zone for its tables
    if (el.querySelector('h2')) { // a wrapper that holds its own headed block(s): the block that starts with h2 becomes the zone
      zone = null;
      const headed = (b) => b.firstElementChild && b.firstElementChild.tagName === 'H2' && !b.matches('details, .dq-card, .card');
      if (headed(el)) el.classList.add('zone', tone());
      else for (const b of el.children) if (headed(b)) b.classList.add('zone', tone());
      continue;
    }
    if (zone) zone.appendChild(el);
  }
}
function cardTables(root) {
  for (const t of root.querySelectorAll('table.cp')) {
    if (t.classList.contains('el')) continue;
    const heads = headLabels(t);
    if (!heads.length) continue;
    t.classList.add('cards');
    for (const tr of t.querySelectorAll('tbody tr')) {
      const tds = [...tr.children];
      if (tds.length === 1) tr.classList.add('sep');
      tds.forEach((td, i) => {
        td.dataset.label = heads[i] || ''; const tx = td.textContent.trim();
        if ((!tx && !td.querySelector('select,input,button')) || (/^(Chênh lệch|Difference)$/i.test(heads[i] || '') && /^[–-]?$/.test(tx))) td.classList.add('na');
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
  if (isIOS()) return `<div class="card install-card">${img}<div><b>Cài lên iPhone / iPad</b><div class="muted">Mở trang này bằng <b>Safari</b> → bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) → <b>Thêm vào màn hình chính</b> → <b>Thêm</b>.</div></div></div>`;
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
window.addEventListener('online', () => { retryN = 0; renderSync(); if (S.sync === 'error') scheduleCloud(); });
window.addEventListener('offline', () => { renderSync(); toast('Mất kết nối mạng – xem được dữ liệu trên máy, thay đổi sẽ đồng bộ khi có mạng.', 'review'); });

P2.install({ S, esc, pill, fmtNum, fmtTs, cpVal, cpTable, kpi, kpiN, emptyNote, mountTable, exportTable, markDirty, audit, toast, busy, parseFile, guardEdit: guardMutate, canEdit: canEditPeriod, isAdmin: () => store.isAdmin(), who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), parseNum, dupStatus: () => P3.dupStatus(S), render, derived: derivedNow, latestImport: () => step1Status(datasetsMeta()).latestImport });
TRV.install({ S, esc, pill, fmtNum, fmtTs, kpi, kpiN, emptyNote, mountTable, exportTable, exportBook, toast, render, derived: derivedNow, loadPeriodData });
RWV.install({ S, esc, pill, fmtNum, fmtTs, kpi, kpiN, emptyNote, mountTable, exportTable, markDirty, audit, toast, guardEdit: guardMutate, canEdit: canEditPeriod, parseNum, who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), render });
FGP.install({ S, esc, pill, fmtNum, fmtTs, kpi, kpiN, emptyNote, mountTable, exportTable, exportBook, markDirty, audit, toast, busy, parseFile, guardEdit: guardMutate, canEdit: canEditPeriod, who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), render, derived: derivedNow, loadPeriodData });
P3.install({ adoptCommit: async (p, meta) => { if (!meta) return; await store.localSet(lk(p, 'cloudRev'), meta.rev); await store.localSet(lk(p, 'cloudAt'), meta.updatedAt); if (p === S.period) { S.sync = 'synced'; S.syncMsg = ''; renderSync(); } }, setPendingTransition: (t) => { S.pendingTransition = t; }, refreshPrevDrift: () => checkPrevDrift(), approvals: () => S.approvals || {}, approvalWrite, cloudOn: () => !!store.cloud.user, cloudMeta: (p) => store.cloudMeta(p), syncNow, S, esc, pill, fmtNum, fmtTs, cpVal, cpTable, kpi, kpiN, emptyNote, mountTable, exportTable, exportBook, markDirty, audit, toast, busy, parseFile, guardEdit: guardMutate, canEdit: canEditPeriod, parseNum, isAdmin: () => store.isAdmin(), who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), render, derived: derivedNow, loadPeriodData });
PV.install({ loadPeriodData, S, esc, pill, fmtNum, fmtTs, kpi, emptyNote, mountTable, exportTable, markDirty, audit, toast, busy, parseFile, guardEdit: guardMutate, canEdit: canEditPeriod, who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này'), render, derived: derivedNow });
DBV.install({ S, esc, pill, fmtNum, fmtTs, kpi, emptyNote, mountTable, exportTable, toast, render, derived: derivedNow, exportHachToan: () => exportHachToan(), loadStep5: (p) => store.localGet(lk(p, 'step5')), loadPeriodData, readPeriod: (p, names) => readPeriodVerified(p, names), periods: () => S.allPeriods || S.periods || [], markDirty, audit, parseNum, guardEdit: guardMutate, closedGuard: () => P3.closedGuard(), who: () => (store.cloud.user ? store.cloud.user.email : 'thiết bị này') });

// ======================= boot =======================
(async function boot() {
  I18N.initI18n(() => render()); // v1.14.59: VI / EN switch in the header
  routeFromHash();
  await refreshPeriods();
  const last = localStorage.getItem('svl.period');
  if (last && isPeriod(last)) await openPeriod(last); else if (S.periods[0]) await openPeriod(S.periods[0]); else render();
  if (store.cloud.enabled) {
    store.initCloud(async (u) => {
      notices.setUser(u);
      if (!u) stopPeriodWatch();
      renderShell();
      accessDraft = null;
      if (u) { await refreshPeriods(); if (S.period) await openPeriod(S.period); else if (S.periods[0]) await openPeriod(S.periods[0]); }
      else if (store.cloud.error) toast(store.cloud.error, 'review');
      render();
    });
  }
})();
