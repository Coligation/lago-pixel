// Lago Pixel v3 — mundo compartilhado (servidor e cliente geram o MESMO mapa)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.WORLD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 800, H = 600, TILE = 16;

  const T = {
    DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, TALL: 4, TREE: 5, PALM: 6, CACTUS: 7,
    SAV: 8, ACACIA: 9, SNOW: 10, ICE: 11, ROCK: 12, VOLC: 13, LAVA: 14, PATH: 15,
    PLANK: 16, WALL: 17, FLOWER: 18, DOOR: 19, SAVTALL: 20, ROOF: 21, STONE: 22, FAROLBASE: 23, KIOSK: 24, CAVE: 25,
  };

  const WALK_OK = new Set([T.SAND, T.GRASS, T.TALL, T.SAV, T.SNOW, T.ICE, T.PATH, T.PLANK, T.FLOWER, T.SAVTALL, T.VOLC, T.STONE]);
  const BOAT_OK = new Set([T.DEEP, T.SHALLOW]);

  const ISLANDS = [
    { id: 'vila',    name: 'Vila do Cais',    cx: 200, cy: 300, r: 65, theme: 'grass',    zone: 'vila' },
    { id: 'farol',   name: 'Ilha do Farol',   cx: 400, cy: 300, r: 13, theme: 'rockisle', zone: 'farol' },
    { id: 'gelo',    name: 'Geleira Branca',  cx: 140, cy: 110, r: 40, theme: 'snow',     zone: 'gelo' },
    { id: 'deserto', name: 'Duna Seca',       cx: 620, cy: 120, r: 46, theme: 'desert',   zone: 'deserto' },
    { id: 'savana',  name: 'Costa Dourada',   cx: 640, cy: 470, r: 48, theme: 'savanna',  zone: 'savana' },
    { id: 'vulcao',  name: 'Ilha do Vulcão',  cx: 400, cy: 520, r: 42, theme: 'volcano',  zone: 'vulcao' },
  ];

  const ZONE_NAMES = {
    vila: 'Vila do Cais', gelo: 'Geleira Branca', deserto: 'Duna Seca',
    savana: 'Costa Dourada', vulcao: 'Ilha do Vulcão', farol: 'Ilha do Farol', altomar: 'Alto-Mar',
    tesouro: 'Grutas Secretas',
  };

  const NPCS = [
    { id: 'ze',       name: 'Teodoro',          role: 'shop',     island: 'vila', tx: 204, ty: 297 },
    { id: 'nino',     name: 'Capitão Nereu',    role: 'boatshop', island: 'vila', tx: 210, ty: 302 },
    { id: 'bia',      name: 'Beatriz',          role: 'quest', island: 'vila',    tx: 194, ty: 304 },
    { id: 'pedro',    name: 'Bartolomeu',       role: 'quest', island: 'vila',    tx: 246, ty: 304 },
    { id: 'ilo',      name: 'Ismael',           role: 'quest', island: 'farol',   tx: 397, ty: 304 },
    { id: 'nanuk',    name: 'Nanuk',            role: 'quest', island: 'gelo',    tx: 140, ty: 111 },
    { id: 'kira',     name: 'Kira',             role: 'quest', island: 'gelo',    tx: 150, ty: 121 },
    { id: 'omar',     name: 'Sheik Omar',       role: 'quest', island: 'deserto', tx: 620, ty: 121 },
    { id: 'zahra',    name: 'Zahra',            role: 'quest', island: 'deserto', tx: 610, ty: 131 },
    { id: 'adama',    name: 'Adama',            role: 'quest', island: 'savana',  tx: 640, ty: 471 },
    { id: 'kofi',     name: 'Kofi',             role: 'quest', island: 'savana',  tx: 652, ty: 461 },
    { id: 'vulcana',  name: 'Vulcana',          role: 'quest', island: 'vulcao',  tx: 408, ty: 523 },
    { id: 'brasa',    name: 'Bruno Brasa',      role: 'quest', island: 'vulcao',  tx: 392, ty: 528 },
    { id: 'guardiao', name: 'Guardião do Farol', role: 'quest', island: 'farol',  tx: 13,  ty: 11 },
  ];

  const SPAWN = { x: 200 * TILE, y: 306 * TILE };

  // sala secreta dentro do farol (canto NO do mapa, só via teleporte)
  const INTERIOR = { x0: 8, y0: 8, x1: 18, y1: 16, doorTx: 13, doorTy: 16, spawnTx: 13, spawnTy: 14 };
  const FAROL_DOOR = { tx: 400, ty: 301 }; // frente da torre

  // grutas secretas: entrada escondida na ilha → sala no canto do mapa com tesouros
  const CAVES = [
    { id: 'gvila',    name: 'Gruta da Mata',    entrance: { tx: 230, ty: 240 }, room: { x0: 30, y0: 8, x1: 42, y1: 17, doorTx: 36, doorTy: 17, spawnTx: 36, spawnTy: 15 } },
    { id: 'gdeserto', name: 'Caverna das Dunas', entrance: { tx: 604, ty: 103 }, room: { x0: 50, y0: 8, x1: 62, y1: 17, doorTx: 56, doorTy: 17, spawnTx: 56, spawnTy: 15 } },
    { id: 'gvulcao',  name: 'Toca de Magma',    entrance: { tx: 388, ty: 505 }, room: { x0: 70, y0: 8, x1: 82, y1: 17, doorTx: 76, doorTy: 17, spawnTx: 76, spawnTy: 15 } },
  ];

  // assentos dos passageiros nos barcos (deslocamento em px a partir do dono)
  const SEAT_OFF = [[-11, 3], [11, 3], [0, 8]];

  function h2(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = ((n ^ (n >>> 13)) * 1274126177) | 0;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967295;
  }

  function landDist(isl, x, y) {
    const dx = x - isl.cx, dy = y - isl.cy;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const w = 1 + 0.24 * Math.sin(a * 3 + isl.cx) + 0.14 * Math.sin(a * 7 + isl.cy) + 0.08 * Math.sin(a * 11 + isl.r);
    return d / (isl.r * w * 0.92);
  }

  function nearestIsland(tx, ty) {
    let best = null, bd = Infinity;
    for (const isl of ISLANDS) {
      const d = landDist(isl, tx, ty);
      if (d < bd) { bd = d; best = isl; }
    }
    return { isl: best, d: bd };
  }

  function zoneAt(tx, ty) {
    const { isl, d } = nearestIsland(tx, ty);
    return d < 1.7 ? isl.zone : 'altomar';
  }

  function genWorld() {
    const map = new Uint8Array(W * H).fill(T.DEEP);
    const islOf = new Uint8Array(W * H).fill(255);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.DEEP : map[y * W + x];
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) map[y * W + x] = t; };

    // 1) terra + base por tema (bounding box por ilha: o oceano sai de graça)
    const boxes = ISLANDS.map((isl, i) => ({ isl, i,
      x0: isl.cx - isl.r * 1.8, x1: isl.cx + isl.r * 1.8,
      y0: isl.cy - isl.r * 1.8, y1: isl.cy + isl.r * 1.8 }));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let bd = Infinity, bi = -1;
      for (const b of boxes) {
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
        const d = landDist(b.isl, x, y);
        if (d < bd) { bd = d; bi = b.i; }
      }
      if (bi < 0) continue;
      if (bd < 1) {
        islOf[y * W + x] = bi;
        const r = h2(x, y);
        switch (ISLANDS[bi].theme) {
          case 'grass':
            set(x, y, r < 0.09 ? T.TREE : r < 0.16 ? T.TALL : r < 0.20 ? T.FLOWER : T.GRASS); break;
          case 'snow':
            set(x, y, r < 0.08 ? T.TREE : r < 0.12 ? T.ROCK : T.SNOW); break;
          case 'desert':
            set(x, y, r < 0.06 ? T.CACTUS : r < 0.09 ? T.ROCK : r < 0.12 ? T.PALM : T.SAND); break;
          case 'savanna':
            set(x, y, r < 0.06 ? T.ACACIA : r < 0.14 ? T.SAVTALL : r < 0.16 ? T.ROCK : T.SAV); break;
          case 'volcano':
            set(x, y, r < 0.09 ? T.ROCK : T.VOLC); break;
          case 'rockisle':
            set(x, y, r < 0.14 ? T.ROCK : T.STONE); break;
        }
      } else if (bd < 1.28) {
        set(x, y, T.SHALLOW);
      }
    }

    // 2) faixa de praia (terra a até 2 tiles da água)
    const isWater = (t) => t === T.DEEP || t === T.SHALLOW;
    const coast = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = at(x, y);
      if (isWater(t)) continue;
      let c = false;
      for (let dy = -2; dy <= 2 && !c; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (isWater(at(x + dx, y + dy))) { c = true; break; }
      }
      if (c) coast.push(x, y);
    }
    for (let i = 0; i < coast.length; i += 2) {
      const x = coast[i], y = coast[i + 1];
      const bi = islOf[y * W + x];
      const theme = bi === 255 ? 'grass' : ISLANDS[bi].theme;
      set(x, y, theme === 'snow' ? T.ICE : theme === 'rockisle' ? T.STONE : T.SAND);
    }

    // 3) oásis no deserto e cratera de lava no vulcão
    const des = ISLANDS.find(i => i.id === 'deserto');
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      if (x * x + y * y <= 27) set(des.cx + x - 9, des.cy + y - 7, T.SHALLOW);
    }
    const vul = ISLANDS.find(i => i.id === 'vulcao');
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      if (x * x + y * y <= 21) set(vul.cx + x, vul.cy + y - 10, T.LAVA);
    }

    // 4) vila: praça, casas, ruas e cais
    const vila = ISLANDS.find(i => i.id === 'vila');
    const vx = vila.cx, vy = vila.cy;
    for (let y = vy - 12; y <= vy + 10; y++) for (let x = vx - 17; x <= vx + 17; x++) {
      if (!isWater(at(x, y))) set(x, y, T.GRASS);
    }
    const house = (hx, hy) => {
      for (let x = 0; x < 5; x++) { set(hx + x, hy, T.ROOF); set(hx + x, hy + 1, T.ROOF); }
      for (let x = 0; x < 5; x++) { set(hx + x, hy + 2, T.WALL); set(hx + x, hy + 3, T.WALL); }
      set(hx + 2, hy + 3, T.DOOR);
    };
    house(vx - 14, vy - 10); house(vx - 3, vy - 10); house(vx + 8, vy - 10);
    house(vx - 14, vy + 2); house(vx + 8, vy + 2);
    for (let y = vy - 4; y <= vy + 9; y++) set(vx, y, T.PATH);
    for (let x = vx - 12; x <= vx + 12; x++) set(x, vy - 3, T.PATH);
    // da praça até a praia: estrada de terra; só o trecho final (areia + mar) é deque de madeira
    let shoreX = vx;
    while (shoreX < W - 1 && !isWater(at(shoreX, vy + 4))) shoreX++;
    for (let x = vx + 2; x < shoreX - 5; x++) { set(x, vy + 4, T.PATH); set(x, vy + 5, T.PATH); }
    for (let x = shoreX - 5; x < shoreX + 9; x++) { set(x, vy + 4, T.PLANK); set(x, vy + 5, T.PLANK); }

    // 5) farol (torre 3x2 que bloqueia; o cliente desenha a torre por cima)
    const far = ISLANDS.find(i => i.id === 'farol');
    for (let y = -1; y <= 0; y++) for (let x = -1; x <= 1; x++) set(far.cx + x, far.cy + y, T.FAROLBASE);

    // 5b) quiosques: Zé (itens, na praça) e Nino (barcos, no começo do cais)
    for (let y = 295; y <= 296; y++) for (let x = 203; x <= 205; x++) set(x, y, T.KIOSK);
    for (let y = 300; y <= 301; y++) for (let x = 209; x <= 211; x++) set(x, y, T.KIOSK);

    // 5c) interior do farol (sala de pedra isolada no oceano NO)
    for (let y = INTERIOR.y0; y <= INTERIOR.y1; y++) for (let x = INTERIOR.x0; x <= INTERIOR.x1; x++) {
      const border = x === INTERIOR.x0 || x === INTERIOR.x1 || y === INTERIOR.y0 || y === INTERIOR.y1;
      set(x, y, border ? T.WALL : T.STONE);
    }
    set(INTERIOR.doorTx, INTERIOR.doorTy, T.DOOR);

    // 5d) grutas secretas: salas + entradas nas ilhas
    const GROUNDOF = (tx, ty) => ({ grass: T.GRASS, snow: T.SNOW, desert: T.SAND, savanna: T.SAV, volcano: T.VOLC, rockisle: T.STONE })[nearestIsland(tx, ty).isl.theme];
    for (const c of CAVES) {
      const R = c.room;
      for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
        const border = x === R.x0 || x === R.x1 || y === R.y0 || y === R.y1;
        set(x, y, border ? T.WALL : T.STONE);
      }
      set(R.doorTx, R.doorTy, T.DOOR);
      // boca da caverna com clareira ao redor
      const E = c.entrance;
      const ground = GROUNDOF(E.tx, E.ty);
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const t = at(E.tx + x, E.ty + y);
        if (t !== T.SHALLOW && t !== T.DEEP) set(E.tx + x, E.ty + y, ground);
      }
      set(E.tx, E.ty, T.CAVE);
    }

    // 6) clareira ao redor dos NPCs
    const GROUND = { grass: T.GRASS, snow: T.SNOW, desert: T.SAND, savanna: T.SAV, volcano: T.VOLC, rockisle: T.STONE };
    for (const n of NPCS) {
      const ground = GROUND[ISLANDS.find(i => i.id === n.island).theme];
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const t = at(n.tx + x, n.ty + y);
        if (t !== T.PLANK && t !== T.PATH && t !== T.SHALLOW && t !== T.DEEP && t !== T.FAROLBASE && t !== T.KIOSK) set(n.tx + x, n.ty + y, ground);
      }
    }

    return map;
  }

  // ---- passeio dos NPCs: determinístico pelo relógio → todos os clientes e o
  // servidor calculam a MESMA posição sem trocar mensagens

  // trajeto em linha reta 100% andável? (amostra a cada 4px — nada de NPC na água)
  function lineWalkable(map, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 4) + 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const t = map[Math.floor(y / TILE) * W + Math.floor(x / TILE)];
      if (!WALK_OK.has(t)) return false;
    }
    return true;
  }

  function npcWalkables(map, npc, radius = 4) {
    const hx = npc.tx * TILE + 8, hy = npc.ty * TILE + 8;
    const list = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const tx = npc.tx + dx, ty = npc.ty + dy;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      if (!WALK_OK.has(map[ty * W + tx])) continue;
      const px = tx * TILE + 8, py = ty * TILE + 8;
      if (lineWalkable(map, hx, hy, px, py)) list.push([px, py]); // só destinos com caminho livre
    }
    if (!list.length) list.push([hx, hy]);
    return list;
  }

  function npcPosAt(spots, npc, tms) {
    const hx = npc.tx * TILE + 8, hy = npc.ty * TILE + 8;
    if (npc.role !== 'quest') return { x: hx, y: hy, moving: false, dir: 'down' };
    const period = 9000; // sai de casa, observa, volta — sempre por linha verificada
    const seg = Math.floor(tms / period);
    const pick = (s) => s % 2 === 0 ? [hx, hy]
      : spots[(h2(npc.tx * 13 + s * 7, npc.ty * 11 + s * 3) * spots.length) | 0];
    const [x0, y0] = pick(seg), [x1, y1] = pick(seg + 1);
    const f = (tms % period) / period;
    const k = Math.min(1, f / 0.35);
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    const dir = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? (x1 < x0 ? 'left' : 'right') : (y1 < y0 ? 'up' : 'down');
    return { x, y, moving: k < 1 && (x1 !== x0 || y1 !== y0), dir };
  }

  return { W, H, TILE, T, WALK_OK, BOAT_OK, ISLANDS, NPCS, SPAWN, ZONE_NAMES, INTERIOR, FAROL_DOOR, CAVES, SEAT_OFF, genWorld, zoneAt, nearestIsland, h2, npcWalkables, npcPosAt };
});
