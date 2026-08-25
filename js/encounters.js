// ============================================
// ENCOUNTER SYSTEM
// ============================================

import { state } from './state.js';
import { posKey } from './utils.js';

export function rollD20() {
  state.lastDiceRoll = Math.floor(Math.random() * 20) + 1;
  return state.lastDiceRoll;
}

export function resolveEncounter() {
  if (!state.currentEncounter) return { message: 'No encounter.', type: 'hero', resolved: true };

  const player = state.players[state.currentPlayer];
  const pos = player.position;
  const tile = state.dungeon.get(posKey(pos.row, pos.col));

  if (state.currentEncounter.type === 'monster') {
    const monster = state.currentEncounter;
    const roll = state.lastDiceRoll || rollD20();
    const playerPower = player.attack + roll;
    const monsterPower = monster.attack + Math.floor(Math.random() * 10) + 1;

    if (playerPower > monsterPower) {
      player.currentHp = Math.min(player.hp, player.currentHp + 5);
      if (tile) tile.encounter = null;
      return { message: `Victory! Defeated ${monster.name}! +5 HP.`, type: 'treasure', resolved: true };
    } else {
      const damage = Math.max(1, monster.attack - player.defense);
      player.currentHp -= damage;
      if (player.currentHp <= 0) {
        player.currentHp = player.hp;
        player.position = { row: 0, col: 0 };
        if (tile) tile.encounter = null;
        return { message: `Defeated by ${monster.name}! Teleported to entrance.`, type: 'monster', resolved: true };
      }
      return { message: `Defeated by ${monster.name}. -${damage} HP.`, type: 'monster', resolved: true };
    }
  } else if (state.currentEncounter.type === 'treasure') {
    const treasure = state.currentEncounter;
    if (tile) tile.encounter = null;

    if (treasure.effect === 'heal') {
      player.currentHp = Math.min(player.hp, player.currentHp + treasure.value);
      return { message: `Found ${treasure.name}! +${treasure.value} HP.`, type: 'treasure', resolved: true };
    }
    return { message: `Found ${treasure.name}!`, type: 'treasure', resolved: true };
  } else if (state.currentEncounter.type === 'event') {
    const event = state.currentEncounter;
    if (tile) tile.encounter = null;

    if (event.effect === 'trap') {
      const damage = event.damage || 5;
      player.currentHp -= damage;
      if (player.currentHp <= 0) {
        player.currentHp = player.hp;
        player.position = { row: 0, col: 0 };
        return { message: `${event.name}! took ${damage} damage. Teleported to entrance.`, type: 'monster', resolved: true };
      }
      return { message: `${event.name}! took ${damage} damage.`, type: 'monster', resolved: true };
    } else if (event.effect === 'heal') {
      const heal = event.value || 10;
      player.currentHp = Math.min(player.hp, player.currentHp + heal);
      return { message: `${event.name}! Restored ${heal} HP.`, type: 'treasure', resolved: true };
    } else if (event.effect === 'gold') {
      return { message: `${event.name}!`, type: 'treasure', resolved: true };
    }
    return { message: `${event.name}!`, type: 'hero', resolved: true };
  }

  if (tile) tile.encounter = null;
  return { message: 'Encounter resolved.', type: 'hero', resolved: true };
}
