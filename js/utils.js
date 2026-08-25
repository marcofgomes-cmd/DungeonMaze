// ============================================
// UTILITY FUNCTIONS
// ============================================

export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function expandDeckByQuantity(cards) {
  const expanded = [];
  for (const card of cards) {
    for (let i = 0; i < (card.quantity || 1); i++) {
      expanded.push({ ...card });
    }
  }
  return expanded;
}

export function posKey(row, col) {
  return `${row},${col}`;
}

export function parseKey(key) {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

export function getOppositeDir(dir) {
  const opposites = { north: 'south', south: 'north', west: 'east', east: 'west' };
  return opposites[dir];
}

export function getDirDelta(dir) {
  const deltas = {
    north: { row: -1, col: 0 },
    south: { row: 1, col: 0 },
    west: { row: 0, col: -1 },
    east: { row: 0, col: 1 }
  };
  return deltas[dir];
}

export function getRotationLabel(rotation) {
  const labels = { 0: '0°', 90: '90°', 180: '180°', 270: '270°' };
  return labels[rotation % 360] || '0°';
}

export function rotateExits(tile, rotation) {
  const exits = { north: tile.north, south: tile.south, west: tile.west, east: tile.east };
  const dirs = ['north', 'east', 'south', 'west'];
  const times = ((rotation % 360) / 90) % 4;

  for (let i = 0; i < times; i++) {
    const next = {};
    for (const dir of dirs) {
      const idx = dirs.indexOf(dir);
      const prevDir = dirs[(idx + 3) % 4];
      next[dir] = exits[prevDir];
    }
    exits.north = next.north;
    exits.south = next.south;
    exits.west = next.west;
    exits.east = next.east;
  }

  return exits;
}
