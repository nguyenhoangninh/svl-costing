import { isNoticeRead, unreadCount } from '../engine/notifications.js';

// Header notification center. All text comes from escaped text nodes, never from raw Firestore HTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (ts) => {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts || 0);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Đang đồng bộ';
};
const ICON = { critical: '!', warning: '!', info: 'i' };
export function createNotificationUI({ store, toast, navigate }) {
  const root = document.getElementById('notice-root');
  if (!root) throw new Error('Thiếu #notice-root');
  let user = '', unsubscribeRows = null, unsubscribeReads = null;
  let rows = [], reads = { seen: [] }, first = true, known = new Set(), open = false, filter = 'all', current = '', error = '';
  const clean = () => { if (unsubscribeRows) unsubscribeRows(); if (unsubscribeReads) unsubscribeReads(); unsubscribeRows = null; unsubscribeReads = null; };
  const unseen = (n) => !isNoticeRead(n, reads);
  function draw() {
    root.hidden = !user;
    if (!user) { root.innerHTML = ''; return; }
    const count = unreadCount(rows, reads);
    const subset = rows.filter((n) => {
      if (filter === 'unread') return unseen(n);
      if (filter === 'current') return n.period === current;
      if (filter === 'critical') return n.kind === 'critical' || n.kind === 'warning';
      return true;
    });
    root.innerHTML = `<button type="button" class="notice-bell" id="notice-bell" data-notice="toggle"
       aria-label="Thông báo${count ? ', ' + count + ' chưa đọc' : ''}" aria-expanded="${open}" aria-controls="notice-panel" title="Trung tâm thông báo">
       <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
       ${count ? `<span class="notice-count">${count > 99 ? '99+' : count}</span>` : ''}
      </button>
      ${open ? `<div class="notice-panel" id="notice-panel" role="dialog" aria-label="Trung tâm thông báo">
        <div class="notice-head"><div><strong>Thông báo</strong><div class="notice-desc">${count} chưa đọc · ${rows.length} gần nhất</div></div>
          <button type="button" class="notice-dismiss" data-notice="close" aria-label="Đóng thông báo">×</button></div>
        <div class="notice-tools">
          <select id="notice-filter" data-notice-filter aria-label="Lọc thông báo">
            <option value="all" ${filter === 'all' ? 'selected' : ''}>Tất cả kỳ</option>
            <option value="current" ${filter === 'current' ? 'selected' : ''}>Kỳ đang xem${current ? ' (' + esc(current) + ')' : ''}</option>
            <option value="unread" ${filter === 'unread' ? 'selected' : ''}>Chưa đọc</option>
            <option value="critical" ${filter === 'critical' ? 'selected' : ''}>Quan trọng / Khẩn</option>
          </select>
          <button type="button" data-notice="allread" class="notice-readall" ${count ? '' : 'disabled'}>Đọc tất cả</button>
        </div>
        ${error ? `<div class="notice-error">Không kết nối được thông báo: ${esc(error)}</div>` : ''}
        <div class="notice-list" role="list">
          ${subset.length ? subset.map((n) => `<button type="button" role="listitem" class="notice-item ${esc(n.kind)} ${unseen(n) ? 'unread' : ''}" data-notice="item" data-id="${esc(n.id)}">
              <span class="notice-type" aria-hidden="true">${ICON[n.kind] || 'i'}</span>
              <span class="notice-item-main">
                <span class="notice-title">${esc(n.title || n.action || 'Cloud update')}</span>
                <span class="notice-detail">${esc(n.detail || '')}</span>
                <span class="notice-meta">Kỳ ${esc(n.period)} · Rev #${esc(n.rev)} · ${esc(n.actor)} · ${esc(time(n.createdAt))}</span>
              </span>
              ${unseen(n) ? '<span class="notice-dot" title="Chưa đọc"></span>' : ''}
            </button>`).join('') : `<div class="notice-empty">Không có thông báo${filter !== 'all' ? ' phù hợp bộ lọc' : ''}.</div>`}
        </div><div class="notice-foot">Thông báo phát sinh khi dữ liệu đã được Cloud xác nhận. Chỉ hiển thị 80 bản ghi gần nhất.</div>
      </div>` : ''}`;
  }
  function setUser(next) {
    const email = String(next && next.email || '').toLowerCase();
    if (email === user) return;
    clean(); user = email; rows = []; reads = { seen: [] }; known = new Set(); first = true; open = false; error = '';
    draw();
    if (!email) return;
    unsubscribeRows = store.watchNotifications((newRows, metadata) => {
      const fresh = !first && !metadata.fromCache
        ? newRows.filter((n) => !known.has(n.id) && String(n.actor).toLowerCase() !== user).slice(0, 3)
        : [];
      known = new Set(newRows.map((n) => n.id));
      first = false; rows = newRows; error = ''; draw();
      for (const n of fresh) {
        if (n.kind === 'critical') toast(`Kỳ ${n.period}: ${n.title}`, 'block');
        else toast(`Kỳ ${n.period}: ${n.title}`, n.kind === 'warning' ? 'review' : 'info');
      }
    }, (e) => { error = e.message || String(e); draw(); });
    unsubscribeReads = store.watchNotificationReads((state) => { reads = state || { seen: [] }; draw(); }, (e) => { error = e.message || String(e); draw(); });
  }
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-notice]');
    if (!btn) return;
    e.stopPropagation();
    const act = btn.dataset.notice;
    if (act === 'toggle') { open = !open; draw(); }
    if (act === 'close') { open = false; draw(); }
    if (act === 'allread') {
      try { await store.markAllNoticesRead(); } catch (x) { toast('Chưa đồng bộ trạng thái đã đọc: ' + x.message, 'review'); }
    }
    if (act === 'item') {
      const n = rows.find((x) => x.id === btn.dataset.id);
      if (!n) return;
      try { if (unseen(n)) await store.markNoticeRead(n.id); } catch (x) { toast('Chưa đánh dấu được thông báo: ' + x.message, 'review'); }
      open = false; draw();
      await navigate({ period: n.period, view: n.view || 'cc' });
    }
  });
  root.addEventListener('change', (e) => { if (e.target.matches('[data-notice-filter]')) { filter = e.target.value; draw(); } });
  document.addEventListener('click', (e) => { if (open && !root.contains(e.target)) { open = false; draw(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { open = false; draw(); document.getElementById('notice-bell')?.focus(); } });
  return {
    setUser,
    setPeriod(p) { current = p || ''; if (open && filter === 'current') draw(); },
    destroy() { clean(); user = ''; draw(); },
  };
}
