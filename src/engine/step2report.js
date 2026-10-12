// STEP 2 — Excel summary of the Stock Out allocation (owner request 12/10/2026): logic, totals by source / rule / target,
// per source group, per PC lot and the full detail. Pure: returns sheets as arrays of rows for exportBook().
import { num } from './util.js';

const RULES = [
  ['DOONA -> T SP*.', 'R1', 'T · Customer DOONA → PC hệ T mã SP*', 'Theo khoá'],
  ['COMMON -> all PC-P-T.', 'R2', 'T · Customer COMMON → mọi PC hệ T', 'Theo khoá'],
  ['O exact Job Code.', 'R3', 'O · JOB CODE = Location PC-P-O (khớp đúng)', 'Khớp đúng'],
  ['O DS/DN -> T SP*.', 'R4', 'O · JOB CODE DN*/DS* → PC hệ T mã SP*', 'Theo khoá'],
  ['O MK* -> O MK*.', 'R4a', 'O · JOB CODE MK* (kèm SVL-MK) → PC hệ O location MK*', 'Theo khoá'],
  ['O VE* -> O VE*.', 'R4b', 'O · JOB CODE VE* → PC hệ O location VE*', 'Theo khoá'],
  ['O other -> equal all O.', 'R4c', 'O · JOB CODE còn lại → chia ĐỀU mọi PC hệ O', 'Dự phòng'],
  ['O fallback MK*.', 'R4a', 'O (workbook cũ) · không khớp → PC hệ O location MK*', 'Dự phòng'],
  ['O fallback VE*.', 'R4b', 'O (workbook cũ) · không khớp → PC hệ O location VE*', 'Dự phòng'],
  ['O fallback ALL.', 'R4c', 'O (workbook cũ) · không khớp → mọi PC hệ O', 'Dự phòng'],
  ['O fallback MK*.', 'R4a', 'O · không khớp → PC hệ O location MK*', 'Dự phòng'],
  ['O fallback VE*.', 'R4b', 'O · không khớp → PC hệ O location VE*', 'Dự phòng'],
  ['O fallback ALL.', 'R4c', 'O · không khớp → mọi PC hệ O', 'Dự phòng'],
  ['S DS/DN -> T SP*.', 'R5a', 'S · location DS*/DN* → PC hệ T mã SP*', 'Theo khoá'],
  ['S VE -> O VE*.', 'R5b', 'S · location VE* → PC hệ O VE*', 'Theo khoá'],
  ['S MK -> O MK*.', 'R5c', 'S · location MK* → PC hệ O MK*', 'Theo khoá'],
  ['S other -> equal T+O.', 'R6', 'S · location khác → chia ĐỀU mọi PC T + O', 'Dự phòng'],
  ['No cost to allocate.', 'R0', 'Nhóm 0 VND – không phân bổ', '–'],
  ['Unknown T Customer.', 'RX', 'T · Customer lạ – chưa phân bổ', 'Chưa phân bổ'],
];
export const ruleOf = (note) => { const r = RULES.find(([k]) => String(note || '').startsWith(k)); return r ? { code: r[1], label: r[2], kind: r[3] } : { code: 'RX', label: String(note || ''), kind: 'Chưa phân bổ' }; };
const M = (v) => ({ v: num(v), t: 'n', z: '#,##0;(#,##0);"-"' }); // money
const P = (v, z = '0.00%') => ({ v: num(v), t: 'n', z }); // percent
const D = { erp: 0, key: 1, type: 2, rows: 3, src: 4, fam: 5, tErp: 6, tKey: 7, pc: 8, mo: 9, prod: 10, name: 11, loc: 12, cost: 13, pct: 14, alloc: 15, status: 16, note: 17 };

/** Allocation views from a STEP 2 result. cls = step2Classification() (raw / FG / RM split) when available. */
export function step2Report(s2, cls = null) {
  const detail = s2.detail || [];
  const groups = []; const gi = new Map();
  for (const x of detail) {
    const k = `${x[D.erp]}|${x[D.key]}|${x[D.type]}`;
    let g = gi.get(k);
    if (!g) {
      const r = ruleOf(x[D.note]);
      g = { erp: x[D.erp], key: x[D.key], type: x[D.type], fam: x[D.fam], rows: x[D.rows], src: num(x[D.src]), code: r.code, rule: r.label, kind: r.kind, tErp: x[D.tErp], tKey: x[D.tKey], pcs: 0, alloc: 0, status: x[D.status] };
      gi.set(k, g); groups.push(g);
    }
    if (x[D.pc]) { g.pcs++; g.alloc += num(x[D.alloc]); }
  }
  for (const g of groups) { g.unalloc = ['ALLOCATED', 'FALLBACK EQUAL', 'ZERO COST'].includes(g.status) ? 0 : g.src; g.diff = g.src - g.alloc - g.unalloc; g.check = Math.abs(g.diff) < 1 ? (g.unalloc ? 'CHƯA PHÂN BỔ' : 'PASS') : 'CHECK'; }
  const ord = { T: 0, S: 1, O: 2 };
  groups.sort((a, b) => ord[a.erp] - ord[b.erp] || b.src - a.src);
  const byRule = new Map();
  for (const g of groups) { const r = byRule.get(g.code) || { code: g.code, rule: g.rule, kind: g.kind, src: 0, groups: 0, lines: 0 }; r.src += g.src; r.groups++; r.lines += g.pcs; byRule.set(g.code, r); }
  const total = groups.reduce((a, g) => a + g.src, 0);
  const rules = [...byRule.values()].sort((a, b) => a.code.localeCompare(b.code)).map((r) => ({ ...r, pct: total ? r.src / total : 0 }));
  const matrix = ['T', 'S', 'O'].map((e) => { const o = { erp: e, T: 0, O: 0 }; for (const x of detail) if (x[D.erp] === e && x[D.pc]) o[x[D.tErp] === 'T' ? 'T' : 'O'] += num(x[D.alloc]); return o; });
  const pcs = (s2.pc || []).map((p) => ({ ...p, rmIncl: num(p.cost) + num(p.alloc), uplift: num(p.cost) ? num(p.alloc) / num(p.cost) : 0, rmUnit: num(p.qty) ? (num(p.cost) + num(p.alloc)) / num(p.qty) : 0 }))
    .sort((a, b) => a.erp.localeCompare(b.erp) || String(a.pcNo).localeCompare(String(b.pcNo)) || String(a.prod).localeCompare(String(b.prod)));
  const fallback = rules.filter((r) => r.kind === 'Dự phòng').reduce((a, r) => a + r.src, 0);
  return { groups, rules, matrix, pcs, total, fallback, summary: s2.summary, tot: s2.total, cls };
}

/** Sheets for exportBook(): [{ name, aoa, cols }]. */
export function step2ReportSheets(s2, cls, period, appVersion = '') {
  const R = step2Report(s2, cls);
  const T = R.tot || { src: 0, alloc: 0, unalloc: 0, diff: 0, status: '' };
  const rmCost = R.pcs.reduce((a, p) => a + num(p.cost), 0), allocPC = R.pcs.reduce((a, p) => a + num(p.alloc), 0);
  const top = [...R.pcs].sort((a, b) => num(b.alloc) - num(a.alloc)).slice(0, 15);
  const sum = [
    [`STEP 2 – Tổng hợp phân bổ Stock Out kỳ ${period}`], [`Nguồn: dữ liệu ERP đã import của kỳ ${period}, kết quả STEP 2 chạy lúc ${s2.runAt || ''} (${appVersion}). Đơn vị: VND.`], [],
    ['A. Đối chiếu Stock Out trong kỳ'],
    ...(cls ? [['Tổng Stock Out trong kỳ (3 hệ, theo ERP)', M(cls.totalRaw)], ['(−) FG xuất đi rework – loại khỏi STEP 2, xử lý ở 2B / 5B (giá ERP, memo)', M(cls.fgRef)], ['Stock Out NVL cần phân bổ', M(cls.rmEligible)]] : []),
    ['Stock Out NVL theo nhóm nguồn', M(T.src)], ['Đã phân bổ vào lô PC', M(T.alloc)], ['Chưa phân bổ', M(T.unalloc)], ['Chênh lệch', M(T.diff)], ['Trạng thái', T.status], [],
    ['B. Theo hệ nguồn'], ['Hệ nguồn', 'Stock Out NVL', 'Đã phân bổ', 'Chưa phân bổ', 'Chênh lệch', 'Số nhóm', 'Số dòng Stock Out', 'Trạng thái'],
    ...(R.summary || []).map((s) => [s.erp, M(s.src), M(s.alloc), M(s.unalloc), M(s.diff), R.groups.filter((g) => g.erp === s.erp).length, R.groups.filter((g) => g.erp === s.erp).reduce((a, g) => a + num(g.rows), 0), s.status]),
    ['Tổng', M(T.src), M(T.alloc), M(T.unalloc), M(T.diff), R.groups.length, R.groups.reduce((a, g) => a + num(g.rows), 0), T.status], [],
    ['C. Theo quy tắc phân bổ'], ['Quy tắc', 'Stock Out NVL', '% tổng', 'Số nhóm nguồn', 'Số dòng PC nhận', 'Loại'],
    ...R.rules.map((r) => [`${r.code} – ${r.rule}`, M(r.src), P(r.pct), r.groups, r.lines, r.kind]),
    ['Tổng', M(R.total), P(R.total ? 1 : 0), R.groups.length, R.rules.reduce((a, r) => a + r.lines, 0)],
    ['Trong đó dự phòng (không khớp đúng khoá)', M(R.fallback), P(R.total ? R.fallback / R.total : 0)], [],
    ['D. Hệ nguồn → hệ PC nhận'], ['Hệ nguồn', 'PC hệ T', 'PC hệ O', 'Tổng'],
    ...R.matrix.map((m) => [m.erp, M(m.T), M(m.O), M(m.T + m.O)]),
    ['Tổng', M(R.matrix.reduce((a, m) => a + m.T, 0)), M(R.matrix.reduce((a, m) => a + m.O, 0)), M(R.matrix.reduce((a, m) => a + m.T + m.O, 0))], [],
    ['E. Ảnh hưởng lên RM của lô PC'], ['Số lô PC trong PC-P (T + O)', R.pcs.length], ['Số lô nhận Stock Out', R.pcs.filter((p) => num(p.alloc) > 0).length],
    ['PC RM Cost (ERP)', M(rmCost)], ['Stock Out phân bổ', M(allocPC)], ['RM sau phân bổ', M(rmCost + allocPC)], ['% tăng RM bình quân', P(rmCost ? allocPC / rmCost : 0, '0.000%')], [],
    ['F. 15 lô nhận Stock Out lớn nhất'], ['PC No.', 'Product Code', 'Hệ', 'Location', 'PC RM Cost', 'Stock Out nhận', '% tăng RM'],
    ...top.map((p) => [p.pcNo, p.prod, p.erp, p.loc, M(p.cost), M(p.alloc), P(p.uplift, '0.000%')]),
  ];
  const logic = [
    ['STEP 2 – Logic phân bổ Stock Out vào lô PC'], [],
    ['1. Lấy toàn bộ dòng STOCK OUT trong kỳ của 3 hệ T, S, O. Dòng Item Type = FG (thành phẩm xuất đi rework) bị LOẠI khỏi STEP 2 – chuyển sang Sổ FG Rework (2B / 5B).'],
    ['2. Gom Stock Out NVL theo khoá nguồn: hệ T theo Customer · hệ O theo JOB CODE · hệ S theo Location (DS/DN = DOONA, VE = VETO, MK = MK, còn lại = khác).'],
    ['3. Mỗi nhóm nguồn chọn tập lô PC nhận theo quy tắc dưới (chỉ lô trong PC-P kỳ này, hệ T và hệ O).'],
    ['4. Chia giá trị nhóm cho các lô nhận theo TỶ LỆ PC RM COST (cột Total Cost của PC-P). Lô có RM ≤ 0 không nhận. Riêng R6 chia ĐỀU số lô.'],
    ['5. RM của lô = PC RM Cost + Stock Out được phân bổ → STEP 3 (WIP) và STEP 4 (giá thành lô). Kiểm tra: nguồn = đã phân bổ + chưa phân bổ.'], [],
    ['Mã', 'Hệ nguồn', 'Điều kiện nhóm nguồn', 'Hệ PC nhận', 'Lô PC được nhận', 'Cơ sở chia', 'Ghi chú'],
    ['R1', 'T', 'Customer = DOONA', 'T', 'PC-P-T mã SP*', 'PC RM Cost', ''],
    ['R2', 'T', 'Customer = COMMON', 'T', 'Mọi PC-P-T', 'PC RM Cost', ''],
    ['RX', 'T', 'Customer khác', '–', 'Không phân bổ', '–', 'Báo CHECK CUSTOMER'],
    ['R3', 'O', 'JOB CODE trùng đúng Location PC-P-O', 'O', 'PC-P-O có Location = JOB CODE', 'PC RM Cost', 'Khớp đúng'],
    ['R4', 'O', 'JOB CODE DN* / DS*', 'T', 'PC-P-T mã SP*', 'PC RM Cost', ''],
    ['R4a', 'O', 'JOB CODE MK* (hoặc SVL-MK)', 'O', 'PC-P-O Location MK*', 'PC RM Cost', ''],
    ['R4b', 'O', 'JOB CODE VE*', 'O', 'PC-P-O Location VE*', 'PC RM Cost', ''],
    ['R4c', 'O', 'JOB CODE còn lại (hoặc không có lô nhận)', 'O', 'Mọi PC-P-O', 'Chia đều số lô', 'Dự phòng'],
    ['R5a', 'S', 'Location DS* / DN*', 'T', 'PC-P-T mã SP*', 'PC RM Cost', ''],
    ['R5b', 'S', 'Location VE*', 'O', 'PC-P-O Location VE*', 'PC RM Cost', ''],
    ['R5c', 'S', 'Location MK*', 'O', 'PC-P-O Location MK*', 'PC RM Cost', ''],
    ['R6', 'S', 'Location khác / trống', 'T + O', 'Mọi PC-P-T và PC-P-O', 'Chia đều số lô', 'Dự phòng'],
  ];
  const grp = [['Hệ nguồn', 'Khoá nguồn', 'Loại khoá', 'Nhóm (S)', 'Số dòng Stock Out', 'Giá trị Stock Out NVL', 'Mã quy tắc', 'Quy tắc áp dụng', 'Hệ PC nhận', 'Điều kiện PC nhận', 'Số lô nhận', 'Đã phân bổ', 'Chưa phân bổ', 'Chênh lệch', 'Kiểm tra'],
    ...R.groups.map((g) => [g.erp, g.key, g.type, g.fam, g.rows, M(g.src), g.code, g.rule, g.tErp, g.tKey, g.pcs, M(g.alloc), M(g.unalloc), M(g.diff), g.check])];
  const pc = [['Hệ', 'PC No.', 'PC Date', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'SL hoàn thành', 'PC RM Cost (ERP)', 'Nhận từ Stock Out T', 'Nhận từ Stock Out S', 'Nhận từ Stock Out O', 'Tổng Stock Out phân bổ', 'RM sau phân bổ', '% tăng RM', 'RM / đv sau phân bổ'],
    ...R.pcs.map((p) => [p.erp, p.pcNo, p.date ? { v: num(p.date), t: 'n', z: 'dd/mm/yyyy' } : '', p.mo, p.sub, p.prod, p.name, p.loc, num(p.qty), M(p.cost), M(p.allocT), M(p.allocS), M(p.allocO), M(p.alloc), M(p.rmIncl), P(p.uplift, '0.000%'), M(p.rmUnit)])];
  const det = [['Hệ nguồn', 'Khoá nguồn', 'Loại khoá', 'Mã quy tắc', 'Hệ PC nhận', 'PC No.', 'MO No.', 'Product Code', 'Product Name', 'PC Location', 'PC RM Cost (cơ sở chia)', 'Tỷ lệ phân bổ', 'Stock Out của nhóm nguồn', 'Stock Out phân bổ cho lô', 'Trạng thái'],
    ...(s2.detail || []).filter((x) => x[D.pc]).map((x) => [x[D.erp], x[D.key], x[D.type], ruleOf(x[D.note]).code, x[D.tErp], x[D.pc], x[D.mo], x[D.prod], x[D.name], x[D.loc], M(x[D.cost]), P(x[D.pct], '0.0000%'), M(x[D.src]), M(x[D.alloc]), x[D.status]])];
  return { report: R, sheets: [
    { name: 'Tong hop', aoa: sum, cols: [52, 18, 18, 16, 16, 16, 14, 14] },
    { name: 'Logic phan bo', aoa: logic, cols: [8, 10, 40, 12, 34, 16, 18] },
    { name: 'Theo nhom nguon', aoa: grp, cols: [8, 14, 11, 10, 10, 18, 9, 40, 9, 14, 9, 16, 14, 12, 12] },
    { name: 'Theo lo PC', aoa: pc, cols: [6, 15, 11, 18, 20, 18, 34, 12, 10, 16, 15, 15, 15, 16, 16, 10, 14] },
    { name: 'Chi tiet phan bo', aoa: det, cols: [8, 14, 11, 9, 9, 15, 18, 18, 34, 12, 16, 11, 16, 16, 15] },
  ] };
}
