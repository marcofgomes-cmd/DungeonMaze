// ============================================
// ENCOUNTER SYSTEM
// ============================================

import { state } from './state.js';
import { posKey } from './utils.js';

export function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollCombatDice() {
  const heroRoll = rollD6();
  const monsterRoll = rollD6();
  state.combatResult = { heroRoll, monsterRoll };
  return state.combatResult;
}

export function resolveEncounter() {
  if (!state.currentEncounter) return { message: 'No encounter.', type: 'hero', resolved: true };

  const player = state.players[state.currentPlayer];
  const pos = player.position;
  const tile = state.dungeon.get(posKey(pos.row, pos.col));

  if (state.currentEncounter.type === 'monster') {
    const monster = state.currentEncounter;
    const combat = state.combatResult || rollCombatDice();

    const heroDamage = Math.max(0, combat.heroRoll + player.attack - monster.defense);
    const monsterDamage = Math.max(0, combat.monsterRoll + monster.attack - player.defense);

    monster.currentHp = (monster.currentHp || monster.hp) - heroDamage;
    player.currentHp -= monsterDamage;

    const messages = [];
    messages.push(`You rolled ${combat.heroRoll} + ${player.attack} ATK - ${monster.defense} DEF = ${heroDamage} damage`);
    messages.push(`${monster.name} rolled ${combat.monsterRoll} + ${monster.attack} ATK - ${player.defense} DEF = ${monsterDamage} damage`);

    if (monster.currentHp <= 0) {
      const goldEarned = monster.gold || 0;
      player.gold += goldEarned;
      if (tile) tile.encounter = null;
      messages.push(`${monster.name} defeated! +${goldEarned} gold.`);

      const isBoss = monster.id && monster.id.includes('boss');
      return { message: messages.join(' | '), type: 'treasure', resolved: true, questComplete: isBoss };
    }

    if (player.currentHp <= 0) {
      player.currentHp = player.hp;
      player.position = { row: 0, col: 0 };
      monster.wasFought = true;
      messages.push(`Defeated! The ${monster.name} remains in the room. Teleported to entrance.`);
      return { message: messages.join(' | '), type: 'monster', resolved: true };
    }

    monster.wasFought = true;
    messages.push(`You: ${player.currentHp}/${player.hp} HP | ${monster.name}: ${monster.currentHp}/${monster.hp} HP`);
    return { message: messages.join(' | '), type: 'monster', resolved: false };
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
