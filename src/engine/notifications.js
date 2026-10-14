// Live Notifications 1+2: a notification describes a COMMITTED cloud revision, not a draft or keypress.
// All classification lives here so it can be tested without Firebase or a browser.
export const NOTICE_LIMIT = 80;
export const SEEN_LIMIT = 180;

const str = (v) => String(v == null ? '' : v);
const match = (value, re) => re.test(str(value).toUpperCase());
export function classifyAction(action = '') {
  if (match(action, /CLOSE MONTH|REOPEN PERIOD/)) return { category: 'period', kind: 'critical', view: 'close' };
  if (match(action, /APPROVE|APPROVAL|REVIEWER|\bHOLD\b|REJECT|DECISION|NO ADJUSTMENT/)) return { category: 'approval', kind: 'warning', view: match(action, /3B|WIP/) ? 'p3b' : match(action, /RETURN|5R/) ? 'salesreturn' : 'cc' };
  if (match(action, /RETURN|5R|CREDIT NOTE/)) return { category: 'return', kind: 'warning', view: 'salesreturn' };
  if (match(action, /3B|WIP DIRECT/)) return { category: 'calculation', kind: 'warning', view: 'p3b' };
  if (match(action, /STEP 4|COST ALLOCATION/)) return { category: 'calculation', kind: 'info', view: 'step4' };
  if (match(action, /FIFO|STEP 5|FG HISTORY|REWORK/)) return { category: 'calculation', kind: 'info', view: 'step5' };
  if (match(action, /STEP 3|MATERIAL WIP/)) return { category: 'calculation', kind: 'info', view: 'step3' };
  if (match(action, /STEP 2|CONSUMPTION|STOCK OUT/)) return { category: 'calculation', kind: 'info', view: 'step2' };
  if (match(action, /IMPORT|ERP|PRICE|SALES|STOCK|OPENING|OVERRIDE|EDIT|INPUT|RESET|MAP/)) return { category: 'data', kind: 'info', view: 'step1' };
  return { category: 'other', kind: 'info', view: 'cc' };
}
function changedStatus(prev, next, key) {
  const a = str(prev && prev.summary && prev.summary[key]).toUpperCase();
  const b = str(next && next[key]).toUpperCase();
  return a && a !== b && /^(OUTDATED|RERUN|NOT READY|BLOCK|STALE)/.test(b);
}
export function buildCommitNotice({ period, rev, actor, actorUid, previous, summary, audit = [], changed = false }) {
  const old = previous && previous.summary || {};
  const closing = !old.closed && !!summary.closed;
  const reopening = !!old.closed && !summary.closed;
  const newStale = ['step3', 'step4', 'step5'].filter((key) => changedStatus(previous, summary, key));
  const recent = (audit || []).filter((e) => e && e.action && (!previous || !previous.updatedAt || str(e.at) > str(previous.updatedAt)))
    .slice(0, 40);
  // Do not create a distracting notice for an unchanged manual Sync.
  if (!changed && !closing && !reopening && !newStale.length) return null;
  const latest = recent[0];
  let action = latest ? str(latest.action) : 'CLOUD SYNC';
  let kind, category, view, title, detail;
  if (closing) {
    ({ kind, category, view } = { kind: 'critical', category: 'period', view: 'close' });
    title = 'Đã đóng kỳ giá thành'; detail = 'Kỳ được chuyển sang chỉ đọc. Các Step không còn được chỉnh sửa.';
    action = 'STEP 5 - CLOSE MONTH';
  } else if (reopening) {
    ({ kind, category, view } = { kind: 'critical', category: 'period', view: 'close' });
    title = 'Đã mở lại kỳ giá thành'; detail = 'Dữ liệu được mở lại để điều chỉnh. Cần kiểm tra các checkpoint.';
    action = 'STEP 5 - REOPEN PERIOD';
  } else if (newStale.length) {
    ({ kind, category, view } = { kind: 'warning', category: 'stale', view: newStale.includes('step4') ? 'step4' : newStale.includes('step5') ? 'step5' : 'step3' });
    title = 'Kết quả cần kiểm tra / chạy lại';
    detail = newStale.map((k) => k.toUpperCase()).join(', ') + ' đã thay đổi trạng thái sau khi dữ liệu được cập nhật.';
  } else {
    ({ kind, category, view } = classifyAction(action));
    title = latest ? str(latest.action).slice(0, 115) : 'Dữ liệu giá thành đã cập nhật';
    detail = recent.length > 1 ? `${recent.length} thao tác được ghi nhận trong lần lưu này. ` : '';
    detail += latest ? str(latest.detail).slice(0, 300) : 'Một phiên bản dữ liệu mới đã được lưu lên Cloud.';
  }
  return { period, rev, actor: str(actor).toLowerCase(), actorUid: str(actorUid), action: action.slice(0, 160), title, detail: detail.slice(0, 420), kind, category, view, changes: recent.length, affected: newStale };
}
export function isNoticeRead(n, state) {
  if (!n) return true;
  if (state && Array.isArray(state.seen) && state.seen.includes(n.id)) return true;
  const since = state && state.readThrough && (typeof state.readThrough.toMillis === 'function' ? state.readThrough.toMillis() : new Date(state.readThrough).getTime());
  const at = n.createdAt && (typeof n.createdAt.toMillis === 'function' ? n.createdAt.toMillis() : new Date(n.createdAt).getTime());
  return Number.isFinite(since) && Number.isFinite(at) && at <= since;
}
export function unreadCount(list, state) {
  return (list || []).filter((n) => !isNoticeRead(n, state)).length;
}
export function nextSeen(state, id) {
  return [...new Set([...(state && state.seen || []), id])].slice(-SEEN_LIMIT);
}
