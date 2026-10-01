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
export function serialToYMD(serial) {
  const d = new Date(EPOCH + Math.floor(serial) * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
export function serialToISO(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return '';
  const { y, m, d } = serialToYMD(serial);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function isoToSerial(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - EPOCH) / 86400000;
}
/** yyyy-mm of a cell holding a date (serial, ISO string, dd/mm/yyyy string, Date). '' if not a date. */
export function cellYM(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (v < 1 || v > 2958465) return '';
    const { y, m } = serialToYMD(v);
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`;
  const s = String(v).trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}`; // dd/mm/yyyy (VN locale)
  return '';
}
export const dateInPeriod = (v, p) => cellYM(v) === p;

export const nowISO = () => new Date().toISOString();

export function round(x, d = 2) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
