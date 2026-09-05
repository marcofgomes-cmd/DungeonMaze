// ============================================
// GAME STATE
// ============================================

export const state = {
  turn: 1,
  currentPlayer: 0,
  players: [],
  roomDeck: [],
  encounterDeck: [],
  dungeon: new Map(),
  currentTile: null,
  currentRotation: 0,
  currentEncounter: null,
  combatResult: null,
  resolving: false,
  phase: 'move',
  moveTarget: null,
  runTargets: [],
  fleeOrigin: null,
  currentQuest: null,
  questIndex: 0,
  quests: []
};

export function resetState() {
  state.turn = 1;
  state.currentPlayer = 0;
  state.players = [];
  state.roomDeck = [];
  state.encounterDeck = [];
  state.dungeon = new Map();
  state.currentTile = null;
  state.currentRotation = 0;
  state.currentEncounter = null;
  state.combatResult = null;
  state.resolving = false;
  state.phase = 'move';
  state.moveTarget = null;
  state.runTargets = [];
  state.fleeOrigin = null;
  state.currentQuest = null;
}
