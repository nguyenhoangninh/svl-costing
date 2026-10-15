// v1.14.69 export layout contract: 04_COST_ALLOCATION, 05_FG_OPENING, 05_FG_CLOSING follow the approved templates
// ("template Cost allocation", "template 05_FG_OPENING", "template 05_FG_CLOSING"): same columns, same order, same headers,
// row 1 totals / title, row 2 headers, data from row 3. Built with the vendored ExcelJS, written and read back.
import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { costAllocationSheet, fgLayerSheet, CA_COLS, fgLayerCols } = await import(path.join(root, 'src/engine/exportform.js'));
const { buildStyledWorkbook } = await import(path.join(root, 'src/ui/xlsxstyle.js'));

const ctx = { console, setTimeout, clearTimeout, setImmediate, clearImmediate, queueMicrotask, TextEncoder, TextDecoder, URL, Promise, Buffer };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'lib/exceljs.min.js'), 'utf8'), ctx);
const ExcelJS = ctx.ExcelJS;

let total = 0, fail = 0;
const ok = (label, cond, info = '') => { total++; if (cond) console.log('✓', label); else { fail++; console.error('✗', label, info); } };

// ---- golden headers: the template row 2 (column AI of the cost allocation template is an empty spacer)
const CA_TEMPLATE_HEADERS = ['ERP', 'PC No.', 'PC Date', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Source Location', 'Unit', 'Complete Qty', 'PC RM Cost', 'Stock Out Allocated', 'Base Total RM (Pre WIP Adj)', 'Direct 622', 'Direct 627', 'Common 622', 'Common 627', 'Total 622', 'Total 627', 'Base Total Production Cost (Pre WIP Adj)', 'FX', 'Unit Sales Price(USD)', 'Sales Value (VND)', 'Unit RM ( USD)', 'Unit Cost', 'RM %', '622 %', '627 %', 'GP %', 'allocation based after RM(sales-RM)', 'Price Source', 'Contribution Before Conversion', 'Eligible Base', 'Allocation Weight', '', 'Status / Review', 'Direct WIP Adj Amount', 'Total RM', 'Total Production Cost', 'Final Unit Cost', 'WIP Adj Status', 'OH Driver Basis', 'Rework Carry-In FG FIFO', 'Rework Carry-In Status'];
const FG_OPENING_HEADERS = ['Period', 'Source Period', 'Layer ID', 'Source', 'PC No.', 'Layer Date', 'MO No.', 'Product Code', 'Product Name', 'Location', 'Unit', 'Qty', 'RM cost', 'RM cost (Stock out)', 'RM Amount', '622 Amount', '627 Amount', 'Total Amount', 'Total / Unit', 'Sales Price (USD)', 'Provision USD (memo)', 'Provision VND (memo)', 'net inventory', 'Consignment 157 (memo)', 'Status', 'Message', 'UNIT COST RM ( vnd)'];
const FG_CLOSING_HEADERS = FG_OPENING_HEADERS.map((h) => (h === 'Provision USD (memo)' ? 'provision in 2512-usd' : h));

// numbers reach the writer as { v, z } (value + number format); this reads the plain value back
const val = (x) => (x && typeof x === 'object' && 'v' in x ? x.v : x);
const serial = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 + 25569; };
const caRow = (over = {}) => ({ erp: 'O', pc: 'PC-2609-001', date: serial('2026-09-07'), mo: 'MO-1', sub: 'MO-1-001', prod: 'OLI-1', name: 'Item', loc: 'MKX913V', unit: 'PC', qty: 100, pcRM: 8000000, so: 2000, baseRM: 8002000, baseCost: 12000000, fx: 26000, price: 10, salesVND: 26000000, contrib: 18000000 - 2000, eligible: 17998000, weight: 0.5, unitCost: 120000, rmPct: 0.66, p622: 0.2, p627: 0.14, gpPct: 0.1, priceSrc: 'PRICE MASTER', statusText: 'ELIGIBLE', wipAdj: 0, totalRM: 8002000, totalCost: 12000000, finalUnit: 120000, ohBasis: 'BASE RM (LOCKED)', carryIn: 0, carryStatus: '', wipAdjStatus: '', ...over });
const fgRow = (over = {}) => ({ period: '2026-09', srcPeriod: '2026-08', lid: 'OP-PC-2608-173-T5', source: 'OPENING', pc: 'PC-2608-173', date: serial('2026-08-26'), mo: 'MO-2605-018', prod: 'OLI-1719A-VN', name: 'TP3', loc: 'VEX811V', unit: 'PC', qty: 48, rm: 6786434.658, a622: 2287174.5, a627: 1983214.85, tot: 11056824.06, unitCost: 230350.5, price: 10.1, prov: -500000, cons: '', status: 'REVIEW - COST > PRICE', msg: 'Has provision memo -500000;', ...over });

// ---- 04_COST_ALLOCATION
const ca = costAllocationSheet([caRow(), caRow({ erp: 'T', loc: 'FG', qty: 50, contrib: -100 }), caRow({ erp: 'O', loc: 'MKX912V', date: '2026-09-09' })], '2026-09');
ok('cost allocation: sheet name and layout (row 1 totals, row 2 header, freeze H3)', ca.name === '04_COST_ALLOCATION' && ca.totals === 1 && ca.header === 2 && ca.freezeCols === 7);
ok('cost allocation: 44 template columns in template order (AI spacer blank)', JSON.stringify(ca.aoa[1]) === JSON.stringify(CA_TEMPLATE_HEADERS), JSON.stringify(ca.aoa[1]));
ok('cost allocation: column count matches CA_COLS', CA_COLS.length === 44 && ca.aoa[1].length === 44);
const colIx = (head) => ca.aoa[1].indexOf(head);
ok('row 1: SUM formula over data rows on amount and quantity columns', ca.aoa[0][colIx('Complete Qty')].f === 'SUM(J3:J5)' && ca.aoa[0][colIx('Total Production Cost')].f === 'SUM(AM3:AM5)', JSON.stringify(ca.aoa[0]));
ok('row 1: no meaningless sums on FX, price, unit cost or percent columns', ['FX', 'Unit Sales Price(USD)', 'Unit Cost', 'RM %', 'GP %', 'Price Source'].every((h) => ca.aoa[0][colIx(h)] === ''));
ok('row 1: label on the A column', String(ca.aoa[0][0]).startsWith('TỔNG CỘNG'));
ok('ERP T lines with Location FG show Doona (template note on row 1)', ca.aoa[3][colIx('Source Location')] === 'Doona' && ca.aoa[2][colIx('Source Location')] === 'MKX913V');
ok('date from an ERP serial becomes the ISO date', ca.aoa[2][colIx('PC Date')] === '2026-09-07', ca.aoa[2][colIx('PC Date')]);
const r0 = ca.aoa[2];
ok('Unit RM (USD) = Base Total RM / Qty / FX', Math.abs(val(r0[colIx('Unit RM ( USD)')]) - 8002000 / 100 / 26000) < 1e-9);
ok('allocation after RM (USD) = max(0, contribution) / FX', Math.abs(val(r0[colIx('allocation based after RM(sales-RM)')]) - 17998000 / 26000) < 1e-9);
ok('negative contribution gives 0 allocation base', val(ca.aoa[3][colIx('allocation based after RM(sales-RM)')]) === 0);
ok('zero FX gives blank derived values', (() => { const s = costAllocationSheet([caRow({ fx: 0 })], '2026-09'); return s.aoa[2][colIx('Unit RM ( USD)')] === '' && s.aoa[2][colIx('allocation based after RM(sales-RM)')] === ''; })());
ok('row 1 totals keep the cached result', ca.aoa[0][colIx('Total Production Cost')].r === 36000000);
ok('row 1 totals cache the sum of the rows for the Qty column', ca.aoa[0][colIx('Complete Qty')].r === 100 + 50 + 100);

// ---- 05_FG_OPENING / 05_FG_CLOSING
const op = fgLayerSheet([fgRow(), fgRow({ qty: 0, rm: 0, tot: 0, prov: 0 })], 'opening', '2026-09');
const cl = fgLayerSheet([fgRow({ source: 'PRODUCTION', lid: 'PR-202609-PC-2609-012-223' })], 'closing', '2026-09');
ok('FG opening: name, row 1 title, row 2 header, freeze after Layer ID', op.name === '05_FG_OPENING' && String(op.aoa[0][0]).includes('05_FG_OPENING') && op.header === 2 && op.freezeCols === 3);
ok('FG opening: 27 template columns in template order', JSON.stringify(op.aoa[1]) === JSON.stringify(FG_OPENING_HEADERS), JSON.stringify(op.aoa[1]));
ok('FG closing: header U is "provision in 2512-usd" as in the template', JSON.stringify(cl.aoa[1]) === JSON.stringify(FG_CLOSING_HEADERS));
ok('FG columns count matches fgLayerCols', fgLayerCols('opening').length === 27 && fgLayerCols('closing').length === 27);
const o3 = op.aoa[2];
const hi = (sheet, head) => sheet.aoa[1].indexOf(head);
ok('net inventory is the formula Total Amount + Provision VND', o3[hi(op, 'net inventory')].f === 'R3+V3' && Math.abs(o3[hi(op, 'net inventory')].r - (11056824.06 - 500000)) < 1e-6, JSON.stringify(o3[hi(op, 'net inventory')]));
ok('UNIT COST RM (vnd) is the formula IFERROR(RM Amount / Qty, 0)', o3[hi(op, 'UNIT COST RM ( vnd)')].f === 'IFERROR(O3/L3,0)' && Math.abs(o3[hi(op, 'UNIT COST RM ( vnd)')].r - 6786434.658 / 48) < 1e-6);
ok('zero quantity layer: unit RM formula still safe (cached 0)', op.aoa[3][hi(op, 'UNIT COST RM ( vnd)')].r === 0 && op.aoa[3][hi(op, 'UNIT COST RM ( vnd)')].f === 'IFERROR(O4/L4,0)');
ok('template blank columns (RM cost, RM cost stock out, provision USD) stay blank', o3[12] === '' && o3[13] === '' && o3[20] === '');
ok('FG closing rows keep the layer date and status', cl.aoa[2][hi(cl, 'Layer Date')] === '2026-08-26' && cl.aoa[2][hi(cl, 'Status')] === 'REVIEW - COST > PRICE');

// ---- workbook: build, write, read back
const wb = buildStyledWorkbook(ExcelJS, [ca, op, cl], { title: 'export form check', company: 'SVL' });
const buf = Buffer.from(await wb.xlsx.writeBuffer());
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exportform-'));
fs.writeFileSync(path.join(dir, 'check.xlsx'), buf); // a real .xlsx on disk, as the user gets it
const back = new ExcelJS.Workbook();
// the browser build of ExcelJS reads an ArrayBuffer of its own realm (vm context), not a Node Buffer
const ab = new (vm.runInContext('ArrayBuffer', ctx))(buf.byteLength);
new (vm.runInContext('Uint8Array', ctx))(ab).set(buf);
await back.xlsx.load(ab);
fs.rmSync(dir, { recursive: true, force: true });
const wsCA = back.getWorksheet('04_COST_ALLOCATION');
const wsOP = back.getWorksheet('05_FG_OPENING');
const addr = (a) => (typeof a === 'string' ? a : `${colAt(a.column)}${a.row}`);
const colAt = (n) => { let s = ''; for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s; };
const af = wsCA.autoFilter;
const afRef = typeof af === 'string' ? af : af && af.from ? `${addr(af.from)}:${addr(af.to)}` : '';
ok('workbook: three sheets with the export names', !!wsCA && !!wsOP && !!back.getWorksheet('05_FG_CLOSING'));
ok('workbook: cost allocation row 1 formula and bold tinted totals', wsCA.getCell('J1').value.formula === 'SUM(J3:J5)' && wsCA.getCell('J1').font.bold === true && wsCA.getCell('J1').fill.fgColor.argb === 'FFEDF2F0');
ok('workbook: header row 2 styled (white on green) and frozen panes at H3', wsCA.getCell('A2').fill.fgColor.argb === 'FF2F6B5A' && wsCA.views[0].state === 'frozen' && wsCA.views[0].xSplit === 7 && wsCA.views[0].ySplit === 2);
ok('workbook: autofilter covers header and data', afRef === 'A2:AR5', afRef || JSON.stringify(af));
ok('workbook: data row 3 Doona/dates/number formats', wsCA.getCell('H4').value === 'Doona' && wsCA.getCell('C3').numFmt === 'dd/mm/yyyy' && /#,##0/.test(wsCA.getCell('K3').numFmt) && wsCA.getCell('Z3').numFmt === '0.00%' && wsCA.getCell('AH3').numFmt === '0.0000%');
ok('workbook: zebra band on the second body row', !!wsCA.getCell('A4').fill && wsCA.getCell('A4').fill.fgColor.argb === 'FFF7FAF8');
ok('workbook: FG net inventory formula is written as a formula', wsOP.getCell('W3').value.formula === 'R3+V3' && wsOP.getCell('AA3').value.formula === 'IFERROR(O3/L3,0)');
ok('workbook: FG title row bold brand', wsOP.getCell('A1').font.bold === true && wsOP.getCell('A1').font.color.argb === 'FF1E5C4A');
ok('workbook: FG opening frozen after Layer ID (xSplit 3)', wsOP.views[0].xSplit === 3 && wsOP.views[0].ySplit === 2);

console.log(`\n${total - fail}/${total} export-form checks passed`);
process.exit(fail ? 1 : 0);
