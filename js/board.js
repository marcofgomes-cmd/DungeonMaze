// ============================================
// BOARD LOGIC & RENDERING
// ============================================

import { state } from './state.js';
import { posKey, parseKey, getDirDelta, getOppositeDir, rotateExits, getRotationLabel } from './utils.js';
import { PLAYER_COLORS } from './data.js';

export function getAdjacentEmptyTiles(row, col) {
  const dirs = ['north', 'south', 'west', 'east'];
  const tile = state.dungeon.get(posKey(row, col));
  if (!tile) return [];

  const emptyTiles = [];
  for (const dir of dirs) {
    if (!tile[dir]) continue;
    const delta = getDirDelta(dir);
    const newRow = row + delta.row;
    const newCol = col + delta.col;
    const key = posKey(newRow, newCol);
    if (!state.dungeon.has(key)) {
      emptyTiles.push({ row: newRow, col: newCol, fromDir: dir });
    }
  }
  return emptyTiles;
}

export function canPlaceInDir(tile, rotation, targetRow, targetCol, fromDir) {
  const rotatedTile = rotateExits(tile, rotation);
  const requiredDir = getOppositeDir(fromDir);

  if (!rotatedTile[requiredDir]) return false;

  const dirs = ['north', 'south', 'west', 'east'];
  for (const checkDir of dirs) {
    if (checkDir === requiredDir) continue;

    const checkDelta = getDirDelta(checkDir);
    const checkRow = targetRow + checkDelta.row;
    const checkCol = targetCol + checkDelta.col;
    const checkKey = posKey(checkRow, checkCol);

    if (state.dungeon.has(checkKey)) {
      const neighbor = state.dungeon.get(checkKey);
      const neighborDir = getOppositeDir(checkDir);
      if (rotatedTile[checkDir] !== neighbor[neighborDir]) {
        return false;
      }
    }
  }

  return true;
}

export function findValidRotation(tile, targetRow, targetCol, fromDir) {
  for (let r = 0; r < 360; r += 90) {
    if (canPlaceInDir(tile, r, targetRow, targetCol, fromDir)) {
      return r;
    }
  }
  return null;
}

export function placeTile(tile, row, col, rotation) {
  const rotated = rotateExits(tile, rotation);
  state.dungeon.set(posKey(row, col), {
    ...tile,
    north: rotated.north,
    south: rotated.south,
    west: rotated.west,
    east: rotated.east,
    explored: true,
    rotation: rotation,
    encounter: null
  });
}

export function movePlayer(row, col) {
  state.players[state.currentPlayer].position = { row, col };
}

export function drawTile() {
  return state.roomDeck.pop() || null;
}

export function drawEncounterCard() {
  return state.encounterDeck.pop() || null;
}

export function renderTileContent(tile, row, col) {
  const playersHere = state.players.filter(p => p.position.row === row && p.position.col === col);

  let html = '<div class="tile-exits">';
  if (tile.north) html += '<div class="exit north"></div>';
  if (tile.south) html += '<div class="exit south"></div>';
  if (tile.west) html += '<div class="exit west"></div>';
  if (tile.east) html += '<div class="exit east"></div>';
  html += '</div>';

  html += `<div class="tile-center">${tile.name}</div>`;

  if (tile.encounter) {
    const icon = tile.encounter.type === 'monster' ? '⚔' : tile.encounter.type === 'event' ? '⚠' : '★';
    html += `<div class="tile-encounter ${tile.encounter.type}">${icon}</div>`;
  }

  if (playersHere.length > 0) {
    html += '<div class="players">';
    for (const p of playersHere) {
      html += `<div class="player-icon" style="background:${PLAYER_COLORS[p.id]}">${p.name[0]}</div>`;
    }
    html += '</div>';
  }

  return html;
}

export function renderBoard() {
  const grid = document.getElementById('dungeon-grid');
  grid.innerHTML = '';

  const keys = Array.from(state.dungeon.keys()).map(parseKey);
  if (keys.length === 0) return;

  const minRow = Math.min(...keys.map(k => k.row));
  const maxRow = Math.max(...keys.map(k => k.row));
  const minCol = Math.min(...keys.map(k => k.col));
  const maxCol = Math.max(...keys.map(k => k.col));

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  grid.style.gridTemplateColumns = `repeat(${cols}, 100px)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 100px)`;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const key = posKey(r, c);
      const tile = state.dungeon.get(key);
      const div = document.createElement('div');
      div.className = 'tile';
      div.dataset.row = r;
      div.dataset.col = c;

      if (tile) {
        div.classList.add('explored');
        if (tile.type === 'entrance') div.classList.add('entrance');
        div.innerHTML = renderTileContent(tile, r, c);
        div.addEventListener('click', () => {
          if (typeof window.onTileClick === 'function') window.onTileClick(r, c);
        });
      } else {
        div.classList.add('empty');
      }

      grid.appendChild(div);
    }
  }

  if (state.phase === 'place-tile' && state.currentTile) {
    renderPlacementOptions();
  }

  if (state.phase === 'move') {
    renderMovementOptions();
  }

  const roomDeckEl = document.getElementById('room-deck');
  const encDeckEl = document.getElementById('encounter-deck');
  roomDeckEl.textContent = `Room Deck (${state.roomDeck.length})`;
  encDeckEl.textContent = `Encounter Deck (${state.encounterDeck.length})`;
  roomDeckEl.classList.add('disabled');
  encDeckEl.classList.add('disabled');
}

export function renderMovementOptions() {
  document.querySelectorAll('.movement-option').forEach(el => el.remove());

  const player = state.players[state.currentPlayer];
  const emptyTiles = getAdjacentEmptyTiles(player.position.row, player.position.col);
  const grid = document.getElementById('dungeon-grid');
  const keys = Array.from(state.dungeon.keys()).map(parseKey);

  if (keys.length === 0) return;
  const minRow = Math.min(...keys.map(k => k.row));
  const minCol = Math.min(...keys.map(k => k.col));

  for (const t of emptyTiles) {
    const div = document.createElement('div');
    div.className = 'movement-option';
    div.style.position = 'absolute';
    div.style.left = `${(t.col - minCol) * 104}px`;
    div.style.top = `${(t.row - minRow) * 104}px`;
    div.style.width = '100px';
    div.style.height = '100px';
    div.innerHTML = '<div class="movement-marker">?</div>';
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.onExploreTile === 'function') window.onExploreTile(t.row, t.col, t.fromDir);
    });
    grid.appendChild(div);
  }
}

export function renderPreview() {
  const preview = document.getElementById('room-preview');
  const rotateBtn = document.getElementById('rotate-btn');

  if (!state.currentTile || state.phase !== 'place-tile') {
    preview.classList.add('hidden');
    rotateBtn.classList.add('hidden');
    return;
  }

  preview.classList.remove('hidden');
  rotateBtn.classList.remove('hidden');

  const rotated = rotateExits(state.currentTile, state.currentRotation);

  let html = `<div class="preview-tile" data-rotation="${state.currentRotation}">`;
  html += '<div class="tile-exits">';
  if (rotated.north) html += '<div class="exit north"></div>';
  if (rotated.south) html += '<div class="exit south"></div>';
  if (rotated.west) html += '<div class="exit west"></div>';
  if (rotated.east) html += '<div class="exit east"></div>';
  html += '</div>';
  html += `<div class="tile-center">${state.currentTile.name}</div>`;
  html += `<div class="preview-info">${getRotationLabel(state.currentRotation)}</div>`;
  html += '</div>';

  preview.innerHTML = html;
}

export function renderPlacementOptions() {
  document.querySelectorAll('.placement-option').forEach(el => el.remove());

  if (!state.currentTile || state.phase !== 'place-tile' || !state.moveTarget) return;

  const { row, col, fromDir } = state.moveTarget;
  if (canPlaceInDir(state.currentTile, state.currentRotation, row, col, fromDir)) {
    const grid = document.getElementById('dungeon-grid');
    const keys = Array.from(state.dungeon.keys()).map(parseKey);

    if (keys.length === 0) return;
    const minRow = Math.min(...keys.map(k => k.row));
    const minCol = Math.min(...keys.map(k => k.col));

    const div = document.createElement('div');
    div.className = 'placement-option';
    div.style.position = 'absolute';
    div.style.left = `${(col - minCol) * 104}px`;
    div.style.top = `${(row - minRow) * 104}px`;
    div.style.width = '100px';
    div.style.height = '100px';
    div.innerHTML = '<div class="placement-marker">+</div>';
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.onPlacementSelect === 'function') window.onPlacementSelect(row, col);
    });
    grid.appendChild(div);
  }
}

export function renderHeroes() {
  const container = document.getElementById('hero-list');
  container.innerHTML = '';

  state.players.forEach((player, index) => {
    const div = document.createElement('div');
    div.className = 'hero-card' + (index === state.currentPlayer ? ' active' : '');
    div.innerHTML = `
      <div class="name" style="color:${PLAYER_COLORS[index]}">${player.name}</div>
      <div class="stats">HP: ${player.currentHp}/${player.hp} | ATK: ${player.attack} | DEF: ${player.defense}</div>
    `;
    container.appendChild(div);
  });
}

export function renderEncounter() {
  const card = document.getElementById('encounter-card');
  const rollBtn = document.getElementById('roll-dice');
  const diceResult = document.getElementById('dice-result');
  const resolveBtn = document.getElementById('resolve-btn');

  if (state.currentEncounter) {
    const enc = state.currentEncounter;
    card.innerHTML = `
      <h3>${enc.name}</h3>
      <p>${enc.description || ''}</p>
      <div class="stats">
        ${enc.type === 'monster' ? `HP: ${enc.hp} | ATK: ${enc.attack} | DEF: ${enc.defense}` : `Effect: ${enc.effect}`}
      </div>
    `;

    if (state.phase === 'resolve-encounter') {
      if (enc.type === 'monster') {
        if (state.lastDiceRoll === null) {
          rollBtn.classList.remove('hidden');
          resolveBtn.classList.add('hidden');
          diceResult.classList.add('hidden');
        } else {
          rollBtn.classList.add('hidden');
          resolveBtn.classList.remove('hidden');
          diceResult.classList.remove('hidden');
        }
      } else {
        resolveBtn.classList.remove('hidden');
        rollBtn.classList.add('hidden');
        diceResult.classList.add('hidden');
      }
    } else {
      rollBtn.classList.add('hidden');
      resolveBtn.classList.add('hidden');
      diceResult.classList.add('hidden');
    }
  } else {
    card.innerHTML = '<p>No current encounter</p>';
    rollBtn.classList.add('hidden');
    resolveBtn.classList.add('hidden');
    diceResult.classList.add('hidden');
  }

  document.getElementById('turn-display').textContent = `Turn: ${state.turn}`;
  document.getElementById('player-display').textContent = `Player: ${state.currentPlayer + 1}`;
}

export function render() {
  renderBoard();
  renderPreview();
  renderHeroes();
  renderEncounter();
}
