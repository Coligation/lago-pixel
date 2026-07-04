// Lago Pixel v2.1 — cliente (visão aérea, renderizador caprichado)
(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ZOOM = 2;
const VW = 480, VH = 270;
const { W, H, TILE, T, WALK_OK, BOAT_OK, ISLANDS, NPCS, SPAWN, ZONE_NAMES, h2 } = WORLD;
const MAP = WORLD.genWorld();

const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? T.DEEP : MAP[ty * W + tx];
const tileAtPx = (px, py) => tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
const isWaterT = (t) => t === T.DEEP || t === T.SHALLOW;
const isWaterPx = (px, py) => isWaterT(tileAtPx(px, py));

// ---------------------------------------------------------------- decoração e mapa de render
// tiles de vegetação/pedra viram entidades (com sombra, oclusão e balanço);
// o chão embaixo delas vai pro RENDER_MAP

const THEME_GROUND = { grass: T.GRASS, snow: T.SNOW, desert: T.SAND, savanna: T.SAV, volcano: T.VOLC, rockisle: T.STONE };
const RENDER_MAP = new Uint8Array(MAP);
const DECOR = [];
for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
  const t = MAP[ty * W + tx];
  if (t === T.TREE || t === T.PALM || t === T.ACACIA || t === T.CACTUS || t === T.ROCK) {
    const theme = WORLD.nearestIsland(tx, ty).isl.theme;
    RENDER_MAP[ty * W + tx] = THEME_GROUND[theme];
    DECOR.push({ type: t, x: tx * TILE + 8, y: ty * TILE + 14, v: h2(tx, ty), th: theme });
  }
  // parte da grama alta vira arbusto volumoso (estilo Alundra)
  if ((t === T.TALL || t === T.SAVTALL) && h2(tx + 31, ty + 17) < 0.30) {
    RENDER_MAP[ty * W + tx] = t === T.TALL ? T.GRASS : T.SAV;
    DECOR.push({ type: 'bush', x: tx * TILE + 8, y: ty * TILE + 14, v: h2(tx, ty), th: t === T.TALL ? 'grass' : 'savanna' });
  }
  if (t === T.FAROLBASE) RENDER_MAP[ty * W + tx] = T.STONE;
  if (t === T.KIOSK) {
    RENDER_MAP[ty * W + tx] = T.PATH;
    // canto superior esquerdo do quiosque vira a decoração inteira
    if (MAP[ty * W + tx - 1] !== T.KIOSK && MAP[(ty - 1) * W + tx] !== T.KIOSK) {
      const nino = NPCS.find(n => n.id === 'nino');
      const isBoat = nino && Math.hypot(nino.tx - tx, nino.ty - ty) < 6;
      DECOR.push({ type: 'kiosk', x: tx * TILE, y: (ty + 2) * TILE, v: isBoat ? 1 : 0, smokeT: 0 });
    }
  }
  // casas da vila (5x4 tiles) viram sprites inteiros com telhado projetado "3D"
  if (t === T.ROOF && tileAt(tx - 1, ty) !== T.ROOF && tileAt(tx, ty - 1) !== T.ROOF
      && tileAt(tx + 1, ty) === T.ROOF && tileAt(tx, ty + 2) === T.WALL) {
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) {
      RENDER_MAP[(ty + yy) * W + tx + xx] = T.GRASS;
    }
    DECOR.push({ type: 'house', x: tx * TILE, y: (ty + 4) * TILE, v: h2(tx, ty), smokeT: 0 });
  }
  if (t === T.PLANK && isWaterT(tileAt(tx, ty + 1)) && h2(tx, ty) > 0.45) {
    DECOR.push({ type: 'post', x: tx * TILE + 8, y: ty * TILE + 17, v: h2(tx, ty) });
  }
}
// torre do farol
{
  const far = ISLANDS.find(i => i.id === 'farol');
  DECOR.push({ type: 'farol', x: far.cx * TILE + 8, y: (far.cy + 1) * TILE, v: 0, smokeT: 0 });
}
const rTileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? T.DEEP : RENDER_MAP[ty * W + tx];

// ---------------------------------------------------------------- estado

let ws = null;
let me = { id: 0, name: '', x: SPAWN.x, y: SPAWN.y, dir: 'down', moving: false, boat: false };
let profile = null, catalog = null;
const others = new Map();
const drops = new Map();

let fish = { phase: 'idle', bobX: 0, bobY: 0 };
let reel = null, catchCard = null, splashes = [];
let currentZone = '';
const keys = {};
let lastMoveSent = 0, chatOpen = false, wasMoving = false;
let timeOffset = 0, dayLen = 1200, luckEvent = false, touchTurbo = false;
const evZones = []; // círculos de evento no mar

// fases do dia: 0-0.50 dia, 0.50-0.60 entardecer, 0.60-0.95 noite, 0.95-1 amanhecer
const dayPhase = () => ((Date.now() / 1000 + timeOffset) % dayLen) / dayLen;
function nightAmount() { // 0 = dia claro, 1 = noite fechada
  const p = dayPhase();
  if (p < 0.50) return 0;
  if (p < 0.60) return (p - 0.50) / 0.10;
  if (p < 0.90) return 1;
  if (p < 0.95) return 1;
  return 1 - (p - 0.95) / 0.05;
}

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ---------------------------------------------------------------- áudio

let actx = null, ambienceOn = true, ambGain = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
function beep(freq, dur = 0.1, type = 'square', vol = 0.12, when = 0) {
  try {
    const a = audio();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
    o.connect(g); g.connect(a.destination);
    o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.02);
  } catch {}
}
const sfx = {
  cast:  () => { beep(500, .08); beep(320, .1, 'square', .1, .07); },
  bite:  () => { beep(900, .07); beep(1100, .09, 'square', .14, .08); },
  catch: () => { [523, 659, 784, 1046].forEach((f, i) => beep(f, .12, 'triangle', .14, i * .09)); },
  fail:  () => beep(140, .3, 'sawtooth', .1),
  coin:  () => { beep(988, .07, 'triangle', .15); beep(1319, .18, 'triangle', .15, .06); },
  level: () => { [392, 523, 659, 784, 1046].forEach((f, i) => beep(f, .15, 'triangle', .13, i * .08)); },
  boat:  () => { beep(220, .12, 'triangle', .12); beep(330, .12, 'triangle', .12, .1); },
};
function startAmbience() { // mar bem suave ao fundo
  try {
    const a = audio();
    if (ambGain) return;
    const len = a.sampleRate * 3;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 6; }
    const src = a.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    ambGain = a.createGain(); ambGain.gain.value = 0.05;
    const lfo = a.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = a.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(ambGain.gain);
    src.connect(lp); lp.connect(ambGain); ambGain.connect(a.destination);
    src.start(); lfo.start();
  } catch {}
}
function toggleAmbience() {
  ambienceOn = !ambienceOn;
  if (ambGain) ambGain.gain.value = ambienceOn ? 0.05 : 0;
  if (musicGain) musicGain.gain.value = ambienceOn ? 1 : 0;
  toast(ambienceOn ? '🔊 Som ligado' : '🔇 Som desligado', 1200);
}

// ---------------------------------------------------------------- música procedural
// cada ilha tem um tema de ~20s ao chegar; depois volta a música do mar

const SONGS = {
  normal:  { bpm: 72,  wave: 'triangle', vol: .030, bass: [48, 45, 41, 43], chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]] },
  vila:    { bpm: 96,  wave: 'square',   vol: .016, bass: [48, 53, 55, 48], chords: [[60, 64, 67, 72], [65, 69, 72, 76], [67, 71, 74, 78], [64, 67, 72, 76]] },
  gelo:    { bpm: 58,  wave: 'sine',     vol: .050, bass: [45, 48, 43, 45], chords: [[69, 72, 76, 81], [72, 76, 79, 84], [67, 71, 74, 79], [69, 72, 76, 81]] },
  deserto: { bpm: 82,  wave: 'triangle', vol: .034, bass: [45, 45, 48, 44], chords: [[69, 72, 76, 81], [69, 73, 76, 81], [72, 75, 79, 84], [68, 72, 75, 80]] },
  savana:  { bpm: 110, wave: 'square',   vol: .015, bass: [50, 50, 53, 55], chords: [[62, 66, 69, 74], [62, 66, 69, 74], [65, 69, 72, 77], [67, 71, 74, 79]] },
  vulcao:  { bpm: 62,  wave: 'sawtooth', vol: .013, bass: [41, 41, 40, 38], chords: [[57, 60, 64, 69], [57, 60, 64, 69], [56, 60, 63, 68], [55, 58, 62, 67]] },
  farol:   { bpm: 88,  wave: 'triangle', vol: .032, bass: [48, 43, 45, 47], chords: [[64, 67, 72, 76], [59, 62, 67, 71], [60, 64, 69, 72], [62, 65, 71, 74]] },
};
const midi2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
let musicGain = null;
const music = { song: 'normal', jingleUntil: 0, nextT: 0, step: 0 };

function playNote(freq, t, dur, wave, vol) {
  const a = audio();
  const o = a.createOscillator(), g = a.createGain();
  o.type = wave; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + dur + 0.05);
}

function startMusic() {
  try {
    const a = audio();
    if (musicGain) return;
    musicGain = a.createGain(); musicGain.gain.value = ambienceOn ? 1 : 0;
    musicGain.connect(a.destination);
    music.nextT = a.currentTime + 0.2;
    setInterval(() => {
      const s = SONGS[music.song] || SONGS.normal;
      const stepDur = 60 / s.bpm / 2; // colcheias
      while (music.nextT < a.currentTime + 0.35) {
        const bar = Math.floor(music.step / 8) % 4;
        const i = music.step % 8;
        const chord = s.chords[bar];
        // arpejo sobe-e-desce
        const seq = [0, 1, 2, 3, 2, 1, 2, 1];
        playNote(midi2f(chord[seq[i] % chord.length]), music.nextT, stepDur * 1.6, s.wave, s.vol);
        if (i === 0) playNote(midi2f(s.bass[bar]), music.nextT, stepDur * 7, 'sine', s.vol * 2.4);
        if (i === 4) playNote(midi2f(s.bass[bar] + 7), music.nextT, stepDur * 3, 'sine', s.vol * 1.6);
        music.nextT += stepDur;
        music.step++;
      }
      // volta pra música do mar quando o tema da ilha acaba
      if (music.jingleUntil && performance.now() > music.jingleUntil) {
        music.jingleUntil = 0;
        music.song = 'normal'; music.step = 0;
      }
    }, 120);
  } catch {}
}

function onZoneMusic(zone) {
  if (!musicGain) return;
  if (zone !== 'altomar' && SONGS[zone] && music.song !== zone) {
    music.song = zone; music.step = 0;
    music.jingleUntil = performance.now() + 20000; // ~20s de tema da ilha
  }
}

// ---------------------------------------------------------------- UI helpers

const $ = (id) => document.getElementById(id);
function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text; t.style.display = 'block';
  clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', ms);
}
function announce(text, rarity) {
  const box = $('announces');
  const el = document.createElement('div');
  el.className = 'announce'; el.textContent = text;
  if (catalog && rarity) el.style.borderColor = catalog.rarities[rarity].color;
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => el.remove(), 7000);
}
function chatLine(name, text) {
  const log = $('chatlog');
  const el = document.createElement('div');
  el.className = 'line';
  const b = document.createElement('b'); b.textContent = name + ': ';
  el.appendChild(b); el.appendChild(document.createTextNode(text));
  log.appendChild(el);
  while (log.children.length > 40) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}
function showDialog(npc, text) {
  $('dialog').style.display = 'block';
  document.querySelector('#dialog .npc').textContent = npc;
  document.querySelector('#dialog .txt').textContent = text;
}
function closeModals() {
  for (const id of ['inventory', 'shop', 'dex', 'quests', 'settings']) $(id).style.display = 'none';
  $('dialog').style.display = 'none';
}

// ---------------------------------------------------------------- configurações

$('btn-settings').addEventListener('click', () => togglePanel('settings'));
$('btn-settings').addEventListener('touchstart', (e) => { e.preventDefault(); togglePanel('settings'); }, { passive: false });
$('set-sound').onclick = () => {
  toggleAmbience();
  $('set-sound').textContent = ambienceOn ? '🔊 Som: ligado' : '🔇 Som: desligado';
};
$('set-money').onclick = () => {
  const el = $('money');
  const hidden = el.style.display === 'none';
  el.style.display = hidden ? 'block' : 'none';
  localStorage.setItem('lp_hidemoney', hidden ? '' : '1');
};
$('set-logout').onclick = () => {
  localStorage.removeItem('lp_name');
  location.reload();
};
$('money-x').onclick = () => {
  $('money').style.display = 'none';
  localStorage.setItem('lp_hidemoney', '1');
};
$('money-x').addEventListener('touchstart', (e) => {
  e.preventDefault(); e.stopPropagation();
  $('money').style.display = 'none';
  localStorage.setItem('lp_hidemoney', '1');
}, { passive: false });
if (localStorage.getItem('lp_hidemoney') === '1') $('money').style.display = 'none';
function togglePanel(id) {
  const el = $(id);
  const open = el.style.display === 'block';
  closeModals();
  if (!open) el.style.display = 'block';
}

// ---------------------------------------------------------------- HUD e painéis

function refreshHUD() {
  if (!profile || !catalog) return;
  $('hud-level').textContent = profile.level;
  $('hud-coins').textContent = profile.coins.toLocaleString('pt-BR');
  $('xpfill').style.width = Math.min(100, 100 * profile.xp / profile.xpNext) + '%';
  $('hud-gear').textContent = `🎣 ${catalog.rods[profile.rod].name} · 🧵 ${catalog.lines[profile.line].name}`;
  $('hud-boat').textContent = profile.boat ? `🚣 ${catalog.boats[profile.boat].name}` : '🚣 sem barco (compre no Zé!)';
  const b = profile.activeBait;
  $('hud-bait').textContent = 'Isca: ' + (b && profile.baits[b] > 0 ? `${catalog.baits[b].name} (${profile.baits[b]})` : 'nenhuma');
  $('hud-bucket').textContent = profile.inventory.length;
  refreshInventory(); refreshShop(); refreshDex(); refreshQuests(); refreshAchievements(); refreshMoneyGoal();
}

// contador de moedas animado (canto inferior direito)
let shownCoins = 0, coinsInit = false;
function tickMoney(dt) {
  if (!profile) return;
  if (!coinsInit) { shownCoins = profile.coins; coinsInit = true; }
  const diff = profile.coins - shownCoins;
  if (Math.abs(diff) < 1) shownCoins = profile.coins;
  else shownCoins += diff * Math.min(1, dt * 6);
  $('money-val').textContent = Math.round(shownCoins).toLocaleString('pt-BR');
}

function refreshInventory() {
  const list = $('invlist');
  list.innerHTML = '';
  let total = 0;
  profile.inventory.forEach((f, i) => {
    total += f.value;
    const row = document.createElement('div');
    row.className = 'fishrow';
    const r = catalog.rarities[f.rarity];
    const info = document.createElement('span');
    info.innerHTML = `<span style="color:${r.color}">${f.name}</span> <span style="color:#9ab">${f.weight} kg</span>`;
    const right = document.createElement('span');
    right.innerHTML = `<b style="color:#ffd24a">${f.value} 🪙</b> `;
    const btn = document.createElement('button');
    btn.className = 'btn small'; btn.textContent = 'Soltar';
    btn.onclick = () => send({ type: 'drop', index: i });
    right.appendChild(btn);
    row.appendChild(info); row.appendChild(right);
    list.appendChild(row);
  });
  if (!profile.inventory.length) list.innerHTML = '<div class="fishrow">Balde vazio... vá pescar!</div>';
  $('invtotal').textContent = total.toLocaleString('pt-BR') + ' 🪙';
}

// cada espécie tem silhueta/padrão próprios (derivados do id), cor pela raridade
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const fishIconCache = new Map();
function fishIcon(id, color, caught) {
  const key = `${id}|${color}|${caught ? 1 : 0}`;
  let c = fishIconCache.get(key);
  if (c) return c;
  let hsh = 7;
  for (const ch of id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  c = document.createElement('canvas');
  c.width = 30; c.height = 16;
  const g = c.getContext('2d');
  const body = caught ? color : '#1c2a38';
  const dark = caught ? shade(color, -55) : '#131f2b';
  const lite = caught ? shade(color, 45) : '#1c2a38';
  const long = hsh % 3 === 0;         // corpo alongado (enguia/agulha)
  const chunky = hsh % 3 === 1;       // corpo alto (pacu/lua)
  const bw = long ? 11 : chunky ? 7.5 : 9;
  const bh = long ? 3 : chunky ? 6 : 4.5;
  const cx = 12, cy = 8;
  // cauda
  g.fillStyle = body;
  const tw = long ? 4 : 6;
  g.beginPath(); g.moveTo(cx + bw - 1, cy); g.lineTo(cx + bw + tw, cy - 5); g.lineTo(cx + bw + tw, cy + 5); g.closePath(); g.fill();
  // corpo
  g.beginPath(); g.ellipse(cx, cy, bw, bh, 0, 0, 7); g.fill();
  // barbatana dorsal (3 estilos)
  g.fillStyle = dark;
  const fin = hsh % 3;
  if (fin === 0) { g.beginPath(); g.moveTo(cx - 3, cy - bh + 1); g.lineTo(cx, cy - bh - 3); g.lineTo(cx + 3, cy - bh + 1); g.closePath(); g.fill(); }
  else if (fin === 1) { g.beginPath(); g.moveTo(cx - 4, cy - bh + 1); g.lineTo(cx + 1, cy - bh - 2); g.lineTo(cx + 4, cy - bh + 1); g.closePath(); g.fill(); }
  else { g.fillRect(cx - 2, cy - bh - 2, 5, 3); }
  // nadadeira inferior
  g.beginPath(); g.moveTo(cx, cy + bh - 1); g.lineTo(cx + 2, cy + bh + 2); g.lineTo(cx + 4, cy + bh - 1); g.closePath(); g.fill();
  // padrão: listras, pintas ou dorso escuro
  if (caught) {
    const pat = (hsh >> 4) % 4;
    g.save();
    g.beginPath(); g.ellipse(cx, cy, bw, bh, 0, 0, 7); g.clip();
    if (pat === 0) { g.fillStyle = dark; for (let i = -1; i <= 1; i++) g.fillRect(cx + i * 4 - 1, cy - bh, 2, bh * 2); }
    else if (pat === 1) { g.fillStyle = dark; for (let i = 0; i < 4; i++) g.fillRect(cx - 5 + i * 3, cy - 2 + (i % 2) * 3, 1.5, 1.5); }
    else if (pat === 2) { g.fillStyle = dark; g.fillRect(cx - bw, cy - bh, bw * 2, bh * 0.8); }
    g.fillStyle = lite; g.fillRect(cx - bw + 1, cy + bh - 2.5, bw, 1.5); // barriga clara
    g.restore();
  }
  // olho e boca
  if (caught) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - bw + 3, cy - 1, 1.8, 0, 7); g.fill();
    g.fillStyle = '#0a1420'; g.beginPath(); g.arc(cx - bw + 2.7, cy - 1, 1, 0, 7); g.fill();
    g.fillStyle = dark; g.fillRect(cx - bw, cy + 1.5, 2, 1);
  }
  fishIconCache.set(key, c);
  return c;
}
const miniFish = (color, caught, id = 'x') => fishIcon(id, color, caught);

function refreshDex() {
  const list = $('dexlist');
  list.innerHTML = '';
  const zoneOrder = ['vila', 'altomar', 'deserto', 'savana', 'gelo', 'vulcao', '*'];
  for (const z of zoneOrder) {
    const pool = catalog.fish.filter(f => z === '*' ? f.zones[0] === '*' : (f.zones[0] !== '*' && f.zones.includes(z)));
    if (!pool.length) continue;
    const h = document.createElement('h3');
    h.textContent = z === '*' ? '🗑️ Tralhas' : '📍 ' + ZONE_NAMES[z];
    list.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'dexgrid';
    for (const f of pool) {
      const d = profile.dex[f.id];
      const r = catalog.rarities[f.rarity];
      const el = document.createElement('div');
      el.className = 'dexitem';
      el.appendChild(fishIcon(f.id, r.color, !!d));
      const info = document.createElement('div');
      info.innerHTML = d
        ? `<div class="nm" style="color:${r.color}">${f.name}</div><div class="st">${r.label} · ${d.n}x · recorde ${d.best} kg</div>`
        : `<div class="nm" style="color:#456">???</div><div class="st">${r.label} · não capturado</div>`;
      el.appendChild(info);
      grid.appendChild(el);
    }
    list.appendChild(grid);
  }
  $('dexcount').textContent = `(${Object.keys(profile.dex).length}/${catalog.fish.length})`;
}

function questState(npcId) { // null = não aceitou; {q, prog, done} | {allDone}
  const chain = catalog.quests[npcId];
  const st = profile.quests[npcId];
  if (!st) return null;
  if (st.idx >= chain.length) return { allDone: true };
  const q = chain[st.idx];
  let prog = st.prog;
  if (q.type === 'dex') prog = Object.keys(profile.dex).length;
  if (q.type === 'zones') prog = (st.zones || []).length;
  prog = Math.min(prog, q.need);
  return { q, prog, done: prog >= q.need, idx: st.idx, total: chain.length };
}

function refreshQuests() {
  const list = $('questlist');
  list.innerHTML = '';
  for (const npcId in catalog.quests) {
    const npc = NPCS.find(n => n.id === npcId);
    const island = ISLANDS.find(i => i.id === npc.island);
    const chain = catalog.quests[npcId];
    const qs = questState(npcId);
    const el = document.createElement('div');
    el.className = 'questitem';
    if (!qs) {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name}<br><span style="color:#9ab">Visite pra receber uma missão. (${chain.length} missões)</span>`;
    } else if (qs.allDone) {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name}<br><span class="prog">✓ Todas as ${chain.length} missões concluídas!</span>`;
    } else {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name} <span style="color:#9ab">(${qs.idx + 1}/${qs.total})</span><br>` +
        `${qs.q.text} <span class="prog">${qs.prog}/${qs.q.need}${qs.done ? ' ✓ entregue!' : ''}</span>` +
        `<div class="questbar"><div style="width:${100 * qs.prog / qs.q.need}%"></div></div>`;
    }
    list.appendChild(el);
  }
}

function shopSection(box, title, kind, items, ownedId) {
  box.innerHTML = `<h3>${title}</h3>`;
  for (const [id, item] of Object.entries(items)) {
    const el = document.createElement('div');
    el.className = 'shopitem';
    const descs = {
      rod: `sorte +${item.luck} · barra maior · nível ${item.level}+`,
      line: `peixe escapa ${Math.round((1 - item.drain) * 100)}% menos · nível ${item.level}+`,
      boat: `velocidade ${item.speed}x · explore as ilhas · nível ${item.level}+`,
      bait: item.luckBonus ? 'atrai peixes raros' : 'mordidas mais rápidas',
    };
    el.innerHTML = `<div>${item.name}${kind === 'bait' ? ` ×${item.pack}` : ''} <div class="desc">${descs[kind]}${kind === 'bait' ? ` · você tem ${profile.baits[id] || 0}` : ''}</div></div>`;
    if (kind !== 'bait' && ownedId === id) {
      el.innerHTML += '<span class="owned">seu ✓</span>';
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn';
      const locked = kind !== 'bait' && profile.level < item.level;
      btn.textContent = locked ? `nível ${item.level} 🔒` : item.price.toLocaleString('pt-BR') + ' 🪙';
      btn.disabled = locked || profile.coins < item.price;
      btn.onclick = () => send({ type: 'buy', kind, id });
      el.appendChild(btn);
    }
    box.appendChild(el);
  }
}

let shopMode = 'itens'; // 'itens' (Zé) ou 'barcos' (Nino)
function refreshShop() {
  const total = profile.inventory.reduce((s, f) => s + f.value, 0);
  $('selldesc').textContent = profile.inventory.length
    ? `${profile.inventory.length} peixes = ${total.toLocaleString('pt-BR')} 🪙` : 'balde vazio';
  $('sellbtn').disabled = !profile.inventory.length;
  const itens = shopMode === 'itens';
  $('shoptitle').textContent = itens ? '🐟 Peixe & Cia — Zé do Peixe' : '⛵ Barcos do Nino';
  $('shopsellrow').style.display = itens ? 'flex' : 'none';
  $('shoprods').style.display = $('shoplines').style.display = $('shopbaits').style.display = itens ? 'block' : 'none';
  $('shopboats').style.display = itens ? 'none' : 'block';
  if (itens) {
    shopSection($('shoprods'), '🎣 Varas', 'rod', catalog.rods, profile.rod);
    shopSection($('shoplines'), '🧵 Linhas', 'line', catalog.lines, profile.line);
    shopSection($('shopbaits'), '🪱 Iscas', 'bait', catalog.baits, null);
  } else {
    shopSection($('shopboats'), '⛵ Barcos', 'boat', catalog.boats, profile.boat);
  }
}

function refreshAchievements() {
  const list = $('achvlist');
  list.innerHTML = '';
  for (const a of catalog.achievements) {
    const got = profile.achv.includes(a.id);
    const el = document.createElement('div');
    el.className = 'questitem';
    el.innerHTML = got
      ? `<span class="prog">🏆 ${a.name}</span> — <span style="color:#9ab">${a.desc}</span> <span style="color:#ffd24a">✓ +${a.reward} 🪙</span>`
      : `<span style="color:#678">🔒 ${a.name}</span> — <span style="color:#567">${a.desc} (+${a.reward} 🪙)</span>`;
    list.appendChild(el);
  }
}

// meta de dinheiro: próximo equipamento a comprar
function refreshMoneyGoal() {
  const owned = { rod: catalog.rods[profile.rod].price, line: catalog.lines[profile.line].price,
    boat: profile.boat ? catalog.boats[profile.boat].price : -1 };
  let best = null;
  for (const [kind, items] of [['rod', catalog.rods], ['line', catalog.lines], ['boat', catalog.boats]]) {
    for (const item of Object.values(items)) {
      if (item.price <= owned[kind]) continue;
      if (!best || item.price < best.price) best = { ...item, kind };
    }
  }
  const el = $('money-goal');
  if (!best) { el.textContent = '👑 Você tem o melhor de tudo!'; return; }
  const falta = best.price - profile.coins;
  el.textContent = falta > 0
    ? `Faltam ${falta.toLocaleString('pt-BR')} 🪙 → ${best.name}`
    : `💡 ${best.name} disponível na loja!`;
}

$('sellbtn').onclick = () => send({ type: 'sell_all' });

// ---------------------------------------------------------------- rede

function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function connect(name) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onopen = () => send({ type: 'join', name });
  ws.onclose = () => toast('Conexão perdida. Recarregue a página.', 60000);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    switch (m.type) {
      case 'welcome':
        me.id = m.id; me.name = m.name;
        profile = m.you; catalog = m.catalog;
        timeOffset = m.timeOffset || 0; dayLen = m.dayLen || 1200; luckEvent = !!m.event;
        evZones.length = 0;
        if (m.zones) for (const z of m.zones) evZones.push(z);
        for (const p of m.players) others.set(p.id, { ...p, tx: p.x, ty: p.y });
        for (const d of m.drops) drops.set(d.id, d);
        document.querySelector('#hud .name').textContent = '🎣 ' + me.name;
        $('login').style.display = 'none';
        refreshHUD();
        break;
      case 'time': timeOffset = m.timeOffset; break;
      case 'event': luckEvent = m.active; break;
      case 'teleport':
        me.x = m.x; me.y = m.y; me.boat = false;
        fish.phase = 'idle';
        sfx.boat();
        break;
      case 'player_join': others.set(m.player.id, { ...m.player, tx: m.player.x, ty: m.player.y }); break;
      case 'player_leave': others.delete(m.id); break;
      case 'player_state': {
        const p = others.get(m.player.id);
        if (p) {
          const wasFishing = p.fishing;
          Object.assign(p, m.player, { tx: m.player.x, ty: m.player.y, x: p.x, y: p.y });
          if (!wasFishing && p.fishing === 'waiting') p.castT = performance.now(); // animação do arremesso
        }
        else if (m.player.id !== me.id) others.set(m.player.id, { ...m.player, tx: m.player.x, ty: m.player.y });
        break;
      }
      case 'cast_ok':
        fish = { phase: 'waiting', bobX: m.bobX, bobY: m.bobY, castT: performance.now() };
        if (m.baits) { profile.baits = m.baits; refreshHUD(); }
        splash(m.bobX, m.bobY, 5);
        break;
      case 'bite': fish.phase = 'bite'; sfx.bite(); splash(fish.bobX, fish.bobY, 7); break;
      case 'reel': startReel(m.reelTime, m.speed, m.bar, m.drain, m.rarity, m.color); break;
      case 'zones':
        evZones.length = 0;
        for (const z of m.zones) evZones.push(z);
        break;
      case 'catch':
        profile = m.you; fish.phase = 'idle'; reel = null;
        catchCard = { fish: m.fish, t: performance.now() };
        sfx.catch(); splash(fish.bobX, fish.bobY, 14);
        refreshHUD();
        break;
      case 'escaped': fish.phase = 'idle'; reel = null; toast(m.reason); sfx.fail(); break;
      case 'sold': profile = m.you; refreshHUD(); sfx.coin(); toast(`Vendeu tudo por ${m.total.toLocaleString('pt-BR')} 🪙!`); break;
      case 'bought': profile = m.you; refreshHUD(); break;
      case 'levelup': sfx.level(); toast(`⭐ Nível ${m.level}!`); confetti(); break;
      case 'toast': toast(m.text); break;
      case 'announce': announce(m.text, m.rarity); break;
      case 'open_shop': shopMode = m.shop || 'itens'; refreshShop(); togglePanel('shop'); break;
      case 'dialog': showDialog(m.npc, m.text); break;
      case 'drop_add': drops.set(m.drop.id, m.drop); break;
      case 'drop_del': drops.delete(m.id); break;
      case 'player_catch': {
        const p = others.get(m.id);
        if (p) p.catchFx = { fish: m.fish, t: performance.now() };
        break;
      }
      case 'chat': {
        chatLine(m.name, m.text);
        // balão de fala em cima da cabeça (2-3s conforme o tamanho)
        const dur = Math.min(3200, 1800 + m.text.length * 45);
        const say = { text: m.text.slice(0, 60), until: performance.now() + dur };
        if (m.name === me.name) me.sayFx = say;
        else for (const p of others.values()) if (p.name === m.name) { p.sayFx = say; break; }
        break;
      }
    }
  };
}

// ---------------------------------------------------------------- input

addEventListener('keydown', (e) => {
  if (chatOpen) {
    if (e.key === 'Enter') {
      const inp = $('chatinput');
      if (inp.value.trim()) send({ type: 'chat', text: inp.value.trim() });
      inp.value = ''; inp.style.display = 'none'; inp.blur(); chatOpen = false;
    } else if (e.key === 'Escape') { $('chatinput').style.display = 'none'; $('chatinput').blur(); chatOpen = false; }
    return;
  }
  if ($('login').style.display !== 'none') return;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();

  if (e.code === 'Space') {
    if (reel) return;
    if (fish.phase === 'idle') tryCast();
    else send({ type: 'hook' });
  }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyI') togglePanel('inventory');
  if (e.code === 'KeyC') togglePanel('dex');
  if (e.code === 'KeyQ') togglePanel('quests');
  if (e.code === 'KeyB') cycleBait();
  if (e.code === 'KeyM') toggleAmbience();
  if (e.code === 'Escape') closeModals();
  if (e.key === 'Enter') { chatOpen = true; const inp = $('chatinput'); inp.style.display = 'block'; inp.focus(); e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

function tryCast() {
  const [dx, dy] = DIRV[me.dir];
  const bx = me.x + dx * TILE * 2.4, by = me.y + dy * TILE * 2.4;
  if (!isWaterPx(bx, by)) { toast('Mire na água pra pescar!'); return; }
  send({ type: 'cast', bobX: Math.round(bx), bobY: Math.round(by) });
  sfx.cast();
}

function interact() {
  if ($('dialog').style.display === 'block') { $('dialog').style.display = 'none'; return; }

  let nearest = null, nd = 40;
  for (const d of drops.values()) {
    const dist = Math.hypot(d.x - me.x, d.y - me.y);
    if (dist < nd) { nd = dist; nearest = d; }
  }
  if (nearest) { send({ type: 'pickup', id: nearest.id }); return; }

  for (const n of NPCS) {
    if (Math.hypot(n.tx * TILE + 8 - me.x, n.ty * TILE + 8 - me.y) < 40) {
      send({ type: 'talk', npc: n.id });
      return;
    }
  }

  // porta do farol (entrar) ou porta da sala interna (sair)
  {
    const IN = WORLD.INTERIOR, FD = WORLD.FAROL_DOOR;
    const nearFarolDoor = Math.hypot(FD.tx * TILE + 8 - me.x, FD.ty * TILE - me.y) < 30;
    const inside = me.x > IN.x0 * TILE && me.x < IN.x1 * TILE && me.y > IN.y0 * TILE && me.y < IN.y1 * TILE;
    const nearExit = inside && Math.hypot(IN.doorTx * TILE + 8 - me.x, IN.doorTy * TILE - me.y) < 34;
    if (nearFarolDoor || nearExit) { send({ type: 'enter_farol' }); return; }
  }

  // porta de casa? bate... tá trancada
  {
    const [dx, dy] = DIRV[me.dir];
    if (tileAtPx(me.x + dx * 14, me.y + dy * 14 - 4) === T.DOOR || tileAtPx(me.x + dx * 14, me.y + dy * 14) === T.DOOR) {
      const msgs = ['🚪 Toc toc... trancada. Parece que não tem ninguém.',
        '🚪 Trancada. Você ouve um gato miando lá dentro.',
        '🚪 Trancada. O morador deve estar pescando...',
        '🚪 Você bate. Silêncio... só o som do mar.'];
      toast(msgs[Math.floor(Math.random() * msgs.length)], 2600);
      beep(240, .06, 'square', .1); beep(200, .06, 'square', .1, .12);
      return;
    }
  }

  const [dx, dy] = DIRV[me.dir];
  const fx = me.x + dx * TILE, fy = me.y + dy * TILE;
  if (!me.boat && profile.boat && isWaterPx(fx, fy) && canStand(fx, fy, true)) {
    me.boat = true; me.x = fx; me.y = fy;
    sfx.boat(); sendMove(true);
    return;
  }
  if (me.boat) {
    for (const [ddx, ddy] of [[dx, dy], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const lx = me.x + ddx * TILE, ly = me.y + ddy * TILE;
      if (!isWaterPx(lx, ly) && canStand(lx, ly, false)) {
        me.boat = false; me.x = lx; me.y = ly;
        sfx.boat(); sendMove(true);
        return;
      }
    }
    toast('Encoste numa praia pra desembarcar.');
  }
}

function cycleBait() {
  if (!profile || !catalog) return;
  const opts = [null, ...Object.keys(catalog.baits).filter(b => profile.baits[b] > 0)];
  const cur = opts.indexOf(profile.activeBait && profile.baits[profile.activeBait] > 0 ? profile.activeBait : null);
  send({ type: 'select_bait', bait: opts[(cur + 1) % opts.length] });
}

// ---------------------------------------------------------------- controles de toque (celular)

const joy = { active: false, id: null, cx: 0, cy: 0, vx: 0, vy: 0 };
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (IS_TOUCH) {
  document.body.classList.add('touch');

  const zone = $('joyzone'), knob = $('joyknob'), base = $('joybase');
  const setKnob = () => {
    base.style.left = (joy.cx - 44) + 'px'; base.style.top = (joy.cy - 44) + 'px';
    knob.style.left = (joy.cx + joy.vx * 30 - 20) + 'px'; knob.style.top = (joy.cy + joy.vy * 30 - 20) + 'px';
    base.style.display = knob.style.display = joy.active ? 'block' : 'none';
  };
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joy.active = true; joy.id = t.identifier;
    joy.cx = t.clientX; joy.cy = t.clientY; joy.vx = joy.vy = 0;
    setKnob();
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joy.id) continue;
      const dx = t.clientX - joy.cx, dy = t.clientY - joy.cy;
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 36);
      joy.vx = (dx / d) * m; joy.vy = (dy / d) * m;
      setKnob();
    }
  }, { passive: false });
  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joy.id) continue;
      joy.active = false; joy.vx = joy.vy = 0; setKnob();
    }
  };
  zone.addEventListener('touchend', joyEnd);
  zone.addEventListener('touchcancel', joyEnd);

  // botão de pesca: toque = lançar/fisgar, segurar = minigame
  const bindHold = (el, down, up) => {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); up && up(); }, { passive: false });
    el.addEventListener('touchcancel', () => up && up());
  };
  bindHold($('btn-fish'), () => {
    keys['Space'] = true;
    if (reel) return;
    if (fish.phase === 'idle') tryCast();
    else send({ type: 'hook' });
  }, () => { keys['Space'] = false; });
  bindHold($('btn-e'), () => interact());
  bindHold($('btn-turbo'), () => {
    touchTurbo = !touchTurbo;
    $('btn-turbo').classList.toggle('on', touchTurbo);
  });
  bindHold($('btn-inv'), () => togglePanel('inventory'));
  bindHold($('btn-dex'), () => togglePanel('dex'));
  bindHold($('btn-quest'), () => togglePanel('quests'));
  bindHold($('btn-bait'), () => cycleBait());
  bindHold($('btn-chat'), () => {
    const box = $('chatbox'), inp = $('chatinput');
    if (chatOpen) { box.classList.remove('open'); inp.style.display = 'none'; inp.blur(); chatOpen = false; }
    else { chatOpen = true; box.classList.add('open'); inp.style.display = 'block'; inp.focus(); }
  });
  // enviar chat no "ir" do teclado do celular
  $('chatinput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const inp = $('chatinput');
      if (inp.value.trim()) send({ type: 'chat', text: inp.value.trim() });
      inp.value = ''; $('chatbox').classList.remove('open'); inp.style.display = 'none'; inp.blur(); chatOpen = false;
    }
  });
}

// ---------------------------------------------------------------- controle (gamepad)
// analógico esq./D-pad move · A pesca (segura no minigame) · B interage/fecha
// X balde · Y missões · LB coleção · RB isca · Start config · RT/L3 turbo

let gpPrev = [], gpVec = { x: 0, y: 0 }, gpSprint = false, gpA = false;
addEventListener('gamepadconnected', (e) => {
  toast(`🎮 Controle conectado: ${e.gamepad.id.slice(0, 34)}`, 3000);
});
addEventListener('gamepaddisconnected', () => {
  gpVec.x = gpVec.y = 0; gpSprint = false; gpA = false;
  toast('🎮 Controle desconectado');
});

function anyModalOpen() {
  return ['inventory', 'shop', 'dex', 'quests', 'settings'].some(id => $(id).style.display === 'block')
    || $('dialog').style.display === 'block';
}

function pollGamepad() {
  if (!navigator.getGamepads) return;
  let gp = null;
  for (const p of navigator.getGamepads()) if (p && p.connected) { gp = p; break; }
  if (!gp) { gpVec.x = gpVec.y = 0; gpSprint = false; gpA = false; return; }

  const pr = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const tap = (i) => pr(i) && !gpPrev[i];

  // movimento: analógico esquerdo + D-pad (12-15)
  let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
  if (Math.hypot(x, y) < 0.25) { x = 0; y = 0; }
  if (pr(14)) x = -1; if (pr(15)) x = 1;
  if (pr(12)) y = -1; if (pr(13)) y = 1;
  gpVec.x = x; gpVec.y = y;

  gpSprint = (gp.buttons[7] && gp.buttons[7].value > 0.5) || pr(10); // RT ou L3
  gpA = pr(0); // segurar A = segurar ESPAÇO no minigame

  if (tap(0) && !reel && !chatOpen) {
    if (fish.phase === 'idle') tryCast();
    else send({ type: 'hook' });
  }
  if (tap(1)) { if (anyModalOpen()) closeModals(); else interact(); }
  if (tap(2)) togglePanel('inventory');
  if (tap(3)) togglePanel('quests');
  if (tap(4)) togglePanel('dex');
  if (tap(5)) cycleBait();
  if (tap(9)) togglePanel('settings');

  gpPrev = gp.buttons.map(b => b.pressed);
}

$('login-name').value = localStorage.getItem('lp_name') || '';
$('login-btn').onclick = doLogin;
$('login-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
function doLogin() {
  const name = $('login-name').value.trim() || 'Pescador';
  localStorage.setItem('lp_name', name);
  startAmbience();
  startMusic();
  connect(name);
}

// ---------------------------------------------------------------- movimento

function canStand(px, py, boat) {
  for (const [ox, oy] of [[-5, -2], [5, -2], [-5, 4], [5, 4]]) {
    const t = tileAtPx(px + ox, py + oy);
    if (boat ? !BOAT_OK.has(t) : !WALK_OK.has(t)) return false;
  }
  return true;
}

function sendMove(force) {
  const now = performance.now();
  if (!force && now - lastMoveSent < 80) return;
  lastMoveSent = now;
  send({ type: 'move', x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, moving: me.moving, boat: me.boat });
}

function updateMe(dt) {
  if (chatOpen || reel) { me.moving = false; return; }
  let vx = 0, vy = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) { vx = -1; me.dir = 'left'; }
  else if (keys['KeyD'] || keys['ArrowRight']) { vx = 1; me.dir = 'right'; }
  if (keys['KeyW'] || keys['ArrowUp']) { vy = -1; if (!vx) me.dir = 'up'; }
  else if (keys['KeyS'] || keys['ArrowDown']) { vy = 1; if (!vx) me.dir = 'down'; }

  if (joy.active && (Math.abs(joy.vx) > 0.15 || Math.abs(joy.vy) > 0.15)) {
    vx = joy.vx; vy = joy.vy;
    me.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
  }
  if (!vx && !vy && (gpVec.x || gpVec.y)) { // controle (gamepad)
    vx = gpVec.x; vy = gpVec.y;
    me.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
  }

  const moving = vx !== 0 || vy !== 0;
  me.moving = moving;
  if (moving) {
    if (fish.phase !== 'idle') { fish.phase = 'idle'; send({ type: 'cancel' }); }
    // mapa grande: barcos bem mais rápidos que a pé
    let spd = me.boat ? (catalog.boats[profile.boat] ? 150 * catalog.boats[profile.boat].speed + 40 : 190) : 100;
    // SHIFT: corrida a pé; turbo só em barco moderno (lancha/veleiro)
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'] || touchTurbo || gpSprint;
    let turbo = false;
    if (sprint) {
      if (!me.boat) spd *= 1.5;
      else if (profile.boat === 'lancha' || profile.boat === 'veleiro') { spd *= 1.6; turbo = true; }
    }
    const len = Math.hypot(vx, vy);
    if (joy.active) spd *= Math.min(1, len);
    const nx = me.x + (vx / len) * spd * dt;
    const ny = me.y + (vy / len) * spd * dt;
    if (canStand(nx, me.y, me.boat)) me.x = nx;
    if (canStand(me.x, ny, me.boat)) me.y = ny;
    if (me.boat && Math.random() < dt * (turbo ? 18 : 6)) wake(me.x, me.y);
    sendMove(false);
    wasMoving = true;
  } else if (wasMoving) {
    wasMoving = false;
    sendMove(true);
  }

  const IN = WORLD.INTERIOR;
  const inside = me.x > IN.x0 * TILE && me.x < IN.x1 * TILE && me.y > IN.y0 * TILE && me.y < IN.y1 * TILE;
  const z = inside ? 'farol' : WORLD.zoneAt(Math.floor(me.x / TILE), Math.floor(me.y / TILE));
  if (z !== currentZone) {
    currentZone = z;
    $('zonelabel').textContent = '📍 ' + ZONE_NAMES[z] + (inside ? ' — Interior' : '');
    onZoneMusic(z);
  }
}

// ---------------------------------------------------------------- minigame

function startReel(reelTime, speed, barPx, drain, rarity, color) {
  reel = { fishPos: 0.5, fishVel: 0, zonePos: 0.5, zoneVel: 0, zoneH: barPx / 260,
    progress: 0.35, speed, reelTime, drain: drain || 1, wobT: 0,
    rarity: rarity || 'comum', color: color || '#f0f0f0',
    elapsed: 0, tired: 0 };
}

function updateReel(dt) {
  const r = reel;
  r.elapsed += dt;

  // fadiga: após 1 min de briga, o peixe cansa um degrau a cada 20s (fica ~15% mais lento)
  const stage = r.elapsed >= 60 ? Math.min(6, 1 + Math.floor((r.elapsed - 60) / 20)) : 0;
  if (stage !== r.tired) {
    r.tired = stage;
    beep(420 - stage * 30, .12, 'sine', .12); beep(320 - stage * 20, .14, 'sine', .1, .1);
    toast(stage === 1 ? '💤 O peixe está começando a cansar!' : '💤 O peixe está cada vez mais cansado!', 1600);
  }
  const effSpeed = r.speed * Math.pow(0.85, r.tired);

  r.wobT -= dt;
  if (r.wobT <= 0) {
    r.fishVel = (Math.random() * 2 - 1) * 0.9 * effSpeed;
    // cansado, ele também "descansa" mais tempo entre os puxões
    r.wobT = (0.25 + Math.random() * 0.6) * (1 + r.tired * 0.15);
  }
  r.fishPos += r.fishVel * dt;
  if (r.fishPos < 0) { r.fishPos = 0; r.fishVel = Math.abs(r.fishVel); }
  if (r.fishPos > 1) { r.fishPos = 1; r.fishVel = -Math.abs(r.fishVel); }
  const hold = keys['Space'] || gpA;
  r.zoneVel += (hold ? 2.6 : -2.6) * dt;
  r.zoneVel *= 0.92;
  r.zonePos += r.zoneVel * dt;
  const half = r.zoneH / 2;
  if (r.zonePos < half) { r.zonePos = half; r.zoneVel = 0; }
  if (r.zonePos > 1 - half) { r.zonePos = 1 - half; r.zoneVel = 0; }
  const inside = Math.abs(r.fishPos - r.zonePos) <= half;
  // peixe cansado também escorrega menos progresso quando foge da zona
  r.progress += (inside ? 0.22 : -0.16 * r.drain * Math.pow(0.93, r.tired)) * dt * (5 / r.reelTime);
  if (r.progress >= 1) { send({ type: 'reel_done', success: true }); reel = null; }
  else if (r.progress <= 0) { send({ type: 'reel_done', success: false }); reel = null; }
}

// ---------------------------------------------------------------- partículas

const amb = []; // partículas ambientes {kind,x,y,vx,vy,life,max,r?}
function splash(x, y, n) {
  for (let i = 0; i < n; i++) {
    splashes.push({ x: x + (Math.random() * 10 - 5), y, vx: Math.random() * 40 - 20,
      vy: -40 - Math.random() * 60, life: 0.5 });
  }
}
function wake(x, y) {
  amb.push({ kind: 'wake', x: x + (Math.random() * 8 - 4), y: y + 4 + Math.random() * 3, vx: 0, vy: 2, life: 1, max: 1 });
}

// confete de level-up (espaço de tela)
const conf = [];
function confetti() {
  const colors = ['#ffd24a', '#7affc8', '#5aa9ff', '#f08098', '#c07aff', '#fff'];
  for (let i = 0; i < 90; i++) {
    conf.push({ x: 380 + Math.random() * 200, y: -10 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 120,
      c: colors[i % colors.length], r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 10, life: 3 });
  }
}
function drawConfetti(dt) {
  if (!conf.length) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = conf.length - 1; i >= 0; i--) {
    const p = conf[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.vx *= 0.99;
    if (p.life <= 0 || p.y > 560) { conf.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.fillStyle = p.c; ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- sprites: atlas de tiles

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mkTile(fn) { const c = mkCanvas(16, 16); fn(c.getContext('2d')); return c; }
function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

const SPR = {}; // SPR[tile] = [variantes]

// Atlas estilo Alundra (PS1): muitos tons por material, contorno forte, cores vivas
function buildAtlas() {
  const mk4 = (fn) => [0, 1, 2, 3].map(v => mkTile(g => fn(g, rnd(v * 7 + 3), v)));
  const speck = (g, r, n, colors, w = 1, h = 1) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(r() * colors.length) | 0];
      g.fillRect((r() * (16 - w)) | 0, (r() * (16 - h)) | 0, w, h);
    }
  };

  SPR[T.GRASS] = mk4((g, r) => {
    g.fillStyle = '#4fbe46'; g.fillRect(0, 0, 16, 16);
    // manchas orgânicas mescladas (o chão do Alundra nunca é liso)
    for (let i = 0; i < 3; i++) {
      g.fillStyle = ['rgba(130,225,95,.35)', 'rgba(40,130,45,.32)', 'rgba(190,205,85,.20)'][(r() * 3) | 0];
      g.beginPath(); g.ellipse(r() * 16, r() * 16, 3 + r() * 4, 2 + r() * 3, r() * 3, 0, 7); g.fill();
    }
    speck(g, r, 6, ['#5fd253', '#43a83c'], 1, 1);
    // tufos de 3 lâminas com sombra na base
    for (let i = 0; i < 2; i++) {
      const x = 2 + ((r() * 10) | 0), y = 3 + ((r() * 9) | 0);
      g.fillStyle = 'rgba(25,80,28,.5)'; g.fillRect(x - 1, y + 4, 6, 1);
      g.fillStyle = '#2f8a30'; g.fillRect(x, y + 1, 1, 3); g.fillRect(x + 2, y, 1, 4); g.fillRect(x + 4, y + 2, 1, 2);
      g.fillStyle = '#8aec74'; g.fillRect(x + 2, y, 1, 1); g.fillRect(x, y + 1, 1, 1);
    }
    if (r() > 0.78) { // pedrinha perdida na grama
      const px = (r() * 12) | 0, py = (r() * 12) | 0;
      g.fillStyle = '#7c9058'; g.fillRect(px, py + 1, 3, 2);
      g.fillStyle = '#b8c48a'; g.fillRect(px, py, 3, 1);
    }
  });
  SPR[T.TALL] = mk4((g, r) => {
    g.fillStyle = '#3da43a'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#2f8a30'; g.fillRect(0, 12, 16, 4);
    for (let i = 0; i < 7; i++) {
      const x = 1 + ((r() * 13) | 0), y = 2 + ((r() * 4) | 0);
      g.fillStyle = '#256e28'; g.fillRect(x + 1, y + 1, 2, 14 - y);
      g.fillStyle = '#4fbe46'; g.fillRect(x, y, 2, 13 - y);
      g.fillStyle = '#8aec74'; g.fillRect(x, y, 1, 2);
    }
  });
  SPR[T.FLOWER] = mk4((g, r, v) => {
    g.fillStyle = '#4fbe46'; g.fillRect(0, 0, 16, 16);
    speck(g, r, 5, ['#5fd253', '#45ab3d']);
    const cols = [['#ffe3ef', '#ff5a96', '#c22d64'], ['#fff6c0', '#ffc22e', '#c78d16'],
      ['#efe6ff', '#9e6cf5', '#6e3fc2'], ['#ffffff', '#ffc22e', '#e0e0e0']][v];
    for (const [fx, fy] of [[3, 4], [10, 9], [6, 12]]) {
      g.fillStyle = cols[2]; g.fillRect(fx, fy + 1, 1, 2); // caule sombra
      g.fillStyle = cols[0];
      g.fillRect(fx - 1, fy, 3, 1); g.fillRect(fx, fy - 1, 1, 3);
      g.fillStyle = cols[1]; g.fillRect(fx, fy, 1, 1);
    }
  });
  SPR[T.SAND] = mk4((g, r) => {
    g.fillStyle = '#eed9a2'; g.fillRect(0, 0, 16, 16);
    // manchas de terra batida (claro/escuro se mesclando)
    for (let i = 0; i < 3; i++) {
      g.fillStyle = ['rgba(255,244,200,.45)', 'rgba(200,165,105,.35)', 'rgba(230,205,150,.4)'][(r() * 3) | 0];
      g.beginPath(); g.ellipse(r() * 16, r() * 16, 3 + r() * 4, 2 + r() * 2.5, r() * 3, 0, 7); g.fill();
    }
    // grupinho de pedrinhas assentadas (marca registrada do chão do Alundra)
    if (r() > 0.35) {
      const px = 2 + ((r() * 9) | 0), py = 2 + ((r() * 9) | 0), n = 2 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const sx = px + ((r() * 6) | 0), sy = py + ((r() * 5) | 0);
        g.fillStyle = '#a98650'; g.fillRect(sx, sy + 1, 3, 2);
        g.fillStyle = '#d9b87e'; g.fillRect(sx, sy, 3, 1.5);
        g.fillStyle = '#fdf2cd'; g.fillRect(sx, sy, 1, 1);
      }
    }
    speck(g, r, 4, ['#f9ecc0', '#dcc188'], 1, 1);
  });
  SPR[T.SAV] = mk4((g, r) => {
    g.fillStyle = '#d8c163'; g.fillRect(0, 0, 16, 16);
    speck(g, r, 6, ['#e6d47c', '#c3aa4e'], 2, 1);
    for (let i = 0; i < 4; i++) {
      const x = (r() * 14) | 0, y = (r() * 12) | 0;
      g.fillStyle = '#a88f3c'; g.fillRect(x, y, 1, 3);
      g.fillStyle = '#efdf92'; g.fillRect(x, y, 1, 1);
    }
  });
  SPR[T.SAVTALL] = mk4((g, r) => {
    g.fillStyle = '#c4ac52'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#af9743'; g.fillRect(0, 12, 16, 4);
    for (let i = 0; i < 7; i++) {
      const x = 1 + ((r() * 13) | 0), y = 2 + ((r() * 4) | 0);
      g.fillStyle = '#8a7430'; g.fillRect(x + 1, y + 1, 2, 14 - y);
      g.fillStyle = '#d8c163'; g.fillRect(x, y, 2, 13 - y);
      g.fillStyle = '#f2e5a2'; g.fillRect(x, y, 1, 2);
    }
  });
  SPR[T.SNOW] = mk4((g, r) => {
    g.fillStyle = '#f6fafe'; g.fillRect(0, 0, 16, 16);
    speck(g, r, 5, ['#ffffff'], 2, 2);
    speck(g, r, 4, ['#dfe9f6', '#d2e0f0'], 2, 1);
    if (r() > 0.75) { g.fillStyle = '#c8d9ee'; g.fillRect((r() * 10) | 0, (r() * 10) | 0, 4, 2); }
  });
  SPR[T.ICE] = mk4((g, r) => {
    g.fillStyle = '#bfe6f8'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#dbf2fc'; g.fillRect(0, 0, 16, 2);
    g.strokeStyle = '#8ecbe8'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(r() * 8, 14 - r() * 4); g.lineTo(8 + r() * 7, 2 + r() * 4); g.stroke();
    g.strokeStyle = '#a8dbf0';
    g.beginPath(); g.moveTo(r() * 16, r() * 16); g.lineTo(r() * 16, r() * 16); g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect((r() * 12) | 0, (r() * 12) | 0, 3, 1);
  });
  SPR[T.PATH] = mk4((g, r) => {
    g.fillStyle = '#d3ab77'; g.fillRect(0, 0, 16, 16);
    speck(g, r, 6, ['#c39a66', '#e0bd8a'], 2, 2);
    // pedrinhas assentadas
    for (let i = 0; i < 3; i++) {
      const x = 1 + ((r() * 12) | 0), y = 1 + ((r() * 12) | 0);
      g.fillStyle = '#9c7c4e'; g.fillRect(x, y + 1, 3, 2);
      g.fillStyle = '#e8cb9a'; g.fillRect(x, y, 3, 1);
    }
  });
  SPR[T.PLANK] = mk4((g, r, v) => {
    g.fillStyle = '#bc8f56'; g.fillRect(0, 0, 16, 16);
    for (const y of [0, 5, 10]) {
      g.fillStyle = y === 5 ? '#c39457' : '#b5884f';
      g.fillRect(0, y, 16, 5);
      g.fillStyle = '#77522a'; g.fillRect(0, y + 4, 16, 1);
      g.fillStyle = '#dcac6c'; g.fillRect(0, y, 16, 1);
      // veios da madeira
      g.strokeStyle = 'rgba(122,84,42,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(r() * 6, y + 2); g.lineTo(6 + r() * 9, y + 2 + (r() > .5 ? 1 : 0)); g.stroke();
    }
    const jx = 3 + v * 3;
    g.fillStyle = '#684622'; g.fillRect(jx, 0, 1, 16);
    g.fillStyle = '#403016';
    g.fillRect(jx + 2, 2, 1, 1); g.fillRect(jx + 2, 7, 1, 1); g.fillRect(jx + 2, 12, 1, 1);
    if (r() > 0.6) { g.fillStyle = '#8a6234'; g.beginPath(); g.arc(12, 8, 1.4, 0, 7); g.fill(); }
  });
  SPR[T.VOLC] = mk4((g, r) => {
    g.fillStyle = '#5b4a58'; g.fillRect(0, 0, 16, 16);
    speck(g, r, 6, ['#4a3b48', '#6b5a68'], 3, 2);
    // rachaduras
    g.strokeStyle = '#3a2d38'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(r() * 16, r() * 16); g.lineTo(r() * 16, r() * 16); g.stroke();
    if (r() > 0.85) { g.fillStyle = '#a4523a'; g.fillRect((r() * 13) | 0, (r() * 13) | 0, 2, 1); }
  });
  SPR[T.STONE] = mk4((g, r) => {
    g.fillStyle = '#adaab8'; g.fillRect(0, 0, 16, 16);
    // lajes com argamassa
    g.fillStyle = '#8e8b9c';
    g.fillRect(0, 7, 16, 1); g.fillRect(((r() * 8) | 0) + 3, 0, 1, 7); g.fillRect(((r() * 8) | 0) + 5, 8, 1, 8);
    g.fillStyle = '#c4c1cf'; g.fillRect(1, 1, 6, 1); g.fillRect(9, 9, 5, 1);
    speck(g, r, 3, ['#9c99aa'], 2, 1);
  });

  // água viva com bandas de onda + brilhos
  SPR[T.DEEP] = [0, 1, 2, 3].map(f => mkTile(g => {
    g.fillStyle = '#1d6db4'; g.fillRect(0, 0, 16, 16);
    const o = f * 4;
    g.fillStyle = '#1a61a4';
    g.fillRect(0, (3 + o) % 16, 16, 2); g.fillRect(0, (10 + o) % 16, 16, 1);
    g.fillStyle = '#2b7fc6';
    g.fillRect((2 + o) % 16, 5, 6, 1); g.fillRect((9 + o) % 16, 12, 5, 1);
    g.fillStyle = '#4d9dda';
    g.fillRect((6 + o * 3) % 16, (8 + o) % 16, 3, 1);
    if (f === 1) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(11, 3, 2, 1); }
  }));
  SPR[T.SHALLOW] = [0, 1, 2, 3].map(f => mkTile(g => {
    g.fillStyle = '#3fa3e0'; g.fillRect(0, 0, 16, 16);
    const o = f * 4;
    g.fillStyle = '#3795d0';
    g.fillRect(0, (4 + o) % 16, 16, 2);
    g.fillStyle = '#63bbea';
    g.fillRect((1 + o) % 16, 6, 6, 1); g.fillRect((9 + o) % 16, 13, 5, 1);
    g.fillStyle = '#8ed2f2'; g.fillRect((12 + o) % 16, 2, 3, 1);
    if (f === 2) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(4, 9, 2, 1); }
  }));

  // casas: reboco claro + madeiramento escuro + base de pedra (meio Alundra)
  SPR[T.WALL] = mk4((g, r, v) => {
    g.fillStyle = '#f6e9c9'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#e9d9b2'; g.fillRect(0, 10, 16, 6);
    // base de pedra
    g.fillStyle = '#9d97a8'; g.fillRect(0, 13, 16, 3);
    g.fillStyle = '#b7b1c2'; g.fillRect(1, 13, 5, 1); g.fillRect(9, 14, 4, 1);
    g.fillStyle = '#6f6a7c'; g.fillRect(0, 15, 16, 1);
    // madeiramento
    g.fillStyle = '#5f3f22'; g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
    g.fillStyle = '#7b5530'; g.fillRect(0, 0, 1, 16); g.fillRect(14, 0, 1, 16);
    if (v % 2 === 0) { // janela redonda com floreira
      g.fillStyle = '#5f3f22'; g.beginPath(); g.arc(8, 6, 4.5, 0, 7); g.fill();
      g.fillStyle = '#8fdcf2'; g.beginPath(); g.arc(8, 6, 3.5, 0, 7); g.fill();
      g.fillStyle = '#d2f2fa'; g.fillRect(6, 4, 2, 2);
      g.fillStyle = '#5f3f22'; g.fillRect(7.5, 3, 1, 6); g.fillRect(5, 5.5, 6, 1);
      g.fillStyle = '#7b5530'; g.fillRect(4, 10, 8, 2);
      g.fillStyle = '#ff5a96'; g.fillRect(5, 9, 2, 1);
      g.fillStyle = '#ffc22e'; g.fillRect(9, 9, 2, 1);
      g.fillStyle = '#4fbe46'; g.fillRect(7, 9, 2, 1);
    } else if (v === 3) { // lampião
      g.fillStyle = '#5f3f22'; g.fillRect(7, 2, 2, 3);
      g.fillStyle = '#ffd24a'; g.fillRect(6.5, 5, 3, 4);
      g.fillStyle = '#fff3b0'; g.fillRect(7.5, 6, 1, 2);
    }
  });
  SPR[T.ROOF] = mk4((g, r, v) => {
    g.fillStyle = '#e0563c'; g.fillRect(0, 0, 16, 16);
    for (const y of [0, 5, 10]) { // telhas escamadas
      for (let x = ((y / 5) % 2) * -4; x < 16; x += 8) {
        g.fillStyle = '#c8452e';
        g.beginPath(); g.arc(x + 4, y + 4, 4, 0, Math.PI); g.fill();
        g.fillStyle = '#ef7454'; g.fillRect(x + 1, y, 6, 1.5);
      }
      g.fillStyle = 'rgba(90,25,15,.5)'; g.fillRect(0, y + 4, 16, 1);
    }
    if (r() > 0.85) { g.fillStyle = '#8fdcf2'; g.fillRect(12, 2, 2, 1); } // reflexo
  });
  SPR[T.DOOR] = mk4((g) => {
    g.fillStyle = '#f6e9c9'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#5f3f22'; g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
    // porta em arco com batente
    g.fillStyle = '#3f2a12'; g.beginPath(); g.arc(8, 6, 6, Math.PI, 0); g.fill(); g.fillRect(2, 6, 12, 10);
    g.fillStyle = '#7b4f24'; g.beginPath(); g.arc(8, 6, 5, Math.PI, 0); g.fill(); g.fillRect(3, 6, 10, 10);
    g.fillStyle = '#94643a'; g.fillRect(4, 4, 3, 11); g.fillRect(9, 4, 3, 11);
    g.fillStyle = '#5c3c1a'; g.fillRect(7.5, 3, 1, 13);
    g.fillStyle = '#2c1d0c'; g.fillRect(3, 15, 10, 1);
    g.fillStyle = '#ffd24a'; g.fillRect(10, 9, 2, 2);
    g.fillStyle = '#fff3b0'; g.fillRect(10, 9, 1, 1);
  });
  SPR[T.LAVA] = [0, 1, 2, 3].map(f => mkTile(g => {
    g.fillStyle = '#e8481a'; g.fillRect(0, 0, 16, 16);
    const o = f * 4;
    g.fillStyle = '#b32c10';
    g.fillRect(0, (1 + o) % 16, 16, 2);
    g.fillStyle = '#ff7f35'; g.fillRect((2 + o) % 16, 4, 6, 2); g.fillRect((9 + o) % 16, 11, 5, 2);
    g.fillStyle = '#ffd14a'; g.fillRect((4 + o) % 16, 5, 3, 1); g.fillRect((11 + o) % 16, 12, 2, 1);
    g.fillStyle = '#fff7c0'; g.fillRect((5 + o) % 16, 5, 1, 1);
  }));
  SPR[T.ROCK] = SPR[T.SAND]; // nunca desenhado (vira decor), fallback
  SPR[T.TREE] = SPR[T.GRASS];
  SPR[T.PALM] = SPR[T.SAND];
  SPR[T.ACACIA] = SPR[T.SAV];
  SPR[T.CACTUS] = SPR[T.SAND];
}
buildAtlas();

// classe de material por tile → transições orgânicas entre terrenos (estilo Alundra)
const MAT_CLASS = [];
{
  const M = {};
  M[T.DEEP] = 0; M[T.SHALLOW] = 0;
  M[T.GRASS] = 1; M[T.TALL] = 1; M[T.FLOWER] = 1; M[T.TREE] = 1;
  M[T.SAND] = 2; M[T.PALM] = 2; M[T.CACTUS] = 2;
  M[T.PATH] = 3; M[T.PLANK] = 4;
  M[T.SNOW] = 5; M[T.ICE] = 6;
  M[T.SAV] = 7; M[T.SAVTALL] = 7; M[T.ACACIA] = 7;
  M[T.VOLC] = 8; M[T.LAVA] = 9;
  M[T.STONE] = 10; M[T.ROCK] = 10;
  M[T.WALL] = 11; M[T.DOOR] = 11; M[T.ROOF] = 12;
  for (let i = 0; i < 32; i++) MAT_CLASS[i] = M[i] !== undefined ? M[i] : 1;
}
// [cor, contorno, prioridade] — o material de prioridade maior "avança" sobre o vizinho em lóbulos
const EDGE_STYLE = {
  1: ['#45b23e', '#2c7a2c', 9],   // grama
  7: ['#d8c163', '#a88f3c', 8],   // savana
  5: ['#f6fafe', '#c8d9ee', 7],   // neve
  6: ['#bfe6f8', '#8ecbe8', 6.5], // gelo
  8: ['#5b4a58', '#3a2d38', 6],   // vulcânico
  10: ['#adaab8', '#7f7c8c', 5],  // pedra
  2: ['#eed9a2', '#c8a86a', 4],   // areia
  3: ['#d3ab77', '#9c7c4e', 3],   // caminho
};
function drawOrganicEdge(tx, ty, vertical, style) {
  const [fill, dark] = style;
  const bx = tx * TILE, by = ty * TILE;
  for (let i = 0; i < 3; i++) {
    const jit = h2(tx * 3 + i, ty * 5 + (vertical ? 11 : 0));
    const off = 2.5 + i * 5.5 + (jit * 3 - 1.5);
    const rad = 2.4 + jit * 1.5;
    const cx2 = vertical ? bx + 16 : bx + off;
    const cy2 = vertical ? by + off : by + 16;
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx2, cy2, rad + 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(cx2 - 0.5, cy2 - 0.5, rad, 0, 7); ctx.fill();
  }
}

// ---------------------------------------------------------------- sprites: decoração

function drawShadow(x, y, rx, ry) {
  ctx.fillStyle = 'rgba(20,40,30,.18)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}

function drawDecor(d, time) {
  const sway = Math.sin(time * 0.9 + d.x * 0.05) * 0.8;
  switch (d.type) {
    case T.TREE: {
      // pinheiro nevado na geleira
      if (d.th === 'snow') {
        drawShadow(d.x, d.y + 2, 8, 3);
        ctx.fillStyle = '#5a4228'; ctx.fillRect(d.x - 2, d.y - 6, 4, 8);
        ctx.fillStyle = '#6e5232'; ctx.fillRect(d.x - 2, d.y - 6, 1, 8);
        const cx = d.x + sway * 0.5;
        for (let i = 0; i < 3; i++) { // camadas do pinheiro
          const w2 = 16 - i * 4, yy = d.y - 7 - i * 7;
          ctx.fillStyle = i % 2 ? '#2e6e46' : '#28613d';
          ctx.beginPath(); ctx.moveTo(cx - w2 / 2, yy); ctx.lineTo(cx, yy - 10); ctx.lineTo(cx + w2 / 2, yy); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f0f5fa'; // neve acumulada
          ctx.beginPath(); ctx.moveTo(cx - w2 / 2 + 1, yy); ctx.lineTo(cx - w2 / 4, yy - 4); ctx.lineTo(cx, yy); ctx.closePath(); ctx.fill();
          ctx.fillRect(cx + 1, yy - 2, w2 / 4, 2);
        }
        ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, d.y - 29, 2, 2);
        break;
      }
      // árvore frondosa (vila): tronco com raízes, 3 tons de copa + brilhos
      const big = d.v > 0.45; // duas silhuetas diferentes
      const cx = d.x + sway;
      drawShadow(d.x, d.y + 2, big ? 10 : 8, 3.2);
      ctx.fillStyle = '#5e4425';
      ctx.beginPath(); ctx.moveTo(d.x - 3, d.y + 2); ctx.lineTo(d.x - 2, d.y - 9); ctx.lineTo(d.x + 2, d.y - 9); ctx.lineTo(d.x + 3, d.y + 2);
      ctx.lineTo(d.x + 6, d.y + 2); ctx.lineTo(d.x + 3, d.y); ctx.lineTo(d.x - 3, d.y); ctx.lineTo(d.x - 6, d.y + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#755731'; ctx.fillRect(d.x - 2, d.y - 9, 2, 11);
      ctx.strokeStyle = '#4e3820'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(d.x + 1, d.y - 4); ctx.lineTo(d.x + 1, d.y); ctx.stroke();
      if (big) { // galhos
        ctx.strokeStyle = '#5e4425'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 8); ctx.lineTo(cx - 6, d.y - 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 7); ctx.lineTo(cx + 5, d.y - 13); ctx.stroke();
      }
      // copa: base escura → média → clara, com recortes orgânicos
      const ky = d.y - (big ? 17 : 14), kr = big ? 11 : 8.5;
      ctx.fillStyle = '#2d6a33';
      ctx.beginPath();
      ctx.arc(cx, ky, kr, 0, 7);
      ctx.arc(cx - kr * 0.7, ky + 3, kr * 0.6, 0, 7);
      ctx.arc(cx + kr * 0.7, ky + 3, kr * 0.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#3d8a41';
      ctx.beginPath();
      ctx.arc(cx - kr * 0.35, ky - kr * 0.25, kr * 0.72, 0, 7);
      ctx.arc(cx + kr * 0.45, ky + 1, kr * 0.5, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#54a851';
      ctx.beginPath(); ctx.arc(cx - kr * 0.3, ky - kr * 0.42, kr * 0.42, 0, 7); ctx.fill();
      // folhinhas de brilho + frutas
      ctx.fillStyle = '#79c86a';
      ctx.fillRect(cx - kr * 0.6, ky - kr * 0.6, 2, 2);
      ctx.fillRect(cx + kr * 0.2, ky - kr * 0.75, 2, 2);
      ctx.fillRect(cx - 1, ky - kr * 0.2, 2, 2);
      if (d.v > 0.72) {
        ctx.fillStyle = '#e05050';
        ctx.beginPath(); ctx.arc(cx + kr * 0.4, ky - 2, 1.6, 0, 7); ctx.arc(cx - kr * 0.5, ky + 2, 1.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff9090'; ctx.fillRect(cx + kr * 0.4 - 1, ky - 3, 1, 1);
      } else if (d.v < 0.12) {
        ctx.fillStyle = '#f0c0e0'; // árvore florida rara
        for (const [fx, fy] of [[-0.5, -0.4], [0.3, -0.6], [0.6, 0.1], [-0.2, 0.2]])
          ctx.fillRect(cx + kr * fx, ky + kr * fy, 2, 2);
      }
      break;
    }
    case T.PALM: {
      drawShadow(d.x + 2, d.y + 2, 8, 3);
      ctx.strokeStyle = '#9a7444'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(d.x - 2, d.y + 2); ctx.quadraticCurveTo(d.x + 1, d.y - 8, d.x + 4 + sway, d.y - 16); ctx.stroke();
      ctx.strokeStyle = '#ac8450'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(d.x - 2, d.y + 2); ctx.quadraticCurveTo(d.x + 1, d.y - 8, d.x + 4 + sway, d.y - 16); ctx.stroke();
      const px = d.x + 4 + sway, py = d.y - 16;
      ctx.strokeStyle = '#3f9a48'; ctx.lineWidth = 2;
      for (const [ax, ay] of [[-8, -2], [-5, -6], [1, -7], [6, -5], [8, 0], [5, 3]]) {
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + ax * 0.7, py + ay - 2, px + ax, py + ay + 2); ctx.stroke();
      }
      ctx.fillStyle = '#7a5428';
      ctx.beginPath(); ctx.arc(px - 2, py + 1, 1.5, 0, 7); ctx.arc(px + 2, py + 2, 1.5, 0, 7); ctx.fill();
      break;
    }
    case T.ACACIA: {
      drawShadow(d.x, d.y + 2, 9, 3);
      ctx.fillStyle = '#7a5a30';
      ctx.fillRect(d.x - 1, d.y - 8, 2, 10);
      ctx.beginPath(); ctx.moveTo(d.x, d.y - 8); ctx.lineTo(d.x - 5, d.y - 12); ctx.lineTo(d.x - 4, d.y - 13); ctx.lineTo(d.x + 1, d.y - 9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(d.x, d.y - 8); ctx.lineTo(d.x + 5, d.y - 12); ctx.lineTo(d.x + 4, d.y - 13); ctx.lineTo(d.x - 1, d.y - 9); ctx.fill();
      const cx = d.x + sway * 0.6;
      ctx.fillStyle = '#5e8e34';
      ctx.beginPath(); ctx.ellipse(cx, d.y - 14, 10, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fa03e';
      ctx.beginPath(); ctx.ellipse(cx - 1, d.y - 15.5, 7, 2.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#82b44c'; ctx.fillRect(cx - 5, d.y - 17, 3, 1); ctx.fillRect(cx + 2, d.y - 16, 3, 1);
      break;
    }
    case T.CACTUS: {
      drawShadow(d.x, d.y + 2, 5, 2);
      ctx.fillStyle = '#3e8e46';
      ctx.fillRect(d.x - 2, d.y - 12, 5, 14);
      ctx.fillRect(d.x - 7, d.y - 9, 5, 3); ctx.fillRect(d.x - 7, d.y - 9, 3, 6);
      ctx.fillRect(d.x + 3, d.y - 6, 5, 3); ctx.fillRect(d.x + 5, d.y - 11, 3, 8);
      ctx.fillStyle = '#54a85a';
      ctx.fillRect(d.x - 2, d.y - 12, 2, 14); ctx.fillRect(d.x - 7, d.y - 9, 1, 6); ctx.fillRect(d.x + 5, d.y - 11, 1, 8);
      ctx.fillStyle = '#2e6e36';
      for (let i = 0; i < 4; i++) ctx.fillRect(d.x + 1, d.y - 10 + i * 3, 1, 1);
      if (d.v > 0.65) { ctx.fillStyle = '#f080a0'; ctx.fillRect(d.x - 1, d.y - 14, 3, 2); ctx.fillStyle = '#ffd0e0'; ctx.fillRect(d.x, d.y - 14, 1, 1); }
      break;
    }
    case T.ROCK: {
      drawShadow(d.x, d.y + 2, 7, 2.5);
      ctx.fillStyle = '#7e7e88';
      ctx.beginPath(); ctx.moveTo(d.x - 7, d.y + 2); ctx.lineTo(d.x - 5, d.y - 5); ctx.lineTo(d.x - 1, d.y - 8);
      ctx.lineTo(d.x + 4, d.y - 6); ctx.lineTo(d.x + 7, d.y + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#96969e';
      ctx.beginPath(); ctx.moveTo(d.x - 5, d.y - 4); ctx.lineTo(d.x - 1, d.y - 7); ctx.lineTo(d.x + 3, d.y - 5); ctx.lineTo(d.x - 2, d.y - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#68686f'; ctx.fillRect(d.x - 1, d.y - 2, 4, 1); ctx.fillRect(d.x + 1, d.y - 1, 3, 1);
      if (d.v > 0.6) { ctx.fillStyle = '#8ca86c'; ctx.fillRect(d.x - 5, d.y - 1, 2, 2); }
      break;
    }
    case 'bush': {
      // arbusto denso com contorno e camadas (como os da referência)
      const dry = d.th === 'savanna';
      const [outl, base, mid, hi] = dry
        ? ['#5c4a1c', '#8a7430', '#b09a42', '#e2cf7a']
        : ['#1d4d20', '#2f8a30', '#45b23e', '#8aec74'];
      const s = 0.9 + d.v * 0.35;
      const bx = d.x + sway * 0.4, by = d.y - 3;
      drawShadow(d.x, d.y + 1, 9 * s, 2.8);
      const lobes = [[-4.5, -1, 4.4], [0, -3.5, 5.2], [4.5, -1, 4.4], [-2, 1, 4.2], [2.5, 1, 4.2]];
      ctx.fillStyle = outl; // contorno
      for (const [ox, oy, rr] of lobes) { ctx.beginPath(); ctx.arc(bx + ox * s, by + oy * s, (rr + 1.1) * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = base;
      for (const [ox, oy, rr] of lobes) { ctx.beginPath(); ctx.arc(bx + ox * s, by + oy * s, rr * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = mid; // camada iluminada (luz de cima-esquerda)
      for (const [ox, oy, rr] of lobes) { ctx.beginPath(); ctx.arc(bx + (ox - 0.8) * s, by + (oy - 1) * s, rr * 0.62 * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = hi; // folhinhas de brilho
      ctx.fillRect(bx - 4 * s, by - 4 * s, 2, 1); ctx.fillRect(bx + 1 * s, by - 6 * s, 2, 1);
      ctx.fillRect(bx - 1 * s, by - 2 * s, 1, 1); ctx.fillRect(bx + 4 * s, by - 3 * s, 1, 1);
      if (!dry && d.v > 0.82) { // frutinhas
        ctx.fillStyle = '#ff5a96';
        ctx.fillRect(bx - 3, by - 1, 2, 2); ctx.fillRect(bx + 3, by - 4, 2, 2);
        ctx.fillStyle = '#ffd0e4'; ctx.fillRect(bx - 3, by - 1, 1, 1);
      }
      break;
    }
    case 'house': {
      // casa estilo Alundra: telhado projetado com beiral, empena e sombreamento 3D
      const x = d.x, yb = d.y;             // x = borda esquerda, yb = base da parede
      const W2 = 80;                        // 5 tiles de largura
      const wallTop = yb - 30;
      const [rA, rB, rC] = d.v > 0.55
        ? ['#e0563c', '#c8452e', '#ef7454'] // telhado vermelho vivo
        : ['#3f7fd0', '#3369b4', '#65a0e4']; // telhado azul vivo
      drawShadow(x + W2 / 2, yb + 2, W2 / 2 + 4, 5);
      // parede com sombreamento lateral
      ctx.fillStyle = '#f6e9c9'; ctx.fillRect(x + 2, wallTop, W2 - 4, 30);
      ctx.fillStyle = '#e4d2ab'; ctx.fillRect(x + W2 - 14, wallTop, 12, 30); // lado escuro
      ctx.fillStyle = '#fdf4dd'; ctx.fillRect(x + 2, wallTop, 8, 30);        // lado claro
      // fundação de pedra
      ctx.fillStyle = '#9d97a8'; ctx.fillRect(x + 2, yb - 5, W2 - 4, 5);
      ctx.fillStyle = '#b7b1c2';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i * 13, yb - 5, 7, 2);
      ctx.fillStyle = '#6f6a7c'; ctx.fillRect(x + 2, yb - 1, W2 - 4, 1);
      // madeiramento
      ctx.fillStyle = '#5f3f22';
      ctx.fillRect(x + 2, wallTop, 3, 30); ctx.fillRect(x + W2 - 5, wallTop, 3, 30);
      ctx.fillRect(x + 2, wallTop, W2 - 4, 2);
      ctx.fillRect(x + W2 / 2 - 22, wallTop + 2, 2, 26); ctx.fillRect(x + W2 / 2 + 20, wallTop + 2, 2, 26);
      // porta em arco (centro)
      const dx2 = x + W2 / 2;
      ctx.fillStyle = '#3f2a12';
      ctx.beginPath(); ctx.arc(dx2, yb - 17, 8, Math.PI, 0); ctx.fill();
      ctx.fillRect(dx2 - 8, yb - 17, 16, 15);
      ctx.fillStyle = '#7b4f24';
      ctx.beginPath(); ctx.arc(dx2, yb - 17, 6.5, Math.PI, 0); ctx.fill();
      ctx.fillRect(dx2 - 6.5, yb - 17, 13, 14);
      ctx.fillStyle = '#94643a'; ctx.fillRect(dx2 - 5, yb - 20, 4, 17); ctx.fillRect(dx2 + 1, yb - 20, 4, 17);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(dx2 + 3, yb - 12, 2, 2);
      // janela redonda com floreira
      const wx = x + 16;
      ctx.fillStyle = '#5f3f22'; ctx.beginPath(); ctx.arc(wx, wallTop + 12, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#8fdcf2'; ctx.beginPath(); ctx.arc(wx, wallTop + 12, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#d2f2fa'; ctx.fillRect(wx - 3, wallTop + 9, 3, 3);
      ctx.fillStyle = '#5f3f22'; ctx.fillRect(wx - 5, wallTop + 11.5, 10, 1); ctx.fillRect(wx - 0.5, wallTop + 7, 1, 10);
      ctx.fillStyle = '#7b5530'; ctx.fillRect(wx - 6, wallTop + 18, 12, 3);
      ctx.fillStyle = '#ff5a96'; ctx.fillRect(wx - 5, wallTop + 17, 3, 1);
      ctx.fillStyle = '#ffc22e'; ctx.fillRect(wx + 2, wallTop + 17, 3, 1);
      // sombra do beiral sobre a parede (o "quase 3D")
      ctx.fillStyle = 'rgba(40,25,12,.35)'; ctx.fillRect(x + 2, wallTop, W2 - 4, 5);
      // telhado projetado: trapézio com beiral ultrapassando a parede
      const eave = 7, roofH = 30;
      const rTop = wallTop - roofH, inset = 14;
      ctx.beginPath();
      ctx.moveTo(x - eave, wallTop + 2);
      ctx.lineTo(x + inset, rTop);
      ctx.lineTo(x + W2 - inset, rTop);
      ctx.lineTo(x + W2 + eave, wallTop + 2);
      ctx.closePath();
      ctx.fillStyle = rB; ctx.fill();
      // fileiras de telha escamada acompanhando a inclinação
      ctx.save(); ctx.clip();
      for (let row = 0; row < 5; row++) {
        const ry = rTop + 4 + row * 6.5;
        const spread = inset * (1 - row / 5) * 0.9;
        ctx.fillStyle = row % 2 ? rA : rC;
        for (let sx = x - eave + (row % 2) * 5 + spread - 6; sx < x + W2 + eave; sx += 9) {
          ctx.beginPath(); ctx.arc(sx, ry, 4.6, 0, Math.PI); ctx.fill();
        }
        ctx.fillStyle = 'rgba(70,20,10,.35)'; ctx.fillRect(x - eave, ry - 0.5, W2 + eave * 2, 1);
      }
      // brilho no topo do telhado
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.moveTo(x + inset, rTop); ctx.lineTo(x + W2 - inset, rTop);
      ctx.lineTo(x + W2 - inset - 4, rTop + 5); ctx.lineTo(x + inset + 4, rTop + 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      // cumeeira
      ctx.fillStyle = '#5a2418';
      ctx.fillRect(x + inset - 2, rTop - 2, W2 - inset * 2 + 4, 3);
      ctx.fillStyle = '#7a3424'; ctx.fillRect(x + inset - 2, rTop - 2, W2 - inset * 2 + 4, 1);
      // contorno do telhado
      ctx.strokeStyle = '#42210f'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - eave, wallTop + 2); ctx.lineTo(x + inset, rTop);
      ctx.moveTo(x + W2 - inset, rTop); ctx.lineTo(x + W2 + eave, wallTop + 2);
      ctx.moveTo(x - eave, wallTop + 2.8); ctx.lineTo(x + W2 + eave, wallTop + 2.8);
      ctx.stroke();
      // chaminé (algumas casas)
      if (d.v > 0.4) {
        const cx2 = x + W2 - 22;
        ctx.fillStyle = '#8d6650'; ctx.fillRect(cx2, rTop - 8, 8, 12);
        ctx.fillStyle = '#a87c62'; ctx.fillRect(cx2, rTop - 8, 3, 12);
        ctx.fillStyle = '#6b4c3a'; ctx.fillRect(cx2 - 1, rTop - 10, 10, 3);
        ctx.fillStyle = '#3f2a1e'; ctx.fillRect(cx2 + 1, rTop - 8, 6, 1);
      }
      break;
    }
    case 'post': {
      ctx.fillStyle = '#8a6438'; ctx.fillRect(d.x - 5, d.y - 4, 3, 8);
      ctx.fillStyle = '#a07848'; ctx.fillRect(d.x - 5, d.y - 4, 1, 8);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(d.x - 5, d.y + 5 + Math.sin(performance.now() / 400 + d.x) * 1, 3, 1);
      break;
    }
    case 'farol': {
      const bx = d.x, by = d.y; // base
      drawShadow(bx, by + 2, 20, 5);
      // torre listrada
      for (let i = 0; i < 5; i++) {
        const w2 = 22 - i * 2.6, yy = by - 10 - i * 11;
        ctx.fillStyle = i % 2 ? '#e84040' : '#f4f0e8';
        ctx.beginPath();
        ctx.moveTo(bx - w2 / 2, yy); ctx.lineTo(bx + w2 / 2, yy);
        ctx.lineTo(bx + (w2 - 2.6) / 2, yy - 11); ctx.lineTo(bx - (w2 - 2.6) / 2, yy - 11);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        ctx.fillRect(bx + w2 / 2 - 4, yy - 11, 4, 11);
      }
      // base de pedra
      ctx.fillStyle = '#8a8a92'; ctx.fillRect(bx - 12, by - 10, 24, 12);
      ctx.fillStyle = '#9a9aa2'; ctx.fillRect(bx - 12, by - 10, 24, 3);
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(bx - 4, by - 8, 8, 10); // porta
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(bx - 3, by - 7, 6, 9);
      // galeria + lanterna
      const ly = by - 65;
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(bx - 9, ly, 18, 3);
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(bx - 5, ly - 8, 10, 8);
      ctx.fillStyle = '#fff8d0'; ctx.fillRect(bx - 3, ly - 7, 4, 6);
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(bx - 6, ly - 9, 12, 2);
      ctx.beginPath(); ctx.moveTo(bx - 6, ly - 9); ctx.lineTo(bx, ly - 16); ctx.lineTo(bx + 6, ly - 9); ctx.closePath(); ctx.fill();
      // facho de luz girando (suave)
      const ang = performance.now() / 2400;
      const lx = bx, lyy = ly - 4;
      for (const off of [0, Math.PI]) {
        const a1 = ang + off, spread = 0.22;
        ctx.fillStyle = 'rgba(255,240,180,.10)';
        ctx.beginPath();
        ctx.moveTo(lx, lyy);
        ctx.lineTo(lx + Math.cos(a1 - spread) * 90, lyy + Math.sin(a1 - spread) * 34);
        ctx.lineTo(lx + Math.cos(a1 + spread) * 90, lyy + Math.sin(a1 + spread) * 34);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'kiosk': {
      const x = d.x, y = d.y; // canto sup. esquerdo em px; 3x2 tiles
      const isBoat = d.v === 1;
      drawShadow(x + 24, y + 2, 24, 4);
      // balcão
      ctx.fillStyle = '#8a6434'; ctx.fillRect(x + 2, y - 14, 44, 14);
      ctx.fillStyle = '#a07848'; ctx.fillRect(x + 2, y - 14, 44, 3);
      ctx.fillStyle = '#6a4a24'; ctx.fillRect(x + 2, y - 3, 44, 3);
      ctx.fillStyle = '#75552c';
      for (let i = 1; i < 4; i++) ctx.fillRect(x + 2 + i * 11, y - 11, 1, 8);
      // colunas
      ctx.fillStyle = '#6a4a24'; ctx.fillRect(x, y - 30, 3, 30); ctx.fillRect(x + 45, y - 30, 3, 30);
      // toldo listrado
      const c1 = isBoat ? '#3a78c9' : '#c94040';
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? c1 : '#f4ecd8';
        ctx.fillRect(x - 2 + i * 8.7, y - 36, 8.7, 8);
      }
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x - 2, y - 29, 52, 2);
      // mercadorias no balcão
      if (isBoat) {
        ctx.fillStyle = '#6a4a22'; ctx.beginPath(); ctx.ellipse(x + 14, y - 17, 7, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#a87c44'; ctx.beginPath(); ctx.ellipse(x + 14, y - 17.5, 5, 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#f4f0e8'; ctx.beginPath(); ctx.moveTo(x + 32, y - 16); ctx.lineTo(x + 32, y - 26); ctx.lineTo(x + 39, y - 17); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6434'; ctx.fillRect(x + 31, y - 26, 1.5, 10);
      } else {
        ctx.fillStyle = '#5aa9ff'; ctx.beginPath(); ctx.ellipse(x + 12, y - 17, 5, 2.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#6fd66f'; ctx.beginPath(); ctx.ellipse(x + 24, y - 17.5, 5, 2.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#c8c8c8'; ctx.beginPath(); ctx.ellipse(x + 36, y - 17, 5, 2.5, 0, 0, 7); ctx.fill();
      }
      // placa pendurada
      ctx.fillStyle = '#5a4224'; ctx.fillRect(x + 10, y - 29, 28, 9);
      ctx.fillStyle = '#e8d8a0'; ctx.fillRect(x + 11, y - 28, 26, 7);
      ctx.fillStyle = '#402a10'; ctx.font = 'bold 5px monospace'; ctx.textAlign = 'center';
      ctx.fillText(isBoat ? '~BARCOS~' : 'PEIXE&CIA', x + 24, y - 23);
      break;
    }
  }
}

// ---------------------------------------------------------------- sprites: personagens

const charCache = new Map();
const SKINS = ['#e8b88a', '#d8a070', '#b87848', '#f0c898'];
const HAIRS = ['#5a3a1a', '#2a2a2a', '#c87830', '#8a5a2a', '#d8c060'];

function charColors(name) {
  let hsum = 0;
  for (const c of name) hsum = (hsum * 31 + c.charCodeAt(0)) >>> 0;
  return {
    shirt: `hsl(${hsum % 360}, 48%, 52%)`,
    shirtD: `hsl(${hsum % 360}, 48%, 40%)`,
    hat: `hsl(${(hsum * 7) % 360}, 35%, 45%)`,
    skin: SKINS[hsum % SKINS.length],
    hair: HAIRS[(hsum >> 3) % HAIRS.length],
    pants: '#3a4460',
  };
}

// sprite 24x30 estilo Alundra: cabeça grande, 3 tons de sombra, contorno forte — pés em (12, 29)
function buildCharSprite(c, dir, frame, fishing) {
  const tmp = mkCanvas(24, 30);
  const g = tmp.getContext('2d');
  const legL = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  const skinD = 'rgba(120,60,30,.35)';

  // pernas com botas
  g.fillStyle = c.pants;
  g.fillRect(7, 22 + Math.min(0, legL), 4, 6 - Math.min(0, legL));
  g.fillRect(13, 22 + Math.min(0, -legL), 4, 6 - Math.min(0, -legL));
  g.fillStyle = '#3f2c16';
  g.fillRect(7, 27 + (legL < 0 ? -1 : 0), 4, 2.5); g.fillRect(13, 27 + (legL > 0 ? -1 : 0), 4, 2.5);
  g.fillStyle = '#6b4c28';
  g.fillRect(7, 27 + (legL < 0 ? -1 : 0), 4, 1); g.fillRect(13, 27 + (legL > 0 ? -1 : 0), 4, 1);

  // túnica com cinto e sombreamento (luz vindo da esquerda-cima)
  g.fillStyle = c.shirt; g.fillRect(6, 13, 12, 10);
  g.fillStyle = c.shirtD; g.fillRect(15, 13, 3, 10);          // lado escuro
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(6, 13, 2, 9); // lado claro
  g.fillStyle = '#4a3418'; g.fillRect(6, 20, 12, 2);           // cinto
  g.fillStyle = '#ffd24a'; g.fillRect(11, 20, 2, 2);           // fivela
  g.fillStyle = c.shirtD; g.fillRect(6, 22, 12, 1);            // barra da túnica

  // braços
  g.fillStyle = c.skin;
  if (fishing) {
    if (dir === 'left') { g.fillRect(2, 14, 5, 4); g.fillStyle = skinD; g.fillRect(2, 16, 5, 1); }
    else if (dir === 'right') { g.fillRect(17, 14, 5, 4); g.fillStyle = skinD; g.fillRect(17, 16, 5, 1); }
    else { g.fillRect(3, 14, 3, 5); g.fillRect(18, 14, 3, 5); }
  } else {
    const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    if (dir !== 'right') { g.fillRect(4, 14 + sw, 3, 7); g.fillStyle = c.shirt; g.fillRect(4, 14 + sw, 3, 3); g.fillStyle = c.skin; }
    if (dir !== 'left') { g.fillRect(17, 14 - sw, 3, 7); g.fillStyle = c.shirtD; g.fillRect(17, 14 - sw, 3, 3); g.fillStyle = c.skin; }
  }

  // cabeça grande e expressiva
  g.fillStyle = c.skin; g.fillRect(6, 4, 12, 10);
  g.fillStyle = skinD; g.fillRect(16, 5, 2, 8); // sombra lateral do rosto
  // cabelo
  g.fillStyle = c.hair;
  if (dir === 'up') g.fillRect(6, 4, 12, 7);
  else {
    g.fillRect(6, 4, 12, 2.5);
    g.fillRect(6, 4, 2.5, 6); g.fillRect(15.5, 4, 2.5, 6);
    g.fillRect(9, 6, 2, 1.5); g.fillRect(13, 6, 1.5, 1); // franja irregular
  }
  // chapéu de pescador com fita
  g.fillStyle = c.hat;
  g.fillRect(5, 1, 14, 4);
  g.fillRect(3.5, 4, 17, 2);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(5, 3.6, 14, 1.4); // fita
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(5, 1, 14, 1);
  // rosto
  if (dir !== 'up') {
    const eyeY = 8.5;
    g.fillStyle = '#241d16';
    if (dir === 'down' || dir === 'left') g.fillRect(8, eyeY, 2, 2.5);
    if (dir === 'down' || dir === 'right') g.fillRect(14, eyeY, 2, 2.5);
    g.fillStyle = '#fff';
    if (dir === 'down' || dir === 'left') g.fillRect(8, eyeY, 1, 1);
    if (dir === 'down' || dir === 'right') g.fillRect(14, eyeY, 1, 1);
    g.fillStyle = skinD;
    if (dir === 'down') { g.fillRect(11, 10.5, 2, 1.5); g.fillRect(10, 12.5, 4, 1); } // nariz+boca
    if (dir === 'left') g.fillRect(6.5, 10.5, 1.5, 1.5);
    if (dir === 'right') g.fillRect(16, 10.5, 1.5, 1.5);
  }

  // contorno forte estilo PS1
  const out = mkCanvas(24, 30);
  const og = out.getContext('2d');
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]]) og.drawImage(tmp, ox, oy);
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = '#241d16'; og.fillRect(0, 0, 24, 30);
  og.globalCompositeOperation = 'source-over';
  og.drawImage(tmp, 0, 0);
  return out;
}

function charSprite(name, dir, frame, fishing, npcColor) {
  const key = `${name}|${dir}|${frame}|${fishing ? 1 : 0}`;
  let s = charCache.get(key);
  if (!s) {
    const c = charColors(name);
    if (npcColor) { c.shirt = npcColor; c.shirtD = 'rgba(0,0,0,.25)'; }
    s = buildCharSprite(c, dir, frame, fishing);
    charCache.set(key, s);
  }
  return s;
}

const BOAT_SPRITES = {
  remo: (() => {
    const c = mkCanvas(36, 20);
    const g = c.getContext('2d');
    g.fillStyle = '#6a4a22'; g.beginPath(); g.ellipse(18, 10, 14.5, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#8a6434'; g.beginPath(); g.ellipse(18, 9.5, 13, 6.5, 0, 0, 7); g.fill();
    g.fillStyle = '#a87c44'; g.beginPath(); g.ellipse(18, 9, 11, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#7a5830'; g.fillRect(6, 8, 24, 1); g.fillRect(8, 11, 20, 1);
    g.fillStyle = '#c89858'; g.fillRect(12, 5, 12, 1.5);
    return c;
  })(),
  lancha: (() => {
    const c = mkCanvas(38, 20);
    const g = c.getContext('2d');
    g.fillStyle = '#c8ccd4'; g.beginPath(); g.ellipse(19, 11, 17, 7.5, 0, 0, 7); g.fill();
    g.fillStyle = '#f0f2f6'; g.beginPath(); g.ellipse(19, 10, 15.5, 6, 0, 0, 7); g.fill();
    g.save();
    g.beginPath(); g.ellipse(19, 10, 15.5, 6, 0, 0, 7); g.clip();
    g.fillStyle = '#3a78c9'; g.fillRect(2, 11, 34, 2.5);
    g.restore();
    g.fillStyle = '#9adcf0'; g.fillRect(24, 5, 8, 4); // para-brisa
    g.strokeStyle = '#8aa'; g.strokeRect(24, 5, 8, 4);
    return c;
  })(),
  veleiro: (() => {
    const c = mkCanvas(40, 46);
    const g = c.getContext('2d');
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.ellipse(20, 38, 17, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#9a6438'; g.beginPath(); g.ellipse(20, 37, 15, 5.5, 0, 0, 7); g.fill();
    g.fillStyle = '#c89858'; g.fillRect(8, 34, 24, 1.5);
    g.fillStyle = '#5a4224'; g.fillRect(19, 4, 2, 32); // mastro
    g.fillStyle = '#f4f0e4'; // velas
    g.beginPath(); g.moveTo(21, 5); g.lineTo(21, 30); g.lineTo(36, 30); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(18, 8); g.lineTo(18, 28); g.lineTo(7, 28); g.closePath(); g.fill();
    g.fillStyle = '#e84040'; g.beginPath(); g.moveTo(20, 4); g.lineTo(20, 1); g.lineTo(27, 2.5); g.closePath(); g.fill();
    return c;
  })(),
};

// x,y = centro dos pés; boat = false | 'remo' | 'lancha' | 'veleiro'
function drawChar(x, y, dir, name, moving, time, boat, fishing, npcColor) {
  x = Math.round(x); y = Math.round(y);
  if (boat) {
    const spr = BOAT_SPRITES[boat] || BOAT_SPRITES.remo;
    ctx.fillStyle = 'rgba(10,30,50,.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 5, 16, 5, 0, 0, 7); ctx.fill();
    const bobY = Math.sin(time * 2 + x * 0.1) * 1;
    ctx.drawImage(spr, x - spr.width / 2, y + 9 - spr.height + bobY);
    ctx.drawImage(charSprite(name, dir, 0, fishing, npcColor), x - 12, y - 31 + bobY);
    return;
  }
  drawShadow(x, y + 1, 7, 2.4);
  const frame = moving ? (Math.floor(time * 7) % 2 ? 1 : 2) : 0;
  const hop = moving ? -(Math.floor(time * 14) % 2) : 0;
  ctx.drawImage(charSprite(name, dir, frame, fishing, npcColor), x - 12, y - 29 + hop);
}

// visual do equipamento por tier — todos os jogadores veem ("ostentação")
const RODVIS = {
  bambu:   { len: 12, c: '#8a6434', hi: '#a8834c', reel: '#6a4a24' },
  fibra:   { len: 15, c: '#5a6a7a', hi: '#8a9aac', reel: '#3a4a5a' },
  carbono: { len: 18, c: '#23282f', hi: '#4aa0ff', reel: '#4aa0ff' },
  dourada: { len: 20, c: '#d8a020', hi: '#ffe080', reel: '#fff0a0', sparkle: true },
};
const LINEVIS = {
  nylon:    { c: 'rgba(255,255,255,.6)', bob: ['#e04040', '#fff'] },
  trancada: { c: 'rgba(140,240,170,.8)', bob: ['#30b050', '#eaffea'] },
  aco:      { c: 'rgba(190,220,255,.95)', bob: ['#ffd24a', '#fff8d0'] },
};

function drawFishingRodAndLine(p, isMe, time, now) {
  const phase = isMe ? fish.phase : p.fishing;
  const bobX = isMe ? fish.bobX : p.bobX;
  const bobY = isMe ? fish.bobY : p.bobY;
  if (!phase || phase === 'idle' || !bobX) return;
  const rod = RODVIS[(isMe ? profile.rod : p.rodT)] || RODVIS.bambu;
  const line = LINEVIS[(isMe ? profile.line : p.lineT)] || LINEVIS.nylon;
  const [dx, dy] = DIRV[p.dir] || [0, 1];
  const hx = p.x + dx * 6, hy = p.y - 14;

  // animação de arremesso: vara gira de trás pra frente
  const castT = isMe ? fish.castT : p.castT;
  const k = castT ? Math.min(1, (now - castT) / 320) : 1;
  const swing = (1 - k) * 2.2; // radianos "pra trás"
  // ângulo base da vara apontando na direção do lance
  const baseAng = Math.atan2(dy === 0 ? -0.55 : dy * 0.6 - 0.35, dx === 0 ? 0.001 : dx);
  const ang = baseAng - swing * (dx >= 0 ? 1 : -1) * (dy !== 0 ? 0.6 : 1);

  // vara enverga quando o peixe puxa
  const bend = phase === 'reeling' ? 3.5 + Math.sin(time * 16) * 1.5 : phase === 'bite' ? 1.5 : 0;
  const tipX = hx + Math.cos(ang) * rod.len;
  const tipY = hy + Math.sin(ang) * rod.len - (phase === 'reeling' ? 2 : 4);
  const midX = (hx + tipX) / 2 + (bobX > p.x ? -bend : bend) * 0.4;
  const midY = (hy + tipY) / 2 + bend * 0.7;

  // vara (curva) com cabo e molinete
  ctx.strokeStyle = rod.c; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(midX, midY, tipX, tipY); ctx.stroke();
  ctx.strokeStyle = rod.hi; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(midX, midY, tipX, tipY); ctx.stroke();
  ctx.fillStyle = rod.reel;
  ctx.beginPath(); ctx.arc(hx + Math.cos(ang) * 3, hy + Math.sin(ang) * 3 + 2, 2, 0, 7); ctx.fill();
  if (rod.sparkle && Math.floor(time * 4) % 3 === 0) {
    ctx.fillStyle = 'rgba(255,250,200,.9)';
    ctx.fillRect(tipX - 1 + Math.sin(time * 7) * 3, tipY - 3 + Math.cos(time * 5) * 2, 2, 2);
  }

  if (k < 0.85) return; // linha ainda voando durante o arremesso

  // boia
  let by = bobY + Math.sin(time * 2.5 + p.x) * 1.5;
  if (phase === 'bite') by += 3 + Math.sin(time * 25) * 2;
  if (phase === 'reeling') by += Math.sin(time * 14) * 3;
  if (phase !== 'reeling') {
    const ringR = 3 + Math.sin(time * 2) * 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(bobX, bobY + 2, ringR + 2, (ringR + 2) * 0.4, 0, 0, 7); ctx.stroke();
  }
  ctx.strokeStyle = line.c; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo((tipX + bobX) / 2, (tipY + by) / 2 + (phase === 'reeling' ? 1 : 7), bobX, by); ctx.stroke();
  ctx.fillStyle = line.bob[0]; ctx.beginPath(); ctx.arc(bobX, by, 3, 0, 7); ctx.fill();
  ctx.fillStyle = line.bob[1]; ctx.beginPath(); ctx.arc(bobX, by - 1.5, 1.6, 0, 7); ctx.fill();
  if (phase === 'bite') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText('!', p.x + 1, p.y - 29 + Math.sin(time * 18));
    ctx.fillStyle = '#ff4040';
    ctx.fillText('!', p.x, p.y - 30 + Math.sin(time * 18));
  }
}

function drawLabel(x, y, text, color) {
  ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// balão de fala estilo quadrinho
function drawSpeech(x, y, text) {
  ctx.font = '7px monospace';
  const lines = [];
  for (let i = 0; i < text.length; i += 20) lines.push(text.slice(i, i + 20));
  const w2 = Math.max(...lines.map(l => ctx.measureText(l).width)) + 10;
  const h2 = lines.length * 8 + 7;
  const bx = x - w2 / 2, by = y - h2;
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.strokeStyle = '#38506a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, w2, h2, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); // rabinho
  ctx.moveTo(x - 3, by + h2); ctx.lineTo(x, by + h2 + 4); ctx.lineTo(x + 3, by + h2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
  ctx.fillStyle = '#1c2c3c'; ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 9 + i * 8));
}

// ---------------------------------------------------------------- minimapa

const mm = document.getElementById('minimap');
mm.width = 200; mm.height = 150;
const mmctx = mm.getContext('2d');
const mmBase = mkCanvas(W, H);
{
  // mundo grande: pinta via ImageData (rápido)
  const HEXC = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const colors = {};
  for (const [t, h] of Object.entries({ [T.DEEP]: '#1a5580', [T.SHALLOW]: '#3585b5', [T.SAND]: '#ecdca6',
    [T.GRASS]: '#79c258', [T.TALL]: '#5aa844', [T.TREE]: '#43913f', [T.PALM]: '#ecdca6',
    [T.CACTUS]: '#e2d094', [T.SAV]: '#cdbb6b', [T.SAVTALL]: '#c0ae5e', [T.ACACIA]: '#6fa03e',
    [T.SNOW]: '#f0f5fa', [T.ICE]: '#c2e2f2', [T.ROCK]: '#8a8a92', [T.VOLC]: '#524a56',
    [T.LAVA]: '#e85020', [T.PATH]: '#dabf8e', [T.PLANK]: '#b58a55', [T.WALL]: '#cd5f4a',
    [T.ROOF]: '#cd5f4a', [T.DOOR]: '#cd5f4a', [T.FLOWER]: '#79c258',
    [T.STONE]: '#a8a8b0', [T.FAROLBASE]: '#e84040', [T.KIOSK]: '#cd5f4a' })) colors[t] = HEXC(h);
  const g = mmBase.getContext('2d');
  const img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const c = colors[MAP[i]] || [0, 0, 0];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function drawMinimap(time) {
  mmctx.imageSmoothingEnabled = false;
  mmctx.drawImage(mmBase, 0, 0, W, H, 0, 0, mm.width, mm.height);
  const sx = mm.width / (W * TILE), sy = mm.height / (H * TILE);
  // eventos no mar: círculo dourado pulsante (mistério — o tipo só se revela lá)
  const pulse = 2.2 + Math.sin(time * 4) * 0.9;
  for (const z of evZones) {
    mmctx.strokeStyle = '#ffd24a';
    mmctx.lineWidth = 1;
    mmctx.beginPath(); mmctx.arc(z.x * sx, z.y * sy, pulse, 0, 7); mmctx.stroke();
    mmctx.fillStyle = 'rgba(255,210,74,.85)';
    mmctx.fillRect(z.x * sx - 0.5, z.y * sy - 0.5, 1.5, 1.5);
  }
  // outros jogadores: bolinha verde-menta
  for (const p of others.values()) {
    mmctx.fillStyle = '#0a1420';
    mmctx.fillRect(p.x * sx - 2, p.y * sy - 2, 4, 4);
    mmctx.fillStyle = '#7affc8';
    mmctx.fillRect(p.x * sx - 1.5, p.y * sy - 1.5, 3, 3);
  }
  if (Math.floor(time * 3) % 2 === 0) {
    mmctx.fillStyle = '#ff4040';
    mmctx.fillRect(me.x * sx - 1.5, me.y * sy - 1.5, 3, 3);
  }
}

// ---------------------------------------------------------------- ambiente

const cloudShadows = Array.from({ length: 5 }, (_, i) => ({
  x: Math.random() * W * TILE, y: Math.random() * H * TILE,
  rx: 70 + Math.random() * 90, ry: 34 + Math.random() * 30, vx: 4 + Math.random() * 4,
}));

let birds = null, birdTimer = 12;

function spawnAmbient(dt, camX, camY, time) {
  // brilhos na água (azuis e por toda parte durante a Maré de Sorte)
  if (Math.random() < dt * 14) {
    const x = camX + Math.random() * VW, y = camY + Math.random() * VH;
    if (isWaterPx(x, y)) amb.push({ kind: 'sparkle', x, y, vx: 0, vy: 0, life: 0.9, max: 0.9 });
  }
  if (luckEvent && Math.random() < dt * 22) {
    amb.push({ kind: 'sparkle', x: camX + Math.random() * VW, y: camY + Math.random() * VH,
      vx: 0, vy: -6, life: 1.4, max: 1.4 });
  }
  // faíscas coloridas dentro dos círculos de evento
  for (const z of evZones) {
    if (z.x + z.r < camX || z.x - z.r > camX + VW || z.y + z.r < camY || z.y - z.r > camY + VH) continue;
    if (Math.random() < dt * 8) {
      const a = Math.random() * 7, rr = Math.random() * z.r * 0.85;
      amb.push({ kind: 'evspark', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr,
        vx: 0, vy: -8 - Math.random() * 6, life: 1.2, max: 1.2, c: z.color });
    }
  }
  // partículas por região
  const zone = currentZone;
  if (Math.random() < dt * 1.6) {
    const x = camX + Math.random() * VW, y = camY + Math.random() * VH;
    if (zone === 'gelo') amb.push({ kind: 'snow', x, y: camY - 5, vx: 6 + Math.random() * 8, vy: 14 + Math.random() * 10, life: 6, max: 6 });
    else if (zone === 'vulcao') { if (!isWaterPx(x, y)) amb.push({ kind: 'ember', x, y, vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 8, life: 1.6, max: 1.6 }); }
    else if (zone === 'vila' || zone === 'savana') { if (!isWaterPx(x, y)) amb.push({ kind: 'petal', x, y: camY - 5, vx: 8 + Math.random() * 8, vy: 10 + Math.random() * 8, life: 5, max: 5 }); }
  }
  // fumaça das chaminés das casas
  for (const d of DECOR) {
    if (d.type !== 'house' || d.v <= 0.4) continue;
    if (d.x < camX - 90 || d.x > camX + VW + 90 || d.y < camY - 30 || d.y > camY + VH + 100) continue;
    d.smokeT -= dt;
    if (d.smokeT <= 0) {
      d.smokeT = 0.5 + Math.random() * 0.4;
      amb.push({ kind: 'smoke', x: d.x + 62 + (Math.random() * 2 - 1), y: d.y - 68,
        vx: 2 + Math.random() * 3, vy: -7 - Math.random() * 3, life: 2.4, max: 2.4 });
    }
  }
  // gaivotas: voam em coordenadas do MUNDO (não acompanham a câmera)
  birdTimer -= dt;
  if (birdTimer <= 0 && !birds) {
    birdTimer = 18 + Math.random() * 18;
    const fromLeft = Math.random() < 0.5;
    birds = {
      x: fromLeft ? camX - 40 : camX + VW + 40,
      y: camY + 20 + Math.random() * (VH - 60),
      vx: fromLeft ? 26 : -26, vy: (Math.random() - 0.5) * 6,
      n: 3 + (Math.random() * 3 | 0), born: performance.now(),
    };
  }
  if (birds) {
    birds.x += birds.vx * dt;
    birds.y += birds.vy * dt;
    if (performance.now() - birds.born > 45000) birds = null;
  }
}

function drawAmbient(dt, time) {
  for (let i = amb.length - 1; i >= 0; i--) {
    const p = amb[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) { amb.splice(i, 1); continue; }
    const a = Math.min(1, p.life / p.max * 2) * Math.min(1, (p.max - p.life) * 4 + 0.2);
    switch (p.kind) {
      case 'sparkle': {
        const s = Math.sin((1 - p.life / p.max) * Math.PI);
        ctx.fillStyle = luckEvent ? `rgba(130,185,255,${0.85 * s})` : `rgba(255,255,255,${0.75 * s})`;
        ctx.fillRect(p.x, p.y, 2, 1); ctx.fillRect(p.x + 0.5, p.y - 1, 1, 3);
        break;
      }
      case 'petal':
        p.x += Math.sin(time * 2 + p.y * 0.1) * 12 * dt;
        ctx.fillStyle = `rgba(255,214,232,${0.85 * a})`;
        ctx.fillRect(p.x, p.y, 2, 2);
        break;
      case 'snow':
        p.x += Math.sin(time * 1.5 + p.y * 0.08) * 10 * dt;
        ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
        ctx.fillRect(p.x, p.y, 2, 2);
        break;
      case 'ember':
        ctx.fillStyle = `rgba(255,${140 + (p.life * 60 | 0)},60,${a})`;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
        break;
      case 'evspark': {
        const s2 = Math.sin((1 - p.life / p.max) * Math.PI);
        ctx.globalAlpha = 0.9 * s2;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, 2, 1); ctx.fillRect(p.x + 0.5, p.y - 1, 1, 3);
        ctx.globalAlpha = 1;
        break;
      }
      case 'smoke': {
        const r2 = 2 + (1 - p.life / p.max) * 4;
        ctx.fillStyle = `rgba(230,230,235,${0.35 * (p.life / p.max)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r2, 0, 7); ctx.fill();
        break;
      }
      case 'wake':
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * (p.life / p.max)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 + (1 - p.life) * 6, 2 + (1 - p.life) * 2, 0, 0, 7); ctx.stroke();
        break;
    }
  }
}

// vinheta pré-renderizada
const vignette = (() => {
  const c = mkCanvas(960, 540);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(480, 250, 260, 480, 270, 620);
  grad.addColorStop(0, 'rgba(10,20,35,0)');
  grad.addColorStop(1, 'rgba(10,20,35,.34)');
  g.fillStyle = grad; g.fillRect(0, 0, 960, 540);
  return c;
})();

// ---------------------------------------------------------------- espuma da costa

function drawFoam(tx, ty, time) {
  const x = tx * TILE, y = ty * TILE;
  const pulse = 0.22 + 0.13 * Math.sin(time * 1.8 + (tx + ty) * 0.9);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  if (!isWaterT(rTileAt(tx, ty - 1))) ctx.fillRect(x, y, 16, 2);
  if (!isWaterT(rTileAt(tx, ty + 1))) ctx.fillRect(x, y + 14, 16, 2);
  if (!isWaterT(rTileAt(tx - 1, ty))) ctx.fillRect(x, y, 2, 16);
  if (!isWaterT(rTileAt(tx + 1, ty))) ctx.fillRect(x + 14, y, 2, 16);
}

// ---------------------------------------------------------------- overlays de tela

function drawReel() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const r = reel;
  const bx = 700, by = 120, bh = 280, bw = 32;
  ctx.fillStyle = 'rgba(12,20,32,.92)';
  ctx.beginPath(); ctx.roundRect(bx - 16, by - 38, 104, bh + 70, 10); ctx.fill();
  ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.stroke(); // borda na cor da raridade
  ctx.fillStyle = '#cde'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('SEGURE ESPAÇO', bx + 36, by - 18);
  ctx.fillStyle = r.color; ctx.font = 'bold 10px monospace';
  if (catalog && catalog.rarities[r.rarity]) ctx.fillText(catalog.rarities[r.rarity].label.toUpperCase(), bx + 36, by + bh + 22);
  ctx.fillStyle = '#101f30'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill();
  const half = r.zoneH / 2;
  const zy = by + (1 - r.zonePos - half) * bh;
  const zg = ctx.createLinearGradient(0, zy, 0, zy + r.zoneH * bh);
  zg.addColorStop(0, 'rgba(110,235,150,.65)'); zg.addColorStop(1, 'rgba(60,180,110,.65)');
  ctx.fillStyle = zg;
  ctx.beginPath(); ctx.roundRect(bx + 1, zy, bw - 2, r.zoneH * bh, 5); ctx.fill();
  // peixe pintado com a cor da raridade
  ctx.imageSmoothingEnabled = false;
  const fy = by + (1 - r.fishPos) * bh;
  ctx.drawImage(fishIcon('reel-' + r.rarity, r.color, true), bx + bw / 2 - 15, fy - 8);
  // fadiga: zzz flutuando + aviso pulsante
  if (r.tired > 0) {
    const t2 = performance.now() / 1000;
    ctx.font = `${9 + Math.min(r.tired, 3)}px monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(180,210,255,${0.55 + 0.35 * Math.sin(t2 * 4)})`;
    ctx.fillText('💤', bx + bw / 2 + 14, fy - 10 - Math.sin(t2 * 2) * 3);
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = `rgba(140,200,255,${0.6 + 0.4 * Math.sin(t2 * 3)})`;
    ctx.fillText(`cansando ${'●'.repeat(r.tired)}${'○'.repeat(6 - r.tired)}`, bx + 36, by - 28);
  }
  ctx.fillStyle = '#101f30'; ctx.beginPath(); ctx.roundRect(bx + bw + 14, by, 14, bh, 6); ctx.fill();
  const ph = r.progress * bh;
  const pg = ctx.createLinearGradient(0, by + bh, 0, by);
  pg.addColorStop(0, '#e6b03a'); pg.addColorStop(1, '#7affc8');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.roundRect(bx + bw + 14, by + bh - ph, 14, ph, 5); ctx.fill();
}

function drawCatchCard(now) {
  const age = (now - catchCard.t) / 1000;
  if (age > 3.2) { catchCard = null; return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const f = catchCard.fish;
  const r = catalog.rarities[f.rarity];
  const cx = 480, cy = 150;
  const a = Math.min(1, age * 4) * Math.min(1, (3.2 - age) * 2);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(12,20,32,.93)';
  ctx.strokeStyle = r.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(cx - 160, cy - 48, 320, 96, 14); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fishIcon(f.fishId, r.color, true), cx - 148, cy - 16, 64, 34);
  ctx.fillStyle = r.color; ctx.font = 'bold 17px monospace';
  ctx.fillText(f.name, cx + 20, cy - 14);
  ctx.fillStyle = '#ccc'; ctx.font = '13px monospace';
  ctx.fillText(`${r.label} · ${f.weight} kg · ${ZONE_NAMES[f.zone]}`, cx + 20, cy + 6);
  ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 14px monospace';
  ctx.fillText(`+${f.value} 🪙 no balde`, cx + 20, cy + 28);
  ctx.restore();
}

// desenhadas em coordenadas de mundo (dentro da transform da câmera)
function drawBirds(time) {
  if (!birds) return;
  ctx.strokeStyle = 'rgba(40,55,70,.7)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < birds.n; i++) {
    const bx = birds.x - i * 12 * Math.sign(birds.vx) + (i % 2) * 4;
    const by = birds.y + (i % 2) * 7 + i * 2.5;
    const flap = Math.sin(time * 9 + i) * 2.5;
    // sombra da gaivota no chão/água
    ctx.fillStyle = 'rgba(20,40,60,.08)';
    ctx.beginPath(); ctx.ellipse(bx, by + 26, 4, 1.5, 0, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 4, by - flap); ctx.quadraticCurveTo(bx, by + 2, bx, by);
    ctx.quadraticCurveTo(bx, by + 2, bx + 4, by - flap);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- loop

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const time = now / 1000;

  if (profile) {
    if (!chatOpen) pollGamepad();
    updateMe(dt);
    if (reel) updateReel(dt);
    for (const p of others.values()) {
      p.x += (p.tx - p.x) * Math.min(1, dt * 10);
      p.y += (p.ty - p.y) * Math.min(1, dt * 10);
    }
  }

  const camX = Math.max(0, Math.min(W * TILE - VW, me.x - VW / 2));
  const camY = Math.max(0, Math.min(H * TILE - VH, me.y - VH / 2));
  ctx.setTransform(ZOOM, 0, 0, ZOOM, -Math.round(camX * ZOOM), -Math.round(camY * ZOOM));
  ctx.imageSmoothingEnabled = false;

  // tiles
  const frame = Math.floor(time * 2.2) % 4;
  const tx0 = Math.floor(camX / TILE), ty0 = Math.floor(camY / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(VH / TILE); ty++) {
    for (let tx = tx0; tx <= tx0 + Math.ceil(VW / TILE); tx++) {
      const t = rTileAt(tx, ty);
      const spr = SPR[t];
      if (spr) {
        const v = (t === T.DEEP || t === T.SHALLOW || t === T.LAVA)
          ? (frame + ((tx * 3 + ty * 5) & 3)) & 3
          : (h2(tx, ty) * 4) | 0;
        ctx.drawImage(spr[v % spr.length], tx * TILE, ty * TILE);
        // manchas em escala grande atravessando tiles (mata a cara de grid)
        if (t !== T.LAVA) {
          const patch = h2(tx >> 2, (ty >> 2) + 7);
          if (patch < 0.28) { ctx.fillStyle = isWaterT(t) ? 'rgba(0,15,50,.07)' : 'rgba(25,45,10,.06)'; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
          else if (patch > 0.74) { ctx.fillStyle = isWaterT(t) ? 'rgba(160,220,255,.05)' : 'rgba(255,250,190,.07)'; ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
        }
        if (isWaterT(t)) drawFoam(tx, ty, time);
        else {
          // transições orgânicas: o terreno dominante "morde" o vizinho em lóbulos
          const mc = MAT_CLASS[t];
          const tr = rTileAt(tx + 1, ty), tb = rTileAt(tx, ty + 1);
          if (!isWaterT(tr) && MAT_CLASS[tr] !== mc) {
            const a = EDGE_STYLE[mc], b = EDGE_STYLE[MAT_CLASS[tr]];
            if (a && b) drawOrganicEdge(tx, ty, true, a[2] >= b[2] ? a : b);
            else { ctx.fillStyle = 'rgba(35,25,14,.3)'; ctx.fillRect(tx * TILE + 15, ty * TILE, 1, TILE); }
          }
          if (!isWaterT(tb) && MAT_CLASS[tb] !== mc) {
            const a = EDGE_STYLE[mc], b = EDGE_STYLE[MAT_CLASS[tb]];
            if (a && b) drawOrganicEdge(tx, ty, false, a[2] >= b[2] ? a : b);
            else { ctx.fillStyle = 'rgba(35,25,14,.3)'; ctx.fillRect(tx * TILE, ty * TILE + 15, TILE, 1); }
          }
        }
      }
    }
  }

  // sombras de nuvens
  for (const c of cloudShadows) {
    c.x += c.vx * dt;
    if (c.x - c.rx > W * TILE) { c.x = -c.rx; c.y = Math.random() * H * TILE; }
    if (c.x + c.rx < camX || c.x - c.rx > camX + VW || c.y + c.ry < camY || c.y - c.ry > camY + VH) continue;
    ctx.fillStyle = 'rgba(30,50,80,.06)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, 7); ctx.fill();
  }

  // círculos de evento no mar (giratórios, com nome)
  for (const z of evZones) {
    if (z.x + z.r < camX || z.x - z.r > camX + VW || z.y + z.r < camY || z.y - z.r > camY + VH) continue;
    ctx.save();
    ctx.translate(z.x, z.y);
    // brilho interno
    const glow = ctx.createRadialGradient(0, 0, z.r * 0.2, 0, 0, z.r);
    glow.addColorStop(0, z.color + '26');
    glow.addColorStop(1, z.color + '08');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.fill();
    // anéis tracejados girando em sentidos opostos
    ctx.strokeStyle = z.color; ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -time * 26;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.stroke();
    ctx.setLineDash([5, 9]); ctx.lineDashOffset = time * 34; ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(0, 0, z.r - 8, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    // losangos orbitando
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 4; i++) {
      const a = time * 0.6 + i * Math.PI / 2;
      const gx = Math.cos(a) * (z.r - 18), gy = Math.sin(a) * (z.r - 18) * 0.96;
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 4); ctx.lineTo(gx + 3, gy); ctx.lineTo(gx, gy + 4); ctx.lineTo(gx - 3, gy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // nome flutuando (descobre ao chegar perto)
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    const ny2 = z.y - z.r - 10 + Math.sin(time * 1.5) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(`✦ ${z.name} ✦`, z.x + 1, ny2 + 1);
    ctx.fillStyle = z.color; ctx.fillText(`✦ ${z.name} ✦`, z.x, ny2);
  }

  if (profile) {
    // drops
    for (const d of drops.values()) {
      const r = catalog.rarities[d.fish.rarity];
      const bob = Math.sin(time * 3 + d.id) * 1.5;
      drawShadow(d.x, d.y + 4, 6, 2);
      ctx.drawImage(fishIcon(d.fish.fishId, r.color, true), d.x - 13, d.y - 7 + bob);
      if (Math.hypot(d.x - me.x, d.y - me.y) < 40) drawLabel(d.x, d.y - 12, '[E] pegar', '#7affc8');
    }

    // entidades ordenadas por Y (jogadores, NPCs e vegetação)
    const ents = [];
    for (const d of DECOR) {
      if (d.x < camX - 24 || d.x > camX + VW + 24 || d.y < camY - 8 || d.y > camY + VH + 32) continue;
      ents.push({ kind: 'decor', y: d.y, d });
    }
    for (const n of NPCS) ents.push({ kind: 'npc', y: n.ty * TILE + 14, n });
    for (const p of others.values()) ents.push({ kind: 'player', y: p.y, p });
    ents.push({ kind: 'me', y: me.y });
    ents.sort((a, b) => a.y - b.y);

    for (const e of ents) {
      if (e.kind === 'decor') { drawDecor(e.d, time); continue; }
      if (e.kind === 'npc') {
        const n = e.n;
        const nx = n.tx * TILE + 8, ny = n.ty * TILE + 14;
        drawChar(nx, ny, 'down', 'npc:' + n.id, false, time, false, false, n.role === 'shop' ? '#d9a24a' : '#9a6ad0');
        drawLabel(nx, ny - 34, n.name, '#ffe9a0');
        // indicador de missão
        if (n.role === 'quest' && catalog) {
          const qs = questState(n.id);
          if (!qs) drawLabel(nx, ny - 42, '!', '#ffd24a');
          else if (qs.done && !qs.allDone) drawLabel(nx, ny - 42, '✓', '#7affc8');
        }
        if (Math.hypot(nx - me.x, ny - me.y) < 40) drawLabel(nx, ny - 50, n.role === 'shop' ? '[E] loja' : '[E] falar', '#7affc8');
        continue;
      }
      // nome e nível se alternam de 2 em 2 segundos
      const showName = Math.floor(time / 2) % 2 === 0;
      if (e.kind === 'player') {
        const p = e.p;
        const pMoving = Math.hypot(p.tx - p.x, p.ty - p.y) > 1.5;
        drawChar(p.x, p.y, p.dir, p.name, pMoving, time, p.boat ? (p.boatT || 'remo') : false, !!p.fishing);
        if (p.sayFx && now < p.sayFx.until) drawSpeech(p.x, p.y - (p.boat ? 40 : 36), p.sayFx.text);
        else drawLabel(p.x, p.y - (p.boat ? 38 : 34), showName ? p.name : `Nível ${p.level}`, showName ? '#fff' : '#ffd88a');
        drawFishingRodAndLine(p, false, time, now);
        if (p.catchFx) {
          const age = (now - p.catchFx.t) / 1000;
          if (age > 2.4) p.catchFx = null;
          else drawLabel(p.x, p.y - 40 - age * 10, p.catchFx.fish.name + '!', catalog.rarities[p.catchFx.fish.rarity].color);
        }
      } else {
        drawChar(me.x, me.y, me.dir, me.name, me.moving, time, me.boat ? (profile.boat || 'remo') : false, fish.phase !== 'idle');
        if (me.sayFx && now < me.sayFx.until) drawSpeech(me.x, me.y - (me.boat ? 40 : 36), me.sayFx.text);
        else drawLabel(me.x, me.y - (me.boat ? 38 : 34), showName ? me.name : `Nível ${profile.level}`, showName ? '#bfe8ff' : '#ffd88a');
        drawFishingRodAndLine(me, true, time, now);
      }
    }

    // respingos
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt;
      if (s.life <= 0) { splashes.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(215,240,255,${s.life * 1.6})`;
      ctx.fillRect(s.x, s.y, 2, 2);
    }

    spawnAmbient(dt, camX, camY, time);
    drawAmbient(dt, time);
    drawBirds(time); // em coordenadas de mundo
  }

  // dia / entardecer / noite / amanhecer (sincronizado pelo servidor)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const na = nightAmount();
  if (na > 0.01) {
    const sunset = Math.sin(na * Math.PI);
    ctx.fillStyle = `rgba(255,140,60,${(sunset * 0.16).toFixed(3)})`;
    ctx.fillRect(0, 0, 960, 540);
    // escuridão com halo de luz ao redor do jogador
    const px = (me.x - camX) * ZOOM, py = (me.y - camY) * ZOOM;
    const grad = ctx.createRadialGradient(px, py, 30, px, py, 240);
    grad.addColorStop(0, `rgba(8,14,48,${(na * 0.14).toFixed(3)})`);
    grad.addColorStop(1, `rgba(8,14,48,${(na * 0.52).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 540);
  }
  // banner do evento
  if (luckEvent && profile) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(120,180,255,${pulse})`;
    ctx.fillText('🌙 MARÉ DE SORTE — 2x peixes raros! 🌙', 480, 525);
  }
  ctx.drawImage(vignette, 0, 0);
  if (reel) drawReel();
  if (catchCard) drawCatchCard(now);
  drawConfetti(dt);
  if (profile) { drawMinimap(time); tickMoney(dt); }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

})();
