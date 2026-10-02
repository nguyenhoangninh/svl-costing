// SVL Costing Web — shared helpers (port of VBA SafeCellText / SafeCellNumber / HeaderCol / LastDataRow)
// Pure functions: run in browser and in Node.

export const ERPS = ['T', 'S', 'O'];
export const REPORTS = ['PC-P', 'PC-M', 'MI-P', 'MI-M', 'STOCK OUT', 'MR-P', 'MR-M'];

export const dsKey = (erp, report) => `${report}-${erp}`; // same as VBA DataSheetName

/** VBA CStr(Value2) semantics for a cell value. */
export function txt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (!isFinite(v)) return '';
    if (Number.isInteger(v)) return String(v);
    // VBA CStr uses 15 significant digits
    return String(parseFloat(v.toPrecision(15)));
  }
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

export const ttxt = (v) => txt(v).trim();
export const utxt = (v) => txt(v).trim().toUpperCase();

/** VBA IsNumeric (pragmatic subset). */
export function isNumeric(v) {
  if (v === null || v === undefined || v === '') return true; // IsNumeric(Empty) = True
  if (typeof v === 'number') return isFinite(v);
  if (typeof v === 'boolean') return true;
  const s = String(v).trim().replace(/,/g, '');
  if (s === '') return false;
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) || /^\(\d+\.?\d*\)$/.test(s);
}

/** VBA SafeCellNumber: CDbl if numeric else 0. */
export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? -1 : 0;
  const s = String(v).trim().replace(/,/g, '');
  if (/^\((\d+\.?\d*)\)$/.test(s)) return -parseFloat(s.slice(1, -1));
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return 0;
  return parseFloat(s);
}

/** VBA HKey: header normalisation used for every header lookup. */
export function hkey(s) {
  let t = txt(s).trim().toUpperCase();
  t = t.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\./g, '');
  t = t.replace(/ {2,}/g, ' ');
  return t;
}

/** 0-based column index of header (or -1). */
export function headerCol(header, wanted) {
  const b = hkey(wanted);
  for (let c = 0; c < header.length; c++) if (hkey(header[c]) === b) return c;
  return -1;
}

export function headerColAny(header, names) {
  for (const n of names) {
    const c = headerCol(header, n);
    if (c >= 0) return c;
  }
  return -1;
}

/**
 * VBA LastDataRow: walk up from the last row, skipping rows whose key cell is blank
 * or contains NOTICE / TOTAL. Returns exclusive end index into rows.
 */
export function lastDataEnd(rows, keyCol) {
  let r = rows.length - 1;
  while (r >= 0) {
    const s = ttxt(rows[r] ? rows[r][keyCol] : null);
    const u = s.toUpperCase();
    if (s.length > 0 && !u.includes('NOTICE') && !u.includes('TOTAL')) break;
    r--;
  }
  return r + 1;
}

// ---------- periods ----------
export function isPeriod(p) {
  return typeof p === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.trim());
}
export function periodToken(p) {
  return isPeriod(p) ? p.slice(2, 4) + p.slice(5, 7) : '';
}
export function tokenPeriod(t) {
  return /^\d{4}$/.test(t) ? `20${t.slice(0, 2)}-${t.slice(2)}` : '';
}
export function nextPeriod(p) {
  if (!isPeriod(p)) return '';
  let y = +p.slice(0, 4), m = +p.slice(5, 7) + 1;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
export function prevPeriod(p) {
  if (!isPeriod(p)) return '';
  let y = +p.slice(0, 4), m = +p.slice(5, 7) - 1;
  if (m < 1) { m = 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// ---------- Excel serial dates ----------
const EPOCH = Date.UTC(1899, 11, 30);
const strictSerial = (y, m, d) => {
  y = +y; m = +m; d = +d;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  const x = new Date(ms);
  if (x.getUTCFullYear() !== y || x.getUTCMonth() + 1 !== m || x.getUTCDate() !== d) return null; // reject 31/04, non-leap 29/02, etc.
  return (ms - EPOCH) / 86400000;
};
export function serialToYMD(serial) {
  const d = new Date(EPOCH + Math.floor(serial) * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
export function serialToISO(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return '';
  const { y, m, d } = serialToYMD(serial);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** Strict date parser shared by ERP, Sales and FIFO. Blank/invalid → null; impossible calendar dates are rejected. */
export function cellDateSerial(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) && v >= 1 && v <= 2958465 ? Math.floor(v) : null;
  if (v instanceof Date) {
    if (!isFinite(v.getTime())) return null;
    return strictSerial(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  const s = String(v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/.exec(s);
  if (m) return strictSerial(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\D|$)/.exec(s);
  if (m) return strictSerial(+m[3], +m[2], +m[1]); // dd/mm/yyyy (VN locale)
  return null;
}
export function isoToSerial(iso) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/.exec(iso || '');
  return m ? strictSerial(+m[1], +m[2], +m[3]) : null;
}
/** yyyy-mm of a valid date cell. '' for blank or invalid dates. */
export function cellYM(v) {
  const s = cellDateSerial(v);
  if (s === null) return '';
  const { y, m } = serialToYMD(s);
  return `${y}-${String(m).padStart(2, '0')}`;
}
export const dateInPeriod = (v, p) => cellYM(v) === p;

export const nowISO = () => new Date().toISOString();

export function round(x, d = 2) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

/**
 * Number typed by a user (F-16). Accepts 1234.5 · 1234,5 · 1,234,567.89 · 1.234.567,89 · 15.506.701.812 · (123) · -1.5.
 * A single separator followed by exactly 3 digits ("26.300", "1,500") is ambiguous and rejected instead of guessed.
 * Returns {ok:true, value} (value null for blank) or {ok:false, error}.
 */
export function parseUserNumber(v) {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v === 'number') return isFinite(v) ? { ok: true, value: v } : { ok: false, error: 'Số không hợp lệ' };
  let s = String(v).trim().replace(/[\s ]/g, '');
  if (s === '') return { ok: true, value: null };
  const bad = { ok: false, error: `'${v}' không phải số hợp lệ` };
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s[0] === '-') { neg = !neg; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return bad;
  const nd = (s.match(/\./g) || []).length, nc = (s.match(/,/g) || []).length;
  let out;
  if (nd && nc) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',', th = dec === '.' ? ',' : '.';
    const parts = s.split(dec); if (parts.length !== 2 || !parts[1]) return bad;
    const ip = parts[0].split(th);
    if (!/^\d{1,3}$/.test(ip[0]) || ip.slice(1).some((x) => !/^\d{3}$/.test(x)) || /\D/.test(parts[1])) return bad;
    out = ip.join('') + '.' + parts[1];
  } else if (!nd && !nc) out = s;
  else {
    const sep = nd ? '.' : ',', n = nd || nc, parts = s.split(sep);
    if (n > 1) {
      if (!/^\d{1,3}$/.test(parts[0]) || parts.slice(1).some((x) => !/^\d{3}$/.test(x))) return bad;
      out = parts.join('');
    } else {
      if (!parts[0] || !parts[1]) return bad;
      if (parts[1].length === 3 && parts[0] !== '0') { const dd = parts[1].replace(/0+$/, ''); return { ok: false, error: `'${v}' không rõ là ${parts[0]}${parts[1]} hay ${parts[0]}${dd ? ',' + dd : ''} – nhập ${parts[0]}${parts[1]} (không dấu phân cách) hoặc ${parts[0]}${dd ? ',' + dd : ''}` }; }
      out = parts[0] + '.' + parts[1];
    }
  }
  const x = parseFloat(out);
  return isFinite(x) ? { ok: true, value: neg ? -x : x } : bad;
}

/** Fast deterministic fingerprint (FNV-1a 32-bit ×2) of a string – used for freshness checks, not security. */
export function fp(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x5bd1e995); h2 ^= h2 >>> 15; }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + ':' + s.length;
}
/** Fingerprint of a set of rows independent of their order. */
export const fpRows = (rows, line) => fp((rows || []).map(line).sort().join('\n'));
