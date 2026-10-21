// v1.14.93 — "Xưởng giá thành": the month-close stations as characters in a pixel office (idea from Habblaud,
// github.com/marmottajr/habblaud, MIT; no code or art copied – everything here is drawn by our own code).
// This module is pure: from the rail statuses of the period it decides what each station is doing.
//   done     – the step passed                         (ngồi thư giãn, dấu ✓)
//   review   – passed with points to review            (dấu ✓ vàng)
//   turn     – the first step not done yet: its turn   (đang gõ phím)
//   rerun    – result out of date, must be run again   (đồng hồ cát)
//   blocked  – the step is blocked / needs a decision  (đứng giơ tay "!")
//   waiting  – a later step, its inputs are not ready  (ngủ gật "z")
//   closed   – the period is closed                    (cả xưởng ✓, trưởng xưởng ăn mừng)

export const STATIONS = [
  { id: 'erp', name: 'Nhập liệu', role: 'Import ERP · 21 báo cáo', no: '1', hash: 'step1', keys: ['s1'], next: 's1', audit: /^(ERP |RESET ERP|MIGRATE|IMPORT)/ },
  { id: 'alloc', name: 'Phân bổ', role: 'Stock Out → lô PC · rework', no: '2', hash: 'step2', keys: ['s2', 'rw'], next: 's2', audit: /^(STEP 2|2B )/ },
  { id: 'wip', name: 'WIP', role: 'Opening · Material WIP · 3B', no: '3', hash: 'step3', keys: ['op', 's3', 's3b'], next: 's3', audit: /^(OPENING WIP|STEP 3|3B |PC-P COST|ERP MAP|DIRECT)/ },
  { id: 'sales', name: 'Doanh thu', role: 'Sales · giá · FX / GL', no: '4.1', hash: 'sales', keys: ['pm', 'gl'], next: '', audit: /^(SALES|SO PRICE|UPDATE PRICE|MANUAL PRICE|GL INPUT)/ },
  { id: 'cost', name: 'Giá thành', role: '622 / 627 theo lô · TP lũy kế', no: '4.3', hash: 'step4', keys: ['s4', 'fgp'], next: 's4', audit: /^STEP 4/ },
  { id: 'fifo', name: 'FIFO', role: 'FG đầu kỳ · giá vốn · rework', no: '5.2', hash: 'step5', keys: ['s5o', 's5', 'rwf'], next: '', audit: /^(STEP 5 - (RUN FIFO|IMPORT OPENING FG|VALIDATE OPENING|ROLL FORWARD)|STEP 5 (CONFIG|OVERRIDE)|REWORK)/ },
  { id: 'returns', name: 'Trả hàng', role: 'Hàng trả lại 5212 · giảm giá 5213', no: '5R', hash: 'salesreturn', keys: ['s5r'], next: '', audit: /^(RETURNS|STEP 5R)/ },
  { id: 'prov', name: 'Dự phòng', role: 'Dự phòng FG · TK 2294', no: '5P', hash: 'provision', keys: ['prov'], next: '', audit: /^(NRV|STEP 5 - (CARRY|IMPORT) OPENING PROVISION)/ },
  { id: 'close', name: 'Trưởng xưởng', role: 'FG History · FAST · đóng kỳ', no: '5.3', hash: 'close', keys: ['s5c'], next: 's5', audit: /^(STEP 5 - (BUILD FG HISTORY|CLOSE|REOPEN)|FAST TIE)/ },
];

export const STATE_LABEL = {
  done: 'Xong', review: 'Xong – cần rà soát', turn: 'Đến lượt', rerun: 'Phải chạy lại', blocked: 'Cần xử lý', waiting: 'Đang chờ bước trước', closed: 'Đã đóng kỳ',
};

/** One station's own state from its status classes ('s-pass' | 's-review' | 's-block' | 's-rerun' | 's-info' | 's-none'). */
export function ownState(statuses, cls) {
  const c = statuses.map((s) => ({ s: String(s || ''), c: cls(s) }));
  if (c.some((x) => x.c === 's-block')) return 'blocked';
  if (c.some((x) => x.c === 's-rerun' && !/^(NOT RUN|NOT IMPORTED|NOT VALIDATED|NOT LOADED)$/i.test(x.s))) return 'rerun';
  if (c.some((x) => x.c === 's-none' || (x.c === 's-rerun'))) return 'todo';
  if (c.some((x) => x.c === 's-review')) return 'review';
  return 'done';
}

/** Latest audit event of a station (the audit list is newest first). */
export function lastEvent(audit, re) {
  const e = (audit || []).find((a) => a && re.test(String(a.action || '')));
  return e ? { by: e.user || '', at: e.at || '', action: e.action } : null;
}

/**
 * x = { rail: {key: status}, labels: {key: label}, next: {s1|s2|s3|s4|s5: text}, audit: [...], closed: bool, cls: statusClass }
 * → { stations: [{...station, state, statuses: [[label, status]], next, last}], summary: {done, total, blocked, turn} }
 */
export function workshopModel(x) {
  const cls = x.cls;
  let turnGiven = false;
  const stations = STATIONS.map((st) => {
    const statuses = st.keys.map((k) => [(x.labels && x.labels[k]) || k, (x.rail && x.rail[k]) || 'NOT RUN']);
    let state = x.closed ? 'closed' : ownState(statuses.map((s) => s[1]), cls);
    // a step whose earlier steps are not done waits for them (a BLOCK there usually only means "inputs missing");
    // the first step not done is the one up next, blocked or to be rerun
    if (['todo', 'blocked', 'rerun'].includes(state)) { state = turnGiven ? 'waiting' : state === 'todo' ? 'turn' : state; turnGiven = true; }
    return { ...st, state, statuses, next: st.next && x.next ? x.next[st.next] || '' : '', last: lastEvent(x.audit, st.audit) };
  });
  const done = stations.filter((s) => ['done', 'review', 'closed'].includes(s.state)).length;
  return { stations, summary: { done, total: stations.length, blocked: stations.filter((s) => s.state === 'blocked').length, rerun: stations.filter((s) => s.state === 'rerun').length, turn: (stations.find((s) => s.state === 'turn') || {}).name || '' } };
}
