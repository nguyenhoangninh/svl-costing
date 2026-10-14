// Compatibility contracts; Firebase-permission behavior still requires a live, signed-in UAT.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const store = fs.readFileSync(new URL('../src/store.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/ui/notifications.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

assert.ok(store.includes('export function watchPeriodActivity('), 'fallback reads existing authorized period metadata');
assert.ok(store.includes("F.collection(fb.fs, CLOUD_COLLECTION), F.orderBy('updatedAt', 'desc'), F.limit(80)"), 'fallback query bounded and indexed');
assert.ok(store.includes('Chế độ tương thích không có chi tiết thao tác / Step.'), 'fallback never guesses a Step or approval');
assert.ok(ui.includes("e.code === 'permission-denied' && !compatibleFeed"), 'notification read rejection activates fallback');
assert.ok(ui.includes('store.watchPeriodActivity(onRows,'), 'real-time fallback uses period read permission');
assert.ok(ui.includes("e.code === 'permission-denied') setLocalReadMode()"), 'read receipts gracefully downgrade');
assert.ok(ui.includes("svl.notice.read."), 'fallback read receipts stored locally per UID');
assert.ok(ui.includes('Trạng thái đã đọc đang lưu trên thiết bị này'), 'downgrade disclosed, not claimed cross-device sync');
assert.ok(ui.includes('Admin cần publish Firestore Rules v1.14.43'), 'permission fix clearly instructed');
assert.ok(!ui.includes('localStorage.setItem(localKey(), JSON.stringify(rows)'), 'no accounting or notice payload cached to localStorage');
assert.ok(html.includes('.notice-compat'), 'fallback has styled UI');
assert.ok(rules.includes('match /svl_costing_notifications/{id}') && rules.includes('match /svl_costing_notification_reads/{uid}'), 'source rules remain authorization-scoped');
assert.ok(rules.includes('request.auth.uid == uid') && rules.includes('allow read: if canRead();'), 'no globally public reads introduced');
console.log('PASS: notification permission fallback contracts (13/13)');
