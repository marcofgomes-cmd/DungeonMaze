// ============================================
// DUNGEON MAZE - Main Game Orchestrator
// ============================================

import { state } from './state.js';
import { shuffle, expandDeckByQuantity, posKey, getDirDelta, getRotationLabel, rotateExits } from './utils.js';
import { loadRoomCards, loadEncounterCards, loadHeroes } from './data.js';
import { rollCombatDice, resolveEncounter } from './encounters.js';
import {
  canPlaceInDir, findValidRotation, placeTile, movePlayer,
  drawTile, drawEncounterCard, render
} from './board.js';

// --- LOGGING ---
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

// --- GAME INITIALIZATION ---
function initializeGame(rooms, encounters, heroList) {
  const roomsWithoutEntrance = rooms.filter(c => c.id !== 'tile-entrance');
  state.roomDeck = shuffle(expandDeckByQuantity(roomsWithoutEntrance));
  state.encounterDeck = shuffle(expandDeckByQuantity(encounters));

  state.players = heroList.map((hero, i) => ({
    id: i,
    ...hero,
    currentHp: hero.hp,
    gold: 0,
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

function nextTurn() {
  state.currentEncounter = null;
  state.combatResult = null;
  state.currentTile = null;
  state.currentRotation = 0;
  state.moveTarget = null;
  state.phase = 'move';
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  if (state.currentPlayer === 0) state.turn++;
}

// --- EVENT HANDLERS (exposed to board.js via window) ---
window.onTileClick = function (row, col) {
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
};

window.onExploreTile = function (row, col, fromDir) {
  if (state.phase !== 'move') return;

  state.moveTarget = { row, col, fromDir };
  state.phase = 'draw-tile';
  processDrawTile();
};

window.onPlacementSelect = function (row, col) {
  if (state.phase !== 'place-tile' || !state.currentTile) return;

  placeTile(state.currentTile, row, col, state.currentRotation);
  movePlayer(row, col);
  log(`Placed ${state.currentTile.name} at (${row}, ${col})`, 'hero');

  state.currentTile = null;
  state.currentRotation = 0;
  state.phase = 'draw-encounter';
  processDrawEncounter();
};

// --- PHASE PROCESSORS ---
function processDrawTile() {
  if (state.phase !== 'draw-tile') return;
  const tile = drawTile();
  if (!tile) { log('Room deck empty!', 'monster'); nextTurn(); render(); return; }
  state.currentTile = tile;
  state.currentRotation = 0;
  log(`Drew: ${tile.name}`, 'hero');

  const { row, col, fromDir } = state.moveTarget;
  const validRotation = findValidRotation(tile, row, col, fromDir);

  if (validRotation !== null) {
    state.currentRotation = validRotation;
    state.phase = 'place-tile';
  } else {
    log(`Cannot place ${tile.name} ${fromDir}. Turn ended.`, 'monster');
    state.currentTile = null;
    state.moveTarget = null;
    nextTurn();
  }
  render();
}

function processDrawEncounter() {
  if (state.phase !== 'draw-encounter') return;
  const enc = drawEncounterCard();
  if (!enc) { log('Encounter deck empty!', 'monster'); nextTurn(); render(); return; }

  const player = state.players[state.currentPlayer];
  const pos = player.position;
  const tile = state.dungeon.get(posKey(pos.row, pos.col));
  if (tile) tile.encounter = enc;

  state.currentEncounter = enc;
  log(`Encounter: ${enc.name}`, enc.type === 'monster' ? 'monster' : 'treasure');
  state.phase = 'resolve-encounter';
  render();
}

// --- UI BUTTON HANDLERS ---
function onRollDice() {
  const combat = rollCombatDice();
  log(`You rolled ${combat.heroRoll} | ${state.currentEncounter.name} rolled ${combat.monsterRoll}`, 'hero');
  render();
}

function onRotateTile() {
  if (state.phase !== 'place-tile' || !state.currentTile || !state.moveTarget) return;

  const { row, col, fromDir } = state.moveTarget;
  const startRotation = state.currentRotation;

  for (let i = 1; i <= 3; i++) {
    const next = (startRotation + i * 90) % 360;
    if (canPlaceInDir(state.currentTile, next, row, col, fromDir)) {
      state.currentRotation = next;
      log(`Rotated to ${getRotationLabel(next)}`, 'hero');
      render();
      return;
    }
  }

  log('No other valid rotations.', 'monster');
}

function onResolve() {
  const result = resolveEncounter();
  log(result.message, result.type);
  if (result.resolved) {
    nextTurn();
  } else {
    state.combatResult = null;
  }
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

    document.getElementById('roll-dice').addEventListener('click', onRollDice);
    document.getElementById('resolve-btn').addEventListener('click', onResolve);
    document.getElementById('rotate-btn').addEventListener('click', onRotateTile);

    render();
    log('Game started! Click a ? tile adjacent to your hero to explore.', 'hero');
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

init();
