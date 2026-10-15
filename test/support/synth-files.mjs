// Writes the synthetic ERP reports (test/support/synth-data.mjs) as .xlsx files, the way ERP exports are named.
import fs from 'node:fs';
import path from 'node:path';
import XLSX from '../../lib/xlsx.mjs';
import { synthErp } from './synth-data.mjs';

export function writeSynthErp(dir, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const { reports } = synthErp(opts);
  const files = [];
  for (const r0 of reports) {
    const r = opts.patch ? opts.patch(r0) : r0;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([r.header, ...r.rows]), 'Sheet1');
    const f = path.join(dir, `${r.name}-202608${r.rows.length ? '' : '-NO DATA'}.xlsx`);
    fs.writeFileSync(f, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    files.push(f);
  }
  return files;
}

/**
 * The hand-kept inputs of a period, as the user would fill the app's own templates:
 *   WIP_OPENING (STEP 3A), sales revenue (STEP 4.1) and FG opening by lot (STEP 5.1, template v2).
 * Customers use two spellings of one name ("Tectronic" / "TECTRONIC") so the dashboard grouping is exercised.
 */
export async function writeSynthInputs(dir) {
  const T = await import('../../src/engine/templates.js');
  const F5 = await import('../../src/engine/step5.js');
  const { P, ser } = await import('./synth-data.mjs');
  const { MAT, price } = synthErp();
  fs.mkdirSync(dir, { recursive: true });
  const write = (file, sheets) => {
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.aoa), sh.name);
    const f = path.join(dir, file); fs.writeFileSync(f, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); return f;
  };
  // WIP opening: 40 units of each material at its price (material 4 of T starts at zero)
  const wip = T.wipOpeningTemplate(P);
  const mats = [...MAT.T, ...MAT.O];
  wip[0].aoa.push(...mats.map((m, i) => [m, `Material ${m}`, 'PCS', i === 3 ? 0 : 40, i === 3 ? 0 : 40 * price[m], 'synthetic', '']));
  const wipFile = write(`WIP_OPENING_${P}.xlsx`, [wip[0]]);
  // sales (TK 511) – the returns book is left to STEP 5R tests
  const FX = 26000;
  const HS = ['Invoice Date', 'Month', 'Customer', 'Product Number', 'Product Name', 'Exchange Rate', 'Quantity', 'Unit Price (USD)', 'Amount (USD)', 'Amount (VND)', 'Remark', 'SI Invoice No.', 'Invoice Line No.', 'Transaction Type', 'Bill Date', 'Original Invoice No.'];
  const sale = (day, cust, prod, qty, usd, inv) => [ser(day), 8, cust, prod, 'x', FX, qty, usd, qty * usd, qty * usd * FX, null, inv, 1, 'NORMAL SALE', null, null];
  const salesFile = write(`SALES_${P}.xlsx`, [{ name: 'SALES', aoa: [HS, sale(5, 'Tectronic', 'SPX-100', 30, 260, 'INV-1'), sale(12, 'TECTRONIC', 'SPX-200', 20, 300, 'INV-2'),
    sale(14, 'Omega Bags', 'OLX-300', 25, 40, 'INV-3'), sale(20, 'Omega Bags', 'OLX-400', 15, 22, 'INV-4'), sale(18, 'Tectronic', 'SPX-100', 25, 262, 'INV-5')] }]);
  // FG opening by lot (template v2): two lots carried from July
  const lot = (pc, prod, name, qty, tot) => [pc, '2026-07-20', 'MO-2607', prod, name, 'FG', 'PCS', qty, '', '', tot * 0.6, tot * 0.25, tot * 0.15, tot, Math.round(tot / qty * 100) / 100, '', '', 0, tot, '', 'synthetic', ''];
  const fgFile = write(`FG_OPENING_${P}.xlsx`, [{ name: 'FG_OPENING', aoa: [[F5.TPL_MARKER, 'v2', 'synthetic'], ['Opening Period', '', P, 'Source Closing', '2026-07', 'Prepared By', 'e2e', 'Prepared At'], ['synthetic FG opening'], F5.TPL_HEADERS,
    lot('PC-2607-0', 'SPX-100', 'Synthetic seat A', 10, 9000000), lot('PC-2607-1', 'OLX-300', 'Synthetic bag C', 8, 300000)] }]);
  return { wipFile, salesFile, fgFile, gl: { fx: FX, gl622: 90000000, gl627: 60000000 } };
}
