// STEP 1 — ERP import (port of modSTEP1_3_Core: ClassifyERPFile, FilePeriodToken, DetectHeaderRow,
// ValidateSourceReportHeaders, ImportDataReport, RefreshStatusCore)
import { ERPS, REPORTS, dsKey, ttxt, utxt, headerCol, periodToken, tokenPeriod, nowISO } from './util.js';

export function normalizeName(s) {
  let t = String(s || '').trim().toUpperCase().replace(/_/g, '-').replace(/ /g, '-');
  while (t.includes('--')) t = t.replace(/--/g, '-');
  return t;
}
export function fileBaseName(name) {
  let s = String(name || '');
  s = s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);
  const n = s.lastIndexOf('.');
  return n > 0 ? s.slice(0, n) : s;
}
export function extensionAllowed(name) {
  const m = /\.([^.]+)$/.exec(name || '');
  return !!m && ['xlsx', 'xlsm', 'xls'].includes(m[1].toLowerCase());
}

/** → {erp, report} or null. Same search order as VBA (T, S, O; PC-P … STOCK-OUT). */
export function classifyFile(name) {
  const s = normalizeName(fileBaseName(name));
  for (const a of ['T', 'S', 'O']) {
    for (const [tok, rpt] of [['PC-P-', 'PC-P'], ['PC-M-', 'PC-M'], ['MI-P-', 'MI-P'], ['MI-M-', 'MI-M'],
      ['MR-P-', 'MR-P'], ['MR-M-', 'MR-M'], ['STOCK-OUT-', 'STOCK OUT']]) {
      if (s.includes(tok + a)) return { erp: a, report: rpt };
    }
  }
  return null;
}

/** First YYMM token (YY >= 20, MM 1-12) in the file name, e.g. "2608". */
export function filePeriodToken(name) {
  const s = normalizeName(fileBaseName(name));
  for (let i = 0; i + 4 <= s.length; i++) {
    const t = s.slice(i, i + 4);
    if (/^\d{4}$/.test(t)) {
      const yy = +t.slice(0, 2), mm = +t.slice(2);
      if (yy >= 20 && mm >= 1 && mm <= 12) return t;
    }
  }
  return '';
}

function gridExtent(grid) {
  let lastRow = 0, lastCol = 0;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = row.length - 1; c >= 0; c--) {
      const v = row[c];
      if (v !== null && v !== undefined && v !== '') {
        lastRow = r + 1;
        if (c + 1 > lastCol) lastCol = c + 1;
        break;
      }
    }
  }
  return { lastRow: Math.max(lastRow, 1), lastCol: Math.max(lastCol, 1) };
}

/** 1-based header row or 0. grid = array of rows starting at sheet row 1 / column A. */
export function detectHeaderRow(grid, report) {
  const { lastRow, lastCol } = gridExtent(grid);
  for (let r = 0; r < lastRow; r++) {
    let rowText = '|';
    const row = grid[r] || [];
    for (let c = 0; c < lastCol; c++) {
      const t = utxt(row[c]);
      if (t.length) rowText += t + '|';
    }
    const has = (k) => rowText.includes(k);
    const p2 = report.slice(0, 2);
    if (p2 === 'PC') { if (has('PRODUCT CODE') && (has('PC NO') || has('|CODE|'))) return r + 1; }
    else if (p2 === 'MI') { if (has('PRODUCT CODE') && (has('MI NO') || has('|CODE|'))) return r + 1; }
    else if (p2 === 'MR') { if ((has('PRODUCT CODE') || has('ITEM CODE')) && (has('MR NO') || has('|CODE|'))) return r + 1; }
    else if (report === 'STOCK OUT') { if (has('ITEM CODE') && (has('DOCUMENT TYPE') || has('LOCATION'))) return r + 1; }
  }
  return 0;
}

export function requiredHeaders(erp, report) {
  switch (report) {
    case 'PC-P': return ['PC No.', 'Product Code', 'Current Complete Qty', 'Total Cost'];
    case 'PC-M': return ['PC No.', 'Material Code', 'Quantity', 'Total Cost'];
    case 'MI-M': return erp === 'T' ? ['Material Code', 'Current Issue Qty', 'Total Cost'] : ['Material Code', 'Total Cost'];
    case 'MR-M': return erp === 'S' ? ['Material Code', 'Bad Quantity', 'Total Cost'] : ['Material Code', 'Quantity', 'Total Cost'];
    case 'STOCK OUT': return ['Item Code', 'Total Cost'];
    default: return [];
  }
}

/**
 * Parse one ERP report grid into a dataset. Throws on blocking problems (→ status ERROR).
 * @returns dataset {key, erp, report, period, fileName, importedAt, headerRow, status, dataRows, header, rows}
 */
export function buildDataset(grid, fileName, period) {
  const cls = classifyFile(fileName);
  if (!cls) throw new Error('Không nhận diện được báo cáo ERP từ tên file');
  const { erp, report } = cls;
  const { lastRow, lastCol } = gridExtent(grid);
  const headerRow = detectHeaderRow(grid, report);
  if (headerRow <= 0) throw new Error(`${report}-${erp}: Header row could not be detected.`);
  const header = (grid[headerRow - 1] || []).slice(0, lastCol);
  while (header.length < lastCol) header.push(null);
  const miss = requiredHeaders(erp, report).filter((h) => headerCol(header, h) < 0);
  if (miss.length) throw new Error(`${report}-${erp}: Missing required header(s): ${miss.join('; ')}`);
  const rows = [];
  for (let r = headerRow; r < lastRow; r++) {
    const row = (grid[r] || []).slice(0, lastCol);
    while (row.length < lastCol) row.push(null);
    rows.push(row);
  }
  let dataRows = Math.max(lastRow - headerRow, 0);
  if (normalizeName(fileBaseName(fileName)).includes('NO-DATA')) {
    // audit F-24: a "NO DATA" file must really be empty – rows with an amount / quantity are not silently kept
    const withNumbers = rows.filter((r) => r.some((v) => typeof v === 'number' && v !== 0)).length;
    if (withNumbers) throw new Error(`${report}-${erp}: tên file ghi NO DATA nhưng có ${withNumbers} dòng có số liệu. Đổi tên file (bỏ NO DATA) hoặc xuất lại báo cáo.`);
    rows.length = 0; dataRows = 0;
  }
  return {
    key: dsKey(erp, report), erp, report, period,
    fileName: fileBaseName(fileName), importedAt: nowISO(),
    headerRow, status: dataRows === 0 ? 'NO DATA' : 'IMPORTED', dataRows, header, rows,
  };
}

/**
 * Pre-check a batch of files (names only): recognise, de-duplicate (newest wins), period guard.
 * files: [{name, lastModified}]
 */
export function planImport(files, period) {
  const slots = {}; const skipped = []; const dups = []; let recognized = 0;
  for (const f of files) {
    if (!extensionAllowed(f.name)) { skipped.push(`${f.name} - không phải file Excel`); continue; }
    const c = classifyFile(f.name);
    if (!c) { skipped.push(`${fileBaseName(f.name)} - not core`); continue; }
    recognized++;
    const k = dsKey(c.erp, c.report);
    if (!slots[k]) slots[k] = f;
    else if ((f.lastModified || 0) >= (slots[k].lastModified || 0)) {
      dups.push(`${fileBaseName(slots[k].name)} -> newer ${fileBaseName(f.name)}`); slots[k] = f;
    } else dups.push(`${fileBaseName(f.name)} - older duplicate skipped`);
  }
  const expect = periodToken(period);
  let first = '', mixed = false; const noToken = [];
  for (const f of Object.values(slots)) {
    const t = filePeriodToken(f.name);
    if (!t) { noToken.push(fileBaseName(f.name)); continue; } // audit F-10: imported, but its rows' dates are checked in STEP 1
    if (!first) first = t; else if (t !== first) { mixed = true; break; }
  }
  let error = '';
  if (!expect) error = 'Kỳ báo cáo phải có dạng YYYY-MM, ví dụ 2026-08.';
  else if (!Object.keys(slots).length) error = 'Không nhận diện được báo cáo ERP nào. Cần PC-P/PC-M/MI-P/MI-M/STOCK OUT/MR-P/MR-M + T/S/O trong tên file.';
  else if (mixed) error = 'Các file được chọn thuộc nhiều kỳ khác nhau. Hãy import từng tháng một.';
  else if (first && first !== expect) error = `Kỳ của file ERP (${tokenPeriod(first)}) không khớp kỳ báo cáo ${period}. Import bị CHẶN để tránh tính giá lẫn kỳ.`;
  return { slots, skipped, dups, recognized, error, noToken };
}

/** Checklist / summary (RefreshStatusCore). datasetsMeta: {key: {status, dataRows, fileName, importedAt}} */
export function step1Status(datasetsMeta) {
  const checklist = [];
  const bySys = {};
  let totalReady = 0, hasIssue = false;
  for (const erp of ERPS) {
    let ready = 0, rowsN = 0, last = '';
    for (const report of REPORTS) {
      const k = dsKey(erp, report);
      const m = datasetsMeta[k];
      const st = m ? m.status : 'NOT IMPORTED';
      if (st === 'IMPORTED' || st === 'NO DATA') ready++;
      if (st === 'ERROR' || st === 'CHECK HEADER') hasIssue = true;
      rowsN += m ? (m.dataRows || 0) : 0;
      if (m && m.importedAt && m.importedAt > last) last = m.importedAt;
      checklist.push({ erp, report, key: k, status: st, dataRows: m ? m.dataRows || 0 : 0, fileName: m ? m.fileName || '' : '', importedAt: m ? m.importedAt || '' : '', error: m ? m.error || '' : '' });
    }
    bySys[erp] = { status: ready === 7 ? 'READY' : ready > 0 ? 'PARTIAL' : 'NOT IMPORTED', files: `${ready}/7`, rows: rowsN, lastImport: last };
    totalReady += ready;
  }
  const overall = totalReady === 21 && !hasIssue ? 'COMPLETE' : totalReady > 0 ? 'PARTIAL' : 'NOT IMPORTED';
  const latest = Object.values(bySys).map((s) => s.lastImport).sort().pop() || '';
  return { checklist, bySys, totalReady, hasIssue, overall, result: overall === 'COMPLETE' ? 'PASS' : overall === 'PARTIAL' ? 'PARTIAL' : 'NOT RUN', latestImport: latest };
}
