// v1.14.93 — Xưởng giá thành: the stations of the month close as characters in a pixel-art office.
// Idea from Habblaud (github.com/marmottajr/habblaud, MIT © 2026 Márcio Junior): a virtual office where each agent is a
// character showing what it is doing. Nothing is copied: the room, furniture and characters are drawn here by code.
// The state of each station comes from engine/workshop.js (the same statuses as the process rail); this view only draws.
import { STATE_LABEL } from '../engine/workshop.js';

const W = 384, H = 312;          // logical pixels; drawn at ×SC so the pixels stay square and the name tags crisp
const SC = 3;
const COLS = [70, 192, 314], ROWS = [114, 194, 274]; // desk centres
const BADGE = { done: '#2e7d4f', review: '#9a6412', turn: '#1f6f5c', rerun: '#5b4f9a', blocked: '#b4402f', waiting: '#7d8a90', closed: '#2e7d4f' };

let timer = null;
let selected = '';

/** el: container · x = { model, period, esc, pill, fmtTs } */
export function view(el, x) {
  const { model, period, esc } = x;
  const sm = model.summary;
  if (!model.stations.some((s) => s.id === selected)) selected = (model.stations.find((s) => s.state === 'blocked') || model.stations.find((s) => s.state === 'turn') || model.stations[0]).id;
  const head = model.stations[0].state === 'closed' ? 'đã đóng – cả xưởng nghỉ ngơi.'
    : `${sm.done} / ${sm.total} trạm xong${sm.blocked ? ` · <b class="ws-red">${sm.blocked} trạm cần xử lý</b>` : ''}${sm.rerun ? ` · ${sm.rerun} trạm phải chạy lại` : ''}${sm.turn ? ` · đến lượt: <b>${esc(sm.turn)}</b>` : ''}`;
  el.innerHTML = `<section class="page ws">
    <header class="ph"><div><h1>Xưởng giá thành</h1><p class="lead">Kỳ ${esc(period)} · ${head}</p></div></header>
    <div class="ws-grid">
      <div class="ws-stage"><canvas id="ws-canvas" width="${W * SC}" height="${H * SC}" role="img" aria-label="${esc(`Xưởng giá thành kỳ ${period}: ${model.stations.map((s) => `${s.name} ${STATE_LABEL[s.state]}`).join(', ')}`)}"></canvas>
        <div class="ws-legend">${['turn', 'done', 'review', 'rerun', 'blocked', 'waiting'].map((k) => `<span><i style="background:${BADGE[k]}"></i>${esc(STATE_LABEL[k])}</span>`).join('')}</div></div>
      <aside class="ws-side">
        <div class="ws-list" role="list">${model.stations.map((s) => `<button type="button" role="listitem" class="ws-item ${s.id === selected ? 'on' : ''}" data-ws="${s.id}">
          <span class="ws-dot" style="background:${BADGE[s.state]}"></span><span class="ws-nm"><b>${esc(s.no)} · ${esc(s.name)}</b><small>${esc(STATE_LABEL[s.state])}</small></span></button>`).join('')}</div>
        <div class="ws-detail" id="ws-detail"></div>
      </aside>
    </div>
    <p class="muted ws-note">Mỗi chú mèo là một trạm của quy trình đóng kỳ; trạng thái lấy từ dữ liệu thật của kỳ (cùng nguồn với thanh quy trình bên trái). Bấm vào mèo hoặc tên trạm để xem chi tiết. Ý tưởng từ Habblaud (MIT).</p>
  </section>`;
  const detail = () => {
    const s = model.stations.find((t) => t.id === selected);
    el.querySelector('#ws-detail').innerHTML = `<h3>${esc(s.no)} · ${esc(s.name)} <span class="ws-badge" style="background:${BADGE[s.state]}">${esc(STATE_LABEL[s.state])}</span></h3>
      <p class="muted">${esc(s.role)}</p>
      <table class="cp ws-st"><tbody>${s.statuses.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${x.pill(v)}</td></tr>`).join('')}</tbody></table>
      ${s.next && !['done', 'closed'].includes(s.state) ? `<p><b>Việc tiếp theo:</b> ${esc(s.next)}</p>` : ''}
      ${s.last ? `<p class="muted">Gần nhất: ${esc(s.last.action)} · ${esc(s.last.by)} · ${x.fmtTs(s.last.at)}</p>` : '<p class="muted">Chưa có thao tác nào trong nhật ký kỳ.</p>'}
      <a class="btn" href="#${esc(s.hash)}">Mở bước ${esc(s.no)}</a>`;
    el.querySelectorAll('.ws-item').forEach((b) => b.classList.toggle('on', b.dataset.ws === selected));
  };
  detail();
  el.querySelectorAll('.ws-item').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.ws; detail(); paint(); }));
  const cv = el.querySelector('#ws-canvas');
  const ctx = cv.getContext('2d');
  ctx.setTransform(SC, 0, 0, SC, 0, 0); ctx.imageSmoothingEnabled = false;
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
    const i = model.stations.findIndex((_, k) => Math.abs(px - COLS[k % 3]) < 52 && py > ROWS[Math.floor(k / 3)] - 48 && py < ROWS[Math.floor(k / 3)] + 18);
    if (i >= 0) { selected = model.stations[i].id; detail(); paint(); }
  });
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  const paint = () => draw(ctx, model, t, selected);
  if (timer) clearInterval(timer);
  paint();
  if (!reduce) timer = setInterval(() => {
    if (!cv.isConnected) { clearInterval(timer); timer = null; return; }
    if (document.hidden) return;
    t++; paint();
  }, 160);
}

// ======================= drawing (all pixel art generated here) =======================
function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
function px(c, x, y, rows, pal) { // rows: strings, each char a palette key ('.' = transparent)
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.') rect(c, x + i, y + j, 1, 1, pal[k]); } });
}

function sky(c, hour) {
  const night = hour < 6 || hour >= 19, dusk = hour >= 17 && hour < 19;
  return { night, top: night ? '#16213e' : dusk ? '#f39c6b' : '#8ecae6', low: night ? '#243b6b' : dusk ? '#fcd5a5' : '#cfeffd' };
}

function room(c, t) {
  const hr = new Date().getHours(); const s = sky(c, hr);
  // wall + windows
  rect(c, 0, 0, W, 52, '#d9cbb5'); rect(c, 0, 50, W, 4, '#b8a58a');
  for (const wx of [36, 156, 276]) {
    rect(c, wx - 2, 8, 76, 34, '#6b5a45');
    for (let y = 0; y < 30; y++) rect(c, wx, 10 + y, 72, 1, y < 15 ? s.top : s.low);
    if (s.night) for (let k = 0; k < 6; k++) rect(c, wx + ((k * 23 + wx) % 70), 12 + ((k * 7) % 12), 1, 1, '#fff7c2');
    else { rect(c, wx + 50, 16, 8, 3, '#ffffff'); rect(c, wx + 47, 18, 14, 3, '#ffffff'); }
    rect(c, wx + 35, 10, 2, 30, '#6b5a45'); rect(c, wx, 25, 72, 2, '#6b5a45');
  }
  // clock
  rect(c, 128, 14, 14, 14, '#4a3b2c'); rect(c, 130, 16, 10, 10, '#fdfaf2');
  const a = (t / 40) % (Math.PI * 2); rect(c, 135, 21, 1, 1, '#222');
  rect(c, 135 + Math.round(Math.cos(a) * 3), 21 + Math.round(Math.sin(a) * 3), 1, 1, '#222');
  // floor tiles
  for (let y = 54; y < H; y += 12) for (let x = 0; x < W; x += 12) rect(c, x, y, 12, 12, ((x + y) / 12) % 2 ? '#e7dfcf' : '#efe8da');
  // rug + plants
  rect(c, 132, 66, 120, 2, '#cdbfa6');
  plant(c, 6, 56); plant(c, W - 18, 56); plant(c, 6, H - 26); plant(c, W - 18, H - 26);
  if (s.night) { c.globalAlpha = 0.18; rect(c, 0, 0, W, H, '#0b1530'); c.globalAlpha = 1; }
}
function plant(c, x, y) {
  rect(c, x + 2, y + 12, 8, 8, '#a0522d'); rect(c, x + 3, y + 12, 6, 1, '#7a3e21');
  px(c, x, y, ['...gg...', '..gGgg..', '.gGggGg.', 'gGggGggg', '.ggGggg.', '..gggg..', '...gg...', '....g...', '....g...', '....g...', '....g...', '....g...'].map((r) => r.padEnd(12, '.')), { g: '#3f8f4f', G: '#5fb36a' });
}

function desk(c, cx, cy, glow) {
  rect(c, cx - 24, cy - 2, 48, 10, '#9b6b43'); rect(c, cx - 24, cy - 2, 48, 2, '#b8845a'); rect(c, cx - 22, cy + 8, 3, 8, '#7a5233'); rect(c, cx + 19, cy + 8, 3, 8, '#7a5233');
  // laptop (lid towards us) with screen glow
  rect(c, cx + 6, cy - 10, 16, 9, '#5a6570'); rect(c, cx + 7, cy - 9, 14, 7, '#6f7b86');
  if (glow) { c.globalAlpha = 0.4; rect(c, cx + 4, cy - 13, 20, 3, glow); c.globalAlpha = 1; }
  rect(c, cx + 4, cy - 1, 20, 2, '#3d454d');
  // mug
  rect(c, cx - 21, cy - 5, 4, 4, '#f5f5f5'); rect(c, cx - 17, cy - 4, 1, 2, '#f5f5f5');
}

// v1.14.94: the staff are cats – 9 coats, a seated (head + chest above the desk) or standing cat, 12 px wide
const CATS = [
  { name: 'cam vằn', f: '#e8913a', d: '#b8611b', w: '#fbe3c4', k: '#3fae5a', mark: 'tabby' },
  { name: 'mun', f: '#2e2e36', d: '#1b1b20', w: '#4b4b57', k: '#e5c33a', o: '#111114' },
  { name: 'trắng', f: '#f6f3ec', d: '#ddd5c6', w: '#ffffff', k: '#4aa3df' },
  { name: 'xám', f: '#8d949c', d: '#6a7078', w: '#cdd2d6', k: '#e5c33a' },
  { name: 'tam thể', f: '#f6f3ec', d: '#2e2e36', w: '#ffffff', k: '#3fae5a', mark: 'calico', p2: '#e8913a' },
  { name: 'Xiêm', f: '#efe0c8', d: '#5a4232', w: '#f8efe0', k: '#4aa3df', mark: 'points' },
  { name: 'mướp xám', f: '#7d8fa3', d: '#56677a', w: '#c9d3dd', k: '#e5c33a', mark: 'tabby' },
  { name: 'kem', f: '#f2d8a7', d: '#d6b077', w: '#fbefd8', k: '#3fae5a', mark: 'tabby' },
  { name: 'mèo mặc vest', f: '#2e2e36', d: '#1b1b20', w: '#ffffff', k: '#3fae5a', o: '#111114', mark: 'tuxedo' },
];
/** A cat drawn at ×2 (its own pixels stay square). */
function cat(c, x, y, i, pose, t) { c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(2, 2); catSprite(c, 0, 0, i, pose, t); c.restore(); }
function catSprite(c, x, y, i, pose, t) {
  const C = CATS[i % CATS.length];
  const pal = { o: C.o || '#3b2f2a', f: C.f, d: C.d, w: C.w, p: '#f2a1ac', k: C.k, n: '#d86b7a', b: '#111' };
  const sleep = pose === 'sleep';
  const hy = y + (sleep ? 4 : 0);
  const blink = sleep || t % 23 === 0;
  // tail behind the body, swaying (up for the standing poses)
  const sway = [0, 1, 2, 1][t % 4];
  if (pose === 'raise' || pose === 'cheer') { for (let k = 0; k < 7; k++) rect(c, x + 12 + (k > 4 ? sway : 0), y + 14 - k, 2, 1, C.f); rect(c, x + 12 + sway, y + 7, 2, 1, C.d); }
  else if (!sleep) { rect(c, x + 12, hy + 12, 3, 2, C.f); rect(c, x + 14, hy + 10 - sway, 2, 3, C.f); rect(c, x + 14, hy + 9 - sway, 2, 1, C.d); }
  // head
  px(c, x, hy, [
    '.o........o.',
    'ofo......ofo',
    'opfoooooofpo',
    'offffffffffo',
    blink ? 'ofbbffffbbfo' : 'ofkkffffkkfo',
    'offffnnffffo',
    'ofwwwwwwwwfo',
    '.offffffffo.',
    '..oooooooo..',
  ], pal);
  if (!blink) { rect(c, x + 3, hy + 4, 1, 1, '#111'); rect(c, x + 9, hy + 4, 1, 1, '#111'); } // pupils
  // whiskers
  c.globalAlpha = 0.55; rect(c, x - 2, hy + 5, 2, 1, '#555'); rect(c, x - 2, hy + 7, 2, 1, '#555'); rect(c, x + 12, hy + 5, 2, 1, '#555'); rect(c, x + 12, hy + 7, 2, 1, '#555'); c.globalAlpha = 1;
  // coat markings
  if (C.mark === 'tabby') { rect(c, x + 4, hy + 3, 1, 1, C.d); rect(c, x + 6, hy + 3, 1, 1, C.d); rect(c, x + 8, hy + 3, 1, 1, C.d); rect(c, x + 5, hy + 2, 2, 1, C.d); }
  if (C.mark === 'calico') { rect(c, x + 1, hy + 2, 3, 3, C.p2); rect(c, x + 8, hy + 2, 3, 2, C.d); rect(c, x + 2, hy + 1, 1, 1, C.p2); }
  if (C.mark === 'points') { rect(c, x + 3, hy + 5, 6, 3, C.d); rect(c, x + 5, hy + 5, 2, 1, pal.n); rect(c, x + 1, hy + 1, 1, 1, C.d); rect(c, x + 10, hy + 1, 1, 1, C.d); }
  // body (chest)
  const by = hy + 9;
  px(c, x, by, ['.offffffffo.', 'offfwwwwfffo', 'offfwwwwfffo', 'offffwwffffo', 'offffffffffo'], pal);
  if (C.mark === 'tuxedo') { rect(c, x + 5, by + 1, 2, 1, '#c0465a'); rect(c, x + 4, by + 1, 1, 1, '#8f2f40'); rect(c, x + 7, by + 1, 1, 1, '#8f2f40'); } // bow tie
  if (C.mark === 'calico') { rect(c, x + 8, by + 1, 3, 3, C.p2); }
  if (C.mark === 'tabby') { rect(c, x + 2, by + 2, 1, 1, C.d); rect(c, x + 9, by + 2, 1, 1, C.d); rect(c, x + 2, by + 4, 1, 1, C.d); rect(c, x + 9, by + 4, 1, 1, C.d); }
  const paw = C.mark === 'points' ? C.d : C.mark === 'tuxedo' ? '#ffffff' : C.w;
  if (pose === 'type') { // paws on the keyboard, tapping in turn
    rect(c, x + 2, by + 4 + (t % 2), 3, 2, paw); rect(c, x + 7, by + 4 + ((t + 1) % 2), 3, 2, paw);
  } else if (pose === 'raise' || pose === 'cheer') {
    px(c, x, by + 5, ['.offo..offo.', '.offo..offo.', '.offo..offo.', '.oppo..oppo.'].map((r) => r.replace(/p/g, 'w')), pal);
    const up = t % 2;
    rect(c, x + 11, by - 7 + up, 2, 8, C.f); rect(c, x + 11, by - 9 + up, 3, 2, paw); // waving paw
    if (pose === 'cheer') { rect(c, x - 1, by - 7 + up, 2, 8, C.f); rect(c, x - 2, by - 9 + up, 3, 2, paw); }
  } else { rect(c, x + 2, by + 4, 3, 2, paw); rect(c, x + 7, by + 4, 3, 2, paw); }
}
export const CAT_NAMES = CATS.map((c) => c.name);

function bubble(c, x, y, col, draw) {
  rect(c, x, y, 13, 11, '#ffffff'); rect(c, x - 1, y + 1, 15, 9, '#ffffff'); rect(c, x + 3, y + 11, 3, 2, '#ffffff');
  c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(x - 0.5, y + 0.5, 14, 10);
  draw(x, y);
}
const GLYPH = {
  ok: ['.......1', '......1.', '1....1..', '.1..1...', '..11....'],
  bang: ['1', '1', '1', '.', '1'],
  q: ['111', '..1', '.1.', '...', '.1.'],
  dots: ['1.1.1'],
  hour: ['11111', '.111.', '..1..', '.111.', '11111'],
};
function glyph(c, x, y, g, col) { px(c, x, y, GLYPH[g], { 1: col }); }

function nameTag(c, cx, y, text, col, sel) {
  c.font = '600 7px system-ui, sans-serif'; const w = Math.ceil(c.measureText(text).width) + 6;
  rect(c, cx - w / 2, y, w, 10, col); c.fillStyle = '#ffffff'; c.textBaseline = 'top'; c.fillText(text, cx - w / 2 + 3, y + 1.5);
  if (sel) { c.strokeStyle = '#ffd34d'; c.lineWidth = 1; c.strokeRect(Math.round(cx - w / 2) - 1.5, y - 1.5, w + 3, 13); }
}

function draw(c, model, t, sel) {
  c.clearRect(0, 0, W, H);
  room(c, t);
  model.stations.forEach((s, k) => {
    const cx = COLS[k % 3], cy = ROWS[Math.floor(k / 3)];
    const st = s.state;
    const glow = { turn: '#7fe3c4', done: '#7fd38f', review: '#f3c96b', rerun: '#b9a8f5', blocked: '#ff8a7a', waiting: '', closed: '#7fd38f' }[st];
    const standing = st === 'blocked' || (st === 'closed' && s.id === 'close');
    if (sel === s.id) { c.globalAlpha = 0.25; rect(c, cx - 30, cy - 48, 60, 64, '#ffd34d'); c.globalAlpha = 1; }
    if (!standing) cat(c, cx - 16, cy - 30, k, st === 'turn' ? 'type' : st === 'waiting' ? 'sleep' : 'sit', t);
    desk(c, cx, cy, glow);
    if (standing) cat(c, cx + 26, cy - 26, k, st === 'blocked' ? 'raise' : 'cheer', t);
    // status bubble
    const bx = standing ? cx + 46 : cx + 8, by = standing ? cy - 48 : cy - 46;
    if (st === 'turn') bubble(c, bx, by, '#1f6f5c', (x, y) => glyph(c, x + 4, y + 5, 'dots', t % 3 === 0 ? '#9fb' : '#1f6f5c'));
    else if (st === 'done' || st === 'closed') bubble(c, bx, by, '#2e7d4f', (x, y) => glyph(c, x + 3, y + 3, 'ok', '#2e7d4f'));
    else if (st === 'review') bubble(c, bx, by, '#9a6412', (x, y) => glyph(c, x + 5, y + 3, 'q', '#9a6412'));
    else if (st === 'rerun') bubble(c, bx, by, '#5b4f9a', (x, y) => glyph(c, x + 4, y + 3, 'hour', t % 6 < 3 ? '#5b4f9a' : '#8e83cf'));
    else if (st === 'blocked' && t % 4 < 3) bubble(c, bx, by, '#b4402f', (x, y) => glyph(c, x + 6, y + 3, 'bang', '#b4402f'));
    else if (st === 'waiting') { c.font = '7px monospace'; c.fillStyle = '#5b6b73'; const z = t % 9; c.fillText('z', cx + 8 + (z > 3 ? 3 : 0), cy - 30 - z); if (z > 4) c.fillText('Z', cx + 13, cy - 36 - (z - 4)); }
    nameTag(c, cx, cy + 18, `${s.no} ${s.name}`, BADGE[st], sel === s.id);
  });
  if (model.stations[0] && model.stations[0].state === 'closed') confetti(c, t);
}
function confetti(c, t) {
  const cols = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#8e5bc0'];
  for (let k = 0; k < 36; k++) {
    const x = (k * 47 + t * (1 + (k % 3))) % W, y = 54 + ((k * 31 + t * (2 + (k % 2))) % (H - 54));
    rect(c, x, y, 2, (k + t) % 2 ? 2 : 1, cols[k % cols.length]);
  }
}
