// Phase 2 views: STEP 3B (Direct WIP Adjustment), STEP 4 (Sales / Price Master, FX-GL, Cost Allocation).
import * as B from '../engine/step3b.js';
import * as F from '../engine/step4.js';
import { step2Controls, step3Controls, step3bControls, step4Controls } from '../engine/controls.js';
import { num, ttxt, txt, utxt, serialToISO, nowISO, isoToSerial, fpRows } from '../engine/util.js';
import { RW_FIELDS } from '../engine/step2.js';
import { splitBooks } from '../engine/revenue.js';
import { revenueBooks } from '../engine/step5.js';

let A = null; // app API
export function install(api) { A = api; }
const esc = (s) => A.esc(s);

// ======================= derived state =======================
export function derive(S) {
  const d = S.d; const period = S.period;
  const out = { d3b: null, d4: null };
  const w = d.wipadj || {};
  if (d.step3) {
    const inputD = B.deriveInput(w.input || [], d.erpMap, d.step3, period);
    const engDyn = w.engine ? B.engineDynamic(w.engine, inputD, w.control) : [];
    const wf = B.wipFinal(d.step3, w.control, d.erpMap);
    const posted = B.postedByLot(engDyn);
    let engPosted = 0; for (const v of posted.values()) engPosted += v.amt;
    const balancePass = w.control ? B.balancePassCount(w.control, d.step3) : 0;
    const step4Posted = d.step4 && d.step4.snap ? d.step4.snap.posted3B : null;
    const buildStale = !!(w.control && w.control.fp && w.control.fp !== B.buildFingerprint(w.input, d.erpMap, d.step2, d.step3, B.basisOf(w)));
    const controls = step3bControls({ erpMap: d.erpMap, period, input: w.input, inputD, engine: w.engine, engDyn, detail: w.detail, control: w.control, reg632: w.reg632, wf, balancePass, step3: d.step3, step4Posted, buildStale });
    out.d3b = { inputD, engDyn, wf, posted, engPosted, balancePass, controls, buildStale };
  }
  const s4 = d.step4;
  const fl = s4 && !s4.blocked && out.d3b ? F.finalLayer(s4, out.d3b.posted, d.register) : null;
  const registerCarry = d.register ? d.register.rows.reduce((a, r) => a + num(r.carryIn), 0) : 0;
  const freshness = step4Freshness(S, out.d3b);
  const controls = step4Controls({ period, salesImport: d.salesImport, pm: d.pm, gl: d.gl, s4, fl, freshness, engPosted: out.d3b ? out.d3b.engPosted : 0, registerCarry });
  out.d4 = { fl, freshness, controls, registerCarry };
  return out;
}

function directTotals(list) {
  let d622 = 0, d627 = 0, n = 0;
  for (const r of list || []) { if (utxt(r.active) !== 'Y') continue; n++; const acc = Math.trunc(num(r.account)); if (acc === 622) d622 += num(r.amount); if (acc === 627) d627 += num(r.amount); }
  return { d622, d627, n };
}
/** Audit F-02: which PC / product each active direct 622/627 row goes to – not only the totals. */
export const directKey = (list) => fpRows((list || []).filter((r) => utxt(r.active) === 'Y'), (r) => [utxt(r.erp), Math.trunc(num(String(r.account ?? '').replace(/[^\d.-]/g, ''))), utxt(r.pc), utxt(r.prod), num(r.amount).toFixed(2)].join('|'));
export const postedKey = (posted) => fpRows([...(posted || new Map()).entries()], ([k, v]) => `${k}|${num(v.amt).toFixed(2)}`);
function currentSnap(S, d3b) {
  const d = S.d; const dt = directTotals(d.directAdj);
  return {
    period: S.period, latestImport: A.latestImport(), step2RunAt: d.step2 ? d.step2.runAt : '', step3RunAt: d.step3 ? d.step3.runAt : '',
    dbSavedAt: d.salesDB ? d.salesDB.savedAt : '', pmUpdatedAt: d.pm ? d.pm.updatedAt : '', glPeriod: d.gl ? d.gl.period : '',
    fx: d.gl ? num(d.gl.fx) : 0, gl622: d.gl ? num(d.gl.gl622) : 0, gl627: d.gl ? num(d.gl.gl627) : 0, direct622: dt.d622, direct627: dt.d627, activeDirect: dt.n, posted3B: d3b ? d3b.engPosted : 0,
    directKey: directKey(d.directAdj), posted3BKey: d3b ? postedKey(d3b.posted) : '',
  };
}
/** Why STEP 4 must be rerun, or '' (F-01: covers the whole upstream chain, not only Step 4's own snapshot). */
export function step4StaleReason(S, d3b) {
  const d = S.d; const s4 = d.step4; if (!s4 || !s4.snap) return '';
  const ctx = { period: S.period, step2: d.step2, register: d.register, latestImport: A.latestImport(), opening: d.opening, step3: d.step3 };
  const s2 = step2Controls(ctx).status, s3 = step3Controls(ctx).status;
  if (String(s2).startsWith('RERUN') || String(s2).startsWith('BLOCK')) return `STEP 2 = ${s2}`;
  if (String(s3).startsWith('RERUN') || String(s3).startsWith('BLOCK')) return `STEP 3A = ${s3}`;
  if (d3b && d3b.buildStale) return 'STEP 3B: INPUT / ERP map đã đổi sau BUILD';
  const dag = directApprovalBlock(S); if (dag) return dag;
  if (!d.pm || d.pm.status !== 'CURRENT') return `Price Master = ${d.pm ? d.pm.status : 'chưa cập nhật'}`;
  return '';
}
function step4Freshness(S, d3b) {
  const s4 = S.d.step4; if (!s4 || !s4.snap) return 'NOT RUN';
  if (step4StaleReason(S, d3b)) return 'OUTDATED - RERUN REQUIRED';
  const c = currentSnap(S, d3b), p = s4.snap;
  const same = c.period === p.period && c.latestImport === p.latestImport && c.step2RunAt === p.step2RunAt && c.step3RunAt === p.step3RunAt && c.dbSavedAt === p.dbSavedAt && c.pmUpdatedAt === p.pmUpdatedAt
    && c.glPeriod === p.glPeriod && c.fx === p.fx && c.gl622 === p.gl622 && c.gl627 === p.gl627 && Math.abs(c.direct622 - p.direct622) <= 1 && Math.abs(c.direct627 - p.direct627) <= 1 && c.activeDirect === p.activeDirect && Math.abs(c.posted3B - p.posted3B) <= 1
    && (p.directKey === undefined || c.directKey === p.directKey); // snapshots saved before v1.7 have no key
  return same ? 'CURRENT' : 'OUTDATED - RERUN REQUIRED';
}

// ======================= small editable list =======================
function editList(el, cfg) {
  const { columns, rows, onChange, newRow, addLabel, readOnly } = cfg;
  const draw = () => {
    el.innerHTML = `<div class="el-wrap"><table class="cp el"><thead><tr>${columns.map((c) => `<th${c.num ? ' class="r"' : ''}>${esc(c.label)}</th>`).join('')}${readOnly ? '' : '<th></th>'}</tr></thead><tbody>
      ${rows.length ? rows.map((r, i) => `<tr data-i="${i}">${columns.map((c) => {
        const v = r[c.key];
        if (readOnly || c.ro) return `<td${c.num ? ' class="r"' : ''}>${c.status ? A.pill(v) : c.date ? esc(typeof v === 'number' ? serialToISO(v) : v ?? '') : c.num && typeof v === 'number' ? A.fmtNum(v, 2) : esc(v ?? '')}</td>`;
        if (c.options) return `<td><select data-k="${c.key}" aria-label="${esc(c.label)}">${['', ...c.options].map((o) => `<option ${String(v ?? '') === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
        return `<td><input data-k="${c.key}" ${c.date ? 'type="date"' : c.num ? 'inputmode="decimal"' : ''} value="${esc(c.date ? (typeof v === 'number' ? serialToISO(v) : v ?? '') : v ?? '')}" aria-label="${esc(c.label)}"></td>`;
      }).join('')}${readOnly ? '' : '<td class="r"><button class="btn ghost sm danger" type="button" data-del title="Xoá dòng">Xoá</button></td>'}</tr>`).join('') : `<tr><td colspan="${columns.length + 1}" class="muted">Chưa có dòng nào.</td></tr>`}
    </tbody></table></div>${readOnly ? '' : `<button class="btn ghost sm" type="button" data-add>${esc(addLabel || 'Thêm dòng')}</button>`}`;
  };
  draw();
  el.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-k]'); if (!inp) return;
    const r = rows[+inp.closest('tr').dataset.i]; const c = columns.find((x) => x.key === inp.dataset.k);
    if (!A.guardEdit()) { draw(); return; }
    let val = inp.value;
    if (c.num) { val = A.parseNum(inp.value, c.label); if (val === undefined) { draw(); return; } }
    r[c.key] = c.date ? (inp.value ? isoToSerial(inp.value) : null) : val;
    onChange(rows, r, c.key);
  });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-del]')) { if (!A.guardEdit()) return; rows.splice(+e.target.closest('tr').dataset.i, 1); onChange(rows); draw(); }
    if (e.target.closest('[data-add]')) { if (!A.guardEdit()) return; rows.push(newRow()); onChange(rows); draw(); }
  });
}

const tabsHTML = (cur, tabs, attr) => `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="tab ${id === cur ? 'on' : ''}" ${attr}="${id}" aria-selected="${id === cur}">${esc(label)}</button>`).join('')}</div>`;

// ======================= STEP 3B view =======================
export function view3b(el) {
  const S = A.S; const d = S.d; const D = A.derived().d3b;
  const w = d.wipadj || { input: [] };
  if (!d.step3 || !D) { el.innerHTML = `<section class="page"><h1>STEP 3B · Điều chỉnh WIP trực tiếp</h1>${A.emptyNote('Cần chạy STEP 3A (Material WIP) trước.', 'step3', 'Mở STEP 3A')}</section>`; return; }
  const c = D.controls; const sync = B.inputSyncCheck(w.input, d.step3);
  const tab = S.tab3b || 'control';
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 3B · Điều chỉnh WIP trực tiếp</h1><p class="lead">Dọn WIP âm / tồn dư: vật tư âm được phân bổ vào lô PC theo tỷ lệ tiêu hao thực tế (ACTUAL_USAGE), theo giá trị RM trong cùng ERP (ERP_AMOUNT) hoặc chuyển thẳng 632 (DIRECT_632). Quy tắc hạch toán: WIP = −Basis, PC = +Basis.</p></div>
      <div class="result"><span>Kết quả</span>${A.pill(c.status)}<small>${esc(c.okText)}</small></div></header>
    <div class="row">
      <button class="btn ghost" data-act="3b-sync" type="button">Đồng bộ INPUT với WIP âm${sync.inSync ? '' : ' •'}</button>
      <label>Phân bổ ACTUAL_USAGE <select id="b3-basis" ${A.canEdit() ? '' : 'disabled'}><option value="AMOUNT" ${B.basisOf(w) === 'AMOUNT' ? 'selected' : ''}>theo giá trị tiêu hao (PC-M Total Cost)</option><option value="QTY" ${B.basisOf(w) === 'QTY' ? 'selected' : ''}>theo số lượng (như Excel cũ)</option></select></label>
      <button class="btn" data-act="3b-build" type="button">1 · BUILD / REFRESH</button>
      <button class="btn" data-act="3b-apply" type="button">2 · APPLY &amp; SYNC</button>
      <span class="muted">Build ${A.fmtTs(w.control && w.control.builtAt)} · Apply ${A.fmtTs(w.control && w.control.appliedAt)}${w.control && w.control.noAdj ? ` · Đóng không điều chỉnh: ${esc(w.control.noAdj.reason)}` : ''}</span>
    </div>
    ${sync.inSync ? '' : `<div class="alert review">INPUT chưa khớp WIP âm hiện tại: thiếu ${sync.added}, thừa ${sync.removed}, basis khác ${sync.basisDiff}. Bấm “Đồng bộ INPUT với WIP âm” (giữ lựa chọn / lý do đã nhập).</div>`}
    <div class="kpis">${A.kpiN('Vật tư INPUT', (w.input || []).length)}${A.kpiN('ACTUAL_USAGE / không tiêu hao', w.engine ? `${w.engine.nUse} / ${w.engine.nNo}` : '—')}${A.kpiN('Dòng DETAIL', (w.detail || []).length)}${A.kpiN('APPROVE / HOLD+REVIEW', `${c.approve} / ${c.holdRev}`)}${A.kpi('WIP điều chỉnh đã post', D.wf.approvedAdj)}${A.kpi('Closing WIP cuối', D.wf.finalClosing, true)}</div>
    <p class="muted">Việc tiếp theo: <b>${esc(c.next)}</b></p>
    <details ${c.status.startsWith('PASS') ? '' : 'open'}><summary>Checkpoint STEP 3B (${esc(c.okText)})</summary>${A.cpTable(c.rows)}</details>
    ${tabsHTML(tab, [['control', 'CONTROL – duyệt'], ['input', 'INPUT'], ['detail', 'DETAIL'], ['632', 'DIRECT 632'], ['wip', 'WIP cuối kỳ'], ['map', 'ERP MAP']], 'data-tab3b')}
    <div id="t3b"></div>
  </section>`;
  el.querySelectorAll('[data-tab3b]').forEach((b) => b.addEventListener('click', () => { S.tab3b = b.dataset.tab3b; A.render(); }));
  const bs = el.querySelector('#b3-basis');
  if (bs) bs.addEventListener('change', () => { if (!A.guardEdit()) { A.render(); return; } const wa = S.d.wipadj || (S.d.wipadj = { input: [] }); wa.basis = bs.value; A.audit('STEP 3B - BASIS', bs.value); A.markDirty('wipadj', 'audit'); A.toast(`Đã chọn phân bổ theo ${bs.value === 'AMOUNT' ? 'giá trị' : 'số lượng'}. Chạy lại BUILD → duyệt → APPLY, rồi STEP 4.`, 'review'); A.render(); });
  const box = el.querySelector('#t3b');
  const edit = A.canEdit();
  if (tab === 'input') {
    const rows = D.inputD;
    const cols = [{ key: 'code', label: 'Material Code', width: 120 }, { key: 'desc', label: 'Material Description', width: 260 }, { key: 'erp', label: 'ERP', width: 50 }, { key: 'erpQty', label: 'ERP Closing Qty', type: 'qty', width: 120 }, { key: 'erpAmt', label: 'ERP Closing Amount', type: 'num', width: 140 },
      { key: 'basisQty', label: 'Adj Basis Qty', type: 'qty', width: 120, editable: true }, { key: 'basisAmt', label: 'Adj Basis Amount', type: 'num', width: 140, editable: true }, { key: 'option', label: 'No-Usage Option', width: 130, editable: true, options: B.INPUT_OPTIONS },
      { key: 'reason', label: 'Reason', width: 220, editable: true }, { key: 'note', label: 'User Note', width: 180, editable: true }, { key: 'check', label: 'Input Check', type: 'status', width: 150 }, { key: 'erpSource', label: 'ERP Source', width: 130 }, { key: 'rule', label: 'WIP Rule', width: 120 }];
    A.mountTable(box, { columns: cols, rows, filterKey: 'check', height: 520, totals: ['basisAmt', 'erpAmt'], onExport: A.exportTable('03_WIP_DIRECT_ADJ_INPUT', cols),
      onEdit: !edit ? undefined : (row, key, val) => {
        const src = w.input.find((r) => ttxt(r.code) === row.key); if (!src) return;
        if (['basisQty', 'basisAmt'].includes(key)) { const v = A.parseNum(val, key); if (v === undefined) { A.render(); return; } src[key] = v; } else src[key] = val;
        row[key] = src[key];
        A.audit('3B INPUT EDIT', `${row.key} · ${key} = ${val}`); A.markDirty('wipadj', 'audit');
      } });
  } else if (tab === 'control') {
    if (!w.control) { box.innerHTML = A.emptyNote('Chưa BUILD. Bấm “1 · BUILD / REFRESH”.'); return; }
    const cols = [{ key: 'code', label: 'Material Code', width: 120 }, { key: 'desc', label: 'Material Description', width: 240 }, { key: 'erp', label: 'ERP', width: 50 }, { key: 'basisQty', label: 'Adj Basis Qty', type: 'qty', width: 110 }, { key: 'basisAmt', label: 'Adj Basis Amount', type: 'num', width: 130 },
      { key: 'method', label: 'Method', width: 120 }, { key: 'nDetail', label: 'Detail', type: 'int', width: 60 }, { key: 'share', label: 'Share', type: 'pct', width: 100 }, { key: 'apc', label: 'PC Alloc Amount', type: 'num', width: 130 }, { key: 'adir', label: '632 Route Amount', type: 'num', width: 120 },
      { key: 'status', label: 'Control Status', type: 'status', width: 150 }, { key: 'decision', label: 'Reviewer Decision', width: 120, editable: true, options: ['APPROVE', 'HOLD', 'REVIEW'] }, { key: 'note', label: 'Reviewer Note', width: 200, editable: true },
      { key: 'gate', label: 'Final Gate', type: 'status', width: 170 }, { key: 'wipPostAmt', label: 'WIP Post Amount', type: 'num', width: 130 }, { key: 'pcPostAmt', label: 'PC Post Amount', type: 'num', width: 130 }, { key: 'postCheck', label: 'Post Check', type: 'status', width: 140 }];
    A.mountTable(box, { columns: cols, rows: w.control.rows, filterKey: 'gate', height: 520, totals: ['basisAmt', 'apc', 'wipPostAmt', 'pcPostAmt'], onExport: A.exportTable('03_WIP_DIRECT_ADJ_CONTROL', cols),
      onEdit: !edit ? undefined : (row, key, val) => {
        if (key === 'decision') B.setDecision(row, val); else row[key] = val;
        A.audit('3B REVIEWER', `${row.code} · ${key} = ${val}`); A.markDirty('wipadj', 'audit');
      } });
    box.insertAdjacentHTML('afterbegin', edit ? `<div class="row"><button class="btn ghost sm" type="button" data-act="3b-all" data-dec="APPROVE">Đặt tất cả dòng PASS = APPROVE</button><button class="btn ghost sm" type="button" data-act="3b-all" data-dec="HOLD">Đặt tất cả = HOLD</button></div>` : '');
  } else if (tab === 'detail') {
    const cols = [['code', 'Material Code', 120], ['erp', 'ERP', 50], ['method', 'Method', 120], ['pc', 'PC No.', 120], ['prod', 'Product Code', 150], ['pname', 'Product Name', 240], ['qLot', 'Actual Consumption', 120, 'qty'], ['qTot', 'Total Consumption', 120, 'qty'], ['bLot', 'PC Amount Basis', 140, 'num'], ['share', 'Share', 100, 'pct'], ['allocQty', 'Alloc Qty', 110, 'qty'], ['allocAmt', 'Alloc Amount', 130, 'num'], ['dirAmt', '632 Amount', 110, 'num'], ['status', 'Detail Status', 160, 'status'], ['note', 'Source / Note', 220]].map(([key, label, width, type]) => ({ key, label, width, type }));
    A.mountTable(box, { columns: cols, rows: w.detail || [], filterKey: 'status', height: 520, totals: ['allocAmt', 'dirAmt'], onExport: A.exportTable('03_WIP_DIRECT_ADJ_DETAIL', cols) });
  } else if (tab === '632') {
    box.innerHTML = '<p class="muted">DIRECT_632 chỉ là đề xuất hạch toán – không vào PC-P hay WIP Allocation. Điền Accounting Ref, ngày ghi sổ, người ghi sau khi đã hạch toán trên FAST.</p><div id="l632"></div>';
    const cols = [{ key: 'code', label: 'Material', ro: true }, { key: 'erp', label: 'ERP', ro: true }, { key: 'amt', label: 'Adj Amount', num: true, ro: true }, { key: 'impact', label: '632 Impact', num: true, ro: true }, { key: 'dr', label: 'Nợ', ro: true }, { key: 'cr', label: 'Có', ro: true }, { key: 'qtyHandling', label: 'Xử lý SL', ro: true }, { key: 'ref', label: 'Accounting Ref' }, { key: 'postDate', label: 'Posting Date', date: true }, { key: 'postedBy', label: 'Posted By' }, { key: 'record', label: 'Record Status', ro: true, status: true }];
    editList(box.querySelector('#l632'), { columns: cols, rows: w.reg632 || (w.reg632 = []), readOnly: !edit, newRow: () => ({}), addLabel: '', onChange: (rows, r) => {
      if (r) r.record = ttxt(r.ref) && ttxt(r.postedBy) ? 'RECORDED' : ttxt(r.ref) ? 'PENDING RECORD INFO' : r.proposal;
      A.markDirty('wipadj'); } });
    box.querySelectorAll('[data-add],[data-del]').forEach((b) => b.remove());
  } else if (tab === 'wip') {
    const rows = D.wf.rows.map((r, i) => ({ ...r, name: d.step3.rows[i].name, closingQty: d.step3.rows[i].closingQty, closingAmt: d.step3.rows[i].closingAmt }));
    const cols = [['code', 'Item Code', 120], ['name', 'Item Name', 260], ['erp', 'ERP', 50], ['erpSource', 'ERP Source', 120], ['rule', 'Adj Rule', 110], ['closingQty', 'ERP Closing Qty', 120, 'qty'], ['closingAmt', 'ERP Closing Amount', 140, 'num'], ['adjQty', 'Direct Adj Qty', 110, 'qty'], ['adjAmt', 'Direct Adj Amount', 130, 'num'], ['finalQty', 'Final Closing Qty', 120, 'qty'], ['finalAmt', 'Final Closing Amount', 140, 'num'], ['postedPC', 'Posted to PC', 120, 'num'], ['method', 'Method', 110], ['status', 'Status', 150, 'status']].map(([key, label, width, type]) => ({ key, label, width, type }));
    A.mountTable(box, { columns: cols, rows, filterKey: 'status', height: 520, totals: ['closingAmt', 'adjAmt', 'finalAmt', 'postedPC'], onExport: A.exportTable('03_WIP_FINAL', cols) });
  } else if (tab === 'map') {
    const rows = (d.erpMap && d.erpMap.rows) || [];
    box.innerHTML = `<p class="muted">Bảng sở hữu ERP của vật tư là dữ liệu gốc, chuyển sang kỳ sau. Chỉ sửa cột User ERP Override khi cần (T / S / O). ERP UNKNOWN sẽ chặn STEP 3B.</p><div id="tmap"></div>`;
    const cols = B.MAP_FIELDS.map((f, i) => ({ key: f, label: B.MAP_HEADERS[i], width: f === 'name' ? 240 : f === 'reason' ? 260 : f === 'sheets' ? 200 : 110, type: f === 'rowsN' ? 'int' : f === 'review' ? 'status' : 'text', editable: f === 'override' || f === 'overrideNote', options: f === 'override' ? ['T', 'S', 'O'] : undefined }));
    A.mountTable(box.querySelector('#tmap'), { columns: cols, rows, filterKey: 'review', height: 520, onExport: A.exportTable('03_WIP_ERP_MAP', cols),
      onEdit: !edit ? undefined : (row, key, val) => { row[key] = val; A.audit('ERP MAP OVERRIDE', `${row.code} · ${key} = ${val}`); A.markDirty('erpMap', 'audit'); } });
  }
}

export function do3bSync() {
  const S = A.S; const w = S.d.wipadj || (S.d.wipadj = { input: [] });
  const before = B.inputSyncCheck(w.input, S.d.step3);
  w.input = B.writeInput(w.input, S.d.step3, (w.input || []).length > 0);
  A.audit('3B INPUT SYNC', `+${before.added} / −${before.removed} / basis khác ${before.basisDiff} → ${w.input.length} vật tư`);
  A.markDirty('wipadj', 'audit');
  A.toast(`INPUT đã đồng bộ: ${w.input.length} vật tư WIP âm.`, 'pass');
}
export function do3bBuild() {
  const S = A.S; const w = S.d.wipadj || (S.d.wipadj = { input: [] });
  if (!(w.input || []).length) { const chk = B.inputSyncCheck([], S.d.step3); if (!chk.neg.length) { A.toast('Không có vật tư CHECK NEGATIVE – kỳ này không cần điều chỉnh WIP.', 'pass'); return; } w.input = B.writeInput([], S.d.step3, false); A.toast(`INPUT trống – đã tự điền ${w.input.length} vật tư WIP âm.`, 'info'); }
  w.basis = B.basisOf(w);
  const r = B.runBuild({ erpMap: S.d.erpMap, input: w.input, control: w.control, reg632: w.reg632, basis: w.basis }, { step3: S.d.step3, step2: S.d.step2, datasets: S.d.datasets, period: S.period });
  S.d.erpMap = r.erpMap; Object.assign(w, { engine: r.engine, detail: r.detail, control: r.control, reg632: r.reg632 });
  A.audit('STEP 3B - BUILD', `Basis=${w.basis}; Usage=${r.engine.nUse}; NoUsage=${r.engine.nNo}; Engine=${r.engine.rows.length}; Detail=${r.detail.length} · ${r.mapMsg}`);
  A.markDirty('wipadj', 'erpMap', 'audit');
  A.toast(`BUILD xong: ${r.detail.length} dòng detail, ${r.control.rows.filter((x) => x.status === 'PASS').length}/${r.control.rows.length} vật tư PASS. ${r.mapMsg}`, 'pass');
}
export function do3bApply() {
  const S = A.S; const w = S.d.wipadj;
  if (!w || !w.control) { A.toast('Chưa BUILD.', 'block'); return; }
  if (!w.control.builtAt || w.control.builtAt < S.d.step3.runAt) { A.toast('CONTROL cũ hơn STEP 3. Chạy 1 BUILD / REFRESH trước.', 'block'); return; }
  if (w.control.fp && w.control.fp !== B.buildFingerprint(w.input, S.d.erpMap, S.d.step2, S.d.step3)) { A.toast('STOPPED: INPUT hoặc ERP map đã thay đổi sau lần BUILD mà người duyệt đã xem. Chạy 1 · BUILD / REFRESH rồi duyệt lại.', 'block'); return; }
  let res = B.applyControl(w.control, S.d.step3, '');
  if (res.mode === 'NEED_REASON') {
    const prev = w.control.noAdj ? w.control.noAdj.reason : '';
    const reason = (prompt('Không có dòng APPROVE. STEP 3B sẽ đóng kỳ với KHÔNG điều chỉnh WIP (WIP âm giữ lại để review, không post gì vào PC-P / STEP 4 / 632).\nLý do (bắt buộc):', prev) || '').trim();
    if (!reason) { A.toast('Đã huỷ – không thay đổi gì.', 'info'); return; }
    res = B.applyControl(w.control, S.d.step3, reason);
  }
  if (res.mode === 'STOPPED') { A.toast(res.message, 'block'); A.render(); return; }
  const inD = B.deriveInput(w.input, S.d.erpMap, S.d.step3, S.period);
  w.reg632 = B.build632(w.control, inD, w.reg632);
  // V3_RefreshPCAndStep4: final layer is live; refresh the Step 4 3B snapshot so Step 4 stays CURRENT.
  const D = derive(S).d3b;
  if (S.d.step4 && S.d.step4.snap) {
    const before = S.d.step4.snap.posted3B; S.d.step4.snap.posted3B = D.engPosted; S.d.step4.syncAt = nowISO();
    S.d.step4.finalChanged = Math.abs(before - D.engPosted) > 1;
  }
  A.audit(res.mode === 'NO_ADJ' ? 'STEP 3B - CLOSED WITH NO ADJUSTMENT' : 'STEP 3B - APPLY & SYNC', res.mode === 'NO_ADJ' ? `HOLD=${res.nHold}; REVIEW=${res.nReview}; lý do: ${w.control.noAdj.reason}` : `Applied=${res.applied}; DIRECT_632=${res.direct632}; PC adj=${A.fmtNum(D.engPosted)}`);
  A.markDirty('wipadj', 'step4', 'audit');
  A.toast(res.mode === 'NO_ADJ' ? 'STEP 3B đã đóng kỳ, không điều chỉnh WIP.' : `APPLY xong: ${res.applied} vật tư, điều chỉnh vào PC ${A.fmtNum(D.engPosted)} VND.`, 'pass');
}
export function do3bAll(dec) {
  const w = A.S.d.wipadj; if (!w || !w.control) return;
  let n = 0; for (const r of w.control.rows) if (r.status === 'PASS') { B.setDecision(r, dec); n++; }
  A.audit('3B REVIEWER', `${n} dòng = ${dec}`); A.markDirty('wipadj', 'audit');
}

// ======================= SALES & PRICE view =======================
export function viewSales(el) {
  const S = A.S; const d = S.d; const tab = S.tabSales || 'import';
  const st = d.salesImport; const db = d.salesDB; const pm = d.pm;
  const missing = pm ? pm.rows.filter((r) => r.status === 'MISSING PRICE').length : null;
  const dup = A.dupStatus();
  const bk = splitBooks(db, d.returnsDB);
  const rb = revenueBooks(bk.sales, bk.returns, S.period, d.dupDecisions);
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 4.1 · Doanh thu bán hàng &amp; Price Master</h1><p class="lead">Chỉ doanh thu bán hàng (TK 511). Hàng bán bị trả lại (TK 5212) và giảm giá / credit note (TK 5213) import, lưu và xử lý riêng ở <a href="#salesreturn">màn hình 5R</a>. Import file doanh thu (MONTHLY hoặc YTD) → Validate &amp; Save → Update Price Master (giá tháng hiện tại → giá thực tế gần nhất → YTD → Sales Order; giá thủ công luôn được ưu tiên).</p></div>
      <div class="result"><span>Price Master</span>${A.pill(pm ? pm.status : 'NOT RUN')}<small>${pm ? `${pm.rows.length} sản phẩm · thiếu giá ${missing}` : ''}</small></div></header>
    <div class="kpis">${A.kpi('Doanh thu 511 kỳ này', rb.a511)}${A.kpiN('Dòng staging', st ? st.rows.length : 0)}${A.kpiN('Sales Database', bk.sales.length)}${A.kpiN('SO fallback', (d.soPrice || []).length)}${A.kpiN('Giá thủ công', (d.manualPrice || []).length)}</div>
    ${bk.usingLegacy ? `<div class="alert review">Sales Database (dữ liệu cũ) còn <b>${bk.legacyCount}</b> dòng SALES RETURN / CREDIT NOTE. Chúng đang được đọc như file trả lại riêng và sẽ tự chuyển sang màn hình 5R ở lần Validate &amp; Save tiếp theo.</div>` : ''}
    ${rb.n5212 || rb.n5213 ? `<p class="muted">Giảm trừ doanh thu kỳ này (xem 5R): 5212 = ${A.fmtNum(rb.a5212)} VND (${rb.n5212} dòng) · 5213 = ${A.fmtNum(rb.a5213)} VND (${rb.n5213} dòng).</p>` : ''}
    ${dup.groups.length ? `<div class="alert ${dup.pending ? 'review' : 'pass'}">Kỳ ${esc(S.period)} có <b>${dup.groups.length}</b> nhóm dòng doanh thu giống hệt nhau (cùng ngày, hoá đơn, sản phẩm, số lượng, tiền – file không có Invoice Line No.). ${dup.pending ? `Còn <b>${dup.pending}</b> dòng lặp chưa xác nhận → <a href="#sales" data-tab-dup>xác nhận ở tab Nghi trùng</a>. Chưa xác nhận thì không đóng kỳ được.` : `Đã xác nhận hết (loại ${dup.excluded} dòng).`}</div>` : ''}
    ${tabsHTML(tab, [['import', 'Import & Validate'], ['db', 'Sales Database'], ['dup', `Nghi trùng${dup.pending ? ' (' + dup.pending + ')' : ''}`], ['pm', 'Price Master'], ['so', 'Sales Order fallback'], ['manual', 'Giá thủ công']], 'data-tabs')}
    <div id="ts"></div></section>`;
  el.querySelectorAll('[data-tabs]').forEach((b) => b.addEventListener('click', () => { S.tabSales = b.dataset.tabs; A.render(); }));
  el.querySelectorAll('[data-tab-dup]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); S.tabSales = 'dup'; A.render(); }));
  const box = el.querySelector('#ts'); const edit = A.canEdit();
  const salesCols = [...F.SALES_FIELDS.map((f, i) => ({ key: f, label: F.SALES_HEADERS[i], type: f === 'invDate' ? 'date' : ['fx', 'qty', 'unitPrice'].includes(f) ? 'qty' : ['amtUSD', 'amtVND'].includes(f) ? 'num' : 'text', width: f === 'prodName' ? 220 : f === 'customer' ? 180 : 110 })),
    { key: 'billDate', label: 'Bill Date', type: 'date', width: 100 }, { key: 'origInv', label: 'Original Invoice No.', width: 140 }];
  if (tab === 'import') {
    box.innerHTML = `<div class="row"><label>Chế độ <select id="s-mode"><option>YTD</option><option>MONTHLY</option></select></label>
      <label class="btn">Chọn file doanh thu…<input type="file" id="f-sales" accept=".xlsx,.xlsm,.xls,.xlsb" hidden></label>
      <button class="btn" type="button" data-act="sales-save" ${st && st.rows.length && !String(st.status).includes('SAVED') ? '' : 'disabled'}>Validate &amp; Save</button>
      <span class="muted">${st ? `${esc(st.fileName || '')} · ${esc(st.mode || '')} · ${A.pill(st.status)}` : 'Chưa import.'}</span></div>
      <p class="muted">File cần có Invoice Date, Product Number, Quantity, Amount (USD). Nếu có Bill/B.L. Date thì đây là Recognition Date bắt buộc và phải hợp lệ. YTD chỉ thay dữ liệu đến hết kỳ giá thành, không đụng các kỳ tương lai. Dòng SALES RETURN / CREDIT NOTE trong file được bỏ qua (SKIPPED) – import chúng ở <a href="#salesreturn">màn hình 5R</a> (có thể dùng cùng file).</p><div id="t-stg"></div>`;
    box.querySelector('#f-sales').addEventListener('change', (e) => importSalesFile(e.target.files[0], box.querySelector('#s-mode').value));
    if (st && st.rows.length) {
      const cols = [...salesCols, { key: 'validStat', label: 'Validation', type: 'status', width: 100 }, { key: 'validMsg', label: 'Validation Message', width: 320 }, { key: 'txnKey', label: 'Transaction Key', width: 220 }, { key: 'saveStat', label: 'Save', width: 80 }];
      A.mountTable(box.querySelector('#t-stg'), { columns: cols, rows: st.rows, filterKey: 'validStat', height: 480, totals: ['qty', 'amtUSD', 'amtVND'], onExport: A.exportTable('04_SALES_IMPORT', cols) });
    }
  } else if (tab === 'dup') {
    if (!dup.groups.length) { box.innerHTML = A.emptyNote('Không có dòng doanh thu nào lặp lại trong kỳ.'); return; }
    const dec = d.dupDecisions || {};
    box.innerHTML = `<p class="muted">Mỗi nhóm là các dòng giống hệt nhau trong Sales Database. Dòng #1 luôn được tính. Với mỗi dòng lặp (#2, #3…), chọn <b>Dòng thật</b> (vẫn tính giá vốn FIFO – mặc định giống Excel) hoặc <b>Trùng – loại</b> (không tính FIFO). Đối chiếu với hoá đơn gốc / doanh thu TK 511 trên FAST trước khi chọn.</p>
      ${edit ? '<div class="row"><button class="btn ghost sm" type="button" data-dupall="KEEP">Tất cả dòng lặp là dòng thật</button><button class="btn ghost sm" type="button" data-dupall="EXCLUDE">Tất cả dòng lặp là trùng – loại</button></div>' : ''}
      <div class="el-wrap"><table class="cp"><thead><tr><th>Ngày</th><th>Hoá đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th class="r">SL</th><th class="r">USD</th><th>Lần</th><th>Xác nhận</th></tr></thead><tbody>
      ${dup.groups.map((g) => g.map((l) => `<tr><td>${serialToISO(l.date)}</td><td>${esc(l.inv)}</td><td>${esc(l.cust)}</td><td>${esc(l.prod)}</td><td class="r">${A.fmtNum(l.qty)}</td><td class="r">${A.fmtNum(l.usd, 2)}</td><td>#${l.occ}</td><td>${l.occ === 1 ? '<span class="muted">Dòng gốc</span>' : `<select data-dup="${esc(l.key)}" ${edit ? '' : 'disabled'}><option value="">— chưa xác nhận —</option><option value="KEEP" ${dec[l.key] === 'KEEP' ? 'selected' : ''}>Dòng thật</option><option value="EXCLUDE" ${dec[l.key] === 'EXCLUDE' ? 'selected' : ''}>Trùng – loại</option></select>`}</td></tr>`).join('')).join('<tr><td colspan="8"></td></tr>')}
      </tbody></table></div>`;
    const save = (k, v, all) => { if (!A.guardEdit()) { A.render(); return; } const o = d.dupDecisions || (d.dupDecisions = {}); if (all) { for (const g of dup.groups) for (const l of g) if (l.occ > 1) o[l.key] = v; } else if (v) o[k] = v; else delete o[k]; A.audit('SALES DUPLICATE DECISION', all ? `Tất cả dòng lặp = ${v}` : `${k} = ${v || '(bỏ)'}`); A.markDirty('dupDecisions', 'audit'); A.render(); };
    box.querySelectorAll('[data-dup]').forEach((x) => x.addEventListener('change', () => save(x.dataset.dup, x.value)));
    box.querySelectorAll('[data-dupall]').forEach((x) => x.addEventListener('click', () => save('', x.dataset.dupall, true)));
  } else if (tab === 'db') {
    if (!db) { box.innerHTML = A.emptyNote('Sales Database trống.'); return; }
    const cols = [...salesCols, { key: 'include', label: 'Include in Price', width: 90 }, { key: 'validResult', label: 'Validation', type: 'status', width: 100 }, { key: 'txnKey', label: 'Transaction Key', width: 220 }, { key: 'batchID', label: 'Batch', width: 150 }];
    box.innerHTML = `<p class="muted">Lưu lần cuối ${A.fmtTs(db.savedAt)} · ${bk.sales.length} dòng doanh thu bán hàng. Sales Database được mang sang kỳ sau. Hàng trả lại / giảm giá: <a href="#salesreturn">màn hình 5R</a>.</p><div id="t-db"></div>`;
    A.mountTable(box.querySelector('#t-db'), { columns: cols, rows: bk.sales, filterKey: 'tranType', height: 520, totals: ['qty', 'amtUSD', 'amtVND'], onExport: A.exportTable('04_SALES_DATA', cols) });
  } else if (tab === 'pm') {
    box.innerHTML = `<div class="row"><button class="btn" type="button" data-act="pm-update">Update Price Master</button><span class="muted">${pm ? `Cập nhật ${A.fmtTs(pm.updatedAt)} · nguồn đến ${serialToISO(pm.sourceThrough)}` : ''}</span></div><div id="t-pm"></div><h2>Chi tiết giá tham chiếu</h2><div id="t-pma"></div>`;
    if (pm) {
      const c1 = F.PM_FIELDS.map((f, i) => ({ key: f, label: F.PM_HEADERS[i], type: f === 'refDetail' ? 'date' : ['refPrice', 'manPrice', 'finalPrice'].includes(f) ? 'qty' : f === 'status' ? 'status' : 'text', width: f.includes('Source') || f === 'refSource' ? 200 : 130 }));
      A.mountTable(box.querySelector('#t-pm'), { columns: c1, rows: pm.rows, filterKey: 'status', height: 360, onExport: A.exportTable('04_PRICE_MASTER', c1) });
      const c2 = F.PM_AUDIT_FIELDS.map((f, i) => ({ key: f, label: F.PM_AUDIT_HEADERS[i], type: f === 'refDate' ? 'date' : ['curP', 'latestP', 'ytdP', 'soP', 'sel'].includes(f) ? 'qty' : f === 'age' ? 'int' : f === 'review' ? 'status' : 'text', width: f === 'srcText' ? 200 : 120 }));
      A.mountTable(box.querySelector('#t-pma'), { columns: c2, rows: pm.audit, filterKey: 'review', height: 360, onExport: A.exportTable('04_PRICE_MASTER_AUDIT', c2) });
    }
  } else if (tab === 'so') {
    box.innerHTML = `<div class="row"><label class="btn ghost">Import danh sách SO…<input type="file" id="f-so" accept=".xlsx,.xlsm,.xls" hidden></label><span class="muted">Cần cột Product Code và Unit Price USD (tuỳ chọn: Active, SO Date, SO No., Customer, Qty, Note). Import sẽ thay toàn bộ danh sách.</span></div><div id="t-so"></div>`;
    box.querySelector('#f-so').addEventListener('change', (e) => importSOFile(e.target.files[0]));
    const cols = [['active', 'Active', 60], ['product', 'Product Code', 140], ['soDate', 'SO Date', 100, 'date'], ['soNo', 'SO No.', 140], ['customer', 'Customer', 140], ['qty', 'Qty', 90, 'qty'], ['price', 'Unit Price USD', 110, 'qty'], ['note', 'Note', 220], ['check', 'Price Master Check', 320]].map(([key, label, width, type]) => ({ key, label, width, type }));
    A.mountTable(box.querySelector('#t-so'), { columns: cols, rows: d.soPrice || [], filterKey: 'check', height: 480, onExport: A.exportTable('04_SO_PRICE', cols) });
  } else if (tab === 'manual') {
    box.innerHTML = `<p class="muted">Giá thủ công (USD) có ưu tiên cao nhất. <b>Approved By</b> được hệ thống ghi từ tài khoản đăng nhập; người sửa dòng giá không được tự phê duyệt dòng đó. Mọi chỉnh sửa làm mất hiệu lực phê duyệt cũ.</p><div id="man-approval"></div><div id="l-man"></div>`;
    const cols = [{ key: 'product', label: 'Product Code' }, { key: 'price', label: 'Price USD', num: true }, { key: 'effFrom', label: 'Effective From', date: true }, { key: 'effTo', label: 'Effective To', date: true }, { key: 'source', label: 'Source / Evidence' }, { key: 'updatedBy', label: 'Prepared / Updated By', ro: true }, { key: 'approvedBy', label: 'Approved By', ro: true }, { key: 'approvedAt', label: 'Approved At', ro: true }, { key: 'updatedAt', label: 'Updated At', ro: true }];
    editList(box.querySelector('#l-man'), { columns: cols, rows: d.manualPrice || (d.manualPrice = []), readOnly: !edit, addLabel: 'Thêm giá thủ công', newRow: () => ({ product: '', price: null, updatedBy: A.who(), approvedBy: '', approvedAt: '', approvalNote: '', updatedAt: nowISO() }),
      onChange: (rows, r) => {
        if (r) { r.product = utxt(r.product); r.updatedBy = A.who(); r.approvedBy = ''; r.approvedAt = ''; r.approvalNote = ''; r.updatedAt = nowISO(); }
        if (d.pm) d.pm.status = 'OUTDATED';
        A.audit('MANUAL PRICE EDIT', r ? `${r.product} = ${r.price}; approval reset` : 'xoá dòng');
        A.markDirty('manualPrice', 'pm', 'audit');
      } });
    const rows = d.manualPrice || [], pending = rows.filter((r) => ttxt(r.product) && num(r.price) > 0 && !ttxt(r.approvedBy));
    const ab = box.querySelector('#man-approval');
    ab.innerHTML = pending.length
      ? `<div class="alert review"><b>${pending.length} giá thủ công chưa được duyệt.</b> ${edit ? '<button class="btn sm" type="button" id="approve-manual">Duyệt giá đang chờ</button>' : ''}</div>`
      : '<div class="alert pass">Không có giá thủ công đang chờ duyệt.</div>';
    const ap = box.querySelector('#approve-manual');
    if (ap) ap.addEventListener('click', () => {
      if (!A.canEdit()) return; // owner decision #8: anyone with edit rights approves (note + audit kept)
      const note = (prompt('Nhập lý do / bằng chứng phê duyệt Manual Price (bắt buộc):', '') || '').trim();
      if (note.length < 5) { A.toast('Cần giải trình ít nhất 5 ký tự.', 'review'); return; }
      const now = nowISO();
      for (const r of pending) { r.approvedBy = A.who(); r.approvedAt = now; r.approvalNote = note; }
      if (d.pm) d.pm.status = 'OUTDATED';
      A.audit('MANUAL PRICE APPROVE', `${pending.length} dòng; ${note}`);
      A.markDirty('manualPrice', 'pm', 'audit'); A.render();
    });
  }
}

async function importSalesFile(file, mode) {
  if (!file || !A.guardEdit()) return;
  await A.busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const res = await A.parseFile(await file.arrayBuffer(), 'all');
      const st = F.importSales(res.grids, file.name, mode, A.S.period);
      A.S.d.salesImport = st;
      A.audit('SALES IMPORT', `${file.name} · ${mode} · ${st.rows.length} dòng`);
      A.markDirty('salesImport', 'audit');
      A.toast(`Đã import ${st.rows.length} dòng doanh thu. Bước tiếp: Validate & Save.`, 'pass');
    } catch (e) { A.toast('Import doanh thu lỗi: ' + e.message, 'block'); }
  });
  A.render();
}
async function importSOFile(file) {
  if (!file || !A.guardEdit()) return;
  await A.busy(`Đang đọc ${file.name}…`, async () => {
    try {
      const res = await A.parseFile(await file.arrayBuffer(), 'all');
      const norm = (s) => txt(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
      let found = null;
      for (const g of Object.values(res.grids)) {
        for (let r = 0; r < Math.min(g.length, 40) && !found; r++) {
          const h = (g[r] || []).map(norm);
          const cp = h.indexOf('PRODUCTCODE'), cpr = h.findIndex((x) => x === 'UNITPRICEUSD' || x === 'PRICEUSD' || x === 'UNITPRICE');
          if (cp >= 0 && cpr >= 0) found = { g, r, h, cp, cpr };
        }
        if (found) break;
      }
      if (!found) throw new Error('Không tìm thấy bảng có cột Product Code và Unit Price USD.');
      const col = (n) => found.h.indexOf(n);
      const c = { active: col('ACTIVE'), soDate: col('SODATE'), soNo: col('SONO'), customer: col('CUSTOMER'), qty: col('QTY'), note: col('NOTE') };
      const rows = [];
      for (let i = found.r + 1; i < found.g.length; i++) {
        const x = found.g[i] || []; if (!ttxt(x[found.cp]) && !ttxt(x[c.active])) continue;
        rows.push({ active: c.active >= 0 ? x[c.active] : '', product: x[found.cp], soDate: c.soDate >= 0 ? x[c.soDate] : null, soNo: c.soNo >= 0 ? x[c.soNo] : '', customer: c.customer >= 0 ? x[c.customer] : '', qty: c.qty >= 0 ? x[c.qty] : null, price: x[found.cpr], note: c.note >= 0 ? x[c.note] : '', check: '' });
      }
      A.S.d.soPrice = rows; if (A.S.d.pm) A.S.d.pm.status = 'OUTDATED';
      A.audit('SO PRICE IMPORT', `${file.name} · ${rows.length} dòng`); A.markDirty('soPrice', 'pm', 'audit');
      A.toast(`Đã nạp ${rows.length} dòng Sales Order. Chạy lại Update Price Master.`, 'pass');
    } catch (e) { A.toast('Import SO lỗi: ' + e.message, 'block'); }
  });
  A.render();
}
/** v1.11: return / credit lines saved inside the Sales Database by earlier versions move to their own Returns Database once. */
export function migrateLegacyReturns(S) {
  const d = S.d; const bk = splitBooks(d.salesDB, d.returnsDB);
  if (!bk.legacyCount) return 0;
  if (!d.returnsDB) d.returnsDB = { rows: d.salesDB.rows.filter((r) => !bk.sales.includes(r)), savedAt: d.salesDB.savedAt || nowISO(), migratedFrom: 'salesDB', migratedAt: nowISO() };
  d.salesDB = { ...d.salesDB, rows: bk.sales };
  A.audit('RETURNS SPLIT', `Chuyển ${bk.legacyCount} dòng SALES RETURN / CREDIT NOTE từ Sales Database sang Returns Database (5R)`);
  A.markDirty('salesDB', 'returnsDB', 'audit');
  return bk.legacyCount;
}
/** Selling-price weighting uses the sales book only (v1.11): saving returns never makes Price Master / STEP 4 outdated. */
export const priceRows = (d) => ({ rows: splitBooks(d.salesDB, d.returnsDB).sales, savedAt: d.salesDB ? d.salesDB.savedAt : '' });
export function doSalesSave() {
  const S = A.S;
  try {
    const moved = migrateLegacyReturns(S);
    const pv = F.salesSavePreview(S.d.salesImport, S.d.salesDB, S.period, { book: 'SALES' });
    if (pv.from !== null && !confirm(`Validate & Save doanh thu bán hàng (${pv.mode})\n\nThay thế toàn bộ dòng cũ từ ${serialToISO(pv.from)} đến ${serialToISO(pv.to)}: ${pv.replaced} dòng\nThêm mới từ file: ${pv.inserted} dòng${pv.skipped ? `\nBỏ qua ${pv.skipped} dòng SALES RETURN / CREDIT NOTE (import ở màn hình 5R)` : ''}\nGiữ nguyên ngoài khoảng: ${pv.kept} dòng\n\nTiếp tục?`)) return;
    const r = F.validateSaveSales(S.d.salesImport, S.d.salesDB, S.period, { book: 'SALES' });
    S.d.salesDB = r.db; if (S.d.pm) S.d.pm.status = 'OUTDATED';
    A.audit('SALES VALIDATE & SAVE', `${r.stats.mode} ${serialToISO(r.stats.from)}→${serialToISO(r.stats.to)}: lưu ${r.stats.saved} dòng; bỏ qua (trả lại / giảm giá) ${r.stats.skipped}; PASS ${r.stats.pass}; REVIEW ${r.stats.review}; BLOCK ${r.stats.block || 0}; lặp ${r.stats.dup}; thay thế ${r.stats.replaced}${r.stats.droppedUndated ? `; bỏ ${r.stats.droppedUndated} dòng thiếu ngày của lần lưu trước` : ''}`);
    A.markDirty('salesImport', 'salesDB', 'pm', 'audit');
    A.toast(`Đã lưu ${r.stats.saved} dòng doanh thu (REVIEW ${r.stats.review}, thay thế ${r.stats.replaced} dòng cũ)${r.stats.skipped ? `; bỏ qua ${r.stats.skipped} dòng trả lại / giảm giá → import ở màn hình 5R` : ''}${moved ? `; ${moved} dòng trả lại cũ đã chuyển sang 5R` : ''}. Price Master → OUTDATED, hãy Update Price Master.`, r.stats.review || r.stats.skipped ? 'review' : 'pass');
  } catch (e) { A.toast('Validate & Save lỗi: ' + e.message, 'block'); }
}
export function doPMUpdate() {
  const S = A.S;
  try {
    if (!S.d.step2) throw new Error('Cần chạy STEP 2 trước (danh sách sản phẩm lấy từ PC-P).');
    const r = F.updatePriceMaster({ salesDB: priceRows(S.d), so: S.d.soPrice, manual: S.d.manualPrice, step2: S.d.step2, period: S.period });
    S.d.pm = r.pm; S.d.soPrice = r.so;
    A.audit('UPDATE PRICE MASTER', `${r.stats.products} sản phẩm; thiếu giá ${r.stats.missing}; manual overlap ${r.stats.overlap}; manual chưa duyệt ${r.stats.unapprovedManual || 0}; manual date lỗi ${r.stats.invalidManualDate || 0}; SO sau kỳ ${r.stats.afterSO}; SO date lỗi ${r.stats.invalidSODate || 0}; cũ ${r.stats.stale}`);
    A.markDirty('pm', 'soPrice', 'audit');
    const blocked = r.pm.status !== 'CURRENT';
    const why = [r.stats.missing ? `thiếu giá ${r.stats.missing}` : '', r.stats.overlap ? `manual overlap ${r.stats.overlap}` : '', r.stats.unapprovedManual ? `manual chưa duyệt ${r.stats.unapprovedManual}` : '', r.stats.invalidManualDate ? `manual date lỗi ${r.stats.invalidManualDate}` : '', r.stats.afterSO ? `SO sau kỳ ${r.stats.afterSO}` : '', r.stats.invalidSODate ? `SO date lỗi ${r.stats.invalidSODate}` : ''].filter(Boolean).join(' · ');
    A.toast(blocked ? `Price Master BLOCKED: ${why}` : `Price Master CURRENT – ${r.stats.products} sản phẩm có giá.`, blocked ? 'block' : 'pass');
  } catch (e) { A.toast('Update Price Master lỗi: ' + e.message, 'block'); }
}

// ======================= GL / FX view =======================
export function viewGL(el) {
  const S = A.S; const d = S.d; const gl = d.gl || { period: '', fx: null, gl622: null, gl627: null };
  const edit = A.canEdit(); const dt = directTotals(d.directAdj);
  const prev = gl.prevRef || {};
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 4.2 · FX, GL 622 / 627 &amp; phân bổ trực tiếp</h1><p class="lead">Nhập tỷ giá giá thành và số dư 622 (nhân công trực tiếp), 627 (chi phí sản xuất chung) của kỳ ${esc(S.period)} từ FAST. Phần phân bổ trực tiếp (nếu có) được trừ khỏi pool chung.</p></div>
      <div class="result"><span>Kỳ GL</span>${A.pill(gl.period === S.period ? 'PASS' : 'BLOCK')}<small>${esc(gl.period || 'chưa nhập')}</small></div></header>
    <form id="f-gl" class="card glf">
      <div class="glrow"><label>Tỷ giá phân bổ (VND/USD)<input name="fx" inputmode="decimal" value="${esc(gl.fx ?? '')}" ${edit ? '' : 'disabled'}></label><span class="muted">Kỳ trước: ${A.fmtNum(num(prev.fx), 2)}</span></div>
      <div class="glrow"><label>GL 622 – Nhân công trực tiếp (VND)<input name="gl622" inputmode="decimal" value="${esc(gl.gl622 ?? '')}" ${edit ? '' : 'disabled'}></label><span class="muted">Kỳ trước: ${A.fmtNum(num(prev.gl622))}</span></div>
      <div class="glrow"><label>GL 627 – Chi phí sản xuất chung (VND)<input name="gl627" inputmode="decimal" value="${esc(gl.gl627 ?? '')}" ${edit ? '' : 'disabled'}></label><span class="muted">Kỳ trước: ${A.fmtNum(num(prev.gl627))}</span></div>
      <div class="glrow"><label>Người lập<input name="preparedBy" value="${esc(gl.preparedBy ?? '')}" ${edit ? '' : 'disabled'}></label><label>Nguồn<input name="sourceRef" value="${esc(gl.sourceRef ?? 'FAST / GL current-period TB')}" ${edit ? '' : 'disabled'}></label></div>
      <div class="glrow"><label>622 lũy kế năm (cho STEP 5)<input name="ytd622" inputmode="decimal" value="${esc(gl.ytd622 ?? '')}" ${edit ? '' : 'disabled'}></label><label>627 lũy kế năm<input name="ytd627" inputmode="decimal" value="${esc(gl.ytd627 ?? '')}" ${edit ? '' : 'disabled'}></label></div>
      <p class="muted">Nhập số không cần dấu phân cách (26300, 15506701812) hoặc đủ nhóm nghìn (15.506.701.812 / 15,506,701,812). Số dạng “26.300” sẽ bị hỏi lại vì không rõ là 26300 hay 26,3.</p>
      ${edit ? `<div class="row"><button class="btn" type="submit">Lưu GL cho kỳ ${esc(S.period)}</button><span class="muted">${gl.updatedAt ? `Lưu lúc ${A.fmtTs(gl.updatedAt)}` : ''}</span></div>` : ''}
    </form>
    <h2>Pool chung</h2>
    <table class="cp"><tbody>
      <tr><td>Direct 622</td><td class="r">${A.fmtNum(dt.d622)}</td><td>Common pool 622</td><td class="r">${A.fmtNum(num(gl.gl622) - dt.d622)}</td></tr>
      <tr><td>Direct 627</td><td class="r">${A.fmtNum(dt.d627)}</td><td>Common pool 627</td><td class="r">${A.fmtNum(num(gl.gl627) - dt.d627)}</td></tr>
    </tbody></table>
    <h2>Phân bổ trực tiếp 622 / 627 <small>Chỉ dùng cho khoản xác định được cho một lô cụ thể. Active = Y.</small></h2>
    <div id="dir-approval"></div><div id="l-dir"></div></section>`;
  if (edit) el.querySelector('#f-gl').addEventListener('submit', (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    const vals = {};
    for (const k of ['fx', 'gl622', 'gl627', 'ytd622', 'ytd627']) { const v = A.parseNum(f.get(k), k.toUpperCase()); if (v === undefined) return; vals[k] = v; }
    const n = (k) => vals[k];
    if (!d.gl) d.gl = gl;
    Object.assign(gl, { period: S.period, fx: n('fx'), gl622: n('gl622'), gl627: n('gl627'), ytd622: n('ytd622'), ytd627: n('ytd627'), preparedBy: f.get('preparedBy'), sourceRef: f.get('sourceRef'), updatedAt: nowISO() });
    A.audit('GL INPUT', `FX=${gl.fx}; 622=${gl.gl622}; 627=${gl.gl627}`); A.markDirty('gl', 'audit'); A.toast('Đã lưu FX / GL.', 'pass'); A.render();
  });
  const cols = [{ key: 'active', label: 'Active', options: ['Y', 'N'] }, { key: 'erp', label: 'ERP', options: ['T', 'O'] }, { key: 'account', label: 'Account', options: ['622', '627'] }, { key: 'amount', label: 'Amount (VND)', num: true }, { key: 'pc', label: 'PC No.' }, { key: 'prod', label: 'Product Code' }, { key: 'reason', label: 'Reason / Evidence' }, { key: 'status', label: 'Status', ro: true, status: true }];
  editList(el.querySelector('#l-dir'), { columns: cols, rows: d.directAdj || (d.directAdj = []), readOnly: !edit, addLabel: 'Thêm dòng phân bổ trực tiếp', newRow: () => ({ active: 'Y', erp: 'T', account: '622', amount: null, pc: '', prod: '', reason: '', status: '' }),
    onChange: () => {
      d.directPreparedBy = A.who(); d.directApproval = null;
      A.audit('DIRECT ADJ EDIT', 'approval reset'); A.markDirty('directAdj', 'directPreparedBy', 'directApproval', 'audit');
    } });
  const active = (d.directAdj || []).filter((r) => utxt(r.active) === 'Y');
  const key = directKey(d.directAdj), dap = d.directApproval, approved = !!(dap && dap.key === key);
  const db = el.querySelector('#dir-approval');
  if (!active.length) db.innerHTML = '<div class="muted">Không có phân bổ trực tiếp đang Active.</div>';
  else if (approved) db.innerHTML = `<div class="alert pass"><b>Direct 622/627 đã được duyệt</b> bởi ${esc(dap.by)} lúc ${A.fmtTs(dap.at)} · ${esc(dap.note || '')}</div>`;
  else db.innerHTML = `<div class="alert review"><b>${active.length} dòng Direct 622/627 chưa được duyệt.</b> ${edit ? '<button class="btn sm" id="approve-direct" type="button">Duyệt Direct 622/627</button>' : ''}</div>`;
  const da = el.querySelector('#approve-direct');
  if (da) da.addEventListener('click', () => {
    const note = (prompt('Nhập lý do / bằng chứng phê duyệt Direct 622/627:', '') || '').trim();
    if (note.length < 5) { A.toast('Cần giải trình ít nhất 5 ký tự.', 'review'); return; }
    d.directApproval = { key, by: A.who(), at: nowISO(), note };
    A.audit('DIRECT 622/627 APPROVE', `${active.length} dòng; ${note}`);
    A.markDirty('directApproval', 'audit'); A.render();
  });
}

// ======================= STEP 4 cost allocation view =======================
export function view4(el) {
  const S = A.S; const d = S.d; const s4 = d.step4; const D4 = A.derived().d4; const c = D4.controls; const fl = D4.fl;
  const gate = gateMsg(S);
  const tab = S.tab4 || 'ca';
  el.innerHTML = `<section class="page">
    <header class="ph"><div><h1>STEP 4.3 · Phân bổ giá thành</h1><p class="lead">Giá thành lô = RM (PC RM + Stock Out) + 622 + 627 + điều chỉnh WIP 3B + rework chuyển vào. 622/627 chung phân bổ theo đóng góp dương (doanh thu − RM); lô cuối cùng nhận phần làm tròn còn lại.</p></div>
      <div class="result"><span>Kết quả</span>${A.pill(c.status)}<small>${esc(c.okText)}</small></div></header>
    <div class="row"><button class="btn" data-act="run-step4" type="button">Chạy STEP 4</button><span class="muted">${s4 ? `Engine ${A.fmtTs(s4.runAt)}${s4.syncAt ? ` · đồng bộ 3B ${A.fmtTs(s4.syncAt)}` : ''} · ${A.pill(D4.freshness)}` : ''}</span></div>
    ${gate ? `<div class="alert block"><b>Chưa chạy được:</b> ${esc(gate)}</div>` : ''}
    ${s4 && s4.blocked ? `<div class="alert block"><b>STEP 4 bị BLOCK.</b> Thiếu giá: ${s4.missingPrice} · Phân bổ trực tiếp lỗi: ${s4.directBad} · FX/GL đủ: ${s4.inputOK ? 'Có' : 'Không'}</div>` : ''}
    ${fl ? `<div class="kpis">${A.kpiN('Số lô', s4.lots)}${A.kpiN('SL hoàn thành', s4.totalQty)}${A.kpi('Tổng RM', fl.totals.totalRM)}${A.kpi('622 phân bổ', s4.alloc622)}${A.kpi('627 phân bổ', s4.alloc627)}${A.kpi('Tổng giá thành SX', fl.totals.totalCost, true)}</div>` : ''}
    <p class="muted">Việc tiếp theo: <b>${esc(c.next)}</b></p>
    <details ${c.status.startsWith('PASS') ? '' : 'open'}><summary>Checkpoint STEP 4 (${esc(c.okText)})</summary>${A.cpTable(c.rows)}</details>
    ${s4 ? tabsHTML(tab, [['ca', 'Giá thành theo lô'], ['rec', 'Đối chiếu'], ['lot', 'Kiểm tra đơn giá lô']], 'data-tab4') : ''}
    <div id="t4"></div></section>`;
  el.querySelectorAll('[data-tab4]').forEach((b) => b.addEventListener('click', () => { S.tab4 = b.dataset.tab4; A.render(); }));
  const box = el.querySelector('#t4');
  if (!s4) { box.innerHTML = A.emptyNote('Chưa chạy STEP 4.'); return; }
  if (tab === 'ca' && fl) {
    const T = { qty: 'qty', pcRM: 'num', so: 'num', baseRM: 'num', price: 'qty', fx: 'qty', salesUSD: 'num', salesVND: 'num', contrib: 'num', eligible: 'num', weight: 'pct', d622: 'num', d627: 'num', c622: 'num', c627: 'num', t622: 'num', t627: 'num', baseCost: 'num', unitCost: 'num', rmPct: 'pct', p622: 'pct', p627: 'pct', gpPct: 'pct', wipAdj: 'num', totalRM: 'num', totalCost: 'num', finalUnit: 'num', carryIn: 'num', date: 'date' };
    const cols = F.CA_FIELDS.map((f, i) => ({ key: f, label: F.CA_HEADERS[i], type: T[f] || 'text', width: f === 'name' ? 240 : T[f] === 'num' ? 140 : f === 'statusText' ? 200 : f === 'prod' ? 150 : 110, trace: f === 'prod' }));
    A.mountTable(box, { columns: cols, rows: fl.rows, filterKey: 'fam', height: 540, totals: ['qty', 'pcRM', 'so', 'baseRM', 'salesVND', 't622', 't627', 'baseCost', 'wipAdj', 'totalRM', 'totalCost', 'carryIn'], onExport: A.exportTable('04_COST_ALLOCATION', cols) });
  } else if (tab === 'rec') {
    const rr = (r) => `<tr><td>${esc(r.label)}</td><td class="r">${A.cpVal(r.expected)}</td><td class="r">${A.cpVal(r.result)}</td><td class="r">${A.cpVal(r.diff)}</td><td>${A.pill(r.status)}</td><td class="muted">${esc(r.note || '')}</td></tr>`;
    const head = '<thead><tr><th>Kiểm soát</th><th class="r">Kỳ vọng / Nguồn</th><th class="r">Kết quả STEP 4</th><th class="r">Chênh lệch</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>';
    box.innerHTML = `<h2>Đối chiếu engine <small>${A.pill(s4.recon.engineStatus)}</small></h2><table class="cp">${head}<tbody>${s4.recon.rows.slice(0, 13).map(rr).join('')}${fl ? rr(fl.step5Row) : ''}</tbody></table>
      ${fl ? `<h2>Batch 6 – Điều chỉnh WIP trực tiếp <small>${A.pill(fl.gate6)}</small></h2><table class="cp">${head}<tbody>${fl.batch6.map(rr).join('')}</tbody></table>
      <h2>Batch 6B – Rework chuyển vào <small>${A.pill(fl.gate6b)}</small></h2><table class="cp">${head}<tbody>${fl.batch6b.map(rr).join('')}</tbody></table>
      <h2>Tổng thể STEP 4 <small>${A.pill(fl.overall)}</small></h2>` : ''}`;
  } else if (tab === 'lot') {
    const lc = d.lotCheck;
    const p = d.lotParams || { hiX: 2, loX: 0.5, minN: 3, minImp: 1000000 };
    box.innerHTML = `<form id="f-lot" class="inline lotf"><label>Cao (x median)<input name="hiX" value="${p.hiX}"></label><label>Thấp (x median)<input name="loX" value="${p.loX}"></label><label>Mẫu tối thiểu<input name="minN" value="${p.minN}"></label><label>|Ảnh hưởng| tối thiểu (VND)<input name="minImp" value="${p.minImp}"></label><button class="btn ghost" type="submit">Chạy lại kiểm tra</button></form>
      ${lc ? `<p>${A.pill(lc.status)} · Ảnh hưởng tuyệt đối ${A.fmtNum(lc.abs)} VND · còn trong FG cuối kỳ ${A.fmtNum(lc.closingImpact)} VND · ${A.fmtTs(lc.runAt)}</p>` : ''}<div id="t-lot"></div>
      <p class="muted">Đơn giá RM cuối của từng lô so với trung vị cùng sản phẩm (lô kỳ này; thêm lớp FG đầu kỳ nếu ít hơn số mẫu tối thiểu). Chỉ để review, không chặn STEP 4.</p>`;
    box.querySelector('#f-lot').addEventListener('submit', (e) => { e.preventDefault(); if (!A.guardEdit()) return; const f = new FormData(e.target); const pv = {}; for (const k of ['hiX', 'loX', 'minN', 'minImp']) { const v = A.parseNum(f.get(k), k); if (v === undefined) return; pv[k] = v; } d.lotParams = pv; runLotCheck(); A.markDirty('lotParams', 'lotCheck'); A.render(); });
    if (lc) {
      const cols = [['pc', 'PC No.', 120], ['date', 'PC Date', 100, 'date'], ['prod', 'Product Code', 140], ['name', 'Product Name', 220], ['fam', 'Family', 80], ['qty', 'Complete Qty', 100, 'qty'], ['unit', 'Unit RM (final)', 120, 'num'], ['median', 'Reference Median', 120, 'num'], ['ratio', 'Ratio', 80, 'qty'], ['sample', 'Sample', 70, 'int'], ['impact', 'Impact vs Median', 140, 'num'], ['closingQty', 'Qty in Closing FG', 110, 'qty'], ['closingImpact', 'Impact in Closing FG', 140, 'num'], ['flag', 'Flag', 320]].map(([key, label, width, type]) => ({ key, label, width, type }));
      A.mountTable(box.querySelector('#t-lot'), { columns: cols, rows: lc.rows, height: 420, totals: ['impact', 'closingImpact'], onExport: A.exportTable('04_LOT_COST_CHECK', cols) });
    }
  }
}

/**
 * Owner decision 02/10/2026 (audit F-07): STEP 4 and CLOSE MONTH are blocked until STEP 3B is fully resolved –
 * negative WIP taken into 3B, BUILD current, every line decided (APPROVE / HOLD / REVIEW), approvals APPLIED;
 * for the close also every DIRECT_632 entry RECORDED in FAST.
 */
export function threeBBlock(S, d3b, { forClose = false } = {}) {
  const d = S.d; if (!d.step3) return '';
  const w = d.wipadj || {};
  const neg = d.step3.rows.filter((m) => num(m.closingQty) < -0.000001).length;
  const inN = (w.input || []).filter((r) => ttxt(r.code)).length;
  if (neg && !inN) return `${neg} vật tư WIP âm chưa đưa vào STEP 3B – SYNC → BUILD → duyệt (APPROVE / HOLD) → APPLY.`;
  if (!inN) return '';
  const ctl = w.control;
  if (!ctl || !ctl.builtAt) return 'STEP 3B chưa BUILD.';
  if ((d3b && d3b.buildStale) || ctl.builtAt < d.step3.runAt) return 'STEP 3B: INPUT / ERP map / STEP 3A đổi sau BUILD – BUILD lại.';
  const rows = ctl.rows || [];
  const blank = rows.filter((r) => !ttxt(r.decision)).length;
  if (blank) return `STEP 3B còn ${blank} dòng chưa có quyết định (APPROVE / HOLD / REVIEW).`;
  const wait = rows.filter((r) => r.gate === 'APPROVED - AWAIT APPLY').length;
  if (wait) return `STEP 3B có ${wait} dòng đã APPROVE nhưng chưa APPLY.`;
  if (forClose) {
    const p632 = (w.reg632 || []).filter((r) => r.record === 'READY FOR ACCOUNTING' || r.record === 'PENDING RECORD INFO').length;
    if (p632) return `STEP 3B còn ${p632} bút toán DIRECT_632 chưa ghi FAST (cột Record phải là RECORDED).`;
  }
  return '';
}
export function directApprovalBlock(S) {
  const d = S.d, active = (d.directAdj || []).filter((r) => utxt(r.active) === 'Y');
  if (!active.length) return '';
  const key = directKey(d.directAdj), ap = d.directApproval;
  if (!ap || ap.key !== key) return `Direct 622/627 có ${active.length} dòng Active chưa được duyệt (màn hình 4.2 → Duyệt Direct 622/627).`;
  return '';
}
function gateMsg(S) {
  const d = S.d;
  return F.step4Gate({ period: S.period, salesImport: d.salesImport, pm: d.pm, gl: d.gl, step2: d.step2, step3: d.step3, opening: d.opening, latestImport: A.latestImport(), manual: d.manualPrice, dbSavedAt: d.salesDB ? d.salesDB.savedAt : '' }) || directApprovalBlock(S);
}
export function runLotCheck() {
  const S = A.S; const fl = A.derived().d4.fl; if (!fl) return;
  const ref = S.d.fgRef || {};
  const cq = new Map(Object.entries(ref.closingQty || {}));
  S.d.lotCheck = F.lotCostCheck(fl.rows, S.d.lotParams || {}, ref.opening || [], cq);
}
export function doStep4() {
  const S = A.S; const d = S.d;
  const g = gateMsg(S) || threeBBlock(S, derive(S).d3b);
  if (g) { A.toast('STEP 4 bị chặn: ' + g, 'block'); return; }
  try {
    const s4 = F.runStep4({ period: S.period, step2: d.step2, step3: d.step3, pm: d.pm, gl: d.gl, directAdj: d.directAdj });
    d.directAdj = s4.directOut; delete s4.directOut;
    const D = derive(S).d3b;
    s4.snap = currentSnap(S, D);
    d.step4 = s4;
    if (!s4.blocked) runLotCheck();
    A.audit('STEP 4 - COST ALLOCATION', s4.blocked ? `BLOCKED · thiếu giá ${s4.missingPrice}; direct lỗi ${s4.directBad}` : `${s4.recon.engineStatus} · Lots=${s4.lots}; RM=${A.fmtNum(s4.totalRM)}; 622=${A.fmtNum(s4.alloc622)}; 627=${A.fmtNum(s4.alloc627)}; Total=${A.fmtNum(s4.sumCost)}`);
    A.markDirty('step4', 'directAdj', 'lotCheck', 'audit');
    A.toast(s4.blocked ? 'STEP 4 BLOCKED – bổ sung giá / FX / GL / phân bổ trực tiếp.' : `STEP 4 xong: ${s4.lots} lô, giá thành ${A.fmtNum(s4.sumCost)} VND.`, s4.blocked ? 'block' : 'pass');
  } catch (e) { A.toast('STEP 4 dừng: ' + e.message, 'block'); }
}

// ======================= migration (from the .xlsm) =======================
export const PHASE2_SHEETS = ['03_WIP_ERP_MAP', '03_WIP_DIRECT_ADJ_INPUT', '03_WIP_DIRECT_ADJ_CONTROL', '03_WIP_DIRECT_632', '04_SALES_IMPORT', '04_SALES_DATA', '04_SO_PRICE', '04_PRICE_MASTER', '04_GL_INPUT', '04_DIRECT_ADJ', '04_COST_ALLOCATION', '04_RECONCILIATION', '04_LOT_COST_CHECK', '05_FG_OPENING', '05_FG_CLOSING'];
const serialToIsoTs = (v) => (typeof v === 'number' ? new Date(Date.UTC(1899, 11, 30) + v * 86400000 - 7 * 3600000).toISOString() : '');

export function migratePhase2(g, S, period) {
  const d = S.d; const cell = (gr, r, c) => (gr && gr[r - 1] ? gr[r - 1][c - 1] : null);
  // ERP map
  const mg = g['03_WIP_ERP_MAP'];
  if (mg) { d.erpMap = { period, rows: [] }; for (let r = 3; r < mg.length; r++) { const x = mg[r] || []; if (!ttxt(x[0])) continue; d.erpMap.rows.push(Object.fromEntries(B.MAP_FIELDS.map((f, i) => [f, x[i] ?? '']))); } }
  // 3B input / reviewer decisions / 632 records
  const w = { input: [] };
  const ig = g['03_WIP_DIRECT_ADJ_INPUT'];
  if (ig) for (let r = 9; r < ig.length; r++) { const x = ig[r] || []; if (!ttxt(x[1])) continue; w.input.push({ code: x[1], desc: x[2], basisQty: x[6], basisAmt: x[7], option: x[8] ?? '', reason: x[9] ?? '', note: x[10] ?? '', sourceVersion: x[15] ?? '' }); }
  const cg = g['03_WIP_DIRECT_ADJ_CONTROL']; const oldCtl = { rows: [] };
  if (cg) for (let r = 9; r < cg.length; r++) { const x = cg[r] || []; if (!ttxt(x[2])) continue; oldCtl.rows.push({ period: x[1], code: x[2], basisQty: x[5], basisAmt: x[6], method: x[7], decision: x[21] ?? '', note: x[22] ?? '', gate: x[23] }); }
  const g6 = g['03_WIP_DIRECT_632']; const reg632 = [];
  if (g6) for (let r = 9; r < g6.length; r++) { const x = g6[r] || []; if (!ttxt(x[2])) continue; reg632.push({ period: x[1], code: x[2], qty: x[5], amt: x[6], ref: x[18] ?? '', postDate: x[19] ?? '', postedBy: x[20] ?? '', record: x[21] ?? '' }); }
  d.wipadj = w;
  let msg3b = '';
  if (d.step3 && w.input.length) {
    w.basis = 'QTY'; // a migrated period keeps the Excel method so it reconciles to the workbook
    const r = B.runBuild({ erpMap: d.erpMap, input: w.input, control: oldCtl, reg632, basis: 'QTY' }, { step3: d.step3, step2: d.step2, datasets: d.datasets, period });
    d.erpMap = r.erpMap; Object.assign(w, { engine: r.engine, detail: r.detail, control: r.control, reg632: r.reg632 });
    const anyApprove = r.control.rows.some((x) => utxt(x.decision) === 'APPROVE');
    const noAdjReason = ttxt(cell(cg, 5, 31)).split(' | ')[0];
    if (anyApprove || noAdjReason) {
      const ap = B.applyControl(r.control, d.step3, noAdjReason || 'Migrated');
      if (ap.mode === 'STOPPED') msg3b = ap.message;
      const inD = B.deriveInput(w.input, d.erpMap, d.step3, period);
      w.reg632 = B.build632(w.control, inD, reg632);
    }
  }
  // Sales
  const sg = g['04_SALES_IMPORT'];
  if (sg) {
    const rows = [];
    for (let r = 5; r < sg.length; r++) { const x = sg[r] || []; if (x[0] === null && x[3] === null) continue; const o = {}; F.SALES_FIELDS.forEach((f, i) => { o[f] = x[i] ?? null; }); Object.assign(o, { txnKey: x[14], validStat: x[15], validMsg: x[16], saveStat: x[17], savedAt: serialToIsoTs(x[18]), batchID: x[19], sourceFile: x[20], importedAt: serialToIsoTs(x[21]), sourceRow: x[22] }); rows.push(o); }
    d.salesImport = { status: ttxt(cell(sg, 2, 2)), rows, mode: ttxt(cell(sg, 2, 6)) || 'YTD', period, fileName: rows[0] ? rows[0].sourceFile : '', importedAt: rows[0] ? rows[0].importedAt : '' };
  }
  const dg = g['04_SALES_DATA'];
  if (dg) {
    const rows = [];
    for (let r = 5; r < dg.length; r++) { const x = dg[r] || []; if (x[0] === null && x[3] === null) continue; const o = {}; F.SALES_FIELDS.forEach((f, i) => { o[f] = x[i] ?? null; }); Object.assign(o, { include: x[14], validResult: x[15], txnKey: x[16], batchID: x[17], sourceFile: x[18], savedAt: serialToIsoTs(x[19]), sourceRow: x[20] }); rows.push(o); }
    d.salesDB = { rows, savedAt: serialToIsoTs(cell(dg, 2, 2)), latestInvoice: cell(dg, 2, 4) };
  }
  const og = g['04_SO_PRICE'];
  if (og) { d.soPrice = []; for (let r = 5; r < og.length; r++) { const x = og[r] || []; if (!ttxt(x[1]) && !ttxt(x[0])) continue; d.soPrice.push({ active: x[0] ?? '', product: x[1], soDate: x[2], soNo: x[3], customer: x[4], qty: x[5], price: x[6], note: x[7], check: x[8] ?? '' }); } }
  const pg = g['04_PRICE_MASTER'];
  if (pg) {
    d.manualPrice = [];
    for (let r = 5; r < pg.length; r++) { const x = pg[r] || []; if (ttxt(x[10])) d.manualPrice.push({ product: x[10], price: x[11], effFrom: x[12], effTo: x[13], source: x[14], approvedBy: x[15], updatedAt: serialToIsoTs(x[16]) || x[16] }); }
    // visible manual overrides in E:F that are not yet persisted
    for (let r = 5; r < pg.length; r++) { const x = pg[r] || []; if (ttxt(x[0]) && num(x[4]) > 0 && !d.manualPrice.some((m) => utxt(m.product) === utxt(x[0]))) d.manualPrice.push({ product: utxt(x[0]), price: num(x[4]), source: x[5] ?? '', updatedAt: nowISO() }); }
  }
  const glg = g['04_GL_INPUT'];
  if (glg) d.gl = { period: ttxt(cell(glg, 5, 10)), fx: cell(glg, 4, 3), gl622: cell(glg, 5, 3), gl627: cell(glg, 6, 3), preparedBy: cell(glg, 6, 10) ?? '', sourceRef: cell(glg, 8, 10) ?? '', ytd622: cell(glg, 18, 3), ytd627: cell(glg, 19, 3), prevRef: { fx: cell(glg, 4, 5), gl622: cell(glg, 5, 5), gl627: cell(glg, 6, 5) }, updatedAt: nowISO() };
  const ag = g['04_DIRECT_ADJ'];
  if (ag) { d.directAdj = []; for (let r = 5; r < ag.length; r++) { const x = ag[r] || []; if (![0, 1, 2, 3, 4, 5].some((c) => ttxt(x[c]))) continue; d.directAdj.push({ active: x[0] ?? '', erp: x[1] ?? '', account: x[2] ?? '', amount: x[3], pc: x[4] ?? '', prod: x[5] ?? '', reason: x[6] ?? '', status: x[7] ?? '' }); } }
  const lg = g['04_LOT_COST_CHECK'];
  if (lg) d.lotParams = { hiX: num(cell(lg, 3, 2)) || 2, loX: num(cell(lg, 4, 2)) || 0.5, minN: num(cell(lg, 5, 2)) || 3, minImp: num(cell(lg, 6, 2)) || 1000000 };
  // FG reference for the lot check (opening layers + closing qty) until Step 5 runs on the web
  const fo = g['05_FG_OPENING'], fc = g['05_FG_CLOSING'];
  d.fgRef = { opening: [], closingQty: {} };
  if (fo) for (let r = 5; r < fo.length; r++) { const x = fo[r] || []; if (ttxt(x[2])) d.fgRef.opening.push({ prod: x[7], qty: x[11], rm: x[12] }); }
  if (fc) for (let r = 5; r < fc.length; r++) { const x = fc[r] || []; if (!ttxt(x[2])) continue; const k = ttxt(x[4]) + '|' + ttxt(x[7]); d.fgRef.closingQty[k] = num(d.fgRef.closingQty[k]) + num(x[11]); }
  // Price Master + Step 4
  let msg4 = '';
  try {
    if (d.salesDB && d.step2) { const r = F.updatePriceMaster({ salesDB: d.salesDB, so: d.soPrice, manual: d.manualPrice, step2: d.step2, period }); d.pm = r.pm; d.soPrice = r.so; }
    const gm = gateMsg(S);
    if (gm) msg4 = gm; else doStep4Silent(S);
  } catch (e) { msg4 = e.message; }
  // comparison with the workbook
  const fl = derive(S).d4.fl; const D3 = derive(S).d3b;
  const ca = g['04_COST_ALLOCATION']; const rec = g['04_RECONCILIATION']; const wa = g['03_WIP_ALLOCATION'];
  const lc = g['04_LOT_COST_CHECK'];
  const cmp = [
    ['STEP 3B · Closing WIP cuối (sau điều chỉnh)', D3 ? D3.wf.finalClosing : null, cell(wa, 6, 28)],
    ['STEP 3B · Điều chỉnh vào PC', D3 ? D3.engPosted : null, cell(rec, 20, 9)],
    ['STEP 4 · Số lô', d.step4 ? d.step4.lots : null, cell(rec, 4, 3)],
    ['STEP 4 · Tổng RM', fl ? fl.totals.totalRM : null, cell(rec, 24, 3)],
    ['STEP 4 · 622 đã phân bổ', d.step4 ? d.step4.alloc622 : null, cell(rec, 12, 3)],
    ['STEP 4 · 627 đã phân bổ', d.step4 ? d.step4.alloc627 : null, cell(rec, 13, 3)],
    ['STEP 4 · Tổng giá thành SX', fl ? fl.totals.totalCost : null, cell(rec, 17, 3)],
    ['STEP 4 · Lô bất thường đơn giá', d.lotCheck ? d.lotCheck.count : null, cell(lc, 5, 5)],
  ];
  return { cmp, msg: [msg3b, msg4].filter(Boolean).join(' · ') };
}
function doStep4Silent(S) {
  const d = S.d;
  const s4 = F.runStep4({ period: S.period, step2: d.step2, step3: d.step3, pm: d.pm, gl: d.gl, directAdj: d.directAdj });
  d.directAdj = s4.directOut; delete s4.directOut;
  s4.snap = currentSnap(S, derive(S).d3b);
  d.step4 = s4;
  if (!s4.blocked) runLotCheck();
}

/** Data carried into the next period. */
export function carryForward(prev, newPeriod) {
  const out = {};
  if (prev.erpMap) out.erpMap = { period: newPeriod, rows: prev.erpMap.rows };
  if (prev.salesDB) out.salesDB = prev.salesDB;
  if (prev.returnsDB) out.returnsDB = prev.returnsDB;
  if (prev.soPrice) out.soPrice = prev.soPrice.map((r) => ({ ...r, check: '' }));
  if (prev.manualPrice) out.manualPrice = prev.manualPrice;
  if (prev.lotParams) out.lotParams = prev.lotParams;
  if (prev.gl) out.gl = { period: '', fx: prev.gl.fx, gl622: null, gl627: null, prevRef: { fx: prev.gl.fx, gl622: prev.gl.gl622, gl627: prev.gl.gl627 } };
  return out;
}

export const PHASE2_BLOBS = ['erpMap', 'wipadj', 'salesImport', 'salesDB', 'returnsImport', 'returnsDB', 'soPrice', 'manualPrice', 'pm', 'gl', 'directAdj', 'directPreparedBy', 'directApproval', 'step4', 'lotCheck', 'lotParams', 'fgRef'];
export { RW_FIELDS, F, B };
