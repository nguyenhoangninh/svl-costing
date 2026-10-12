// STEP 2 — Excel summary of the Stock Out allocation (owner request 12/10/2026): logic, totals by source / rule / target,
// per source group, per PC lot and the full detail. Pure: returns sheets as arrays of rows for exportBook().
import { num } from './util.js';
import { STEP2_RULES } from './step2.js';

const RULES = [
  ['DOONA -> T SP*.', 'R1', 'T · Customer DOONA → PC hệ T mã SP*', 'Theo khoá'],
  ['COMMON -> all PC-P-T.', 'R2', 'T · Customer COMMON → mọi PC hệ T', 'Theo khoá'],
  ['O exact Job Code.', 'R3', 'O · JOB CODE = Location PC-P-O (khớp đúng)', 'Khớp đúng'],
  ['O DS/DN -> T SP*.', 'R4', 'O · JOB CODE DN*/DS* → PC hệ T mã SP*', 'Theo khoá'],
  ['O MK* -> O MK*.', 'R4a', 'O · JOB CODE MK* (kèm SVL-MK) → PC hệ O location MK*', 'Theo khoá'],
  ['O VE* (kèm SVL-VE) -> O VE*.', 'R4b', 'O · JOB CODE VE* (kèm SVL-VE) → PC hệ O location VE*', 'Theo khoá'],
  ['O other -> all O theo PC RM Cost.', 'R4c', 'O · JOB CODE còn lại → chia theo PC RM Cost mọi PC hệ O', 'Dự phòng'],
  ['O other -> equal all O.', 'R4c', 'O · JOB CODE còn lại → chia đều mọi PC hệ O (workbook cũ)', 'Dự phòng'],
  ['O fallback MK*.', 'R4a', 'O (workbook cũ) · không khớp → PC hệ O location MK*', 'Dự phòng'],
  ['O fallback VE*.', 'R4b', 'O (workbook cũ) · không khớp → PC hệ O location VE*', 'Dự phòng'],
  ['O fallback ALL.', 'R4c', 'O (workbook cũ) · không khớp → mọi PC hệ O', 'Dự phòng'],
  ['O fallback MK*.', 'R4a', 'O · không khớp → PC hệ O location MK*', 'Dự phòng'],
  ['O fallback VE*.', 'R4b', 'O · không khớp → PC hệ O location VE*', 'Dự phòng'],
  ['O fallback ALL.', 'R4c', 'O · không khớp → mọi PC hệ O', 'Dự phòng'],
  ['S DS/DN -> T SP*.', 'R5a', 'S · location DS*/DN* → PC hệ T mã SP*', 'Theo khoá'],
  ['S VE -> O VE*.', 'R5b', 'S · location VE* → PC hệ O VE*', 'Theo khoá'],
  ['S MK -> O MK*.', 'R5c', 'S · location MK* → PC hệ O MK*', 'Theo khoá'],
  ['S other -> T+O theo PC RM Cost.', 'R6', 'S · location khác → chia theo PC RM Cost mọi PC T + O', 'Dự phòng'],
  ['S other -> equal T+O.', 'R6', 'S · location khác → chia đều mọi PC T + O (workbook cũ)', 'Dự phòng'],
  ['No cost to allocate.', 'R0', 'Nhóm 0 VND – không phân bổ', '–'],
  ['Unknown T Customer.', 'RX', 'T · Customer lạ – chưa phân bổ', 'Chưa phân bổ'],
];
export const ruleOf = (note) => { const r = RULES.find(([k]) => String(note || '').startsWith(k)); return r ? { code: r[1], label: r[2], kind: r[3] } : { code: 'RX', label: String(note || ''), kind: 'Chưa phân bổ' }; };
const M = (v) => ({ v: num(v), t: 'n', z: '[>=0.5]#,##0;[<=-0.5](#,##0);"-"' }); // money (tiny residues show as "-")
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
  for (const g of groups) { g.unalloc = ['ALLOCATED', 'FALLBACK EQUAL', 'FALLBACK RM COST', 'ZERO COST'].includes(g.status) ? 0 : g.src; g.diff = g.src - g.alloc - g.unalloc; g.check = Math.abs(g.diff) < 1 ? (g.unalloc ? 'CHƯA PHÂN BỔ' : 'PASS') : 'CHECK'; }
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

/** Sheets for the styled Excel export (src/ui/xlsxstyle.js): title, subtitle, blocks (section / para / kv / table / gap). */
export function step2ReportSheets(s2, cls, period, appVersion = '') {
  const R = step2Report(s2, cls);
  const T = R.tot || { src: 0, alloc: 0, unalloc: 0, diff: 0, status: '' };
  const rmCost = R.pcs.reduce((a, p) => a + num(p.cost), 0), allocPC = R.pcs.reduce((a, p) => a + num(p.alloc), 0);
  const top = [...R.pcs].sort((a, b) => num(b.alloc) - num(a.alloc)).slice(0, 15);
  const when = s2.runAt ? new Date(s2.runAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : '';
  const ver = String(appVersion || '').split('·')[0].trim();
  const subtitle = `SVL – Starry Vietnam Co., Ltd.   ·   Chạy STEP 2 lúc ${when}   ·   ${ver}   ·   Đơn vị: VND`;
  const cnt = (e) => R.groups.filter((g) => g.erp === e);
  // Quy tắc theo bảng trên màn hình (STEP2_RULES, 9 dòng). Mỗi mã chi tiết (R1…R6) thuộc đúng một dòng màn hình.
  const SCREEN_OF = { R1: 1, R2: 2, R3: 3, R4: 4, R4a: 5, R4b: 6, R4c: 7, R5a: 8, R5b: 8, R5c: 8, R6: 9 };
  const screenCodes = (n) => Object.keys(SCREEN_OF).filter((k) => SCREEN_OF[k] === n).join(', ');
  const acc = new Map();
  for (const g of R.groups) {
    const n = SCREEN_OF[g.code] ?? 0;
    const a = acc.get(n) || { src: 0, alloc: 0, unalloc: 0, groups: 0, lines: 0 };
    a.src += g.src; a.alloc += g.alloc; a.unalloc += g.unalloc; a.groups += 1; a.lines += g.pcs;
    acc.set(n, a);
  }
  const accOf = (n) => acc.get(n) || { src: 0, alloc: 0, unalloc: 0, groups: 0, lines: 0 };
  const shareOf = (x) => (R.total ? x / R.total : 0);
  const screenRows = STEP2_RULES.map(([n, src, cond, , , , , use]) => {
    const a = accOf(n);
    return [`${n} · ${src} · ${cond}   (${screenCodes(n)})`, M(a.src), M(a.alloc), M(a.unalloc), P(shareOf(a.src)), a.groups, a.lines, use];
  });
  const outside = accOf(0);
  const fb = [7, 9].map(accOf).reduce((x, a) => ({ src: x.src + a.src, alloc: x.alloc + a.alloc, unalloc: x.unalloc + a.unalloc, groups: x.groups + a.groups, lines: x.lines + a.lines }), { src: 0, alloc: 0, unalloc: 0, groups: 0, lines: 0 });
  const sumAll = (k) => [...acc.values()].reduce((x, a) => x + a[k], 0);

  const sum = [
    { kind: 'section', text: 'A. Đối chiếu Stock Out trong kỳ' },
    { kind: 'kv', rows: [
      ...(cls ? [['Tổng Stock Out trong kỳ (3 hệ, theo ERP)', M(cls.totalRaw)], ['(−) FG xuất đi rework – loại khỏi STEP 2, xử lý ở 2B / 5B (giá ERP, memo)', M(cls.fgRef)], ['Stock Out NVL cần phân bổ', M(cls.rmEligible), 'strong']] : []),
      ['Stock Out NVL theo nhóm nguồn', M(T.src)], ['Đã phân bổ vào lô PC', M(T.alloc)], ['Chưa phân bổ', M(T.unalloc)], ['Chênh lệch', M(T.diff)], ['Trạng thái', T.status],
    ] },
    { kind: 'gap' },
    { kind: 'section', text: 'B. Theo hệ nguồn' },
    { kind: 'table', head: ['Hệ nguồn', 'Stock Out NVL', 'Đã phân bổ', 'Chưa phân bổ', 'Chênh lệch', 'Số nhóm', 'Số dòng Stock Out', 'Trạng thái'],
      rows: (R.summary || []).map((x) => [x.erp, M(x.src), M(x.alloc), M(x.unalloc), M(x.diff), cnt(x.erp).length, cnt(x.erp).reduce((a, g) => a + num(g.rows), 0), x.status]),
      total: ['Tổng', M(T.src), M(T.alloc), M(T.unalloc), M(T.diff), R.groups.length, R.groups.reduce((a, g) => a + num(g.rows), 0), T.status] },
    { kind: 'gap' },
    { kind: 'section', text: 'C. Số tiền theo từng quy tắc (đúng thứ tự bảng quy tắc trên màn hình)' },
    { kind: 'table', head: ['Quy tắc', 'Stock Out NVL', 'Đã phân bổ', 'Chưa phân bổ', '% tổng', 'Số nhóm nguồn', 'Số dòng PC nhận', 'Xử lý'],
      rows: [...screenRows, [`Ngoài bảng: R0 (nhóm 0 VND) · RX (Customer lạ)   (${['R0', 'RX'].join(', ')})`, M(outside.src), M(outside.alloc), M(outside.unalloc), P(shareOf(outside.src)), outside.groups, outside.lines, outside.unalloc ? 'Kiểm tra' : '–']],
      total: ['Tổng', M(sumAll('src')), M(sumAll('alloc')), M(sumAll('unalloc')), P(R.total ? 1 : 0), R.groups.length, sumAll('lines'), ''],
      foot: [['Trong đó Fallback (quy tắc 7 và 9)', M(fb.src), M(fb.alloc), M(fb.unalloc), P(shareOf(fb.src)), fb.groups, fb.lines, 'Fallback']] },
    { kind: 'gap' },
    { kind: 'section', text: 'D. Hệ nguồn → hệ PC nhận' },
    { kind: 'table', head: ['Hệ nguồn', 'PC hệ T', 'PC hệ O', 'Tổng'],
      rows: R.matrix.map((m) => [m.erp, M(m.T), M(m.O), M(m.T + m.O)]),
      total: ['Tổng', M(R.matrix.reduce((a, m) => a + m.T, 0)), M(R.matrix.reduce((a, m) => a + m.O, 0)), M(R.matrix.reduce((a, m) => a + m.T + m.O, 0))] },
    { kind: 'gap' },
    { kind: 'section', text: 'E. Ảnh hưởng lên RM của lô PC' },
    { kind: 'kv', rows: [
      ['Số lô PC trong PC-P (T + O)', R.pcs.length], ['Số lô nhận Stock Out', R.pcs.filter((p) => num(p.alloc) > 0).length],
      ['PC RM Cost (ERP)', M(rmCost)], ['Stock Out phân bổ', M(allocPC)], ['RM sau phân bổ', M(rmCost + allocPC), 'strong'], ['% tăng RM bình quân', P(rmCost ? allocPC / rmCost : 0, '0.000%')],
    ] },
    { kind: 'gap' },
    { kind: 'section', text: 'F. 15 lô nhận Stock Out lớn nhất' },
    { kind: 'table', head: ['PC No.', 'Product Code', 'Hệ', 'Location', 'PC RM Cost', 'Stock Out nhận', '% tăng RM'],
      rows: top.map((p) => [p.pcNo, p.prod, p.erp, p.loc, M(p.cost), M(p.alloc), P(p.uplift, '0.000%')]) },
  ];
  const logic = [
    { kind: 'section', text: 'Quy trình' },
    { kind: 'para', text: '1. Lấy toàn bộ dòng STOCK OUT trong kỳ của 3 hệ T, S, O. Dòng Item Type = FG (thành phẩm xuất đi rework) bị LOẠI khỏi STEP 2 – chuyển sang Sổ FG Rework (2B / 5B).' },
    { kind: 'para', text: '2. Gom Stock Out NVL theo khoá nguồn: hệ T theo Customer · hệ O theo JOB CODE · hệ S theo Location (DS/DN = DOONA, VE = VETO, MK = MK, còn lại = khác).' },
    { kind: 'para', text: '3. Mỗi nhóm nguồn chọn tập lô PC nhận theo quy tắc dưới (chỉ lô trong PC-P kỳ này, hệ T và hệ O).' },
    { kind: 'para', text: '4. Chia giá trị nhóm cho các lô nhận theo TỶ LỆ PC RM COST (cột Total Cost của PC-P), kể cả nhóm dự phòng. Lô có RM ≤ 0 không nhận. Xử lý Allocate = khớp đúng khoá; Fallback = không khớp khoá, chia cho mọi lô của nhóm lô đích (quy tắc 7 và 9, tính vào ngưỡng 5% của F-12).' },
    { kind: 'para', text: '5. RM của lô = PC RM Cost + Stock Out được phân bổ → STEP 3 (WIP) và STEP 4 (giá thành lô). Kiểm tra: nguồn = đã phân bổ + chưa phân bổ.' },
    { kind: 'gap' },
    { kind: 'section', text: 'Bảng quy tắc phân bổ (giống màn hình STEP 2)' },
    { kind: 'table', head: ['Ưu tiên', 'Nguồn', 'Điều kiện nguồn', 'Đích', 'Nhóm lô đích', 'Tiêu thức', 'Xử lý', 'Mã chi tiết'], filter: false,
      rows: [
        ...STEP2_RULES.map(([n, src, cond, tgt, lots, basis, , use]) => [n, src, cond, tgt, lots, basis, use, screenCodes(n)]),
        ['–', 'T / S / O', 'Nhóm 0 VND (R0) · Customer lạ (RX)', '–', 'Không phân bổ', '–', 'Kiểm tra', 'R0, RX'],
      ] },
  ];
  const grp = [
    { kind: 'table', filter: true, zebra: true, head: ['Hệ nguồn', 'Khoá nguồn', 'Loại khoá', 'Nhóm (S)', 'Số dòng Stock Out', 'Giá trị Stock Out NVL', 'Mã quy tắc', 'Quy tắc áp dụng', 'Hệ PC nhận', 'Điều kiện PC nhận', 'Số lô nhận', 'Đã phân bổ', 'Chưa phân bổ', 'Chênh lệch', 'Kiểm tra'],
      rows: R.groups.map((g) => [g.erp, g.key, g.type, g.fam, g.rows, M(g.src), g.code, g.rule, g.tErp, g.tKey, g.pcs, M(g.alloc), M(g.unalloc), M(g.diff), g.check]) },
  ];
  const pc = [
    { kind: 'table', filter: true, zebra: true, head: ['Hệ', 'PC No.', 'PC Date', 'MO No.', 'Sub-MO', 'Product Code', 'Product Name', 'Location', 'SL hoàn thành', 'PC RM Cost (ERP)', 'Nhận từ Stock Out T', 'Nhận từ Stock Out S', 'Nhận từ Stock Out O', 'Tổng Stock Out phân bổ', 'RM sau phân bổ', '% tăng RM', 'RM / đv sau phân bổ'],
      rows: R.pcs.map((p) => [p.erp, p.pcNo, p.date ? { v: num(p.date), z: 'dd/mm/yyyy' } : '', p.mo, p.sub, p.prod, p.name, p.loc, num(p.qty), M(p.cost), M(p.allocT), M(p.allocS), M(p.allocO), M(p.alloc), M(p.rmIncl), P(p.uplift, '0.000%'), M(p.rmUnit)]) },
  ];
  const det = [
    { kind: 'table', filter: true, zebra: true, head: ['Hệ nguồn', 'Khoá nguồn', 'Loại khoá', 'Mã quy tắc', 'Hệ PC nhận', 'PC No.', 'MO No.', 'Product Code', 'Product Name', 'PC Location', 'PC RM Cost (cơ sở chia)', 'Tỷ lệ phân bổ', 'Stock Out của nhóm nguồn', 'Stock Out phân bổ cho lô', 'Trạng thái'],
      rows: (s2.detail || []).filter((x) => x[D.pc]).map((x) => [x[D.erp], x[D.key], x[D.type], ruleOf(x[D.note]).code, x[D.tErp], x[D.pc], x[D.mo], x[D.prod], x[D.name], x[D.loc], M(x[D.cost]), P(x[D.pct], '0.0000%'), M(x[D.src]), M(x[D.alloc]), x[D.status]]) },
  ];
  const sheet = (name, title, cols, blocks, extra = {}) => ({ name, title, subtitle, cols, blocks, footer: 'STEP 2', ...extra });
  return { report: R, sheets: [
    sheet('Tổng hợp', `TỔNG HỢP PHÂN BỔ STOCK OUT · KỲ ${period}`, [60, 19, 19, 19, 13, 14, 14, 16], sum),
    sheet('Logic phân bổ', 'LOGIC PHÂN BỔ STOCK OUT VÀO LÔ PC', [10, 11, 42, 10, 30, 26, 14, 16], logic),
    sheet('Theo nhóm nguồn', 'PHÂN BỔ THEO NHÓM NGUỒN', [9, 14, 11, 10, 12, 18, 11, 44, 11, 16, 11, 18, 16, 14, 13], grp, { freeze: 4 }),
    sheet('Theo lô PC', 'PHÂN BỔ THEO LÔ PC NHẬN', [7, 15, 12, 18, 20, 18, 34, 13, 12, 17, 17, 17, 17, 19, 18, 11, 16], pc, { freeze: 4 }),
    sheet('Chi tiết phân bổ', 'CHI TIẾT PHÂN BỔ · TỪNG DÒNG NGUỒN → LÔ PC', [9, 14, 11, 10, 11, 16, 18, 18, 36, 13, 18, 12, 18, 18, 18], det, { freeze: 4 }),
  ] };
}
