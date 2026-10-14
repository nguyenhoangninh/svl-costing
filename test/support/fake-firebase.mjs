// In-memory stand-in for the Firebase Web SDK (auth + Firestore) used by src/store.js, served to the browser through
// Playwright route interception so the REAL app code runs in a real browser against it.
// It records every write in window.__fake.log, can inject failures, and can drop the reply after a commit.
// It does NOT enforce firestore.rules and it is NOT Google's backend: it verifies the app's control flow
// (transactions, ordering, retries, rollback), never server-side security.

export const SDK_URLS = {
  app: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  auth: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  fs: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
};
const EXPORTS = {
  app: ['initializeApp'],
  auth: ['getAuth', 'getRedirectResult', 'onAuthStateChanged', 'signOut', 'GoogleAuthProvider', 'signInWithPopup', 'signInWithRedirect'],
  fs: ['getFirestore', 'collection', 'doc', 'getDoc', 'setDoc', 'deleteDoc', 'addDoc', 'getDocs', 'onSnapshot', 'query', 'where', 'orderBy', 'limit', 'startAfter', 'documentId', 'runTransaction', 'serverTimestamp'],
};

/** Runs inside the page before any app script. */
function fakeMain() {
  const S = {
    docs: new Map(), // path → data
    log: [], // every write / failure, in order
    fail: {}, // op → { count, msg, code }
    dropReplyAfterCommit: 0, // next N transactions commit but reject
    uid: 'uid-admin', email: 'admin.test@example.com', signedIn: true, listeners: [], seq: 0,
    snapListeners: [], // onSnapshot subscriptions: { target, next, error, last }
  };
  window.__fake = S;
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const user = () => (S.signedIn ? { uid: S.uid, email: S.email, displayName: S.email } : null);
  const notify = () => S.listeners.forEach((cb) => setTimeout(() => cb(user()), 0));
  const failIf = (op) => {
    const f = S.fail[op];
    if (f && f.count > 0) { f.count--; S.log.push({ op, failed: true }); const e = new Error(f.msg || 'injected failure'); e.code = f.code || 'unavailable'; throw e; }
  };
  const DOCID = { __docId: true };
  class Ref { constructor(path) { this.path = path; this.id = path.split('/').pop(); } }
  class Col { constructor(path) { this.path = path; } }
  const metadata = { fromCache: false, hasPendingWrites: false };
  const snap = (path) => { const d = S.docs.get(path); const id = path.split('/').pop(); return { id, ref: new Ref(path), exists: () => d !== undefined, data: () => clone(d), metadata }; };
  const apply = (w) => {
    if (w.op === 'set') { S.docs.set(w.path, clone(w.data)); }
    else if (w.op === 'delete') { S.docs.delete(w.path); }
    S.log.push({ op: w.op, path: w.path, data: w.op === 'set' ? clone(w.data) : undefined });
    refreshSnapshots();
  };
  const runTransaction = async (_db, fn) => {
    failIf('runTransaction');
    const writes = [];
    const t = {
      get: async (ref) => snap(ref.path),
      set: (ref, data) => writes.push({ op: 'set', path: ref.path, data }),
      delete: (ref) => writes.push({ op: 'delete', path: ref.path }),
      update: (ref, data) => writes.push({ op: 'set', path: ref.path, data: { ...(S.docs.get(ref.path) || {}), ...data } }),
    };
    const out = await fn(t);
    writes.forEach(apply);
    S.log.push({ op: 'commit', writes: writes.length });
    if (S.dropReplyAfterCommit > 0) { S.dropReplyAfterCommit--; const e = new Error('reply lost after commit'); e.code = 'unavailable'; throw e; }
    return out;
  };
  const isDirectChild = (path, base) => path.startsWith(base + '/') && path.slice(base.length + 1).split('/').length === 1;
  const runQuery = async (q) => {
    const cons = q instanceof Col ? [] : q.constraints;
    const base = q instanceof Col ? q.path : q.col.path;
    let rows = [...S.docs.keys()].filter((p) => isDirectChild(p, base)).map((p) => ({ id: p.split('/').pop(), path: p }));
    for (const c of cons) if (c.type === 'where') rows = rows.filter((r) => { const d = S.docs.get(r.path) || {}; return d[c.field] === c.value; });
    const ord = cons.find((c) => c.type === 'orderBy') || { field: DOCID, dir: 'asc' };
    const key = (r) => (ord.field && ord.field.__docId ? r.id : (S.docs.get(r.path) || {})[ord.field]);
    rows.sort((a, b) => { const x = key(a), y = key(b); const c = x < y ? -1 : x > y ? 1 : 0; return ord.dir === 'desc' ? -c : c; });
    const sa = cons.find((c) => c.type === 'startAfter');
    if (sa) { const i = rows.findIndex((r) => r.id === sa.snap.id); rows = rows.slice(i + 1); }
    const lim = cons.find((c) => c.type === 'limit');
    if (lim) rows = rows.slice(0, lim.n);
    const docs = rows.map((r) => snap(r.path));
    return { docs, empty: docs.length === 0, size: docs.length, metadata };
  };
  const getDocs = async (q) => { failIf('getDocs'); return runQuery(q); };
  // Realtime listeners: deliver the current state at subscribe time and after every write that changes it.
  const evaluate = async (target) => (target instanceof Ref ? snap(target.path) : runQuery(target));
  const refreshSnapshots = () => {
    for (const l of S.snapListeners) {
      if (l.closed) continue;
      evaluate(l.target).then((res) => {
        const key = JSON.stringify(res.docs ? res.docs.map((d) => [d.id, d.data()]) : [res.id, res.exists(), res.data()]);
        if (key === l.last) return;
        l.last = key; l.next(res);
      }).catch((e) => { if (l.error) l.error(e); });
    }
  };
  const onSnapshot = (target, next, error) => {
    const l = { target, next, error, last: null, closed: false };
    S.snapListeners.push(l);
    evaluate(target).then((res) => { l.last = JSON.stringify(res.docs ? res.docs.map((d) => [d.id, d.data()]) : [res.id, res.exists(), res.data()]); next(res); }).catch((e) => { if (error) error(e); });
    return () => { l.closed = true; };
  };
  const addDoc = async (col, data) => { failIf('addDoc'); const path = col.path + '/auto' + (++S.seq); apply({ op: 'set', path, data }); return new Ref(path); };
  window.__FBI = {
    initializeApp: (cfg, name) => ({ name, options: cfg }),
    getAuth: () => ({ currentUser: user() }),
    getRedirectResult: async () => null,
    onAuthStateChanged: (_auth, cb) => { S.listeners.push(cb); setTimeout(() => cb(user()), 0); return () => {}; },
    signOut: async () => { S.signedIn = false; notify(); },
    GoogleAuthProvider: class { setCustomParameters() {} },
    signInWithPopup: async () => { S.signedIn = true; notify(); return { user: user() }; },
    signInWithRedirect: async () => { S.signedIn = true; notify(); },
    getFirestore: () => ({ __db: true }),
    collection: (_db, ...segs) => new Col(segs.join('/')),
    doc: (_db, ...segs) => new Ref(segs.join('/')),
    getDoc: async (ref) => { failIf('getDoc'); return snap(ref.path); },
    setDoc: async (ref, data) => { failIf('setDoc'); apply({ op: 'set', path: ref.path, data }); },
    deleteDoc: async (ref) => { failIf('deleteDoc'); apply({ op: 'delete', path: ref.path }); },
    addDoc,
    getDocs,
    onSnapshot,
    query: (col, ...constraints) => ({ col, constraints }),
    where: (field, op, value) => ({ type: 'where', field, op, value }),
    orderBy: (field, dir = 'asc') => ({ type: 'orderBy', field, dir }),
    limit: (n) => ({ type: 'limit', n }),
    startAfter: (snapshot) => ({ type: 'startAfter', snap: snapshot }),
    documentId: () => DOCID,
    runTransaction,
    serverTimestamp: () => ({ __serverTimestamp: true }),
  };
}

/** Install the fake SDK on a Playwright page. Call before page.goto(). */
export async function installFakeFirebase(page) {
  await page.addInitScript(fakeMain);
  for (const [k, url] of Object.entries(SDK_URLS)) {
    await page.route(url, (route) => route.fulfill({
      contentType: 'application/javascript',
      body: EXPORTS[k].map((n) => `export const ${n} = window.__FBI.${n};`).join('\n'),
    }));
  }
}
