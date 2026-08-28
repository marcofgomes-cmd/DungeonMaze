// ============================================
// DATA LOADING & FALLBACKS
// ============================================

export const PLAYER_COLORS = ['#e94560', '#53d769', '#ffd700', '#00a8ff'];

export const fallbackRoomCards = [
  { name: 'Entrance', type: 'entrance', north: true, south: true, west: true, east: true, quantity: 1 },
  { name: 'Corridor', type: 'corridor', north: true, south: true, west: false, east: false, quantity: 8 },
  { name: 'Dead End', type: 'dead-end', north: true, south: false, west: false, east: false, quantity: 6 },
  { name: 'Corner', type: 'corner', north: true, south: false, west: false, east: true, quantity: 8 },
  { name: 'T-Junction', type: 't-junction', north: true, south: false, west: true, east: true, quantity: 6 },
  { name: 'Crossroads', type: 'cross', north: true, south: true, west: true, east: true, quantity: 4 }
];

export const fallbackHeroes = [
  { class: 'warrior', name: 'Warrior', hp: 30, attack: 8, defense: 5, magic: 2 },
  { class: 'wizard', name: 'Wizard', hp: 20, attack: 4, defense: 3, magic: 10 },
  { class: 'rogue', name: 'Rogue', hp: 25, attack: 7, defense: 3, magic: 3 },
  { class: 'cleric', name: 'Cleric', hp: 28, attack: 5, defense: 4, magic: 7 }
];

export async function loadRoomCards() {
  try {
    const response = await fetch('data/room-cards.json');
    return await response.json();
  } catch {
    return fallbackRoomCards;
  }
}

export async function loadHeroes() {
  try {
    const response = await fetch('data/heroes.json');
    return await response.json();
  } catch {
    return fallbackHeroes;
  }
}

export async function loadQuests() {
  try {
    const manifestResponse = await fetch('data/quest-manifest.json');
    const questPaths = await manifestResponse.json();

    const quests = [];
    for (const path of questPaths) {
      const response = await fetch(path);
      const quest = await response.json();
      quests.push(quest);
    }
    return quests;
  } catch {
    return [];
  }
}
