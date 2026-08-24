// ============================================
// DUNGEON MAZE - Complete Game
// ============================================

// --- DATA ---
let roomCards = [];
let encounterCards = [];
let heroesData = [];

const fallbackRoomCards = [
  { id: 'tile-entrance', name: 'Entrance', type: 'entrance', north: true, south: true, west: true, east: true, exit: false, quantity: 1 },
  { id: 'tile-corridor', name: 'Corridor', type: 'corridor', north: true, south: true, west: false, east: false, exit: false, quantity: 8 },
  { id: 'tile-dead-end', name: 'Dead End', type: 'dead-end', north: true, south: false, west: false, east: false, exit: false, quantity: 6 },
  { id: 'tile-corner', name: 'Corner', type: 'corner', north: true, south: false, west: false, east: true, exit: false, quantity: 8 },
  { id: 'tile-t-junction', name: 'T-Junction', type: 't-junction', north: true, south: false, west: true, east: true, exit: false, quantity: 6 },
  { id: 'tile-cross', name: 'Crossroads', type: 'cross', north: true, south: true, west: true, east: true, exit: false, quantity: 4 }
];

const fallbackEncounterCards = [
  { id: 'monster-001', name: 'Goblin', type: 'monster', hp: 5, attack: 3, defense: 1, description: 'Small creature.' },
  { id: 'monster-002', name: 'Skeleton', type: 'monster', hp: 8, attack: 4, defense: 2, description: 'Animated bones.' },
  { id: 'treasure-001', name: 'Health Potion', type: 'treasure', effect: 'heal', value: 10, description: 'Restores vitality.' },
  { id: 'treasure-002', name: 'Gold Coins', type: 'treasure', effect: 'gold', value: 25, description: 'Shimmering coins.' }
];

const fallbackHeroes = [
  { class: 'warrior', name: 'Warrior', hp: 30, attack: 8, defense: 5, magic: 2 },
  { class: 'wizard', name: 'Wizard', hp: 20, attack: 4, defense: 3, magic: 10 },
  { class: 'rogue', name: 'Rogue', hp: 25, attack: 7, defense: 3, magic: 3 },
  { class: 'cleric', name: 'Cleric', hp: 28, attack: 5, defense: 4, magic: 7 }
];

const PLAYER_COLORS = ['#e94560', '#53d769', '#ffd700', '#00a8ff'];

// --- GAME STATE ---
const state = {
  turn: 1,
  currentPlayer: 0,
  players: [],
  roomDeck: [],
  encounterDeck: [],
  dungeon: new Map(),
  currentTile: null,
  currentRotation: 0,
  currentEncounter: null,
  lastDiceRoll: null,
  phase: 'move',
  moveTarget: null,
  exploreDir: null
};

// --- UTILITY ---
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function expandDeckByQuantity(cards) {
  const expanded = [];
  for (const card of cards) {
    for (let i = 0; i < (card.quantity || 1); i++) {
      expanded.push({ ...card });
    }
  }
  return expanded;
}

function posKey(row, col) {
  return `${row},${col}`;
}

function parseKey(key) {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

function getOppositeDir(dir) {
  const opposites = { north: 'south', south: 'north', west: 'east', east: 'west' };
  return opposites[dir];
}

function getDirDelta(dir) {
  const deltas = {
    north: { row: -1, col: 0 },
    south: { row: 1, col: 0 },
    west: { row: 0, col: -1 },
    east: { row: 0, col: 1 }
  };
  return deltas[dir];
}

function rotateExits(tile, rotation) {
  const exits = { north: tile.north, south: tile.south, west: tile.west, east: tile.east };
  const dirs = ['north', 'east', 'south', 'west'];
  const times = ((rotation % 360) / 90) % 4;

  for (let i = 0; i < times; i++) {
    const newExits = {};
    for (const dir of dirs) {
      const idx = dirs.indexOf(dir);
      const prevDir = dirs[(idx + 3) % 4];
      newExits[dir] = exits[prevDir];
    }
    Object.assign(exits, newExits);
  }

  return exits;
}

function getRotationLabel(rotation) {
  const labels = { 0: '0°', 90: '90° CW', 180: '180°', 270: '90° CCW' };
  return labels[rotation] || `${rotation}°`;
}

function getAdjacentEmptyTiles(row, col) {
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

function canPlaceInDir(tile, rotation, targetRow, targetCol, fromDir) {
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

function findValidRotation(tile, targetRow, targetCol, fromDir) {
  for (let r = 0; r < 360; r += 90) {
    if (canPlaceInDir(tile, r, targetRow, targetCol, fromDir)) {
      return r;
    }
  }
  return null;
}

function log(message, type = 'hero') {
  const logContainer = document.getElementById('game-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  logContainer.insertBefore(entry, logContainer.firstChild);
  if (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// --- DATA LOADING ---
async function loadRoomCards() {
  try {
    const response = await fetch('data/room-cards.json');
    return await response.json();
  } catch {
    return fallbackRoomCards;
  }
}

async function loadEncounterCards() {
  try {
    const response = await fetch('data/encounter-cards.json');
    return await response.json();
  } catch {
    return fallbackEncounterCards;
  }
}

async function loadHeroes() {
  try {
    const response = await fetch('data/heroes.json');
    return await response.json();
  } catch {
    return fallbackHeroes;
  }
}

// --- GAME LOGIC ---
function initializeGame(rooms, encounters, heroList) {
  const roomsWithoutEntrance = rooms.filter(c => c.id !== 'tile-entrance');
  state.roomDeck = shuffle(expandDeckByQuantity(roomsWithoutEntrance));
  state.encounterDeck = shuffle(expandDeckByQuantity(encounters));

  state.players = heroList.map((hero, i) => ({
    id: i,
    ...hero,
    currentHp: hero.hp,
    position: { row: 0, col: 0 }
  }));

  state.dungeon = new Map();

  const entrance = {
    id: 'tile-entrance', name: 'Entrance', type: 'entrance',
    north: true, south: true, west: true, east: true,
    explored: true, encounter: null
  };
  state.dungeon.set(posKey(0, 0), entrance);
}

function placeTile(tile, row, col, rotation) {
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

function movePlayer(row, col) {
  state.players[state.currentPlayer].position = { row, col };
}

function drawTile() {
  return state.roomDeck.pop() || null;
}

function drawEncounterCard() {
  return state.encounterDeck.pop() || null;
}

function rollD20() {
  state.lastDiceRoll = Math.floor(Math.random() * 20) + 1;
  return state.lastDiceRoll;
}

function resolveEncounter() {
  if (!state.currentEncounter) return { message: 'No encounter.', type: 'hero' };

  if (state.currentEncounter.type === 'monster') {
    const player = state.players[state.currentPlayer];
    const monster = state.currentEncounter;
    const roll = state.lastDiceRoll || rollD20();
    const playerPower = player.attack + roll;
    const monsterPower = monster.attack + Math.floor(Math.random() * 10) + 1;

    if (playerPower > monsterPower) {
      player.currentHp = Math.min(player.hp, player.currentHp + 5);
      const pos = state.players[state.currentPlayer].position;
      const tile = state.dungeon.get(posKey(pos.row, pos.col));
      if (tile) tile.encounter = null;
      return { message: `Victory! Defeated ${monster.name}! +5 HP.`, type: 'treasure' };
    } else {
      const damage = Math.max(1, monster.attack - player.defense);
      player.currentHp -= damage;
      if (player.currentHp <= 0) {
        player.currentHp = player.hp;
        player.position = { row: 0, col: 0 };
        return { message: `Defeated by ${monster.name}! Teleported to entrance.`, type: 'monster' };
      }
      return { message: `Defeated by ${monster.name}. -${damage} HP.`, type: 'monster' };
    }
  } else {
    const player = state.players[state.currentPlayer];
    const treasure = state.currentEncounter;
    const pos = player.position;
    const tile = state.dungeon.get(posKey(pos.row, pos.col));
    if (tile) tile.encounter = null;

    if (treasure.effect === 'heal') {
      player.currentHp = Math.min(player.hp, player.currentHp + treasure.value);
      return { message: `Found ${treasure.name}! +${treasure.value} HP.`, type: 'treasure' };
    }
    return { message: `Found ${treasure.name}!`, type: 'treasure' };
  }
}

function nextTurn() {
  state.currentEncounter = null;
  state.lastDiceRoll = null;
  state.currentTile = null;
  state.currentRotation = 0;
  state.moveTarget = null;
  state.exploreDir = null;
  state.phase = 'move';
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  if (state.currentPlayer === 0) state.turn++;
}

// --- UI RENDERING ---
function renderBoard() {
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
        div.addEventListener('click', () => onTileClick(r, c));
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
  roomDeckEl.classList.toggle('disabled', true);
  encDeckEl.classList.toggle('disabled', state.phase !== 'draw-encounter');
}

function renderTileContent(tile, row, col) {
  const playersHere = state.players.filter(p => p.position.row === row && p.position.col === col);

  let html = '<div class="tile-exits">';
  if (tile.north) html += '<div class="exit north"></div>';
  if (tile.south) html += '<div class="exit south"></div>';
  if (tile.west) html += '<div class="exit west"></div>';
  if (tile.east) html += '<div class="exit east"></div>';
  html += '</div>';

  html += `<div class="tile-center">${tile.name}</div>`;

  if (tile.encounter) {
    html += `<div class="tile-encounter ${tile.encounter.type}">${tile.encounter.type === 'monster' ? '⚔' : '★'}</div>`;
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

function renderMovementOptions() {
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
      onExploreTile(t.row, t.col, t.fromDir);
    });
    grid.appendChild(div);
  }
}

function renderPreview() {
  const preview = document.getElementById('room-preview');
  const rotateBtn = document.getElementById('rotate-btn');
  const confirmBtn = document.getElementById('confirm-placement-btn');

  if (!state.currentTile || state.phase !== 'place-tile') {
    preview.classList.add('hidden');
    rotateBtn.classList.add('hidden');
    confirmBtn.classList.add('hidden');
    return;
  }

  preview.classList.remove('hidden');
  rotateBtn.classList.remove('hidden');
  confirmBtn.classList.remove('hidden');

  const rotated = rotateExits(state.currentTile, state.currentRotation);

  let html = '<div class="preview-tile">';
  html += '<div class="tile-exits">';
  if (rotated.north) html += '<div class="exit north"></div>';
  if (rotated.south) html += '<div class="exit south"></div>';
  if (rotated.west) html += '<div class="exit west"></div>';
  if (rotated.east) html += '<div class="exit east"></div>';
  html += '</div>';
  html += `<div class="tile-center">${state.currentTile.name}</div>`;
  html += '</div>';

  const dirLabel = state.exploreDir ? ` towards ${state.exploreDir}` : '';
  html += `<div class="preview-info">Rotation: ${getRotationLabel(state.currentRotation)}</div>`;
  preview.innerHTML = html;
}

function renderPlacementOptions() {
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
      onPlacementSelect(row, col);
    });
    grid.appendChild(div);
  }
}

function renderHeroes() {
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

function renderEncounter() {
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

    if (state.phase === 'resolve-encounter' && enc.type === 'monster') {
      rollBtn.classList.remove('hidden');
      resolveBtn.classList.remove('hidden');
    } else if (state.phase === 'resolve-encounter' && enc.type === 'treasure') {
      resolveBtn.classList.remove('hidden');
      rollBtn.classList.add('hidden');
    }
  } else {
    card.innerHTML = '<p>No current encounter</p>';
    rollBtn.classList.add('hidden');
    resolveBtn.classList.add('hidden');
  }

  if (state.lastDiceRoll !== null) {
    diceResult.textContent = `Rolled: ${state.lastDiceRoll}`;
    diceResult.classList.remove('hidden');
  } else {
    diceResult.classList.add('hidden');
  }

  document.getElementById('turn-display').textContent = `Turn: ${state.turn}`;
  document.getElementById('player-display').textContent = `Player: ${state.currentPlayer + 1}`;
}

function render() {
  renderBoard();
  renderPreview();
  renderHeroes();
  renderEncounter();
}

// --- EVENT HANDLERS ---

function onTileClick(row, col) {
  if (state.phase !== 'move') return;

  const player = state.players[state.currentPlayer];
  const tile = state.dungeon.get(posKey(row, col));
  if (!tile) return;

  const sameTile = player.position.row === row && player.position.col === col;
  if (sameTile) return;

  const dirs = ['north', 'south', 'west', 'east'];
  const currentTile = state.dungeon.get(posKey(player.position.row, player.position.col));
  let isAdjacent = false;
  for (const dir of dirs) {
    if (!currentTile[dir]) continue;
    const delta = getDirDelta(dir);
    if (player.position.row + delta.row === row && player.position.col + delta.col === col) {
      isAdjacent = true;
      break;
    }
  }
  if (!isAdjacent) return;

  movePlayer(row, col);
  log(`Moved to ${tile.name}`, 'hero');

  if (tile.encounter) {
    state.currentEncounter = tile.encounter;
    log(`Encounter: ${tile.encounter.name}`, tile.encounter.type === 'monster' ? 'monster' : 'treasure');
    state.phase = 'resolve-encounter';
  } else {
    nextTurn();
  }
  render();
}

function onExploreTile(row, col, fromDir) {
  if (state.phase !== 'move') return;

  state.moveTarget = { row, col, fromDir };
  state.exploreDir = fromDir;
  state.phase = 'draw-tile';
  log(`Draw a room card to place ${fromDir}.`, 'hero');
  render();
}

function onDrawTile() {
  if (state.phase !== 'draw-tile') return;
  const tile = drawTile();
  if (!tile) { log('Room deck empty!', 'monster'); return; }
  state.currentTile = tile;
  state.currentRotation = 0;
  log(`Drew: ${tile.name}`, 'hero');

  const { row, col, fromDir } = state.moveTarget;
  const validRotation = findValidRotation(tile, row, col, fromDir);

  if (validRotation !== null) {
    state.currentRotation = validRotation;
    log(`Auto-rotated to ${getRotationLabel(validRotation)}`, 'hero');
    state.phase = 'place-tile';
  } else {
    log(`Cannot place ${tile.name} ${fromDir}. Turn ended.`, 'monster');
    state.currentTile = null;
    state.moveTarget = null;
    state.exploreDir = null;
    nextTurn();
  }
  render();
}

function onRotateTile() {
  if (state.phase !== 'place-tile') return;
  state.currentRotation = (state.currentRotation + 90) % 360;
  log(`Rotated clockwise to ${getRotationLabel(state.currentRotation)}`, 'hero');
  render();
}

function onConfirmPlacement() {
  if (state.phase !== 'place-tile') return;
  const { row, col, fromDir } = state.moveTarget;
  if (!canPlaceInDir(state.currentTile, state.currentRotation, row, col, fromDir)) {
    log('Cannot place here with this rotation!', 'monster');
    return;
  }
  log('Click the green spot to place the tile.', 'hero');
}

function onPlacementSelect(row, col) {
  if (state.phase !== 'place-tile' || !state.currentTile) return;

  placeTile(state.currentTile, row, col, state.currentRotation);
  movePlayer(row, col);
  log(`Placed ${state.currentTile.name} at (${row}, ${col})`, 'hero');

  state.currentTile = null;
  state.currentRotation = 0;
  state.phase = 'draw-encounter';

  render();
}

function onDrawEncounter() {
  if (state.phase !== 'draw-encounter') return;
  const enc = drawEncounterCard();
  if (!enc) { log('Encounter deck empty!', 'monster'); return; }

  const player = state.players[state.currentPlayer];
  const pos = player.position;
  const tile = state.dungeon.get(posKey(pos.row, pos.col));
  if (tile) tile.encounter = enc;

  state.currentEncounter = enc;
  log(`Encounter: ${enc.name}`, enc.type === 'monster' ? 'monster' : 'treasure');
  state.phase = 'resolve-encounter';
  render();
}

function onRollDice() {
  rollD20();
  log(`Rolled: ${state.lastDiceRoll}`, 'hero');
  render();
}

function onResolve() {
  const result = resolveEncounter();
  log(result.message, result.type);
  nextTurn();
  render();
}

// --- INITIALIZATION ---
async function init() {
  try {
    const [rooms, encounters, heroes] = await Promise.all([
      loadRoomCards(),
      loadEncounterCards(),
      loadHeroes()
    ]);

    initializeGame(rooms, encounters, heroes);

    document.getElementById('room-deck').addEventListener('click', onDrawTile);
    document.getElementById('encounter-deck').addEventListener('click', onDrawEncounter);
    document.getElementById('roll-dice').addEventListener('click', onRollDice);
    document.getElementById('resolve-btn').addEventListener('click', onResolve);
    document.getElementById('rotate-btn').addEventListener('click', onRotateTile);
    document.getElementById('confirm-placement-btn').addEventListener('click', onConfirmPlacement);

    render();
    log('Game started! Click a ? tile adjacent to your hero to explore.', 'hero');
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

init();
