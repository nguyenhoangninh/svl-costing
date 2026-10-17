// v1.14.92 (audit SEC-02): the Firestore backup can be restored. Runs on the Firestore Emulator (CI e2e job):
// seed documents of every kind the app stores → backup → wipe → restore → the database is identical.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import * as A from 'firebase-admin/firestore';
import { backup, restore, dumpAll } from '../tools/firestore-backup.mjs';

const project = 'demo-svl-backup';
const db = A.getFirestore(initializeApp({ projectId: project }));
let total = 0, fail = 0;
const ok = (label, cond, extra = '') => { total++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${!cond && extra ? ' — ' + extra : ''}`); };
const wipe = () => fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });

await wipe();
const ts = new A.Timestamp(1760000000, 123000000);
await db.doc('svl_costing_config/access').set({ members: { 'a@svl.test': 'admin' } });
await db.doc('svl_costing_periods/2026-08').set({ rev: 3, summary: { closed: null, everClosed: true, step5: 'PASS' }, blobs: { step5: 'h1' }, updatedAt: ts });
await db.doc('svl_costing_periods/2026-08/chunks/abc').set({ data: Buffer.from([0x1f, 0x8b, 0, 255, 7]), n: 1 });
await db.doc('svl_costing_periods/2026-08/revisions/3').set({ rev: 3, at: ts, blobs: { step5: 'h1' }, list: [1, 'x', { y: ts }] });
await db.doc('svl_costing_periods/2026-09/chunks/only').set({ data: 'pointer-less period' }); // a document that only holds a sub-collection
await db.doc('svl_costing_audit/e1').set({ by: 'a@svl.test', ref: db.doc('svl_costing_periods/2026-08'), n: 1.5, t: true });

const before = await dumpAll(db, A);
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'svl-bk-')), 'backup.ndjson.gz');
const r = await backup(db, A, file);
ok('backup lists every document, sub-collections included', r.docs === 6 && before.length === 6, JSON.stringify(r));
await wipe();
ok('wipe empties the emulator', (await dumpAll(db, A)).length === 0);
await restore(db, A, file);
const after = await dumpAll(db, A);
ok('restore gives back the same documents, field by field (timestamps, bytes, references, nested lists)', JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after).slice(0, 300));
const chunk = (await db.doc('svl_costing_periods/2026-08/chunks/abc').get()).data();
ok('restored chunk keeps its binary content and type', Buffer.isBuffer(chunk.data) && chunk.data.equals(Buffer.from([0x1f, 0x8b, 0, 255, 7])));
const rv = (await db.doc('svl_costing_periods/2026-08/revisions/3').get()).data();
ok('restored timestamp is a Firestore Timestamp', rv.at instanceof A.Timestamp && rv.at.isEqual(ts));

console.log(`\n${total - fail}/${total} backup / restore checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
