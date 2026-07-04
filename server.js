// Lago Pixel v2 — servidor (visão aérea, ilhas, quests, coleção, drops, barcos)
// Autoritativo: sorteios, inventário, moedas, loja, missões e persistência.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const WORLD = require('./public/world.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SAVE_FILE = path.join(__dirname, 'data', 'players.json');

const MAP = WORLD.genWorld();
const tileAt = (px, py) => {
  const tx = Math.floor(px / WORLD.TILE), ty = Math.floor(py / WORLD.TILE);
  if (tx < 0 || ty < 0 || tx >= WORLD.W || ty >= WORLD.H) return WORLD.T.DEEP;
  return MAP[ty * WORLD.W + tx];
};
const isWaterPx = (px, py) => { const t = tileAt(px, py); return t === WORLD.T.DEEP || t === WORLD.T.SHALLOW; };

// ---------------------------------------------------------------- catálogo

// sequência de cores (fácil → difícil): cinza, branco, verde, azul, roxo, dourado, rosa, vermelho
const RARITY_ORDER = ['lixo', 'comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'abissal'];
const RARITIES = {
  lixo:     { label: 'Lixo',     xp: 1,    reelTime: 3,  speed: 0.4, color: '#9a9a9a' },
  comum:    { label: 'Comum',    xp: 4,    reelTime: 5,  speed: 0.8, color: '#f0f0f0' },
  incomum:  { label: 'Incomum',  xp: 10,   reelTime: 6,  speed: 1.1, color: '#58d858' },
  raro:     { label: 'Raro',     xp: 25,   reelTime: 8,  speed: 1.5, color: '#4a9aff' },
  epico:    { label: 'Épico',    xp: 60,   reelTime: 10, speed: 1.9, color: '#c060ff' },
  lendario: { label: 'Lendário', xp: 150,  reelTime: 12, speed: 2.4, color: '#ffd24a' },
  mitico:   { label: 'Mítico',   xp: 400,  reelTime: 14, speed: 2.9, color: '#ff6ab8' },
  abissal:  { label: 'Abissal',  xp: 1000, reelTime: 16, speed: 3.4, color: '#ff4040' },
};

const FISH = [
  // lixo (todo lugar)
  { id: 'bota',       name: 'Bota Velha',            rarity: 'lixo',     base: 1,    wmin: 0.5,  wmax: 1.5,   zones: ['*'] },
  { id: 'lata',       name: 'Lata Enferrujada',      rarity: 'lixo',     base: 2,    wmin: 0.1,  wmax: 0.4,   zones: ['*'] },
  { id: 'alga',       name: 'Tufo de Algas',         rarity: 'lixo',     base: 2,    wmin: 0.2,  wmax: 1.0,   zones: ['*'] },
  // vila
  { id: 'lambari',    name: 'Lambari',               rarity: 'comum',    base: 5,    wmin: 0.1,  wmax: 0.3,   zones: ['vila'] },
  { id: 'tilapia',    name: 'Tilápia',               rarity: 'comum',    base: 8,    wmin: 0.5,  wmax: 2.5,   zones: ['vila'] },
  { id: 'carpa',      name: 'Carpa',                 rarity: 'comum',    base: 12,   wmin: 1.0,  wmax: 8.0,   zones: ['vila'] },
  { id: 'bagre',      name: 'Bagre',                 rarity: 'comum',    base: 10,   wmin: 1.0,  wmax: 5.0,   zones: ['vila'] },
  { id: 'traira',     name: 'Traíra',                rarity: 'incomum',  base: 22,   wmin: 0.8,  wmax: 4.0,   zones: ['vila'] },
  { id: 'pacu',       name: 'Pacu',                  rarity: 'incomum',  base: 26,   wmin: 2.0,  wmax: 9.0,   zones: ['vila'] },
  { id: 'tucunare',   name: 'Tucunaré-Açu',          rarity: 'raro',     base: 75,   wmin: 3.0,  wmax: 12.0,  zones: ['vila'] },
  { id: 'jau',        name: 'Jaú-Gigante',           rarity: 'epico',    base: 320,  wmin: 20.0, wmax: 110.0, zones: ['vila'] },
  { id: 'koi',        name: 'Carpa Koi Dourada',     rarity: 'lendario', base: 1400, wmin: 5.0,  wmax: 20.0,  zones: ['vila'] },
  // alto-mar
  { id: 'sardinha',   name: 'Sardinha',              rarity: 'comum',    base: 6,    wmin: 0.1,  wmax: 0.4,   zones: ['altomar'] },
  { id: 'cavala',     name: 'Cavala',                rarity: 'comum',    base: 11,   wmin: 0.8,  wmax: 3.5,   zones: ['altomar'] },
  { id: 'atum',       name: 'Atum',                  rarity: 'incomum',  base: 34,   wmin: 5.0,  wmax: 60.0,  zones: ['altomar'] },
  { id: 'robalo',     name: 'Robalo',                rarity: 'incomum',  base: 30,   wmin: 1.5,  wmax: 7.0,   zones: ['altomar'] },
  { id: 'douradomar', name: 'Dourado-do-Mar',        rarity: 'raro',     base: 95,   wmin: 4.0,  wmax: 18.0,  zones: ['altomar'] },
  { id: 'espadarte',  name: 'Espadarte',             rarity: 'raro',     base: 120,  wmin: 20.0, wmax: 90.0,  zones: ['altomar'] },
  { id: 'martelo',    name: 'Tubarão-Martelo',       rarity: 'epico',    base: 380,  wmin: 40.0, wmax: 200.0, zones: ['altomar'] },
  { id: 'lua',        name: 'Peixe-Lua',             rarity: 'epico',    base: 340,  wmin: 50.0, wmax: 300.0, zones: ['altomar'] },
  { id: 'leviata',    name: 'Leviatã-Bebê',          rarity: 'lendario', base: 2600, wmin: 80.0, wmax: 400.0, zones: ['altomar'] },
  // deserto
  { id: 'piaba',      name: 'Piaba-do-Deserto',      rarity: 'comum',    base: 7,    wmin: 0.1,  wmax: 0.5,   zones: ['deserto'] },
  { id: 'gatooasis',  name: 'Peixe-Gato do Oásis',   rarity: 'comum',    base: 12,   wmin: 0.8,  wmax: 4.0,   zones: ['deserto'] },
  { id: 'pulmonado',  name: 'Peixe-Pulmonado',       rarity: 'incomum',  base: 32,   wmin: 1.0,  wmax: 6.0,   zones: ['deserto'] },
  { id: 'escorpiao',  name: "Escorpião-d'Água",      rarity: 'raro',     base: 110,  wmin: 0.5,  wmax: 3.0,   zones: ['deserto'] },
  { id: 'serpente',   name: 'Serpente-de-Areia',     rarity: 'epico',    base: 390,  wmin: 8.0,  wmax: 40.0,  zones: ['deserto'] },
  { id: 'miragem',    name: 'Olho-de-Miragem',       rarity: 'lendario', base: 2200, wmin: 2.0,  wmax: 10.0,  zones: ['deserto'] },
  // savana
  { id: 'zebra',      name: 'Tilápia-Zebra',         rarity: 'comum',    base: 9,    wmin: 0.5,  wmax: 2.5,   zones: ['savana'] },
  { id: 'tigre',      name: 'Peixe-Tigre',           rarity: 'incomum',  base: 36,   wmin: 2.0,  wmax: 15.0,  zones: ['savana'] },
  { id: 'elefante',   name: 'Peixe-Elefante',        rarity: 'incomum',  base: 30,   wmin: 0.5,  wmax: 3.0,   zones: ['savana'] },
  { id: 'percanilo',  name: 'Perca-do-Nilo',         rarity: 'raro',     base: 115,  wmin: 10.0, wmax: 100.0, zones: ['savana'] },
  { id: 'bagreafro',  name: 'Bagre-Gigante-Africano', rarity: 'epico',   base: 360,  wmin: 15.0, wmax: 80.0,  zones: ['savana'] },
  { id: 'espirito',   name: 'Espírito-da-Savana',    rarity: 'lendario', base: 2300, wmin: 5.0,  wmax: 25.0,  zones: ['savana'] },
  // gelo
  { id: 'bacalhau',   name: 'Bacalhau-Ártico',       rarity: 'comum',    base: 10,   wmin: 1.0,  wmax: 6.0,   zones: ['gelo'] },
  { id: 'salmogelo',  name: 'Salmão-do-Gelo',        rarity: 'comum',    base: 13,   wmin: 1.5,  wmax: 7.0,   zones: ['gelo'] },
  { id: 'lanterna',   name: 'Peixe-Lanterna',        rarity: 'incomum',  base: 38,   wmin: 0.3,  wmax: 1.5,   zones: ['gelo'] },
  { id: 'enguiapolar', name: 'Enguia-Polar',         rarity: 'raro',     base: 118,  wmin: 2.0,  wmax: 12.0,  zones: ['gelo'] },
  { id: 'narval',     name: 'Narval-Anão',           rarity: 'epico',    base: 420,  wmin: 30.0, wmax: 150.0, zones: ['gelo'] },
  { id: 'coracaogelo', name: 'Coração-de-Gelo',      rarity: 'lendario', base: 2400, wmin: 1.0,  wmax: 5.0,   zones: ['gelo'] },
  // vulcão
  // míticos (rosa) e abissais (vermelho) — os mais difíceis do jogo
  { id: 'sereia',     name: 'Cauda-de-Sereia',       rarity: 'mitico',   base: 7000,  wmin: 10.0,  wmax: 60.0,  zones: ['altomar', 'farol'] },
  { id: 'aurora',     name: 'Peixe-Aurora',          rarity: 'mitico',   base: 7500,  wmin: 3.0,   wmax: 25.0,  zones: ['gelo'] },
  { id: 'quimera',    name: 'Quimera-do-Oásis',      rarity: 'mitico',   base: 8000,  wmin: 5.0,   wmax: 40.0,  zones: ['deserto', 'savana'] },
  { id: 'faisca',     name: 'Faísca-Eterna',         rarity: 'mitico',   base: 8500,  wmin: 1.0,   wmax: 10.0,  zones: ['vulcao', 'vila'] },
  { id: 'megalodonte', name: 'Megalodonte-Jovem',    rarity: 'abissal',  base: 20000, wmin: 200.0, wmax: 900.0, zones: ['altomar', 'farol'] },
  { id: 'horror',     name: 'Horror Abissal',        rarity: 'abissal',  base: 24000, wmin: 50.0,  wmax: 400.0, zones: ['altomar', 'gelo', 'vulcao'] },
  { id: 'primordial', name: 'Peixe-Primordial',      rarity: 'abissal',  base: 30000, wmin: 20.0,  wmax: 150.0, zones: ['vila', 'deserto', 'savana', 'farol'] },
  // exclusivos dos círculos de evento no mar
  { id: 'sardadourada', name: 'Sardinha-Dourada',     rarity: 'raro',     base: 180,   wmin: 0.2,  wmax: 1.0,   zones: ['ev:dourado'] },
  { id: 'olhoabismo',   name: 'Olho-do-Abismo',       rarity: 'epico',    base: 550,   wmin: 5.0,  wmax: 40.0,  zones: ['ev:sombrio'] },
  { id: 'arcoiris',     name: 'Peixe-Arco-Íris',      rarity: 'raro',     base: 170,   wmin: 0.5,  wmax: 3.0,   zones: ['ev:arcoiris'] },
  { id: 'fantasma',     name: 'Peixe-Fantasma',       rarity: 'epico',    base: 560,   wmin: 1.0,  wmax: 15.0,  zones: ['ev:nevoa'] },
  { id: 'palhacoreal',  name: 'Palhaço-Real',         rarity: 'incomum',  base: 70,    wmin: 0.2,  wmax: 1.0,   zones: ['ev:corais'] },
  { id: 'dragmarinho',  name: 'Dragão-Marinho-Folhado', rarity: 'lendario', base: 2900, wmin: 0.5, wmax: 4.0,   zones: ['ev:corais'] },
  { id: 'voltaica',     name: 'Enguia-Voltaica',      rarity: 'epico',    base: 580,   wmin: 3.0,  wmax: 25.0,  zones: ['ev:tempestade'] },
  { id: 'lagrima',      name: 'Lágrima-de-Sereia',    rarity: 'mitico',   base: 9500,  wmin: 1.0,  wmax: 8.0,   zones: ['ev:sereias'] },
  { id: 'carvao',     name: 'Peixe-Carvão',          rarity: 'comum',    base: 12,   wmin: 0.5,  wmax: 3.0,   zones: ['vulcao'] },
  { id: 'tetracinza', name: 'Tetra-Cinza',           rarity: 'comum',    base: 9,    wmin: 0.1,  wmax: 0.6,   zones: ['vulcao'] },
  { id: 'bloblava',   name: 'Blob-de-Lava',          rarity: 'incomum',  base: 40,   wmin: 1.0,  wmax: 8.0,   zones: ['vulcao'] },
  { id: 'magma',      name: 'Peixe-Magma',           rarity: 'raro',     base: 130,  wmin: 3.0,  wmax: 15.0,  zones: ['vulcao'] },
  { id: 'enguiafogo', name: 'Enguia-de-Fogo',        rarity: 'epico',    base: 440,  wmin: 5.0,  wmax: 30.0,  zones: ['vulcao'] },
  { id: 'dragaolava', name: 'Dragão-de-Lava',        rarity: 'lendario', base: 3000, wmin: 30.0, wmax: 150.0, zones: ['vulcao'] },
];
const FISH_BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));

const RODS = {
  bambu:   { name: 'Vara de Bambu',    price: 0,     level: 1,  luck: 0, bar: 80 },
  fibra:   { name: 'Vara de Fibra',    price: 400,   level: 3,  luck: 1, bar: 100 },
  carbono: { name: 'Vara de Carbono',  price: 2000,  level: 7,  luck: 2, bar: 115 },
  dourada: { name: 'Vara Dourada',     price: 10000, level: 12, luck: 3, bar: 135 },
  guardia: { name: 'Vara do Guardião', price: 99999, level: 1,  luck: 5, bar: 155, secret: true }, // única, só na quest final
};
const LINES = {
  nylon:    { name: 'Linha de Nylon',    price: 0,    level: 1, drain: 1.0 },
  trancada: { name: 'Linha Trançada',    price: 600,  level: 4, drain: 0.75 },
  aco:      { name: 'Linha de Aço',      price: 3000, level: 9, drain: 0.55 },
};
const BOATS = {
  remo:   { name: 'Barco a Remo', price: 800,   level: 3,  speed: 1.0 },
  lancha: { name: 'Lancha',       price: 5000,  level: 8,  speed: 1.9 },
  veleiro: { name: 'Veleiro',     price: 18000, level: 14, speed: 2.6 },
};
const BAITS = {
  minhoca:   { name: 'Minhoca',        price: 25,  pack: 10, biteFactor: 0.5, luckBonus: 0 },
  brilhante: { name: 'Isca Brilhante', price: 120, pack: 10, biteFactor: 0.7, luckBonus: 1 },
};

const ZONE_WEIGHTS = {
  vila:    { lixo: 14, comum: 55, incomum: 20, raro: 8,  epico: 2.5, lendario: 0.5, mitico: 0.06, abissal: 0.015 },
  deserto: { lixo: 10, comum: 48, incomum: 25, raro: 12, epico: 4,   lendario: 1,   mitico: 0.09, abissal: 0.02 },
  savana:  { lixo: 10, comum: 47, incomum: 25, raro: 13, epico: 4,   lendario: 1,   mitico: 0.09, abissal: 0.02 },
  gelo:    { lixo: 8,  comum: 45, incomum: 26, raro: 14, epico: 5.5, lendario: 1.5, mitico: 0.12, abissal: 0.03 },
  vulcao:  { lixo: 8,  comum: 40, incomum: 27, raro: 16, epico: 7,   lendario: 2,   mitico: 0.15, abissal: 0.04 },
  altomar: { lixo: 6,  comum: 42, incomum: 28, raro: 15, epico: 7,   lendario: 2,   mitico: 0.15, abissal: 0.04 },
  farol:   { lixo: 5,  comum: 40, incomum: 27, raro: 16, epico: 8,   lendario: 2.5, mitico: 0.25, abissal: 0.08 },
};

// ---------------------------------------------------------------- missões

const QUESTS = {
  bia: [
    { text: 'Pesque 3 peixes de qualquer tipo.',                    type: 'count',   need: 3, reward: { coins: 60, xp: 25 } },
    { text: 'Pesque uma Tilápia de 1.5 kg ou mais.',                type: 'weight',  fish: 'tilapia', min: 1.5, need: 1, reward: { coins: 150, xp: 50 } },
    { text: 'Registre 6 espécies diferentes na coleção.',           type: 'dex',     need: 6, reward: { coins: 250, xp: 80 } },
    { text: 'Pesque um peixe Raro ou melhor.',                      type: 'rarity',  min: 'raro', need: 1, reward: { coins: 350, xp: 120 } },
    { text: 'Pesque em 3 zonas diferentes (compre um barco!).',     type: 'zones',   need: 3, reward: { coins: 600, xp: 200 } },
  ],
  omar: [
    { text: 'Pesque 3 peixes aqui na Duna Seca.',                   type: 'zone',    zone: 'deserto', need: 3, reward: { coins: 180, xp: 60 } },
    { text: 'Traga-me um Peixe-Pulmonado do oásis.',                type: 'species', fish: 'pulmonado', need: 1, reward: { coins: 300, xp: 100 } },
    { text: "Um Escorpião-d'Água picou meu camelo. Vingue-o!",      type: 'species', fish: 'escorpiao', need: 1, reward: { coins: 700, xp: 220 } },
  ],
  adama: [
    { text: 'Pesque 3 peixes na Costa Dourada.',                    type: 'zone',    zone: 'savana', need: 3, reward: { coins: 180, xp: 60 } },
    { text: 'O Peixe-Tigre rasgou minha rede. Pesque 2 deles!',     type: 'species', fish: 'tigre', need: 2, reward: { coins: 400, xp: 130 } },
    { text: 'Dizem que a Perca-do-Nilo chega a 100 kg. Prove!',     type: 'weight',  fish: 'percanilo', min: 50, need: 1, reward: { coins: 900, xp: 300 } },
  ],
  nanuk: [
    { text: 'Pesque 3 peixes nas águas geladas.',                   type: 'zone',    zone: 'gelo', need: 3, reward: { coins: 180, xp: 60 } },
    { text: 'O Peixe-Lanterna ilumina meu iglu. Traga um!',         type: 'species', fish: 'lanterna', need: 1, reward: { coins: 350, xp: 110 } },
    { text: 'Lenda local: o Coração-de-Gelo. Encontre-o.',          type: 'species', fish: 'coracaogelo', need: 1, reward: { coins: 3000, xp: 800 } },
  ],
  vulcana: [
    { text: 'Pesque 3 peixes nas águas do vulcão.',                 type: 'zone',    zone: 'vulcao', need: 3, reward: { coins: 200, xp: 70 } },
    { text: 'Pesque um peixe Épico ou melhor em qualquer lugar.',   type: 'rarity',  min: 'epico', need: 1, reward: { coins: 800, xp: 250 } },
    { text: 'O Dragão-de-Lava dorme na cratera. Acorde-o.',         type: 'species', fish: 'dragaolava', need: 1, reward: { coins: 5000, xp: 1500 } },
  ],
  ilo: [
    { text: 'Pesque 3 peixes aqui nas pedras do farol.',            type: 'zone',    zone: 'farol', need: 3, reward: { coins: 220, xp: 80 } },
    { text: 'Um Espadarte quase furou meu bote. Pesque um!',        type: 'species', fish: 'espadarte', need: 1, reward: { coins: 500, xp: 160 } },
    { text: 'Nas noites de neblina, vejo um Leviatã... prove que existe.', type: 'species', fish: 'leviata', need: 1, reward: { coins: 4000, xp: 1200 } },
  ],
  pedro: [
    { text: 'Ah, a juventude! Pesque 5 peixes pra este velho.',     type: 'count',   need: 5, reward: { coins: 100, xp: 40 } },
    { text: 'Uma Carpa de 5 kg+ pro meu ensopado de domingo.',      type: 'weight',  fish: 'carpa', min: 5, need: 1, reward: { coins: 150, xp: 60, bait: { id: 'minhoca', n: 10 } } },
    { text: 'Pesque 10 peixes na vila e leve minha velha vara.',    type: 'zone',    zone: 'vila', need: 10, reward: { coins: 200, xp: 120, rod: 'fibra' } },
  ],
  kira: [
    { text: 'O degelo assusta os peixes. Pesque 5 aqui no gelo.',   type: 'zone',    zone: 'gelo', need: 5, reward: { coins: 250, xp: 90 } },
    { text: 'Preciso de 3 Bacalhaus pro banquete da aldeia.',       type: 'species', fish: 'bacalhau', need: 3, reward: { coins: 350, xp: 120, bait: { id: 'brilhante', n: 5 } } },
    { text: 'A Enguia-Polar rouba minhas redes. Capture-a!',        type: 'species', fish: 'enguiapolar', need: 1, reward: { coins: 600, xp: 200, line: 'trancada' } },
  ],
  zahra: [
    { text: 'As dunas cantam... pesque 5 peixes no deserto.',       type: 'zone',    zone: 'deserto', need: 5, reward: { coins: 250, xp: 90 } },
    { text: 'Traga 3 Piabas pro chá do acampamento.',               type: 'species', fish: 'piaba', need: 3, reward: { coins: 300, xp: 110 } },
    { text: 'A Serpente-de-Areia guarda um tesouro: derrote-a!',    type: 'species', fish: 'serpente', need: 1, reward: { coins: 1000, xp: 350, rod: 'carbono' } },
  ],
  kofi: [
    { text: 'O rio da savana está generoso. Pesque 5 peixes aqui.', type: 'zone',    zone: 'savana', need: 5, reward: { coins: 250, xp: 90 } },
    { text: 'Tilápias-Zebra, 4 delas, pro mercado de amanhã.',      type: 'species', fish: 'zebra', need: 4, reward: { coins: 300, xp: 110 } },
    { text: 'O Bagre-Gigante engoliu meu tambor. Recupere-o!',      type: 'species', fish: 'bagreafro', need: 1, reward: { coins: 900, xp: 300, bait: { id: 'brilhante', n: 10 } } },
  ],
  brasa: [
    { text: 'As águas ferventes têm sabor único. Pesque 5 aqui.',   type: 'zone',    zone: 'vulcao', need: 5, reward: { coins: 300, xp: 100 } },
    { text: 'Um Peixe-Magma pra forjar minha nova faca!',           type: 'species', fish: 'magma', need: 1, reward: { coins: 500, xp: 160 } },
    { text: 'A Enguia-de-Fogo... dizem que seu couro não queima.',  type: 'species', fish: 'enguiafogo', need: 1, reward: { coins: 1200, xp: 400 } },
  ],
  guardiao: [
    { text: 'Você chegou longe, pescador. Prova final: traga-me 2 peixes LENDÁRIOS e a Vara do Guardião será sua.', type: 'rarity', min: 'lendario', need: 2, reward: { coins: 5000, xp: 2500, rod: 'guardia' } },
  ],
};

// ---------------------------------------------------------------- conquistas

const hasRarity = (pr, rarity) => Object.keys(pr.dex).some(id => FISH_BY_ID[id] && FISH_BY_ID[id].rarity === rarity);
const ACHIEVEMENTS = [
  { id: 'p10',  name: 'Pescador Iniciante',  desc: 'Pesque 10 peixes',            reward: 100,   test: pr => pr.totalCaught >= 10 },
  { id: 'p50',  name: 'Pescador Experiente', desc: 'Pesque 50 peixes',            reward: 400,   test: pr => pr.totalCaught >= 50 },
  { id: 'p200', name: 'Mestre Pescador',     desc: 'Pesque 200 peixes',           reward: 1500,  test: pr => pr.totalCaught >= 200 },
  { id: 'p500', name: 'Lenda do Anzol',      desc: 'Pesque 500 peixes',           reward: 4000,  test: pr => pr.totalCaught >= 500 },
  { id: 'd10',  name: 'Colecionador',        desc: 'Registre 10 espécies',        reward: 300,   test: pr => Object.keys(pr.dex).length >= 10 },
  { id: 'd25',  name: 'Enciclopédia Viva',   desc: 'Registre 25 espécies',        reward: 1200,  test: pr => Object.keys(pr.dex).length >= 25 },
  { id: 'd45',  name: 'Coleção Completa',    desc: 'Registre todas as espécies',  reward: 10000, test: pr => Object.keys(pr.dex).length >= FISH.length },
  { id: 'raro', name: 'Olho Clínico',        desc: 'Pesque um peixe Raro',        reward: 200,   test: pr => hasRarity(pr, 'raro') },
  { id: 'epico', name: 'Sortudo',            desc: 'Pesque um peixe Épico',       reward: 600,   test: pr => hasRarity(pr, 'epico') },
  { id: 'lenda', name: 'Caçador de Lendas',  desc: 'Pesque um peixe Lendário',    reward: 2000,  test: pr => hasRarity(pr, 'lendario') },
  { id: 'mito',  name: 'Tocado pelo Mito',   desc: 'Pesque um peixe Mítico',      reward: 5000,  test: pr => hasRarity(pr, 'mitico') },
  { id: 'abismo', name: 'Encarou o Abismo',  desc: 'Pesque um peixe Abissal',     reward: 12000, test: pr => hasRarity(pr, 'abissal') },
  { id: 'big50', name: 'Pegou o Grandão',    desc: 'Pesque um peixe de 50 kg+',   reward: 500,   test: pr => Object.values(pr.dex).some(d => d.best >= 50) },
  { id: 'big200', name: 'Monstro Marinho',   desc: 'Pesque um peixe de 200 kg+',  reward: 2500,  test: pr => Object.values(pr.dex).some(d => d.best >= 200) },
];

function checkAchievements(p) {
  const pr = p.profile;
  for (const a of ACHIEVEMENTS) {
    if (pr.achv.includes(a.id) || !a.test(pr)) continue;
    pr.achv.push(a.id);
    pr.coins += a.reward;
    saveDirty = true;
    send(p.ws, 'toast', { text: `🏆 Conquista: ${a.name}! +${a.reward} 🪙` });
    broadcast('announce', { text: `🏆 ${p.name} conquistou "${a.name}"!`, rarity: 'epico' }, p.ws);
  }
}

const INVENTORY_CAP = 40;
const BITE_WINDOW_MS = 1500;
const DROP_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------- dia/noite + evento de sorte

const DAY_LEN = 1200; // 20 min por dia completo
let timeOffset = 0;   // deslocado pelos comandos de GM
let luckEvent = false, eventForced = false;
const GM_PASS = process.env.GM_PASS || null; // sem env var, o modo GM fica desativado

const dayPhase = () => ((Date.now() / 1000 + timeOffset) % DAY_LEN) / DAY_LEN; // 0..1
const isNight = () => { const p = dayPhase(); return p >= 0.60 && p < 0.95; };

function setLuckEvent(on, forced) {
  if (luckEvent === on) return;
  luckEvent = on; eventForced = !!forced;
  broadcast('event', { active: on });
  broadcast('announce', on
    ? { text: '🌙 MARÉ DE SORTE! Chance em dobro de peixes raros esta noite!', rarity: 'mitico' }
    : { text: 'A Maré de Sorte se dissipou...', rarity: 'comum' });
}
setInterval(() => {
  if (isNight() && !luckEvent && Math.random() < 0.06) setLuckEvent(true, false); // ~algumas noites
  if (!isNight() && luckEvent && !eventForced) setLuckEvent(false, false);
}, 30000);

// ---------------------------------------------------------------- círculos de evento no mar
// sempre há pelo menos 1 (máx 3); cada um tem peixes exclusivos

const EVENT_TYPES = {
  dourado:    { name: 'Mar Dourado',         color: '#ffd24a', boost: { raro: 2, lendario: 3 } },
  sombrio:    { name: 'Redemoinho Sombrio',  color: '#9a5aff', boost: { epico: 2.5, abissal: 3 } },
  arcoiris:   { name: 'Cardume Arco-Íris',   color: '#5ae0c8', boost: { raro: 2.5 }, biteFactor: 0.45 },
  nevoa:      { name: 'Névoa Fantasma',      color: '#cfd8e8', boost: { epico: 2.2 } },
  corais:     { name: 'Jardim de Corais',    color: '#ff8a5a', boost: { incomum: 2, lendario: 2 } },
  tempestade: { name: 'Tempestade Elétrica', color: '#7ad4ff', boost: { epico: 2.5 } },
  sereias:    { name: 'Berço das Sereias',   color: '#ff6ab8', boost: { lendario: 2, mitico: 4 } },
};

const eventZones = new Map();
let nextZoneId = 1;

function zonesView() {
  return [...eventZones.values()].map(z => ({
    id: z.id, type: z.type, name: EVENT_TYPES[z.type].name, color: EVENT_TYPES[z.type].color,
    x: z.x, y: z.y, r: z.r,
  }));
}

function spawnEventZone() {
  for (let i = 0; i < 300; i++) {
    const tx = 30 + (Math.random() * (WORLD.W - 60)) | 0;
    const ty = 30 + (Math.random() * (WORLD.H - 60)) | 0;
    if (MAP[ty * WORLD.W + tx] !== WORLD.T.DEEP) continue;
    if (WORLD.zoneAt(tx, ty) !== 'altomar') continue;
    const x = tx * WORLD.TILE, y = ty * WORLD.TILE;
    if ([...eventZones.values()].some(z => Math.hypot(z.x - x, z.y - y) < 500)) continue;
    const types = Object.keys(EVENT_TYPES);
    const z = { id: nextZoneId++, type: types[(Math.random() * types.length) | 0],
      x, y, r: (10 + Math.random() * 4) * WORLD.TILE,
      until: Date.now() + (6 + Math.random() * 6) * 60000 };
    eventZones.set(z.id, z);
    return z;
  }
  return null;
}

function tickEventZones() {
  let changed = false;
  const now = Date.now();
  for (const [id, z] of eventZones) if (now > z.until) { eventZones.delete(id); changed = true; }
  while (eventZones.size < 1) { if (spawnEventZone()) changed = true; else break; }
  if (eventZones.size < 3 && Math.random() < 0.18 && spawnEventZone()) changed = true;
  if (changed) broadcast('zones', { zones: zonesView() });
}
setInterval(tickEventZones, 15000);
spawnEventZone(); spawnEventZone();

function eventZoneAtPx(x, y) {
  for (const z of eventZones.values()) if (Math.hypot(z.x - x, z.y - y) <= z.r) return z;
  return null;
}

const xpForLevel = (lvl) => Math.floor(60 * Math.pow(lvl, 1.4));

// ---------------------------------------------------------------- persistência

let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch { profiles = {}; }

let saveDirty = false;
function saveProfiles() {
  if (!saveDirty) return;
  saveDirty = false;
  fs.writeFile(SAVE_FILE, JSON.stringify(profiles), (err) => {
    if (err) console.error('Erro ao salvar:', err.message);
  });
}
setInterval(saveProfiles, 10000);

function getProfile(name) {
  const p = profiles[name] || {};
  profiles[name] = {
    coins: p.coins || 0, xp: p.xp || 0, level: p.level || 1,
    rod: RODS[p.rod] ? p.rod : 'bambu',
    line: LINES[p.line] ? p.line : 'nylon',
    boat: BOATS[p.boat] ? p.boat : null,
    baits: { minhoca: 0, brilhante: 0, ...(p.baits || {}) },
    activeBait: p.activeBait || null,
    inventory: (p.inventory || []).filter(f => FISH_BY_ID[f.fishId]),
    dex: p.dex || {},               // fishId -> {n, best}
    quests: p.quests || {},         // npcId -> {idx, prog, zones:[]}
    achv: p.achv || [],             // conquistas desbloqueadas
    totalCaught: p.totalCaught || 0,
    bestCatch: p.bestCatch || null,
  };
  return profiles[name];
}

// ---------------------------------------------------------------- pesca

function rollFish(zone, luck, ev) {
  const pz = ZONE_WEIGHTS[zone] ? zone : 'altomar';
  const weights = { ...ZONE_WEIGHTS[pz] };
  if (ev && EVENT_TYPES[ev]) { // círculo de evento: raridades turbinadas
    for (const [r, mult] of Object.entries(EVENT_TYPES[ev].boost)) weights[r] *= mult;
  }
  weights.raro *= 1 + 0.35 * luck;
  weights.epico *= 1 + 0.5 * luck;
  weights.lendario *= 1 + 0.7 * luck;
  weights.mitico *= 1 + 0.8 * luck;
  weights.abissal *= 1 + luck;
  weights.lixo /= 1 + luck;
  if (luckEvent) { // 🌙 Maré de Sorte: 2x chance de peixes bons
    weights.raro *= 2; weights.epico *= 2; weights.lendario *= 2;
    weights.mitico *= 2; weights.abissal *= 2;
  }

  let total = 0;
  for (const r in weights) total += weights[r];
  let roll = Math.random() * total;
  let rarity = 'comum';
  for (const r in weights) { roll -= weights[r]; if (roll <= 0) { rarity = r; break; } }

  let pool = FISH.filter(f => f.rarity === rarity &&
    (f.zones[0] === '*' || f.zones.includes(pz) || (ev && f.zones.includes('ev:' + ev))));
  // dentro do círculo, os peixes exclusivos do evento têm prioridade
  if (ev) {
    const evPool = pool.filter(f => f.zones.includes('ev:' + ev));
    if (evPool.length && Math.random() < 0.65) pool = evPool;
  }
  if (!pool.length) pool = FISH.filter(f => f.rarity === 'comum' && f.zones.includes(pz));
  const spec = pool[Math.floor(Math.random() * pool.length)];
  const t = Math.random() * Math.random();
  const weight = +(spec.wmin + (spec.wmax - spec.wmin) * (1 - t)).toFixed(2);
  const wNorm = (weight - spec.wmin) / (spec.wmax - spec.wmin || 1);
  const value = Math.max(1, Math.round(spec.base * (0.6 + 0.9 * wNorm)));
  return { fishId: spec.id, name: spec.name, rarity, weight, value, zone };
}

// ---------------------------------------------------------------- HTTP

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate', // evita cliente velho no cache do navegador/Cloudflare
    });
    res.end(data);
  });
});

// ---------------------------------------------------------------- WebSocket

const wss = new WebSocketServer({ server: httpServer });
const players = new Map();
const drops = new Map(); // dropId -> {id, fish, x, y, by, t}
let nextId = 1, nextDropId = 1;

setInterval(() => { // expira drops antigos
  const now = Date.now();
  for (const [id, d] of drops) {
    if (now - d.t > DROP_TTL_MS) { drops.delete(id); broadcast('drop_del', { id }); }
  }
}, 30000);

function send(ws, type, data = {}) { if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data })); }
function broadcast(type, data = {}, exceptWs = null) {
  const msg = JSON.stringify({ type, ...data });
  for (const [ws] of players) if (ws !== exceptWs && ws.readyState === 1) ws.send(msg);
}

function publicState(p) {
  return { id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir,
    moving: p.moving, boat: p.boat, level: p.profile.level,
    rodT: p.profile.rod, lineT: p.profile.line, boatT: p.profile.boat, // equipamento visível ("ostentação")
    fishing: p.fishing ? p.fishing.phase : null, bobX: p.bobX, bobY: p.bobY };
}

function profileView(p) {
  const pr = p.profile;
  return { coins: pr.coins, xp: pr.xp, level: pr.level, xpNext: xpForLevel(pr.level),
    rod: pr.rod, line: pr.line, boat: pr.boat, baits: pr.baits, activeBait: pr.activeBait,
    inventory: pr.inventory, dex: pr.dex, quests: pr.quests, achv: pr.achv,
    totalCaught: pr.totalCaught, bestCatch: pr.bestCatch };
}

function gainXp(p, amount) {
  const pr = p.profile;
  pr.xp += amount;
  while (pr.xp >= xpForLevel(pr.level)) {
    pr.xp -= xpForLevel(pr.level);
    pr.level++;
    send(p.ws, 'levelup', { level: pr.level });
    broadcast('announce', { text: `⭐ ${p.name} subiu para o nível ${pr.level}!`, rarity: 'incomum' }, p.ws);
  }
}

function questProgress(pr, npcId) { // estado atual da quest ativa do npc
  const chain = QUESTS[npcId];
  const st = pr.quests[npcId] || (pr.quests[npcId] = { idx: 0, prog: 0, zones: [] });
  if (st.idx >= chain.length) return { st, q: null, done: false };
  const q = chain[st.idx];
  let prog = st.prog;
  if (q.type === 'dex') prog = Object.keys(pr.dex).length;
  if (q.type === 'zones') prog = st.zones.length;
  return { st, q, prog, done: prog >= q.need };
}

function onCatchQuests(p, fish) { // avança missões aceitas
  const pr = p.profile;
  for (const npcId in pr.quests) {
    const st = pr.quests[npcId];
    const chain = QUESTS[npcId];
    if (!chain || st.idx >= chain.length) continue;
    const q = chain[st.idx];
    if (!st.zones.includes(fish.zone)) st.zones.push(fish.zone);
    switch (q.type) {
      case 'count': st.prog++; break;
      case 'zone': if (fish.zone === q.zone) st.prog++; break;
      case 'species': if (fish.fishId === q.fish) st.prog++; break;
      case 'weight': if (fish.fishId === q.fish && fish.weight >= q.min) st.prog++; break;
      case 'rarity':
        if (RARITY_ORDER.indexOf(fish.rarity) >= RARITY_ORDER.indexOf(q.min)) st.prog++; break;
    }
    const { done } = questProgress(pr, npcId);
    if (done) send(p.ws, 'toast', { text: `📜 Missão concluída! Fale com ${WORLD.NPCS.find(n => n.id === npcId).name}.` });
  }
}

function clearFishing(p) {
  if (p.fishing && p.fishing.biteTimer) clearTimeout(p.fishing.biteTimer);
  if (p.fishing && p.fishing.windowTimer) clearTimeout(p.fishing.windowTimer);
  p.fishing = null; p.bobX = null; p.bobY = null;
}

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!player) {
      if (msg.type !== 'join') return;
      let name = String(msg.name || 'Pescador').trim().slice(0, 16) || 'Pescador';
      if ([...players.values()].some(p => p.name === name)) name += Math.floor(Math.random() * 90 + 10);

      player = { ws, id: nextId++, name, x: WORLD.SPAWN.x, y: WORLD.SPAWN.y, dir: 'down',
        moving: false, boat: false, profile: getProfile(name), fishing: null,
        bobX: null, bobY: null, lastChat: 0, gm: false };
      players.set(ws, player);
      saveDirty = true;

      send(ws, 'welcome', {
        id: player.id, name, you: profileView(player),
        players: [...players.values()].filter(p => p !== player).map(publicState),
        drops: [...drops.values()],
        timeOffset, dayLen: DAY_LEN, event: luckEvent, zones: zonesView(),
        catalog: { rods: RODS, lines: LINES, boats: BOATS, baits: BAITS, rarities: RARITIES,
          fish: FISH, quests: QUESTS,
          achievements: ACHIEVEMENTS.map(({ id, name, desc, reward }) => ({ id, name, desc, reward })) },
      });
      broadcast('player_join', { player: publicState(player) }, ws);
      broadcast('announce', { text: `🎣 ${name} chegou ao arquipélago!`, rarity: 'comum' }, ws);
      return;
    }

    const pr = player.profile;

    switch (msg.type) {
      case 'move': {
        player.x = Math.max(8, Math.min(WORLD.W * WORLD.TILE - 8, Number(msg.x) || player.x));
        player.y = Math.max(8, Math.min(WORLD.H * WORLD.TILE - 8, Number(msg.y) || player.y));
        player.dir = ['up', 'down', 'left', 'right'].includes(msg.dir) ? msg.dir : player.dir;
        player.moving = !!msg.moving;
        player.boat = !!msg.boat && !!pr.boat;
        if (player.fishing && msg.moving) clearFishing(player);
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'cast': {
        if (player.fishing) break;
        if (pr.inventory.length >= INVENTORY_CAP) { send(ws, 'toast', { text: 'Balde cheio! Venda ou solte peixes.' }); break; }
        const bx = Number(msg.bobX), by = Number(msg.bobY);
        if (!isWaterPx(bx, by)) { send(ws, 'toast', { text: 'Mire na água!' }); break; }
        if (Math.hypot(bx - player.x, by - player.y) > 5 * WORLD.TILE) break;
        player.bobX = bx; player.bobY = by;
        const zone = WORLD.zoneAt(Math.floor(bx / WORLD.TILE), Math.floor(by / WORLD.TILE));

        const bait = pr.activeBait && pr.baits[pr.activeBait] > 0 ? BAITS[pr.activeBait] : null;
        if (bait) { pr.baits[pr.activeBait]--; saveDirty = true; }
        const luck = RODS[pr.rod].luck + (bait ? bait.luckBonus : 0);
        const evz = eventZoneAtPx(bx, by);
        const evBite = evz && EVENT_TYPES[evz.type].biteFactor ? EVENT_TYPES[evz.type].biteFactor : 1;
        const delay = (2000 + Math.random() * 9000) * (bait ? bait.biteFactor : 1) * evBite;

        player.fishing = { phase: 'waiting', zone, luck, ev: evz ? evz.type : null, biteTimer: null, windowTimer: null, fish: null };
        player.fishing.biteTimer = setTimeout(() => {
          if (!player.fishing || player.fishing.phase !== 'waiting') return;
          player.fishing.phase = 'bite';
          player.fishing.fish = rollFish(zone, luck, player.fishing.ev);
          send(ws, 'bite', {});
          broadcast('player_state', { player: publicState(player) }, ws);
          player.fishing.windowTimer = setTimeout(() => {
            if (player.fishing && player.fishing.phase === 'bite') {
              clearFishing(player);
              send(ws, 'escaped', { reason: 'Demorou demais... o peixe fugiu!' });
              broadcast('player_state', { player: publicState(player) }, ws);
            }
          }, BITE_WINDOW_MS);
        }, delay);

        send(ws, 'cast_ok', { bobX: bx, bobY: by, zone, baits: pr.baits });
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'hook': {
        const f = player.fishing;
        if (!f) break;
        if (f.phase === 'waiting') {
          clearFishing(player);
          send(ws, 'escaped', { reason: 'Puxou cedo demais! Nada fisgado.' });
          broadcast('player_state', { player: publicState(player) }, ws);
          break;
        }
        if (f.phase !== 'bite') break;
        clearTimeout(f.windowTimer);
        f.phase = 'reeling';
        f.reelStart = Date.now();
        const rar = RARITIES[f.fish.rarity];
        send(ws, 'reel', { reelTime: rar.reelTime, speed: rar.speed,
          bar: RODS[pr.rod].bar, drain: LINES[pr.line].drain,
          rarity: f.fish.rarity, color: rar.color }); // pro minigame pintar o peixe
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'reel_done': {
        const f = player.fishing;
        if (!f || f.phase !== 'reeling') break;
        const elapsed = (Date.now() - f.reelStart) / 1000;
        const fish = f.fish;
        clearFishing(player);

        if (msg.success && elapsed >= RARITIES[fish.rarity].reelTime * 0.5) {
          pr.inventory.push(fish);
          pr.totalCaught++;
          const d = pr.dex[fish.fishId] || (pr.dex[fish.fishId] = { n: 0, best: 0 });
          d.n++; if (fish.weight > d.best) d.best = fish.weight;
          if (!pr.bestCatch || fish.value > pr.bestCatch.value) pr.bestCatch = fish;
          onCatchQuests(player, fish);
          gainXp(player, RARITIES[fish.rarity].xp);
          checkAchievements(player);
          saveDirty = true;
          send(ws, 'catch', { fish, you: profileView(player) });
          broadcast('player_catch', { id: player.id, name: player.name, fish }, ws);
          if (RARITY_ORDER.indexOf(fish.rarity) >= 3) {
            broadcast('announce', {
              text: `✨ ${player.name} pescou ${fish.name} (${RARITIES[fish.rarity].label}, ${fish.weight} kg) — ${WORLD.ZONE_NAMES[fish.zone]}!`,
              rarity: fish.rarity });
          }
        } else {
          send(ws, 'escaped', { reason: `O ${fish.name} escapou!` });
        }
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'cancel': clearFishing(player); broadcast('player_state', { player: publicState(player) }, ws); break;

      case 'talk': {
        const npc = WORLD.NPCS.find(n => n.id === msg.npc);
        if (!npc) break;
        if (Math.hypot(npc.tx * WORLD.TILE - player.x, npc.ty * WORLD.TILE - player.y) > 5 * WORLD.TILE) break;
        if (npc.role === 'shop') { send(ws, 'open_shop', { shop: 'itens' }); break; }
        if (npc.role === 'boatshop') { send(ws, 'open_shop', { shop: 'barcos' }); break; }
        const chain = QUESTS[npc.id];
        const { st, q, prog, done } = questProgress(pr, npc.id);
        if (!q) { send(ws, 'dialog', { npc: npc.name, text: 'Você já me ajudou com tudo. O arquipélago agradece, lenda!' }); break; }
        if (done) {
          pr.coins += q.reward.coins;
          gainXp(player, q.reward.xp);
          let extra = '';
          if (q.reward.rod && RODS[q.reward.rod] && RODS[q.reward.rod].luck > RODS[pr.rod].luck) {
            pr.rod = q.reward.rod;
            extra += `\n🎣 Você recebeu: ${RODS[q.reward.rod].name}!`;
            if (q.reward.rod === 'guardia') broadcast('announce', { text: `👑 ${player.name} conquistou a VARA DO GUARDIÃO!`, rarity: 'abissal' });
          } else if (q.reward.rod) extra += '\n(Você já tem uma vara melhor — leve moedas extras!) ';
          if (q.reward.line && LINES[q.reward.line] && LINES[q.reward.line].drain < LINES[pr.line].drain) {
            pr.line = q.reward.line;
            extra += `\n🧵 Você recebeu: ${LINES[q.reward.line].name}!`;
          }
          if (q.reward.bait) {
            pr.baits[q.reward.bait.id] = (pr.baits[q.reward.bait.id] || 0) + q.reward.bait.n;
            extra += `\n🪱 Você recebeu: ${BAITS[q.reward.bait.id].name} ×${q.reward.bait.n}!`;
          }
          st.idx++; st.prog = 0; st.zones = [];
          saveDirty = true;
          const next = chain[st.idx];
          send(ws, 'dialog', { npc: npc.name,
            text: `Missão cumprida! Tome ${q.reward.coins} moedas.${extra}` + (next ? `\n\nPróxima: ${next.text}` : '\n\nEra a última — obrigado!') });
          send(ws, 'bought', { you: profileView(player) });
          broadcast('player_state', { player: publicState(player) }, ws);
        } else {
          saveDirty = true; // aceitou a missão (estado criado)
          send(ws, 'dialog', { npc: npc.name, text: `${q.text}\n\nProgresso: ${prog}/${q.need}` });
          send(ws, 'bought', { you: profileView(player) });
        }
        break;
      }

      case 'drop': {
        const i = Number(msg.index);
        if (!(i >= 0 && i < pr.inventory.length)) break;
        const [fish] = pr.inventory.splice(i, 1);
        const drop = { id: nextDropId++, fish, x: Math.round(player.x), y: Math.round(player.y), by: player.name, t: Date.now() };
        drops.set(drop.id, drop);
        saveDirty = true;
        broadcast('drop_add', { drop });
        send(ws, 'bought', { you: profileView(player) });
        break;
      }

      case 'pickup': {
        const d = drops.get(Number(msg.id));
        if (!d) break;
        if (Math.hypot(d.x - player.x, d.y - player.y) > 3 * WORLD.TILE) break;
        if (pr.inventory.length >= INVENTORY_CAP) { send(ws, 'toast', { text: 'Balde cheio!' }); break; }
        drops.delete(d.id);
        pr.inventory.push(d.fish);
        saveDirty = true;
        broadcast('drop_del', { id: d.id });
        send(ws, 'toast', { text: `Pegou ${d.fish.name} (${d.fish.weight} kg) de ${d.by}!` });
        send(ws, 'bought', { you: profileView(player) });
        break;
      }

      case 'sell_all': {
        if (!pr.inventory.length) break;
        const total = pr.inventory.reduce((s, f) => s + f.value, 0);
        pr.coins += total;
        pr.inventory = [];
        saveDirty = true;
        send(ws, 'sold', { total, you: profileView(player) });
        break;
      }

      case 'buy': {
        const CATS = { rod: RODS, line: LINES, boat: BOATS, bait: BAITS };
        const cat = CATS[msg.kind];
        const item = cat && cat[msg.id];
        if (!item) break;
        if (msg.kind !== 'bait') {
          const cur = { rod: pr.rod, line: pr.line, boat: pr.boat }[msg.kind];
          if (cur === msg.id) break;
          if (pr.level < item.level) { send(ws, 'toast', { text: `Requer nível ${item.level}.` }); break; }
        }
        if (pr.coins < item.price) { send(ws, 'toast', { text: 'Moedas insuficientes!' }); break; }
        pr.coins -= item.price;
        if (msg.kind === 'rod') pr.rod = msg.id;
        else if (msg.kind === 'line') pr.line = msg.id;
        else if (msg.kind === 'boat') pr.boat = msg.id;
        else pr.baits[msg.id] = (pr.baits[msg.id] || 0) + item.pack;
        saveDirty = true;
        send(ws, 'bought', { you: profileView(player) });
        break;
      }

      case 'select_bait': {
        pr.activeBait = msg.bait in BAITS ? msg.bait : null;
        saveDirty = true;
        send(ws, 'bought', { you: profileView(player) });
        break;
      }

      case 'chat': {
        const now = Date.now();
        if (now - player.lastChat < 500) break;
        player.lastChat = now;
        const text = String(msg.text || '').slice(0, 120).trim();
        if (!text) break;

        // comandos de GM (não vão pro chat)
        if (text.startsWith('/')) {
          const [cmd, ...args] = text.slice(1).split(/\s+/);
          if (cmd === 'gm') {
            player.gm = !!GM_PASS && args.join(' ') === GM_PASS;
            send(ws, 'toast', { text: player.gm ? '👑 Modo GM ativado!' : 'Senha incorreta.' });
          } else if (!player.gm) {
            send(ws, 'toast', { text: 'Comando desconhecido.' });
          } else if (cmd === 'evento') {
            setLuckEvent(!luckEvent, true);
            send(ws, 'toast', { text: `Evento ${luckEvent ? 'ATIVADO' : 'desativado'}.` });
          } else if (cmd === 'noite' || cmd === 'dia') {
            const target = cmd === 'noite' ? 0.66 : 0.25;
            timeOffset = target * DAY_LEN - (Date.now() / 1000 % DAY_LEN);
            broadcast('time', { timeOffset });
            send(ws, 'toast', { text: `Agora é ${cmd}.` });
          } else if (cmd === 'moedas') {
            pr.coins += Number(args[0]) || 1000;
            saveDirty = true;
            send(ws, 'bought', { you: profileView(player) });
          } else {
            send(ws, 'toast', { text: 'Comandos: /evento /noite /dia /moedas <n>' });
          }
          break;
        }
        broadcast('chat', { name: player.name, text });
        break;
      }

      case 'enter_farol': {
        const IN = WORLD.INTERIOR, TL = WORLD.TILE;
        const inside = player.x > IN.x0 * TL && player.x < IN.x1 * TL && player.y > IN.y0 * TL && player.y < IN.y1 * TL;
        if (inside) { // sair
          player.x = WORLD.FAROL_DOOR.tx * TL + 8;
          player.y = (WORLD.FAROL_DOOR.ty + 1) * TL + 8;
        } else {
          const door = WORLD.FAROL_DOOR;
          if (Math.hypot(door.tx * TL + 8 - player.x, door.ty * TL - player.y) > 3 * TL) break;
          // só entra quem terminou TODAS as missões do arquipélago (ou GM)
          const pending = Object.keys(QUESTS).filter(id => id !== 'guardiao')
            .filter(id => !pr.quests[id] || pr.quests[id].idx < QUESTS[id].length);
          if (pending.length && !player.gm) {
            send(ws, 'dialog', { npc: 'Porta do Farol',
              text: `A porta está selada por uma força antiga...\n\n"Somente quem ajudou TODOS os moradores do arquipélago pode entrar."\n\nMissões pendentes: ${pending.length} morador(es) ainda precisam de você.` });
            break;
          }
          player.x = IN.spawnTx * TL + 8;
          player.y = IN.spawnTy * TL + 8;
        }
        clearFishing(player);
        player.boat = false;
        send(ws, 'teleport', { x: player.x, y: player.y });
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (player) {
      clearFishing(player);
      players.delete(ws);
      saveDirty = true;
      broadcast('player_leave', { id: player.id });
    }
  });
});

process.on('SIGINT', () => { saveDirty = true; saveProfiles(); setTimeout(() => process.exit(0), 200); });

httpServer.listen(PORT, () => console.log(`🎣 Lago Pixel v2 em http://localhost:${PORT}`));

// no plano free do Render a instância hiberna após 15 min sem tráfego;
// o auto-ping pela URL pública (via edge) mantém o jogo sempre acordado
if (process.env.RENDER_EXTERNAL_URL) {
  const https = require('https');
  setInterval(() => {
    https.get(process.env.RENDER_EXTERNAL_URL, (res) => res.resume()).on('error', () => {});
  }, 10 * 60 * 1000);
}
