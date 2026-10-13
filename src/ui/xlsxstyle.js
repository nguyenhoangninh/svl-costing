// Styled Excel export (ExcelJS, vendored at lib/exceljs.min.js, loaded on first use).
// SheetJS Community (lib/xlsx.mjs) cannot write fills, fonts or borders, so every export in the app goes through this module.
// Two sheet shapes:
//  1. Report sheet  { name, title, subtitle, cols, freeze, footer, blocks: [...] }  — built by step2report.js (section / para / kv / table / gap)
//  2. Array sheet   { name, aoa, cols?, title?, subtitle?, header?, keep? }         — every other export
//     header: 1-based row(s) to style as table headers (default: detected automatically)
//     keep:   true for import templates — cell positions and values are written exactly as given (no title rows, no date conversion)
// Cell values: primitives, or { v, z } where z is an Excel number format.

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
const blank = (x) => x === null || x === undefined || x === '';
const NF_INT = '[>=0.5]#,##0;[<=-0.5](#,##0);"-"';
const NF_DEC = '[>=0.005]#,##0.00;[<=-0.005](#,##0.00);"-"';
const NF_DATE = 'dd/mm/yyyy';
const NF_TS = 'dd/mm/yyyy hh:mm';
const ISO_TS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const ISO_D = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXCEL_EPOCH = 25569; // 1970-01-01 as an Excel serial
const VN_OFFSET = 7 / 24;  // timestamps are shown in Vietnam time

function setValue(cell, raw, tone) {
  const { value, z } = norm(raw);
  if (blank(value)) cell.value = null;
  else if (typeof value === 'number') { cell.value = Number.isFinite(value) ? value : null; cell.numFmt = z || (Number.isInteger(value) ? NF_INT : NF_DEC); }
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
          const stt = i === 0 && typeof v === 'number' && Number.isInteger(v) && v < 1000;
          c.alignment = { vertical: 'middle', horizontal: stt ? 'center' : typeof v === 'number' ? 'right' : short || (i === 0 && v === '–') ? 'center' : 'left', indent: typeof v === 'string' && !short ? 1 : 0, wrapText: typeof v === 'string' };
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

// ---- array sheets (every other export) ----

const nbCount = (row) => row.filter((x) => !blank(norm(x).value)).length;
const isHeaderBy = (rows, i) => {
  if (i > 0 && nbCount(rows[i - 1]) > 0) return false; // a header starts a block: the row above is empty
  const vs = rows[i].map((x) => norm(x).value).filter((v) => !blank(v));
  if (vs.length < 2 || !vs.every((v) => typeof v === 'string' && v.length <= 60)) return false;
  if (i === rows.length - 1) return true;
  const nx = rows[i + 1].map((x) => norm(x).value).filter((v) => !blank(v));
  if (nx.length < 2) return false;
  return nx.some((v) => typeof v !== 'string') || nx.length === vs.length;
};

/** Number format for a numeric cell, from its column header and value. */
function numFmtFor(head, v) {
  const h = String(head || '');
  if (/period|kỳ|year|năm|seq|stt|\bno\b|no\.|code|mã|\bid\b|layer id/i.test(h) && Number.isInteger(v)) return '0';
  if (/date|ngày/i.test(h) && Number.isInteger(v) && v > 20000 && v < 80000) return NF_DATE;
  if (/%|tỷ lệ|share|pct|rate/i.test(h) && Math.abs(v) <= 5 && !Number.isInteger(v)) return '0.00%';
  return Number.isInteger(v) ? NF_INT : NF_DEC;
}

function renderAoaSheet(wb, s, meta) {
  const pre = s.title ? [[s.title], [s.subtitle ?? meta.subtitle ?? ''], []] : [];
  const rows = [...pre, ...s.aoa].map((r) => (Array.isArray(r) ? r : []));
  const ncols = Math.max(1, ...rows.map((r) => r.length));
  const val = (i, c) => norm(rows[i][c]).value;
  const explicit = s.header ? new Set([].concat(s.header).map((h) => h - 1)) : null;
  const hdrIdx = rows.map((_, i) => i).filter((i) => (explicit ? explicit.has(i) : isHeaderBy(rows, i)));
  const tables = hdrIdx.map((h) => {
    let e = h;
    while (e + 1 < rows.length && nbCount(rows[e + 1]) > 0 && !hdrIdx.includes(e + 1)) e++;
    let w = 0;
    rows[h].forEach((x, c) => { if (!blank(norm(x).value)) w = c + 1; });
    return { h, e, w: Math.max(1, w), head: (c) => String(val(h, c) ?? '') };
  });
  const tableOf = new Map();
  for (const t of tables) for (let i = t.h; i <= t.e; i++) tableOf.set(i, t);

  const widths = Array.from({ length: ncols }, (_, c) => {
    if (s.cols && s.cols[c]) return Math.max(10, s.cols[c]);
    let w = 10;
    for (const t of tables) {
      w = Math.max(w, t.head(c).length * 0.9 + 3);
      for (let i = t.h + 1; i <= Math.min(t.e, t.h + 400); i++) { const v = val(i, c); w = Math.max(w, (typeof v === 'number' ? 14 : String(v ?? '').length) + 2); }
    }
    return Math.min(Math.max(w, 10), 46);
  });

  const ws = wb.addWorksheet(String(s.name).slice(0, 31), {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: C.brand } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8SVL Costing Web · ${s.footer || 'Báo cáo'}&R&8Trang &P / &N` },
  });
  widths.forEach((w, c) => { ws.getColumn(c + 1).width = w; });
  const totalW = widths.reduce((a, b) => a + b, 0);

  rows.forEach((row, i) => {
    const r = i + 1;
    const t = tableOf.get(i);
    const isHdr = t && t.h === i;
    const isBody = t && t.h < i;
    const nb = nbCount(row);
    // title and subtitle (only when the sheet has a title)
    if (s.title && i < 2) {
      ws.mergeCells(r, 1, r, ncols);
      const c = ws.getCell(r, 1);
      c.value = row[0] ?? null;
      c.font = i === 0 ? { name: FONT, size: 15, bold: true, color: { argb: C.white } } : { name: FONT, size: 9, italic: true, color: { argb: C.muted } };
      if (i === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.brand } };
      c.alignment = { vertical: 'middle', indent: i === 0 ? 1 : 0 };
      ws.getRow(r).height = i === 0 ? 32 : 18;
      return;
    }
    if (nb === 0) { if (!isBody) ws.getRow(r).height = 8; return; }
    if (isHdr) {
      for (let c = 0; c < t.w; c++) {
        const cell = ws.getCell(r, c + 1);
        cell.value = blank(val(i, c)) ? null : String(val(i, c));
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.head } };
        cell.alignment = { vertical: 'middle', horizontal: c === 0 ? 'left' : 'center', indent: c === 0 ? 1 : 0, wrapText: true };
        cell.border = BORDER;
      }
      ws.getRow(r).height = Math.max(22, 13.5 * Math.max(...row.map((_, c) => linesOf(val(i, c) ?? '', widths[c]))) + 6);
      return;
    }
    if (!t) {
      // free text outside a table: long notes in italics, one-cell captions in bold, label cells in multi-cell lines in bold
      if (nb === 1 && row.length && !blank(val(i, row.findIndex((x) => !blank(norm(x).value))))) {
        const c = row.findIndex((x) => !blank(norm(x).value));
        const text = String(val(i, c));
        const cell = ws.getCell(r, c + 1);
        cell.value = text;
        if (text.length > 60) { cell.font = { name: FONT, size: 10, italic: true, color: { argb: C.muted } }; ws.mergeCells(r, c + 1, r, ncols); cell.alignment = { vertical: 'middle', wrapText: true }; ws.getRow(r).height = 13.5 * linesOf(text, totalW) + 4; }
        else { cell.font = { name: FONT, size: 11, bold: true, color: { argb: C.brand } }; ws.getRow(r).height = 20; }
        return;
      }
    }
    // table body or free-form line: write every cell at its position
    let hgt = 16;
    for (let c = 0; c < ncols; c++) {
      if (isBody && c >= t.w) break;
      const raw = row[c];
      const cell = ws.getCell(r, c + 1);
      const head = isBody ? t.head(c) : '';
      let { value, z } = norm(raw);
      let tone = null;
      if (!s.keep && typeof value === 'string') {
        const m1 = ISO_TS.exec(value);
        const m2 = !m1 && ISO_D.exec(value);
        if (m1) { const ms = Date.UTC(+m1[1], +m1[2] - 1, +m1[3], +m1[4], +m1[5]); value = ms / 86400000 + EXCEL_EPOCH + VN_OFFSET; z = NF_TS; }
        else if (m2) { value = Date.UTC(+m2[1], +m2[2] - 1, +m2[3]) / 86400000 + EXCEL_EPOCH; z = NF_DATE; }
      }
      if (typeof value === 'number' && !z) z = numFmtFor(head, value);
      if (isBody && TONE_HEADS.has(head) && !s.keep) {
        if (head === 'Chênh lệch') tone = typeof value === 'number' && Math.abs(value) >= 1 ? 'bad' : null;
        else if (typeof value === 'string') tone = toneOf(value);
      } else if (isBody && /status|trạng thái|check|gate|valid|decision|result|flag/i.test(head) && typeof value === 'string' && !s.keep) {
        tone = toneOf(value);
      }
      if (blank(value)) cell.value = null;
      else if (typeof value === 'number') { cell.value = Number.isFinite(value) ? value : null; cell.numFmt = z || NF_DEC; }
      else cell.value = String(value);
      if (tone) { cell.font = { name: FONT, size: 10, bold: true, color: { argb: C[tone][0] } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C[tone][1] } }; }
      else cell.font = { name: FONT, size: 10, bold: !isBody && typeof value === 'string' && nb > 1 && c === row.findIndex((x) => !blank(norm(x).value)), color: { argb: C.ink } };
      const isNum = typeof value === 'number';
      const short = isBody && c > 0 && typeof value === 'string' && value.length <= 3 && !/\s/.test(value);
      cell.alignment = { vertical: 'middle', horizontal: isNum ? 'right' : short ? 'center' : 'left', indent: !isNum && !short ? 1 : 0, wrapText: typeof value === 'string' && isBody };
      if (isBody) cell.border = BORDER;
      if (typeof value === 'string' && isBody) hgt = Math.max(hgt, 13.5 * linesOf(value, widths[c]) + 4);
    }
    if (isBody) ws.getRow(r).height = hgt;
  });

  // v1.14.26 import template finish (s.tpl): title rows, required / conditional header colours, header notes, column number
  // formats, freeze header + key columns, filter and drop-down lists. Cell values and positions are unchanged (keep).
  if (s.keep && s.tpl) {
    const T = s.tpl, H = T.headerRow, last = Math.max(rows.length, H + (T.minRows || 0));
    const c1 = ws.getCell(1, 1); c1.font = { name: FONT, size: 8, color: { argb: C.muted } };
    const c3 = ws.getCell(1, 3); if (!blank(c3.value)) { c3.font = { name: FONT, size: 14, bold: true, color: { argb: C.brand } }; ws.getRow(1).height = 26; }
    if (T.mergeInfo) ws.mergeCells(2, 4, 2, 6); // months text spans D2:F2 (row 2 is informational)
    for (let c = 1; c <= ncols; c += 2) { const lab = ws.getCell(2, c); if (!blank(lab.value)) lab.font = { name: FONT, size: 10, bold: true, color: { argb: C.muted } }; const v = ws.getCell(2, c + 1); if (!blank(v.value)) { v.font = { name: FONT, size: 11, bold: true, color: { argb: C.brand } }; v.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.band } }; } }
    const req = new Set(T.required || []), cond = new Set(T.conditional || []);
    for (let c = 0; c < ncols; c++) {
      const h = ws.getCell(H, c + 1); if (blank(h.value)) continue;
      if (req.has(c)) { h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8A4B00' } }; h.value = `${h.value} *`; }
      else if (cond.has(c)) h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB06A00' } };
      if (T.notes && T.notes[c]) h.note = { texts: [{ font: { size: 9, name: FONT }, text: T.notes[c] }], margins: { insetmode: 'auto' } };
    }
    for (const [c, fmt] of Object.entries(T.numFmt || {})) for (let r = H + 1; r <= rows.length; r++) { const cell = ws.getCell(r, +c + 1); if (typeof cell.value === 'number') cell.numFmt = fmt; }
    const center = new Set(T.center || []);
    for (let r = H + 1; r <= rows.length; r++) for (let c = 0; c < ncols; c++) { const cell = ws.getCell(r, c + 1); if (typeof cell.value === 'string') cell.alignment = { vertical: 'middle', horizontal: center.has(c) ? 'center' : 'left', indent: center.has(c) ? 0 : 1, wrapText: false }; }
    ws.views = [{ showGridLines: false, state: 'frozen', xSplit: T.freezeCols || 0, ySplit: H, topLeftCell: `${colLetter((T.freezeCols || 0) + 1)}${H + 1}` }];
    ws.autoFilter = `A${H}:${colLetter(ncols)}${Math.max(H + 1, rows.length)}`;
    for (const [c, list] of Object.entries(T.lists || {})) {
      const L = colLetter(+c + 1);
      ws.dataValidations.add(`${L}${H + 1}:${L}${last}`, { type: 'list', allowBlank: true, formulae: [`"${list.join(',')}"`], showErrorMessage: true, errorStyle: 'warning', errorTitle: 'Giá trị không có trong danh sách', error: `Chọn một trong: ${list.join(', ')}` });
    }
    ws.pageSetup.printTitlesRow = `${H}:${H}`;
    return ws;
  }
  // freeze, filter and print titles for a single table sheet
  const single = tables.length === 1 ? tables[0] : null;
  if (single && single.e - single.h >= 10 && single.h < 14) {
    ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 0, ySplit: single.h + 1, topLeftCell: `A${single.h + 2}` }];
  }
  if (single && single.e > single.h) ws.autoFilter = `A${single.h + 1}:${colLetter(ncols)}${single.e + 1}`;
  if (single) ws.pageSetup.printTitlesRow = `${single.h + 1}:${single.h + 1}`;
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
  for (const s of sheets) (s.aoa ? renderAoaSheet(wb, s, meta) : renderSheet(wb, s));
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
