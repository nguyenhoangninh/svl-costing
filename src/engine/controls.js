// Control Center checkpoints (port of 00_CONTROL_CENTER formulas rows 9-70)
import { ttxt } from './util.js';

const abs = Math.abs;
function overall(rows, nextOk, nextBad) {
  const st = rows.map((r) => r.status);
  const ok = st.filter((s) => s === 'PASS' || s === 'CURRENT' || s === 'INFO').length;
  const has = (p) => st.some((s) => s.startsWith(p));
  const status = has('BLOCK') || has('CHECK') ? 'BLOCK'
    : st.some((s) => s === 'NOT RUN') || has('RERUN') ? 'RERUN REQUIRED'
      : has('REVIEW') ? 'PASS WITH REVIEW' : 'PASS';
  return { okText: `${ok} / ${rows.length} OK`, status, next: status.startsWith('PASS') ? nextOk : nextBad };
}
const cp = (no, label, expected, actual, diff, status, rule) => ({ no, label, expected, actual, diff, status, rule });
const later = (a, b) => (a || '') >= (b || ''); // ISO timestamps

export function step1Controls(s1, accessLimited = 0) {
  const imported = s1.checklist.filter((c) => c.status === 'IMPORTED').length;
  const noData = s1.checklist.filter((c) => c.status === 'NO DATA').length;
  const missing = 21 - imported - noData;
  const sysReady = Object.values(s1.bySys).filter((s) => s.status === 'READY').length;
  return {
    coreReady: `${imported + noData} / 21`, sysReady: `${sysReady} / 3`,
    status: sysReady === 3 && imported + noData === 21 ? 'PASS' : missing === 21 ? 'NOT RUN' : 'REVIEW',
    imported, noData, missing, totalRows: s1.checklist.reduce((a, c) => a + c.dataRows, 0), accessLimited,
    next: missing === 0 ? 'Chạy STEP 2' : 'Import các báo cáo còn thiếu',
    result: missing === 0 ? 'PASS' : missing === 21 ? 'NOT RUN' : 'REVIEW',
  };
}

export function step2Controls(st) {
  const { period, step2: s2, register: reg, latestImport } = st;
  if (!s2) return { rows: [], okText: '0 / 10 OK', status: 'NOT RUN', next: 'Chạy STEP 2 – Phân bổ Stock Out' };
  const t = s2.total;
  const curRows = reg ? reg.rows.filter((r) => r.active === 'Y') : [];
  const fgQty = reg ? reg.rows.reduce((a, r) => a + (+r.issueQty || 0), 0) : 0;
  const fgAmt = reg ? reg.rows.reduce((a, r) => a + (+r.erpRef || 0), 0) : 0;
  const blocks = reg ? reg.rows.filter((r) => String(r.inputCheck || '').startsWith('BLOCK')).length : 0;
  const rows = [
    cp('01', 'Source = Allocated + Unallocated', t.src, t.alloc + t.unalloc, t.alloc + t.unalloc - t.src, abs(t.alloc + t.unalloc - t.src) < 0.01 ? 'PASS' : 'CHECK', 'STOCK OUT ALLOCATION – dòng TOTAL'),
    cp('02', 'Stock Out chưa phân bổ', 0, t.unalloc, t.unalloc, abs(t.unalloc) < 0.01 ? 'PASS' : 'REVIEW', 'Phải bằng 0'),
    cp('03', 'Trạng thái engine phân bổ', 'PASS', s2.status, '', s2.status === 'PASS' ? 'PASS' : 'CHECK', 'Kết quả engine STEP 2'),
    cp('04', 'Kỳ STEP 2 = kỳ báo cáo', period, s2.period, '', s2.period === period ? 'PASS' : 'BLOCK', 'Chặn lệch kỳ'),
    cp('05', 'Freshness: chạy sau import ERP', latestImport, s2.runAt, '', !s2.runAt ? 'NOT RUN' : later(s2.runAt, latestImport) ? 'CURRENT' : 'RERUN STEP 2', 'Expected = import ERP gần nhất | Actual = lần chạy STEP 2'),
    cp('06', '2B · Số dòng FG Stock Out (Rework)', 'INFO', curRows.length, '', 'INFO', 'FG xuất kho không phải NVL – chuyển sang Rework FIFO'),
    cp('07', '2B · Số lượng FG xuất (nguồn Rework)', 'INFO', fgQty, '', 'INFO', 'Register cột Issue Qty'),
    cp('08', '2B · Giá trị FG theo ERP (memo)', 'MEMO', fgAmt, '', 'INFO', 'Không phải cơ sở định giá – FIFO ở STEP 5B'),
    cp('09', '2B · Dòng Rework bị BLOCK', 0, blocks, blocks, blocks === 0 ? 'PASS' : 'BLOCK', 'Register cột Input Check'),
    cp('10', '2B · Register cập nhật sau STEP 2', s2.runAt, reg ? reg.refreshedAt : '', '', !reg || !reg.refreshedAt ? (curRows.length === 0 ? 'PASS' : 'NOT RUN') : later(reg.refreshedAt, s2.runAt) ? 'CURRENT' : 'RERUN STEP 2', 'Expected = lần chạy STEP 2 | Actual = cập nhật register'),
  ];
  return { rows, ...overall(rows, 'Chạy STEP 3 – Material WIP', 'Xử lý các checkpoint STEP 2 rồi chạy lại STEP 2') };
}

export function step3Controls(st) {
  const { period, opening: op, step3: s3, step2: s2 } = st;
  const opStatus = op ? op.status || 'NOT VALIDATED' : 'NO DATA';
  const opAmt = op && op.stats ? op.stats.totalAmt : 0;
  const rows = [
    cp('01', 'Trạng thái Opening WIP', 'READY', opStatus, '', opStatus === 'READY' ? 'PASS' : opStatus.includes('READY') ? 'REVIEW' : 'BLOCK', 'Kết quả validate WIP_OPENING'),
    cp('02', 'Kỳ Opening WIP = kỳ báo cáo', period, op ? op.period : '', '', op && op.period === period ? 'PASS' : 'BLOCK', 'Chặn lệch kỳ'),
  ];
  if (!s3) {
    rows.push(cp('03', 'Opening WIP dùng trong STEP 3', opAmt, '', '', 'NOT RUN', 'WIP_OPENING = opening của Material WIP'));
    return { rows, okText: `${rows.filter((r) => r.status === 'PASS').length} / 10 OK`, status: 'NOT RUN', next: 'Chạy STEP 3 – Material WIP' };
  }
  const S = s3.summary, c = s3.checks;
  const exp6 = S.opening + S.inAmt - S.outAmt;
  rows.push(
    cp('03', 'Opening WIP dùng trong STEP 3', opAmt, S.opening, S.opening - opAmt, abs(S.opening - opAmt) < 1 ? 'PASS' : 'RERUN STEP 3', 'WIP_OPENING = opening của Material WIP'),
    cp('04', 'WIP vào (MI + Stock Out)', 'INFO', S.inAmt, '', 'INFO', 'Material WIP'),
    cp('05', 'WIP ra (PC + MR + Stock Out)', 'INFO', S.outAmt, '', 'INFO', 'Material WIP'),
    cp('06', 'Closing WIP ERP = Opening + Vào − Ra', exp6, S.closingAmt, S.closingAmt - exp6, abs(S.closingAmt - exp6) < 1 ? 'PASS' : 'CHECK', 'Roll-forward trước STEP 3B'),
    cp('07', 'Stock Out khớp STEP 2', 0, c.soVsStep2.value, c.soVsStep2.value, c.soVsStep2.status, 'Đối chiếu độc lập với STEP 2'),
    cp('08', 'Chi phí NVL PC-M vs PC-P', 0, c.pcmVsPcp.value, c.pcmVsPcp.value, c.pcmVsPcp.status, 'Đối chiếu độc lập PC-M ↔ PC-P'),
    cp('09', 'Ngoại lệ cần review', 0, c.exceptions.value, c.exceptions.value, c.exceptions.value === 0 ? 'PASS' : 'REVIEW', 'Số lượng âm / thiếu master data'),
    cp('10', 'Kỳ & freshness', period, s3.period, '', s3.period !== period ? 'BLOCK' : later(s3.runAt, s2 ? s2.runAt : '') && later(s3.runAt, op ? op.changedAt || '' : '') ? 'CURRENT' : 'RERUN STEP 3', 'Chạy sau STEP 2 và sau mọi thay đổi Opening WIP'),
  );
  return { rows, ...overall(rows, 'Chạy STEP 3B – Điều chỉnh WIP trực tiếp (giai đoạn 2)', 'Xử lý các checkpoint STEP 3A, chạy lại STEP 3') };
}

/** Rows whose first column says the ERP user lacked access rights (Control Center M22). */
export function accessLimitedCount(datasets) {
  let n = 0;
  for (const ds of Object.values(datasets || {})) for (const r of ds.rows || []) if (ttxt(r[0]).toLowerCase().includes('access right')) n++;
  return n;
}
