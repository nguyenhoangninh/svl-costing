// Convert a SheetJS worksheet into a dense 2-D array starting at A1 (row 1 → index 0).
// Values are raw (Value2 semantics): numbers, strings, booleans; dates stay Excel serial numbers.
export function sheetToGrid(XLSX, ws, maxRows = Infinity) {
  if (!ws || !ws['!ref']) return [];
  const rg = XLSX.utils.decode_range(ws['!ref']);
  // Some ERP exports declare huge ranges — find the real extent from the cell keys.
  let lastR = -1, lastC = -1;
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    const cell = ws[k];
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;
    const a = XLSX.utils.decode_cell(k);
    if (a.r > lastR) lastR = a.r;
    if (a.c > lastC) lastC = a.c;
  }
  lastR = Math.min(lastR, rg.e.r, maxRows - 1);
  lastC = Math.min(lastC, rg.e.c);
  const grid = [];
  for (let r = 0; r <= lastR; r++) {
    const row = new Array(lastC + 1).fill(null);
    for (let c = 0; c <= lastC; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      let v = cell.v;
      if (cell.t === 'e') v = null;
      else if (cell.t === 'd' && v instanceof Date) v = (Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;
      row[c] = v === undefined ? null : v;
    }
    grid.push(row);
  }
  return grid;
}
