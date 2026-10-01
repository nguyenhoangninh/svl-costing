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
  return { rows, ...overall(rows, 'Chạy STEP 3B – Điều chỉnh WIP trực tiếp', 'Xử lý các checkpoint STEP 3A, chạy lại STEP 3') };
}

/** Rows whose first column says the ERP user lacked access rights (Control Center M22). */
export function accessLimitedCount(datasets) {
  let n = 0;
  for (const ds of Object.values(datasets || {})) for (const r of ds.rows || []) if (ttxt(r[0]).toLowerCase().includes('access right')) n++;
  return n;
}

/** STEP 3B checkpoints (00_CONTROL_CENTER rows 75-95). x = derived 3B context from the app. */
export function step3bControls(x) {
  const { period, input, inputD, engine, engDyn, detail, control, reg632, wf, balancePass, step3, step4Posted } = x;
  const TOLA = 1;
  const inN = (input || []).filter((r) => ttxt(r.code)).length;
  const blocksIn = (inputD || []).filter((r) => String(r.check).startsWith('BLOCK')).length;
  const rowsC = control ? control.rows : [];
  const passC = rowsC.filter((r) => r.status === 'PASS').length;
  const approve = rowsC.filter((r) => String(r.decision).toUpperCase() === 'APPROVE').length;
  const holdRev = rowsC.filter((r) => ['HOLD', 'REVIEW'].includes(String(r.decision).toUpperCase())).length;
  const blankDec = rowsC.filter((r) => !ttxt(r.decision)).length;
  const sumZ = rowsC.reduce((a, r) => a + (+r.wipPostAmt || 0), 0);
  const sumAB = rowsC.reduce((a, r) => a + (+r.pcPostAmt || 0), 0);
  const sumABnon632 = rowsC.filter((r) => r.method !== 'DIRECT_632').reduce((a, r) => a + (+r.pcPostAmt || 0), 0);
  const engPosted = (engDyn || []).filter((e) => e.Y === 'Y').reduce((a, e) => a + e.AA, 0);
  const shareBad = rowsC.filter((r) => r.method !== 'DIRECT_632' && Math.abs((+r.share || 0) - 1) > 0.000001).length;
  const pending632 = (reg632 || []).filter((r) => r.record === 'READY FOR ACCOUNTING' || r.record === 'PENDING RECORD INFO').length;
  const builtAt = control ? control.builtAt : '', appliedAt = control ? control.appliedAt : '';
  const d84 = passC === 0 || approve === passC ? 'PASS' : blankDec > 0 ? 'REVIEW - DECISION MISSING' : approve === 0 ? 'REVIEW - NO ADJ (HOLD)' : 'REVIEW - PARTIAL APPROVE';
  const postedOK = rowsC.filter((r) => r.postCheck === 'POSTED PASS' || r.postCheck === '632 REGISTER READY').length;
  const fresh = !builtAt ? 'NOT RUN' : step3 && builtAt < step3.runAt ? 'RERUN BUILD' : approve === 0 && !rowsC.some((r) => r.gate === 'READY TO POST') ? 'CURRENT' : (appliedAt || '') < builtAt ? 'RERUN APPLY' : 'CURRENT';
  const rows = [
    cp('01', 'Kỳ INPUT = kỳ báo cáo', period, step3 ? step3.period : '', '', step3 && step3.period === period ? 'PASS' : 'BLOCK', '03_WIP_DIRECT_ADJ_INPUT B2'),
    cp('02', 'Số vật tư trong INPUT', '> 0', inN, '', inN > 0 ? 'PASS' : 'NOT RUN', 'Vật tư WIP âm đưa vào INPUT'),
    cp('03', 'Dòng INPUT bị BLOCK', 0, blocksIn, blocksIn, blocksIn === 0 ? 'PASS' : 'BLOCK', 'INPUT cột Input Check'),
    cp('04', 'Kỳ cơ sở ENGINE', period, engine ? engine.period : '', '', engine && engine.period === period ? 'PASS' : 'RERUN ENGINE', 'Tự dựng lại từ PC-M / PC-P khi BUILD'),
    cp('05', 'Số dòng DETAIL', '> 0', detail ? detail.length : 0, '', detail && detail.length ? 'PASS' : 'RERUN BUILD', 'Chạy 1 BUILD / REFRESH'),
    cp('06', 'Dòng DETAIL bị BLOCK', 0, (detail || []).filter((d) => String(d.status).startsWith('BLOCK')).length, '', (detail || []).some((d) => String(d.status).startsWith('BLOCK')) ? 'BLOCK' : 'PASS', 'Share = 0 / ERP amount = 0'),
    cp('07', 'CONTROL PASS = số vật tư INPUT', inN, passC, passC - inN, passC === inN ? 'PASS' : rowsC.some((r) => String(r.status).startsWith('BLOCK')) ? 'BLOCK' : 'REVIEW', 'CONTROL cột Control Status'),
    cp('08', 'Tỷ lệ phân bổ <> 100% (dòng)', 0, shareBad, shareBad, shareBad === 0 ? 'PASS' : 'BLOCK', 'Share phải bằng 100%'),
    cp('09', 'Chiều số dư', rowsC.length, balancePass, balancePass - rowsC.length, balancePass === rowsC.length ? 'PASS' : 'REVIEW', 'Điều chỉnh phải làm giảm |WIP ERP|'),
    cp('10', 'Quyết định người duyệt (APPROVE / HOLD)', passC, approve, approve - passC, d84, 'APPROVE = post | HOLD / REVIEW = không điều chỉnh'),
    cp('11', 'Đã APPROVE nhưng chưa APPLY', 0, rowsC.filter((r) => r.gate === 'APPROVED - AWAIT APPLY').length, '', rowsC.some((r) => r.gate === 'APPROVED - AWAIT APPLY') ? 'RERUN APPLY' : 'PASS', 'Chạy 2 APPLY & SYNC'),
    cp('12', 'Posted PASS / sổ 632', approve, postedOK, postedOK - approve, rowsC.some((r) => r.postCheck === 'POST CHECK') ? 'CHECK' : postedOK === approve ? 'PASS' : 'RERUN APPLY', 'CONTROL cột Post Check'),
    cp('13', 'CONTROL: vế WIP + vế PC = 0', 0, sumZ + sumAB, sumZ + sumAB, Math.abs(sumZ + sumAB) <= TOLA ? 'PASS' : 'CHECK', 'CONTROL Z + AB'),
    cp('14', 'WIP_ALLOCATION = vế WIP CONTROL', sumZ, wf ? wf.approvedAdj : 0, (wf ? wf.approvedAdj : 0) - sumZ, Math.abs((wf ? wf.approvedAdj : 0) - sumZ) <= TOLA ? 'PASS' : 'CHECK', '03_WIP_ALLOCATION cột Direct Adj Amount'),
    cp('15', 'ENGINE → PC = vế PC CONTROL ★', sumABnon632, engPosted, engPosted - sumABnon632, Math.abs(engPosted - sumABnon632) <= TOLA ? 'PASS' : 'BLOCK', 'Số thực sự vào PC-P'),
    cp('16', 'WIP cuối = Closing ERP + điều chỉnh', wf ? wf.erpClosing + wf.approvedAdj : 0, wf ? wf.finalClosing : 0, wf ? wf.bridge : 0, wf && wf.bridgeStatus === 'PASS' ? 'PASS' : 'CHECK', 'Final Closing WIP'),
    cp('17', 'Vật tư WIP âm còn lại', 0, wf ? wf.negFinal : 0, wf ? wf.negFinal : 0, wf && wf.negFinal === 0 ? 'PASS' : 'REVIEW', 'Final closing qty < 0'),
    cp('18', 'STEP 4 nhận = ENGINE posted', engPosted, step4Posted ?? '', step4Posted === undefined || step4Posted === null ? '' : step4Posted - engPosted, step4Posted !== undefined && step4Posted !== null && Math.abs(step4Posted - engPosted) <= TOLA ? 'PASS' : 'RERUN STEP 4', 'Snapshot lần chạy STEP 4'),
    cp('19', 'DIRECT_632 chờ ghi sổ', 0, pending632, pending632, pending632 === 0 ? 'PASS' : 'REVIEW', 'Ghi Nợ/Có 632 trên FAST'),
    cp('20', 'Freshness: Build ≥ STEP 3, Apply ≥ Build', step3 ? step3.runAt : '', appliedAt || builtAt, '', fresh, 'Expected = STEP 3 | Actual = lần Apply'),
  ];
  const o = overall(rows, '', '');
  const s = (i) => rows[i].status;
  let next;
  if (s(19) === 'NOT RUN') next = 'Chạy 1 BUILD / REFRESH';
  else if (s(3) !== 'PASS') next = 'Chạy 1 BUILD (tự dựng lại ENGINE)';
  else if (s(0) !== 'PASS' || s(1) !== 'PASS' || s(2) !== 'PASS') next = 'Sửa INPUT';
  else if (s(4) !== 'PASS' || s(19) === 'RERUN BUILD') next = 'Chạy 1 BUILD / REFRESH';
  else if ([5, 6, 7, 8].some((i) => s(i) !== 'PASS')) next = 'Xử lý BLOCK trong CONTROL';
  else if (s(9) === 'REVIEW - DECISION MISSING') next = 'Người duyệt: APPROVE / HOLD trong CONTROL';
  else if (s(10) !== 'PASS' || s(11) !== 'PASS' || s(19) === 'RERUN APPLY') next = 'Chạy 2 APPLY & SYNC';
  else if ([12, 13, 14, 15].some((i) => s(i) !== 'PASS')) next = 'Kiểm tra cầu nối posting (13-16)';
  else if (s(17) !== 'PASS') next = 'Chạy STEP 4';
  else if (s(16) !== 'PASS' || s(18) !== 'PASS') next = approve === 0 ? 'HOLD – không điều chỉnh WIP. Chạy STEP 4' : 'Xem lại WIP âm còn lại / sổ 632';
  else next = 'Chạy STEP 4';
  return { rows, okText: o.okText, status: o.status, next, approve, holdRev };
}

/** STEP 4 checkpoints (00_CONTROL_CENTER rows 101-114). */
export function step4Controls(x) {
  const { period, salesImport, pm, gl, s4, fl, freshness, engPosted, registerCarry } = x;
  const stg = salesImport && salesImport.rows ? salesImport.rows.length : 0;
  const saved = salesImport && String(salesImport.status).includes('SAVED');
  const missing = pm ? pm.rows.filter((r) => r.status === 'MISSING PRICE').length : '';
  const glReady = gl && gl.period === period && s4 && !s4.blocked;
  const rec = s4 && s4.recon ? s4.recon.rows : [];
  const r8 = rec[4], r12 = rec[8], r13 = rec[9];
  const t = fl ? fl.totals : null;
  const step4Adj = t ? t.wipAdj : null;
  const carryCA = t ? t.carryIn : 0;
  const build = r8 && t ? r8.result + r12.result + r13.result + t.wipAdj + t.carryIn : null;
  const rows = [
    cp('01', 'Doanh thu đã Validate & Save', 'SAVED', saved ? 'SAVED' : salesImport ? salesImport.status : '', '', saved || stg === 0 ? 'PASS' : 'REVIEW', 'Trạng thái import doanh thu'),
    cp('02', 'Price Master cập nhật', 'CURRENT', pm ? pm.status : '', '', pm && pm.status === 'CURRENT' ? 'PASS' : 'BLOCK', 'Chạy UPDATE PRICE sau khi lưu doanh thu'),
    cp('03', 'Sản phẩm thiếu giá', 0, missing, missing, missing === 0 ? 'PASS' : 'BLOCK', 'Price Master cột Status'),
    cp('04', 'Kỳ FX / GL 622-627', period, gl ? gl.period : '', '', glReady ? 'PASS' : 'BLOCK', 'GL Input READY'),
    cp('05', 'Tổng RM (PC RM + Stock Out)', r8 ? r8.expected : '', r8 ? r8.result : '', r8 ? r8.diff : '', r8 ? r8.status : 'NOT RUN', 'Đối chiếu dòng 8'),
    cp('06', 'Đã phân bổ GL 622', r12 ? r12.expected : '', r12 ? r12.result : '', r12 ? r12.diff : '', r12 ? r12.status : 'NOT RUN', 'Đối chiếu dòng 12'),
    cp('07', 'Đã phân bổ GL 627', r13 ? r13.expected : '', r13 ? r13.result : '', r13 ? r13.diff : '', r13 ? r13.status : 'NOT RUN', 'Đối chiếu dòng 13'),
    cp('08', 'Điều chỉnh STEP 3B vào giá thành', engPosted, step4Adj ?? '', step4Adj === null ? '' : step4Adj - engPosted, step4Adj !== null && Math.abs(step4Adj - engPosted) <= 1 ? 'PASS' : 'RERUN STEP 4', 'ENGINE posted'),
    cp('09', 'Rework hoàn thành chuyển vào (carry-in)', registerCarry, carryCA, carryCA - registerCarry, Math.abs(carryCA - registerCarry) <= 1 ? 'PASS' : 'CHECK', 'Sổ rework ↔ cột AP'),
    cp('10', 'Cấu thành giá: RM+622+627+3B+Rework', build ?? '', t ? t.totalCost : '', build === null ? '' : t.totalCost - build, build !== null && Math.abs(t.totalCost - build) <= 1 ? 'PASS' : s4 ? 'CHECK' : 'NOT RUN', 'Tính lại độc lập'),
    cp('11', 'Tổng giá thành sản xuất', fl ? fl.step5Row.expected : '', fl ? fl.step5Row.result : '', fl ? fl.step5Row.diff : '', fl ? fl.step5Row.status : 'NOT RUN', 'Đối chiếu dòng 17'),
    cp('12', 'Tất cả cầu nối STEP 4', 'All bridges', fl ? fl.overall : '', '', fl ? fl.overall : 'NOT RUN', '04_RECONCILIATION E18'),
    cp('13', 'Freshness (snapshot vs dữ liệu vào)', 'CURRENT', freshness, '', freshness === 'CURRENT' ? 'CURRENT' : freshness === 'NOT RUN' ? 'NOT RUN' : 'RERUN STEP 4', 'Chạy lại STEP 4 khi dữ liệu trước đó thay đổi'),
  ];
  const o = overall(rows, '', '');
  const s = (i) => rows[i].status;
  const next = s(0) !== 'PASS' ? 'Validate & lưu doanh thu' : s(1) !== 'PASS' || s(2) !== 'PASS' ? 'Chạy UPDATE PRICE / xử lý giá thiếu' : s(3) !== 'PASS' && !s4 ? 'Nhập FX / GL rồi chạy STEP 4' : s(3) !== 'PASS' ? 'Hoàn tất FX / GL' : s(12) !== 'CURRENT' || s(7) !== 'PASS' ? 'Chạy STEP 4' : o.status.startsWith('PASS') ? 'Chạy STEP 5 – FIFO COGS (giai đoạn 3)' : 'Xem lại cầu nối STEP 4';
  return { rows, okText: o.okText, status: o.status, next };
}
