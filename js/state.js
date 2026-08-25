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
  lastDiceRoll: null,
  phase: 'move',
  moveTarget: null
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
  state.lastDiceRoll = null;
  state.phase = 'move';
  state.moveTarget = null;
}
