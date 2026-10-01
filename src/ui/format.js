import { serialToISO } from '../engine/util.js';

const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nfq = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const nfp = new Intl.NumberFormat('vi-VN', { style: 'percent', minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || v === '' || typeof v !== 'number' || !isFinite(v)) return v ?? '';
  if (Math.abs(v) < 0.005 && digits <= 2) return '–';
  return digits === 2 ? nf2.format(v) : nf0.format(v);
}

export function fmtCell(v, type) {
  if (v === null || v === undefined) return '';
  switch (type) {
    case 'num': return typeof v === 'number' ? (Math.abs(v) < 0.005 ? '–' : nf2.format(v)) : esc(v);
    case 'vnd': return typeof v === 'number' ? fmtNum(v) : esc(v);
    case 'int': return typeof v === 'number' ? nf0.format(v) : esc(v);
    case 'qty': return typeof v === 'number' ? (Math.abs(v) < 0.00005 ? '–' : nfq.format(v)) : esc(v);
    case 'pct': return typeof v === 'number' ? nfp.format(v) : esc(v);
    case 'date': return typeof v === 'number' ? fmtDate(serialToISO(v)) : esc(v);
    case 'dateInput': return typeof v === 'number' ? serialToISO(v) : String(v ?? '');
    case 'ts': return fmtTs(v);
    default: return esc(v);
  }
}

export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
}
export function fmtTs(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return esc(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function statusClass(s) {
  const u = String(s || '').toUpperCase();
  if (!u) return 's-none';
  if (u.startsWith('PASS WITH') || u.startsWith('REVIEW') || u.includes('WARNING') || u === 'PARTIAL' || u.startsWith('PARTIAL') || u === 'NEW MATERIAL' || u === 'MASTER DATA MISSING' || u === 'FALLBACK EQUAL') return 's-review';
  if (u === 'PASS' || u === 'READY' || u === 'IMPORTED' || u === 'COMPLETE' || u === 'CURRENT' || u === 'OK' || u === 'ALLOCATED') return 's-pass';
  if (u.startsWith('BLOCK') || u.startsWith('CHECK') || u.startsWith('ERROR') || u.includes('MISMATCH') || u.startsWith('NO ELIGIBLE') || u.startsWith('NO TOTAL') || u === 'NOT READY') return 's-block';
  if (u.startsWith('RERUN') || u === 'NOT RUN' || u === 'NOT IMPORTED' || u === 'NOT VALIDATED' || u.startsWith('OUTDATED')) return 's-rerun';
  if (u === 'INFO' || u === 'MEMO' || u === 'NO DATA' || u === 'ZERO COST' || u.startsWith('OPENING B/F')) return 's-info';
  return 's-none';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
