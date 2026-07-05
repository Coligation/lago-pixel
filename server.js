// Lago Pixel v2 — servidor (visão aérea, ilhas, quests, coleção, drops, barcos)
// Autoritativo: sorteios, inventário, moedas, loja, missões e persistência.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const WORLD = require('./public/world.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SAVE_FILE = path.join(__dirname, 'data', 'players.json');

const MAP = WORLD.genWorld();
const NPC_SPOTS = {};
for (const n of WORLD.NPCS) NPC_SPOTS[n.id] = WORLD.npcWalkables(MAP, n);
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
  // tesouros das grutas secretas (não são pescáveis — só coletados nas cavernas)
  { id: 'moedaantiga', name: 'Moeda Antiga',      rarity: 'raro',     base: 160,  wmin: 0.1, wmax: 0.3, zones: ['tesouro'] },
  { id: 'perola',      name: 'Pérola do Abismo',  rarity: 'raro',     base: 240,  wmin: 0.1, wmax: 0.5, zones: ['tesouro'] },
  { id: 'cristal',     name: 'Cristal Marinho',   rarity: 'epico',    base: 650,  wmin: 0.5, wmax: 2.0, zones: ['tesouro'] },
  { id: 'ambar',       name: 'Âmbar Milenar',     rarity: 'epico',    base: 520,  wmin: 0.3, wmax: 1.5, zones: ['tesouro'] },
  { id: 'reliquia',    name: 'Relíquia Perdida',  rarity: 'lendario', base: 1600, wmin: 0.5, wmax: 3.0, zones: ['tesouro'] },
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
  bambu:     { name: 'Vara de Bambu',     price: 0,     level: 1,  luck: 0, bar: 80 },
  junco:     { name: 'Vara de Junco',     price: 250,   level: 2,  luck: 1, bar: 88 },  // bazar do deserto: barata, honesta
  fibra:     { name: 'Vara de Fibra',     price: 400,   level: 3,  luck: 1, bar: 100 },
  carbono:   { name: 'Vara de Carbono',   price: 2000,  level: 7,  luck: 2, bar: 115 },
  obsidiana: { name: 'Vara de Obsidiana', price: 5500,  level: 10, luck: 3, bar: 120 }, // forja do vulcão: sorte alta, barra média
  dourada:   { name: 'Vara Dourada',      price: 10000, level: 12, luck: 3, bar: 135 },
  guardia:   { name: 'Vara do Guardião',  price: 99999, level: 1,  luck: 5, bar: 155, secret: true }, // única, só na quest final
};
const LINES = {
  nylon:    { name: 'Linha de Nylon',    price: 0,    level: 1, drain: 1.0 },
  trancada: { name: 'Linha Trançada',    price: 600,  level: 4, drain: 0.75 },
  encerada: { name: 'Linha Encerada',    price: 1400, level: 6, drain: 0.65 }, // empório da geleira
  aco:      { name: 'Linha de Aço',      price: 3000, level: 9, drain: 0.55 },
};
const BOATS = {
  prancha: { name: 'Prancha de Remo', price: 300,   level: 2,  speed: 0.75, seats: 0 },
  remo:    { name: 'Barco a Remo',    price: 800,   level: 5,  speed: 1.0,  seats: 1 },
  lancha:  { name: 'Lancha',          price: 5000,  level: 10, speed: 1.9,  seats: 2 },
  veleiro: { name: 'Caravela',        price: 18000, level: 15, speed: 2.6,  seats: 3 },
};
const BAITS = {
  minhoca:   { name: 'Minhoca',         price: 25,  pack: 10, biteFactor: 0.5,  luckBonus: 0 },
  cupim:     { name: 'Cupim Dourado',   price: 60,  pack: 12, biteFactor: 0.35, luckBonus: 0 }, // savana: mordida relâmpago
  krill:     { name: 'Krill Congelado', price: 90,  pack: 8,  biteFactor: 0.6,  luckBonus: 1 }, // geleira
  brilhante: { name: 'Isca Brilhante',  price: 120, pack: 10, biteFactor: 0.7,  luckBonus: 1 },
  larva:     { name: 'Larva de Magma',  price: 300, pack: 6,  biteFactor: 0.8,  luckBonus: 2 }, // vulcão: premium
};

// estoque de cada vendedor — cada ilha tem seus achados
const SHOPS = {
  ze:     { title: '🐟 Peixe & Cia — Teodoro',     rods: ['bambu', 'fibra', 'carbono', 'dourada'], lines: ['nylon', 'trancada', 'aco'], baits: ['minhoca', 'brilhante'], boats: [] },
  nino:   { title: '⚓ Estaleiro do Capitão Nereu', rods: [], lines: [], baits: [], boats: ['prancha', 'remo', 'lancha', 'veleiro'] },
  iluq:   { title: '🧊 Empório Gelado do Iluq',     rods: [], lines: ['encerada'], baits: ['krill', 'minhoca'], boats: [] },
  rashid: { title: '🏜️ Bazar do Rashid',           rods: ['junco'], lines: ['nylon', 'trancada'], baits: ['minhoca', 'brilhante'], boats: [] },
  ayo:    { title: '🌾 Palhoça do Ayo',             rods: ['junco', 'fibra'], lines: [], baits: ['cupim', 'minhoca'], boats: [] },
  magda:  { title: '🌋 Forja da Magda',             rods: ['obsidiana'], lines: ['aco'], baits: ['larva'], boats: [] },
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
  ghDirty = true; // marca pro backup no GitHub também
  // escrita atômica: tmp + rename (processo morto no meio da escrita não trunca o save)
  fs.writeFile(SAVE_FILE + '.tmp', JSON.stringify(profiles), (err) => {
    if (err) return console.error('Erro ao salvar:', err.message);
    fs.rename(SAVE_FILE + '.tmp', SAVE_FILE, (err2) => {
      if (err2) console.error('Erro ao salvar (rename):', err2.message);
    });
  });
}
setInterval(saveProfiles, 10000);

// ---------------------------------------------------------------- backup no GitHub
// em hosts de disco efêmero (Render free), o progresso sobrevive num repo privado:
// carrega ao iniciar, salva a cada 3 min e no desligamento (SIGTERM do deploy)

const GH_TOKEN = process.env.GH_TOKEN || null;
const GH_REPO = process.env.GH_SAVES_REPO || null; // ex: "usuario/lago-pixel-saves"
let ghSha = null, ghBusy = false, ghDirty = false;

function ghApi(method, urlPath, body) {
  return fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github+json',
      'User-Agent': 'lago-pixel-server' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function ghLoad() {
  if (!GH_TOKEN || !GH_REPO) return;
  try {
    const res = await ghApi('GET', `/repos/${GH_REPO}/contents/players.json`);
    if (res.status === 404) { console.log('💾 GitHub: nenhum save ainda (primeiro boot).'); return; }
    if (!res.ok) { console.error('💾 GitHub: falha ao carregar saves:', res.status); return; }
    const j = await res.json();
    ghSha = j.sha;
    const data = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
    if (data && typeof data === 'object') {
      profiles = data;
      console.log(`💾 GitHub: ${Object.keys(profiles).length} jogador(es) restaurado(s).`);
    }
  } catch (e) { console.error('💾 GitHub: erro ao carregar:', e.message); }
}

async function ghBackup() {
  if (!GH_TOKEN || !GH_REPO || ghBusy || !ghDirty) return;
  ghBusy = true; ghDirty = false;
  try {
    const body = {
      message: `backup — ${Object.keys(profiles).length} jogador(es)`,
      content: Buffer.from(JSON.stringify(profiles)).toString('base64'),
    };
    if (ghSha) body.sha = ghSha;
    let res = await ghApi('PUT', `/repos/${GH_REPO}/contents/players.json`, body);
    if (res.status === 409 || res.status === 422) { // sha desatualizado → busca e tenta 1x
      const cur = await ghApi('GET', `/repos/${GH_REPO}/contents/players.json`);
      if (cur.ok) {
        body.sha = (await cur.json()).sha;
        res = await ghApi('PUT', `/repos/${GH_REPO}/contents/players.json`, body);
      }
    }
    if (res.ok) ghSha = (await res.json()).content.sha;
    else { console.error('💾 GitHub: backup falhou:', res.status); ghDirty = true; }
  } catch (e) { console.error('💾 GitHub: erro no backup:', e.message); ghDirty = true; }
  ghBusy = false;
}
setInterval(ghBackup, 3 * 60 * 1000);

// ---------------------------------------------------------------- conta (senha com scrypt, nunca em texto puro)

function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pass, salt, 32).toString('hex');
}
function checkPass(pass, stored) {
  try {
    const [salt, h] = String(stored).split(':');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pass, salt, 32));
  } catch { return false; }
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NICK_RE = /^[\p{L}\p{N} _.-]{3,16}$/u;

function getProfile(name) {
  const p = profiles[name] || {};
  profiles[name] = {
    auth: p.auth || null, // { email, pass(hash), news, termsAt, token }
    coins: p.coins || 0, xp: p.xp || 0, level: p.level || 1,
    rod: RODS[p.rod] ? p.rod : 'bambu',
    line: LINES[p.line] ? p.line : 'nylon',
    boat: BOATS[p.boat] ? p.boat : null,
    // posse de equipamento (pra poder alternar o que está equipado)
    rods: [...new Set(['bambu', ...(Array.isArray(p.rods) ? p.rods : []), RODS[p.rod] ? p.rod : 'bambu'])].filter(r => RODS[r]),
    lines: [...new Set(['nylon', ...(Array.isArray(p.lines) ? p.lines : []), LINES[p.line] ? p.line : 'nylon'])].filter(l => LINES[l]),
    boats: [...new Set([...(Array.isArray(p.boats) ? p.boats : []), ...(BOATS[p.boat] ? [p.boat] : [])])].filter(b => BOATS[b]),
    baits: { minhoca: 0, brilhante: 0, ...(p.baits || {}) },
    activeBait: p.activeBait || null,
    inventory: (p.inventory || []).filter(f => FISH_BY_ID[f.fishId]),
    dex: p.dex || {},               // fishId -> {n, best}
    quests: p.quests || {},         // npcId -> {idx, prog, zones:[]}
    achv: p.achv || [],             // conquistas desbloqueadas
    color: Number.isFinite(p.color) ? p.color : null, // cor da roupa
    totalCaught: p.totalCaught || 0,
    bestCatch: p.bestCatch || null,
    // rastro de presença (pro painel /admin)
    firstSeen: p.firstSeen || null,
    lastSeen: p.lastSeen || null,
    sessions: p.sessions || 0,
    playMin: p.playMin || 0,
    hist: Array.isArray(p.hist) ? p.hist : [], // últimas sessões {in, out}
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

// painel do administrador: /admin?pass=SENHA_DE_GM — lista jogadores e sessões
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function adminPage() {
  const fmt = (t) => t ? new Date(t).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const online = new Set([...players.values()].map((p) => p.name));
  const entries = Object.entries(profiles).sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
  const rows = entries.map(([name, p]) => {
    const hist = (p.hist || []).slice(-8).reverse()
      .map((h) => `${fmt(h.in)} → ${fmt(h.out)} <span class="dim">(${Math.max(1, Math.round((h.out - h.in) / 60000))} min)</span>`)
      .join('<br>');
    return `<tr>
      <td>${online.has(name) ? '🟢 ' : ''}<b>${esc(name)}</b></td>
      <td>${p.auth ? esc(p.auth.email) + (p.auth.news ? ' 📬' : '') : '<i class="dim">sem cadastro</i>'}</td>
      <td>${p.level || 1}</td>
      <td>${fmt(p.firstSeen)}</td><td>${fmt(p.lastSeen)}</td>
      <td>${p.sessions || 0}</td><td>${Math.round(p.playMin || 0)} min</td>
      <td class="hist">${hist || '—'}</td></tr>`;
  }).join('');
  const cad = entries.filter(([, p]) => p.auth).length;
  return `<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Lago Pixel — Admin</title>
<style>
 body { background:#101820; color:#dde; font-family:system-ui; padding:20px; }
 h1 { font-size:20px; } .dim { color:#89a; }
 table { border-collapse:collapse; width:100%; margin-top:12px; font-size:13px; }
 th, td { border:1px solid #2a4560; padding:6px 9px; text-align:left; vertical-align:top; }
 th { background:#16283a; color:#9fd6ff; } tr:nth-child(even) { background:rgba(255,255,255,.03); }
 .hist { font-size:11px; color:#abc; }
</style>
<h1>🎣 Lago Pixel — Jogadores</h1>
<p>${entries.length} conta(s) · ${cad} cadastrada(s) com email · ${online.size} online agora · gerado ${fmt(Date.now())}</p>
<table><tr><th>Nick</th><th>Email</th><th>Nível</th><th>1ª entrada</th><th>Última saída</th><th>Sessões</th><th>Tempo total</th><th>Últimas sessões (entrada → saída)</th></tr>${rows}</table>
<p class="dim">📬 = aceitou receber novidades · 🟢 = online · histórico guarda as últimas 20 sessões por jogador</p></html>`;
}

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/admin') {
    const pass = new URL(req.url, 'http://x').searchParams.get('pass');
    if (!GM_PASS || pass !== GM_PASS) { res.writeHead(403); return res.end('403'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(adminPage());
  }
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

// tesouros brotando nas grutas secretas
const TREASURE_TABLE = [['moedaantiga', 40], ['perola', 30], ['cristal', 14], ['ambar', 11], ['reliquia', 5]];
function rollTreasure() {
  let roll = Math.random() * 100;
  for (const [id, w] of TREASURE_TABLE) { roll -= w; if (roll <= 0) return FISH_BY_ID[id]; }
  return FISH_BY_ID.moedaantiga;
}
setInterval(() => {
  const TL = WORLD.TILE;
  for (const c of WORLD.CAVES) {
    const R = c.room;
    const inRoom = [...drops.values()].filter(d =>
      d.x > R.x0 * TL && d.x < R.x1 * TL && d.y > R.y0 * TL && d.y < R.y1 * TL);
    if (inRoom.length >= 3 || Math.random() > 0.55) continue;
    const spec = rollTreasure();
    const weight = +(spec.wmin + Math.random() * (spec.wmax - spec.wmin)).toFixed(2);
    const value = Math.round(spec.base * (0.8 + Math.random() * 0.5));
    const drop = {
      id: nextDropId++,
      fish: { fishId: spec.id, name: spec.name, rarity: spec.rarity, weight, value, zone: 'tesouro' },
      x: (R.x0 + 2 + Math.random() * (R.x1 - R.x0 - 4)) * TL,
      y: (R.y0 + 2 + Math.random() * (R.y1 - R.y0 - 4)) * TL,
      by: '✨', t: Date.now(),
    };
    drops.set(drop.id, drop);
    broadcast('drop_add', { drop });
  }
}, 45000);

function send(ws, type, data = {}) { if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data })); }
function broadcast(type, data = {}, exceptWs = null) {
  const msg = JSON.stringify({ type, ...data });
  for (const [ws] of players) if (ws !== exceptWs && ws.readyState === 1) ws.send(msg);
}

function publicState(p) {
  return { id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir,
    moving: p.moving, boat: p.boat, level: p.profile.level,
    rodT: p.profile.rod, lineT: p.profile.line, boatT: p.profile.boat, hue: p.profile.color, // equipamento e cor visíveis
    riding: p.riding || null, seat: p.seat || 0,
    fishing: p.fishing ? p.fishing.phase : null, bobX: p.bobX, bobY: p.bobY };
}

// ---------------------------------------------------------------- carona no barco

const ridersOf = (owner) => [...players.values()].filter(q => q.riding === owner.id);

function findLandNear(x, y) {
  for (let r = 1; r <= 6; r++) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const px = x + dx * r * WORLD.TILE, py = y + dy * r * WORLD.TILE;
      if (WORLD.WALK_OK.has(tileAt(px, py))) return { x: px, y: py };
    }
  }
  return { x: WORLD.SPAWN.x, y: WORLD.SPAWN.y };
}

function dismount(p, nearX, nearY) {
  if (!p.riding) return;
  p.riding = null; p.seat = 0;
  const spot = findLandNear(nearX !== undefined ? nearX : p.x, nearY !== undefined ? nearY : p.y);
  p.x = spot.x; p.y = spot.y;
  clearFishing(p);
  send(p.ws, 'ride_end', { x: p.x, y: p.y });
  broadcast('player_state', { player: publicState(p) }, p.ws);
}

function dropRiders(owner) {
  for (const r of ridersOf(owner)) {
    dismount(r);
    send(r.ws, 'toast', { text: '⚓ O dono do barco atracou.' });
  }
}

function profileView(p) {
  const pr = p.profile;
  return { coins: pr.coins, xp: pr.xp, level: pr.level, xpNext: xpForLevel(pr.level),
    rod: pr.rod, line: pr.line, boat: pr.boat, baits: pr.baits, activeBait: pr.activeBait,
    rods: pr.rods, lines: pr.lines, boats: pr.boats,
    inventory: pr.inventory, dex: pr.dex, quests: pr.quests, achv: pr.achv, color: pr.color,
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
      const name = String(msg.name || '').trim().slice(0, 16);
      if (!NICK_RE.test(name)) { send(ws, 'auth_error', { text: 'Nick inválido — use 3 a 16 letras/números.' }); return; }
      const existing = profiles[name];
      const hasAuth = !!(existing && existing.auth && existing.auth.pass);

      if (msg.register) {
        // criar conta (ou reivindicar conta antiga sem senha, mantendo o progresso)
        if (hasAuth) { send(ws, 'auth_error', { text: 'Esse nick já tem dono. Faça login ou escolha outro.' }); return; }
        const r = msg.register;
        const email = String(r.email || '').trim().toLowerCase().slice(0, 80);
        const pass = String(r.pass || '');
        if (r.terms !== true) { send(ws, 'auth_error', { text: 'É preciso aceitar os termos e condições.' }); return; }
        if (!EMAIL_RE.test(email)) { send(ws, 'auth_error', { text: 'Email inválido.' }); return; }
        if (pass.length < 6 || pass.length > 64) { send(ws, 'auth_error', { text: 'A senha precisa ter pelo menos 6 caracteres.' }); return; }
        const prof = getProfile(name);
        prof.auth = { email, pass: hashPass(pass), news: r.news === true,
          termsAt: Date.now(), token: crypto.randomBytes(24).toString('hex') };
        saveDirty = true;
      } else {
        if (!hasAuth) { send(ws, 'need_register', { name, legacy: !!existing }); return; }
        const okToken = msg.token && msg.token === existing.auth.token;
        const okPass = msg.pass && checkPass(String(msg.pass), existing.auth.pass);
        if (!okToken && !okPass) {
          send(ws, 'auth_error', { text: msg.token ? 'Sessão expirada — entre com sua senha.' : 'Senha incorreta.' });
          return;
        }
      }

      // mesma conta já online? a sessão nova assume (derruba a antiga)
      for (const [ows, op] of players) {
        if (op.name === name) { send(ows, 'auth_error', { text: 'Você entrou em outro aparelho.' }); ows.close(); }
      }

      player = { ws, id: nextId++, name, x: WORLD.SPAWN.x, y: WORLD.SPAWN.y, dir: 'down',
        moving: false, boat: false, profile: getProfile(name), fishing: null,
        bobX: null, bobY: null, lastChat: 0, gm: false, sessionStart: Date.now() };
      if (!player.profile.firstSeen) player.profile.firstSeen = player.sessionStart;
      players.set(ws, player);
      saveDirty = true;

      send(ws, 'welcome', {
        token: player.profile.auth.token,
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
        if (player.riding) break; // passageiro vai onde o barco vai
        const wasBoat = player.boat;
        player.x = Math.max(8, Math.min(WORLD.W * WORLD.TILE - 8, Number(msg.x) || player.x));
        player.y = Math.max(8, Math.min(WORLD.H * WORLD.TILE - 8, Number(msg.y) || player.y));
        player.dir = ['up', 'down', 'left', 'right'].includes(msg.dir) ? msg.dir : player.dir;
        player.moving = !!msg.moving;
        player.boat = !!msg.boat && !!pr.boat;
        if (player.fishing && msg.moving) clearFishing(player);
        broadcast('player_state', { player: publicState(player) }, ws);
        if (wasBoat && !player.boat) dropRiders(player); // atracou → todo mundo desce
        else if (player.boat) { // passageiros acompanham
          for (const r of ridersOf(player)) {
            const off = WORLD.SEAT_OFF[r.seat] || [0, 6];
            r.x = player.x + off[0]; r.y = player.y + off[1];
          }
        }
        break;
      }

      case 'board': {
        if (player.riding) { // quer descer
          const owner = [...players.values()].find(q => q.id === player.riding);
          dismount(player, owner ? owner.x : player.x, owner ? owner.y : player.y);
          break;
        }
        if (player.boat) break; // já está no próprio barco
        // procura um barco de outro jogador por perto com lugar livre
        let best = null, bd = 52;
        for (const q of players.values()) {
          if (q === player || !q.boat || !q.profile.boat) continue;
          const d = Math.hypot(q.x - player.x, q.y - player.y);
          if (d < bd) { bd = d; best = q; }
        }
        if (!best) { send(ws, 'toast', { text: 'Nenhum barco com lugar por perto.' }); break; }
        const seats = BOATS[best.profile.boat].seats;
        const taken = ridersOf(best).map(r => r.seat);
        if (taken.length >= seats) { send(ws, 'toast', { text: `O ${BOATS[best.profile.boat].name} de ${best.name} está lotado!` }); break; }
        let seat = 0;
        while (taken.includes(seat)) seat++;
        player.riding = best.id; player.seat = seat;
        clearFishing(player);
        const off = WORLD.SEAT_OFF[seat] || [0, 6];
        player.x = best.x + off[0]; player.y = best.y + off[1];
        send(ws, 'ride', { owner: best.id, seat });
        send(best.ws, 'toast', { text: `⛵ ${player.name} embarcou com você!` });
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'enter_cave': {
        if (player.riding) break;
        const TL = WORLD.TILE;
        let dest = null;
        for (const c of WORLD.CAVES) {
          const R = c.room;
          const inside = player.x > R.x0 * TL && player.x < R.x1 * TL && player.y > R.y0 * TL && player.y < R.y1 * TL;
          if (inside) { dest = { x: c.entrance.tx * TL + 8, y: (c.entrance.ty + 1) * TL + 8 }; break; }
          const E = c.entrance;
          if (Math.hypot(E.tx * TL + 8 - player.x, E.ty * TL + 8 - player.y) < 3 * TL) {
            dest = { x: R.spawnTx * TL + 8, y: R.spawnTy * TL + 8 };
            break;
          }
        }
        if (!dest) break;
        player.x = dest.x; player.y = dest.y;
        clearFishing(player);
        player.boat = false;
        send(ws, 'teleport', { x: player.x, y: player.y });
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
        const npcPos = WORLD.npcPosAt(NPC_SPOTS[npc.id], npc, Date.now());
        if (Math.hypot(npcPos.x - player.x, npcPos.y - player.y) > 6 * WORLD.TILE) break;
        if (npc.role === 'shop' || npc.role === 'boatshop') {
          const s = SHOPS[npc.id];
          if (!s) break;
          player.shopId = npc.id;
          send(ws, 'open_shop', { shopId: npc.id, title: s.title,
            stock: { rod: s.rods, line: s.lines, bait: s.baits, boat: s.boats } });
          break;
        }
        const chain = QUESTS[npc.id];
        const { st, q, prog, done } = questProgress(pr, npc.id);
        if (!q) { send(ws, 'dialog', { npc: npc.name, text: 'Você já me ajudou com tudo. O arquipélago agradece, lenda!' }); break; }
        if (done) {
          pr.coins += q.reward.coins;
          gainXp(player, q.reward.xp);
          let extra = '';
          if (q.reward.rod && RODS[q.reward.rod] && !pr.rods.includes(q.reward.rod)) {
            pr.rods.push(q.reward.rod);
            if (RODS[q.reward.rod].luck > RODS[pr.rod].luck) pr.rod = q.reward.rod;
            extra += `\n🎣 Você recebeu: ${RODS[q.reward.rod].name}!`;
            if (q.reward.rod === 'guardia') broadcast('announce', { text: `👑 ${player.name} conquistou a VARA DO GUARDIÃO!`, rarity: 'abissal' });
          } else if (q.reward.rod) extra += '\n(Vara repetida — leve as moedas!) ';
          if (q.reward.line && LINES[q.reward.line] && !pr.lines.includes(q.reward.line)) {
            pr.lines.push(q.reward.line);
            if (LINES[q.reward.line].drain < LINES[pr.line].drain) pr.line = q.reward.line;
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
        if (d.fish.zone === 'tesouro') { // tesouro conta pra coleção (peixe de amigo não)
          const dx = pr.dex[d.fish.fishId] || (pr.dex[d.fish.fishId] = { n: 0, best: 0 });
          dx.n++; if (d.fish.weight > dx.best) dx.best = d.fish.weight;
          checkAchievements(player);
        }
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
        // só compra o que a loja aberta realmente vende
        const shop = SHOPS[player.shopId];
        const stockKey = { rod: 'rods', line: 'lines', bait: 'baits', boat: 'boats' }[msg.kind];
        if (!shop || !shop[stockKey].includes(msg.id)) break;
        if (msg.kind !== 'bait') {
          const cur = { rod: pr.rod, line: pr.line, boat: pr.boat }[msg.kind];
          if (cur === msg.id) break;
          if (pr.level < item.level) { send(ws, 'toast', { text: `Requer nível ${item.level}.` }); break; }
        }
        if (pr.coins < item.price) { send(ws, 'toast', { text: 'Moedas insuficientes!' }); break; }
        // já tem? não deixa comprar duas vezes
        if ((msg.kind === 'rod' && pr.rods.includes(msg.id)) || (msg.kind === 'line' && pr.lines.includes(msg.id))
          || (msg.kind === 'boat' && pr.boats.includes(msg.id))) break;
        pr.coins -= item.price;
        if (msg.kind === 'rod') { pr.rods.push(msg.id); pr.rod = msg.id; }
        else if (msg.kind === 'line') { pr.lines.push(msg.id); pr.line = msg.id; }
        else if (msg.kind === 'boat') { pr.boats.push(msg.id); pr.boat = msg.id; }
        else pr.baits[msg.id] = (pr.baits[msg.id] || 0) + item.pack;
        saveDirty = true;
        send(ws, 'bought', { you: profileView(player) });
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'equip': { // troca o equipamento ativo (precisa possuir)
        const { kind, id } = msg;
        if (kind === 'boat' && id === null) { // desequipar barco (pra pegar carona)
          if (player.boat) { send(ws, 'toast', { text: 'Atraque na terra antes de guardar o barco!' }); break; }
          pr.boat = null;
        }
        else if (kind === 'rod' && pr.rods.includes(id)) pr.rod = id;
        else if (kind === 'line' && pr.lines.includes(id)) pr.line = id;
        else if (kind === 'boat' && pr.boats.includes(id)) pr.boat = id;
        else break;
        saveDirty = true;
        send(ws, 'bought', { you: profileView(player) });
        broadcast('player_state', { player: publicState(player) }, ws);
        break;
      }

      case 'select_bait': {
        pr.activeBait = msg.bait in BAITS ? msg.bait : null;
        saveDirty = true;
        send(ws, 'bought', { you: profileView(player) });
        break;
      }

      case 'set_color': { // cor da roupa (fica no save)
        const h = Number(msg.hue);
        pr.color = Number.isFinite(h) ? ((h % 360) + 360) % 360 : null;
        saveDirty = true;
        send(ws, 'bought', { you: profileView(player) });
        broadcast('player_state', { player: publicState(player) }, ws);
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
          } else if (cmd === 'nivel') {
            pr.level = Math.max(1, Math.min(99, parseInt(args[0]) || 1));
            pr.xp = 0;
            saveDirty = true;
            send(ws, 'bought', { you: profileView(player) });
            broadcast('player_state', { player: publicState(player) }, ws);
            send(ws, 'toast', { text: `Nível ajustado para ${pr.level}.` });
          } else {
            send(ws, 'toast', { text: 'Comandos: /evento /noite /dia /moedas <n> /nivel <n>' });
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
      const prf = player.profile, now = Date.now();
      if (player.sessionStart) { // registra a sessão (entrada → saída)
        prf.lastSeen = now;
        prf.sessions = (prf.sessions || 0) + 1;
        prf.playMin = +((prf.playMin || 0) + (now - player.sessionStart) / 60000).toFixed(1);
        prf.hist = [...(prf.hist || []), { in: player.sessionStart, out: now }].slice(-20);
      }
      dropRiders(player); // se era dono de barco com passageiros
      clearFishing(player);
      players.delete(ws);
      saveDirty = true;
      broadcast('player_leave', { id: player.id });
    }
  });
});

async function shutdown() {
  saveDirty = true;
  saveProfiles();
  ghDirty = true;
  await ghBackup(); // salva no GitHub antes de morrer (deploys enviam SIGTERM)
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
  await ghLoad(); // restaura os saves ANTES de aceitar jogadores
  httpServer.listen(PORT, () => console.log(`🎣 Lago Pixel v2 em http://localhost:${PORT}`));
})();

// no plano free do Render a instância hiberna após 15 min sem tráfego;
// o auto-ping pela URL pública (via edge) mantém o jogo sempre acordado
if (process.env.RENDER_EXTERNAL_URL) {
  const https = require('https');
  setInterval(() => {
    https.get(process.env.RENDER_EXTERNAL_URL, (res) => res.resume()).on('error', () => {});
  }, 10 * 60 * 1000);
}
