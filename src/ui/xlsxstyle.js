// Styled Excel export (ExcelJS, vendored at lib/exceljs.min.js, loaded on first use).
// SheetJS Community (lib/xlsx.mjs) cannot write fills, fonts or borders, so reports that must look finished use this module.
// Sheet spec: { name, title, subtitle, cols: [width…], freeze: headerRow|0, tab, blocks: [...] }
//   block kinds: { kind:'section', text } · { kind:'para', text } · { kind:'kv', rows:[[label, value, 'strong'?]] }
//                { kind:'table', head, rows, total?, foot?, zebra?, filter? } · { kind:'gap' }
// Cell values: primitives, or { v, z } where z is an Excel number format. Status and difference columns are coloured by content.

const C = {
  ink: 'FF1F2A27', muted: 'FF5F6B66', brand: 'FF1E5C4A', band: 'FFE4EFEA', head: 'FF2F6B5A', line: 'FFCBD6D1',
  total: 'FFEDF2F0', zebra: 'FFF7FAF8', white: 'FFFFFFFF',
  good: ['FF18703F', 'FFE2F3E8'], bad: ['FFB42318', 'FFFCE6E4'], warn: ['FF8A5A00', 'FFFFF1CF'],
};
const FONT = 'Calibri';
const TONE_HEADS = new Set(['Trạng thái', 'Kiểm tra', 'Chênh lệch']);
const TONE_RULES = [[/^(PASS|ALLOCATED)/, 'good'], [/^(BLOCK|CHECK|CHƯA|NO |UNKNOWN|ERROR)/, 'bad'], [/^(FALLBACK|HOLD|REVIEW)/, 'warn']];
const toneOf = (text) => { for (const [re, t] of TONE_RULES) if (re.test(text)) return t; return null; };
const thin = { style: 'thin', color: { argb: C.line } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const norm = (x) => (x && typeof x === 'object' && 'v' in x ? { value: x.v, z: x.z } : { value: x, z: null });
const colLetter = (n) => { let s = ''; for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s; };
const linesOf = (text, width) => String(text ?? '').split('\n').reduce((a, part) => a + Math.max(1, Math.ceil(part.length / Math.max(4, width * 1.25))), 0);

function setValue(cell, raw, tone) {
  const { value, z } = norm(raw);
  if (value === null || value === undefined || value === '') cell.value = null;
  else if (typeof value === 'number') { cell.value = Number.isFinite(value) ? value : null; cell.numFmt = z || (Number.isInteger(value) ? '#,##0' : '#,##0.00'); }
  else cell.value = String(value);
  if (tone) { cell.font = { ...cell.font, color: { argb: C[tone][0] }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C[tone][1] } }; }
  return value;
}

function renderSheet(wb, s) {
  const ncols = s.cols.length;
  const views = [{ showGridLines: false }];
  if (s.freeze) views[0] = { showGridLines: false, state: 'frozen', xSplit: 0, ySplit: s.freeze, topLeftCell: `A${s.freeze + 1}` };
  const ws = wb.addWorksheet(String(s.name).slice(0, 31), {
    views,
    properties: { tabColor: { argb: s.tab || C.brand } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8SVL Costing Web · ${s.footer || 'STEP 2'}&R&8Trang &P / &N` },
  });
  s.cols.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const totalW = s.cols.reduce((a, b) => a + b, 0);
  const band = (r, text, { size = 10, bold = false, italic = false, color = C.ink, fill = null, height = 18, align = 'left' } = {}) => {
    ws.mergeCells(r, 1, r, ncols);
    const c = ws.getCell(r, 1);
    c.value = text; c.font = { name: FONT, size, bold, italic, color: { argb: color } };
    c.alignment = { vertical: 'middle', horizontal: align, indent: fill ? 1 : 0, wrapText: true };
    if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    ws.getRow(r).height = Math.max(height, 13.5 * linesOf(text, totalW) + 4);
  };

  // title block: rows 1–3
  band(1, s.title, { size: 15, bold: true, color: C.white, fill: C.brand, height: 32 });
  band(2, s.subtitle || '', { size: 9, italic: true, color: C.muted, height: 18 });
  ws.getRow(3).height = 6;
  let r = 4, headerRow = 0, lastRow = 0;

  for (const b of s.blocks) {
    if (b.kind === 'gap') { ws.getRow(r).height = 10; r++; continue; }
    if (b.kind === 'section') { band(r, b.text, { size: 11, bold: true, color: C.brand, fill: C.band, height: 22 }); ws.getRow(r).getCell(1).border = { bottom: { style: 'medium', color: { argb: C.brand } } }; r++; continue; }
    if (b.kind === 'para') { band(r, b.text, { size: 10, height: 16 }); r++; continue; }
    if (b.kind === 'kv') {
      for (const [label, raw, style] of b.rows) {
        const strong = style === 'strong';
        const lc = ws.getCell(r, 1);
        lc.value = label; lc.font = { name: FONT, size: 10, bold: strong, color: { argb: C.ink } };
        lc.alignment = { vertical: 'middle', wrapText: true }; lc.border = BORDER;
        const vc = ws.getCell(r, 2);
        const tone = label === 'Trạng thái' && typeof raw === 'string' ? toneOf(raw) : (label === 'Chênh lệch' && Math.abs(norm(raw).value || 0) >= 1 ? 'bad' : null);
        setValue(vc, raw, tone);
        vc.font = { ...(vc.font || {}), name: FONT, size: 10, bold: strong || !!tone, color: vc.font?.color || { argb: C.ink } };
        vc.alignment = { vertical: 'middle', horizontal: typeof norm(raw).value === 'number' ? 'right' : 'left', wrapText: true }; vc.border = BORDER;
        if (strong) { lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.total } }; vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.total } }; }
        ws.getRow(r).height = Math.max(18, 13.5 * Math.max(linesOf(label, s.cols[0]), linesOf(norm(raw).value ?? '', s.cols[1] || 12)) + 4);
        r++;
      }
      continue;
    }
    if (b.kind === 'table') {
      const heads = b.head, n = heads.length;
      const hr = r;
      if (!headerRow) headerRow = hr;
      heads.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h; c.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.head } };
        c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0, wrapText: true }; c.border = BORDER;
      });
      ws.getRow(r).height = Math.max(22, 13.5 * Math.max(...heads.map((h, i) => linesOf(h, s.cols[i] || 12))) + 6);
      r++;
      const toneCols = heads.map((h, i) => (TONE_HEADS.has(h) ? i : -1)).filter((i) => i >= 0);
      const bodyRow = (vals, { bold = false, italic = false, fill = null, topLine = false, zebra = false } = {}) => {
        let hgt = 16;
        for (let i = 0; i < n; i++) {
          const c = ws.getCell(r, i + 1);
          const raw = vals[i] ?? '';
          let tone = null;
          if (toneCols.includes(i) && !bold && !italic) {
            const v = norm(raw).value;
            tone = heads[i] === 'Chênh lệch' ? (typeof v === 'number' && Math.abs(v) >= 1 ? 'bad' : null) : (typeof v === 'string' ? toneOf(v) : null);
          }
          setValue(c, raw, tone);
          const v = norm(raw).value;
          c.font = { name: FONT, size: 10, bold: bold || (tone && !italic) ? true : false, italic, color: { argb: italic ? C.muted : C.ink }, ...(tone ? { color: { argb: C[tone][0] } } : {}) };
          const short = i > 0 && typeof v === 'string' && v.length <= 3 && !/\s/.test(v);
          c.alignment = { vertical: 'middle', horizontal: typeof v === 'number' ? 'right' : short ? 'center' : 'left', indent: typeof v === 'string' && !short ? 1 : 0, wrapText: typeof v === 'string' };
          c.border = topLine ? { ...BORDER, top: { style: 'medium', color: { argb: C.brand } } } : BORDER;
          if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
          else if (zebra && !tone) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
          if (typeof v === 'string') hgt = Math.max(hgt, 13.5 * linesOf(v, s.cols[i]) + 4);
        }
        ws.getRow(r).height = hgt;
        r++;
      };
      b.rows.forEach((row, idx) => bodyRow(row, { zebra: !!b.zebra && idx % 2 === 1 }));
      if (b.total) bodyRow(b.total, { bold: true, fill: C.total, topLine: true });
      for (const f of b.foot || []) bodyRow(f, { italic: true });
      lastRow = r - 1;
      if (b.filter) { ws.autoFilter = `A${hr}:${colLetter(n)}${lastRow}`; }
      continue;
    }
  }
  if (s.freeze && headerRow) ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  return ws;
}

/** Build the workbook in memory. ExcelJS is passed in so the same code runs in the browser and in node tests. */
export function buildStyledWorkbook(ExcelJS, sheets, meta = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.creator || 'SVL Costing Web';
  wb.lastModifiedBy = wb.creator;
  wb.created = new Date(); wb.modified = new Date();
  if (meta.title) wb.title = meta.title;
  if (meta.subject) wb.subject = meta.subject;
  if (meta.company) wb.company = meta.company;
  for (const s of sheets) renderSheet(wb, s);
  return wb;
}

let exceljsPromise = null;
/** Loads lib/exceljs.min.js once (classic UMD script; it sets window.ExcelJS). */
export function loadExcelJS() {
  if (globalThis.ExcelJS) return Promise.resolve(globalThis.ExcelJS);
  if (!exceljsPromise) exceljsPromise = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = new URL('../../lib/exceljs.min.js', import.meta.url).href;
    sc.onload = () => (globalThis.ExcelJS ? resolve(globalThis.ExcelJS) : reject(new Error('Không khởi tạo được thư viện xuất Excel.')));
    sc.onerror = () => { exceljsPromise = null; sc.remove(); reject(new Error('Không tải được lib/exceljs.min.js.')); };
    document.head.appendChild(sc);
  });
  return exceljsPromise;
}

/** Browser: build the styled workbook and download it. */
export async function exportStyledBook(fileName, sheets, meta = {}) {
  const ExcelJS = await loadExcelJS();
  const buf = await buildStyledWorkbook(ExcelJS, sheets, meta).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
