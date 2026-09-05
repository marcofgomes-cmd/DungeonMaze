// ============================================
// DUNGEON MAZE - Main Game Orchestrator
// ============================================

import { state, resetState } from './state.js';
import { shuffle, expandDeckByQuantity, posKey, getDirDelta, getRotationLabel, rotateExits } from './utils.js';
import { loadRoomCards, loadHeroes, loadQuests } from './data.js';
import { rollCombatDice, resolveEncounter, handleHeroDefeat } from './encounters.js';
import {
  canPlaceInDir, findValidRotation, placeTile, movePlayer,
  drawTile, drawEncounterCard, render, closeHeroDetailModal, initEncounterHover, showFloatingNumbers
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

function logEncounterType(type) {
  return type === 'monster' || type === 'trap' ? 'monster' : 'treasure';
}

// --- QUEST SELECTION ---
function showQuestScreen(quests) {
  const questScreen = document.getElementById('quest-screen');
  const gameScreen = document.getElementById('game-screen');
  const questList = document.getElementById('quest-list');

  questScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');

  questList.innerHTML = '';
  quests.forEach((quest, index) => {
    const card = document.createElement('div');
    card.className = 'quest-card';
    card.innerHTML = `
      <h3>${quest.name}</h3>
      <p>${quest.description}</p>
      <div class="quest-reward">Reward: ${quest.reward} gold</div>
    `;
    card.addEventListener('click', () => selectQuest(quest, index, quests));
    questList.appendChild(card);
  });
}

function selectQuest(quest, index, quests) {
  state.currentQuest = quest;
  state.questIndex = index;
  state.quests = quests;

  document.getElementById('quest-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('quest-name-display').textContent = quest.name;

  startGame(quest.encounters);
}

// --- GAME INITIALIZATION ---
async function startGame(encounters) {
  const rooms = await loadRoomCards();
  const heroList = await loadHeroes();

  const roomsWithoutEntrance = rooms.filter(c => c.type !== 'entrance');
  state.roomDeck = shuffle(expandDeckByQuantity(roomsWithoutEntrance));
  state.encounterDeck = shuffle(expandDeckByQuantity(encounters));

  if (state.players.length === 0) {
    state.players = heroList.map((hero, i) => ({
      id: i,
      ...hero,
      currentHp: hero.hp,
      gold: 0,
      runes: { strength: 0, defense: 0, fortitude: 0 },
      position: { row: 0, col: 0 }
    }));
  }

  state.dungeon = new Map();
  const entrance = {
    name: 'Entrance', type: 'entrance',
    north: true, south: true, west: true, east: true,
    image: 'images/room-cards/entrance.png',
    explored: true, encounter: null
  };
  state.dungeon.set(posKey(0, 0), entrance);

  state.turn = 1;
  state.currentPlayer = 0;
  state.phase = 'move';

  render();
  log(`Quest: ${state.currentQuest.name}`, 'hero');
  log('Click a ? tile adjacent to your hero to explore.', 'hero');
}

function nextTurn() {
  state.currentEncounter = null;
  state.combatResult = null;
  state.resolving = false;
  state.currentTile = null;
  state.currentRotation = 0;
  state.moveTarget = null;
  state.runTargets = [];
  state.fleeOrigin = null;
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  if (state.currentPlayer === 0) state.turn++;
  checkStartingEncounter();
}

function checkStartingEncounter() {
  const player = state.players[state.currentPlayer];
  const tile = state.dungeon.get(posKey(player.position.row, player.position.col));
  if (tile && tile.encounter && tile.encounter.type === 'monster') {
    state.currentEncounter = tile.encounter;
    log(`Encounter: ${tile.encounter.name}`, 'monster');
    state.phase = 'encounter-choice';
    render();
    return;
  }
  state.phase = 'move';
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
    log(`Encounter: ${tile.encounter.name}`, logEncounterType(tile.encounter.type));
    state.phase = tile.encounter.type === 'monster' && tile.encounter.wasFought ? 'encounter-choice' : 'resolve-encounter';
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
  log(`Encounter: ${enc.name}`, logEncounterType(enc.type));
  state.phase = enc.type === 'monster' && enc.wasFought ? 'encounter-choice' : 'resolve-encounter';
  render();
}

// --- UI BUTTON HANDLERS ---
function onRollDice() {
  if (state.resolving || state.combatResult) return;
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
  if (state.resolving) return;
  const result = resolveEncounter();
  log(result.message, result.type);
  state.resolving = true;
  render();
  showFloatingNumbers(result);

  setTimeout(() => {
    state.resolving = false;
    state.combatResult = null;
    if (result.resolved && result.questComplete) {
      completeQuest();
    } else {
      nextTurn();
    }
    render();
  }, 1500);
}

function onFight() {
  if (state.phase !== 'encounter-choice') return;
  state.runTargets = [];
  state.fleeOrigin = null;
  state.phase = 'resolve-encounter';
  log(`You choose to fight ${state.currentEncounter.name}!`, 'hero');
  render();
}

function onRun() {
  if (state.phase !== 'encounter-choice') return;
  const player = state.players[state.currentPlayer];
  const currentTile = state.dungeon.get(posKey(player.position.row, player.position.col));
  const dirs = ['north', 'south', 'west', 'east'];
  const targets = [];
  for (const dir of dirs) {
    if (!currentTile[dir]) continue;
    const delta = getDirDelta(dir);
    const row = player.position.row + delta.row;
    const col = player.position.col + delta.col;
    const tile = state.dungeon.get(posKey(row, col));
    if (tile) {
      targets.push({ row, col });
    }
  }
  if (targets.length === 0) {
    log('No known room to flee to through an exit!', 'monster');
    return;
  }
  state.runTargets = targets;
  state.fleeOrigin = { row: player.position.row, col: player.position.col };
  state.phase = 'run-selection';
  log('Choose a known room to flee to.', 'hero');
  render();
}

window.onRunSelect = function (row, col) {
  if (state.phase !== 'run-selection') return;
  const player = state.players[state.currentPlayer];
  const valid = state.runTargets.find(t => t.row === row && t.col === col);
  if (!valid) return;

  const tile = state.dungeon.get(posKey(row, col));
  movePlayer(row, col);
  log(`You flee to ${tile.name}.`, 'hero');

  player.currentHp -= 1;
  if (player.currentHp <= 0) {
    log(`You collapsed from the escape! ${handleHeroDefeat(player)}`, 'monster');
  }

  state.runTargets = [];
  state.fleeOrigin = null;
  state.moveTarget = null;

  if (player.currentHp > 0 && !(player.position.row === 0 && player.position.col === 0) && tile.encounter) {
    state.currentEncounter = tile.encounter;
    log(`Encounter: ${tile.encounter.name}`, logEncounterType(tile.encounter.type));
    state.phase = tile.encounter.type === 'monster' && tile.encounter.wasFought ? 'encounter-choice' : 'resolve-encounter';
  } else {
    nextTurn();
  }
  render();
};

function completeQuest() {
  const goldReward = state.currentQuest.reward || 0;
  state.players.forEach(p => p.gold += goldReward);
  log(`Quest Complete! Each player receives ${goldReward} gold!`, 'treasure');

  if (state.questIndex < state.quests.length - 1) {
    log('Starting next quest...', 'hero');
    state.questIndex++;
    state.currentQuest = state.quests[state.questIndex];
    document.getElementById('quest-name-display').textContent = state.currentQuest.name;
    startGame(state.currentQuest.encounters);
  } else {
    log('All quests complete! Victory!', 'treasure');
  }
}

// --- INITIALIZATION ---
async function init() {
  try {
    const quests = await loadQuests();
    showQuestScreen(quests);

    document.getElementById('roll-dice').addEventListener('click', onRollDice);
    document.getElementById('resolve-btn').addEventListener('click', onResolve);
    document.getElementById('fight-btn').addEventListener('click', onFight);
    document.getElementById('run-btn').addEventListener('click', onRun);
    document.getElementById('rotate-btn').addEventListener('click', onRotateTile);
    initEncounterHover();

    document.getElementById('hero-modal-close').addEventListener('click', closeHeroDetailModal);
    document.getElementById('hero-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeHeroDetailModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeHeroDetailModal();
    });
    document.getElementById('log-toggle').addEventListener('click', () => {
      const panel = document.getElementById('log-panel');
      const toggle = document.getElementById('log-toggle');
      panel.classList.toggle('collapsed');
      toggle.textContent = panel.classList.contains('collapsed') ? '+' : '−';
    });
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

init();
