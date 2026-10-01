// Parses Excel files off the main thread. Returns dense grids (see engine/grid.js).
import * as XLSX from '../lib/xlsx.mjs';
import * as cptable from '../lib/cpexcel.full.mjs';
import { sheetToGrid } from './engine/grid.js';

XLSX.set_cptable(cptable);

self.onmessage = (e) => {
  const { id, buf, mode, sheets } = e.data;
  try {
    const opts = { type: 'array', cellDates: false, cellFormula: false, cellHTML: false, cellStyles: false, cellText: false };
    if (Array.isArray(sheets)) opts.sheets = sheets;
    const wb = XLSX.read(new Uint8Array(buf), opts);
    const out = {};
    if (mode === 'first') {
      const n = wb.SheetNames[0];
      out[n] = sheetToGrid(XLSX, wb.Sheets[n]);
    } else {
      for (const n of wb.SheetNames) if (wb.Sheets[n] && (!Array.isArray(sheets) || sheets.includes(n))) out[n] = sheetToGrid(XLSX, wb.Sheets[n]);
    }
    self.postMessage({ id, ok: true, sheetNames: wb.SheetNames, grids: out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
