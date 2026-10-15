// Synthetic ERP reports (no company data), shared by test/synth.mjs (engine) and test/e2e-synthetic.mjs (browser).
// The numbers are deterministic: the same seed gives the same reports, so test/synth.snapshot.json stays valid.
//   rework   : include the FG Stock Out issued to rework (SO-T-3)                       – default true
//   negative : material 4 is under-issued so its WIP ends negative and needs STEP 3B      – default true
export const P = '2026-08';
export const ser = (d) => (Date.UTC(2026, 7, d) - Date.UTC(1899, 11, 30)) / 86400000;

export function synthErp({ rework = true, negative = true } = {}) {
  // deterministic pseudo-random numbers
  let seed = 20261002; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const R = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
  // ---------- master data (invented)
  const PROD = { T: [['SPX-100', 'Synthetic seat A'], ['SPX-200', 'Synthetic seat B']], O: [['OLX-300', 'Synthetic bag C', 'MKX1'], ['OLX-400', 'Synthetic belt D', 'VEX1']] };
  const MAT = { T: ['50000001', '50000002', '50000003', '50000004'], O: ['300001', '300002', '300003', '300004'] };
  const price = { '50000001': 12000, '50000002': 3500, '50000003': 800, '50000004': 45000, '300001': 9000, '300002': 2200, '300003': 640, '300004': 15000 };

  // ---------- PC-P / PC-M / MI-M / MR-M
  const pcp = { T: [], O: [] }, pcm = { T: [], O: [] }, mim = { T: [], O: [] }, mrm = { T: [], O: [] };
  let lot = 0;
  for (const e of ['T', 'O']) {
    for (const [code, name, loc] of PROD[e]) {
      for (let k = 0; k < 3; k++) {
        lot++; const pc = `PC-2608-${String(lot).padStart(3, '0')}`; const mo = `MO-25${e}-${lot}`; const sub = `${mo}-001`;
        const qty = 20 + Math.round(rnd() * 80); const day = 3 + k * 9 + (e === 'O' ? 1 : 0);
        let cost = 0;
        MAT[e].forEach((m, i) => {
          if (k === 2 && i === 3) return; // one lot misses a material (trace anomaly)
          const q = Math.round(qty * (1 + i) * R(0.9, 1.1) * 100) / 100; const a = Math.round(q * price[m] * R(0.97, 1.03) * 100) / 100;
          cost += a;
          pcm[e].push([pc, 'PC', ser(day), 'Completed', mo, sub, code, name, '#', m, `Material ${m}`, q, 'PCS', a]);
          const f = i === 3 ? R(0.6, 0.7) : R(1.0, 1.15); const iq = Math.round(q * (i === 3 && !negative ? 1.05 : f) * 100) / 100; // material 4 is under-issued → negative WIP → 3B
          mim[e].push([`MI-${lot}-${i}`, 'MI', ser(day - 1), 'Completed', mo, sub, code, name, '#', m, `Material ${m}`, iq, 'PCS', Math.round(iq * price[m] * 100) / 100]);
        });
        pcp[e].push([pc, 'PC', ser(day), 'Completed', mo, sub, code, name, loc || 'FG', 'PCS', qty, Math.round(cost * 100) / 100]);
      }
    }
    mrm[e].push(['MR-1', 'MR', ser(28), 'Completed', `MO-25${e}-1`, '', PROD[e][0][0], PROD[e][0][1], '#', MAT[e][0], `Material ${MAT[e][0]}`, 'PCS', 1, 'RM', 1, price[MAT[e][0]]]);
  }
  const HP = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'Unit', 'Current Complete Qty', 'Total Cost'];
  const HM = ['PC No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Quantity', 'Unit(Qty)', 'Total Cost'];
  const HI = ['MI No.', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Current Issue Qty', 'Unit', 'Total Cost'];
  const HR = ['Code', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Unit', 'Req. Qty', 'Location', 'Quantity', 'Total Cost'];
  // ---------- Stock Out (RM + one FG issue to rework on ERP T)
  const soT = [['SO-T-1', 'Stock Out', 'G', 'Completed', ser(6), null, 1, MAT.T[1], 'Material', 'RM', 'RM', 'PCS', -50, -175000, 'DOONA', null],
    ['SO-T-2', 'Stock Out', 'G', 'Completed', ser(9), null, 1, MAT.T[2], 'Material', 'RM', 'RM', 'PCS', -100, -80000, 'COMMON', null],
    ['SO-T-3', 'Stock Out', 'G', 'Completed', ser(15), null, 1, 'SPX-100', 'Synthetic seat A', 'FG', 'FG', 'PCS', -2, -900000, 'COMMON', 'MO-RW-1']];
  const soO = [['SO-O-1', 'Stock Out', 'G', 'Completed', ser(7), null, 1, MAT.O[1], 'Material', 'RM', 'MKX1', 'PC', -40, 2200, -88000, null, 'DIV', 'MKX1', null],
    ['SO-O-2', 'Stock Out', 'G', 'Completed', ser(8), null, 1, MAT.O[2], 'Material', 'RM', 'ZZZ', 'PC', -30, 640, -19200, null, 'DIV', 'ZZ-UNKNOWN', null]];
  const soS = [['SO-S-1', 'Stock Out', 'G', 'Completed', ser(10), null, 1, '900001', 'Material', 'RM', -5, 'M', 'DSL1', 3000, -15000, 'R', null, 'X', 'DIV', 'DS-1']];
  const HST = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Unit', 'Quantity', 'Total Cost', 'Customer', 'MO No.'];
  const HSO = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Location', 'Base Unit', 'Base Qty', 'Base Unit Cost', 'Total Cost', 'MO No.', 'DIVISION', 'JOB CODE', 'CUSTOMER'];
  const HSS = ['Code', 'Document Type', 'Group', 'Status', 'Date', 'Sub-Ledger', '#', 'Item Code', 'Item Name(English)', 'Item Type', 'Quantity', 'Unit', 'Location', 'Base Unit Cost', 'Total Cost', 'Remark', 'MO No.', 'Doc Ref 1', 'DIVISION', 'JOB CODE'];
  if (!rework) soT.splice(soT.findIndex((r) => r[0] === 'SO-T-3'), 1);
  const reports = [];
  const add = (name, header, rows) => reports.push({ name, header, rows });
  for (const e of ['T', 'O']) { add(`PC-P-${e}`, HP, pcp[e]); add(`PC-M-${e}`, HM, pcm[e]); add(`MI-M-${e}`, HI, mim[e]); add(`MR-M-${e}`, HR, mrm[e]); }
  add('STOCK OUT-T', HST, soT); add('STOCK OUT-O', HSO, soO); add('STOCK OUT-S', HSS, soS);
  add('MR-M-S', ['Code', 'Document Group', 'Date', 'Status', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', '#', 'Material Code', 'Material Name', 'Req. Qty', 'Location', 'Unit Rate', 'Bad Quantity', 'Total Cost'], []);
  return { reports, PROD, MAT, price, pcp };
}
