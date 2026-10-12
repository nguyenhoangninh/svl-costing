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

console.log(`\n${n - bad}/${n} styled export checks passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
