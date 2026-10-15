// v1.14.59: Vietnamese / English switch.
// The views are written in Vietnamese. In English mode every Vietnamese text node and placeholder / title / aria-label
// is looked up in EN (src/i18n-en.js) after it reaches the page (render + MutationObserver), so tables, tabs and
// re-renders are covered without touching each view. Numbers are matched as {#} and put back in order.
// v1.14.72: in Vietnamese mode the English text the app writes itself (checks, notes, labels) is looked up in
// VI_FROM_EN (src/i18n-vi.js) the same way. Text that is not in a dictionary (data, rare messages) stays as it is.
import { EN, MSG_EXACT, MSG_PREFIX, MSG_WILD, SRC_EXACT, SRC_WILD } from './i18n-en.js';
import { VI_FROM_EN } from './i18n-vi.js';

const KEY = 'svl.lang';
const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]/;
const NUM = /\d[\d.,:/-]*\d|\d/g;
let lang = (() => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'; } catch { return 'vi'; } })();
export const getLang = () => lang;

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// messages with values inside: compiled once; the values are kept as they are
const WILD = MSG_WILD.map((w) => ({ re: new RegExp('^' + w.vi.map((p) => esc(p.replace(/\s+/g, ' '))).join('([\\s\\S]*?)') + (w.prefix ? '([\\s\\S]*)$' : '$')), en: w.en, prefix: w.prefix }));
// source segments with values: most specific first; each pattern is only tried when its longest literal piece is present
const SRC = SRC_WILD.map(([vi, en]) => {
  const parts = vi.split('{*}');
  const lit = parts.map((p) => p.trim()).sort((a, b) => b.length - a.length)[0] || '';
  return { re: new RegExp('^' + parts.map((p) => esc(p)).join('([\\s\\S]*?)') + '$'), en, lit, size: parts.join('').length };
}).filter((x) => x.lit).sort((a, b) => b.size - a.size);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function lookup(core) {
  if (has(EN, core)) return EN[core];
  if (has(MSG_EXACT, core)) return MSG_EXACT[core];
  if (has(SRC_EXACT, core)) return SRC_EXACT[core];
  const nums = core.match(NUM);
  if (!nums) return null;
  const k = core.replace(NUM, '{#}');
  if (!Object.prototype.hasOwnProperty.call(EN, k)) return null;
  let i = 0;
  return EN[k].replace(/\{#\}/g, () => (i < nums.length ? nums[i++] : ''));
}
// patterns that carry codes / file names rather than plain numbers
const RULES = [
  [/^Truy xuất giá thành (.+)$/, (m) => `Cost trace ${m[1]}`],
  [/^Tiêu hao (.+) dòng (\d+)$/, (m) => `Consumption ${m[1]} line ${m[2]}`],
  [/^Chọn (\S+)$/, (m) => `Select ${m[1]}`],
  [/^(.+) · dòng tiêu đề (.+?) · (.+?) dòng · import (.+)$/, (m) => `${m[1]} · header row ${m[2]} · ${m[3]} rows · imported ${m[4]}`],
  [/^(.+) · IMPORTED · (.+) dòng$/, (m) => `${m[1]} · IMPORTED · ${m[2]} rows`],
  [/^(.+) · (\S+) dòng Total Cost = (\S+) · (\S+) vật tư$/, (m) => `${m[1]} · ${m[2]} lines Total Cost = ${m[3]} · ${m[4]} materials`],
  [/^(.+) · (\S+) báo cáo ERP · Opening (\S+) dòng · Rework (\S+) dòng$/, (m) => `${m[1]} · ${m[2]} ERP reports · Opening ${m[3]} rows · Rework ${m[4]} rows`],
  [/^Nguồn: (.+) · Kỳ: (.+) · Thay đổi lúc (.+)$/, (m) => `Source: ${m[1]} · Period: ${m[2]} · Changed at ${m[3]}`],
  [/^Lần chạy gần nhất (.+?) · Nguồn opening: (.+)$/, (m) => `Last run ${m[1]} · Opening source: ${m[2]}`],
  [/^Nguồn: (.+) · nạp (.+)$/, (m) => `Source: ${m[1]} · loaded ${m[2]}`],
  [/^(\S+@\S+) · (.+)$/, (m) => { const r = tr(m[2]); return r === null ? null : `${m[1]} · ${r}`; }],
  // navigation tooltips: "<no> · <label> – <STATUS>"
  [/^(.*?)\s*·\s*(.+?) – (.+)$/, (m) => { const r = tr(m[2]); if (r === null) return null; return `${m[1]} · ${r} – ${tr(m[3]) ?? m[3]}`; }],
  [/^Đang lưu (.+)…$/, (m) => `Saving ${m[1]}…`],
  [/^Cập nhật (\d.*)$/, (m) => `Updated ${m[1]}`],
  [/^(.+?) (đã thay đổi trạng thái sau khi dữ liệu được cập nhật\.?)$/, (m) => `${m[1]} ${tr(m[2])}`],
  // leading bullet / dash and a trailing full stop around a known phrase
  [/^([•—–\-]\s*)(.+)$/, (m) => { const r = tr(m[2]); return r === null ? null : m[1] + r; }],
  [/^(.+?)([.:?])$/, (m) => { const r = tr(m[1]); return r === null ? null : r + m[2]; }],
  [/^Đã import (\S+) báo cáo \(mới (\S+), thay thế (\S+)\)\.(.*)$/, (m) => `Imported ${m[1]} reports (new ${m[2]}, replaced ${m[3]}).` + m[4].replace('Cảnh báo (đã import):', 'Warnings (imported):').replace('Trùng:', 'Duplicates:').replace('Bỏ qua:', 'Skipped:')],
];
/** Translate one string; null when there is no translation. */
// Vietnamese labels written without diacritics (the detector cannot see them)
const PLAIN = { 'Doanh thu & Price Master': 'Revenue & Price Master', 'Doanh thu VND': 'Revenue VND', 'Doanh thu': 'Revenue', 'WIP ra (PC + MR + Stock Out)': 'WIP out (PC + MR + Stock Out)' };
const CACHE = new Map();
// a captured piece keeps its own leading / trailing spaces
const piece = (v) => { const r = tr(v); return r === null ? v : v.match(/^\s*/)[0] + r + v.match(/\s*$/)[0]; };
const viCount = (x) => (x.match(new RegExp(VI.source, 'g')) || []).length;
export function tr(s) {
  if (s === null || s === undefined) return null;
  const core = String(s).replace(/\s+/g, ' ').trim();
  if (!core) return null;
  if (CACHE.has(core)) return CACHE.get(core);
  const r = trCore(core);
  if (CACHE.size > 20000) CACHE.clear();
  CACHE.set(core, r);
  return r;
}
function trCore(core) {
  if (Object.prototype.hasOwnProperty.call(PLAIN, core)) return PLAIN[core];
  if (!VI.test(core)) return null;
  const hit = lookup(core);
  if (hit !== null) return hit;
  // try every stage; the first clean English result wins, else the one with the least Vietnamese left
  let best = null, bestN = Infinity;
  const take = (r) => { if (r === null || r === undefined) return false; const n = viCount(r); if (n < bestN) { best = r; bestN = n; } return n === 0; };
  for (const [re, fn] of RULES) { const m = re.exec(core); if (m && take(fn(m, core))) return best; }
  for (const [vi, en] of MSG_PREFIX) if (core.startsWith(vi)) { const rest = core.slice(vi.length).trim(); if (take(`${en} ${tr(rest) ?? rest}`.trim())) return best; break; }
  for (const w of WILD) {
    const m = w.re.exec(core); if (!m) continue;
    let i = 1; const vals = m.slice(1);
    let out = w.en.replace(/\{\*\}/g, () => { const v = m[i++]; return v === undefined ? '' : piece(v); });
    if (w.prefix && vals.length) { const last = vals[vals.length - 1] || ''; out += ' ' + (tr(last) ?? last); }
    if (take(out.trim())) return best; break;
  }
  for (const w of SRC) {
    if (!core.includes(w.lit)) continue;
    const m = w.re.exec(core); if (!m) continue;
    let i = 1;
    if (take(w.en.replace(/\{\*\}/g, () => { const v = m[i++]; return v === undefined ? '' : piece(v); }).replace(/\s+/g, ' ').trim())) return best;
    break;
  }
  take(split(core));
  return best;
}
// last resort: cut a composite message at its separators and translate the pieces (data pieces stay as they are)
const SEPS = [/(?<=[.!?])\s+/, / – /, / · /, /; /, /: /, /, /];
function split(core) {
  for (const re of SEPS) {
    const sep = core.match(re); if (!sep) continue;
    const parts = core.split(re); if (parts.length < 2) continue;
    let hit = false;
    const out = parts.map((p) => { const r = tr(p); if (r !== null) { hit = true; return r; } return p; });
    if (hit) return out.join(re.source.startsWith('(?<=') ? ' ' : sep[0]);
  }
  return null;
}
// v1.14.72: English text the app writes itself, shown in Vietnamese (VI_FROM_EN). Same key rules as EN above.
const VI_CACHE = new Map();
export function trVi(s) {
  if (s === null || s === undefined) return null;
  const core = String(s).replace(/\s+/g, ' ').trim();
  if (!core) return null;
  if (VI_CACHE.has(core)) return VI_CACHE.get(core);
  const r = trViCore(core);
  if (VI_CACHE.size > 20000) VI_CACHE.clear();
  VI_CACHE.set(core, r);
  return r;
}
function trViCore(core) {
  if (has(VI_FROM_EN, core)) return VI_FROM_EN[core];
  const nums = core.match(NUM);
  if (nums) {
    const k = core.replace(NUM, '{#}');
    if (has(VI_FROM_EN, k)) { let i = 0; return VI_FROM_EN[k].replace(/\{#\}/g, () => (i < nums.length ? nums[i++] : '')); }
  }
  // a unit-cost message with the review flag appended after a space
  const flag = core.match(/^(Unit cost after provision .*? provision needed [\d.,]+) (STEP 4 REVIEW: .+)$/);
  if (flag) { const a = trVi(flag[1]), b = trVi(flag[2]); if (a !== null || b !== null) return `${a ?? flag[1]} ${b ?? flag[2]}`; }
  // composite text ("a; b"): translate the known pieces and keep the rest
  const parts = core.split('; ');
  if (parts.length > 1) {
    let hit = false;
    const out = parts.map((p) => { const r = trVi(p); if (r !== null) { hit = true; return r; } return p; });
    if (hit) return out.join('; ');
  }
  return null;
}
/** Text for code that builds strings itself (toasts, confirm dialogs): the current language when available. */
export const t = (s) => (lang === 'en' ? (tr(s) ?? s) : (trVi(s) ?? s));

const ATTRS = ['placeholder', 'title', 'aria-label'];
const PLAIN_RE = /Doanh thu|WIP ra/;
// the app's own text before it was translated (src) and what was put in its place (out), so switching language
// restores nodes that are not re-rendered (header, open panels) and a change made by the app is not mistaken for ours
const origText = new WeakMap(), origAttr = new WeakMap();
/** Translation of one text in the current language (EN mode: Vietnamese source; VI mode: English source). */
function translateTextIn(v) {
  return lang === 'en' ? (VI.test(v) || PLAIN_RE.test(v) ? tr(v) : null) : trVi(v);
}
function translateText(n) {
  const v = n.nodeValue; if (!v) return;
  const seen = origText.get(n);
  if (seen && seen.out === v) return;
  const r = translateTextIn(v);
  if (r === null) { origText.delete(n); return; }
  const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
  const out = lead + r + trail;
  origText.set(n, { src: v, out });
  n.nodeValue = out;
}
function translateEl(el) {
  if (!el.getAttribute) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v) continue;
    const seen = origAttr.get(el)?.[a];
    if (seen && seen.out === v) continue;
    const r = translateTextIn(v);
    if (r === null) { if (seen) delete origAttr.get(el)[a]; continue; }
    const o = origAttr.get(el) || {};
    o[a] = { src: v, out: r };
    origAttr.set(el, o);
    el.setAttribute(a, r);
  }
}
/** Translate a subtree into the current language. */
export function apply(root = document.body) {
  if (!root) return;
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1) return;
  if (root.closest && root.closest('[data-no-i18n]')) return;
  translateEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const p = n.parentElement; if (p && !['SCRIPT', 'STYLE', 'TEXTAREA'].includes(p.tagName)) translateText(n); }
    else translateEl(n);
  }
}
let observer = null, pending = new Set(), scheduled = false;
function flush() { scheduled = false; const list = [...pending]; pending = new Set(); for (const n of list) if (n.isConnected) apply(n); }
function watch() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') pending.add(m.target);
      else if (m.type === 'attributes') pending.add(m.target);
      else for (const n of m.addedNodes) pending.add(n);
    }
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
function restore(root = document.body) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const o = origText.get(n); if (o) { n.nodeValue = o.src; origText.delete(n); } }
    else { const o = origAttr.get(n); if (o) { for (const a of Object.keys(o)) n.setAttribute(a, o[a].src); origAttr.delete(n); } }
  }
}
/** Switch language and re-render. The app's own text is put back first, then the new language is applied to it. */
export function setLang(l, rerender) {
  lang = l === 'en' ? 'en' : 'vi';
  restore(document.body);
  try { localStorage.setItem(KEY, lang); } catch {}
  document.documentElement.lang = lang;
  syncButton();
  if (rerender) rerender();
  apply(document.body);
}
function syncButton() {
  const b = document.getElementById('lang'); if (!b) return;
  b.textContent = lang === 'en' ? 'VI' : 'EN';
  // the label names the action (switch to the other language) and is written in the current language
  const label = lang === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang tiếng Anh';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.dataset.noI18n = '';
}
/** Multi-line messages keep their line breaks: each line is translated on its own. */
function trLines(msg) {
  const T = lang === 'en' ? tr : trVi;
  if (!msg.includes('\n')) return T(msg) ?? msg;
  return msg.split('\n').map((l) => { const r = T(l); return r === null ? l : l.match(/^\s*/)[0] + r; }).join('\n');
}
/** Native dialogs (confirm / prompt / alert) show the message in the current language. */
function wrapDialogs() {
  for (const name of ['confirm', 'prompt', 'alert']) {
    const orig = window[name]; if (typeof orig !== 'function' || orig.__i18n) continue;
    const f = function (msg, ...rest) { return orig.call(window, typeof msg === 'string' ? trLines(msg) : msg, ...rest); };
    f.__i18n = true; window[name] = f;
  }
}
/** Wire the header button and start watching the page. */
export function initI18n(rerender) {
  document.documentElement.lang = lang;
  wrapDialogs();
  const b = document.getElementById('lang');
  if (b) b.addEventListener('click', () => { setLang(lang === 'en' ? 'vi' : 'en', rerender); });
  syncButton();
  watch();
  apply(document.body);
}
