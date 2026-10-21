// Xưởng giá thành (v1.14.93, illustrated v1.14.95): the stations of the month close as cats working in a cozy office.
// Idea from Habblaud (github.com/marmottajr/habblaud, MIT © 2026 Márcio Junior): a virtual office where each agent is a
// character showing what it is doing. Nothing is copied: the room, the furniture and the cats are drawn here as SVG.
// The state of each station comes from engine/workshop.js (the same statuses as the process rail); this view only draws.
// Animations are CSS (index.html, .ws-svg) and stop when the device asks for reduced motion.
import { STATE_LABEL } from '../engine/workshop.js';

const VW = 1200, VH = 840, SS = 0.7;             // view box (landscape, fits a laptop screen) · station scale
const COLS = [230, 600, 970], ROWS = [352, 556, 760]; // station centre x, desk top y
const CAT_X = -36;                                   // the cat sits left of centre, the monitor stands on the right

// fur f · light (muzzle, chest, paws) w · dark (stripes / points / patches) d · iris k · outline o
const COATS = [
  { name: 'cam vằn', f: '#f4a65b', w: '#fff1de', d: '#dc7c2c', k: '#6cbf6a', o: '#8a5426', mark: 'tabby' },
  { name: 'mun', f: '#3b3b48', w: '#55556a', d: '#26262f', k: '#f2c94c', o: '#1b1b22', dark: true },
  { name: 'trắng', f: '#fdfcf9', w: '#ffffff', d: '#eee7dc', k: '#6fb6f2', o: '#b9ad9c' },
  { name: 'xám', f: '#aab1ba', w: '#e8ebee', d: '#858c97', k: '#f2c94c', o: '#5f6670' },
  { name: 'tam thể', f: '#fdfcf9', w: '#ffffff', d: '#4a4a55', k: '#6cbf6a', o: '#a99b88', mark: 'calico', p: '#f2a65a' },
  { name: 'Xiêm', f: '#f4e7d3', w: '#fbf5ec', d: '#6b5242', k: '#5aa9e6', o: '#8f7660', mark: 'points' },
  { name: 'mướp xám', f: '#a3b3c4', w: '#e7eef5', d: '#73869b', k: '#f2c94c', o: '#56677a', mark: 'tabby' },
  { name: 'kem', f: '#f6ddb2', w: '#fff7e8', d: '#e0b67a', k: '#6cbf6a', o: '#a57f4c', mark: 'tabby' },
  { name: 'mèo mặc vest', f: '#363642', w: '#ffffff', d: '#22222a', k: '#8bd17c', o: '#18181e', mark: 'tuxedo', dark: true },
];
export const CAT_NAMES = COATS.map((c) => c.name);

const ST_COL = { done: '#2e9e62', review: '#d08a12', turn: '#1f7a68', rerun: '#6f5fc7', blocked: '#d4493a', waiting: '#8a979d', closed: '#2e9e62' };

let selected = '';

/** el: container · x = { model, period, esc, pill, fmtTs } */
export function view(el, x) {
  const { model, period, esc } = x;
  const sm = model.summary;
  if (!model.stations.some((s) => s.id === selected)) selected = (model.stations.find((s) => s.state === 'blocked') || model.stations.find((s) => s.state === 'turn') || model.stations[0]).id;
  const closed = model.stations[0].state === 'closed';
  const head = closed ? 'đã đóng – cả xưởng nghỉ ngơi.'
    : `${sm.done} / ${sm.total} trạm xong${sm.blocked ? ` · <b class="ws-red">${sm.blocked} trạm cần xử lý</b>` : ''}${sm.rerun ? ` · ${sm.rerun} trạm phải chạy lại` : ''}${sm.turn ? ` · đến lượt: <b>${esc(sm.turn)}</b>` : ''}`;
  el.innerHTML = `<section class="page ws">
    <header class="ph ws-ph"><div><h1>Xưởng giá thành</h1><p class="lead">Kỳ ${esc(period)} · ${head}</p></div>
      <div class="ws-prog" role="img" aria-label="${sm.done} / ${sm.total} trạm xong"><div style="width:${Math.round(sm.done / sm.total * 100)}%"></div></div></header>
    <div class="ws-grid">
      <div class="ws-stage">${scene(model, esc)}
        <div class="ws-legend">${['turn', 'done', 'review', 'rerun', 'blocked', 'waiting'].map((k) => `<span><i style="background:${ST_COL[k]}"></i>${esc(STATE_LABEL[k])}</span>`).join('')}</div></div>
      <aside class="ws-side">
        <div class="ws-list" role="list">${model.stations.map((s) => `<button type="button" role="listitem" class="ws-item ${s.id === selected ? 'on' : ''}" data-ws="${s.id}">
          <span class="ws-dot" style="background:${ST_COL[s.state]}"></span><span class="ws-nm"><b>${esc(s.no)} · ${esc(s.name)}</b><small>${esc(STATE_LABEL[s.state])}</small></span></button>`).join('')}</div>
        <div class="ws-detail" id="ws-detail"></div>
      </aside>
    </div>
    <p class="muted ws-note">Mỗi chú mèo là một trạm của quy trình đóng kỳ; trạng thái lấy từ dữ liệu thật của kỳ (cùng nguồn với thanh quy trình bên trái). Bấm vào mèo hoặc tên trạm để xem chi tiết. Ý tưởng từ Habblaud (MIT).</p>
  </section>`;
  const pick = (id) => {
    selected = id;
    const k = model.stations.findIndex((t) => t.id === selected), s = model.stations[k];
    el.querySelector('#ws-detail').innerHTML = `<div class="ws-dh"><span class="ws-coat" title="Mèo ${esc(COATS[k].name)}">${miniCat(k)}</span><div><h3>${esc(s.no)} · ${esc(s.name)}</h3><span class="ws-badge" style="background:${ST_COL[s.state]}">${esc(STATE_LABEL[s.state])}</span></div></div>
      <p class="muted">${esc(s.role)}</p>
      <table class="cp ws-st"><tbody>${s.statuses.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${x.pill(v)}</td></tr>`).join('')}</tbody></table>
      ${s.next && !['done', 'closed'].includes(s.state) ? `<p><b>Việc tiếp theo:</b> ${esc(s.next)}</p>` : ''}
      ${s.last ? `<p class="muted">Gần nhất: ${esc(s.last.action)} · ${esc(s.last.by)} · ${x.fmtTs(s.last.at)}</p>` : '<p class="muted">Chưa có thao tác nào trong nhật ký kỳ.</p>'}
      <a class="btn" href="#${esc(s.hash)}">Mở bước ${esc(s.no)}</a>`;
    el.querySelectorAll('.ws-item').forEach((b) => b.classList.toggle('on', b.dataset.ws === selected));
    el.querySelectorAll('.ws-sta').forEach((g) => g.classList.toggle('sel', g.dataset.ws === selected));
  };
  pick(selected);
  el.querySelectorAll('[data-ws]').forEach((b) => {
    b.addEventListener('click', () => pick(b.dataset.ws));
    if (b.tagName !== 'BUTTON') b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(b.dataset.ws); } });
  });
}

// ======================= the room =======================
function scene(model, esc) {
  const now = new Date(), hr = now.getHours(), mn = now.getMinutes();
  const night = hr < 6 || hr >= 19, dusk = !night && hr >= 17;
  const sky = night ? ['#1b2550', '#33427a'] : dusk ? ['#f5a37a', '#fde1b8'] : ['#8fd0f0', '#d8f1fb'];
  const closed = model.stations[0].state === 'closed';
  return `<svg class="ws-svg${night ? ' night' : ''}" viewBox="0 0 ${VW} ${VH}" role="group" aria-label="${esc(`Xưởng giá thành – ${model.stations.map((s) => `${s.name}: ${STATE_LABEL[s.state]}`).join(', ')}`)}">
  <defs>
    <linearGradient id="wsWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf4ea"/><stop offset="1" stop-color="#f1e5d3"/></linearGradient>
    <linearGradient id="wsSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
    <linearGradient id="wsFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ead6b6"/><stop offset="1" stop-color="#dec49e"/></linearGradient>
    <linearGradient id="wsDesk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a873"/><stop offset="1" stop-color="#c79461"/></linearGradient>
    <linearGradient id="wsLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8dc" stop-opacity=".6"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></linearGradient>
    <radialGradient id="wsGlow"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".7"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    <filter id="wsSoft" x="-20%" y="-20%" width="140%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#5a3c1e" flood-opacity=".18"/></filter>
  </defs>
  <rect width="${VW}" height="204" fill="url(#wsWall)"/>
  ${[0, 1, 2].map((i) => win(140 + i * 345, night, dusk)).join('')}
  ${clock(427, 88, hr, mn)}
  ${board(732, 46)}
  <rect y="190" width="${VW}" height="16" fill="#e7d5b9"/><rect y="202" width="${VW}" height="4" fill="#d3bb96"/>
  <rect y="206" width="${VW}" height="${VH - 206}" fill="url(#wsFloor)"/>
  ${planks()}
  ${night ? '' : [0, 1, 2].map((i) => `<polygon points="${150 + i * 345},206 ${390 + i * 345},206 ${470 + i * 345},${VH} ${70 + i * 345},${VH}" fill="url(#wsLight)" opacity=".45"/>`).join('')}
  <rect x="70" y="232" width="1060" height="${VH - 252}" rx="40" fill="#cfe3d6" opacity=".45"/>
  <rect x="86" y="246" width="1028" height="${VH - 280}" rx="30" fill="none" stroke="#b9d3c3" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" opacity=".7"/>
  ${plant(42, 214, 1.05)}${plant(1158, 214, 1.05, true)}${plant(36, VH - 100, 1)}${plant(1164, VH - 100, 1, true)}
  ${night ? COLS.map((cx) => ROWS.map((y) => `<ellipse cx="${cx}" cy="${y - 50}" rx="150" ry="90" fill="url(#wsGlow)" pointer-events="none"/>`).join('')).join('') : ''}
  ${model.stations.map((s, k) => station(s, k, esc)).join('')}
  ${night ? `<rect width="1200" height="${VH}" fill="#0c1636" opacity=".12" pointer-events="none"/>` : ''}
  ${closed ? confetti() : ''}
</svg>`;
}

function win(x, night, dusk) {
  const y = 26, w = 230, h = 124;
  const extra = night
    ? `<circle cx="${x + 178}" cy="${y + 38}" r="15" fill="#fdf3c4"/><circle cx="${x + 186}" cy="${y + 32}" r="13" fill="url(#wsSky)"/>${[[30, 30], [70, 60], [120, 24], [150, 90], [44, 100], [200, 110]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="1.8" fill="#fff8d0"/>`).join('')}`
    : `<g class="ws-cloud" opacity=".95"><ellipse cx="${x + 70}" cy="${y + 46}" rx="26" ry="11" fill="#fff"/><ellipse cx="${x + 88}" cy="${y + 39}" rx="18" ry="13" fill="#fff"/><ellipse cx="${x + 168}" cy="${y + 92}" rx="22" ry="9" fill="#fff"/><ellipse cx="${x + 182}" cy="${y + 86}" rx="14" ry="10" fill="#fff"/></g>${dusk ? `<circle cx="${x + 150}" cy="${y + 128}" r="20" fill="#ffd27a" opacity=".9"/>` : ''}`;
  return `<g filter="url(#wsSoft)"><rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="14" fill="#ffffff"/></g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#wsSky)"/>${extra}
  <rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="#ffffff"/><rect x="${x}" y="${y + h / 2 - 3}" width="${w}" height="6" fill="#ffffff"/>
  <rect x="${x - 16}" y="${y + h + 8}" width="${w + 32}" height="10" rx="5" fill="#ffffff"/>`;
}
function clock(cx, cy, hr, mn) {
  const a = (deg, len) => [cx + Math.sin(deg * Math.PI / 180) * len, cy - Math.cos(deg * Math.PI / 180) * len];
  const [hx, hy] = a((hr % 12) * 30 + mn / 2, 14), [mx, my] = a(mn * 6, 22);
  return `<g filter="url(#wsSoft)"><circle cx="${cx}" cy="${cy}" r="32" fill="#ffffff" stroke="#e7a77d" stroke-width="6"/></g>
  ${[0, 90, 180, 270].map((d) => { const [x1, y1] = a(d, 23); const [x2, y2] = a(d, 27); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c9b8a4" stroke-width="3" stroke-linecap="round"/>`; }).join('')}
  <line x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}" stroke="#4a3a2f" stroke-width="4" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="#4a3a2f" stroke-width="3" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="3.5" fill="#e7a77d"/>`;
}
function board(x, y) {
  const bars = [34, 52, 44, 70, 62];
  return `<g filter="url(#wsSoft)"><rect x="${x}" y="${y}" width="80" height="88" rx="10" fill="#ffffff"/></g>
  <rect x="${x + 7}" y="${y + 8}" width="66" height="15" rx="4" fill="#e9f3ee"/><text x="${x + 40}" y="${y + 19.5}" text-anchor="middle" class="ws-tiny" fill="#1f7a68">SVL · COGS</text>
  ${bars.map((b, i) => `<rect x="${x + 12 + i * 12}" y="${y + 80 - b * 0.7}" width="8" height="${b * 0.7}" rx="2.5" fill="${i === 3 ? '#f4a65b' : '#7cc3a5'}"/>`).join('')}`;
}
function planks() {
  let s = '';
  for (let y = 248; y < VH; y += 42) {
    s += `<line x1="0" y1="${y}" x2="${VW}" y2="${y}" stroke="#d4b78f" stroke-width="2" opacity=".55"/>`;
    const off = ((y / 42) % 2) * 120;
    for (let x = off + 60; x < VW; x += 240) s += `<line x1="${x}" y1="${y - 42}" x2="${x}" y2="${y}" stroke="#d4b78f" stroke-width="2" opacity=".45"/>`;
  }
  return s;
}
function plant(x, y, sc, flip) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})">
    <ellipse cx="0" cy="66" rx="24" ry="5" fill="#5a3c1e" opacity=".12"/>
    <path d="M-18 34 h36 l-5 30 h-26 z" fill="#e58e6a"/><rect x="-21" y="30" width="42" height="8" rx="4" fill="#d47a56"/>
    <g class="ws-leaf"><path d="M0 32 C-6 6 -26 2 -30 -12 C-12 -10 -2 2 0 32" fill="#5fae6e"/><path d="M0 32 C4 2 22 -6 30 -22 C12 -16 2 -2 0 32" fill="#4c9a5c"/><path d="M0 32 C-2 4 2 -18 0 -34 C8 -16 6 8 0 32" fill="#6cc07b"/></g></g>`;
}

// ======================= a station: chair, cat, desk, monitor, name card =======================
function station(s, k, esc) {
  const cx = COLS[k % 3], dy = ROWS[Math.floor(k / 3)], st = s.state, col = ST_COL[st];
  const C = COATS[k % COATS.length];
  const pose = st === 'turn' ? 'type' : st === 'waiting' ? 'sleep' : st === 'blocked' ? 'raise' : st === 'closed' ? (s.id === 'close' ? 'cheer' : 'happy') : 'sit';
  const bubble = { turn: ['Đến lượt', '…'], blocked: ['Cần xử lý', '!'], rerun: ['Chạy lại', '↻'], review: ['Rà soát', '?'] }[st];
  return `<g class="ws-sta st-${st}" data-ws="${s.id}" role="button" tabindex="0" aria-label="${esc(`${s.no} ${s.name}: ${STATE_LABEL[st]}`)}" transform="translate(${cx} ${dy}) scale(${SS})">
    <ellipse class="ws-halo" cx="0" cy="30" rx="160" ry="34" fill="${col}"/>
    <ellipse cx="0" cy="58" rx="128" ry="12" fill="#5a3c1e" opacity=".10"/>
    <g transform="translate(${CAT_X} 0)">${chair()}${catBody(C, pose)}</g>
    ${desk()}
    <g transform="translate(${CAT_X} 0)">${paws(C, pose)}</g>
    ${monitor(st)}
    ${mug(st)}
    ${bubble ? `<g transform="translate(${CAT_X + 30} -204)"><g class="ws-bub"><rect x="0" y="0" width="${bubble[0].length * 10.5 + 46}" height="32" rx="16" fill="#ffffff" stroke="${col}" stroke-width="2.5" filter="url(#wsSoft)"/><circle cx="17" cy="16" r="11" fill="${col}"/><text x="17" y="21" text-anchor="middle" class="ws-bi">${bubble[1]}</text><text x="34" y="21.5" class="ws-bt" fill="${col}">${esc(bubble[0])}</text><path d="M14 30.5 l-6 11 l13 -10 z" fill="#ffffff"/></g></g>` : ''}
    ${st === 'waiting' ? `<g class="ws-zz" transform="translate(${CAT_X + 34} -160)"><text class="z1" x="0" y="0">z</text><text class="z2" x="14" y="-16">z</text><text class="z3" x="30" y="-34">Z</text></g>` : ''}
    <g class="ws-card" transform="translate(-128 66)"><rect width="256" height="42" rx="13" fill="#ffffff" filter="url(#wsSoft)"/><rect class="ws-cardsel" width="256" height="42" rx="13" fill="none" stroke="${col}"/><rect x="0" y="0" width="9" height="42" rx="4.5" fill="${col}"/>
      <text x="22" y="28" class="ws-ct"><tspan class="ws-cno" fill="${col}">${esc(s.no)}</tspan> ${esc(s.name)}</text><circle cx="236" cy="21" r="7" fill="${col}"/></g>
  </g>`;
}
function chair() {
  return `<rect x="-54" y="-156" width="108" height="134" rx="32" fill="#4f6b7a"/><rect x="-44" y="-146" width="88" height="114" rx="26" fill="#5f7f8f"/>`;
}
function desk() {
  return `<g filter="url(#wsSoft)"><rect x="-128" y="-8" width="256" height="20" rx="8" fill="url(#wsDesk)"/></g><rect x="-128" y="-8" width="256" height="5" rx="3" fill="#e6bd8b"/>
  <rect x="-118" y="12" width="236" height="44" rx="8" fill="#b9844f"/><rect x="-108" y="20" width="96" height="28" rx="6" fill="#c79461"/><circle cx="-60" cy="34" r="3" fill="#8f6238"/><rect x="12" y="20" width="96" height="28" rx="6" fill="#c79461"/><circle cx="60" cy="34" r="3" fill="#8f6238"/>
  <rect x="${CAT_X - 42}" y="-17" width="84" height="12" rx="4" fill="#eef1f4" stroke="#cfd6dd" stroke-width="1.5"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${CAT_X - 35 + i * 10}" y="-13.5" width="7" height="3" rx="1" fill="#cfd6dd"/>`).join('')}`;
}
function mug(st) {
  return `<g transform="translate(-116 -32)"><rect x="0" y="0" width="22" height="24" rx="6" fill="#ffffff" stroke="#e1d6c6" stroke-width="1.5"/><path d="M22 6 q9 0 9 7 q0 7 -9 7" fill="none" stroke="#e1d6c6" stroke-width="3"/><rect x="3" y="3" width="16" height="5" rx="2" fill="#a0673e"/>
    ${st === 'turn' ? '<path class="ws-steam" d="M8 -4 q-4 -6 0 -12 q4 -6 0 -12 M15 -4 q-4 -6 0 -12 q4 -6 0 -12" fill="none" stroke="#c9bdb0" stroke-width="2" stroke-linecap="round"/>' : ''}</g>`;
}
const SCREEN = {
  turn: `<rect x="6" y="6" width="84" height="56" rx="5" fill="#1d2a3a"/>${[[12, 40, '#7fe3c4'], [12, 56, '#8fb2e6'], [22, 30, '#f3c96b'], [22, 46, '#7fe3c4'], [12, 36, '#c3a6f5']].map(([x, w, c], i) => `<rect class="ws-code c${i}" x="${x}" y="${12 + i * 9}" width="${w}" height="4" rx="2" fill="${c}"/>`).join('')}`,
  done: '<rect x="6" y="6" width="84" height="56" rx="5" fill="#e3f5ea"/><circle cx="48" cy="34" r="17" fill="#2e9e62"/><path d="M39 34 l6 6 l12 -13" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>',
  review: '<rect x="6" y="6" width="84" height="56" rx="5" fill="#fff3d9"/><circle cx="44" cy="31" r="11" fill="none" stroke="#d08a12" stroke-width="4"/><path d="M52 39 l9 9" stroke="#d08a12" stroke-width="5" stroke-linecap="round"/>',
  rerun: '<rect x="6" y="6" width="84" height="56" rx="5" fill="#ece8fb"/><g class="ws-spin"><path d="M36 34 a12 12 0 1 1 4 9" fill="none" stroke="#6f5fc7" stroke-width="4.5" stroke-linecap="round"/><path d="M33 40 l7 4 l1 -8 z" fill="#6f5fc7"/></g>',
  blocked: '<rect x="6" y="6" width="84" height="56" rx="5" fill="#fde6e2"/><g class="ws-pulse"><path d="M48 15 l19 33 h-38 z" fill="#d4493a" stroke="#d4493a" stroke-width="4" stroke-linejoin="round"/><rect x="45.5" y="25" width="5" height="13" rx="2" fill="#fff"/><circle cx="48" cy="43" r="2.8" fill="#fff"/></g>',
  waiting: '<rect x="6" y="6" width="84" height="56" rx="5" fill="#2b3340"/><path d="M53 22 a13 13 0 1 0 6 20 a10 10 0 1 1 -6 -20" fill="#e9e3c9" opacity=".85"/>',
};
SCREEN.closed = SCREEN.done;
function monitor(st) {
  return `<g transform="translate(24 -104)"><rect x="40" y="62" width="16" height="30" rx="3" fill="#9aa5b1"/><rect x="24" y="88" width="48" height="8" rx="4" fill="#8b96a3"/>
    <g filter="url(#wsSoft)"><rect x="0" y="0" width="96" height="68" rx="9" fill="#3a4452"/></g>${SCREEN[st]}<circle cx="48" cy="65" r="1.6" fill="#6b7685"/></g>`;
}

// ======================= the cat =======================
const pawCol = (C) => (C.mark === 'points' ? C.d : C.w);
function limb(C, d, cls, len = 1) { // a raised front leg ending in a paw
  const x0 = 26 * d, path = `M${x0} -70 C ${48 * d} -94, ${58 * d} -118, ${56 * d} ${-142 * len}`;
  return `<g class="${cls}"><path d="${path}" fill="none" stroke="${C.o}" stroke-width="24" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${C.f}" stroke-width="18" stroke-linecap="round"/><circle cx="${56 * d}" cy="${-146 * len}" r="12.5" fill="${pawCol(C)}" stroke="${C.o}" stroke-width="3"/></g>`;
}
function catBody(C, pose) {
  const o = C.o;
  const tp = 'M30 -30 C 72 -36, 80 -86, 58 -112';
  const tail = `<g class="ws-tail"><path d="${tp}" fill="none" stroke="${o}" stroke-width="22" stroke-linecap="round"/><path d="${tp}" fill="none" stroke="${C.mark === 'points' ? C.d : C.f}" stroke-width="16" stroke-linecap="round"/>${C.mark === 'tabby' ? `<path d="M64 -52 l10 -3 M68 -74 l10 2 M62 -96 l9 4" stroke="${C.d}" stroke-width="4" stroke-linecap="round"/>` : ''}</g>`;
  const body = `<ellipse cx="0" cy="-44" rx="46" ry="46" fill="${C.f}" stroke="${o}" stroke-width="3"/>
    <ellipse cx="0" cy="-36" rx="26" ry="32" fill="${C.w}"/>${C.mark === 'calico' ? `<path d="M18 -84 q28 6 28 36 q-14 -6 -28 -2 z" fill="${C.p}"/>` : ''}
    ${C.mark === 'tabby' ? `<path d="M-40 -62 q8 2 10 10 M-44 -42 q8 2 10 10 M40 -62 q-8 2 -10 10 M44 -42 q-8 2 -10 10" stroke="${C.d}" stroke-width="4" stroke-linecap="round" fill="none"/>` : ''}
    ${C.mark === 'tuxedo' ? '<path d="M-16 -82 l16 8 l16 -8 l-3 17 l-13 -6 l-13 6 z" fill="#d4493a" stroke="#a83427" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="-74" r="4.5" fill="#b33b2e"/>' : ''}`;
  const arms = pose === 'raise' ? limb(C, 1, 'ws-wave') : pose === 'cheer' ? limb(C, 1, 'ws-cheer') + limb(C, -1, 'ws-cheer l') : '';
  return `${tail}${body}${arms}<g class="ws-head ${pose}">${head(C, pose)}</g>`;
}
function head(C, pose) {
  const o = C.o, Y = -112;
  const earFill = C.mark === 'points' ? C.d : C.mark === 'calico' ? null : C.f;
  const ear = (d) => `<path d="M${-46 * d} ${Y - 12} L${-37 * d} ${Y - 64} L${-6 * d} ${Y - 38} Z" fill="${earFill || (d > 0 ? C.p : C.d)}" stroke="${o}" stroke-width="3" stroke-linejoin="round"/><path d="M${-37 * d} ${Y - 22} L${-33 * d} ${Y - 51} L${-15 * d} ${Y - 35} Z" fill="#f6b3bd"/>`;
  const sleepy = pose === 'sleep', happy = pose === 'happy' || pose === 'cheer';
  const ink = C.dark ? '#f3efe9' : '#3a2a22';
  const eye = (d) => (sleepy ? `<path d="M${20 * d - 10} ${Y + 2} q10 8 20 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`
    : happy ? `<path d="M${20 * d - 10} ${Y + 4} q10 -12 20 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`
      : `<g class="ws-eye"><ellipse cx="${20 * d}" cy="${Y}" rx="10" ry="12" fill="#2a2228"/><ellipse cx="${20 * d}" cy="${Y + 2}" rx="7.5" ry="9" fill="${C.k}"/><ellipse cx="${20 * d}" cy="${Y + 2}" rx="3.6" ry="7" fill="#1b1418"/><circle cx="${20 * d - 3.5}" cy="${Y - 4}" r="3.4" fill="#fff"/><circle cx="${20 * d + 3}" cy="${Y + 6}" r="1.6" fill="#fff"/></g>`);
  const marks = C.mark === 'tabby' ? `<path d="M-9 ${Y - 42} q2 10 0 17 M0 ${Y - 44} v19 M9 ${Y - 42} q-2 10 0 17" stroke="${C.d}" stroke-width="4" stroke-linecap="round" fill="none"/>`
    : C.mark === 'calico' ? `<path d="M-52 ${Y - 4} q0 -34 30 -40 q4 22 -8 34 q-10 10 -22 6 z" fill="${C.p}"/><path d="M52 ${Y - 6} q-2 -30 -26 -38 q-6 18 4 30 q10 10 22 8 z" fill="${C.d}"/>`
      : C.mark === 'points' ? `<ellipse cx="0" cy="${Y + 14}" rx="27" ry="21" fill="${C.d}" opacity=".8"/>`
        : C.mark === 'tuxedo' ? `<path d="M-22 ${Y + 44} q-4 -24 12 -34 q10 -8 20 0 q16 10 12 34 z" fill="#ffffff"/>` : '';
  return `${ear(1)}${ear(-1)}
    <ellipse cx="0" cy="${Y}" rx="55" ry="47" fill="${C.f}" stroke="${o}" stroke-width="3"/>${marks}
    <ellipse cx="0" cy="${Y + 18}" rx="22" ry="14" fill="${C.mark === 'points' ? '#9a7c68' : C.w}"/>
    ${eye(-1)}${eye(1)}
    <ellipse cx="-37" cy="${Y + 14}" rx="9.5" ry="5.5" fill="#ff8fa3" opacity="${C.dark ? 0.6 : 0.45}"/><ellipse cx="37" cy="${Y + 14}" rx="9.5" ry="5.5" fill="#ff8fa3" opacity="${C.dark ? 0.6 : 0.45}"/>
    <path d="M-5.5 ${Y + 10} h11 l-5.5 6.5 z" fill="#f08a9b" stroke="#d76f82" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M-9 ${Y + 19} q4.5 6 9 0 q4.5 6 9 0" fill="none" stroke="${C.dark ? '#d9d2ca' : '#3a2a22'}" stroke-width="2.4" stroke-linecap="round"/>
    <g stroke="${C.dark ? '#ffffff' : '#7a6a5e'}" stroke-width="1.6" stroke-linecap="round" opacity=".55"><path d="M-30 ${Y + 14} l-32 -6 M-30 ${Y + 20} l-32 2 M30 ${Y + 14} l32 -6 M30 ${Y + 20} l32 2"/></g>`;
}
function paws(C, pose) {
  if (pose === 'cheer') return '';
  const p = (x, cls) => `<g class="${cls}"><ellipse cx="${x}" cy="-13" rx="14" ry="8.5" fill="${pawCol(C)}" stroke="${C.o}" stroke-width="2.2" stroke-opacity=".7"/><path d="M${x - 5} -9 v-3 M${x} -8.5 v-3 M${x + 5} -9 v-3" stroke="${C.o}" stroke-width="1.4" stroke-linecap="round" opacity=".45"/></g>`;
  if (pose === 'raise') return p(-18, '');
  return p(-18, pose === 'type' ? 'ws-tap a' : '') + p(18, pose === 'type' ? 'ws-tap b' : '');
}
function miniCat(k) {
  const C = COATS[k % COATS.length];
  return `<svg viewBox="-72 -182 144 132" width="58" height="54" aria-hidden="true">${head(C, 'sit')}</svg>`;
}
function confetti() {
  const cols = ['#f4a65b', '#6cbf6a', '#6fb6f2', '#f28ba8', '#f2c94c', '#a98ee8'];
  let s = '<g class="ws-confetti" pointer-events="none">';
  for (let k = 0; k < 42; k++) s += `<rect x="${(k * 173) % VW}" y="-20" width="${8 + (k % 3) * 3}" height="${5 + (k % 2) * 3}" rx="2" fill="${cols[k % cols.length]}" style="animation-delay:${(k % 14) * -0.45}s;animation-duration:${4 + (k % 5) * 0.7}s"/>`;
  return s + '</g>';
}
