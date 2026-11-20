export const battleTypes = {
  standard: 'Standard',
  'joint-op': 'Joint Op',
  'adversary-op': 'Adversary Op',
  'multiplayer-op': 'Multiplayer Op',
  'compound-op': 'Compound Op',
};

const outsidePlayer = 'outside-player';
export const battleTeamList = value => Array.isArray(value) ? value : String(value || '').split(',').map(item => item.trim()).filter(Boolean);

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

export function battleOutcome(battle) {
  const { battleType, battleResult, battleSide, requesterTeam, battleOpponent } = battle;
  if (battleType === 'multiplayer-op') {
    const listedWinners = battleTeamList(battle.battleWinners);
    const winners = listedWinners.length ? listedWinners : battleTeamList(battle.battleWinner);
    return { winners, result: winners.length ? '' : 'Winner unavailable' };
  }
  if (battleResult === 'draw') return { winners: [], result: 'Draw' };
  if (battleType === 'joint-op') {
    return { winners: battleResult === 'won' ? battleParticipants(battle) : [], result: battleResult === 'lost' ? 'Joint Op lost' : '' };
  }
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

export function validateBattle(battle, teams, tiles) {
  const { battleType, requesterTeam, battleOpponent, battleSide, battleResult, battleLocation } = battle;
  if (!Object.hasOwn(battleTypes, battleType) || !teams.includes(requesterTeam)) return 'Select a battle type and reporting team.';
  if (battleType === 'multiplayer-op') {
    const opponents = battleTeamList(battle.battleOpponents);
    const winners = battleTeamList(battle.battleWinners);
    if (opponents.length < 2 || opponents.length > 3 || new Set(opponents).size !== opponents.length
      || opponents.some(team => team === requesterTeam || (team !== outsidePlayer && !teams.includes(team)))) {
      return 'Select two or three distinct opponents.';
    }
    if (!winners.length || winners.some(team => team !== requesterTeam && !opponents.includes(team))) return 'Select at least one participating winner.';
  } else {
    const joint = battleType === 'joint-op';
    if ((!teams.includes(battleOpponent) && (joint || battleOpponent !== outsidePlayer))
      || (!joint && battleOpponent === requesterTeam)) return joint ? 'Select a teammate.' : 'Select an opponent.';
    if (battleType === 'compound-op' && !['attacker', 'defender'].includes(battleSide)) return 'Select the reporting team’s role.';
    if (!Object.hasOwn(battleResultOptions(battleType), battleResult)) return 'Select the battle result.';
  }
  if (!battleLocationOptions(battle, tiles).some(tile => tile.id === battleLocation)) return 'Select an eligible battle tile.';
  return '';
}
