// Lago Pixel v2.1 — cliente (visão aérea, renderizador caprichado)
(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ZOOM = 2;
const VW = 480, VH = 270;
const { W, H, TILE, T, WALK_OK, BOAT_OK, ISLANDS, NPCS, SPAWN, ZONE_NAMES, h2 } = WORLD;
const MAP = WORLD.genWorld();

// ---------------------------------------------------------------- idioma (PT é a fonte; EN via dicionário com fallback)
let LANG = localStorage.getItem('lp_lang') === 'en' ? 'en' : 'pt';
const EN_UI = {
  '⌨️ Teclas padrão restauradas!': '⌨️ Default keys restored!',
  '👕 Cor trocada!': '👕 Outfit color changed!',
  '👕 Cor original!': '👕 Original color!',
  'Conexão perdida. Recarregue a página.': 'Connection lost. Reload the page.',
  '⛵ Você embarcou! Pesque à vontade — aperte E perto da terra pra descer.': '⛵ You hopped aboard! Fish away — press E near land to hop off.',
  'Mire na água pra pescar!': 'Aim at the water to fish!',
  'Encoste numa praia pra desembarcar.': 'Get close to a beach to disembark.',
  '🎮 Controle desconectado': '🎮 Gamepad disconnected',
  '🎮 Controle conectado: ': '🎮 Gamepad connected: ',
  '[E] entrar': '[E] enter', '[E] pegar': '[E] take',
  '🪣 Balde': '🪣 Bucket', '🎒 Equipamento': '🎒 Gear',
  '🪣 Seu Balde': '🪣 Your Bucket', '🎒 Seu Equipamento': '🎒 Your Gear',
  '🎣 Varas': '🎣 Rods', '🧵 Linhas': '🧵 Lines', '🪱 Iscas': '🪱 Baits', '⛵ Barcos': '⛵ Boats',
  'equipado ✓': 'equipped ✓', 'equipar': 'equip', 'adquirido ✓': 'owned ✓', 'desequipar': 'unequip',
  'Guardar o barco': 'Stow your boat',
  'sem barco equipado você pode pegar carona no barco dos amigos': "with no boat equipped you can ride your friends' boats",
  'Nenhum barco — compre no Capitão Nereu!': "No boats yet — buy one from Captain Nereu!",
  'Balde vazio... vá pescar!': 'Bucket empty... go fish!',
  'balde vazio': 'empty bucket',
  'Soltar': 'Drop', 'destravar': 'unlock', 'travar (não vende nem solta)': "lock (won't sell or drop)",
  'todos os peixes travados 🔒': 'all fish locked 🔒',
  '[E] bater na porta': '[E] knock', '[E] mostruário': '[E] display wall',
  'tirar': 'take down', 'pendurar': 'mount', 'vaga livre na parede': 'free wall slot', 'sua casa ✓': 'your house ✓',
  '🌑 ALGO ABISSAL FISGOU SUA LINHA... 🌑': '🌑 SOMETHING ABYSSAL TOOK YOUR LINE... 🌑',
  '🚣 sem barco (compre no Capitão Nereu!)': "🚣 no boat (buy from Captain Nereu!)",
  'nenhuma': 'none', 'Isca: ': 'Bait: ',
  '👑 Você tem o melhor de tudo!': '👑 You own the best of everything!',
  '🗑️ Tralhas': '🗑️ Junk', '✦ Círculos de Evento': '✦ Event Circles', 'não capturado': 'not caught yet', 'recorde': 'record',
  'aperte...': 'press...', ' no balde': ' in the bucket', 'SEGURE ESPAÇO': 'HOLD SPACE',
  'Vender todos os peixes': 'Sell all fish', 'Vender': 'Sell',
  'atrai peixes raros': 'attracts rare fish', 'mordidas mais rápidas': 'faster bites',
  ' ✓ entregue!': ' ✓ turn it in!',
  'Digite seu nick (3 a 16 caracteres).': 'Enter your nickname (3–16 characters).',
  'O nick precisa de 3 a 16 caracteres.': 'The nickname needs 3–16 characters.',
  'Esse email não parece válido.': "That email doesn't look valid.",
  'Os emails não conferem.': "The emails don't match.",
  'A senha precisa de pelo menos 6 caracteres.': 'The password needs at least 6 characters.',
  'As senhas não conferem.': "The passwords don't match.",
  'Você precisa aceitar os termos e condições.': 'You must accept the terms and conditions.',
  'Não deu pra entrar. Tente de novo.': "Couldn't log in. Try again.",
  '⚠️ Esse pescador ainda não tem senha! Complete o cadastro pra proteger seu progresso.': '⚠️ This angler has no password yet! Complete the sign-up to protect your progress.',
  'Nick livre! Complete o cadastro pra criar sua conta.': 'Nickname available! Complete the sign-up to create your account.',
  'Já tem conta? Entrar': 'Already have an account? Log in',
  'Não tem conta? Criar uma agora': 'No account? Create one now',
  '⬆ mover pra cima': '⬆ move up', '⬇ mover pra baixo': '⬇ move down',
  '⬅ mover pra esquerda': '⬅ move left', '➡ mover pra direita': '➡ move right',
  '🎣 pescar / fisgar': '🎣 cast / hook', '🗨️ interagir / embarcar': '🗨️ interact / board',
  '📖 coleção': '📖 collection', '📜 missões': '📜 quests', '🪱 trocar isca': '🪱 switch bait', '🔊 som': '🔊 sound',
};
const TR = (s) => (LANG === 'en' ? (EN_UI[s] ?? s) : s);
if (LANG === 'en') {
  Object.assign(ZONE_NAMES, {
    vila: 'Harbor Village', gelo: 'White Glacier', deserto: 'Dry Dune', savana: 'Golden Coast',
    vulcao: 'Volcano Island', farol: 'Lighthouse Island', altomar: 'High Seas', tesouro: 'Secret Caves',
  });
  for (const isl of ISLANDS) if (ZONE_NAMES[isl.zone]) isl.name = ZONE_NAMES[isl.zone];
}
// pontos de passeio dos NPCs (mesma conta no servidor → posições idênticas pra todos)
const NPC_SPOTS = {};
for (const n of NPCS) NPC_SPOTS[n.id] = WORLD.npcWalkables(MAP, n);
const npcPos = (n) => WORLD.npcPosAt(NPC_SPOTS[n.id], n, Date.now());

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
  // FAROLBASE mantém tile próprio (calçada clara — destaca a entrada da torre)
  if (t === T.CAVE) {
    const theme = WORLD.nearestIsland(tx, ty).isl.theme;
    RENDER_MAP[ty * W + tx] = THEME_GROUND[theme];
    DECOR.push({ type: 'cave', x: tx * TILE + 8, y: (ty + 1) * TILE, v: h2(tx, ty), th: theme });
  }
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
    const theme = WORLD.nearestIsland(tx, ty).isl.theme;
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) {
      RENDER_MAP[(ty + yy) * W + tx + xx] = THEME_GROUND[theme];
    }
    DECOR.push({ type: 'house', x: tx * TILE, y: (ty + 4) * TILE, v: h2(tx, ty), smokeT: 0, th: theme });
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
// salas internas (farol + grutas + casas, no canto do mapa) só existem pra quem está dentro
const HIDDEN_ROOMS = [WORLD.INTERIOR, ...WORLD.CAVES.map((c) => c.room), WORLD.HOUSE_ROOM]
  .map((r) => ({ x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 }));
const HR_MAXX = Math.max(...HIDDEN_ROOMS.map((r) => r.x1));
const HR_MAXY = Math.max(...HIDDEN_ROOMS.map((r) => r.y1));
let myRoom = null;
function roomAtTile(tx, ty) {
  if (tx > HR_MAXX || ty > HR_MAXY) return null;
  for (const r of HIDDEN_ROOMS) if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r;
  return null;
}
const roomAtPx = (x, y) => roomAtTile(Math.floor(x / TILE), Math.floor(y / TILE));
const rTileAt = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return T.DEEP;
  const r = roomAtTile(tx, ty);
  if (r && r !== myRoom) return T.DEEP;
  return RENDER_MAP[ty * W + tx];
};

// ---------------------------------------------------------------- casas dos jogadores
// o servidor manda a lista de casas vendidas; o cliente constrói cada uma no
// próprio mapa (mesma função do servidor) e ajusta render + decoração
const HOUSES = [];
let housePrice = 1000000;
let houseInfo = null;   // { owner, trophies } — da casa em que estou agora
let housingData = null; // dados do painel da imobiliária

function applyHouse(hh) {
  if (HOUSES.some(x => x.owner === hh.owner)) return; // já construída
  const res = WORLD.applyHouseToMap(MAP, hh.island, hh.lot);
  if (!res) return;
  HOUSES.push({ owner: hh.owner, island: hh.island, lot: hh.lot });
  const { lot: L, cleared, ground, theme } = res;
  const clearedSet = new Set();
  for (let j = 0; j < cleared.length; j += 2) {
    const x = cleared[j], y = cleared[j + 1];
    clearedSet.add(x + ',' + y);
    const t = MAP[y * W + x];
    // o sprite grande da casa desenha por cima — o chão de render fica no tema
    RENDER_MAP[y * W + x] = (t === T.ROOF || t === T.WALL || t === T.DOOR) ? ground : t;
  }
  // árvores/pedras/arbustos que estavam no lote e na rua somem
  for (let j = DECOR.length - 1; j >= 0; j--) {
    const d = DECOR[j];
    if (clearedSet.has(Math.floor(d.x / TILE) + ',' + Math.floor(d.y / TILE))) DECOR.splice(j, 1);
  }
  DECOR.push({ type: 'house', x: L.hx * TILE, y: (L.hy + 4) * TILE, v: h2(L.hx, L.hy), smokeT: 0, th: theme, owner: hh.owner });
  mmRepaint = true; // minimapa ganha a rua nova no próximo frame
}
let mmRepaint = false;

// ---------------------------------------------------------------- estado

let ws = null;
let me = { id: 0, name: '', x: SPAWN.x, y: SPAWN.y, dir: 'down', moving: false, boat: false };
let profile = null, catalog = null;
let fishCat = null; // id -> espécie do catálogo (nomes já no idioma escolhido)
const dispFish = (f) => { const c = fishCat && fishCat.get(f.fishId); return c ? c.name : f.name; };
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
// moeda em SVG — o emoji de moeda renderiza como bola cinza/quadrado em vários aparelhos
const COIN = '<svg class="coinimg" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.6" fill="#7a4c0e"/><circle cx="6" cy="6" r="4.8" fill="#ffd24a"/><circle cx="6" cy="6" r="3.4" fill="#f0b02c"/><path d="M6 3.4l.8 1.6 1.8.2-1.3 1.2.3 1.8L6 7.3l-1.6.9.3-1.8-1.3-1.2 1.8-.2z" fill="#ffe9a0"/></svg>';

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
  for (const id of ['inventory', 'shop', 'dex', 'quests', 'settings', 'housing', 'trophy']) $(id).style.display = 'none';
  $('dialog').style.display = 'none';
}

// tradução dos textos fixos do HTML (roda antes de qualquer painel abrir)
function applyEnglishStatic() {
  if (LANG !== 'en') return;
  const set = (sel, prop, val) => { const el = document.querySelector(sel); if (el) el[prop] = val; };
  set('#login p', 'textContent', 'explore the archipelago, hook legends, complete quests');
  set('#login-name', 'placeholder', 'Your nickname');
  set('#login-pass', 'placeholder', 'Password');
  set('#login-btn', 'textContent', 'Set sail! ⚓');
  set('#cad-name', 'placeholder', 'Nickname (3–16 letters)');
  set('#cad-email', 'placeholder', 'Your email');
  set('#cad-email2', 'placeholder', 'Repeat the email');
  set('#cad-pass', 'placeholder', 'Password (min. 6)');
  set('#cad-pass2', 'placeholder', 'Repeat the password');
  set('#cad-btn', 'textContent', 'Create account & set sail! 🎣');
  $('cad-terms').parentElement.querySelector('span').innerHTML =
    'I have read and agree to the <a id="terms-link">terms and conditions</a>';
  $('cad-news').parentElement.querySelector('span').textContent =
    'I agree to receive game news by email';
  set('#login-switch', 'textContent', 'No account? Create one now');
  $('terms').innerHTML = `
    <div class="xclose">✕</div>
    <h2>📜 Terms & Conditions</h2>
    <div style="font-size:12.5px; color:#cde; text-align:justify; display:flex; flex-direction:column; gap:8px">
      <p><b>1. The game.</b> Lago Pixel is a free multiplayer fishing game, made for fun and not for profit. It may go offline, change or reset at any time, without notice.</p>
      <p><b>2. Your account.</b> You are responsible for keeping your password safe. Nicknames are unique: first to register keeps it. Accounts may be removed in case of abuse (chat harassment, cheating, offensive names).</p>
      <p><b>3. Your data.</b> We only store: nickname, email, password (encrypted) and game progress. Nothing is sold or shared with third parties. News emails are only sent if you opt in — and you can opt out anytime.</p>
      <p><b>4. Removal.</b> Want your account and data deleted? Tell us in the game chat or by the admin's email, and we remove everything.</p>
      <p><b>5. Tight lines!</b> Play fair, help the newbies and drop some fish for your friends. 🐟</p>
    </div>`;
  const invNote = document.querySelector('#invtab-bucket > div:last-child');
  if (invNote) invNote.innerHTML = `Total: <b class="coins"><span id="invtotal">0</span> ${COIN}</b> — sell at any shop in the archipelago. "Drop" leaves the fish on the ground for a friend to grab!`;
  const sellrow = document.querySelector('#shopsellrow > div');
  if (sellrow) sellrow.firstChild.textContent = 'Sell all fish ';
  set('#sellbtn', 'textContent', 'Sell');
  const qh2 = document.querySelectorAll('#quests h2');
  if (qh2[0]) qh2[0].textContent = '📜 Quests';
  if (qh2[1]) qh2[1].textContent = '🏆 Achievements';
  set('#housing h2', 'textContent', '🏠 Archipelago Real Estate');
  set('#trophy h2', 'textContent', '🖼️ Fish Display Wall');
  set('#trophyhead', 'textContent', '🪣 From the bucket to the wall');
  set('#knock-yes', 'textContent', '✅ Let them in');
  set('#knock-no', 'textContent', '❌ Not now');
  const qhint = document.querySelector('#quests > div[style]');
  if (qhint) qhint.textContent = 'Talk to the islanders (E key) to accept and turn in quests.';
  const dexh2 = document.querySelector('#dex h2');
  if (dexh2) dexh2.firstChild.textContent = '📖 Fish Collection ';
  set('#settings h2', 'textContent', '⚙️ Settings');
  set('#settings h3', 'textContent', '⌨️ Controls');
  set('#key-reset', 'textContent', 'Restore default keys');
  const kinfo = $('key-reset').nextElementSibling;
  if (kinfo) kinfo.innerHTML = 'SHIFT runs · ENTER opens the chat · ESC closes windows<br>🎮 Gamepad supported: stick/D-pad moves, A fishes, B interacts, RT turbo';
  const clabel = $('colorrow').previousElementSibling;
  if (clabel) clabel.textContent = '👕 Outfit color:';
  set('#set-sound', 'textContent', '🔊 Sound: on');
  set('#set-money', 'textContent', '💰 Show/hide the coin panel');
  set('#set-logout', 'textContent', '🚪 Log out (switch angler)');
  const tip = $('settings').lastElementChild;
  if (tip) tip.textContent = 'Tip: ESC closes any window.';
  const dclose = document.querySelector('#dialog .close');
  if (dclose) dclose.textContent = '[E or ESC to close]';
}
applyEnglishStatic();

// seletor de idioma (login) + botão nas configurações
$('lang-pt').classList.toggle('sel', LANG !== 'en');
$('lang-en').classList.toggle('sel', LANG === 'en');
$('lang-pt').onclick = () => { if (LANG !== 'pt') { localStorage.setItem('lp_lang', 'pt'); location.reload(); } };
$('lang-en').onclick = () => { if (LANG !== 'en') { localStorage.setItem('lp_lang', 'en'); location.reload(); } };
$('set-lang').textContent = LANG === 'en' ? '🌐 Language: English' : '🌐 Idioma: Português';
$('set-lang').onclick = () => {
  localStorage.setItem('lp_lang', LANG === 'en' ? 'pt' : 'en');
  location.reload();
};

// X de fechar em todos os painéis (essencial no celular)
for (const el of document.querySelectorAll('.xclose')) {
  const close = (e) => { e.preventDefault(); e.stopPropagation(); el.closest('.modal').style.display = 'none'; };
  el.addEventListener('click', close);
  el.addEventListener('touchstart', close, { passive: false });
}

// ---------------------------------------------------------------- configurações

$('btn-settings').addEventListener('click', () => togglePanel('settings'));
$('btn-settings').addEventListener('touchstart', (e) => { e.preventDefault(); togglePanel('settings'); }, { passive: false });
$('set-sound').onclick = () => {
  toggleAmbience();
  $('set-sound').textContent = LANG === 'en' ? (ambienceOn ? '🔊 Sound: on' : '🔇 Sound: off') : (ambienceOn ? '🔊 Som: ligado' : '🔇 Som: desligado');
};

// ---------------------------------------------------------------- teclas configuráveis
const KB_DEFAULT = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fish: 'Space',
  interact: 'KeyE', bucket: 'KeyI', dex: 'KeyC', quests: 'KeyQ', bait: 'KeyB', sound: 'KeyM' };
let KB = { ...KB_DEFAULT };
try { KB = { ...KB_DEFAULT, ...JSON.parse(localStorage.getItem('lp_keys') || '{}') }; } catch { /* padrão */ }
let rebinding = null;
const KB_ACTIONS = [
  ['up', '⬆ mover pra cima'], ['down', '⬇ mover pra baixo'], ['left', '⬅ mover pra esquerda'], ['right', '➡ mover pra direita'],
  ['fish', '🎣 pescar / fisgar'], ['interact', '🗨️ interagir / embarcar'],
  ['bucket', '🪣 balde'], ['dex', '📖 coleção'], ['quests', '📜 missões'],
  ['bait', '🪱 trocar isca'], ['sound', '🔊 som'],
];
function keyLabel(code) {
  if (code === 'Space') return LANG === 'en' ? 'SPACE' : 'ESPAÇO';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] || code;
}
function renderKeylist() {
  const box = $('keylist');
  box.innerHTML = '';
  for (const [act, label] of KB_ACTIONS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:2px 0';
    const sp = document.createElement('span');
    sp.textContent = TR(label);
    row.appendChild(sp);
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = rebinding === act ? TR('aperte...') : keyLabel(KB[act]);
    if (rebinding === act) b.style.background = '#8a6a1a';
    b.onclick = () => { rebinding = rebinding === act ? null : act; renderKeylist(); };
    row.appendChild(b);
    box.appendChild(row);
  }
}
$('key-reset').onclick = () => {
  KB = { ...KB_DEFAULT };
  localStorage.setItem('lp_keys', JSON.stringify(KB));
  rebinding = null;
  renderKeylist();
  toast(TR('⌨️ Teclas padrão restauradas!'), 1600);
};
renderKeylist();

// ---------------------------------------------------------------- tutorial de primeira pescaria
// só aparece pra quem nunca pescou; cada passo avança quando a pessoa FAZ a ação
let tutStep = -1;
let tutTimer = 0;
function tutTexts() {
  const k = keyLabel(KB.fish), e = keyLabel(KB.interact), q = keyLabel(KB.quests);
  if (LANG === 'en') {
    return IS_TOUCH ? [
      '🚶 Drag your finger on the left half of the screen to WALK',
      '🌊 Walk to the water\'s edge, face it and tap the 🎣 button to cast your line',
      '👀 Wait... when the ❗ pops up above you, tap 🎣 AGAIN to hook it!',
      '💪 HOLD the 🎣 button to keep the fish inside the bar until it fills up',
      '💰 Fish in the bucket! Find Teodoro in the village (🐟 stall) and tap USE to sell',
      '📜 Last tip: talk to Beatriz to get quests. Tight lines! 🎣',
    ] : [
      '🚶 Use WASD or the arrow keys to WALK',
      `🌊 Walk to the water's edge, face it and press ${k} to cast your line`,
      `👀 Wait... when the ❗ pops up above you, press ${k} AGAIN to hook it!`,
      `💪 HOLD ${k} to keep the fish inside the bar until it fills up`,
      `💰 Fish in the bucket! Find Teodoro in the village (🐟 stall) and press ${e} to sell`,
      `📜 Last tip: talk to Beatriz to get quests (${q} opens the journal). Tight lines! 🎣`,
    ];
  }
  return IS_TOUCH ? [
    '🚶 Arraste o dedo na metade esquerda da tela pra ANDAR',
    '🌊 Vá até a beira da água, olhe pra ela e toque no botão 🎣 pra lançar a linha',
    '👀 Espere... quando o ❗ aparecer em cima de você, toque no 🎣 DE NOVO pra fisgar!',
    '💪 SEGURE o botão 🎣 pra manter o peixe dentro da barra até ela encher',
    '💰 Peixe no balde! Ache o Teodoro na vila (barraquinha 🐟) e toque em USAR pra vender',
    '📜 Última dica: fale com a Beatriz pra pegar missões. Boa pesca! 🎣',
  ] : [
    '🚶 Use WASD ou as setas pra ANDAR',
    `🌊 Vá até a beira da água, olhe pra ela e aperte ${k} pra lançar a linha`,
    `👀 Espere... quando o ❗ aparecer em cima de você, aperte ${k} DE NOVO pra fisgar!`,
    `💪 SEGURE ${k} pra manter o peixe dentro da barra até ela encher`,
    `💰 Peixe no balde! Ache o Teodoro na vila (barraquinha 🐟) e aperte ${e} pra vender`,
    `📜 Última dica: fale com a Beatriz pra pegar missões (${q} abre o diário). Boa pesca! 🎣`,
  ];
}
function tutShow(n) {
  tutStep = n;
  tutTimer = 0;
  const el = $('tutorial');
  if (n < 0) { el.style.display = 'none'; return; }
  const steps = tutTexts();
  if (n >= steps.length) { tutDone(); return; }
  $('tut-text').innerHTML = `<span class="step">${Math.min(n + 1, 5)}/5</span>${steps[n]}`;
  el.style.display = 'block';
}
function tutDone() {
  tutStep = -1;
  $('tutorial').style.display = 'none';
  localStorage.setItem('lp_tut', '1');
}
{
  const skip = document.querySelector('#tutorial .tutskip');
  skip.addEventListener('click', tutDone);
  skip.addEventListener('touchstart', (e) => { e.preventDefault(); tutDone(); }, { passive: false });
}
function updateTutorial(dt) {
  if (tutStep < 0) return;
  if (tutStep === 0 && me.moving) { tutTimer += dt; if (tutTimer > 0.8) tutShow(1); }
  else if (tutStep === 1 && fish.phase !== 'idle') tutShow(2);
  else if (tutStep === 2 && reel) tutShow(3);
  else if (tutStep === 5) { tutTimer += dt; if (tutTimer > 12) tutDone(); }
  // passo 3 avança na captura; passo 4 avança quando abre a loja
}
// paleta de cores da roupa (fica salva no perfil do servidor)
{
  const row = $('colorrow');
  const hues = [0, 25, 45, 90, 140, 175, 205, 235, 275, 315];
  for (const h of hues) {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = `hsl(${h}, 55%, 52%)`;
    sw.onclick = () => {
      send({ type: 'set_color', hue: h });
      [...row.children].forEach(el => el.classList.remove('sel'));
      sw.classList.add('sel');
      toast(TR('👕 Cor trocada!'), 1200);
    };
    row.appendChild(sw);
  }
  const orig = document.createElement('div');
  orig.className = 'swatch';
  orig.style.background = 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)';
  orig.title = 'Cor original (pelo nome)';
  orig.onclick = () => { send({ type: 'set_color', hue: null }); toast(TR('👕 Cor original!'), 1200); };
  row.appendChild(orig);
}
$('set-money').onclick = () => {
  const el = $('money');
  const hidden = el.style.display === 'none';
  el.style.display = hidden ? 'block' : 'none';
  localStorage.setItem('lp_hidemoney', hidden ? '' : '1');
};
$('set-logout').onclick = () => {
  localStorage.removeItem('lp_name');
  localStorage.removeItem('lp_token');
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
  $('hud-boat').textContent = profile.boat ? `🚣 ${catalog.boats[profile.boat].name}` : TR('🚣 sem barco (compre no Capitão Nereu!)');
  const b = profile.activeBait;
  $('hud-bait').textContent = TR('Isca: ') + (b && profile.baits[b] > 0 ? `${catalog.baits[b].name} (${profile.baits[b]})` : TR('nenhuma'));
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

function renderTabs(box, tabs, sel, onPick) {
  box.innerHTML = '';
  for (const [key, label] of tabs) {
    const b = document.createElement('button');
    b.className = 'tab' + (sel === key ? ' sel' : '');
    b.textContent = label;
    b.onclick = () => onPick(key);
    box.appendChild(b);
  }
}

let invTab = 'bucket';
function refreshInventory() {
  renderTabs($('invtabs'), [['bucket', TR('🪣 Balde')], ['gear', TR('🎒 Equipamento')]], invTab,
    (k) => { invTab = k; refreshInventory(); });
  $('invtitle').textContent = invTab === 'bucket' ? TR('🪣 Seu Balde') : TR('🎒 Seu Equipamento');
  $('invtab-bucket').style.display = invTab === 'bucket' ? 'block' : 'none';
  $('invtab-gear').style.display = invTab === 'gear' ? 'block' : 'none';
  if (invTab === 'gear') { refreshGear(); return; }
  const list = $('invlist');
  list.innerHTML = '';
  let total = 0;
  profile.inventory.forEach((f, i) => {
    if (!f.locked) total += f.value;
    const row = document.createElement('div');
    row.className = 'fishrow';
    if (f.locked) row.style.background = 'rgba(255,210,74,.07)';
    const r = catalog.rarities[f.rarity];
    const info = document.createElement('span');
    info.innerHTML = `${f.locked ? '🔒 ' : ''}<span style="color:${r.color}">${dispFish(f)}</span> <span style="color:#9ab">${f.weight} kg</span>`;
    const right = document.createElement('span');
    right.innerHTML = `<b style="color:${f.locked ? '#8a7a4a' : '#ffd24a'}">${f.value} ${COIN}</b> `;
    // trava: peixe travado não é vendido no "vender tudo" nem pode ser solto
    const lockBtn = document.createElement('button');
    lockBtn.className = 'btn small';
    lockBtn.textContent = f.locked ? '🔒' : '🔓';
    lockBtn.title = f.locked ? TR('destravar') : TR('travar (não vende nem solta)');
    lockBtn.onclick = () => send({ type: 'lock', index: i });
    right.appendChild(lockBtn);
    right.appendChild(document.createTextNode(' '));
    const btn = document.createElement('button');
    btn.className = 'btn small'; btn.textContent = TR('Soltar');
    btn.disabled = !!f.locked;
    btn.onclick = () => send({ type: 'drop', index: i });
    right.appendChild(btn);
    row.appendChild(info); row.appendChild(right);
    list.appendChild(row);
  });
  if (!profile.inventory.length) list.innerHTML = `<div class="fishrow">${TR('Balde vazio... vá pescar!')}</div>`;
  $('invtotal').textContent = total.toLocaleString('pt-BR');
}

// aba Equipamento: troca vara/linha/barco de qualquer lugar (só o que você possui)
function refreshGear() {
  const box = $('invtab-gear');
  box.innerHTML = '';
  const groups = [
    [TR('🎣 Varas'), 'rod', catalog.rods, profile.rods, profile.rod],
    [TR('🧵 Linhas'), 'line', catalog.lines, profile.lines, profile.line],
    [TR('⛵ Barcos'), 'boat', catalog.boats, profile.boats, profile.boat],
  ];
  const descs = LANG === 'en' ? {
    rod: (i) => `luck +${i.luck}`,
    line: (i) => `fish escapes ${Math.round((1 - i.drain) * 100)}% less`,
    boat: (i) => `speed ${i.speed}x · ${i.seats} seat${i.seats === 1 ? '' : 's'}`,
  } : {
    rod: (i) => `sorte +${i.luck}`,
    line: (i) => `peixe escapa ${Math.round((1 - i.drain) * 100)}% menos`,
    boat: (i) => `velocidade ${i.speed}x · ${i.seats} carona${i.seats > 1 ? 's' : ''}`,
  };
  for (const [title, kind, items, ownedIds, eqId] of groups) {
    const h = document.createElement('h3');
    h.textContent = title;
    box.appendChild(h);
    const ids = (ownedIds || []).filter(id => items[id]);
    if (!ids.length) {
      const el = document.createElement('div');
      el.className = 'fishrow';
      el.textContent = kind === 'boat' ? TR('Nenhum barco — compre no Capitão Nereu!') : '—';
      box.appendChild(el);
      continue;
    }
    for (const id of ids) {
      const item = items[id];
      const el = document.createElement('div');
      el.className = 'shopitem';
      el.innerHTML = `<div>${item.name} <div class="desc">${descs[kind](item)}</div></div>`;
      if (eqId === id) {
        el.innerHTML += `<span class="owned">${TR('equipado ✓')}</span>`;
      } else {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = TR('equipar');
        btn.onclick = () => send({ type: 'equip', kind, id });
        el.appendChild(btn);
      }
      box.appendChild(el);
    }
    if (kind === 'boat' && profile.boat) { // guardar o barco = andar livre e pegar carona
      const el = document.createElement('div');
      el.className = 'shopitem';
      el.innerHTML = `<div>${TR('Guardar o barco')} <div class="desc">${TR('sem barco equipado você pode pegar carona no barco dos amigos')}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = TR('desequipar');
      btn.onclick = () => send({ type: 'equip', kind: 'boat', id: null });
      el.appendChild(btn);
      box.appendChild(el);
    }
  }
}

// cada espécie tem silhueta/padrão próprios (derivados do id), cor pela raridade
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const fishIconCache = new Map();
// cada espécie ganha cor viva própria (do hash do id) + silhueta; a raridade colore as barbatanas
function fishIcon(id, color, caught) {
  const key = `${id}|${color}|${caught ? 1 : 0}`;
  let c = fishIconCache.get(key);
  if (c) return c;
  let hsh = 7;
  for (const ch of id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  c = document.createElement('canvas');
  c.width = 60; c.height = 32; // 2x de resolução pro card e pro chão
  c.style.width = '30px'; c.style.height = '16px'; // no dex continua compacto
  const g = c.getContext('2d');
  g.scale(2, 2);
  const shape = hsh % 5; // 0 comum · 1 alongado · 2 disco · 3 tubarão · 4 ornamental
  const hue = hsh % 360;
  const hue2 = (hue + 150 + ((hsh >> 5) % 60)) % 360; // padrão em cor complementar
  const sat = shape === 3 ? 45 : 74;
  const body = caught ? `hsl(${hue},${sat}%,55%)` : '#1c2a38';
  const back = caught ? `hsl(${hue},${sat + 6}%,36%)` : '#131f2b';
  const belly = caught ? `hsl(${(hue + 40) % 360},60%,82%)` : '#1c2a38';
  const pat = caught ? `hsl(${hue2},72%,46%)` : '#131f2b';
  const finC = caught ? color : '#16222e'; // raridade nas barbatanas
  const outline = caught ? `hsl(${hue},55%,16%)` : '#0d151f';
  const bw = [9, 11.5, 7, 10, 7.5][shape];
  const bh = [4.5, 2.8, 6.3, 4, 4.3][shape];
  const cx = shape === 1 ? 13 : 12, cy = 8;

  const bodyPath = () => {
    g.beginPath();
    if (shape === 3) { // tubarão: focinho pontudo, dorso reto
      g.moveTo(cx - bw - 2.5, cy + 0.5);
      g.quadraticCurveTo(cx - bw + 2, cy - bh, cx + 2, cy - bh + 0.5);
      g.quadraticCurveTo(cx + bw, cy - bh + 2, cx + bw + 1, cy);
      g.quadraticCurveTo(cx + bw - 2, cy + bh, cx - 2, cy + bh - 0.5);
      g.quadraticCurveTo(cx - bw, cy + bh - 1, cx - bw - 2.5, cy + 0.5);
    } else if (shape === 1) { // alongado: agulha com focinho
      g.moveTo(cx - bw - 3.5, cy);
      g.quadraticCurveTo(cx - bw + 3, cy - bh - 0.6, cx + 3, cy - bh);
      g.quadraticCurveTo(cx + bw, cy - bh + 0.6, cx + bw, cy);
      g.quadraticCurveTo(cx + bw, cy + bh - 0.4, cx + 3, cy + bh);
      g.quadraticCurveTo(cx - bw + 3, cy + bh + 0.6, cx - bw - 3.5, cy);
    } else {
      g.ellipse(cx, cy, bw, bh, 0, 0, 7);
    }
    g.closePath();
  };

  // cauda (na cor da raridade, com base do corpo)
  g.fillStyle = finC;
  if (shape === 3) { // meia-lua de tubarão
    g.beginPath(); g.moveTo(cx + bw - 1, cy);
    g.lineTo(cx + bw + 5, cy - 6); g.lineTo(cx + bw + 2.5, cy - 0.5);
    g.lineTo(cx + bw + 5, cy + 5.5); g.closePath(); g.fill();
  } else if (shape === 4) { // véu duplo esvoaçante
    g.beginPath(); g.moveTo(cx + bw - 1.5, cy);
    g.quadraticCurveTo(cx + bw + 6, cy - 7, cx + bw + 6.5, cy - 2.5);
    g.quadraticCurveTo(cx + bw + 4, cy - 0.5, cx + bw + 6.5, cy + 2);
    g.quadraticCurveTo(cx + bw + 6, cy + 7, cx + bw - 1.5, cy); g.closePath(); g.fill();
  } else {
    const tw = shape === 1 ? 3.6 : 5.5;
    g.beginPath(); g.moveTo(cx + bw - 1, cy);
    g.lineTo(cx + bw + tw, cy - 4.6); g.lineTo(cx + bw + tw - 1.4, cy);
    g.lineTo(cx + bw + tw, cy + 4.6); g.closePath(); g.fill();
  }

  // corpo com contorno
  g.fillStyle = body; bodyPath(); g.fill();
  g.strokeStyle = outline; g.lineWidth = 0.9; bodyPath(); g.stroke();

  if (caught) {
    g.save(); bodyPath(); g.clip();
    g.fillStyle = back; // dorso mais escuro
    g.beginPath(); g.ellipse(cx, cy - bh * 0.9, bw * 1.05, bh * 0.85, 0, 0, 7); g.fill();
    g.fillStyle = belly; // barriga clara
    g.beginPath(); g.ellipse(cx - 1, cy + bh * 0.95, bw * 0.9, bh * 0.62, 0, 0, 7); g.fill();
    const p = (hsh >> 4) % 4; // padrão vivo
    g.fillStyle = pat;
    if (p === 0) for (let i = -1; i <= 1; i++) { // listras verticais
      g.beginPath(); g.moveTo(cx + i * 4.4 - 1.2, cy - bh); g.lineTo(cx + i * 4.4 + 1, cy - bh);
      g.lineTo(cx + i * 4.4 + 2, cy + bh); g.lineTo(cx + i * 4.4 - 0.2, cy + bh); g.closePath(); g.fill();
    }
    else if (p === 1) for (let i = 0; i < 5; i++) { // pintas grandes
      g.beginPath(); g.arc(cx - 5.5 + i * 3.1, cy - 1.6 + (i % 2) * 3.4, 1.15, 0, 7); g.fill();
    }
    else if (p === 2) { // faixa lateral
      g.fillRect(cx - bw - 3, cy - 1.1, bw * 2 + 6, 2.2);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(cx - bw - 3, cy - 1.1, bw * 2 + 6, 0.7);
    }
    else { // chevrons
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(cx + i * 4.6 - 2, cy - bh + 0.5); g.lineTo(cx + i * 4.6, cy);
        g.lineTo(cx + i * 4.6 - 2, cy + bh - 0.5); g.lineTo(cx + i * 4.6 - 0.7, cy + bh - 0.5);
        g.lineTo(cx + i * 4.6 + 1.4, cy); g.lineTo(cx + i * 4.6 - 0.7, cy - bh + 0.5); g.closePath(); g.fill();
      }
    }
    g.fillStyle = 'rgba(255,255,255,.35)'; // brilho no lombo
    g.beginPath(); g.ellipse(cx - 2, cy - bh * 0.55, bw * 0.55, 1, -0.15, 0, 7); g.fill();
    g.restore();
  }

  // barbatanas (raridade)
  g.fillStyle = finC;
  if (shape === 2) { // disco: dorsal e anal altas
    g.beginPath(); g.moveTo(cx - 4, cy - bh + 1); g.quadraticCurveTo(cx, cy - bh - 4, cx + 4.5, cy - bh + 1.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx - 3, cy + bh - 1); g.quadraticCurveTo(cx + 1, cy + bh + 3.6, cx + 4.5, cy + bh - 1.5); g.closePath(); g.fill();
  } else if (shape === 3) { // dorsal triangular de tubarão
    g.beginPath(); g.moveTo(cx - 2.5, cy - bh + 0.8); g.lineTo(cx + 0.5, cy - bh - 4); g.lineTo(cx + 3.5, cy - bh + 1); g.closePath(); g.fill();
  } else if (shape === 4) { // dorsal-fita ornamental
    g.beginPath(); g.moveTo(cx - 5, cy - bh + 1);
    g.quadraticCurveTo(cx - 2, cy - bh - 4.5, cx + 2, cy - bh - 3);
    g.quadraticCurveTo(cx + 4, cy - bh - 2, cx + 5, cy - bh + 1.5); g.closePath(); g.fill();
  } else {
    g.beginPath(); g.moveTo(cx - 3, cy - bh + 1); g.lineTo(cx + 0.5, cy - bh - 2.8); g.lineTo(cx + 3.5, cy - bh + 1); g.closePath(); g.fill();
  }
  // peitoral
  g.beginPath(); g.moveTo(cx - 3, cy + 0.5); g.quadraticCurveTo(cx - 1, cy + 3.4, cx + 2, cy + 2.2);
  g.quadraticCurveTo(cx - 0.5, cy + 1, cx - 3, cy + 0.5); g.closePath(); g.fill();

  // olho grande com brilho e boca
  if (caught) {
    const ex = cx - bw + (shape === 3 || shape === 1 ? 4.5 : 3);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, cy - 1.2, 2, 0, 7); g.fill();
    g.fillStyle = '#101826'; g.beginPath(); g.arc(ex + 0.4, cy - 1, 1.15, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillRect(ex - 0.6, cy - 2.2, 0.9, 0.9);
    g.strokeStyle = outline; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(cx - bw - (shape === 1 ? 3 : shape === 3 ? 2 : 0), cy + 1.6);
    g.lineTo(cx - bw + 2, cy + 2.2); g.stroke();
  }
  fishIconCache.set(key, c);
  return c;
}
const miniFish = (color, caught, id = 'x') => fishIcon(id, color, caught);

function refreshDex() {
  const list = $('dexlist');
  list.innerHTML = '';
  const zoneOrder = ['vila', 'altomar', 'farol', 'deserto', 'savana', 'gelo', 'vulcao', 'tesouro', 'ev', '*'];
  for (const z of zoneOrder) {
    const pool = catalog.fish.filter(f =>
      z === '*' ? f.zones[0] === '*'
      : z === 'ev' ? f.zones[0].startsWith('ev:') // exclusivos dos círculos de evento no mar
      : (f.zones[0] !== '*' && f.zones.includes(z)));
    if (!pool.length) continue;
    const h = document.createElement('h3');
    h.textContent = z === '*' ? TR('🗑️ Tralhas') : z === 'ev' ? TR('✦ Círculos de Evento') : '📍 ' + ZONE_NAMES[z];
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
        ? `<div class="nm" style="color:${r.color}">${f.name}</div><div class="st">${r.label} · ${d.n}x · ${TR('recorde')} ${d.best} kg</div>`
        : `<div class="nm" style="color:#456">???</div><div class="st">${r.label} · ${TR('não capturado')}</div>`;
      el.appendChild(info);
      grid.appendChild(el);
    }
    list.appendChild(grid);
  }
  $('dexcount').textContent = `(${Object.keys(profile.dex).length}/${catalog.fish.length})`;
}

const guardiaoDone = () => profile.quests.guardiao && profile.quests.guardiao.idx >= 1;
function questState(npcId) { // null = não aceitou; {q, prog, done} | {allDone} | {gated}
  const chain = catalog.quests[npcId];
  const st = profile.quests[npcId];
  if (!st) return null;
  if (st.idx >= chain.length) return { allDone: true };
  const q = chain[st.idx];
  if (q.after === 'guardiao' && !guardiaoDone()) return { gated: true }; // saga trancada
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
    const visLen = chain.filter(q => !q.after || guardiaoDone()).length; // saga trancada fica escondida na contagem
    const qs = questState(npcId);
    const el = document.createElement('div');
    el.className = 'questitem';
    if (!qs) {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name}<br><span style="color:#9ab">${LANG === 'en' ? `Visit to receive a quest. (${visLen} quests)` : `Visite pra receber uma missão. (${visLen} missões)`}</span>`;
    } else if (qs.allDone) {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name}<br><span class="prog">${LANG === 'en' ? `✓ All ${chain.length} quests complete!` : `✓ Todas as ${chain.length} missões concluídas!`}</span>`;
    } else if (qs.gated) {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name}<br><span style="color:#9ab">${LANG === 'en' ? "🌑 A story waits to be told... (earn the Guardian's Rod)" : '🌑 Uma história espera pra ser contada... (conquiste a Vara do Guardião)'}</span>`;
    } else {
      el.innerHTML = `<span class="npc">${npc.name}</span> — ${island.name} <span style="color:#9ab">(${qs.idx + 1}/${visLen})</span><br>` +
        `${qs.q.text} <span class="prog">${qs.prog}/${qs.q.need}${qs.done ? TR(' ✓ entregue!') : ''}</span>` +
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
    const descs = LANG === 'en' ? {
      rod: `luck +${item.luck} · bigger bar · level ${item.level}+`,
      line: `fish escapes ${Math.round((1 - item.drain) * 100)}% less · level ${item.level}+`,
      boat: `speed ${item.speed}x · ${item.seats} seat${item.seats === 1 ? '' : 's'} · level ${item.level}+`,
      bait: item.luckBonus ? 'attracts rare fish' : 'faster bites',
    } : {
      rod: `sorte +${item.luck} · barra maior · nível ${item.level}+`,
      line: `peixe escapa ${Math.round((1 - item.drain) * 100)}% menos · nível ${item.level}+`,
      boat: `velocidade ${item.speed}x · ${item.seats} carona${item.seats > 1 ? 's' : ''} · nível ${item.level}+`,
      bait: item.luckBonus ? 'atrai peixes raros' : 'mordidas mais rápidas',
    };
    el.innerHTML = `<div>${item.name}${kind === 'bait' ? ` ×${item.pack}` : ''} <div class="desc">${descs[kind]}${kind === 'bait' ? `${LANG === 'en' ? ' · you have ' : ' · você tem '}${profile.baits[id] || 0}` : ''}</div></div>`;
    const ownedIds = { rod: profile.rods, line: profile.lines, boat: profile.boats }[kind] || [];
    if (kind !== 'bait' && (ownedId === id || ownedIds.includes(id))) {
      // o lojista só vende — equipar é no seu inventário (🪣 → 🎒 Equipamento)
      el.innerHTML += `<span class="owned">${TR('adquirido ✓')}</span>`;
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn';
      const locked = kind !== 'bait' && profile.level < item.level;
      if (locked) btn.textContent = (LANG === 'en' ? 'level ' : 'nível ') + item.level + ' 🔒';
      else btn.innerHTML = item.price.toLocaleString('pt-BR') + ' ' + COIN;
      btn.disabled = locked || profile.coins < item.price;
      btn.onclick = () => send({ type: 'buy', kind, id });
      el.appendChild(btn);
    }
    box.appendChild(el);
  }
}

let shopStock = null; // { title, stock: { rod: [], line: [], bait: [], boat: [] } } — vem do servidor
let shopTab = null;
const SHOP_TABS = [['rod', TR('🎣 Varas')], ['line', TR('🧵 Linhas')], ['bait', TR('🪱 Iscas')], ['boat', TR('⛵ Barcos')]];
function refreshShop() {
  if (!shopStock) return;
  const sellable = profile.inventory.filter(f => !f.locked);
  const lockedN = profile.inventory.length - sellable.length;
  const total = sellable.reduce((s, f) => s + f.value, 0);
  const lockNote = lockedN ? (LANG === 'en' ? ` (${lockedN} 🔒 stay)` : ` (${lockedN} 🔒 ficam)`) : '';
  $('selldesc').textContent = sellable.length
    ? (LANG === 'en' ? `${sellable.length} fish = ${total.toLocaleString('pt-BR')} coins${lockNote}` : `${sellable.length} peixes = ${total.toLocaleString('pt-BR')} moedas${lockNote}`)
    : (lockedN ? TR('todos os peixes travados 🔒') : TR('balde vazio'));
  $('sellbtn').disabled = !sellable.length;
  $('shoptitle').textContent = shopStock.title;
  $('shopsellrow').style.display = 'flex'; // todo vendedor compra peixe
  const stock = shopStock.stock;
  const tabs = SHOP_TABS.filter(([k]) => (stock[k] || []).length);
  if (!tabs.some(([k]) => k === shopTab)) shopTab = tabs.length ? tabs[0][0] : 'rod';
  renderTabs($('shoptabs'), tabs, shopTab, (k) => { shopTab = k; refreshShop(); });
  const sections = {
    rod: [$('shoprods'), TR('🎣 Varas'), catalog.rods, profile.rod],
    line: [$('shoplines'), TR('🧵 Linhas'), catalog.lines, profile.line],
    bait: [$('shopbaits'), TR('🪱 Iscas'), catalog.baits, null],
    boat: [$('shopboats'), TR('⛵ Barcos'), catalog.boats, profile.boat],
  };
  for (const [k, [el]] of Object.entries(sections)) el.style.display = k === shopTab ? 'block' : 'none';
  const [box, title, allItems, eq] = sections[shopTab];
  const items = {};
  for (const id of stock[shopTab] || []) if (allItems[id]) items[id] = allItems[id];
  shopSection(box, title, shopTab, items, eq);
}

function refreshAchievements() {
  const list = $('achvlist');
  list.innerHTML = '';
  for (const a of catalog.achievements) {
    const got = profile.achv.includes(a.id);
    const el = document.createElement('div');
    el.className = 'questitem';
    el.innerHTML = got
      ? `<span class="prog">🏆 ${a.name}</span> — <span style="color:#9ab">${a.desc}</span> <span style="color:#ffd24a">✓ +${a.reward} ${COIN}</span>`
      : `<span style="color:#678">🔒 ${a.name}</span> — <span style="color:#567">${a.desc} (+${a.reward} ${COIN})</span>`;
    list.appendChild(el);
  }
}

// meta de dinheiro: próximo equipamento a comprar
function refreshMoneyGoal() {
  const top = (ids, items, fb) => Math.max(fb, ...(ids || []).map(i => items[i] ? items[i].price : fb));
  const owned = { rod: top(profile.rods, catalog.rods, catalog.rods[profile.rod].price),
    line: top(profile.lines, catalog.lines, catalog.lines[profile.line].price),
    boat: top(profile.boats, catalog.boats, profile.boat ? catalog.boats[profile.boat].price : -1) };
  let best = null;
  for (const [kind, items] of [['rod', catalog.rods], ['line', catalog.lines], ['boat', catalog.boats]]) {
    for (const [id, item] of Object.entries(items)) {
      if (item.secret) continue; // itens de missão não são meta de loja
      if (!(catalog.where && catalog.where[kind + ':' + id])) continue; // ninguém vende? não sugere
      if (item.price <= owned[kind]) continue;
      if (!best || item.price < best.price) best = { ...item, id, kind };
    }
  }
  const el = $('money-goal');
  if (!best) { el.textContent = TR('👑 Você tem o melhor de tudo!'); return; }
  const falta = best.price - profile.coins;
  const place = catalog.where[best.kind + ':' + best.id];
  el.innerHTML = falta > 0
    ? (LANG === 'en' ? `Need ${falta.toLocaleString('pt-BR')} ${COIN} → ${best.name}` : `Faltam ${falta.toLocaleString('pt-BR')} ${COIN} → ${best.name}`)
    : `💡 ${best.name} ${LANG === 'en' ? 'for sale at' : 'à venda:'} ${place}`;
}

$('sellbtn').onclick = () => send({ type: 'sell_all' });

// ---------------------------------------------------------------- imobiliária e mostruário

function refreshHousing() {
  if (!housingData) return;
  $('housingdesc').textContent = housingData.owned
    ? (LANG === 'en'
      ? `You already own a house in ${ZONE_NAMES[housingData.owned.island]} — one per angler!`
      : `Você já tem casa em ${ZONE_NAMES[housingData.owned.island]} — uma por pescador!`)
    : (LANG === 'en'
      ? `Your own house for ${housingData.price.toLocaleString('pt-BR')} coins. You pick the island, Marisol picks the lot — and the dirt street opens as the neighborhood grows!`
      : `Casa própria por ${housingData.price.toLocaleString('pt-BR')} moedas. Você escolhe a ilha, a Marisol escolhe o lote — e a rua de terra vai abrindo conforme o bairro cresce!`);
  const box = $('housinglist');
  box.innerHTML = '';
  for (const isl of housingData.islands) {
    const free = isl.total - isl.sold;
    const el = document.createElement('div');
    el.className = 'shopitem';
    el.innerHTML = `<div>🏠 ${isl.name} <div class="desc">${free
      ? (LANG === 'en' ? `${free} of ${isl.total} lots free` : `${free} de ${isl.total} lotes livres`)
      : (LANG === 'en' ? 'sold out!' : 'bairro lotado!')}</div></div>`;
    if (!housingData.owned && free) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.innerHTML = housingData.price.toLocaleString('pt-BR') + ' ' + COIN;
      btn.disabled = profile.coins < housingData.price;
      btn.onclick = () => { $('housing').style.display = 'none'; send({ type: 'buy_house', island: isl.id }); };
      el.appendChild(btn);
    } else if (housingData.owned && housingData.owned.island === isl.id) {
      el.innerHTML += `<span class="owned">${TR('sua casa ✓')}</span>`;
    }
    box.appendChild(el);
  }
}

function refreshTrophy() {
  const tros = (profile.house && profile.house.trophies) || [];
  $('trophydesc').textContent = LANG === 'en'
    ? 'Up to 5 fish mounted on the north wall — show off to your guests!'
    : 'Até 5 peixes montados na parede norte — ostente pras visitas!';
  const wall = $('trophywall');
  wall.innerHTML = '';
  for (let s = 0; s < 5; s++) {
    const el = document.createElement('div');
    el.className = 'shopitem';
    const f = tros[s];
    if (f) {
      const r = catalog.rarities[f.rarity];
      el.innerHTML = `<div><span style="color:${r.color}">${dispFish(f)}</span> <div class="desc">${f.weight} kg · ${r.label}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = TR('tirar');
      btn.onclick = () => send({ type: 'trophy_take', slot: s });
      el.appendChild(btn);
    } else {
      el.innerHTML = `<div style="color:#567">🖼️ ${TR('vaga livre na parede')}</div>`;
    }
    wall.appendChild(el);
  }
  const bl = $('trophybucket');
  bl.innerHTML = '';
  profile.inventory.forEach((f, i) => {
    const r = catalog.rarities[f.rarity];
    const el = document.createElement('div');
    el.className = 'fishrow';
    el.innerHTML = `<span><span style="color:${r.color}">${dispFish(f)}</span> <span style="color:#9ab">${f.weight} kg</span></span>`;
    const right = document.createElement('span');
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = TR('pendurar');
    btn.disabled = tros.length >= 5;
    btn.onclick = () => send({ type: 'trophy_add', index: i });
    right.appendChild(btn);
    el.appendChild(right);
    bl.appendChild(el);
  });
  if (!profile.inventory.length) bl.innerHTML = `<div class="fishrow">${TR('Balde vazio... vá pescar!')}</div>`;
}

// ---------------------------------------------------------------- batida na porta (popup do dono)

let knockSel = 0;
function updateKnockSel() {
  $('knock-yes').style.outline = knockSel === 0 ? '2px solid #7affc8' : 'none';
  $('knock-no').style.outline = knockSel === 1 ? '2px solid #ff8a7a' : 'none';
}
function showKnock(guest) {
  knockSel = 0;
  $('knocktext').textContent = LANG === 'en' ? `🚪 ${guest} is knocking on your door!` : `🚪 ${guest} está batendo na sua porta!`;
  $('knockhint').textContent = IS_TOUCH ? (LANG === 'en' ? 'tap to answer' : 'toque pra responder') : (LANG === 'en' ? '← → choose · E confirms' : '← → escolhe · E confirma');
  $('knock').style.display = 'block';
  updateKnockSel();
  beep(660, .09, 'square', .12); beep(520, .09, 'square', .12, .14); beep(660, .09, 'square', .12, .5);
}
function hideKnock() { $('knock').style.display = 'none'; }
function answerKnock(allow) { send({ type: 'knock_reply', allow }); hideKnock(); }
$('knock-yes').onclick = () => answerKnock(true);
$('knock-no').onclick = () => answerKnock(false);

// ---------------------------------------------------------------- rede

function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function tryJoin(payload) {
  if (ws && ws.readyState === 1) send({ type: 'join', lang: LANG, ...payload });
  else connect(payload);
}

function connect(payload) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onopen = () => send({ type: 'join', lang: LANG, ...payload });
  ws.onclose = () => toast(TR('Conexão perdida. Recarregue a página.'), 60000);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    switch (m.type) {
      case 'auth_error':
        localStorage.removeItem('lp_token');
        $('login').style.display = 'flex';
        lgMsg(m.text || TR('Não deu pra entrar. Tente de novo.'));
        break;
      case 'need_register':
        $('login').style.display = 'flex';
        setCadMode(true, m.name);
        lgMsg(m.legacy
          ? TR('⚠️ Esse pescador ainda não tem senha! Complete o cadastro pra proteger seu progresso.')
          : TR('Nick livre! Complete o cadastro pra criar sua conta.'));
        break;
      case 'welcome':
        if (m.token) localStorage.setItem('lp_token', m.token);
        lgMsg('');
        me.id = m.id; me.name = m.name;
        // reaparece onde saiu (servidor manda a posição salva ou o SPAWN)
        if (Number.isFinite(m.x) && Number.isFinite(m.y)) { me.x = m.x; me.y = m.y; }
        if (m.dir) me.dir = m.dir;
        profile = m.you; catalog = m.catalog;
        fishCat = new Map(catalog.fish.map((x) => [x.id, x]));
        timeOffset = m.timeOffset || 0; dayLen = m.dayLen || 1200; luckEvent = !!m.event;
        evZones.length = 0;
        if (m.zones) for (const z of m.zones) evZones.push(z);
        for (const p of m.players) others.set(p.id, { ...p, tx: p.x, ty: p.y });
        for (const d of m.drops) drops.set(d.id, d);
        housePrice = m.housePrice || housePrice;
        me.house = null; houseInfo = null;
        for (const hh of m.houses || []) applyHouse(hh); // constrói as casas vendidas no mapa local
        document.querySelector('#hud .name').textContent = '🎣 ' + me.name;
        $('login').style.display = 'none';
        refreshHUD();
        // primeira pescaria? mostra o tutorial guiado (não incomoda veteranos)
        if (!localStorage.getItem('lp_tut') && !profile.totalCaught) tutShow(0);
        else tutStep = -1;
        break;
      case 'time': timeOffset = m.timeOffset; break;
      case 'event': luckEvent = m.active; break;
      case 'teleport':
        me.x = m.x; me.y = m.y; me.boat = false;
        fish.phase = 'idle';
        sfx.boat();
        break;
      case 'ride':
        me.riding = m.owner; me.seat = m.seat;
        fish.phase = 'idle';
        sfx.boat();
        toast(TR('⛵ Você embarcou! Pesque à vontade — aperte E perto da terra pra descer.'), 3200);
        break;
      case 'ride_end':
        me.riding = null;
        if (m.x) { me.x = m.x; me.y = m.y; }
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
        if (tutStep === 3) tutShow(4); // ✅ primeiro peixe: manda achar o Teodoro
        break;
      case 'escaped': fish.phase = 'idle'; reel = null; toast(m.reason); sfx.fail(); break;
      case 'sold': profile = m.you; refreshHUD(); sfx.coin(); toast(LANG === 'en' ? `Sold everything for ${m.total.toLocaleString('pt-BR')} coins!` : `Vendeu tudo por ${m.total.toLocaleString('pt-BR')} moedas!`); break;
      case 'bought':
        profile = m.you; refreshHUD();
        if ($('trophy').style.display === 'block') refreshTrophy();
        if ($('housing').style.display === 'block') refreshHousing();
        break;
      case 'open_housing':
        housingData = m;
        togglePanel('housing');
        refreshHousing();
        break;
      case 'house_new':
        applyHouse(m.house);
        break;
      case 'house_enter':
        me.house = m.owner;
        houseInfo = { owner: m.owner, trophies: m.trophies || [] };
        me.x = m.x; me.y = m.y; me.boat = false; me.riding = null;
        fish.phase = 'idle';
        sfx.boat();
        if (m.owner !== me.name) toast(LANG === 'en' ? `🏠 Welcome to ${m.owner}'s house!` : `🏠 Bem-vindo à casa de ${m.owner}!`, 3000);
        break;
      case 'house_exit':
        me.house = null; houseInfo = null;
        me.x = m.x; me.y = m.y;
        fish.phase = 'idle';
        $('trophy').style.display = 'none';
        sfx.boat();
        break;
      case 'house_info':
        houseInfo = { owner: m.owner, trophies: m.trophies || [] };
        if ($('trophy').style.display === 'block') refreshTrophy();
        break;
      case 'knock':
        showKnock(m.guest);
        break;
      case 'knock_end':
        hideKnock();
        break;
      case 'levelup': sfx.level(); toast((LANG === 'en' ? '⭐ Level ' : '⭐ Nível ') + m.level + '!'); confetti(); break;
      case 'toast': toast(m.text); break;
      case 'announce': announce(m.text, m.rarity); break;
      case 'open_shop':
        shopStock = { title: m.title, stock: m.stock };
        shopTab = null; // refreshShop escolhe a primeira aba com estoque
        refreshShop();
        togglePanel('shop');
        if (tutStep === 4) tutShow(5); // ✅ achou o vendedor: última dica sobre missões
        break;
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
  if (rebinding) { // capturando nova tecla no menu de configurações
    e.preventDefault();
    if (e.code !== 'Escape') {
      const prev = Object.keys(KB).find((k) => KB[k] === e.code);
      if (prev && prev !== rebinding) KB[prev] = KB[rebinding]; // troca se já estava em uso
      KB[rebinding] = e.code;
      localStorage.setItem('lp_keys', JSON.stringify(KB));
    }
    rebinding = null;
    renderKeylist();
    return;
  }
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.code === KB.fish) e.preventDefault();

  if ($('knock').style.display === 'block') { // alguém batendo: setas escolhem, E confirma
    if (e.code === 'ArrowLeft' || e.code === KB.left || e.code === 'ArrowRight' || e.code === KB.right) {
      knockSel = 1 - knockSel; updateKnockSel(); return;
    }
    if (e.code === KB.interact || e.key === 'Enter') { answerKnock(knockSel === 0); return; }
    if (e.code === 'Escape') { answerKnock(false); return; }
  }

  if (e.code === KB.fish) {
    if (reel) return;
    if (fish.phase === 'idle') tryCast();
    else send({ type: 'hook' });
  }
  if (e.code === KB.interact) interact();
  if (e.code === KB.bucket) togglePanel('inventory');
  if (e.code === KB.dex) togglePanel('dex');
  if (e.code === KB.quests) togglePanel('quests');
  if (e.code === KB.bait) cycleBait();
  if (e.code === KB.sound) toggleAmbience();
  if (e.code === 'Escape') closeModals();
  if (e.key === 'Enter') { chatOpen = true; const inp = $('chatinput'); inp.style.display = 'block'; inp.focus(); e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

function tryCast() {
  const [dx, dy] = DIRV[me.dir];
  const bx = me.x + dx * TILE * 2.4, by = me.y + dy * TILE * 2.4;
  if (!isWaterPx(bx, by)) { toast(TR('Mire na água pra pescar!')); return; }
  send({ type: 'cast', bobX: Math.round(bx), bobY: Math.round(by) });
  sfx.cast();
}

function interact() {
  if ($('dialog').style.display === 'block') { $('dialog').style.display = 'none'; return; }
  if (me.riding) { send({ type: 'board' }); return; } // desce do barco de carona

  let nearest = null, nd = 40;
  for (const d of drops.values()) {
    const dist = Math.hypot(d.x - me.x, d.y - me.y);
    if (dist < nd) { nd = dist; nearest = d; }
  }
  if (nearest) { send({ type: 'pickup', id: nearest.id }); return; }

  for (const n of NPCS) {
    const np = npcPos(n);
    if (Math.hypot(np.x - me.x, np.y - me.y) < 42) {
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

  // grutas secretas: entrar pela boca da caverna / sair pela porta
  for (const c of WORLD.CAVES) {
    const E = c.entrance, R = c.room;
    const nearMouth = Math.hypot(E.tx * TILE + 8 - me.x, E.ty * TILE + 8 - me.y) < 34;
    const inside = me.x > R.x0 * TILE && me.x < R.x1 * TILE && me.y > R.y0 * TILE && me.y < R.y1 * TILE;
    const nearExit = inside && Math.hypot(R.doorTx * TILE + 8 - me.x, R.doorTy * TILE - me.y) < 34;
    if (nearMouth || nearExit) { send({ type: 'enter_cave' }); return; }
  }

  // pegar carona em barco de outro jogador por perto
  // (se você tem barco próprio e está de frente pra água, o seu tem prioridade)
  {
    let boatNear = false;
    for (const p of others.values()) {
      if (p.boat && Math.hypot(p.x - me.x, p.y - me.y) < 48) { boatNear = true; break; }
    }
    const [fdx, fdy] = DIRV[me.dir];
    const ownFirst = profile.boat && isWaterPx(me.x + fdx * TILE, me.y + fdy * TILE);
    if (boatNear && !me.boat && !ownFirst) { send({ type: 'board' }); return; }
  }

  // dentro de casa: mostruário (parede norte, só o dono) e porta de saída
  if (me.house) {
    const R = WORLD.HOUSE_ROOM;
    if (me.house === me.name && me.y < (R.y0 + 3.2) * TILE) { togglePanel('trophy'); refreshTrophy(); return; }
    if (Math.hypot(R.doorTx * TILE + 8 - me.x, R.doorTy * TILE - me.y) < 40) { send({ type: 'house_door' }); return; }
    return;
  }

  // porta de casa de jogador: dono entra, visita bate e espera a permissão
  {
    const [dx, dy] = DIRV[me.dir];
    const fx = me.x + dx * 14, fy = me.y + dy * 14;
    for (const h of HOUSES) {
      const L = WORLD.houseLot(h.island, h.lot);
      if (Math.hypot(L.door.tx * TILE + 8 - fx, L.door.ty * TILE + 8 - fy) < 20
        || Math.hypot(L.door.tx * TILE + 8 - me.x, L.door.ty * TILE + 8 - me.y) < 26) {
        send({ type: 'house_door' });
        if (h.owner !== me.name) { beep(240, .06, 'square', .1); beep(200, .06, 'square', .1, .12); }
        return;
      }
    }
  }

  // porta de casa (dos moradores)? bate... tá trancada
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
    toast(TR('Encoste numa praia pra desembarcar.'));
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
  toast(TR('🎮 Controle conectado: ') + e.gamepad.id.slice(0, 34), 3000);
});
addEventListener('gamepaddisconnected', () => {
  gpVec.x = gpVec.y = 0; gpSprint = false; gpA = false;
  toast(TR('🎮 Controle desconectado'));
});

function anyModalOpen() {
  return ['inventory', 'shop', 'dex', 'quests', 'settings', 'housing', 'trophy'].some(id => $(id).style.display === 'block')
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

// ---------------------------------------------------------------- login e cadastro

const lgMsg = (t) => { $('login-msg').textContent = t || ''; };
let cadMode = false;
function setCadMode(on, presetNick) {
  cadMode = on;
  $('lg-entrar').style.display = on ? 'none' : 'block';
  $('lg-cad').style.display = on ? 'block' : 'none';
  $('login-switch').textContent = on ? TR('Já tem conta? Entrar') : TR('Não tem conta? Criar uma agora');
  if (presetNick !== undefined) $('cad-name').value = presetNick;
}
$('login-switch').onclick = () => { setCadMode(!cadMode); lgMsg(''); };
$('terms-link').onclick = () => { $('terms').style.display = 'block'; };

// sensor ao vivo: campo repetido confere? ✓ / ✗
function wireMatch(a, b, out, norm) {
  const upd = () => {
    const va = norm($(a).value), vb = norm($(b).value);
    const el = $(out);
    if (!vb) { el.textContent = ''; el.className = 'match'; return; }
    const ok = va === vb && va.length > 0;
    el.textContent = ok ? '✓' : '✗';
    el.className = 'match ' + (ok ? 'ok' : 'bad');
  };
  $(a).addEventListener('input', upd);
  $(b).addEventListener('input', upd);
}
wireMatch('cad-email', 'cad-email2', 'm-email', (v) => v.trim().toLowerCase());
wireMatch('cad-pass', 'cad-pass2', 'm-pass', (v) => v);

let audioStarted = false;
function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  startAmbience();
  startMusic();
}

function doLogin() {
  const name = $('login-name').value.trim();
  if (name.length < 3) { lgMsg(TR('Digite seu nick (3 a 16 caracteres).')); return; }
  localStorage.setItem('lp_name', name);
  startAudio();
  tryJoin({ name, pass: $('login-pass').value });
}

function doRegister() {
  const name = $('cad-name').value.trim();
  const email = $('cad-email').value.trim();
  const email2 = $('cad-email2').value.trim();
  const pass = $('cad-pass').value, pass2 = $('cad-pass2').value;
  if (name.length < 3) { lgMsg(TR('O nick precisa de 3 a 16 caracteres.')); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { lgMsg(TR('Esse email não parece válido.')); return; }
  if (email.toLowerCase() !== email2.trim().toLowerCase()) { lgMsg(TR('Os emails não conferem.')); return; }
  if (pass.length < 6) { lgMsg(TR('A senha precisa de pelo menos 6 caracteres.')); return; }
  if (pass !== pass2) { lgMsg(TR('As senhas não conferem.')); return; }
  if (!$('cad-terms').checked) { lgMsg(TR('Você precisa aceitar os termos e condições.')); return; }
  localStorage.setItem('lp_name', name);
  startAudio();
  tryJoin({ name, register: { email, pass, news: $('cad-news').checked, terms: true } });
}

$('login-name').value = localStorage.getItem('lp_name') || '';
$('login-btn').onclick = doLogin;
$('cad-btn').onclick = doRegister;
$('login-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

// sessão salva? entra direto (o som liga no primeiro toque, exigência dos navegadores)
{
  const tok = localStorage.getItem('lp_token'), nm = localStorage.getItem('lp_name');
  if (tok && nm) {
    tryJoin({ name: nm, token: tok });
    addEventListener('pointerdown', startAudio, { once: true });
    addEventListener('keydown', startAudio, { once: true });
  }
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
  if (me.riding) { // passageiro: gruda no barco do dono, olhando pra frente do barco
    me.moving = false;
    const o = others.get(me.riding);
    if (o) {
      const off = WORLD.SEAT_OFF[me.seat] || [0, 6];
      me.x = o.x + off[0]; me.y = o.y + off[1];
      me.dir = o.dir;
    }
    const z0 = WORLD.zoneAt(Math.floor(me.x / TILE), Math.floor(me.y / TILE));
    if (z0 !== currentZone) { currentZone = z0; $('zonelabel').textContent = '📍 ' + ZONE_NAMES[z0]; onZoneMusic(z0); }
    return;
  }
  if (chatOpen || reel) { me.moving = false; return; }
  let vx = 0, vy = 0;
  if (keys[KB.left] || keys['ArrowLeft']) { vx = -1; me.dir = 'left'; }
  else if (keys[KB.right] || keys['ArrowRight']) { vx = 1; me.dir = 'right'; }
  if (keys[KB.up] || keys['ArrowUp']) { vy = -1; if (!vx) me.dir = 'up'; }
  else if (keys[KB.down] || keys['ArrowDown']) { vy = 1; if (!vx) me.dir = 'down'; }

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
    // andou pra longe do vendedor? loja fecha sozinha (no celular não tem ESC)
    if ($('shop').style.display === 'block') {
      const near = NPCS.some(n => (n.role === 'shop' || n.role === 'boatshop')
        && Math.hypot(n.tx * TILE + 8 - me.x, n.ty * TILE + 8 - me.y) < 6 * TILE);
      if (!near) $('shop').style.display = 'none';
    }
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
    elapsed: 0, tired: 0, t0: performance.now() };
  if (rarity === 'abissal') sfx.fail(); // baque grave: algo enorme fisgou...
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
  const hold = keys[KB.fish] || keys['Space'] || gpA; // Space extra: botão de toque simula ele
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

// ---------------------------------------------------------------- bichinhos
// fauna ambiente por bioma: coelhos/esquilos na vila, lebre no gelo,
// lagarto no deserto, suricato na savana, salamandra no vulcão, caranguejo no farol

const critters = [];
const CRITTER_BY_THEME = {
  grass: ['coelho', 'esquilo'], snow: ['lebre'], desert: ['lagarto'],
  savanna: ['suricato'], volcano: ['salamandra'], rockisle: ['caranguejo'],
};
let critterT = 0;

function updateCritters(dt, camX, camY) {
  critterT -= dt;
  if (critterT <= 0 && critters.length < 4) { // metade da fauna
    critterT = 2.4;
    const x = camX - 60 + Math.random() * (VW + 120);
    const y = camY - 40 + Math.random() * (VH + 80);
    const t = tileAtPx(x, y);
    if (WALK_OK.has(t) && t !== T.PLANK) {
      const near = WORLD.nearestIsland(Math.floor(x / TILE), Math.floor(y / TILE));
      if (near.d < 1) {
        const pool = CRITTER_BY_THEME[near.isl.theme];
        if (pool) critters.push({ type: pool[(Math.random() * pool.length) | 0],
          x, y, tx: x, ty: y, idle: Math.random() * 2, age: 0, flip: false });
      }
    }
  }
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i];
    c.age += dt;
    if (c.age > 45 || Math.abs(c.x - me.x) > VW * 1.4 || Math.abs(c.y - me.y) > VH * 1.6) { critters.splice(i, 1); continue; }
    const pd = Math.hypot(me.x - c.x, me.y - c.y);
    if (pd < 34) { // foge do jogador!
      const ang = Math.atan2(c.y - me.y, c.x - me.x);
      c.tx = c.x + Math.cos(ang) * 60; c.ty = c.y + Math.sin(ang) * 60;
      c.idle = 0;
    }
    const d = Math.hypot(c.tx - c.x, c.ty - c.y);
    if (d > 2) {
      const spd = pd < 40 ? 75 : 34;
      c.flip = c.tx < c.x;
      const nx = c.x + ((c.tx - c.x) / d) * spd * dt;
      const ny = c.y + ((c.ty - c.y) / d) * spd * dt;
      if (WALK_OK.has(tileAtPx(nx, ny))) { c.x = nx; c.y = ny; c.hop = (c.hop || 0) + dt * 9; }
      else { c.tx = c.x; c.ty = c.y; }
    } else {
      c.idle -= dt;
      if (c.idle <= 0) {
        c.idle = 1 + Math.random() * 3;
        c.tx = c.x + (Math.random() * 2 - 1) * 44;
        c.ty = c.y + (Math.random() * 2 - 1) * 44;
      }
    }
  }
}

function drawCritter(c, time) {
  const moving = Math.hypot(c.tx - c.x, c.ty - c.y) > 2;
  const hop = moving ? Math.abs(Math.sin((c.hop || 0))) * 2.5 : 0;
  const x = Math.round(c.x), y = Math.round(c.y);
  ctx.save();
  ctx.translate(x, y);
  if (c.flip) ctx.scale(-1, 1);
  drawShadow(0, 1, 4, 1.5);
  ctx.translate(0, -hop);
  switch (c.type) {
    case 'coelho': case 'lebre': {
      const fur = c.type === 'lebre' ? '#f4f6fa' : '#c9a87c';
      const furD = c.type === 'lebre' ? '#c9d4e4' : '#a4835c';
      ctx.fillStyle = furD; ctx.beginPath(); ctx.ellipse(0.5, -2.5, 4.4, 3.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -3, 4, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = fur; ctx.fillRect(-4.5, -9, 1.6, 5); ctx.fillRect(-2.2, -10, 1.6, 6); // orelhas
      ctx.fillStyle = '#f0b8c8'; ctx.fillRect(-2, -9, 1, 3);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3.4, -2.5, 1.6, 0, 7); ctx.fill(); // rabinho
      ctx.fillStyle = '#241d16'; ctx.fillRect(-3.4, -4, 1, 1);
      break;
    }
    case 'esquilo': {
      ctx.fillStyle = '#a35c2e'; // cauda grande curvada
      ctx.beginPath(); ctx.moveTo(3, -2); ctx.quadraticCurveTo(8, -4, 6.5, -9);
      ctx.quadraticCurveTo(5.5, -11.5, 3.5, -10); ctx.quadraticCurveTo(5.5, -8, 4, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9803e'; ctx.beginPath(); ctx.ellipse(-0.5, -2.5, 3.6, 2.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8a860'; ctx.beginPath(); ctx.ellipse(-1, -2, 2, 1.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9803e'; ctx.fillRect(-4.5, -6, 3, 3); // cabeça
      ctx.fillRect(-4.5, -7.4, 1.2, 1.6); // orelha
      ctx.fillStyle = '#241d16'; ctx.fillRect(-4, -5.4, 1, 1);
      break;
    }
    case 'lagarto': {
      ctx.fillStyle = '#8aa838';
      ctx.beginPath(); ctx.ellipse(0, -1.5, 4.5, 1.8, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(4, -1.5); ctx.quadraticCurveTo(8, -1, 9.5, 1); ctx.lineTo(7.5, 1.5);
      ctx.quadraticCurveTo(6, -0.2, 4, -0.5); ctx.fill(); // cauda
      ctx.fillStyle = '#a8c458'; ctx.fillRect(-5.8, -3, 3, 2.4); // cabeça
      ctx.fillStyle = '#241d16'; ctx.fillRect(-5.2, -2.6, 1, 1);
      ctx.fillStyle = '#6d8a24'; ctx.fillRect(-2, -3.4, 1.2, 1); ctx.fillRect(1, -3.2, 1.2, 1);
      break;
    }
    case 'suricato': {
      ctx.fillStyle = '#d8b880'; ctx.fillRect(-1.5, -9, 3.4, 8); // em pé, vigiando
      ctx.fillStyle = '#f0d8ac'; ctx.fillRect(-1, -7, 1.6, 5);
      ctx.fillStyle = '#d8b880'; ctx.beginPath(); ctx.arc(0.2, -10, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#3f2c16'; ctx.fillRect(-1.2, -10.6, 1.2, 1.2); // máscara do olho
      ctx.fillStyle = '#241d16'; ctx.fillRect(-0.9, -10.3, 0.8, 0.8);
      ctx.fillStyle = '#a4835c'; ctx.fillRect(1.4, -3.5, 1.2, 3.5); // cauda apoiada
      break;
    }
    case 'salamandra': {
      ctx.fillStyle = '#e05828';
      ctx.beginPath(); ctx.ellipse(0, -1.5, 4.2, 1.7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3.5, -1.5); ctx.quadraticCurveTo(7.5, -1, 9, 0.8); ctx.lineTo(7, 1.4);
      ctx.quadraticCurveTo(5.5, -0.2, 3.5, -0.5); ctx.fill();
      ctx.fillStyle = '#f08048'; ctx.fillRect(-5.5, -3, 3, 2.4);
      ctx.fillStyle = '#ffd14a'; ctx.fillRect(-1.5, -2.6, 1, 1); ctx.fillRect(1, -2.2, 1, 1); // pintas de brasa
      ctx.fillStyle = '#241d16'; ctx.fillRect(-5, -2.6, 1, 1);
      break;
    }
    case 'caranguejo': {
      ctx.fillStyle = '#d84838';
      ctx.beginPath(); ctx.ellipse(0, -2, 3.8, 2.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f06850'; ctx.beginPath(); ctx.ellipse(-0.5, -2.5, 2.4, 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#d84838';
      ctx.fillRect(-5.5, -4.5, 2, 2); ctx.fillRect(3.5, -4.5, 2, 2); // garras
      for (const lx of [-3, -1, 1, 3]) ctx.fillRect(lx, 0, 1, 1.6 + Math.sin(time * 10 + lx) * 0.5);
      ctx.fillStyle = '#241d16'; ctx.fillRect(-1.5, -4.2, 1, 1); ctx.fillRect(0.8, -4.2, 1, 1);
      break;
    }
  }
  ctx.restore();
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
    // deque de tábuas UNIFORMES: 3 fileiras iguais, emendas escalonadas por variante
    g.fillStyle = '#bc8f56'; g.fillRect(0, 0, 16, 16);
    [0, 5, 10].forEach((y, row) => {
      g.fillStyle = '#b8894f'; g.fillRect(0, y, 16, row === 2 ? 6 : 5);
      g.fillStyle = '#dcac6c'; g.fillRect(0, y, 16, 1);          // topo iluminado
      g.fillStyle = '#77522a'; g.fillRect(0, y + (row === 2 ? 5 : 4), 16, 1); // fresta
      // veio discreto e reto
      g.fillStyle = 'rgba(122,84,42,.35)'; g.fillRect(2, y + 2, 11, 1);
      // emenda da tábua: padrão fixo escalonado (tijolinho), com pregos
      const jx = ((v * 4 + row * 6) % 15) + 0.5;
      g.fillStyle = '#684622'; g.fillRect(jx, y, 1, row === 2 ? 6 : 5);
      g.fillStyle = '#403016';
      g.fillRect(jx - 2, y + 2, 1, 1); g.fillRect(jx + 2, y + 2, 1, 1);
    });
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

  SPR[T.FAROLBASE] = mk4((g, r) => {
    g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 16, 16); // calçada creme do farol
    g.fillStyle = '#cfc7b0';
    g.fillRect(0, 7, 16, 1); g.fillRect(((r() * 8) | 0) + 3, 0, 1, 7); g.fillRect(((r() * 8) | 0) + 5, 8, 1, 8);
    g.fillStyle = '#f8f4ea'; g.fillRect(1, 1, 6, 1); g.fillRect(9, 9, 5, 1);
    speck(g, r, 2, ['#d8a898', '#c8bfa6'], 2, 1);
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

// construções dos vilarejos das outras ilhas (mesma pegada 5x4 tiles, arquitetura do bioma)
function drawThemedHouse(d) {
  const x = d.x, yb = d.y, cx = x + 40;
  if (d.th === 'snow') { // IGLU
    drawShadow(cx, yb + 2, 42, 5.5);
    ctx.fillStyle = '#8a9ab8';
    ctx.beginPath(); ctx.arc(cx, yb, 38, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8f2fc';
    ctx.beginPath(); ctx.arc(cx, yb, 35, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(140,170,205,.8)'; ctx.lineWidth = 1.2; // blocos de gelo
    ctx.beginPath();
    for (let r = 9; r <= 30; r += 7) { ctx.moveTo(cx + r, yb); ctx.arc(cx, yb, r, 0, Math.PI, true); }
    for (let band = 0; band < 3; band++) {
      const r0 = 9 + band * 7, r1 = r0 + 7;
      for (let a = 0.3 + (band % 2) * 0.22; a < Math.PI - 0.25; a += 0.44) {
        ctx.moveTo(cx - Math.cos(a) * r0, yb - Math.sin(a) * r0);
        ctx.lineTo(cx - Math.cos(a) * r1, yb - Math.sin(a) * r1);
      }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; // brilho do sol
    ctx.beginPath(); ctx.ellipse(cx - 13, yb - 24, 10, 5, -0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a9ab8'; // túnel de entrada
    ctx.beginPath(); ctx.arc(cx, yb, 13, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8d8ea';
    ctx.beginPath(); ctx.arc(cx, yb, 11, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#141e2c';
    ctx.beginPath(); ctx.arc(cx, yb, 7.5, Math.PI, 0); ctx.closePath(); ctx.fill();
  } else if (d.th === 'desert') { // TENDA DE BAZAR
    drawShadow(cx, yb + 2, 40, 5);
    ctx.fillStyle = '#7a3020';
    ctx.beginPath();
    ctx.moveTo(cx, yb - 62);
    ctx.quadraticCurveTo(cx + 34, yb - 44, cx + 38, yb);
    ctx.lineTo(cx - 38, yb);
    ctx.quadraticCurveTo(cx - 34, yb - 44, cx, yb - 62);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eedfb8';
    ctx.beginPath();
    ctx.moveTo(cx, yb - 59.5);
    ctx.quadraticCurveTo(cx + 31.6, yb - 42, cx + 35.6, yb - 1.6);
    ctx.lineTo(cx - 35.6, yb - 1.6);
    ctx.quadraticCurveTo(cx - 31.6, yb - 42, cx, yb - 59.5);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#c8503a'; // listras
    for (let i = -3; i <= 3; i += 2) ctx.fillRect(cx + i * 10 - 4, yb - 60, 8, 60);
    ctx.fillStyle = 'rgba(120,50,30,.25)'; ctx.fillRect(cx + 14, yb - 60, 24, 60); // sombra lateral
    ctx.fillStyle = 'rgba(255,250,230,.3)'; ctx.fillRect(cx - 34, yb - 60, 9, 60); // luz
    ctx.restore();
    ctx.fillStyle = '#3a1c10'; // abertura
    ctx.beginPath(); ctx.moveTo(cx - 9, yb); ctx.lineTo(cx, yb - 26); ctx.lineTo(cx + 9, yb); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eedfb8'; // cortina recolhida
    ctx.beginPath(); ctx.moveTo(cx + 3, yb - 18); ctx.quadraticCurveTo(cx + 12, yb - 10, cx + 9, yb); ctx.lineTo(cx + 16, yb); ctx.quadraticCurveTo(cx + 12, yb - 14, cx + 5, yb - 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(cx - 1, yb - 71, 2, 10); // mastro
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.moveTo(cx + 1, yb - 71); ctx.lineTo(cx + 12, yb - 68); ctx.lineTo(cx + 1, yb - 65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b04030'; ctx.fillRect(cx - 9, yb, 18, 4); // tapete
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(cx - 6, yb + 1.4, 3, 1.2); ctx.fillRect(cx + 3, yb + 1.4, 3, 1.2);
  } else if (d.th === 'savanna') { // PALHOÇA REDONDA
    drawShadow(cx, yb + 2, 38, 5);
    ctx.fillStyle = '#4a2c12'; ctx.fillRect(cx - 28, yb - 27, 56, 27); // contorno da parede
    ctx.fillStyle = '#b87c46'; ctx.fillRect(cx - 26, yb - 25, 52, 25);
    ctx.fillStyle = '#96602f'; ctx.fillRect(cx + 12, yb - 25, 14, 25); // sombra
    ctx.fillStyle = '#cd9258'; ctx.fillRect(cx - 26, yb - 25, 8, 25);  // luz
    ctx.strokeStyle = 'rgba(90,50,20,.4)'; ctx.lineWidth = 1; // emendas do barro
    ctx.beginPath();
    ctx.moveTo(cx - 26, yb - 17); ctx.lineTo(cx + 26, yb - 17);
    ctx.moveTo(cx - 26, yb - 9); ctx.lineTo(cx + 26, yb - 9);
    ctx.stroke();
    ctx.fillStyle = '#4a2c12'; // telhado cônico de palha
    ctx.beginPath(); ctx.moveTo(cx, yb - 74); ctx.lineTo(cx + 42, yb - 21); ctx.lineTo(cx - 42, yb - 21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8b054';
    ctx.beginPath(); ctx.moveTo(cx, yb - 71); ctx.lineTo(cx + 38, yb - 23.5); ctx.lineTo(cx - 38, yb - 23.5); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#eecf7a'; // face iluminada
    ctx.beginPath(); ctx.moveTo(cx, yb - 71); ctx.lineTo(cx - 14, yb - 23); ctx.lineTo(cx - 38, yb - 23); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a87c2e'; ctx.lineWidth = 1.2; // camadas de palha
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) {
      const yy = yb - 71 + i * 12.5, sp = 10 + i * 9;
      ctx.moveTo(cx - sp, yy); ctx.quadraticCurveTo(cx, yy + 3.5, cx + sp, yy);
    }
    for (let i = -3; i <= 3; i++) { ctx.moveTo(cx + i * 5, yb - 30); ctx.lineTo(cx + i * 6.5, yb - 24); }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#6a4a1a'; ctx.fillRect(cx - 2, yb - 79, 4, 7); // topete do pico
    ctx.fillStyle = '#3a2210'; // porta
    ctx.beginPath(); ctx.arc(cx, yb - 12, 8, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 8, yb - 12, 16, 12);
    ctx.fillStyle = '#241608';
    ctx.beginPath(); ctx.arc(cx, yb - 12, 6, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 6, yb - 12, 12, 12);
    ctx.fillStyle = '#8a5a28'; ctx.fillRect(cx - 9, yb - 13, 2, 13); ctx.fillRect(cx + 7, yb - 13, 2, 13); // batentes
  } else { // volcano: CASA DE PEDRA / FORJA
    const W2 = 80;
    drawShadow(cx, yb + 2, 44, 5);
    ctx.fillStyle = '#171019'; ctx.fillRect(x, yb - 32, W2, 32);
    ctx.fillStyle = '#3f3644'; ctx.fillRect(x + 2, yb - 30, W2 - 4, 30);
    ctx.fillStyle = '#4d4454'; ctx.fillRect(x + 2, yb - 30, 9, 30);
    ctx.fillStyle = '#332b38'; ctx.fillRect(x + W2 - 13, yb - 30, 11, 30);
    ctx.strokeStyle = 'rgba(15,10,18,.6)'; ctx.lineWidth = 1; // blocos de basalto
    ctx.beginPath();
    for (let i = 1; i < 4; i++) { ctx.moveTo(x + 2, yb - 30 + i * 7.5); ctx.lineTo(x + W2 - 2, yb - 30 + i * 7.5); }
    for (let i = 0; i < 5; i++) { const ox = x + 10 + i * 15; ctx.moveTo(ox, yb - 30); ctx.lineTo(ox, yb - 22.5); ctx.moveTo(ox + 7, yb - 22.5); ctx.lineTo(ox + 7, yb - 15); ctx.moveTo(ox, yb - 15); ctx.lineTo(ox, yb - 7.5); ctx.moveTo(ox + 7, yb - 7.5); ctx.lineTo(ox + 7, yb); }
    ctx.stroke();
    ctx.fillStyle = '#171019'; // telhado de lajes
    ctx.beginPath(); ctx.moveTo(x - 7, yb - 30); ctx.lineTo(x + 16, yb - 52); ctx.lineTo(x + 64, yb - 52); ctx.lineTo(x + 87, yb - 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#524a56';
    ctx.beginPath(); ctx.moveTo(x - 3, yb - 31.6); ctx.lineTo(x + 17.4, yb - 50); ctx.lineTo(x + 62.6, yb - 50); ctx.lineTo(x + 83, yb - 31.6); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#5f5764'; ctx.fillRect(x - 4, yb - 50, 90, 6); // fileiras de laje
    ctx.fillStyle = '#463e4b'; ctx.fillRect(x - 4, yb - 38, 90, 7);
    ctx.restore();
    ctx.fillStyle = '#171019'; ctx.fillRect(x + 58, yb - 68, 13, 20); // chaminé
    ctx.fillStyle = '#3f3644'; ctx.fillRect(x + 59.5, yb - 66, 10, 18);
    ctx.fillStyle = '#1a1420'; ctx.fillRect(x + 60.5, yb - 66, 8, 3.5);
    ctx.fillStyle = '#ff7030'; ctx.fillRect(x + 62, yb - 65.4, 5, 2); // brasa na boca
    ctx.fillStyle = '#171019'; // porta de metal em arco
    ctx.beginPath(); ctx.arc(cx, yb - 15, 9, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 9, yb - 15, 18, 15);
    ctx.fillStyle = '#241d24';
    ctx.beginPath(); ctx.arc(cx, yb - 15, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - 7, yb - 15, 14, 15);
    ctx.fillStyle = '#6a626e'; // rebites
    for (const [rx, ry] of [[-5, -18], [5, -18], [-5, -6], [5, -6]]) ctx.fillRect(cx + rx - 0.8, yb + ry, 1.6, 1.6);
    // janelas com brasa acesa
    for (const wx of [x + 14, x + W2 - 22]) {
      ctx.fillStyle = '#171019'; ctx.fillRect(wx - 1.5, yb - 24.5, 11, 9);
      ctx.fillStyle = '#2a1414'; ctx.fillRect(wx, yb - 23, 8, 6);
      ctx.fillStyle = '#ff8c3a'; ctx.fillRect(wx + 1, yb - 22, 6, 4);
      ctx.fillStyle = '#ffd08a'; ctx.fillRect(wx + 2, yb - 21.4, 2.4, 1.6);
      ctx.fillStyle = '#171019'; ctx.fillRect(wx + 3.4, yb - 23, 1.2, 6);
    }
  }
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
    case 'cave': {
      // boca de gruta secreta: morro de pedra com entrada escura
      const [outl, base, lit, dk] = d.th === 'volcano'
        ? ['#1a0e08', '#4a3028', '#6a4a38', '#2a1810']
        : d.th === 'desert'
          ? ['#5a4020', '#a8845c', '#c8a878', '#7a5c38']
          : d.th === 'snow'
            ? ['#3a4456', '#8a94a8', '#b4c0d4', '#5a6478']
            : ['#3a3630', '#767268', '#98948a', '#54504a'];
      const cx = d.x, by = d.y;
      drawShadow(cx, by, 20, 3.5);
      ctx.fillStyle = outl; // contorno do morro
      ctx.beginPath(); ctx.moveTo(cx - 23, by + 1); ctx.lineTo(cx - 19, by - 14); ctx.lineTo(cx - 10, by - 24);
      ctx.lineTo(cx + 3, by - 27); ctx.lineTo(cx + 14, by - 20); ctx.lineTo(cx + 21, by - 9); ctx.lineTo(cx + 23, by + 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.moveTo(cx - 21, by); ctx.lineTo(cx - 17, by - 13); ctx.lineTo(cx - 9, by - 22);
      ctx.lineTo(cx + 3, by - 25); ctx.lineTo(cx + 13, by - 18); ctx.lineTo(cx + 19, by - 8); ctx.lineTo(cx + 21, by);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = lit; // luz de cima-esquerda
      ctx.beginPath(); ctx.moveTo(cx - 15, by - 12); ctx.lineTo(cx - 8, by - 20); ctx.lineTo(cx + 2, by - 23);
      ctx.lineTo(cx + 8, by - 19); ctx.lineTo(cx - 2, by - 16); ctx.lineTo(cx - 10, by - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dk; // rachaduras e blocos
      ctx.fillRect(cx - 16, by - 8, 5, 1.5); ctx.fillRect(cx + 10, by - 13, 5, 1.5);
      ctx.fillRect(cx + 14, by - 5, 4, 1.5); ctx.fillRect(cx - 6, by - 21, 4, 1.2);
      // entrada escura em arco
      ctx.fillStyle = outl;
      ctx.beginPath(); ctx.moveTo(cx - 8, by + 1); ctx.lineTo(cx - 8, by - 9); ctx.quadraticCurveTo(cx, by - 17, cx + 8, by - 9);
      ctx.lineTo(cx + 8, by + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#07070c';
      ctx.beginPath(); ctx.moveTo(cx - 6, by + 1); ctx.lineTo(cx - 6, by - 8); ctx.quadraticCurveTo(cx, by - 14, cx + 6, by - 8);
      ctx.lineTo(cx + 6, by + 1); ctx.closePath(); ctx.fill();
      // brilho misterioso lá dentro
      const tw = 0.5 + 0.5 * Math.sin(time * 2.4 + d.v * 9);
      ctx.fillStyle = `rgba(140,220,255,${0.25 + tw * 0.3})`;
      ctx.fillRect(cx - 1, by - 6 + tw * 2, 2, 2);
      if (Math.hypot(d.x - me.x, d.y - me.y) < 48) drawLabel(cx, by - 32, TR('[E] entrar'), '#7affc8');
      break;
    }
    case 'house': {
      if (d.th && d.th !== 'grass') { drawThemedHouse(d); break; }
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
      // base de alvenaria clara com faixa vermelha (destoa das rochas da ilha)
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(bx - 14, by - 12, 28, 15);
      ctx.fillStyle = '#f0ead8'; ctx.fillRect(bx - 13, by - 11, 26, 13);
      ctx.fillStyle = '#d8d0ba'; // juntas das pedras
      ctx.fillRect(bx - 13, by - 5, 26, 1.2); ctx.fillRect(bx - 7, by - 11, 1, 6); ctx.fillRect(bx + 6, by - 5, 1, 7);
      ctx.fillStyle = '#e84040'; ctx.fillRect(bx - 13, by - 11, 26, 2.6);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(bx + 8, by - 11, 5, 13);
      // porta de madeira em arco + lampião aceso
      ctx.fillStyle = '#2a1608';
      ctx.beginPath(); ctx.moveTo(bx - 5, by + 2); ctx.lineTo(bx - 5, by - 7);
      ctx.quadraticCurveTo(bx, by - 12, bx + 5, by - 7); ctx.lineTo(bx + 5, by + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a5a28';
      ctx.beginPath(); ctx.moveTo(bx - 3.6, by + 2); ctx.lineTo(bx - 3.6, by - 6.4);
      ctx.quadraticCurveTo(bx, by - 10, bx + 3.6, by - 6.4); ctx.lineTo(bx + 3.6, by + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a4420'; ctx.fillRect(bx - 0.6, by - 9, 1.2, 11);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx + 1.6, by - 3.5, 1.6, 1.6);
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(bx - 2, by - 15, 4, 2.6);
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(bx - 1.2, by - 14.4, 2.4, 1.6);
      if (Math.hypot(bx - me.x, by - me.y) < 52) drawLabel(bx, by - 20, TR('[E] entrar'), '#7affc8');
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

function charColors(name, hue) {
  let hsum = 0;
  for (const c of name) hsum = (hsum * 31 + c.charCodeAt(0)) >>> 0;
  const h = (hue === null || hue === undefined) ? hsum % 360 : hue; // cor escolhida no menu
  return {
    shirt: `hsl(${h}, 55%, 52%)`,
    shirtD: `hsl(${h}, 55%, 38%)`,
    hat: `hsl(${(h + 40) % 360}, 42%, 44%)`,
    skin: SKINS[hsum % SKINS.length],
    hair: HAIRS[(hsum >> 3) % HAIRS.length],
    pants: '#3a4460',
  };
}

// sprite 24x30 estilo Alundra: cabeça grande, 3 tons de sombra, contorno forte — pés em (12, 29)
// frente/costas têm um desenho; esquerda/direita têm PERFIL de verdade (corpo virado)

function drawCharFrontal(g, c, dir, frame, fishing) {
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
  // túnica com cinto
  g.fillStyle = c.shirt; g.fillRect(6, 13, 12, 10);
  g.fillStyle = c.shirtD; g.fillRect(15, 13, 3, 10);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(6, 13, 2, 9);
  g.fillStyle = '#4a3418'; g.fillRect(6, 20, 12, 2);
  if (dir !== 'up') { g.fillStyle = '#ffd24a'; g.fillRect(11, 20, 2, 2); } // fivela só na frente
  g.fillStyle = c.shirtD; g.fillRect(6, 22, 12, 1);
  // braços (os dois visíveis)
  g.fillStyle = c.skin;
  if (fishing) { g.fillRect(3, 14, 3, 5); g.fillRect(18, 14, 3, 5); }
  else {
    const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    g.fillRect(4, 14 + sw, 3, 7); g.fillStyle = c.shirt; g.fillRect(4, 14 + sw, 3, 3);
    g.fillStyle = c.skin;
    g.fillRect(17, 14 - sw, 3, 7); g.fillStyle = c.shirtD; g.fillRect(17, 14 - sw, 3, 3);
    g.fillStyle = c.skin;
  }
  // cabeça
  g.fillStyle = c.skin; g.fillRect(6, 4, 12, 10);
  g.fillStyle = skinD; g.fillRect(16, 5, 2, 8);
  g.fillStyle = c.hair;
  if (dir === 'up') g.fillRect(6, 4, 12, 7);
  else {
    g.fillRect(6, 4, 12, 2.5);
    g.fillRect(6, 4, 2.5, 6); g.fillRect(15.5, 4, 2.5, 6);
    g.fillRect(9, 6, 2, 1.5); g.fillRect(13, 6, 1.5, 1);
  }
  // chapéu
  g.fillStyle = c.hat;
  g.fillRect(5, 1, 14, 4); g.fillRect(3.5, 4, 17, 2);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(5, 3.6, 14, 1.4);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(5, 1, 14, 1);
  // rosto
  if (dir === 'down') {
    g.fillStyle = '#241d16'; g.fillRect(8, 8.5, 2, 2.5); g.fillRect(14, 8.5, 2, 2.5);
    g.fillStyle = '#fff'; g.fillRect(8, 8.5, 1, 1); g.fillRect(14, 8.5, 1, 1);
    g.fillStyle = skinD; g.fillRect(11, 10.5, 2, 1.5); g.fillRect(10, 12.5, 4, 1);
  }
}

// perfil virado pra DIREITA (a esquerda é o espelho)
function drawCharProfile(g, c, frame, fishing) {
  const skinD = 'rgba(120,60,30,.35)';
  const st = frame === 1 ? 2 : frame === 2 ? -2 : 0; // passada
  // perna de trás (mais escura) e da frente
  g.fillStyle = c.pants; g.fillRect(9 - st, 22, 4, 6);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(9 - st, 22, 4, 6);
  g.fillStyle = c.pants; g.fillRect(12 + st, 22, 4, 6);
  g.fillStyle = '#3f2c16'; g.fillRect(8.5 - st, 27, 5, 2.5); g.fillRect(11.5 + st, 27, 5.5, 2.5);
  g.fillStyle = '#6b4c28'; g.fillRect(8.5 - st, 27, 5, 1); g.fillRect(11.5 + st, 27, 5.5, 1);
  // corpo de perfil (mais estreito)
  g.fillStyle = c.shirt; g.fillRect(8, 13, 9, 10);
  g.fillStyle = c.shirtD; g.fillRect(8, 13, 3, 10);              // costas sombreadas
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(14.5, 13, 2, 9); // peito iluminado
  g.fillStyle = '#4a3418'; g.fillRect(8, 20, 9, 2);              // cinto
  g.fillStyle = '#ffd24a'; g.fillRect(14, 20, 2, 2);
  g.fillStyle = c.shirtD; g.fillRect(8, 22, 9, 1);
  // braço único visível (o outro fica atrás do corpo)
  if (fishing) { // estendido segurando a vara
    g.fillStyle = c.shirt; g.fillRect(13, 14, 4, 4);
    g.fillStyle = c.skin; g.fillRect(16.5, 14.5, 5, 3.5);
    g.fillStyle = skinD; g.fillRect(16.5, 16.5, 5, 1);
  } else {
    const sw = frame === 1 ? 1.6 : frame === 2 ? -1.6 : 0;
    g.fillStyle = c.shirt; g.fillRect(11 + sw * 0.4, 14, 3.6, 4);
    g.fillStyle = c.skin; g.fillRect(11 + sw, 17.5, 3.4, 4.5);
  }
  // cabeça de perfil
  g.fillStyle = c.skin; g.fillRect(6.5, 4, 12, 10);
  g.fillStyle = c.skin; g.fillRect(18.5, 8.5, 1.5, 2.5); // nariz
  g.fillStyle = skinD; g.fillRect(18.5, 10, 1.5, 1);
  // cabelo cobrindo a nuca
  g.fillStyle = c.hair;
  g.fillRect(6.5, 4, 12, 2.5);
  g.fillRect(6.5, 4, 5, 9);          // nuca
  g.fillRect(11.5, 6, 2, 1.5);       // franja
  // chapéu
  g.fillStyle = c.hat;
  g.fillRect(5.5, 1, 14, 4); g.fillRect(4, 4, 17.5, 2);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(5.5, 3.6, 14, 1.4);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(5.5, 1, 14, 1);
  // olho e boca (na frente)
  g.fillStyle = '#241d16'; g.fillRect(15.5, 8.5, 2, 2.5);
  g.fillStyle = '#fff'; g.fillRect(15.5, 8.5, 1, 1);
  g.fillStyle = skinD; g.fillRect(16.5, 12, 2, 1);
}

function buildCharSprite(c, dir, frame, fishing) {
  const tmp = mkCanvas(24, 30);
  const g = tmp.getContext('2d');
  if (dir === 'left' || dir === 'right') drawCharProfile(g, c, frame, fishing);
  else drawCharFrontal(g, c, dir, frame, fishing);
  // espelha pro lado esquerdo
  let base = tmp;
  if (dir === 'left') {
    base = mkCanvas(24, 30);
    const fg = base.getContext('2d');
    fg.translate(24, 0); fg.scale(-1, 1);
    fg.drawImage(tmp, 0, 0);
  }
  // contorno forte estilo PS1
  const out = mkCanvas(24, 30);
  const og = out.getContext('2d');
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]]) og.drawImage(base, ox, oy);
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = '#241d16'; og.fillRect(0, 0, 24, 30);
  og.globalCompositeOperation = 'source-over';
  og.drawImage(base, 0, 0);
  return out;
}

function charSprite(name, dir, frame, fishing, npcColor, hue) {
  const key = `${name}|${hue ?? 'n'}|${dir}|${frame}|${fishing ? 1 : 0}`;
  let s = charCache.get(key);
  if (!s) {
    const c = charColors(name, hue);
    if (npcColor) { c.shirt = npcColor; c.shirtD = 'rgba(0,0,0,.25)'; }
    s = buildCharSprite(c, dir, frame, fishing);
    charCache.set(key, s);
  }
  return s;
}

// barcos direcionais: perfil (direita/esquerda espelhada), popa (subindo) e proa (descendo)
const mkBoat = (w, h, fn) => { const c = mkCanvas(w, h); fn(c.getContext('2d')); return c; };
const flipX = (s) => {
  const c = mkCanvas(s.width, s.height);
  const g = c.getContext('2d');
  g.translate(s.width, 0); g.scale(-1, 1); g.drawImage(s, 0, 0);
  return c;
};

const BOAT_SPRITES = (() => {
  // ---------- BOTE A REMO ----------
  const remoSide = mkBoat(52, 26, (g) => {
    g.fillStyle = '#3a1e0c'; // contorno do casco
    g.beginPath();
    g.moveTo(3, 8); g.lineTo(40, 8); g.quadraticCurveTo(50, 9, 51, 14);
    g.quadraticCurveTo(49, 20, 40, 23); g.lineTo(13, 23);
    g.quadraticCurveTo(4, 20, 3, 13); g.closePath(); g.fill();
    g.fillStyle = '#6a4a22';
    g.beginPath();
    g.moveTo(5, 9.5); g.lineTo(40, 9.5); g.quadraticCurveTo(48.5, 10.5, 49.5, 14);
    g.quadraticCurveTo(47.5, 19, 39, 21.5); g.lineTo(14, 21.5);
    g.quadraticCurveTo(6, 19, 5, 13.5); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = '#8a6434'; g.fillRect(3, 13, 48, 2); g.fillRect(3, 17, 48, 2); // tábuas
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(3, 19.5, 48, 3); // sombra da quilha
    g.restore();
    g.fillStyle = '#42210f'; g.fillRect(7, 9.5, 32, 2.6); // interior escuro
    g.fillStyle = '#b08a50'; g.fillRect(8, 10, 30, 1);
    g.fillStyle = '#dcac6c'; g.fillRect(4, 7.4, 37, 1.8); // borda iluminada
    g.fillStyle = '#c89858'; g.fillRect(23, 9, 3, 3.4); // banco
    g.fillStyle = '#3a1e0c'; g.fillRect(19, 8.4, 2, 2.4); // forqueta
    g.strokeStyle = '#5a4224'; g.lineWidth = 2; // remo na água
    g.beginPath(); g.moveTo(20, 10); g.lineTo(11, 24); g.stroke();
    g.fillStyle = '#8a6434';
    g.beginPath(); g.ellipse(10.5, 24, 3, 1.6, -0.7, 0, 7); g.fill();
  });
  const remoUp = mkBoat(32, 46, (g) => {
    g.fillStyle = '#3a1e0c'; // proa apontando pra cima
    g.beginPath();
    g.moveTo(16, 1.5); g.quadraticCurveTo(27, 9, 28, 20); g.lineTo(28, 36);
    g.quadraticCurveTo(27, 44, 16, 44.5); g.quadraticCurveTo(5, 44, 4, 36);
    g.lineTo(4, 20); g.quadraticCurveTo(5, 9, 16, 1.5); g.closePath(); g.fill();
    g.fillStyle = '#6a4a22';
    g.beginPath();
    g.moveTo(16, 3.5); g.quadraticCurveTo(25.5, 10, 26.3, 20); g.lineTo(26.3, 36);
    g.quadraticCurveTo(25.5, 42.4, 16, 42.8); g.quadraticCurveTo(6.5, 42.4, 5.7, 36);
    g.lineTo(5.7, 20); g.quadraticCurveTo(6.5, 10, 16, 3.5); g.closePath(); g.fill();
    g.fillStyle = '#b08a50'; // piso interno
    g.beginPath();
    g.moveTo(16, 8); g.quadraticCurveTo(22.5, 12, 23, 20); g.lineTo(23, 35);
    g.quadraticCurveTo(22.5, 39.6, 16, 40); g.quadraticCurveTo(9.5, 39.6, 9, 35);
    g.lineTo(9, 20); g.quadraticCurveTo(9.5, 12, 16, 8); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = '#8a6a3c';
    for (let y = 12; y < 40; y += 4) g.fillRect(7, y, 18, 1.2);
    g.restore();
    g.fillStyle = '#8a6434'; // convés da proa
    g.beginPath(); g.moveTo(16, 3.5); g.quadraticCurveTo(24, 9, 25, 15);
    g.lineTo(7, 15); g.quadraticCurveTo(8, 9, 16, 3.5); g.closePath(); g.fill();
    g.fillStyle = '#dcac6c'; g.fillRect(8, 14.2, 16, 1.4);
    g.fillStyle = '#c89858'; g.fillRect(8.5, 25, 15, 4); // banco
    g.fillStyle = '#a87840'; g.fillRect(8.5, 28, 15, 1);
    g.fillStyle = '#5a4224'; // remos pros dois lados
    g.fillRect(0, 25.5, 5.7, 2.2); g.fillRect(26.3, 25.5, 5.7, 2.2);
    g.fillStyle = '#8a6434'; g.fillRect(0, 24.8, 2.6, 3.6); g.fillRect(29.4, 24.8, 2.6, 3.6);
  });
  const remoDown = mkBoat(32, 46, (g) => {
    g.fillStyle = '#3a1e0c'; // proa apontando pra baixo
    g.beginPath();
    g.moveTo(16, 44.5); g.quadraticCurveTo(27, 37, 28, 26); g.lineTo(28, 10);
    g.quadraticCurveTo(27, 2, 16, 1.5); g.quadraticCurveTo(5, 2, 4, 10);
    g.lineTo(4, 26); g.quadraticCurveTo(5, 37, 16, 44.5); g.closePath(); g.fill();
    g.fillStyle = '#6a4a22';
    g.beginPath();
    g.moveTo(16, 42.5); g.quadraticCurveTo(25.5, 36, 26.3, 26); g.lineTo(26.3, 10);
    g.quadraticCurveTo(25.5, 3.6, 16, 3.2); g.quadraticCurveTo(6.5, 3.6, 5.7, 10);
    g.lineTo(5.7, 26); g.quadraticCurveTo(6.5, 36, 16, 42.5); g.closePath(); g.fill();
    g.fillStyle = '#b08a50'; // piso interno
    g.beginPath();
    g.moveTo(16, 38); g.quadraticCurveTo(22.5, 34, 23, 26); g.lineTo(23, 11);
    g.quadraticCurveTo(22.5, 6.4, 16, 6); g.quadraticCurveTo(9.5, 6.4, 9, 11);
    g.lineTo(9, 26); g.quadraticCurveTo(9.5, 34, 16, 38); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = '#8a6a3c';
    for (let y = 8; y < 36; y += 4) g.fillRect(7, y, 18, 1.2);
    g.restore();
    g.fillStyle = '#8a6434'; // convés da proa (embaixo, perto de nós)
    g.beginPath(); g.moveTo(16, 42.5); g.quadraticCurveTo(24, 37, 25, 31);
    g.lineTo(7, 31); g.quadraticCurveTo(8, 37, 16, 42.5); g.closePath(); g.fill();
    g.fillStyle = '#dcac6c'; g.fillRect(8, 30.4, 16, 1.4);
    g.fillStyle = '#c89858'; g.fillRect(8.5, 17, 15, 4); // banco
    g.fillStyle = '#a87840'; g.fillRect(8.5, 20, 15, 1);
    g.fillStyle = '#5a4224';
    g.fillRect(0, 18.5, 5.7, 2.2); g.fillRect(26.3, 18.5, 5.7, 2.2);
    g.fillStyle = '#8a6434'; g.fillRect(0, 17.8, 2.6, 3.6); g.fillRect(29.4, 17.8, 2.6, 3.6);
  });

  // ---------- LANCHA ----------
  const lanchaSide = mkBoat(60, 26, (g) => {
    g.fillStyle = '#2d3640'; // contorno
    g.beginPath();
    g.moveTo(6, 8); g.lineTo(42, 7); g.quadraticCurveTo(55, 7.5, 58, 13);
    g.quadraticCurveTo(55, 19, 46, 21); g.lineTo(14, 21);
    g.quadraticCurveTo(6, 18, 6, 8); g.closePath(); g.fill();
    g.fillStyle = '#e8ecf2';
    g.beginPath();
    g.moveTo(7.6, 9.4); g.lineTo(42, 8.5); g.quadraticCurveTo(53.6, 9, 56.2, 13);
    g.quadraticCurveTo(53.6, 17.8, 45.4, 19.5); g.lineTo(14.8, 19.5);
    g.quadraticCurveTo(7.6, 16.8, 7.6, 9.4); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = '#ffffff'; g.fillRect(4, 8.5, 54, 1.8); // brilho do costado
    g.fillStyle = '#e84040'; g.fillRect(4, 13.2, 54, 3); // faixa esportiva
    g.fillStyle = '#20486e'; g.fillRect(4, 17.4, 54, 3); // linha d'água
    g.restore();
    g.fillStyle = '#1c2836'; g.fillRect(22, 8, 15, 2.8); // cockpit
    g.fillStyle = '#e84040'; g.fillRect(24, 8.6, 4, 1.6); // banco
    g.fillStyle = '#9adcf0'; // para-brisa inclinado
    g.beginPath(); g.moveTo(37, 8.5); g.lineTo(42, 3.2); g.lineTo(46.5, 3.2); g.lineTo(43.5, 8.5); g.closePath(); g.fill();
    g.strokeStyle = '#5a636e'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#2d3640'; g.fillRect(1, 8, 6, 10); // motor de popa
    g.fillStyle = '#4a5560'; g.fillRect(1, 8, 6, 3);
    g.fillStyle = '#8a97a4'; g.fillRect(2.4, 12, 3.2, 1.2);
  });
  const lanchaUp = mkBoat(34, 52, (g) => {
    g.fillStyle = '#2d3640'; // proa em bico pra cima
    g.beginPath();
    g.moveTo(17, 1); g.quadraticCurveTo(29, 12, 30, 24); g.lineTo(30, 42);
    g.quadraticCurveTo(30, 47.5, 24, 48); g.lineTo(10, 48);
    g.quadraticCurveTo(4, 47.5, 4, 42); g.lineTo(4, 24);
    g.quadraticCurveTo(5, 12, 17, 1); g.closePath(); g.fill();
    g.fillStyle = '#e8ecf2';
    g.beginPath();
    g.moveTo(17, 3.4); g.quadraticCurveTo(27.6, 13, 28.4, 24); g.lineTo(28.4, 42);
    g.quadraticCurveTo(28.3, 46.2, 23.6, 46.4); g.lineTo(10.4, 46.4);
    g.quadraticCurveTo(5.7, 46.2, 5.6, 42); g.lineTo(5.6, 24);
    g.quadraticCurveTo(6.4, 13, 17, 3.4); g.closePath(); g.fill();
    g.fillStyle = '#e84040'; g.fillRect(5.6, 24, 2.4, 20); g.fillRect(26, 24, 2.4, 20); // faixas laterais
    g.fillStyle = '#c9d2dc'; // convés da proa
    g.beginPath(); g.moveTo(17, 3.4); g.quadraticCurveTo(26, 12, 27.5, 20);
    g.lineTo(6.5, 20); g.quadraticCurveTo(8, 12, 17, 3.4); g.closePath(); g.fill();
    g.fillStyle = '#f6f8fb'; g.fillRect(15.4, 5, 3.2, 15); // friso central
    g.fillStyle = '#9adcf0'; // para-brisa envolvente
    g.beginPath(); g.moveTo(6.5, 20); g.lineTo(27.5, 20); g.lineTo(25.6, 24.5); g.lineTo(8.4, 24.5); g.closePath(); g.fill();
    g.strokeStyle = '#5a636e'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#1c2836'; g.fillRect(8.4, 25.5, 17.2, 15); // cockpit
    g.fillStyle = '#e84040'; g.fillRect(10.6, 28, 5.4, 4.4); g.fillRect(18, 28, 5.4, 4.4); // bancos
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(10.6, 28, 5.4, 1.2); g.fillRect(18, 28, 5.4, 1.2);
    g.fillStyle = '#c9d2dc'; g.fillRect(8.4, 40.5, 17.2, 5); // popa
    g.fillStyle = '#2d3640'; g.fillRect(13, 45.5, 8, 6.5); // motor
    g.fillStyle = '#4a5560'; g.fillRect(13, 45.5, 8, 2.2);
  });
  const lanchaDown = mkBoat(34, 52, (g) => {
    g.fillStyle = '#2d3640'; // proa em bico pra baixo, motor em cima
    g.beginPath();
    g.moveTo(17, 51); g.quadraticCurveTo(29, 40, 30, 28); g.lineTo(30, 10);
    g.quadraticCurveTo(30, 4.5, 24, 4); g.lineTo(10, 4);
    g.quadraticCurveTo(4, 4.5, 4, 10); g.lineTo(4, 28);
    g.quadraticCurveTo(5, 40, 17, 51); g.closePath(); g.fill();
    g.fillStyle = '#e8ecf2';
    g.beginPath();
    g.moveTo(17, 48.6); g.quadraticCurveTo(27.6, 39, 28.4, 28); g.lineTo(28.4, 10);
    g.quadraticCurveTo(28.3, 5.8, 23.6, 5.6); g.lineTo(10.4, 5.6);
    g.quadraticCurveTo(5.7, 5.8, 5.6, 10); g.lineTo(5.6, 28);
    g.quadraticCurveTo(6.4, 39, 17, 48.6); g.closePath(); g.fill();
    g.fillStyle = '#e84040'; g.fillRect(5.6, 8, 2.4, 20); g.fillRect(26, 8, 2.4, 20);
    g.fillStyle = '#c9d2dc'; // convés da proa (embaixo)
    g.beginPath(); g.moveTo(17, 48.6); g.quadraticCurveTo(26, 40, 27.5, 32);
    g.lineTo(6.5, 32); g.quadraticCurveTo(8, 40, 17, 48.6); g.closePath(); g.fill();
    g.fillStyle = '#f6f8fb'; g.fillRect(15.4, 32, 3.2, 15);
    g.fillStyle = '#9adcf0'; // para-brisa (na frente do cockpit = mais perto da proa)
    g.beginPath(); g.moveTo(6.5, 32); g.lineTo(27.5, 32); g.lineTo(25.6, 27.5); g.lineTo(8.4, 27.5); g.closePath(); g.fill();
    g.strokeStyle = '#5a636e'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#1c2836'; g.fillRect(8.4, 11.5, 17.2, 15); // cockpit
    g.fillStyle = '#e84040'; g.fillRect(10.6, 19.6, 5.4, 4.4); g.fillRect(18, 19.6, 5.4, 4.4);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(10.6, 19.6, 5.4, 1.2); g.fillRect(18, 19.6, 5.4, 1.2);
    g.fillStyle = '#c9d2dc'; g.fillRect(8.4, 6.5, 17.2, 5); // popa (em cima)
    g.fillStyle = '#2d3640'; g.fillRect(13, 0, 8, 6.5); // motor
    g.fillStyle = '#4a5560'; g.fillRect(13, 0, 8, 2.2);
  });

  // ---------- CARAVELA ----------
  const caravelaSide = mkBoat(84, 68, (g) => {
    // mastros e vergas (atrás das velas)
    g.fillStyle = '#2a1608'; g.fillRect(39, 4, 3, 44); // mastro principal
    g.fillStyle = '#5a4224'; g.fillRect(39, 4, 1.2, 44);
    g.fillStyle = '#2a1608'; g.fillRect(60, 14, 2.6, 32); // mastro de proa
    g.fillStyle = '#5a4224'; g.fillRect(60, 14, 1, 32);
    g.fillStyle = '#2a1608'; g.fillRect(26, 8, 30, 2.2); g.fillRect(50, 17, 22, 2); // vergas
    // vela principal bojuda (vento a favor)
    g.fillStyle = '#f2ead2';
    g.beginPath(); g.moveTo(27, 11); g.lineTo(55, 11);
    g.quadraticCurveTo(62, 22, 55, 34); g.lineTo(27, 34);
    g.quadraticCurveTo(34, 22, 27, 11); g.closePath(); g.fill();
    g.fillStyle = '#ddd2b2';
    g.beginPath(); g.moveTo(27, 11); g.quadraticCurveTo(34, 22, 27, 34);
    g.lineTo(33, 34); g.quadraticCurveTo(40, 22, 33, 11); g.closePath(); g.fill();
    g.strokeStyle = '#c9bc96'; g.lineWidth = 1; // costuras
    g.beginPath(); g.moveTo(29, 19); g.quadraticCurveTo(45, 21, 57, 19);
    g.moveTo(29, 27); g.quadraticCurveTo(45, 29, 57, 27); g.stroke();
    g.fillStyle = '#3a78c9'; // emblema do peixe
    g.beginPath(); g.ellipse(45, 22.5, 5.6, 3.4, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(50, 22.5); g.lineTo(54, 19.8); g.lineTo(54, 25.2); g.closePath(); g.fill();
    // vela de proa
    g.fillStyle = '#f2ead2';
    g.beginPath(); g.moveTo(51, 20); g.lineTo(71, 20);
    g.quadraticCurveTo(76, 28, 71, 36); g.lineTo(51, 36);
    g.quadraticCurveTo(56, 28, 51, 20); g.closePath(); g.fill();
    g.fillStyle = '#ddd2b2';
    g.beginPath(); g.moveTo(51, 20); g.quadraticCurveTo(56, 28, 51, 36);
    g.lineTo(55, 36); g.quadraticCurveTo(60, 28, 55, 20); g.closePath(); g.fill();
    // bujarrona triangular
    g.fillStyle = '#e9e0c4';
    g.beginPath(); g.moveTo(64, 23); g.lineTo(79, 40); g.lineTo(64, 40); g.closePath(); g.fill();
    // casco (na frente das velas)
    g.fillStyle = '#2a1608';
    g.beginPath();
    g.moveTo(5, 37); g.lineTo(24, 37); g.lineTo(25, 44);
    g.lineTo(66, 44); g.quadraticCurveTo(74, 42, 77, 46);
    g.quadraticCurveTo(74, 56, 62, 62); g.lineTo(26, 63);
    g.quadraticCurveTo(10, 58, 6, 48); g.closePath(); g.fill();
    g.fillStyle = '#6a4a22';
    g.beginPath();
    g.moveTo(7, 38.6); g.lineTo(22.6, 38.6); g.lineTo(23.6, 45.6);
    g.lineTo(65.4, 45.6); g.quadraticCurveTo(72.6, 43.8, 75.2, 47);
    g.quadraticCurveTo(72.4, 55.2, 61, 60.4); g.lineTo(27, 61.4);
    g.quadraticCurveTo(11.6, 56.6, 7.6, 47.6); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = '#8a6434'; g.fillRect(4, 47, 78, 3); g.fillRect(4, 52.6, 78, 2.4); // tábuas
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(4, 57, 78, 7); // sombra da quilha
    g.fillStyle = '#dcac6c'; g.fillRect(4, 44.4, 74, 1.6); // borda do convés
    g.restore();
    // castelo de popa
    g.fillStyle = '#8a6434'; g.fillRect(7, 38.6, 15.5, 6.5);
    g.fillStyle = '#5a3a1a'; g.fillRect(7, 43.2, 15.5, 1.9);
    g.fillStyle = '#ffd24a'; g.fillRect(9, 40, 2.2, 2.2); g.fillRect(13.8, 40, 2.2, 2.2); g.fillRect(18.6, 40, 2.2, 2.2);
    // gurupés
    g.fillStyle = '#2a1608';
    g.beginPath(); g.moveTo(70, 46); g.lineTo(83, 39.4); g.lineTo(84, 41.4); g.lineTo(71.2, 48); g.closePath(); g.fill();
    // cordame
    g.strokeStyle = 'rgba(50,32,16,.6)'; g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(40.5, 5); g.lineTo(10, 38); g.moveTo(40.5, 5); g.lineTo(66, 44);
    g.moveTo(61, 15); g.lineTo(82, 40);
    g.stroke();
    // cesto da gávea + bandeira
    g.fillStyle = '#5a3a1a'; g.fillRect(36.6, 6.5, 8, 3.6);
    g.fillStyle = '#8a6434'; g.fillRect(37.2, 7, 6.8, 2.6);
    g.fillStyle = '#e84040';
    g.beginPath(); g.moveTo(40.5, 4.5); g.lineTo(40.5, 0.5); g.lineTo(50, 2.4); g.closePath(); g.fill();
  });
  const caravelaUp = mkBoat(60, 72, (g) => {
    // vela do mastro de proa (mais longe, no topo)
    g.fillStyle = '#2a1608'; g.fillRect(29.2, 0.5, 1.8, 8);
    g.fillRect(19, 2, 22, 1.8);
    g.fillStyle = '#e6dbbc';
    g.beginPath(); g.moveTo(20, 4.4); g.quadraticCurveTo(30, 8, 40, 4.4);
    g.lineTo(40, 10); g.quadraticCurveTo(30, 13.6, 20, 10); g.closePath(); g.fill();
    // mastro principal + verga
    g.fillStyle = '#2a1608'; g.fillRect(28.4, 4, 3.2, 44);
    g.fillStyle = '#5a4224'; g.fillRect(28.4, 4, 1.2, 44);
    g.fillStyle = '#2a1608'; g.fillRect(9, 8.6, 42, 2.4);
    // vela principal vista de trás (tom mais apagado)
    g.fillStyle = '#e6dbbc';
    g.beginPath(); g.moveTo(11, 12); g.quadraticCurveTo(30, 18, 49, 12);
    g.lineTo(49, 34); g.quadraticCurveTo(30, 41, 11, 34); g.closePath(); g.fill();
    g.fillStyle = '#d3c6a2';
    g.beginPath(); g.moveTo(11, 12); g.quadraticCurveTo(30, 18, 49, 12);
    g.lineTo(49, 17); g.quadraticCurveTo(30, 23, 11, 17); g.closePath(); g.fill();
    g.strokeStyle = '#c0b28e'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(11, 24); g.quadraticCurveTo(30, 30, 49, 24); g.stroke();
    // casco com popa virada pra gente
    g.fillStyle = '#2a1608';
    g.beginPath(); g.moveTo(5, 50); g.quadraticCurveTo(7, 66, 30, 67.5);
    g.quadraticCurveTo(53, 66, 55, 50); g.lineTo(51, 46); g.lineTo(9, 46); g.closePath(); g.fill();
    g.fillStyle = '#6a4a22';
    g.beginPath(); g.moveTo(7, 50); g.quadraticCurveTo(9, 63.6, 30, 65.4);
    g.quadraticCurveTo(51, 63.6, 53, 50); g.lineTo(49.4, 47.4); g.lineTo(10.6, 47.4); g.closePath(); g.fill();
    g.fillStyle = '#8a6434'; g.fillRect(9, 48.6, 42, 5.4);
    g.fillStyle = '#77522a'; g.fillRect(8, 54.6, 44, 1.8); g.fillRect(10, 59, 40, 1.6);
    g.fillStyle = '#dcac6c'; g.fillRect(9, 47.6, 42, 1.6);
    // espelho de popa com janelas da cabine e leme
    g.fillStyle = '#5a3a1a'; g.fillRect(17, 50.5, 26, 10);
    g.fillStyle = '#8a6434'; g.fillRect(18.2, 51.6, 23.6, 7.8);
    g.fillStyle = '#ffd24a'; g.fillRect(21, 54, 2.4, 2.6); g.fillRect(28.8, 54, 2.4, 2.6); g.fillRect(36.6, 54, 2.4, 2.6);
    g.fillStyle = '#3a2410'; g.fillRect(28.6, 60.5, 2.8, 5.5);
    // bandeira
    g.fillStyle = '#e84040';
    g.beginPath(); g.moveTo(31, 4.6); g.lineTo(31, 1); g.lineTo(40, 2.8); g.closePath(); g.fill();
    // cordame
    g.strokeStyle = 'rgba(50,32,16,.55)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(30, 6); g.lineTo(8, 48); g.moveTo(30, 6); g.lineTo(52, 48); g.stroke();
  });
  const caravelaDown = mkBoat(60, 72, (g) => {
    // mastro principal + verga (mais longe, em cima)
    g.fillStyle = '#2a1608'; g.fillRect(28.4, 2, 3.2, 40);
    g.fillRect(6, 5, 48, 2.6);
    // vela principal de frente, bem bojuda
    g.fillStyle = '#f6efd8';
    g.beginPath(); g.moveTo(8, 8.6); g.lineTo(52, 8.6);
    g.quadraticCurveTo(56, 22, 52, 35); g.quadraticCurveTo(30, 42, 8, 35);
    g.quadraticCurveTo(4, 22, 8, 8.6); g.closePath(); g.fill();
    g.fillStyle = '#ddd2b2'; // sombras nas bordas
    g.beginPath(); g.moveTo(8, 8.6); g.quadraticCurveTo(4, 22, 8, 35);
    g.lineTo(13, 36.4); g.quadraticCurveTo(9, 22, 13, 8.6); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(52, 8.6); g.quadraticCurveTo(56, 22, 52, 35);
    g.lineTo(47, 36.4); g.quadraticCurveTo(51, 22, 47, 8.6); g.closePath(); g.fill();
    g.strokeStyle = '#d8cca8'; g.lineWidth = 1; // costuras
    g.beginPath(); g.moveTo(10, 17); g.quadraticCurveTo(30, 21, 50, 17);
    g.moveTo(10, 26); g.quadraticCurveTo(30, 30, 50, 26); g.stroke();
    g.fillStyle = '#3a78c9'; // emblema grande do peixe
    g.beginPath(); g.ellipse(28, 22, 7.6, 4.4, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(35, 22); g.lineTo(40.5, 18.4); g.lineTo(40.5, 25.6); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(24, 20.4, 1.6, 1.6); // olho
    // vela de proa menor (mais perto, sobre o casco)
    g.fillStyle = '#2a1608'; g.fillRect(28.8, 30, 2.4, 14);
    g.fillRect(13, 36, 34, 2);
    g.fillStyle = '#f2ead2';
    g.beginPath(); g.moveTo(14, 38.6); g.lineTo(46, 38.6);
    g.quadraticCurveTo(48.4, 44, 46, 49.4); g.quadraticCurveTo(30, 53, 14, 49.4);
    g.quadraticCurveTo(11.6, 44, 14, 38.6); g.closePath(); g.fill();
    // casco em V com a proa vindo na nossa direção
    g.fillStyle = '#2a1608';
    g.beginPath(); g.moveTo(7, 48); g.lineTo(53, 48); g.quadraticCurveTo(55, 57, 43, 64);
    g.quadraticCurveTo(36, 68, 30, 70); g.quadraticCurveTo(24, 68, 17, 64);
    g.quadraticCurveTo(5, 57, 7, 48); g.closePath(); g.fill();
    g.fillStyle = '#6a4a22';
    g.beginPath(); g.moveTo(9, 49.6); g.lineTo(51, 49.6); g.quadraticCurveTo(52.6, 56.6, 42, 62.6);
    g.quadraticCurveTo(35.4, 66.4, 30, 68.2); g.quadraticCurveTo(24.6, 66.4, 18, 62.6);
    g.quadraticCurveTo(7.4, 56.6, 9, 49.6); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = '#8a6434'; g.fillRect(6, 53, 48, 2.4); g.fillRect(8, 58, 44, 2); // tábuas
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(6, 62, 48, 8);
    g.restore();
    g.fillStyle = '#dcac6c'; g.fillRect(9, 48.4, 42, 1.6); // borda do convés
    g.fillStyle = '#b08a50'; g.fillRect(29, 51, 2, 17); // roda de proa
    // gurupés apontando pra baixo
    g.fillStyle = '#2a1608'; g.fillRect(28.6, 58, 2.8, 13.5);
    g.fillStyle = '#5a4224'; g.fillRect(28.6, 58, 1, 13.5);
  });

  // ---------- PRANCHA DE REMO (o jogador fica de pé nela) ----------
  const pranchaSide = mkBoat(36, 12, (g) => {
    g.fillStyle = '#5a3a1a'; // contorno
    g.beginPath(); g.ellipse(18, 6, 17, 4.6, 0, 0, 7); g.fill();
    g.fillStyle = '#e8b24a';
    g.beginPath(); g.ellipse(18, 5.8, 15.6, 3.6, 0, 0, 7); g.fill();
    g.fillStyle = '#f6d07a';
    g.beginPath(); g.ellipse(16, 5, 12, 2.2, 0, 0, 7); g.fill();
    g.fillStyle = '#c8503a'; g.fillRect(6, 4.6, 24, 1.4); // faixa
    g.fillStyle = '#5a3a1a'; g.fillRect(31, 7, 3.5, 3.5); // quilha
  });
  const pranchaVert = mkBoat(16, 40, (g) => {
    g.fillStyle = '#5a3a1a';
    g.beginPath(); g.ellipse(8, 20, 6.6, 19, 0, 0, 7); g.fill();
    g.fillStyle = '#e8b24a';
    g.beginPath(); g.ellipse(8, 20, 5.3, 17.6, 0, 0, 7); g.fill();
    g.fillStyle = '#f6d07a';
    g.beginPath(); g.ellipse(7.4, 18, 3.4, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#c8503a'; g.fillRect(7, 4.5, 2, 31);
  });

  // ---------- ALVORADA (navio lendário da saga) ----------
  // a caravela renasce espectral: casco azul-noite, velas com brilho fantasmagórico
  // e reflexo dourado de amanhecer no casco
  const spectral = (src) => {
    const c = mkCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(16,24,66,.55)';
    g.fillRect(0, 0, c.width, c.height);
    const sheen = g.createLinearGradient(0, 0, 0, c.height);
    sheen.addColorStop(0, 'rgba(140,220,255,.32)');
    sheen.addColorStop(0.55, 'rgba(80,140,255,.10)');
    sheen.addColorStop(1, 'rgba(255,210,90,.18)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  const alvSide = spectral(caravelaSide), alvUp = spectral(caravelaUp), alvDown = spectral(caravelaDown);

  return {
    prancha: { right: pranchaSide, left: flipX(pranchaSide), up: pranchaVert, down: pranchaVert },
    remo:    { right: remoSide, left: flipX(remoSide), up: remoUp, down: remoDown },
    lancha:  { right: lanchaSide, left: flipX(lanchaSide), up: lanchaUp, down: lanchaDown },
    veleiro: { right: caravelaSide, left: flipX(caravelaSide), up: caravelaUp, down: caravelaDown },
    alvorada: { right: alvSide, left: flipX(alvSide), up: alvUp, down: alvDown },
  };
})();

// x,y = centro dos pés; boat = false | id do barco; riding = carona em barco alheio
const BOAT_CROP = 21; // corta o boneco na cintura pra parecer DENTRO do casco
function drawChar(x, y, dir, name, moving, time, boat, fishing, npcColor, hue, riding) {
  x = Math.round(x); y = Math.round(y);
  if (boat) {
    const set = BOAT_SPRITES[boat] || BOAT_SPRITES.remo;
    const spr = set[dir] || set.right;
    if (boat === 'alvorada') { // aura espectral do navio lendário
      const pulse = 0.09 + 0.05 * Math.sin(time * 2.5 + x * 0.05);
      ctx.fillStyle = `rgba(120,190,255,${pulse.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y - 22, 50, 42, 0, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(10,30,50,.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 5, Math.min(spr.width * 0.44, 30), 5.5, 0, 0, 7); ctx.fill();
    const bobY = Math.sin(time * 2 + x * 0.1) * 1;
    ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y + 9 - spr.height + bobY));
    const cs = charSprite(name, dir, 0, fishing, npcColor, hue);
    if (boat === 'prancha') ctx.drawImage(cs, x - 12, y - 33 + bobY); // de pé na prancha
    else ctx.drawImage(cs, 0, 0, 24, BOAT_CROP, x - 12, y - 31 + bobY, 24, BOAT_CROP);
    return;
  }
  if (riding) { // carona: cortado na cintura, balançando com o barco
    const bobY = Math.sin(time * 2 + x * 0.1) * 1;
    const cs = charSprite(name, dir, 0, fishing, npcColor, hue);
    ctx.drawImage(cs, 0, 0, 24, BOAT_CROP, x - 12, y - 31 + bobY, 24, BOAT_CROP);
    return;
  }
  drawShadow(x, y + 1, 7, 2.4);
  const frame = moving ? (Math.floor(time * 7) % 2 ? 1 : 2) : 0;
  const hop = moving ? -(Math.floor(time * 14) % 2) : 0;
  ctx.drawImage(charSprite(name, dir, frame, fishing, npcColor, hue), x - 12, y - 29 + hop);
}

// visual do equipamento por tier — todos os jogadores veem ("ostentação")
const RODVIS = {
  bambu:     { len: 12, c: '#8a6434', hi: '#a8834c', reel: '#6a4a24' },
  junco:     { len: 13, c: '#9aa04a', hi: '#c6cc74', reel: '#6a7030' },
  fibra:     { len: 15, c: '#5a6a7a', hi: '#8a9aac', reel: '#3a4a5a' },
  carbono:   { len: 18, c: '#23282f', hi: '#4aa0ff', reel: '#4aa0ff' },
  obsidiana: { len: 19, c: '#2a2233', hi: '#a06aff', reel: '#c0a0ff', sparkle: true },
  dourada:   { len: 20, c: '#d8a020', hi: '#ffe080', reel: '#fff0a0', sparkle: true },
};
const LINEVIS = {
  nylon:    { c: 'rgba(255,255,255,.6)', bob: ['#e04040', '#fff'] },
  trancada: { c: 'rgba(140,240,170,.8)', bob: ['#30b050', '#eaffea'] },
  encerada: { c: 'rgba(250,225,150,.85)', bob: ['#d8a020', '#fff0c0'] },
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
// repintável: casas compradas mudam o mapa em tempo real e o minimapa acompanha
function paintMinimapBase() {
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
  // salas internas (farol/grutas/casas) não existem no minimapa — vira mar
  const deep = colors[T.DEEP];
  for (const r of HIDDEN_ROOMS) {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const i = y * W + x;
      img.data[i * 4] = deep[0]; img.data[i * 4 + 1] = deep[1]; img.data[i * 4 + 2] = deep[2];
    }
  }
  g.putImageData(img, 0, 0);
}
paintMinimapBase();
function drawMinimap(time) {
  if (mmRepaint) { mmRepaint = false; paintMinimapBase(); }
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
  // outros jogadores: bolinha verde-menta (escondidos se estiverem numa gruta)
  for (const p of others.values()) {
    if (roomAtPx(p.x, p.y)) continue;
    mmctx.fillStyle = '#0a1420';
    mmctx.fillRect(p.x * sx - 2, p.y * sy - 2, 4, 4);
    mmctx.fillStyle = '#7affc8';
    mmctx.fillRect(p.x * sx - 1.5, p.y * sy - 1.5, 3, 3);
  }
  if (!myRoom && Math.floor(time * 3) % 2 === 0) {
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
  // fumaça das chaminés (posição varia com a arquitetura de cada bioma)
  for (const d of DECOR) {
    if (d.type !== 'house') continue;
    const off = d.th === 'volcano' ? [64, -70]                      // chaminé da forja (sempre acesa)
      : d.th === 'snow' ? (d.v > 0.5 ? [40, -40] : null)            // respiro do iglu
      : (!d.th || d.th === 'grass') && d.v > 0.4 ? [62, -68] : null; // chaminé da casa da vila
    if (!off) continue;
    if (d.x < camX - 90 || d.x > camX + VW + 90 || d.y < camY - 30 || d.y > camY + VH + 100) continue;
    d.smokeT -= dt;
    if (d.smokeT <= 0) {
      d.smokeT = 0.5 + Math.random() * 0.4;
      amb.push({ kind: 'smoke', x: d.x + off[0] + (Math.random() * 2 - 1), y: d.y + off[1],
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

// véu do abismo: peixe ABISSAL fisgado — a tela escurece em azul profundo, sobrando
// dois círculos de luz (pescador e área do peixe) cercados por chamas escuras
const abyssCv = document.createElement('canvas');
abyssCv.width = 960; abyssCv.height = 540;
const abyssG = abyssCv.getContext('2d');

// aura de "ki" negro: ondas circulares de chamas escuras lambendo a borda do círculo
// (estilo o começo de um despertar — baixas, fluindo em volta, sem cobrir o personagem)
function drawAbyssAura(hx, hy, hr, time) {
  const N = 84; // pontos da onda (suave no celular)
  const layers = [
    { amp: 20, lobes: 9,  flow: 3.2,  flick: 6.0, color: 'rgba(3,6,18,.88)' },   // chamas negras externas
    { amp: 12, lobes: 13, flow: -4.2, flick: 7.5, color: 'rgba(14,26,74,.55)' }, // ondulação azul-abissal interna
  ];
  for (const L of layers) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // cristas de chama viajando ao redor do círculo + tremulação rápida
      const crest = Math.pow(0.5 + 0.5 * Math.sin(a * L.lobes + time * L.flow), 1.7);
      const wave = crest * L.amp + Math.sin(a * (L.lobes * 2 + 1) - time * L.flick) * L.amp * 0.22;
      const r = hr + 1 + wave;
      const x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    for (let i = N; i >= 0; i--) { // fecha a coroa voltando pela borda interna
      const a = (i / N) * Math.PI * 2;
      ctx.lineTo(hx + Math.cos(a) * (hr - 5), hy + Math.sin(a) * (hr - 5));
    }
    ctx.closePath();
    ctx.fillStyle = L.color;
    ctx.fill();
  }
  // respiração azul na borda interna da aura
  ctx.strokeStyle = `rgba(70,110,220,${(0.38 + 0.24 * Math.sin(time * 4)).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy, hr - 4, 0, 7); ctx.stroke();
}

function drawAbyssVeil(camX, camY, time) {
  const fade = Math.min(1, (performance.now() - reel.t0) / 900); // surge suave
  // UM único círculo de luz englobando pescador + área do peixe
  const px = me.x, py = me.y - 8;
  const hx = ((px + fish.bobX) / 2 - camX) * ZOOM;
  const hy = ((py + fish.bobY) / 2 - camY) * ZOOM;
  const half = Math.hypot(fish.bobX - px, fish.bobY - py) / 2 * ZOOM;
  const hr = Math.max(105, Math.min(250, half + 64)) + Math.sin(time * 2.6) * 4;
  // camada escura com o furo (desenhada num canvas próprio pra recortar só o véu)
  const g = abyssG;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, 960, 540);
  g.fillStyle = `rgba(3,8,28,${(0.82 * fade).toFixed(3)})`;
  g.fillRect(0, 0, 960, 540);
  g.globalCompositeOperation = 'destination-out';
  const rad = g.createRadialGradient(hx, hy, hr * 0.45, hx, hy, hr);
  rad.addColorStop(0, 'rgba(0,0,0,1)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rad;
  g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(abyssCv, 0, 0);
  // ondas de chamas negras em volta do círculo
  ctx.globalAlpha = fade;
  drawAbyssAura(hx, hy, hr, time);
  // aviso sussurrado
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(120,60,80,${(0.55 + 0.35 * Math.sin(time * 3)).toFixed(3)})`;
  ctx.fillText(TR('🌑 ALGO ABISSAL FISGOU SUA LINHA... 🌑'), 480, 512);
  ctx.globalAlpha = 1;
}

function drawReel() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const r = reel;
  const bx = 700, by = 120, bh = 280, bw = 32;
  ctx.fillStyle = 'rgba(12,20,32,.92)';
  ctx.beginPath(); ctx.roundRect(bx - 16, by - 38, 104, bh + 70, 10); ctx.fill();
  ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.stroke(); // borda na cor da raridade
  ctx.fillStyle = '#cde'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(TR('SEGURE ESPAÇO'), bx + 36, by - 18);
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
  ctx.drawImage(fishIcon('reel-' + r.rarity, r.color, true), bx + bw / 2 - 15, fy - 8, 30, 16);
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
  // foto no alto, ao lado do nome (sem invadir a linha de raridade/peso)
  ctx.drawImage(fishIcon(f.fishId, r.color, true), cx - 152, cy - 43, 60, 32);
  ctx.fillStyle = r.color; ctx.font = 'bold 17px monospace';
  ctx.fillText(dispFish(f), cx + 20, cy - 20);
  ctx.fillStyle = '#ccc'; ctx.font = '13px monospace';
  ctx.fillText(`${r.label} · ${f.weight} kg · ${ZONE_NAMES[f.zone]}`, cx, cy + 6);
  ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 14px monospace';
  { // moeda desenhada no canvas (emoji falha em muitos aparelhos)
    const t1 = `+${f.value.toLocaleString('pt-BR')} `, t2 = TR(' no balde');
    const w1 = ctx.measureText(t1).width, w2 = ctx.measureText(t2).width, cw = 13;
    let x0 = cx - (w1 + cw + w2) / 2;
    ctx.textAlign = 'left';
    ctx.fillText(t1, x0, cy + 28); x0 += w1;
    ctx.fillStyle = '#7a4c0e'; ctx.beginPath(); ctx.arc(x0 + 6.5, cy + 23, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x0 + 6.5, cy + 23, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0b02c'; ctx.beginPath(); ctx.arc(x0 + 6.5, cy + 23, 3.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(x0 + 4.4, cy + 20.8, 1.5, 0, 7); ctx.fill();
    x0 += cw;
    ctx.fillStyle = '#ffd24a'; ctx.fillText(t2, x0, cy + 28);
    ctx.textAlign = 'center';
  }
  ctx.restore();
}

// ---------------------------------------------------------------- interior da casa

// móveis do chalé (coordenadas de mundo do quarto compartilhado) — entram no y-sort
const FURN = (() => {
  const R = WORLD.HOUSE_ROOM;
  const px = (t) => t * TILE;
  return [
    { y: px(10.6), draw: (x0, y0) => { // cama (canto NO)
      ctx.fillStyle = '#4a3018'; ctx.fillRect(px(90.9), px(9.4), 34, 48);
      ctx.fillStyle = '#e8e2d0'; ctx.fillRect(px(90.9) + 3, px(9.4) + 3, 28, 42);
      ctx.fillStyle = '#fff'; ctx.fillRect(px(90.9) + 5, px(9.4) + 5, 24, 10); // travesseiro
      ctx.fillStyle = '#b04a4a'; ctx.fillRect(px(90.9) + 3, px(9.4) + 18, 28, 27); // coberta
      ctx.fillStyle = '#8a3a3a'; ctx.fillRect(px(90.9) + 3, px(9.4) + 18, 28, 4);
    } },
    { y: px(13.4), draw: () => { // mesa redonda + 2 banquinhos (lado leste)
      const tx = px(99.6), ty = px(12.8);
      ctx.fillStyle = 'rgba(10,20,30,.25)'; ctx.beginPath(); ctx.ellipse(tx, ty + 12, 16, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(tx - 2.5, ty, 5, 12);
      ctx.fillStyle = '#8a6434'; ctx.beginPath(); ctx.ellipse(tx, ty, 16, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#a8834c'; ctx.beginPath(); ctx.ellipse(tx, ty - 1, 13, 6, 0, 0, 7); ctx.fill();
      for (const ox of [-24, 24]) {
        ctx.fillStyle = '#5a3a1c'; ctx.fillRect(tx + ox - 1.5, ty + 4, 3, 8);
        ctx.fillStyle = '#7a5228'; ctx.beginPath(); ctx.ellipse(tx + ox, ty + 4, 7, 3.5, 0, 0, 7); ctx.fill();
      }
    } },
    { y: px(9.9), draw: () => { // estante de livros (parede oeste)
      const sx = px(90.8), sy = px(12.2);
      ctx.fillStyle = '#3a2a16'; ctx.fillRect(sx, sy, 16, 34);
      ctx.fillStyle = '#5a4224'; ctx.fillRect(sx + 2, sy + 2, 12, 30);
      const cols = ['#c05a4a', '#4a8ac0', '#58a858', '#d0a040', '#9a6ad0'];
      for (let r2 = 0; r2 < 3; r2++) for (let b = 0; b < 3; b++) {
        ctx.fillStyle = cols[(r2 * 3 + b) % 5];
        ctx.fillRect(sx + 3 + b * 3.6, sy + 4 + r2 * 10, 3, 7);
      }
    } },
    { y: px(9.9), draw: (x0, y0, time) => { // lareira (parede leste) com fogo vivo
      const fx = px(101.2), fy = px(9.2);
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(fx - 12, fy, 24, 22);
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(fx - 9, fy + 6, 18, 16);
      ctx.fillStyle = '#1a1a20'; ctx.fillRect(fx - 7, fy + 8, 14, 12);
      const fl = 0.7 + 0.3 * Math.sin(time * 9 + Math.sin(time * 23));
      ctx.fillStyle = `rgba(255,140,40,${0.85 * fl})`;
      ctx.beginPath(); ctx.moveTo(fx - 5, fy + 19);
      ctx.quadraticCurveTo(fx - 4, fy + 12 - 3 * fl, fx, fy + 10 - 4 * fl);
      ctx.quadraticCurveTo(fx + 4, fy + 12 - 3 * fl, fx + 5, fy + 19);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,220,90,${0.8 * fl})`;
      ctx.beginPath(); ctx.moveTo(fx - 2.5, fy + 19);
      ctx.quadraticCurveTo(fx, fy + 14 - 2 * fl, fx + 2.5, fy + 19);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,170,60,${0.06 + 0.04 * fl})`; // brilho no chão
      ctx.beginPath(); ctx.ellipse(fx, fy + 24, 26, 12, 0, 0, 7); ctx.fill();
    } },
    { y: px(16.2), draw: () => { // vasinhos de planta (cantos do sul)
      for (const vx of [px(91.4), px(101.6)]) {
        const vy = px(16.1);
        ctx.fillStyle = '#8a4a2a'; ctx.fillRect(vx - 4, vy - 4, 8, 6);
        ctx.fillStyle = '#a85a34'; ctx.fillRect(vx - 3, vy - 4, 6, 2);
        ctx.fillStyle = '#3e7e34';
        ctx.beginPath(); ctx.ellipse(vx, vy - 8, 6, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#58a848';
        ctx.beginPath(); ctx.ellipse(vx - 2, vy - 10, 3.5, 3, 0, 0, 7); ctx.fill();
      }
    } },
  ];
})();

// chão da casa (tapete, capacho) + mostruário de peixes na parede norte
function drawHouseInterior(time) {
  const R = WORLD.HOUSE_ROOM;
  const cx = (R.doorTx + 0.5) * TILE;
  // tapete oval no centro
  ctx.fillStyle = '#7a4030'; ctx.beginPath(); ctx.ellipse(cx, 13.4 * TILE, 42, 20, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9a5a40'; ctx.beginPath(); ctx.ellipse(cx, 13.4 * TILE, 34, 15, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c8925a'; ctx.beginPath(); ctx.ellipse(cx, 13.4 * TILE, 22, 8.5, 0, 0, 7); ctx.fill();
  // capacho da porta
  ctx.fillStyle = '#a88a4a'; ctx.fillRect(cx - 10, (R.doorTy - 1) * TILE + 4, 20, 9);
  ctx.fillStyle = '#c8a860'; ctx.fillRect(cx - 8, (R.doorTy - 1) * TILE + 6, 16, 5);
  // mostruário (5 plaquinhas na parede norte)
  const wy = R.y0 * TILE + 9;
  const tros = (houseInfo && houseInfo.trophies) || [];
  for (let s = 0; s < 5; s++) {
    const px = cx + (s - 2) * 36;
    ctx.fillStyle = '#2c2012'; ctx.beginPath(); ctx.roundRect(px - 15, wy - 8, 30, 20, 3); ctx.fill();
    ctx.fillStyle = '#6a4a26'; ctx.beginPath(); ctx.roundRect(px - 13.5, wy - 6.5, 27, 17, 2); ctx.fill();
    const f = tros[s];
    if (f && catalog) {
      const r = catalog.rarities[f.rarity];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fishIcon(f.fishId, r.color, true), px - 13, wy - 5, 26, 14);
      ctx.font = 'bold 7.5px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = r.color;
      ctx.fillText(`${f.weight}kg`, px, wy + 18);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1;
      ctx.strokeRect(px - 9, wy - 3, 18, 10);
    }
  }
  // nome do dono acima do mostruário
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillText(`⌂ ${houseInfo ? houseInfo.owner : ''}`, cx + 1, wy - 12);
  ctx.fillStyle = '#ffe9a0';
  ctx.fillText(`⌂ ${houseInfo ? houseInfo.owner : ''}`, cx, wy - 13);
  // dica pro dono perto da parede
  if (me.house === me.name && me.y < (R.y0 + 3.2) * TILE) {
    drawLabel(cx, wy + 30, TR('[E] mostruário'), '#7affc8');
  }
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

// se algo der errado num frame, avisa e segue pro próximo (não congela o jogo)
let errShown = false;
addEventListener('error', (e) => {
  if (errShown) return;
  errShown = true;
  toast('⚠️ Erro: ' + (e.message || 'desconhecido').slice(0, 80), 6000);
});

let lastT = performance.now();
function loop(now) {
  try { frame_(now); } catch (e) {
    if (!errShown) { errShown = true; toast('⚠️ Erro no desenho: ' + String(e.message).slice(0, 70), 6000); }
    console.error(e);
    requestAnimationFrame(loop);
  }
}
// no celular: joystick e botões só existem DENTRO do jogo — nunca sobre login/menus
// (a zona de toque do analógico cobria metade da tela e engolia os toques nos campos)
function updateTouchUiGate() {
  const loginOpen = $('login').style.display !== 'none';
  const modalOpen = ['inventory', 'shop', 'dex', 'quests', 'settings', 'housing', 'trophy'].some((id) => $(id).style.display === 'block')
    || $('terms').style.display === 'block';
  const tu = $('touchui');
  const wantTu = loginOpen ? 'none' : 'block';
  if (tu.style.display !== wantTu) tu.style.display = wantTu;
  const jz = $('joyzone');
  const wantJz = (loginOpen || modalOpen) ? 'none' : 'block';
  if (jz.style.display !== wantJz) {
    jz.style.display = wantJz;
    if (wantJz === 'none') { // solta o analógico se estava no meio de um arrasto
      joy.active = false; joy.vx = 0; joy.vy = 0;
      $('joybase').style.display = 'none';
      $('joyknob').style.display = 'none';
    }
  }
}

function frame_(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const time = now / 1000;

  if (IS_TOUCH) updateTouchUiGate();
  if (profile) {
    if (!chatOpen) pollGamepad();
    updateMe(dt);
    if (reel) updateReel(dt);
    updateTutorial(dt);
    for (const p of others.values()) {
      if (p.riding) { // carona: gruda no barco do dono e olha pra frente dele
        const o = p.riding === me.id ? me : others.get(p.riding);
        if (o) {
          const off = WORLD.SEAT_OFF[p.seat] || [0, 6];
          p.x = p.tx = o.x + off[0];
          p.y = p.ty = o.y + off[1];
          p.dir = o.dir;
        }
        continue;
      }
      p.x += (p.tx - p.x) * Math.min(1, dt * 10);
      p.y += (p.ty - p.y) * Math.min(1, dt * 10);
    }
    updateCritters(dt, Math.max(0, me.x - VW / 2), Math.max(0, me.y - VH / 2));
  }

  const camX = Math.max(0, Math.min(W * TILE - VW, me.x - VW / 2));
  const camY = Math.max(0, Math.min(H * TILE - VH, me.y - VH / 2));
  ctx.setTransform(ZOOM, 0, 0, ZOOM, -Math.round(camX * ZOOM), -Math.round(camY * ZOOM));
  ctx.imageSmoothingEnabled = false;

  // tiles
  myRoom = roomAtPx(me.x, me.y);
  const frame = Math.floor(time * 2.2) % 4;
  const tx0 = Math.floor(camX / TILE), ty0 = Math.floor(camY / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(VH / TILE); ty++) {
    for (let tx = tx0; tx <= tx0 + Math.ceil(VW / TILE); tx++) {
      const t = rTileAt(tx, ty);
      const spr = SPR[t];
      if (spr) {
        const v = (t === T.DEEP || t === T.SHALLOW || t === T.LAVA)
          ? (frame + ((tx * 3 + ty * 5) & 3)) & 3
          : t === T.PLANK ? (tx & 3) // tábuas em sequência regular, não aleatórias
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
      const dr = roomAtPx(d.x, d.y);
      if (dr && dr !== myRoom) continue; // tesouro em gruta só aparece pra quem está dentro
      const r = catalog.rarities[d.fish.rarity];
      const bob = Math.sin(time * 3 + d.id) * 1.5;
      // ostentação: quanto mais pesado, maior o peixe no chão (escala logarítmica)
      const s = Math.min(2.9, 0.8 + Math.log10(1 + (d.fish.weight || 0.1)) * 0.85);
      drawShadow(d.x, d.y + 4, 7 * s, 2.2 * s);
      ctx.drawImage(fishIcon(d.fish.fishId, r.color, true), d.x - 15 * s, d.y - 8 * s + bob, 30 * s, 16 * s);
      if (Math.hypot(d.x - me.x, d.y - me.y) < 40 + 12 * s) {
        drawLabel(d.x, d.y - 10 - 8 * s, `${TR('[E] pegar')} · ${d.fish.weight} kg`, '#7affc8');
      }
    }

    // plaquinha das casas dos jogadores (nome do dono na porta)
    for (const h of HOUSES) {
      const L = WORLD.houseLot(h.island, h.lot);
      const hx2 = L.door.tx * TILE + 8, hy2 = L.door.ty * TILE;
      if (hx2 < camX - 60 || hx2 > camX + VW + 60 || hy2 < camY - 60 || hy2 > camY + VH + 60) continue;
      const near = Math.hypot(hx2 - me.x, hy2 - me.y);
      if (near < 140) drawLabel(hx2, hy2 - 26, '⌂ ' + h.owner, '#ffe9a0');
      if (near < 42) drawLabel(hx2, hy2 - 36, h.owner === me.name ? TR('[E] entrar') : TR('[E] bater na porta'), '#7affc8');
    }
    // dentro de uma casa: tapete, capacho e mostruário (embaixo das entidades)
    if (me.house && myRoom) drawHouseInterior(time);

    // entidades ordenadas por Y (jogadores, NPCs, bichinhos e vegetação)
    const ents = [];
    for (const d of DECOR) {
      // margens largas: casas são grandes (80px + telhado alto) — sem "pipocar" na borda
      if (d.x < camX - 110 || d.x > camX + VW + 40 || d.y < camY - 12 || d.y > camY + VH + 120) continue;
      ents.push({ kind: 'decor', y: d.y, d });
    }
    for (const n of NPCS) {
      const nr = roomAtTile(n.tx, n.ty);
      if (nr && nr !== myRoom) continue; // Guardião do Farol invisível de fora
      const np = npcPos(n);
      ents.push({ kind: 'npc', y: np.y, n, np });
    }
    for (const c of critters) ents.push({ kind: 'critter', y: c.y, c });
    for (const p of others.values()) {
      const pr2 = roomAtPx(p.x, p.y);
      if (pr2 && pr2 !== myRoom) continue;
      if ((p.house || null) !== (me.house || null)) continue; // cada casa é uma instância separada
      ents.push({ kind: 'player', y: p.y, p });
    }
    if (me.house && myRoom) for (const f of FURN) ents.push({ kind: 'furn', y: f.y, f });
    ents.push({ kind: 'me', y: me.y });
    ents.sort((a, b) => a.y - b.y);

    for (const e of ents) {
      if (e.kind === 'decor') { drawDecor(e.d, time); continue; }
      if (e.kind === 'furn') { e.f.draw(0, 0, time); continue; }
      if (e.kind === 'critter') { drawCritter(e.c, time); continue; }
      if (e.kind === 'npc') {
        const n = e.n;
        const nx = e.np.x, ny = e.np.y;
        drawChar(nx, ny, e.np.dir, 'npc:' + n.id, e.np.moving, time, false, false, n.role === 'shop' ? '#d9a24a' : '#9a6ad0');
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
        const rodBehind = p.dir === 'up'; // pescando pro norte, a vara fica ATRÁS do corpo
        if (rodBehind) drawFishingRodAndLine(p, false, time, now);
        drawChar(p.x, p.y, p.dir, p.name, pMoving, time, p.boat ? (p.boatT || 'remo') : false, !!p.fishing, null, p.hue, !!p.riding);
        if (p.sayFx && now < p.sayFx.until) drawSpeech(p.x, p.y - (p.boat ? 40 : 36), p.sayFx.text);
        else drawLabel(p.x, p.y - (p.boat ? 38 : 34), showName ? p.name : (LANG === 'en' ? `Level ${p.level}` : `Nível ${p.level}`), showName ? '#fff' : '#ffd88a');
        if (!rodBehind) drawFishingRodAndLine(p, false, time, now);
        if (p.catchFx) {
          const age = (now - p.catchFx.t) / 1000;
          if (age > 2.4) p.catchFx = null;
          else drawLabel(p.x, p.y - 40 - age * 10, dispFish(p.catchFx.fish) + '!', catalog.rarities[p.catchFx.fish.rarity].color);
        }
      } else {
        const rodBehind = me.dir === 'up';
        if (rodBehind) drawFishingRodAndLine(me, true, time, now);
        drawChar(me.x, me.y, me.dir, me.name, me.moving, time, me.boat ? (profile.boat || 'remo') : false, fish.phase !== 'idle', null, profile.color, !!me.riding);
        if (me.sayFx && now < me.sayFx.until) drawSpeech(me.x, me.y - (me.boat ? 40 : 36), me.sayFx.text);
        else drawLabel(me.x, me.y - (me.boat ? 38 : 34), showName ? me.name : `Nível ${profile.level}`, showName ? '#bfe8ff' : '#ffd88a');
        if (!rodBehind) drawFishingRodAndLine(me, true, time, now);
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
  if (reel && reel.rarity === 'abissal') drawAbyssVeil(camX, camY, time); // antes da barrinha: ela fica visível
  if (reel) drawReel();
  if (catchCard) drawCatchCard(now);
  drawConfetti(dt);
  if (profile) { drawMinimap(time); tickMoney(dt); }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

})();
