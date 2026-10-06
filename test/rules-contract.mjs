import fs from 'node:fs';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++; };
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../src/store.js', import.meta.url), 'utf8');
const phase3 = fs.readFileSync(new URL('../src/views/phase3.js', import.meta.url), 'utf8');

ok('explicit admin CLOSE transition exists', rules.includes("isAdmin() && closedOf(resource.data) == null && closedOf(request.resource.data) != null"));
ok('closed period REOPEN changes only closed manifest key', rules.includes("affectedKeys().hasOnly(['closed'])"));
ok('REOPEN summary permits closed + everClosed + live step5 status', rules.includes("affectedKeys().hasOnly(['closed', 'everClosed', 'step5'])"));
ok('reopen preserves everClosed=true', rules.includes("request.resource.data.summary.get('everClosed', false) == true"));
ok('hard delete blocked after everClosed', rules.includes("get('everClosed', false) != true"));
ok('content-addressed chunks are create-only', rules.includes('allow create: if canWrite() && periodOpen(period);') && rules.includes('allow update: if false;'));
ok('old CLOSED chunk exception removed', !rules.includes("chunk.matches('closed@.*')"));
ok('revision rev bound to parent', rules.includes('request.resource.data.rev == getAfter(periodPath(period)).data.rev'));
ok('revision hash bound to parent', rules.includes('request.resource.data.manifestHash == getAfter(periodPath(period)).data.manifestHash'));
ok('revision blob manifest exactly equals parent', rules.includes('request.resource.data.blobs == getAfter(periodPath(period)).data.blobs'));
ok('revision summary exactly equals parent', rules.includes('request.resource.data.summary == getAfter(periodPath(period)).data.summary'));
ok('revision documents immutable', /match \/revisions\/\{revision\}[\s\S]*allow update, delete: if false;/.test(rules));
ok('audit events immutable', /match \/svl_costing_audit\/\{id\}[\s\S]*allow update, delete: if false;/.test(rules));
ok('owner email is a placeholder (public repo – real email only in the Firebase console)', rules.includes("myEmail() in ['YOUR_EMAIL@gmail.com']") && !/@gmail\.com'\]/.test(rules.replace("'YOUR_EMAIL@gmail.com'", '')));
ok('cloudSave preserves everClosed after close/reopen', store.includes('safeSummary.everClosed = true'));
ok('cloudDelete checks everClosed metadata', store.includes('meta.summary.everClosed'));
ok('cloudDelete checks historical closed revision', store.includes('r.summary && r.summary.closed'));
ok('close persists local closedEver retention state', phase3.includes('d.closedEver = true'));
ok('close snapshots exception package', phase3.includes('exceptions'));
ok('CLOSE has cloud-state preflight', phase3.includes("Cloud đã ghi kỳ này là CLOSED"));
ok('REOPEN has cloud-state preflight', phase3.includes("Cloud đang ở trạng thái OPEN"));
ok('permission error gives rules/admin guidance', phase3.includes('Publish firestore.rules v1.10.1'));

console.log(`\n${total - fail}/${total} Firestore/accounting retention contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
