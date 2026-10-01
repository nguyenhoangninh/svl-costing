// Persistence: IndexedDB on this device (always) + Firestore cloud sync (when signed in).
// Large objects are gzip-compressed and split into ≤700 KB chunks for Firestore.
import { FIREBASE_CONFIG, ALLOWED_EMAILS, CLOUD_COLLECTION } from './config.js';

// ---------------- IndexedDB ----------------
/** ?sandbox=1 → separate local database, cloud disabled (training / testing; never mixed with production data). */
export const SANDBOX = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sandbox');
const DB_NAME = SANDBOX ? 'svl-costing-sandbox' : 'svl-costing', DB_VER = 1;
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('kv', mode); const s = t.objectStore('kv');
    let out; Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export const localGet = (k) => tx('readonly', (s) => reqP(s.get(k)));
export const localSet = (k, v) => tx('readwrite', (s) => { s.put(v, k); });
export const localDel = (k) => tx('readwrite', (s) => { s.delete(k); });
export const localKeys = () => tx('readonly', (s) => reqP(s.getAllKeys()));

// ---------------- compression ----------------
async function gzip(str) {
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}
async function gunzip(bytes) {
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(ds).text();
}
function toB64(u8) {
  let s = ''; const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64); const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function sha(str) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------- Firebase (lazy) ----------------
const V = '10.12.2';
let fb = null; // {app, auth, fs, mod}
export const cloud = { enabled: !SANDBOX && !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey), user: null, ready: false, offline: false, error: '', role: '', isOwner: false };

export async function initCloud(onUser) {
  if (!cloud.enabled) return;
  try {
    const [appM, authM, fsM] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    const app = appM.initializeApp(FIREBASE_CONFIG, 'svl-costing');
    fb = { app, auth: authM.getAuth(app), fs: fsM.getFirestore(app), A: authM, F: fsM };
    cloud.ready = true;
    authM.onAuthStateChanged(fb.auth, async (u) => {
      cloud.role = ''; cloud.isOwner = false; cloud.error = '';
      if (u && !allowed(u.email)) { cloud.error = `Tài khoản ${u.email} không có quyền truy cập.`; await authM.signOut(fb.auth); return; }
      if (u) {
        try { await loadRole(u); } catch (e) {
          cloud.error = e && e.code === 'permission-denied'
            ? `Tài khoản ${u.email} chưa được cấp quyền dùng dữ liệu giá thành. Nhờ quản trị viên thêm email này trong Cài đặt → Người dùng & phân quyền.`
            : `Không đọc được quyền truy cập (${e && e.code || e}). Kiểm tra kết nối mạng hoặc Firestore đã được tạo chưa.`;
          await authM.signOut(fb.auth); onUser(null); return;
        }
      }
      cloud.user = u || null;
      onUser(cloud.user);
      if (cloud.user) flushAudit();
    });
  } catch (e) { cloud.offline = true; cloud.error = 'Không kết nối được Firebase — chỉ xem dữ liệu đã lưu trên máy này, không chỉnh sửa được cho đến khi kết nối lại.'; console.warn(e); cloud.ready = false; onUser(null); }
}
const allowed = (email) => !ALLOWED_EMAILS.length || ALLOWED_EMAILS.map((x) => x.toLowerCase()).includes(String(email || '').toLowerCase());
export async function signIn() { await fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider()); }
export async function signOut() { await fb.A.signOut(fb.auth); }

// ---------------- users & roles ----------------
// Access list lives in Firestore: svl_costing_config/access = {members: {email: 'admin'|'editor'|'viewer'}, updatedAt, updatedBy}.
// Firestore rules give the owner email(s) permanent admin rights and enforce the roles server-side.
export const ROLES = { admin: 'Quản trị', editor: 'Chỉnh sửa', viewer: 'Chỉ xem' };
const ACCESS_PATH = ['svl_costing_config', 'access'];
const adoc = () => fb.F.doc(fb.fs, ...ACCESS_PATH);
const norm = (e) => String(e || '').trim().toLowerCase();

async function loadRole(u) {
  const snap = await fb.F.getDoc(adoc()); // throws permission-denied when the user is not allowed
  const members = snap.exists() ? snap.data().members || {} : {};
  const r = members[norm(u.email)];
  // A successful read without a membership entry is only possible for an owner listed in the rules.
  cloud.isOwner = !r;
  cloud.role = r || 'admin';
}
/** With Firebase configured, editing requires a signed-in admin/editor (no anonymous local edits of production data). */
export const canEdit = () => (cloud.enabled ? !!cloud.user && (cloud.role === 'admin' || cloud.role === 'editor') : true);
export const isAdmin = () => (cloud.enabled ? !!cloud.user && cloud.role === 'admin' : true);
/** Firebase configured and reachable, but nobody signed in → production data stays hidden. */
export const needsSignIn = () => cloud.enabled && cloud.ready && !cloud.user;

export async function getAccess() {
  const snap = await fb.F.getDoc(adoc());
  return snap.exists() ? snap.data() : { members: {} };
}
export async function saveAccess(members) {
  const clean = {};
  for (const [e, r] of Object.entries(members)) if (norm(e) && ROLES[r]) clean[norm(e)] = r;
  await fb.F.setDoc(adoc(), { members: clean, updatedAt: new Date().toISOString(), updatedBy: cloud.user.email });
  return clean;
}

const pdoc = (period) => fb.F.doc(fb.fs, CLOUD_COLLECTION, period);
const cdoc = (period, id) => fb.F.doc(fb.fs, CLOUD_COLLECTION, period, 'chunks', id);
const CHUNK = 700000;
/** Chunk id of blob `name` part k. New saves use content-addressed keys (name@hash) so a save never overwrites
 *  chunks that the committed manifest still points to; legacy manifests (no key) use name__k. */
const chunkId = (name, m, k) => `${m.key || name}__${k}`;

export class ConflictError extends Error {
  constructor(meta) {
    super(`Kỳ này trên cloud đã được ${meta && meta.updatedBy ? meta.updatedBy : 'người khác'} cập nhật lúc ${meta && meta.updatedAt ? new Date(meta.updatedAt).toLocaleString('vi-VN') : '?'} (bản ${meta ? meta.rev || 0 : 0}). Không ghi đè – hãy tải bản cloud về rồi làm lại thay đổi.`);
    this.name = 'ConflictError'; this.meta = meta;
  }
}

/**
 * Upload changed blobs with optimistic concurrency.
 * baseRev = cloud revision this device last loaded/saved (null = never synced). The commit is a Firestore transaction that
 * only succeeds while the cloud revision is still baseRev; otherwise ConflictError and nothing becomes visible.
 */
export async function cloudSave(period, blobs, summary, onProgress, baseRev) {
  if (!cloud.user) throw new Error('Chưa đăng nhập.');
  const F = fb.F;
  const snap = await F.getDoc(pdoc(period));
  const cur = snap.exists() ? snap.data() : null;
  const curRev = cur ? cur.rev || 0 : 0;
  if (cur && (baseRev === null || baseRev === undefined || curRev !== baseRev)) throw new ConflictError(cur);
  const old = cur ? cur.blobs || {} : {};
  const manifest = {}; const written = [];
  const names = Object.keys(blobs); let i = 0;
  for (const name of names) {
    i++;
    const json = JSON.stringify(blobs[name]);
    const hash = await sha(json);
    if (old[name] && old[name].hash === hash) { manifest[name] = old[name]; continue; }
    onProgress && onProgress(`Đang lưu ${name} (${i}/${names.length})…`);
    const b64 = toB64(await gzip(json));
    const n = Math.ceil(b64.length / CHUNK) || 1;
    const m = { key: `${name}@${hash}`, hash, n, size: json.length, savedAt: new Date().toISOString() };
    for (let k = 0; k < n; k++) { await F.setDoc(cdoc(period, chunkId(name, m, k)), { d: b64.slice(k * CHUNK, (k + 1) * CHUNK) }); written.push(chunkId(name, m, k)); }
    manifest[name] = m;
  }
  const meta = { period, rev: curRev + 1, blobs: manifest, summary: summary || {}, updatedAt: new Date().toISOString(), updatedBy: cloud.user.email };
  try {
    await F.runTransaction(fb.fs, async (t) => {
      const s2 = await t.get(pdoc(period));
      const r2 = s2.exists() ? s2.data().rev || 0 : 0;
      if (s2.exists() !== !!cur || r2 !== curRev) throw new ConflictError(s2.data());
      t.set(pdoc(period), meta);
    });
  } catch (e) {
    // nothing committed: remove the chunks this attempt wrote (best effort, admins only)
    if (isAdmin()) for (const id of written) { if (!referenced(old, id)) await F.deleteDoc(cdoc(period, id)).catch(() => {}); }
    throw e;
  }
  // committed: clean chunks that no manifest references any more (admins only; harmless leftovers otherwise)
  if (isAdmin()) await sweepChunks(period, manifest).catch(() => {});
  return meta;
}
function referenced(manifest, id) {
  for (const [name, m] of Object.entries(manifest || {})) for (let k = 0; k < m.n; k++) if (chunkId(name, m, k) === id) return true;
  return false;
}
async function sweepChunks(period, manifest) {
  const q = await fb.F.getDocs(fb.F.collection(fb.fs, CLOUD_COLLECTION, period, 'chunks'));
  for (const d of q.docs) if (!referenced(manifest, d.id)) await fb.F.deleteDoc(d.ref);
}

export async function cloudMeta(period) {
  if (!cloud.user) return null;
  const s = await fb.F.getDoc(pdoc(period));
  return s.exists() ? s.data() : null;
}

export async function cloudLoad(period, onProgress) {
  const meta = await cloudMeta(period);
  if (!meta) return null;
  const out = {};
  for (const [name, m] of Object.entries(meta.blobs || {})) {
    onProgress && onProgress(`Đang tải ${name}…`);
    let b64 = '';
    for (let k = 0; k < m.n; k++) { const s = await fb.F.getDoc(cdoc(period, chunkId(name, m, k))); if (!s.exists()) throw new Error(`Thiếu dữ liệu ${name} (phần ${k + 1}/${m.n}) trên cloud.`); b64 += s.data().d; }
    const json = await gunzip(fromB64(b64));
    if (m.hash && (await sha(json)) !== m.hash) throw new Error(`Dữ liệu ${name} trên cloud không khớp mã kiểm tra.`);
    out[name] = JSON.parse(json);
  }
  return { meta, blobs: out };
}

export async function cloudPeriods() {
  if (!cloud.user) return [];
  const q = await fb.F.getDocs(fb.F.collection(fb.fs, CLOUD_COLLECTION));
  return q.docs.map((d) => ({ period: d.id, updatedAt: d.data().updatedAt, updatedBy: d.data().updatedBy, summary: d.data().summary || {} }));
}

export async function cloudDelete(period) {
  if (!isAdmin()) throw new Error('Chỉ quản trị viên được xoá kỳ trên cloud.');
  const meta = await cloudMeta(period); if (!meta) return;
  await sweepChunks(period, {});
  await fb.F.deleteDoc(pdoc(period));
}

// ---------------- append-only audit trail (svl_costing_audit) ----------------
const AUDIT = 'svl_costing_audit';
let auditQueue = [];
export function cloudAudit(evt) {
  if (!cloud.enabled) return;
  auditQueue.push(evt);
  localSet('auditQueue', auditQueue).catch(() => {});
  flushAudit();
}
let flushing = false;
export async function flushAudit() {
  if (flushing || !cloud.user || !fb) return;
  flushing = true;
  try {
    if (!auditQueue.length) auditQueue = (await localGet('auditQueue')) || [];
    while (auditQueue.length) {
      const e = auditQueue[0];
      await fb.F.addDoc(fb.F.collection(fb.fs, AUDIT), { ...e, by: cloud.user.email.toLowerCase(), role: cloud.role, serverAt: fb.F.serverTimestamp() });
      auditQueue.shift();
      await localSet('auditQueue', auditQueue);
    }
  } catch (e) { console.warn('audit flush', e); } finally { flushing = false; }
}
export async function cloudAuditList(period) {
  if (!cloud.user) return [];
  const F = fb.F;
  const q = await F.getDocs(F.query(F.collection(fb.fs, AUDIT), F.where('period', '==', period), F.limit(1000)));
  return q.docs.map((d) => { const x = d.data(); return { ...x, serverAt: x.serverAt && x.serverAt.toDate ? x.serverAt.toDate().toISOString() : x.at }; })
    .sort((a, b) => String(b.serverAt).localeCompare(String(a.serverAt)));
}
