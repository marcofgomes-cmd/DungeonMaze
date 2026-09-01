// ============================================
// BOARD LOGIC & RENDERING
// ============================================

import { state } from './state.js';
import { posKey, parseKey, getDirDelta, getOppositeDir, rotateExits, getRotationLabel, getRunData, effectiveMaxHp } from './utils.js';
import { PLAYER_COLORS } from './data.js';
import { abilityDescription } from './encounters.js';

const RUNE_META = {
  strength: { icon: '⚔', label: 'Rune of Strength', color: '#e94560' },
  defense: { icon: '🛡', label: 'Rune of Defense', color: '#00a8ff' },
  fortitude: { icon: '❤', label: 'Rune of Fortitude', color: '#53d769' }
};

function encounterEffectLine(enc) {
  switch (enc.type) {
    case 'trap': return `Damage: ${enc.damage || 2}`;
    case 'heal': return `Heals: ${enc.value || 5} HP`;
    case 'gold': return `Gold: ${enc.value || 25}`;
    case 'equipment': {
      const meta = RUNE_META[enc.stat];
      return meta ? `${meta.label.replace('Rune of ', '')} +${enc.value || 1}` : `Stat +${enc.value || 1}`;
    }
    default: return '';
  }
}

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

  if (tile.image) {
    const rotation = tile.rotation || 0;
    html += `<img class="tile-image" src="${tile.image}" alt="${tile.name}" style="transform: rotate(${rotation}deg)" onerror="this.style.display='none'">`;
  } else {
    html += `<div class="tile-center">${tile.name}</div>`;
  }

  if (tile.encounter) {
    const icon = tile.encounter.type === 'monster' ? '⚔'
      : tile.encounter.type === 'trap' ? '⚠'
      : tile.encounter.type === 'heal' ? '✚'
      : tile.encounter.type === 'gold' ? '$'
      : '◆';
    html += `<div class="tile-encounter ${tile.encounter.type}">${icon}</div>`;
  }

  if (playersHere.length > 0) {
    html += '<div class="players">';
    for (const p of playersHere) {
      const active = p.id === state.currentPlayer ? ' active' : '';
      html += `<div class="player-icon${active}" style="background:${PLAYER_COLORS[p.id]}">${p.name[0]}</div>`;
    }
    html += '</div>';
  }

  return html;
}

export function renderBoard() {
  hideEncounterInfo();
  const grid = document.getElementById('dungeon-grid');
  grid.innerHTML = '';

  const keys = Array.from(state.dungeon.keys()).map(parseKey);
  if (keys.length === 0) return;

  const minRow = Math.min(...keys.map(k => k.row)) - 1;
  const maxRow = Math.max(...keys.map(k => k.row)) + 1;
  const minCol = Math.min(...keys.map(k => k.col)) - 1;
  const maxCol = Math.max(...keys.map(k => k.col)) + 1;

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
        const activePlayer = state.players[state.currentPlayer];
        if (activePlayer && activePlayer.position.row === r && activePlayer.position.col === c) {
          div.classList.add('active-hero');
        }
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

  if (state.phase === 'run-selection') {
    renderRunOptions();
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
  document.querySelectorAll('.tile.can-move').forEach(el => el.classList.remove('can-move'));

  const player = state.players[state.currentPlayer];
  const emptyTiles = getAdjacentEmptyTiles(player.position.row, player.position.col);
  const grid = document.getElementById('dungeon-grid');
  const keys = Array.from(state.dungeon.keys()).map(parseKey);

  if (keys.length === 0) return;
  const minRow = Math.min(...keys.map(k => k.row)) - 1;
  const minCol = Math.min(...keys.map(k => k.col)) - 1;

  const currentTile = state.dungeon.get(posKey(player.position.row, player.position.col));
  const dirs = ['north', 'south', 'west', 'east'];
  for (const dir of dirs) {
    if (!currentTile[dir]) continue;
    const delta = getDirDelta(dir);
    const row = player.position.row + delta.row;
    const col = player.position.col + delta.col;
    if (state.dungeon.has(posKey(row, col))) {
      const tileEl = grid.querySelector(`.tile.explored[data-row="${row}"][data-col="${col}"]`);
      if (tileEl) tileEl.classList.add('can-move');
    }
  }

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

export function renderRunOptions() {
  document.querySelectorAll('.run-option').forEach(el => el.remove());

  const grid = document.getElementById('dungeon-grid');
  const keys = Array.from(state.dungeon.keys()).map(parseKey);
  if (keys.length === 0) return;
  const minRow = Math.min(...keys.map(k => k.row)) - 1;
  const minCol = Math.min(...keys.map(k => k.col)) - 1;

  for (const t of state.runTargets) {
    const div = document.createElement('div');
    div.className = 'run-option';
    div.style.position = 'absolute';
    div.style.left = `${(t.col - minCol) * 104}px`;
    div.style.top = `${(t.row - minRow) * 104}px`;
    div.style.width = '100px';
    div.style.height = '100px';
    div.innerHTML = '<div class="run-marker">&#8618;</div>';
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.onRunSelect === 'function') window.onRunSelect(t.row, t.col);
    });
    grid.appendChild(div);
  }
}

export function renderPreview() {
  const previewModal = document.getElementById('preview-modal');
  const preview = document.getElementById('room-preview');
  const rotateBtn = document.getElementById('rotate-btn');

  if (!state.currentTile || state.phase !== 'place-tile') {
    previewModal.classList.add('hidden');
    rotateBtn.classList.add('hidden');
    preview.innerHTML = '';
    return;
  }

  previewModal.classList.remove('hidden');
  rotateBtn.classList.remove('hidden');

  const rotated = rotateExits(state.currentTile, state.currentRotation);

  let html = `<div class="preview-tile" data-rotation="${state.currentRotation}">`;
  html += '<div class="tile-exits">';
  if (rotated.north) html += '<div class="exit north"></div>';
  if (rotated.south) html += '<div class="exit south"></div>';
  if (rotated.west) html += '<div class="exit west"></div>';
  if (rotated.east) html += '<div class="exit east"></div>';
  html += '</div>';
  if (state.currentTile.image) {
    html += `<img class="tile-image" src="${state.currentTile.image}" alt="${state.currentTile.name}" style="transform: rotate(${state.currentRotation}deg)">`;
  } else {
    html += `<div class="tile-center">${state.currentTile.name}</div>`;
  }
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
    const minRow = Math.min(...keys.map(k => k.row)) - 1;
    const minCol = Math.min(...keys.map(k => k.col)) - 1;

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
    const maxHp = effectiveMaxHp(player);
    const hpPct = maxHp > 0 ? Math.round(player.currentHp / maxHp * 100) : 0;
    const hpColor = hpPct > 50 ? '#53d769' : hpPct > 25 ? '#ffd700' : '#e94560';
    const runes = getRunData(player);
    const runeChips = Object.entries(RUNE_META)
      .filter(([key]) => runes[key] > 0)
      .map(([key, meta]) => `<span class="rune-chip" title="${meta.label}" style="color:${meta.color}">${meta.icon}${runes[key]}</span>`)
      .join('');
    div.innerHTML = `
      <div class="name" style="color:${PLAYER_COLORS[index]}">${player.name}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="stats"><span>HP</span><span>${player.currentHp}/${maxHp}</span></div>
      <div class="stats"><span>Gold</span><span>${player.gold}</span></div>
      <div class="rune-line">${runeChips || '<span class="no-runes">No runes</span>'}</div>
    `;
    div.addEventListener('click', () => openHeroDetailModal(index));
    container.appendChild(div);
  });
}

export function openHeroDetailModal(index) {
  const player = state.players[index];
  if (!player) return;
  const body = document.getElementById('hero-modal-body');
  const abilities = (player.abilities || []).map(a => `
    <div class="ability-entry"><strong>[${a.roll}] ${a.name}</strong>: ${abilityDescription(a)}</div>
  `).join('');
  const runes = getRunData(player);
  const maxHp = effectiveMaxHp(player);

  const statLine = (label, base, bonus) => {
    const bonusText = bonus > 0 ? `<span class="stat-bonus">+${bonus}</span>` : '';
    const valueHtml = `<span class="value">${base}${bonusText}</span>`;
    return `<div class="hero-detail-row"><span class="label">${label}</span>${valueHtml}</div>`;
  };

  const runeEntries = Object.entries(RUNE_META)
    .filter(([key]) => runes[key] > 0)
    .map(([key, meta]) => `<div class="hero-detail-rune" style="color:${meta.color}">${meta.icon} ${meta.label} x${runes[key]}</div>`)
    .join('');

  body.innerHTML = `
    <div class="hero-detail-name" style="color:${PLAYER_COLORS[index]}">${player.name}</div>
    <div class="hero-detail-grid">
      <div class="hero-detail-row"><span class="label">HP</span><span class="value">${player.currentHp}/${maxHp}</span></div>
      <div class="hero-detail-row"><span class="label">Gold</span><span class="value">${player.gold}</span></div>
      ${statLine('Attack', player.attack, runes.strength)}
      ${statLine('Defense', player.defense, runes.defense)}
      ${statLine('Max HP', player.hp, runes.fortitude)}
      <div class="hero-detail-row"><span class="label">Position</span><span class="value">(${player.position.row}, ${player.position.col})</span></div>
    </div>
    ${abilities ? `<div class="hero-detail-abilities"><div class="label">Abilities</div>${abilities}</div>` : ''}
    <div class="hero-detail-abilities"><div class="label">Runes</div>${runeEntries || '<div class="hero-detail-rune">None</div>'}</div>
  `;
  document.getElementById('hero-modal').classList.remove('hidden');
}

export function closeHeroDetailModal() {
  document.getElementById('hero-modal').classList.add('hidden');
}

export function renderEncounter() {
  const modal = document.getElementById('encounter-modal');
  const card = document.getElementById('encounter-card');
  const rollBtn = document.getElementById('roll-dice');
  const diceResult = document.getElementById('dice-result');
  const resolveBtn = document.getElementById('resolve-btn');
  const fightBtn = document.getElementById('fight-btn');
  const runBtn = document.getElementById('run-btn');

  const resetCombatButtons = () => {
    rollBtn.classList.add('hidden');
    resolveBtn.classList.add('hidden');
    diceResult.classList.add('hidden');
    diceResult.innerHTML = '';
  };

  if (state.currentEncounter && (state.phase === 'resolve-encounter' || state.phase === 'encounter-choice')) {
    modal.classList.remove('hidden');
    const enc = state.currentEncounter;
    const player = state.players[state.currentPlayer];
    const hpDisplay = enc.type === 'monster'
      ? `HP: ${enc.currentHp || enc.hp}/${enc.hp} | ATK: ${enc.attack} | DEF: ${enc.defense}`
      : encounterEffectLine(enc);

    card.innerHTML = `
      <h3>${enc.name}</h3>
      <p>${enc.description || ''}</p>
      <div class="stats">${hpDisplay}</div>
    `;

    if (state.phase === 'encounter-choice') {
      fightBtn.classList.remove('hidden');
      runBtn.classList.remove('hidden');
      resetCombatButtons();
    } else {
      fightBtn.classList.add('hidden');
      runBtn.classList.add('hidden');
      if (enc.type === 'monster') {
        if (!state.combatResult) {
          rollBtn.classList.remove('hidden');
          resolveBtn.classList.add('hidden');
          diceResult.classList.add('hidden');
          diceResult.innerHTML = '';
        } else {
          rollBtn.classList.add('hidden');
          resolveBtn.classList.remove('hidden');
          diceResult.classList.remove('hidden');
          diceResult.innerHTML = `
            <div class="dice-white" title="Hero dice">⬥ ${state.combatResult.heroRoll}</div>
            <div class="dice-black" title="Monster dice">⬥ ${state.combatResult.monsterRoll}</div>
          `;
        }
      } else {
        resolveBtn.classList.remove('hidden');
        rollBtn.classList.add('hidden');
        diceResult.classList.add('hidden');
        diceResult.innerHTML = '';
      }
    }
  } else {
    modal.classList.add('hidden');
    card.innerHTML = '<p>No current encounter</p>';
    resetCombatButtons();
    fightBtn.classList.add('hidden');
    runBtn.classList.add('hidden');
  }

  document.getElementById('turn-display').textContent = `Turn: ${state.turn}`;
  document.getElementById('player-display').textContent = `Player: ${state.currentPlayer + 1}`;
}

export function showEncounterInfo(e, encounter) {
  const popup = document.getElementById('encounter-info-popup');
  if (!popup) return;

  let html = '';
  if (encounter.type === 'monster') {
    const isBoss = encounter.id && encounter.id.includes('boss');
    const hp = encounter.currentHp || encounter.hp;
    const hpPct = encounter.hp > 0 ? Math.round(hp / encounter.hp * 100) : 0;
    const hpColor = hpPct > 50 ? '#53d769' : hpPct > 25 ? '#ffd700' : '#e94560';
    html = `
      <div class="name">${encounter.name}${isBoss ? '<span class="popup-badge">BOSS</span>' : ''}</div>
      <div class="desc">${encounter.description || ''}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="stats"><span>HP</span><span>${hp}/${encounter.hp}</span></div>
      <div class="stats"><span>Attack</span><span>${encounter.attack}</span></div>
      <div class="stats"><span>Defense</span><span>${encounter.defense}</span></div>
      <div class="stats"><span>Gold</span><span>${encounter.gold || 0}</span></div>
    `;
  } else {
    const typeLabel = { trap: 'Trap', heal: 'Heal', gold: 'Gold', equipment: 'Equipment' }[encounter.type] || 'Encounter';
    html = `
      <div class="name">${encounter.name} <span class="popup-badge" style="background:#0f3460">${typeLabel}</span></div>
      <div class="desc">${encounter.description || ''}</div>
      <div class="effect">${encounterEffectLine(encounter)}</div>
    `;
  }
  popup.innerHTML = html;
  popup.classList.remove('hidden');

  const pad = 14;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const rect = popup.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x = Math.max(4, e.clientX - rect.width - pad);
  if (y + rect.height > window.innerHeight) y = Math.max(4, e.clientY - rect.height - pad);
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
}

export function hideEncounterInfo() {
  const popup = document.getElementById('encounter-info-popup');
  if (popup) popup.classList.add('hidden');
}

export function initEncounterHover() {
  const grid = document.getElementById('dungeon-grid');
  if (!grid) return;

  grid.addEventListener('mouseover', (e) => {
    const tileEl = e.target.closest ? e.target.closest('.tile.explored') : null;
    if (!tileEl) { hideEncounterInfo(); return; }
    const row = Number(tileEl.dataset.row);
    const col = Number(tileEl.dataset.col);
    const tile = state.dungeon.get(posKey(row, col));
    if (tile && tile.encounter) showEncounterInfo(e, tile.encounter);
    else hideEncounterInfo();
  });

  grid.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget;
    if (!related || !related.closest || !related.closest('.tile.explored')) {
      hideEncounterInfo();
    }
  });
}

export function render() {
  renderBoard();
  renderPreview();
  renderHeroes();
  renderEncounter();
}
