// ============================================
// BOARD LOGIC & RENDERING
// ============================================

import { state } from './state.js';
import { posKey, parseKey, getDirDelta, getOppositeDir, rotateExits, getRotationLabel, getRunData, effectiveMaxHp, effectiveAttack, effectiveDefense } from './utils.js';
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

const TYPE_LABEL = { trap: 'Trap', heal: 'Heal', gold: 'Gold', equipment: 'Rune' };

const CLASS_GLYPH = { warrior: '⚔', cleric: '✚', rogue: '🗡', wizard: '🔮' };

const ART_FALLBACK = {
  warrior: 'linear-gradient(135deg,#8a3026 0%,#431711 55%,#1c0e0a 100%)',
  cleric: 'linear-gradient(135deg,#e8dcae 0%,#b5944a 45%,#3d3320 100%)',
  rogue: 'linear-gradient(135deg,#5e3a7a 0%,#2b1b3d 55%,#120d1e 100%)',
  wizard: 'linear-gradient(135deg,#17406b 0%,#0e2a4a 55%,#081426 100%)',
  monster: 'linear-gradient(135deg,#6b1d2a 0%,#33101a 55%,#150a10 100%)',
  trap: 'linear-gradient(135deg,#c67c2e 0%,#6b3d10 55%,#23150a 100%)',
  heal: 'linear-gradient(135deg,#2f8f4e 0%,#16522b 55%,#0a2413 100%)',
  gold: 'linear-gradient(135deg,#d4af37 0%,#6b4f0f 55%,#2a1c05 100%)',
  equipment: 'linear-gradient(135deg,#7d4bbf 0%,#3c2260 55%,#170d26 100%)'
};

const TYPE_GLYPH = { monster: '💀', trap: '⚠️', heal: '✚', gold: '🪙', equipment: '◆' };

function hpBarHtml(current, max) {
  const pct = max > 0 ? Math.max(0, Math.round(current / max * 100)) : 0;
  const color = pct > 50 ? '#53d769' : pct > 25 ? '#ffd700' : '#e94560';
  return `<div class="card-bar"><div class="card-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function statRowHtml(label, value, barHtml = '') {
  return `
    <div class="card-stat">
      <div class="stat-head"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>
      ${barHtml}
    </div>
  `;
}

function artSlotHtml(artKey, gradient, glyph) {
  return `
    <div class="card-art" style="background:${gradient}">
      <div class="art-glyph">${glyph}</div>
      <img class="card-art-img" src="images/cards/${artKey}.webp" alt="" onerror="this.remove()">
    </div>
  `;
}

function heroCardHtml(player, index) {
  const maxHp = effectiveMaxHp(player);
  const cls = player.class || 'hero';
  const runes = getRunData(player);
  const runeChips = Object.entries(RUNE_META)
    .filter(([key]) => runes[key] > 0)
    .map(([key, meta]) => `<span class="rune-chip" title="${meta.label}" style="color:${meta.color}">${meta.icon}${runes[key]}</span>`)
    .join('');
  const abilitiesLine = (player.abilities || [])
    .map(a => `${a.name} — ${abilityDescription(a)}`)
    .join('\n');
  const color = PLAYER_COLORS[index];
  const gradient = ART_FALLBACK[cls] || ART_FALLBACK.wizard;
  const glyph = CLASS_GLYPH[cls] || '◆';
  return `
    <div class="card-name" style="color:${color}">${player.name}</div>
    <div class="card-type">${cls.charAt(0).toUpperCase() + cls.slice(1)}</div>
    ${artSlotHtml(cls, gradient, glyph)}
    <div class="card-stats">
      ${statRowHtml('HP', `${player.currentHp}/${maxHp}`, hpBarHtml(player.currentHp, maxHp))}
      ${statRowHtml('ATK', effectiveAttack(player))}
      ${statRowHtml('DEF', effectiveDefense(player))}
    </div>
    <div class="card-runes">${runeChips || ''}</div>
    <div class="card-desc">${abilitiesLine || player.description || ''}</div>
    <div class="card-gold">🪙 ${player.gold}</div>
  `;
}

function encounterCardHtml(enc) {
  if (enc.type === 'monster') {
    const hp = enc.currentHp || enc.hp;
    const isBoss = enc.id && enc.id.includes('boss');
    return `
      <div class="card-name">${enc.name}${isBoss ? ' <span class="card-badge">BOSS</span>' : ''}</div>
      <div class="card-type">Monster</div>
      ${artSlotHtml(enc.id, ART_FALLBACK.monster, TYPE_GLYPH.monster)}
      <div class="card-stats">
        ${statRowHtml('HP', `${hp}/${enc.hp}`, hpBarHtml(hp, enc.hp))}
        ${statRowHtml('ATK', enc.attack)}
        ${statRowHtml('DEF', enc.defense)}
      </div>
      <div class="card-desc">${enc.description || ''}</div>
      <div class="card-gold">🪙 ${enc.gold || 0}</div>
    `;
  }
  const typeLabel = TYPE_LABEL[enc.type] || 'Encounter';
  const gradient = ART_FALLBACK[enc.type] || ART_FALLBACK.equipment;
  const glyph = TYPE_GLYPH[enc.type] || '◆';
  const goldLine = enc.type === 'gold' ? `<div class="card-gold">🪙 ${enc.value || 25}</div>` : '';
  return `
    <div class="card-name">${enc.name}</div>
    <div class="card-type"><span class="card-badge">${typeLabel}</span></div>
    ${artSlotHtml(enc.id, gradient, glyph)}
    <div class="card-stats">
      ${statRowHtml('Effect', encounterEffectLine(enc))}
    </div>
    <div class="card-desc">${enc.description || ''}</div>
    ${goldLine}
  `;
}

export function renderEncounter() {
  const modal = document.getElementById('encounter-modal');
  const heroSide = document.getElementById('hero-side');
  const encSide = document.getElementById('encounter-side');
  const vsDice = document.getElementById('vs-dice');
  const rollBtn = document.getElementById('roll-dice');
  const resolveBtn = document.getElementById('resolve-btn');
  const fightBtn = document.getElementById('fight-btn');
  const runBtn = document.getElementById('run-btn');

  const hideAll = () => {
    rollBtn.classList.add('hidden');
    resolveBtn.classList.add('hidden');
    fightBtn.classList.add('hidden');
    runBtn.classList.add('hidden');
    vsDice.classList.add('hidden');
    vsDice.innerHTML = '';
  };

  if (state.currentEncounter && (state.phase === 'resolve-encounter' || state.phase === 'encounter-choice')) {
    modal.classList.remove('hidden');
    hideAll();
    const enc = state.currentEncounter;
    const player = state.players[state.currentPlayer];
    const index = state.currentPlayer;

    heroSide.innerHTML = heroCardHtml(player, index);
    encSide.innerHTML = encounterCardHtml(enc);

    if (state.resolving) {
      if (state.combatResult) {
        vsDice.classList.remove('hidden');
        vsDice.innerHTML = `
          <div class="dice-white" title="Hero dice">⬥ ${state.combatResult.heroRoll}</div>
          <div class="dice-black" title="Monster dice">⬥ ${state.combatResult.monsterRoll}</div>
        `;
      }
    } else if (state.phase === 'encounter-choice') {
      fightBtn.classList.remove('hidden');
      runBtn.classList.remove('hidden');
    } else if (enc.type === 'monster' && !state.combatResult) {
      rollBtn.classList.remove('hidden');
    } else {
      resolveBtn.classList.remove('hidden');
      if (state.combatResult) {
        vsDice.classList.remove('hidden');
        vsDice.innerHTML = `
          <div class="dice-white" title="Hero dice">⬥ ${state.combatResult.heroRoll}</div>
          <div class="dice-black" title="Monster dice">⬥ ${state.combatResult.monsterRoll}</div>
        `;
      }
    }
  } else {
    modal.classList.add('hidden');
    heroSide.innerHTML = '';
    encSide.innerHTML = '';
    hideAll();
  }

  document.getElementById('turn-display').textContent = `Turn: ${state.turn}`;
  document.getElementById('player-display').textContent = `Player: ${state.currentPlayer + 1}`;
}

export function showFloatingNumbers(result) {
  const heroSide = document.getElementById('hero-side');
  const encSide = document.getElementById('encounter-side');

  const spawn = (side, className, text, left, top) => {
    const el = document.createElement('div');
    el.className = `floating-number ${className}`;
    el.textContent = text;
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
    side.appendChild(el);
  };

  if (result.heroHpDelta < 0) {
    spawn(heroSide, 'damage', result.heroHpDelta, 22, 24);
  } else if (result.heroHpDelta > 0) {
    spawn(heroSide, 'heal', `+${result.heroHpDelta}`, 22, 24);
  }

  if (result.monsterHpDelta < 0) {
    spawn(encSide, 'damage', result.monsterHpDelta, 22, 24);
  }

  if (result.goldDelta > 0) {
    spawn(heroSide, 'gold', `+${result.goldDelta}`, 79, 92);
  }

  if (result.runeStat) {
    const meta = RUNE_META[result.runeStat];
    if (meta) {
      spawn(heroSide, 'rune', `${meta.icon} +1`, 22, 51);
    }
  }
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
