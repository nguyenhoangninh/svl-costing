// Virtualised data table: handles 20k+ rows, search, column filter by status, totals, inline edit.
import { fmtCell, statusClass } from './format.js';

const ROW_H = 30;

/**
 * mountTable(el, {columns, rows, getRow?, editable?, onEdit?, totals?, height?, searchKeys?, filterKey?})
 * columns: [{key, label, type, width, editable, options}]
 */
export function mountTable(el, cfg) {
  const cols = cfg.columns;
  const val = (r, c) => (Array.isArray(r) ? r[c.key] : r[c.key]);
  let view = cfg.rows.slice();
  let sortCol = null, sortDir = 1, query = '', statusFilter = '';
  const filterKey = cfg.filterKey;
  const statuses = filterKey ? [...new Set(cfg.rows.map((r) => String(val(r, cols.find((c) => c.key === filterKey)) ?? '')))].filter(Boolean).sort() : [];

  el.classList.add('vt');
  el.innerHTML = `
    <div class="vt-tools">
      <input type="search" class="vt-search" placeholder="Tìm trong ${cfg.rows.length.toLocaleString('vi-VN')} dòng…" aria-label="Tìm kiếm">
      ${statuses.length ? `<select class="vt-filter" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${statuses.map((s) => `<option>${esc(s)}</option>`).join('')}</select>` : ''}
      <span class="vt-count"></span>
      <span class="vt-spacer"></span>
      ${cfg.onExport ? '<button class="btn ghost vt-export" type="button">Xuất Excel</button>' : ''}
    </div>
    <div class="vt-scroll" tabindex="0" style="height:${cfg.height || 520}px">
      <table class="vt-table"><colgroup>${cols.map((c) => `<col style="width:${c.width || 120}px">`).join('')}</colgroup>
        <thead><tr>${cols.map((c, i) => `<th data-i="${i}" class="${c.type === 'num' || c.type === 'qty' || c.type === 'pct' || c.type === 'int' ? 'r' : ''}" title="Sắp xếp">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody></tbody>
        <tfoot></tfoot>
      </table>
    </div>`;
  const scroll = el.querySelector('.vt-scroll');
  const tbody = el.querySelector('tbody');
  const tfoot = el.querySelector('tfoot');
  const countEl = el.querySelector('.vt-count');

  function apply() {
    const q = query.trim().toLowerCase();
    view = cfg.rows.filter((r) => {
      if (statusFilter && String(val(r, cols.find((c) => c.key === filterKey)) ?? '') !== statusFilter) return false;
      if (!q) return true;
      for (const c of cols) { const v = val(r, c); if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) return true; }
      return false;
    });
    if (sortCol) {
      const c = sortCol;
      view.sort((a, b) => {
        const x = val(a, c), y = val(b, c);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortDir;
        return String(x ?? '').localeCompare(String(y ?? ''), 'vi', { numeric: true }) * sortDir;
      });
    }
    countEl.textContent = view.length === cfg.rows.length ? `${view.length.toLocaleString('vi-VN')} dòng` : `${view.length.toLocaleString('vi-VN')} / ${cfg.rows.length.toLocaleString('vi-VN')} dòng`;
    renderTotals();
    render(true);
  }

  function renderTotals() {
    if (!cfg.totals) { tfoot.innerHTML = ''; return; }
    tfoot.innerHTML = `<tr>${cols.map((c, i) => {
      if (i === 0) return '<td>Tổng</td>';
      if (cfg.totals.includes(c.key)) { let s = 0; for (const r of view) s += +val(r, c) || 0; return `<td class="r">${fmtCell(s, c.type)}</td>`; }
      return '<td></td>';
    }).join('')}</tr>`;
  }

  let lastStart = -1;
  function render(force) {
    const h = scroll.clientHeight || 520;
    const start = Math.max(0, Math.floor(scroll.scrollTop / ROW_H) - 10);
    const end = Math.min(view.length, start + Math.ceil(h / ROW_H) + 20);
    if (!force && start === lastStart) return;
    lastStart = start;
    const top = start * ROW_H, bottom = (view.length - end) * ROW_H;
    let html = `<tr class="vt-pad" style="height:${top}px"></tr>`;
    for (let i = start; i < end; i++) {
      const r = view[i];
      html += `<tr data-v="${i}">${cols.map((c) => cellHTML(r, c)).join('')}</tr>`;
    }
    html += `<tr class="vt-pad" style="height:${bottom}px"></tr>`;
    tbody.innerHTML = html;
  }

  function cellHTML(r, c) {
    const v = val(r, c);
    const right = c.type === 'num' || c.type === 'qty' || c.type === 'pct' || c.type === 'int';
    if (c.editable && cfg.onEdit) {
      if (c.options) return `<td class="ed"><select data-k="${c.key}">${['', ...c.options].map((o) => `<option ${String(v ?? '') === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
      const shown = c.type === 'date' ? fmtCell(v, 'dateInput') : (v ?? '');
      return `<td class="ed"><input data-k="${c.key}" ${c.type === 'date' ? 'type="date"' : right ? 'inputmode="decimal"' : ''} value="${esc(shown)}"></td>`;
    }
    if (c.type === 'status') return `<td><span class="pill ${statusClass(v)}">${esc(v ?? '')}</span></td>`;
    return `<td class="${right ? 'r' : ''}${typeof v === 'number' && v < 0 && right ? ' neg' : ''}" title="${esc(c.type === 'text' || !c.type ? v ?? '' : '')}">${fmtCell(v, c.type)}</td>`;
  }

  scroll.addEventListener('scroll', () => render(false), { passive: true });
  el.querySelector('.vt-search').addEventListener('input', (e) => { query = e.target.value; apply(); });
  const fsel = el.querySelector('.vt-filter');
  if (fsel) fsel.addEventListener('change', (e) => { statusFilter = e.target.value; apply(); });
  el.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('th'); if (!th) return;
    const c = cols[+th.dataset.i];
    if (sortCol === c) sortDir = -sortDir; else { sortCol = c; sortDir = 1; }
    el.querySelectorAll('th').forEach((t) => t.removeAttribute('aria-sort'));
    th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
    apply();
  });
  if (cfg.onExport) el.querySelector('.vt-export').addEventListener('click', () => cfg.onExport(view));
  if (cfg.onEdit) {
    tbody.addEventListener('change', (e) => {
      const inp = e.target.closest('[data-k]'); if (!inp) return;
      const tr = inp.closest('tr'); const r = view[+tr.dataset.v];
      cfg.onEdit(r, inp.dataset.k, inp.value);
      render(true);
    });
  }
  apply();
  return { refresh: (rows) => { if (rows) cfg.rows = rows; apply(); } };
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
