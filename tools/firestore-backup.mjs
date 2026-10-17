// v1.14.92 (audit SEC-02): independent Firestore backup and restore for SVL Costing.
//   node tools/firestore-backup.mjs backup  <out.ndjson.gz>                 – every collection, every sub-collection
//   node tools/firestore-backup.mjs restore <in.ndjson.gz> [--to-production] – write the documents back
// Credentials: GOOGLE_APPLICATION_CREDENTIALS (service account) or FIRESTORE_EMULATOR_HOST (tests).
// Project: FIREBASE_PROJECT (default svl-costing). Restore refuses the production project without --to-production,
// so a test restore always goes to an emulator or a separate project first.
// File format: gzip of one JSON line per document {path, data}; Timestamps, bytes and references keep their type.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

export function encode(v, A) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof A.Timestamp) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __t: 'b', v: Buffer.from(v).toString('base64') };
  if (v instanceof A.DocumentReference) return { __t: 'ref', p: v.path };
  if (v instanceof A.GeoPoint) return { __t: 'geo', lat: v.latitude, lng: v.longitude };
  if (Array.isArray(v)) return v.map((x) => encode(x, A));
  const o = {}; for (const [k, x] of Object.entries(v)) o[k] = encode(x, A); return o;
}
export function decode(v, A, db) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decode(x, A, db));
  if (v.__t === 'ts') return new A.Timestamp(v.s, v.n);
  if (v.__t === 'b') return Buffer.from(v.v, 'base64');
  if (v.__t === 'ref') return db.doc(v.p);
  if (v.__t === 'geo') return new A.GeoPoint(v.lat, v.lng);
  const o = {}; for (const [k, x] of Object.entries(v)) o[k] = decode(x, A, db); return o;
}

/** Every document of the database, sub-collections included, as [{path, data}] sorted by path. */
export async function dumpAll(db, A) {
  const out = [];
  const walk = async (cols) => {
    for (const col of cols) {
      const docs = await col.listDocuments(); // includes documents that only hold sub-collections
      for (const ref of docs) {
        const snap = await ref.get();
        if (snap.exists) out.push({ path: ref.path, data: encode(snap.data(), A) });
        await walk(await ref.listCollections());
      }
    }
  };
  await walk(await db.listCollections());
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export async function backup(db, A, file) {
  const docs = await dumpAll(db, A);
  fs.writeFileSync(file, zlib.gzipSync(docs.map((d) => JSON.stringify(d)).join('\n') + '\n'));
  return { docs: docs.length, collections: [...new Set(docs.map((d) => d.path.split('/')[0]))].sort() };
}

export async function restore(db, A, file) {
  const lines = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (let i = 0; i < lines.length; i += 400) {
    const b = db.batch();
    for (const d of lines.slice(i, i + 400)) b.set(db.doc(d.path), decode(d.data, A, db));
    await b.commit();
  }
  return { docs: lines.length };
}

async function main() {
  const [cmd, file] = process.argv.slice(2);
  if (!['backup', 'restore'].includes(cmd) || !file) { console.error('usage: firestore-backup.mjs backup|restore <file.ndjson.gz> [--to-production]'); process.exit(2); }
  const project = process.env.FIREBASE_PROJECT || 'svl-costing';
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const A = await import('firebase-admin/firestore');
  const app = initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: project } : { projectId: project, credential: applicationDefault() });
  const db = A.getFirestore(app);
  if (cmd === 'backup') { const r = await backup(db, A, file); console.log(`backup: ${r.docs} documents (${r.collections.join(', ')}) → ${file}`); return; }
  if (project === 'svl-costing' && !process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--to-production')) {
    console.error('restore: refusing to write into the production project svl-costing without --to-production. Restore into an emulator or a test project first.'); process.exit(2);
  }
  const r = await restore(db, A, file); console.log(`restore: ${r.docs} documents written to ${project}${process.env.FIRESTORE_EMULATOR_HOST ? ' (emulator)' : ''}`);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exit(1); });
