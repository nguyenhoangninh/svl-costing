// Revenue books (owner decision 06/10/2026): sales revenue (TK 511) and revenue deductions are kept apart —
// own import file, own database, own screen, own STEP 5R run and own FAST tie.
//   SALES RETURN → TK 5212 Hàng bán bị trả lại (physical returns go through STEP 5R COGS reversal)
//   CREDIT NOTE  → TK 5213 Giảm giá hàng bán (no goods movement)
import { utxt, num } from './util.js';

export const RETURN_TYPES = ['SALES RETURN', 'CREDIT NOTE'];
const RT = new Set(RETURN_TYPES);

/** Transaction type of a staging / DB row, inferring a blank type the same way validateSaveSales does. */
export function rowType(r) {
  const tt = utxt(r && r.tranType);
  if (tt) return tt;
  if (num(r && r.qty) < 0 && String((r && r.origInv) ?? '').trim()) return 'SALES RETURN';
  return '';
}
export const isReturnRow = (r) => RT.has(rowType(r));
/** FAST account a row belongs to. */
export const bookOf = (r) => { const t = rowType(r); return t === 'SALES RETURN' ? '5212' : t === 'CREDIT NOTE' ? '5213' : '511'; };
export const isPhysicalReturnRow = (r) => rowType(r) === 'SALES RETURN' && num(r && r.qty) < 0;

/**
 * Sales book and returns book of a period's data.
 * Before v1.11 return / credit lines lived inside the Sales Database ("legacy"); while no Returns Database exists they are
 * still read from there, so nothing disappears. Once a Returns Database exists, return lines left in the Sales Database are ignored.
 */
export function splitBooks(salesDB, returnsDB) {
  const all = (salesDB && salesDB.rows) || [];
  const sales = [], legacy = [];
  for (const r of all) (isReturnRow(r) ? legacy : sales).push(r);
  const returns = returnsDB ? (returnsDB.rows || []) : legacy;
  return { sales, returns, legacyCount: legacy.length, usingLegacy: !returnsDB && legacy.length > 0, ignoredLegacy: returnsDB ? legacy.length : 0 };
}
