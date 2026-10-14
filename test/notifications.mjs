import assert from 'node:assert/strict';
import { classifyAction, buildCommitNotice, isNoticeRead, unreadCount, nextSeen } from '../src/engine/notifications.js';

const base = { period: '2026-09', rev: 12, actor: 'ACCOUNTING@EXAMPLE.COM', actorUid: 'u1',
  previous: { updatedAt: '2026-10-14T10:00:00.000Z', summary: { closed: null, step3: 'PASS', step4: 'PASS', step5: 'PASS' } },
  summary: { closed: null, step3: 'PASS', step4: 'PASS', step5: 'PASS' }, changed: true };
function make(overrides = {}) { return buildCommitNotice({ ...base, ...overrides }); }

assert.equal(classifyAction('STEP 3B - APPLY & SYNC').view, 'p3b');
assert.equal(classifyAction('STEP 5R APPROVE MANUAL COST').category, 'approval');
assert.equal(classifyAction('STEP 5 - RUN FIFO COGS').view, 'step5');
assert.equal(classifyAction('STEP 4 - COST ALLOCATION').view, 'step4');
assert.equal(classifyAction('ERP MAP OVERRIDE').category, 'data');
assert.equal(classifyAction('STEP 5 - CLOSE MONTH').kind, 'critical');

const update = make({ audit: [{ action: 'STEP 3B - APPLY & SYNC', detail: '12 lots', at: '2026-10-14T10:01:00.000Z' }] });
assert.equal(update.view, 'p3b');
assert.equal(update.kind, 'warning');
assert.equal(update.changes, 1);
assert.equal(update.actor, 'accounting@example.com');

const stale = make({ summary: { ...base.summary, step4: 'OUTDATED - RERUN REQUIRED' } });
assert.equal(stale.category, 'stale');
assert.equal(stale.view, 'step4');
assert.ok(stale.affected.includes('step4'));

const close = make({ summary: { ...base.summary, closed: '2026-10-14T10:02:00.000Z' } });
assert.equal(close.kind, 'critical');
assert.equal(close.category, 'period');
assert.equal(close.view, 'close');

const reopen = make({ previous: { ...base.previous, summary: { ...base.previous.summary, closed: '2026-10-14T10:02:00.000Z' } } });
assert.equal(reopen.kind, 'critical');
assert.match(reopen.title, /mở lại/i);
assert.equal(make({ changed: false }), null);

const oldAction = make({ audit: [{ action: 'STEP 2', detail: 'old', at: '2026-10-14T09:00:00.000Z' }] });
assert.equal(oldAction.title, 'Dữ liệu giá thành đã cập nhật');

const n1 = { id: '2026-09_12', createdAt: { toMillis: () => 200 } };
const n2 = { id: '2026-09_13', createdAt: { toMillis: () => 300 } };
assert.equal(unreadCount([n1, n2], { seen: [] }), 2);
assert.equal(unreadCount([n1, n2], { seen: ['2026-09_12'] }), 1);
assert.equal(isNoticeRead(n1, { readThrough: { toMillis: () => 250 }, seen: [] }), true);
assert.equal(isNoticeRead(n2, { readThrough: { toMillis: () => 250 }, seen: [] }), false);
assert.deepEqual(nextSeen({ seen: ['a'] }, 'a'), ['a']);
assert.deepEqual(nextSeen({ seen: ['a'] }, 'b'), ['a', 'b']);
console.log('PASS: Live Notification Center 1+2 classification, commit and read-state tests');
