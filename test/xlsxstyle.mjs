// Styled STEP 2 export contract: the report is built with the vendored ExcelJS (lib/exceljs.min.js) loaded the way the browser loads it.
// Checks structure, styling, freeze panes, filters, print setup and that the written file is a valid workbook (read back by SheetJS).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { step2ReportSheets } = await import(path.join(root, 'src/engine/step2report.js'));
const { buildStyledWorkbook } = await import(path.join(root, 'src/ui/xlsxstyle.js'));

const ctx = { console, setTimeout, clearTimeout, setImmediate, clearImmediate, queueMicrotask, TextEncoder, TextDecoder, URL, Promise };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'lib/exceljs.min.js'), 'utf8'), ctx);
const ExcelJS = ctx.ExcelJS;

let n = 0, bad = 0;
const ok = (label, cond, info = '') => { n++; if (cond) console.log('✓', label); else { bad++; console.error('✗', label, info); } };

// Minimal STEP 2 result: 2 T lots (DOONA), 1 O lot (JOB CODE VEX801V → R4c fallback), detail columns as in step2report.js
const detail = [
  ['T', 'DOONA', 'CUSTOMER', 1, 1000, 'T', 'T', 'SP', 'PC-1', 'MO1', 'SP-A', 'Name A', 'FG', 800, 0.5, 500, 'ALLOCATED', 'DOONA -> T SP*.'],
  ['T', 'DOONA', 'CUSTOMER', 1, 1000, 'T', 'T', 'SP', 'PC-2', 'MO2', 'SP-B', 'Name B', 'FG', 400, 0.5, 500, 'ALLOCATED', 'DOONA -> T SP*.'],
  ['O', 'VEX801V', 'JOB CODE', 1, 300, 'O', 'O', 'ALL', 'PC-3', 'MO3', 'OP-1', 'Name O', 'VE1', 200, 1, 300, 'FALLBACK RM COST', 'O other -> all O theo PC RM Cost.'],
];
const s2 = {
  runAt: '2026-10-12T09:19:00.000Z',
  detail,
  summary: [
    { erp: 'T', src: 1000, alloc: 1000, unalloc: 0, diff: 0, status: 'PASS' },
    { erp: 'S', src: 0, alloc: 0, unalloc: 0, diff: 0, status: 'PASS' },
    { erp: 'O', src: 300, alloc: 300, unalloc: 0, diff: 0, status: 'PASS' },
  ],
  total: { src: 1300, alloc: 1300, unalloc: 0, diff: 0, status: 'PASS' },
  pc: [
    { erp: 'T', pcNo: 'PC-1', date: 0, mo: 'MO1', sub: '', prod: 'SP-A', name: 'Name A', loc: 'FG', qty: 10, cost: 800, allocT: 500, allocS: 0, allocO: 0, alloc: 500 },
    { erp: 'T', pcNo: 'PC-2', date: 0, mo: 'MO2', sub: '', prod: 'SP-B', name: 'Name B', loc: 'FG', qty: 5, cost: 400, allocT: 500, allocS: 0, allocO: 0, alloc: 500 },
    { erp: 'O', pcNo: 'PC-3', date: 0, mo: 'MO3', sub: '', prod: 'OP-1', name: 'Name O', loc: 'VE1', qty: 4, cost: 200, allocT: 0, allocS: 0, allocO: 300, alloc: 300 },
  ],
};

const { sheets } = step2ReportSheets(s2, null, '2026-10', 'web 1.14.12 · test');
const names = ['Tổng hợp', 'Logic phân bổ', 'Theo nhóm nguồn', 'Theo lô PC', 'Chi tiết phân bổ'];
ok('five sheets in the expected order', JSON.stringify(sheets.map((s) => s.name)) === JSON.stringify(names), JSON.stringify(sheets.map((s) => s.name)));
ok('every sheet has a title, subtitle and column widths', sheets.every((s) => s.title && s.subtitle && s.cols.length > 0));
ok('subtitle carries company, run time and version, without the long feature list', sheets[0].subtitle.includes('Starry Vietnam') && sheets[0].subtitle.includes('web 1.14.12') && !sheets[0].subtitle.includes('Rework'));

let tablesOk = true;
for (const s of sheets) for (const b of s.blocks) if (b.kind === 'table') {
  if (b.head.length > s.cols.length) tablesOk = false;
  if (!b.rows.every((r) => r.length === b.head.length)) tablesOk = false;
  if (b.total && b.total.length !== b.head.length) tablesOk = false;
  for (const f of b.foot || []) if (f.length !== b.head.length) tablesOk = false;
}
ok('every table row has as many cells as its header', tablesOk);
ok('data sheets freeze the header row and filter the table', ['Theo nhóm nguồn', 'Theo lô PC', 'Chi tiết phân bổ'].every((nm) => {
  const s = sheets.find((x) => x.name === nm); return s.freeze === 4 && s.blocks[0].kind === 'table' && s.blocks[0].filter === true;
}));

// Build, write and read back with ExcelJS (styling) and SheetJS (independent validity check)
const wb = buildStyledWorkbook(ExcelJS, sheets, { title: 'test', company: 'SVL' });
const buf = Buffer.from(await wb.xlsx.writeBuffer());
ok('workbook serialises to a non-empty xlsx', buf.length > 5000 && buf[0] === 0x50 && buf[1] === 0x4b, `bytes=${buf.length}`);

const sj = XLSX.read(buf, { type: 'buffer' });
ok('SheetJS reads all five sheets back', JSON.stringify(sj.SheetNames) === JSON.stringify(names), JSON.stringify(sj.SheetNames));

const back = new ExcelJS.Workbook();
// ExcelJS runs in the vm realm, so hand it a Uint8Array/ArrayBuffer from that realm
const VmU8 = vm.runInContext('Uint8Array', ctx); const vmBytes = new VmU8(buf.length); vmBytes.set(buf);
await back.xlsx.load(vmBytes.buffer);
const wsSum = back.getWorksheet('Tổng hợp');
const title = wsSum.getCell('A1');
ok('title band: brand fill and bold white text', title.fill?.fgColor?.argb === 'FF1E5C4A' && title.font?.bold === true && title.font?.color?.argb === 'FFFFFFFF', JSON.stringify(title.font));
ok('title is the period heading', String(title.value).includes('2026-10'), String(title.value));

let totalRow = null, headRow = null;
wsSum.eachRow((row, idx) => { if (!totalRow && row.getCell(1).value === 'Tổng') totalRow = idx; if (!headRow && row.getCell(1).value === 'Hệ nguồn') headRow = idx; });
ok('summary table header is filled with the table colour', headRow && wsSum.getCell(headRow, 2).fill?.fgColor?.argb === 'FF2F6B5A');
ok('summary money total is numeric with the accounting format', totalRow && wsSum.getCell(totalRow, 2).value === 1300 && String(wsSum.getCell(totalRow, 2).numFmt).includes('#,##0'), `${wsSum.getCell(totalRow, 2).value} ${wsSum.getCell(totalRow, 2).numFmt}`);
let statusCell = null;
wsSum.eachRow((row) => row.eachCell((c) => { if (c.value === 'PASS' && !statusCell) statusCell = c; }));
ok('PASS status cell carries the green tone fill', statusCell?.fill?.fgColor?.argb === 'FFE2F3E8' && statusCell?.font?.color?.argb === 'FF18703F', JSON.stringify(statusCell?.fill));
let fbCell = null;
back.getWorksheet('Chi tiết phân bổ').eachRow((row) => row.eachCell((c) => { if (c.value === 'FALLBACK RM COST' && !fbCell) fbCell = c; }));
ok('fallback allocation status is amber, not red', fbCell?.fill?.fgColor?.argb === 'FFFFF1CF', JSON.stringify(fbCell?.fill));

const wsGrp = back.getWorksheet('Theo nhóm nguồn');
ok('group sheet freezes row 4 and filters its header', wsGrp.views?.[0]?.state === 'frozen' && wsGrp.views[0].ySplit === 4 && !!wsGrp.autoFilter);
ok('sheets hide gridlines and print landscape on A4 fit to width', wsSum.views?.[0]?.showGridLines === false && wsSum.pageSetup?.orientation === 'landscape' && wsSum.pageSetup?.fitToWidth === 1);
ok('footer shows the app and page numbers', String(wsSum.headerFooter?.oddFooter || '').includes('SVL Costing Web') && String(wsSum.headerFooter?.oddFooter || '').includes('&P'));

// Excel does not allow sheet names over 31 characters
ok('all sheet names fit Excel limits', back.worksheets.every((w) => w.name.length <= 31));

// ---- array sheets (table exports, full-period export, import templates) ----
const { buildStyledWorkbook: build2 } = await import(path.join(root, 'src/ui/xlsxstyle.js'));
const aoaSheets = [
  { name: 'LO_TEST', title: 'LO TEST · kỳ 2026-10', subtitle: 'SVL – test', cols: [12, 16, 14], aoa: [
    ['Mã', 'Số tiền', 'Trạng thái', 'Ngày'],
    ['A1', 1234.5, 'PASS', 46000],
    ['A2', -0.0000001, 'CHECK', ''],
    ['A3', 2000, 'FALLBACK RM COST', '2026-10-12T09:19:00.000Z'],
  ] },
  { name: 'TEMPLATE', keep: true, header: 4, aoa: [
    ['SVL_FG_OPENING_TEMPLATE', 'v1', 'Mẫu nhập liệu'],
    ['Opening Period', '', '2026-10'],
    ['Ghi chú dài dòng ' + 'x'.repeat(80)],
    ['PC No.', 'Layer Date', 'Qty', 'Total Amount'],
    ['PC-1', '2026-09-30', 5, 100],
    ['PC-2', '', 7, 200],
  ] },
  { name: 'META', aoa: [
    ['STOCK OUT ALLOCATION TO PC-P'],
    ['Reporting Period', '2026-10', '', 'Run Time', '2026-10-12T09:19:00.000Z'],
    [],
    ['Source ERP', 'Source Stock Out', 'Allocated', 'Status', '', ''],
    ['T', 1000, 1000, 'PASS'],
  ] },
];
const wbA = build2(ExcelJS, aoaSheets, { title: 'aoa' });
const bufA = Buffer.from(await wbA.xlsx.writeBuffer());
const backA = XLSX.read(bufA, { type: 'buffer' });
const rowsOf = (nm) => XLSX.utils.sheet_to_json(backA.Sheets[nm], { header: 1, defval: null, raw: true });

// import templates: every value stays at its original position
const tplRead = rowsOf('TEMPLATE');
const tplSrc = aoaSheets[1].aoa;
ok('template keeps every cell at its position (header on row 4)', tplSrc.every((r, i) => r.every((v, c) => (v === '' ? (tplRead[i]?.[c] ?? null) === null : tplRead[i]?.[c] === v))), JSON.stringify(tplRead.slice(0, 6)));
ok('template dates are not converted (importer reads text)', tplRead[4]?.[1] === '2026-09-30', String(tplRead[4]?.[1]));

// table export: title on top, header on row 4, numbers and dates styled
const lo = rowsOf('LO_TEST');
ok('table export: title row, subtitle, header on row 4', lo[0]?.[0] === 'LO TEST · kỳ 2026-10' && lo[3]?.[0] === 'Mã' && lo[4]?.[0] === 'A1', JSON.stringify(lo.slice(0, 5)));
const loadBack = async (b) => { const w = new ExcelJS.Workbook(); const u = new VmU8(b.length); u.set(b); await w.xlsx.load(u.buffer); return w; };
const loWs = (await loadBack(bufA)).getWorksheet('LO_TEST');
ok('table export: header is filled, body bordered', loWs.getCell(4, 1).fill?.fgColor?.argb === 'FF2F6B5A' && !!loWs.getCell(5, 2).border?.top);
ok('table export: filter covers the table', !!loWs.autoFilter, JSON.stringify(loWs.autoFilter));
ok('table export: freeze below header only for long tables (not applied to 3 rows)', !(loWs.views?.[0]?.state === 'frozen'));
ok('table export: tiny residue shows as dash, not 0.00', String(loWs.getCell(6, 2).numFmt).startsWith('[>=0.005]'), String(loWs.getCell(6, 2).numFmt));
// 09:19 UTC is 16:19 in Vietnam: the clock time stored in the cell must be 16:19 (ExcelJS returns a Date built on UTC)
const tsVal = loWs.getCell(7, 4).value;
const tsHours = tsVal && typeof tsVal.getUTCHours === 'function' ? tsVal.getUTCHours() + tsVal.getUTCMinutes() / 60 : (tsVal % 1) * 24;
ok('table export: ISO timestamp becomes a Vietnam-time date cell (16:19)', /hh:mm/.test(String(loWs.getCell(7, 4).numFmt)) && Math.abs(tsHours - 16.3167) < 0.02, `${tsVal} ${loWs.getCell(7, 4).numFmt}`);
ok('table export: PASS / FALLBACK / CHECK are coloured by content', loWs.getCell(5, 3).fill?.fgColor?.argb === 'FFE2F3E8' && loWs.getCell(6, 3).fill?.fgColor?.argb === 'FFFCE6E4' && loWs.getCell(7, 3).fill?.fgColor?.argb === 'FFFFF1CF');

// full-period export style sheet: meta lines keep position; header fill stops at the last header column
const metaRead = rowsOf('META');
const txtSheet = [{ name: 'TXT', aoa: [['Mức', 'Nhóm', 'Nội dung'], ['L1', 'G1', 'msg one'], ['L2', 'G2', 'msg two']] }];
const txtWs = (await loadBack(Buffer.from(await build2(ExcelJS, txtSheet, {}).xlsx.writeBuffer()))).getWorksheet('TXT');
ok('text-only table: only the first row is a header; data rows keep body styling', txtWs.getCell(1, 1).fill?.fgColor?.argb === 'FF2F6B5A' && txtWs.getCell(2, 1).fill?.fgColor?.argb !== 'FF2F6B5A' && !!txtWs.getCell(3, 1).border?.top);
ok('full export keeps title / meta / table rows where they were', metaRead[0]?.[0] === 'STOCK OUT ALLOCATION TO PC-P' && metaRead[1]?.[0] === 'Reporting Period' && metaRead[3]?.[0] === 'Source ERP' && metaRead[4]?.[0] === 'T', JSON.stringify(metaRead));
const wsMeta = (await loadBack(bufA)).getWorksheet('META');
ok('full export: header fill stops at the last header column (no empty green cells)', wsMeta.getCell(4, 4).fill?.fgColor?.argb === 'FF2F6B5A' && wsMeta.getCell(4, 5).fill?.fgColor?.argb !== 'FF2F6B5A', `${wsMeta.getCell(4, 5).fill?.fgColor?.argb}`);

console.log(`\n${n - bad}/${n} styled export checks passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
