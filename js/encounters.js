// ============================================
// ENCOUNTER SYSTEM
// ============================================

import { state } from './state.js';
import { posKey, effectiveAttack, effectiveDefense, effectiveMaxHp } from './utils.js';

const RUNE_STAT_LABEL = { strength: 'Attack', defense: 'Defense', fortitude: 'Max HP' };

export function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollCombatDice() {
  const heroRoll = rollD6();
  const monsterRoll = rollD6();
  state.combatResult = { heroRoll, monsterRoll };
  return state.combatResult;
}

export function abilityDescription(ability) {
  switch (ability.effect) {
    case 'heal': return `Heal ${ability.value} HP`;
    case 'bonusDamage': return `Deal +${ability.value} bonus damage`;
    case 'reduceDamage': return `Reduce damage taken by ${ability.value}`;
    case 'negateDamage': return 'Take no damage this turn';
    default: return ability.effect;
  }
}

export function applyAbility(ability, player, heroDamage, monsterDamage) {
  switch (ability.effect) {
    case 'heal': {
      const healed = Math.min(effectiveMaxHp(player) - player.currentHp, ability.value || 0);
      player.currentHp += healed;
      return { heroDamage, monsterDamage, description: `Heal ${healed} HP` };
    }
    case 'bonusDamage':
      return { heroDamage: heroDamage + (ability.value || 0), monsterDamage, description: `Deal +${ability.value} bonus damage` };
    case 'reduceDamage':
      return { heroDamage, monsterDamage: Math.max(0, monsterDamage - (ability.value || 0)), description: `Reduce damage taken by ${ability.value}` };
    case 'negateDamage':
      return { heroDamage, monsterDamage: 0, description: 'Take no damage this turn' };
    default:
      return { heroDamage, monsterDamage, description: ability.effect };
  }
}

export function handleHeroDefeat(player) {
  player.currentHp = effectiveMaxHp(player);
  player.position = { row: 0, col: 0 };
  const lostGold = player.gold > 0 ? 1 : 0;
  player.gold -= lostGold;
  return lostGold ? 'Teleported to the entrance. Lost 1 gold in the fall.' : 'Teleported to the entrance.';
}

export function resolveEncounter() {
  if (!state.currentEncounter) return { message: 'No encounter.', type: 'hero', resolved: true };

  const player = state.players[state.currentPlayer];
  const pos = player.position;
  const tile = state.dungeon.get(posKey(pos.row, pos.col));
  const enc = state.currentEncounter;

  if (enc.type === 'monster') {
    const combat = state.combatResult || rollCombatDice();

    let heroDamage = Math.max(0, combat.heroRoll + effectiveAttack(player) - enc.defense);
    let monsterDamage = Math.max(0, combat.monsterRoll + enc.attack - effectiveDefense(player));

    const messages = [];
    const ability = (player.abilities || []).find(a => a.roll === combat.heroRoll);
    if (ability) {
      const result = applyAbility(ability, player, heroDamage, monsterDamage);
      heroDamage = result.heroDamage;
      monsterDamage = result.monsterDamage;
      messages.push(`[${ability.roll}] ${ability.name}: ${result.description}`);
    }

    enc.currentHp = (enc.currentHp || enc.hp) - heroDamage;
    player.currentHp -= monsterDamage;

    messages.push(`You rolled ${combat.heroRoll} + ${effectiveAttack(player)} ATK - ${enc.defense} DEF = ${heroDamage} damage`);
    messages.push(`${enc.name} rolled ${combat.monsterRoll} + ${enc.attack} ATK - ${effectiveDefense(player)} DEF = ${monsterDamage} damage`);

    const heroDefeated = player.currentHp <= 0;
    const isBoss = enc.id && enc.id.includes('boss');

    if (enc.currentHp <= 0) {
      const goldEarned = enc.gold || 0;
      player.gold += goldEarned;
      if (tile) tile.encounter = null;
      messages.push(`${enc.name} defeated! +${goldEarned} gold.`);

      if (heroDefeated) {
        messages.push(`You fell in the same blow! ${handleHeroDefeat(player)}`);
      }
      return { message: messages.join(' | '), type: 'treasure', resolved: true, questComplete: isBoss };
    }

    if (heroDefeated) {
      enc.wasFought = true;
      messages.push(`Defeated! The ${enc.name} remains in the room. ${handleHeroDefeat(player)}`);
      return { message: messages.join(' | '), type: 'monster', resolved: true };
    }

    enc.wasFought = true;
    messages.push(`You: ${player.currentHp}/${effectiveMaxHp(player)} HP | ${enc.name}: ${enc.currentHp}/${enc.hp} HP`);
    return { message: messages.join(' | '), type: 'monster', resolved: false };
  }

  if (enc.type === 'trap') {
    const damage = enc.damage || 2;
    player.currentHp -= damage;
    if (tile) tile.encounter = null;
    if (player.currentHp <= 0) {
      return { message: `${enc.name}! Took ${damage} damage. ${handleHeroDefeat(player)}`, type: 'monster', resolved: true };
    }
    return { message: `${enc.name}! Took ${damage} damage.`, type: 'monster', resolved: true };
  }

  if (enc.type === 'heal') {
    const healed = Math.min(effectiveMaxHp(player) - player.currentHp, enc.value || 5);
    player.currentHp += healed;
    if (tile) tile.encounter = null;
    return { message: `${enc.name}! Restored ${healed} HP.`, type: 'treasure', resolved: true };
  }

  if (enc.type === 'gold') {
    const gold = enc.value || 25;
    player.gold += gold;
    if (tile) tile.encounter = null;
    return { message: `${enc.name}! +${gold} gold.`, type: 'treasure', resolved: true };
  }

  if (enc.type === 'equipment') {
    if (!player.runes) player.runes = { strength: 0, defense: 0, fortitude: 0 };
    const stat = RUNE_STAT_LABEL[enc.stat] ? enc.stat : 'strength';
    const value = enc.value || 1;
    player.runes[stat] = (player.runes[stat] || 0) + value;
    if (stat === 'fortitude') player.currentHp = Math.min(effectiveMaxHp(player), player.currentHp + value);
    if (tile) tile.encounter = null;
    return { message: `${enc.name}! ${RUNE_STAT_LABEL[stat]} bonus +${player.runes[stat]}.`, type: 'treasure', resolved: true };
  }

  if (tile) tile.encounter = null;
  return { message: 'Encounter resolved.', type: 'hero', resolved: true };
}