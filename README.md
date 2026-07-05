# 🎣 Lago Pixel

Jogo de pescaria multiplayer no navegador com visão aérea estilo Game Boy (Pokémon),
inspirado no mundo **Fish!** do VRChat. Explore um arquipélago de 5 ilhas, pesque
45 espécies, complete missões e navegue de barco.

## Rodar

```bash
cd ~/Claude/Fish
npm start
```

Abra `http://localhost:3000` (LAN: `http://<IP-do-Pi>:3000`).
Pra jogar pela internet: `cloudflared tunnel --url http://localhost:3000` (grátis, sem conta).

## Controles

| Tecla | Ação |
|---|---|
| WASD / setas | andar / navegar |
| ESPAÇO | lançar linha · fisgar no "!" · segurar no minigame |
| E | falar com NPC · loja · embarcar/desembarcar · pegar item do chão |
| I | balde (inventário) — botão "Soltar" dropa o peixe pra um amigo pegar |
| C | coleção de peixes (45 espécies, com recordes de peso) |
| Q | diário de missões |
| B | trocar isca |
| ENTER | chat |

## O arquipélago

- **Vila do Cais** — spawn, loja do Teodoro, missões da Beatriz
- **Geleira Branca** (NO) — peixes árticos, missões do Nanuk, empório do Iluq (iglus)
- **Duna Seca** (NE) — oásis no deserto, missões do Sheik Omar, bazar do Rashid (tendas)
- **Costa Dourada** (SE) — savana, missões do Adama, palhoça do Ayo
- **Ilha do Vulcão** (S) — cratera de lava, missões da Vulcana, forja da Magda
- **Alto-Mar** — entre as ilhas, só de barco, peixes grandes

Cada zona tem espécies próprias (comuns → lendárias). Barcos, varas, linhas e
iscas na loja do Teodoro, barcos no estaleiro do Capitão Nereu; progressão por nível/XP.

## Arquitetura

- `server.js` — Node.js + ws. Autoritativo: sorteios, inventário, moedas, missões.
- `public/world.js` — geração procedural determinística do mapa (servidor e cliente geram o mesmo mundo).
- `public/game.js` — renderização Canvas 2D, minigame, UI.
- `data/players.json` — progresso persistente por nome de jogador.
