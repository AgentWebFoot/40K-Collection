import './point-rewards.js';

export const expeditionBattlesEnabled = true;
export const battlesUnavailableMessage = 'Battles are temporarily unavailable.';

export const battleEquipmentLimit = 4;
export const equipmentCount = choices => choices.reduce((total, { quantity }) => total + quantity, 0);

export const battleTypes = {
  standard: 'Standard',
  'joint-op': 'Joint Op',
  'adversary-op': 'Adversary Op',
  'multiplayer-op': 'Multiplayer Op',
  'compound-op': 'Compound Op',
};

const outsidePlayer = 'outside-player';
export const battleTeamList = value => Array.isArray(value) ? value : String(value || '').split(',').map(item => item.trim()).filter(Boolean);

export function battleSubmissionRound(battle) {
  const round = Number(battle?.submissionRound);
  return Number.isSafeInteger(round) && round >= 1 ? round : null;
}

export function battleParticipants(battle) {
  const multiplayer = battleTeamList(battle.battleOpponents);
  const opponents = battle.battleType === 'multiplayer-op' && multiplayer.length ? multiplayer : [battle.battleOpponent];
  return [...new Set([battle.requesterTeam, ...opponents].filter(Boolean))];
}

export function battleResultOptions(type) {
  if (type === 'compound-op') return { attacker: 'Attacker won', defender: 'Defender won', draw: 'Draw' };
  if (type === 'joint-op') return { won: 'Won', lost: 'Lost' };
  return { won: 'Won', lost: 'Lost', draw: 'Draw' };
}

export function validBattleScores(battle) {
  const scores = battle.battleScores;
  const participants = battleParticipants(battle);
  return scores && typeof scores === 'object' && !Array.isArray(scores)
    && Object.keys(scores).length === participants.length
    && participants.every(team => Object.hasOwn(scores, team) && Number.isSafeInteger(scores[team]) && scores[team] >= 0);
}

export function battleOutcome(battle) {
  const { battleType, battleResult, battleSide, requesterTeam, battleOpponent } = battle;
  if (Object.hasOwn(battle, 'battleScores')) {
    if (!validBattleScores(battle)) return { winners: [], result: 'Result unavailable' };
    const best = Math.max(...Object.values(battle.battleScores));
    const leaders = battleParticipants(battle).filter(team => battle.battleScores[team] === best);
    return leaders.length === 1 ? { winners: leaders, result: '' } : { winners: [], result: 'Draw', tied: leaders };
  }
  if (battle.battleOutcome === 'draw') {
    const tied = battleType === 'multiplayer-op' ? battle.battleTiedTeams ?? battleParticipants(battle) : [];
    return { winners: [], result: 'Draw', tied };
  }
  if (battleType === 'joint-op') {
    const result = battle.battleOutcome || battleResult;
    if (result === 'joint-loss' || result === 'lost') return { winners: [], result: 'Joint Op lost' };
    if (result === 'won' || result === 'joint-win' || battleParticipants(battle).includes(result)) {
      return { winners: battleParticipants(battle), result: '' };
    }
  }
  if (battle.battleOutcome) return { winners: [battle.battleOutcome], result: '' };
  if (battleType === 'multiplayer-op') {
    const listedWinners = battleTeamList(battle.battleWinners);
    const winners = listedWinners.length ? listedWinners : battleTeamList(battle.battleWinner);
    if (winners.length > 1) return { winners: [], result: 'Draw', tied: winners };
    return { winners, result: winners.length ? '' : 'Winner unavailable' };
  }
  if (battleResult === 'draw') return { winners: [], result: 'Draw' };
  if (battleType === 'compound-op' && ['attacker', 'defender'].includes(battleResult)) {
    return { winners: [battleSide === battleResult ? requesterTeam : battleOpponent].filter(Boolean), result: battleResult === 'defender' ? 'Defender won' : 'Attacker won' };
  }
  if (battleResult === 'won') return { winners: [requesterTeam].filter(Boolean), result: '' };
  if (battleResult === 'lost') return { winners: [battleOpponent].filter(Boolean), result: '' };
  return { winners: [], result: 'Result unavailable' };
}

export function battleLocationOptions(battle, tiles) {
  let occupants = battleParticipants(battle).filter(team => team !== outsidePlayer);
  let defender = '';
  if (battle.battleType === 'compound-op') {
    if (battle.battleSide === 'attacker') {
      occupants = [battle.requesterTeam];
      defender = battle.battleOpponent;
    } else if (battle.battleSide === 'defender') {
      occupants = [battle.battleOpponent];
      defender = battle.requesterTeam;
    } else {
      return [];
    }
  }
  return (tiles ?? []).filter(tile => tile?.id
    && [tile.marker, tile.secondaryMarker].some(team => team && team !== outsidePlayer && occupants.includes(team))
    && (!defender || battle.battleOpponent === outsidePlayer || (tile.structure === 'camp' && tile.structureColor === defender)));
}

export function validateBattle(battle, teams, tiles, { recordedLocation } = {}) {
  const { battleType, requesterTeam, battleOpponent, battleSide, battleResult, battleLocation } = battle;
  const explicitOutcome = Object.hasOwn(battle, 'battleOutcome');
  const scored = Object.hasOwn(battle, 'battleScores');
  if (!Object.hasOwn(battleTypes, battleType) || !teams.includes(requesterTeam)) return 'Select a battle type and reporting team.';
  if (battleType === 'multiplayer-op') {
    const opponents = battleTeamList(battle.battleOpponents);
    if (opponents.length < 2 || opponents.length > 3 || new Set(opponents).size !== opponents.length
      || opponents.some(team => team === requesterTeam || (team !== outsidePlayer && !teams.includes(team)))) {
      return 'Select two or three distinct opponents.';
    }
    if (!scored && !explicitOutcome) {
      const { winners, tied } = battleOutcome(battle);
      const leaders = tied ?? winners;
      if (!leaders.length || leaders.some(team => team !== requesterTeam && !opponents.includes(team))) return 'Select at least one participating winner.';
    }
    if (!scored && battle.battleOutcome === 'draw' && Object.hasOwn(battle, 'battleTiedTeams')) {
      const tied = battle.battleTiedTeams;
      if (!Array.isArray(tied) || tied.length < 2 || new Set(tied).size !== tied.length
        || tied.some(team => team !== requesterTeam && !opponents.includes(team))) return 'Select at least two participating teams that tied.';
    }
  } else {
    const joint = battleType === 'joint-op';
    if ((!teams.includes(battleOpponent) && (joint || battleOpponent !== outsidePlayer))
      || (!joint && battleOpponent === requesterTeam)) return joint ? 'Select a teammate.' : 'Select an opponent.';
    if (battleType === 'compound-op' && !['attacker', 'defender'].includes(battleSide)) return 'Select the reporting team’s role.';
    if (!scored && !explicitOutcome && !Object.hasOwn(battleResultOptions(battleType), battleResult)) return 'Select the battle result.';
  }
  if (scored && battleType === 'joint-op') return 'Choose a Joint Op outcome.';
  if (scored && !validBattleScores(battle)) return 'Enter a non-negative whole-number score for each participant.';
  const jointOutcome = battleType === 'joint-op' && ['joint-win', 'joint-loss'].includes(battle.battleOutcome);
  if (!scored && explicitOutcome && !jointOutcome && battle.battleOutcome !== 'draw' && !battleParticipants(battle).includes(battle.battleOutcome)) {
    return 'Select a participating winner or a draw.';
  }
  if (!(battleLocation && battleLocation === recordedLocation)
    && !battleLocationOptions(battle, tiles).some(tile => tile.id === battleLocation)) return 'Select an eligible battle tile.';
  return '';
}

export const battleRewardFields = {
  campaignPoints: { label: 'Campaign Points', max: Number.MAX_SAFE_INTEGER },
  supplyPoints: { label: 'Supply Points', max: 10 },
  credits: { label: 'Credits', max: Number.MAX_SAFE_INTEGER },
};

export function validRewardOverrides(battle, teams, overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return false;
  const participants = battleParticipants(battle);
  return Object.entries(overrides).every(([team, values]) =>
    teams.includes(team) && participants.includes(team) && values && typeof values === 'object' && !Array.isArray(values)
    && Object.entries(values).length > 0
    && Object.entries(values).every(([field, amount]) => Object.hasOwn(battleRewardFields, field)
      && Number.isSafeInteger(amount) && amount >= 0 && amount <= battleRewardFields[field].max));
}

export function battlePayoutAwards(battle, settings, teams, overrides = {}) {
  let result = battle;
  if (Object.hasOwn(battle, 'battleScores')) {
    if (!validBattleScores(battle)) return [];
    const { winners, tied } = battleOutcome(battle);
    result = { ...battle, battleOutcome: winners[0] ?? 'draw', battleTiedTeams: tied };
  }
  const defaults = globalThis.ExpeditionPointRewards.battleAwards(result, settings, teams);
  const awards = new Map(defaults.map(award => [`${award[0]}:${award[1]}`, award]));
  for (const [team, values] of Object.entries(overrides)) {
    for (const [field, amount] of Object.entries(values)) awards.set(`${team}:${field}`, [team, field, amount]);
  }
  return [...awards.values()].filter(([, , amount]) => amount > 0);
}

export function projectedBattlePayouts(battle, settings, teams, balances, overrides) {
  const rows = battleParticipants(battle).filter(team => teams.includes(team))
    .map(team => ({ team, campaignPoints: 0, supplyPoints: 0, credits: 0 }));
  for (const [team, field, amount] of battlePayoutAwards(battle, settings, teams, overrides)) {
    const row = rows.find(row => row.team === team);
    if (!row) continue;
    row[field] = Math.min(amount, Math.max(0, battleRewardFields[field].max - (balances?.[team]?.[field] ?? 0)));
    if (row[field] < amount) (row.cappedRewards ??= {})[field] = amount;
  }
  return rows;
}
