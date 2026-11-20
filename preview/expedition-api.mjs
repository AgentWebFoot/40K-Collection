import { roles, expeditionRole, expeditionRoles, expeditionTeams } from './accounts.mjs';
import '../Expedition/point-rewards.js';
import { battleParticipants, validateBattle } from '../Expedition/battle-rules.mjs';
import { unitStatFields } from '../Expedition/unit-stats.mjs';
import { validateWeaponProfile } from '../Expedition/weapon-profiles.mjs';
import { validateUnitRule } from '../Expedition/unit-rules.mjs';
import { validUnitImage } from '../Expedition/unit-images.mjs';
import { orderedUnitEntries, unitMoveTarget } from '../Expedition/unit-order.mjs';
import { battlesUnavailableMessage, expeditionBattlesEnabled } from '../Expedition/battle-availability.mjs';

const { validateSettings, readSettings, battleFields, mapGroups, battleAwards } = globalThis.ExpeditionPointRewards;
const teams = expeditionTeams.filter(Boolean);
const isBattle = request => request?.changeSet?.requestType === 'battle';
const battleStateKey = 'expedition-preview-battles';
const roundStorageKey = 'expedition-preview-round';
const rosterCategories = ['units', 'items'];
const unitEntryTypes = {
  weapons: { key: 'weapon', validate: validateWeaponProfile },
  abilities: { key: 'ability', validate: input => validateUnitRule(input, false) },
  actions: { key: 'action', validate: input => validateUnitRule(input, true) },
};
const supplyCostActions = ['manoeuvre', 'regroup', 'scout', 'encamp', 'demolish', 'search'];
const requestSettings = {
  '/supply-point-costs': {
    field: 'supplyPointCosts',
    label: 'Supply Point costs',
    validate: validSupplyCosts,
    invalidMessage: 'Enter a whole number from 0 to 10 for each Supply Point cost.',
  },
  '/movement-limit': {
    field: 'movementLimit',
    label: 'Movement limit',
    validate: value => Number.isSafeInteger(value) && value >= 0,
    invalidMessage: 'Enter a non-negative whole number for the movement limit.',
  },
  '/point-rewards': {
    field: 'pointRewards',
    label: 'Point rewards',
    validate: validateSettings,
    invalidMessage: 'Enter non-negative whole numbers, with Supply Points at most 10 and each camp minimum at most its maximum.',
  },
};

function validSupplyCosts(costs) {
  return costs && Object.keys(costs).length === supplyCostActions.length && supplyCostActions.every(action =>
    Object.hasOwn(costs, action) && Number.isInteger(costs[action]) && costs[action] >= 0 && costs[action] <= 10);
}

const validCredits = credits => Number.isSafeInteger(credits) && credits >= 0;
const validRound = round => Number.isSafeInteger(round) && round >= 1;

function validTeamPoints(points) {
  return Number.isSafeInteger(points?.supplyPoints) && points.supplyPoints >= 0 && points.supplyPoints <= 10
    && Number.isSafeInteger(points.campaignPoints) && points.campaignPoints >= 0
    && (!Object.hasOwn(points, 'credits') || validCredits(points.credits));
}

function getTeamLocations(tiles) {
  const locations = new Map(teams.map(team => [team, { bases: [], camps: [], positions: [] }]));
  for (const tile of Array.isArray(tiles) ? tiles : []) {
    if (typeof tile?.id !== 'string' || !tile.id) continue;

    const owner = locations.get(tile.structureColor);
    if (tile.structure === 'base') owner?.bases.push(tile.id);
    if (tile.structure === 'camp') owner?.camps.push(tile.id);

    locations.get(tile.marker)?.positions.push(tile.id);
    if (tile.secondaryMarker !== tile.marker) locations.get(tile.secondaryMarker)?.positions.push(tile.id);
  }
  return locations;
}

export function createExpeditionApi(seed, accounts, storage, { battlesEnabled = expeditionBattlesEnabled } = {}) {
  let map = structuredClone(seed);
  let savedRound;
  const readSavedRound = () => {
    try {
      const stored = Number(storage?.getItem(roundStorageKey));
      if (validRound(stored)) return stored;
    } catch {
      // Use the running preview's round when browser storage is unavailable.
    }
    return savedRound;
  };
  const readRound = () => {
    const round = readSavedRound() ?? Number(map.round);
    return validRound(round) ? round : 1;
  };
  const rosters = new Map();
  const rosterKey = team => `expedition-preview-roster-${team}`;
  const readRoster = team => {
    const stored = storage?.getItem(rosterKey(team));
    if (!stored) return rosters.get(team) ?? { units: [], items: [] };
    const { units, items, displayName } = JSON.parse(stored);
    if (!Array.isArray(units) || !Array.isArray(items)) throw new Error('Invalid stored roster.');
    return { units, items, ...(typeof displayName === 'string' && displayName.trim() ? { displayName } : {}) };
  };
  const writeRoster = (team, roster) => {
    if (storage) storage.setItem(rosterKey(team), JSON.stringify(roster));
    else rosters.set(team, roster);
  };
  const readTeamPoints = team => {
    const { supplyPoints, campaignPoints, credits } = map.teamStats?.[team] ?? {};
    return {
      supplyPoints: Number.isSafeInteger(supplyPoints) && supplyPoints > 0 ? Math.min(10, supplyPoints) : 0,
      campaignPoints: Number.isSafeInteger(campaignPoints) && campaignPoints > 0 ? campaignPoints : 0,
      credits: validCredits(credits) ? credits : 0,
    };
  };
  function withCurrentCredits(teamStats) {
    if (!teamStats || typeof teamStats !== 'object' || Array.isArray(teamStats)) return map.teamStats;
    const next = structuredClone(teamStats);
    for (const team of teams) {
      const credits = map.teamStats?.[team]?.credits;
      if (validCredits(credits)) next[team] = { ...next[team], credits };
      else if (next[team]) delete next[team].credits;
    }
    return next;
  }
  const savedSettings = {};
  for (const { field, validate } of Object.values(requestSettings)) {
    if (validate(map[field])) savedSettings[field] = map[field];
    delete map[field];
  }
  const storageKey = route => `expedition-preview-${route.slice(1)}`;
  const readMap = () => {
    const result = { ...map, ...savedSettings };
    const round = readSavedRound();
    if (round !== undefined) result.round = round;
    for (const [route, { field, validate }] of Object.entries(requestSettings)) {
      try {
        const value = JSON.parse(storage?.getItem(storageKey(route)) ?? 'null');
        if (validate(value)) result[field] = value;
      } catch {
        // Use the campaign value if browser storage is unavailable or invalid.
      }
    }
    return result;
  };
  let requests = [];
  function commitBattleState(nextRequests, teamStats = map.teamStats) {
    try {
      storage?.setItem(battleStateKey, JSON.stringify({ battles: nextRequests.filter(isBattle), teamStats }));
      requests = nextRequests;
      map.teamStats = teamStats;
      return true;
    } catch {
      return false;
    }
  }
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return async (account, input, options = {}) => {
    if (!account || !roles.includes(account.role)) return reply({ message: 'Invalid simulated account.' }, 401);
    const saved = accounts.find(account.username);
    const role = expeditionRole({ ...saved, role: account.role });
    const team = saved?.expeditionTeam || '';
    const admin = ['admin', 'owner'].includes(role);
    const user = { id: saved?.id || `preview:${account.username.trim().toLowerCase()}`, username: account.username, role: account.role };
    const route = new URL(input).pathname.replace(/^\/expedition/, '');
    const method = (options.method || 'GET').toUpperCase();
    let body;
    try { body = options.body ? JSON.parse(options.body) : {}; }
    catch { return reply({ message: 'Invalid JSON request.' }, 400); }
    const forbidden = () => reply({ message: 'This account cannot perform that Expedition action.' }, 403);
    const battlesUnavailable = () => reply({ message: battlesUnavailableMessage }, 503);
    if (!battlesEnabled && ['/battles', '/battle-settings'].includes(route)) return battlesUnavailable();
    const own = request => request.requesterUserId === user.id;
    const canSeeBattle = request => admin || own(request) || (team && battleParticipants(request.changeSet).includes(team));
    const saveError = () => reply({ message: 'Unable to save Expedition battles and point balances in browser storage.' }, 500);
    try {
      const stored = storage?.getItem(battleStateKey);
      if (stored) {
        const { battles, teamStats } = JSON.parse(stored);
        requests = [...requests.filter(request => !isBattle(request)), ...battles];
        if (teamStats) map.teamStats = teamStats;
      }
    } catch {
      return reply({ message: 'Unable to load Expedition battles and point balances from browser storage.' }, 500);
    }
    const patron = target => ({
      id: target.id, username: target.username, email: '', siteRole: target.role,
      expeditionRole: expeditionRole(target),
      expeditionMembershipRole: target.role === 'owner' ? 'owner' : target.expeditionMembershipRole || 'viewer',
      expeditionTeam: target.expeditionTeam || '',
      canEditExpeditionRole: admin && !['owner', 'admin'].includes(target.role),
    });
    if (route === '/access') return reply({ user, access: { role, membershipRole: saved?.expeditionMembershipRole || 'viewer', team, canManageRoles: admin } });
    if (route === '/roles/list') return admin ? reply({ patrons: accounts.list().map(patron) }) : forbidden();
    if (route === '/roles/set-role' && method === 'POST') {
      if (!admin) return forbidden();
      const target = accounts.list().find(item => item.id === body.targetUserId);
      if (!target) return reply({ message: 'Saved account not found.' }, 404);
      const currentRole = target.expeditionMembershipRole || 'viewer';
      // The inherited-role control submits "owner" for site admins and owners.
      const nextRole = ['owner', 'admin'].includes(target.role) && body.role === 'owner' ? currentRole : body.role;
      if ((!patron(target).canEditExpeditionRole && nextRole !== currentRole) ||
          (target.role === 'owner' && account.role !== 'owner' && body.team !== (target.expeditionTeam || ''))) return forbidden();
      if (!expeditionRoles.includes(nextRole) || !expeditionTeams.includes(body.team)) return reply({ message: 'Invalid Expedition permission or team.' }, 400);
      try { return reply({ patron: patron(accounts.assignExpedition(target.id, nextRole, body.team)), message: 'Expedition membership saved.' }); }
      catch (error) { return reply({ message: error.message }, 500); }
    }
    if (route === '/round') {
      if (method === 'GET') return reply({ round: readRound() });
      if (method === 'POST') {
        if (!admin) return forbidden();
        const { round, expectedRound } = body ?? {};
        if (!validRound(round) || !validRound(expectedRound)) {
          return reply({ message: 'Enter a whole round number of at least 1.' }, 400);
        }
        const current = readRound();
        if (current !== expectedRound) {
          return reply({ round: current, message: 'The round changed while you were editing. Review the current round before saving.' }, 409);
        }
        try {
          storage?.setItem(roundStorageKey, String(round));
          savedRound = round;
          return reply({ round, message: 'Expedition round saved.' });
        } catch {
          return reply({ message: 'Unable to save the round in browser storage.' }, 500);
        }
      }
    }
    if (route === '/battles' && method === 'GET') {
      return reply({
        battles: requests.filter(request => isBattle(request) && canSeeBattle(request))
          .map(({ requesterEmail, ...request }) => ({ ...request, own: own(request) })),
        team, teams, canLog: admin || (role === 'traveler' && Boolean(team)), canReview: admin,
      });
    }
    if (method === 'POST' && (route === '/battle-settings' || Object.hasOwn(requestSettings, route))) {
      if (!admin) return forbidden();
      const settingsRoute = route === '/battle-settings' ? '/point-rewards' : route;
      const { field, label, validate, invalidMessage } = requestSettings[settingsRoute];
      let value = body?.[field];
      if (settingsRoute === '/point-rewards' && (route === '/battle-settings' || !validate(value))) {
        const fields = route === '/battle-settings' ? battleFields : mapGroups.flatMap(([, group]) => group);
        if (!value || Object.keys(value).length !== fields.length || !fields.every(([key]) => Object.hasOwn(value, key))) {
          return reply({ message: invalidMessage }, 400);
        }
        value = { ...readSettings(readMap().pointRewards), ...value };
      }
      if (!validate(value)) return reply({ message: invalidMessage }, 400);
      if (!battlesEnabled && settingsRoute === '/point-rewards') {
        const existing = readSettings(readMap().pointRewards);
        value = { ...value, ...Object.fromEntries(battleFields.map(([key]) => [key, existing[key]])) };
      }
      try {
        storage?.setItem(storageKey(settingsRoute), JSON.stringify(value));
      } catch {
        return reply({ message: `Unable to save ${label.toLowerCase()} in browser storage.` }, 500);
      }
      savedSettings[field] = value;
      return reply({ [field]: value, message: `${label} saved.` });
    }
    if (route === '/map' && method === 'GET') return reply(readMap());
    if (route === '/map' && method === 'POST') {
      if (!admin) return forbidden();
      if (!body.map || !Array.isArray(body.map.tiles)) return reply({ message: 'A map with tiles is required.' }, 400);
      if (!commitBattleState(requests, withCurrentCredits(body.map.teamStats))) return saveError();
      map = { ...structuredClone(body.map), ...(map.teamStats ? { teamStats: map.teamStats } : {}) };
      for (const { field } of Object.values(requestSettings)) delete map[field];
      return reply({ map: readMap(), message: 'Expedition map saved locally.' });
    }
    if (route === '/team-stats' && method === 'POST') {
      if (!admin) return forbidden();
      const stats = body.teamStats;
      if (!stats || teams.some(team =>
        !Number.isFinite(stats[team]?.supplyPoints) || stats[team].supplyPoints < 0 ||
        !Number.isFinite(stats[team]?.campaignPoints) || stats[team].campaignPoints < 0)) return reply({ message: 'Invalid team points.' }, 400);
      if (!commitBattleState(requests, withCurrentCredits(stats))) return saveError();
      return reply({ teamStats: map.teamStats, message: 'Team points saved locally.' });
    }
    if (route === '/teams' && method === 'GET') {
      try {
        const locations = getTeamLocations(map.tiles);
        return reply({
          assignedTeam: team,
          teams: teams.map(name => ({
            name,
            ...readRoster(name),
            points: readTeamPoints(name),
            locations: locations.get(name),
            canAddEntries: admin || (role === 'traveler' && name === team),
            canUploadUnitImages: role === 'traveler' && name === team,
            canEditPoints: admin,
          })),
        });
      } catch {
        return reply({ message: 'Unable to load team rosters from browser storage.' }, 500);
      }
    }
    const teamRoute = route.match(/^\/teams\/([a-z]+)\/(name|units|items|points|weapons|abilities|actions|unit-image|unit-order)$/);
    if (teamRoute && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      const [, target, collection] = teamRoute;
      if (!teams.includes(target)) return reply({ message: 'Expedition team not found.' }, 404);
      const editing = method === 'PATCH';
      const deleting = method === 'DELETE';
      if (deleting && !['abilities', 'actions'].includes(collection)) {
        return reply({ message: 'Removal is available for abilities and actions.' }, 405);
      }
      if (editing && ['name', 'items', 'points', 'unit-image', 'unit-order'].includes(collection)) {
        return reply({ message: 'Use POST for this team endpoint.' }, 405);
      }

      if (collection === 'points') {
        if (!admin) return forbidden();
        if (!validTeamPoints(body?.points) || !validTeamPoints(body.expectedPoints)) {
          return reply({ message: 'Enter whole-number balances with Supply Points from 0 to 10 and Campaign Points and Credits at least 0.' }, 400);
        }
        const current = readTeamPoints(target);
        if (body.expectedPoints.supplyPoints !== current.supplyPoints
          || body.expectedPoints.campaignPoints !== current.campaignPoints
          || (Object.hasOwn(body.points, 'credits') && (body.expectedPoints.credits ?? 0) !== current.credits)) {
          return reply({ points: current, message: 'The balances changed while you were editing. Review the latest balances before saving.' }, 409);
        }
        const { supplyPoints, campaignPoints, credits = current.credits } = body.points;
        const points = { supplyPoints, campaignPoints, credits };
        const stats = { ...map.teamStats, [target]: { ...map.teamStats?.[target], ...points } };
        if (!commitBattleState(requests, stats)) return saveError();
        return reply({ points, message: 'Team points saved.' });
      }

      if (collection === 'unit-image') {
        if (role !== 'traveler' || target !== team) return forbidden();
        const image = body?.image;
        if (!validUnitImage(image)) return reply({ message: 'Choose a valid PNG, JPEG, or WebP image.' }, 400);
        try {
          const roster = readRoster(target);
          const unit = roster.units.find(entry => entry.id === body.unitId);
          if (!unit) return reply({ message: 'Unit not found on this team.' }, 404);
          const units = roster.units.map(entry => entry === unit ? { ...entry, image } : entry);
          writeRoster(target, { ...roster, units });
          return reply({ image, message: 'Unit image saved.' });
        } catch {
          return reply({ message: 'Unable to save the image in browser storage.' }, 500);
        }
      }
      if (!admin && (role !== 'traveler' || target !== team)) return forbidden();
      if (collection === 'unit-order') {
        const { unitId, entryId, direction, collection: section } = body ?? {};
        if (typeof section !== 'string' || !Object.hasOwn(unitEntryTypes, section) || ![-1, 1].includes(direction)) {
          return reply({ message: 'Choose a section and a valid move direction.' }, 400);
        }
        try {
          const roster = readRoster(target);
          const unit = roster.units.find(entry => entry.id === unitId);
          if (!unit) return reply({ message: 'Unit not found on this team.' }, 404);
          const entries = [...orderedUnitEntries(section, unit[section] ?? [])];
          const index = entries.findIndex(entry => entry.id === entryId);
          if (index === -1) return reply({ message: 'Entry not found in this unit section.' }, 404);
          const nextIndex = unitMoveTarget(section, entries, index, direction);
          if (nextIndex === -1) return reply({ message: 'This entry cannot move further in that direction.' }, 409);
          [entries[index], entries[nextIndex]] = [entries[nextIndex], entries[index]];
          const units = roster.units.map(entry => entry === unit ? { ...entry, [section]: entries } : entry);
          writeRoster(target, { ...roster, units });
          return reply({ order: entries.map(entry => entry.id), message: 'Order saved.' });
        } catch {
          return reply({ message: 'Unable to save the new order in browser storage.' }, 500);
        }
      }
      if (collection === 'name') {
        const displayName = typeof body?.name === 'string' ? body.name.trim() : '';
        if (!displayName || displayName.length > 100) return reply({ message: 'Enter a team name from 1 to 100 characters.' }, 400);
        try {
          writeRoster(target, { ...readRoster(target), displayName });
          return reply({ displayName, message: 'Team name saved.' });
        } catch {
          return reply({ message: 'Unable to save the team name in browser storage.' }, 500);
        }
      }
      if (Object.hasOwn(unitEntryTypes, collection)) {
        const { key, validate } = unitEntryTypes[collection];
        const { profile, error } = deleting ? {} : validate(body?.[key]);
        if (error) return reply({ message: error }, 400);
        try {
          const roster = readRoster(target);
          const unit = roster.units.find(entry => entry.id === body?.unitId);
          if (!unit) return reply({ message: 'Unit not found on this team.' }, 404);
          const entries = unit[collection] ?? [];
          const existing = (editing || deleting) ? entries.find(entry => entry.id === body.entryId) : null;
          if ((editing || deleting) && !existing) return reply({ message: `The ${key} was not found on this unit.` }, 404);
          if (deleting) {
            const units = roster.units.map(entry => entry === unit
              ? { ...entry, [collection]: entries.filter(item => item !== existing) }
              : entry);
            writeRoster(target, { ...roster, units });
            return reply({ entryId: existing.id, message: `${existing.name} removed.` });
          }
          const updated = { ...existing, id: existing?.id ?? crypto.randomUUID(), ...profile };
          const updatedEntries = editing ? entries.map(entry => entry === existing ? updated : entry) : [...entries, updated];
          const units = roster.units.map(entry => entry === unit
            ? { ...entry, [collection]: orderedUnitEntries(collection, updatedEntries) }
            : entry);
          writeRoster(target, { ...roster, units });
          return reply({ [key]: updated, message: `${updated.name} ${editing ? 'saved' : 'added'}.` }, editing ? 200 : 201);
        } catch {
          return reply({ message: 'Unable to save the team roster in browser storage.' }, 500);
        }
      }
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 100) return reply({ message: 'Enter a name from 1 to 100 characters.' }, 400);
      const entry = { id: editing ? body.unitId : crypto.randomUUID(), name };
      if (collection === 'units') {
        const stats = body?.stats;
        if (editing && stats !== undefined && (!stats || typeof stats !== 'object' || Array.isArray(stats))) {
          return reply({ message: 'Enter valid unit stats.' }, 400);
        }
        const updatedStats = {};
        for (const { key, label, min } of unitStatFields) {
          if (editing && !Object.hasOwn(stats ?? {}, key)) continue;
          if (!Number.isSafeInteger(stats?.[key]) || stats[key] < min) {
            return reply({ message: `Enter a whole-number ${label} stat of at least ${min}.` }, 400);
          }
          updatedStats[key] = stats[key];
        }
        if (Object.keys(updatedStats).length) entry.stats = updatedStats;
      }
      try {
        const roster = readRoster(target);
        if (editing) {
          const unit = roster.units.find(unit => unit.id === entry.id);
          if (!unit) return reply({ message: 'Unit not found on this team.' }, 404);
          const updated = { ...unit, name, ...(entry.stats ? { stats: { ...unit.stats, ...entry.stats } } : {}) };
          writeRoster(target, { ...roster, units: roster.units.map(item => item === unit ? updated : item) });
          return reply({ entry: updated, message: 'Unit saved.' });
        }
        const entries = [...roster[collection], entry];
        writeRoster(target, { ...roster, [collection]: entries });
        return reply({ entry, entries, message: 'Roster updated.' }, 201);
      } catch {
        return reply({ message: 'Unable to save the team roster in browser storage.' }, 500);
      }
    }
    if (route === '/bounties/list') return reply({ bounties: [], pendingRequests: [] });
    if (route.startsWith('/map-requests')) {
      const pending = requests.filter(request => request.status === 'pending');
      const visible = request => battlesEnabled || !isBattle(request);
      if (route === '/map-requests/list') return admin ? reply({ requests: pending.filter(visible) }) : forbidden();
      if (route === '/map-requests/mine') return reply({ requests: pending.filter(request => visible(request) && own(request)) });
      if (route === '/map-requests/history') return reply({
        requests: requests.filter(request => request.status !== 'pending' && visible(request) && (!isBattle(request) || canSeeBattle(request))),
      });
      if (method === 'POST' && ['/map-requests', '/map-requests/update'].includes(route)) {
        if (!admin && role !== 'traveler') return forbidden();
        if (!body.changeSet || typeof body.changeSet !== 'object' || Array.isArray(body.changeSet)) return reply({ message: 'A change set is required.' }, 400);
        const existing = route.endsWith('/update') ? pending.find(request => request.id === body.requestId) : null;
        if (route.endsWith('/update') && !existing) return reply({ message: 'Request not found.' }, 404);
        if (existing && !admin && !own(existing)) return forbidden();
        if (!admin && (!team || body.changeSet.requesterTeam !== team)) return reply({ message: 'Choose your assigned Expedition team.' }, 403);
        if (!visible(existing) || !visible(body)) return battlesUnavailable();
        if (existing && isBattle(existing) !== (body.changeSet.requestType === 'battle')) {
          return reply({ message: 'A battle report cannot be converted into a map request or vice versa.' }, 400);
        }
        if (body.changeSet.requestType === 'battle') {
          const error = validateBattle(body.changeSet, teams, map.tiles);
          if (error) return reply({ message: error }, 400);
        }
        const request = {
          ...(existing || { id: crypto.randomUUID(), requesterUserId: user.id, requesterUsername: user.username, requesterEmail: '', createdAt: new Date().toISOString() }),
          changeSet: structuredClone(body.changeSet), status: 'pending', updatedAt: new Date().toISOString(),
        };
        const next = existing ? requests.map(item => item === existing ? request : item) : [...requests, request];
        if (isBattle(request) && !commitBattleState(next)) return saveError();
        requests = next;
        return reply({ request, message: 'Expedition request saved locally.' });
      }
      if (method === 'POST' && ['/map-requests/deny', '/map-requests/cancel-own'].includes(route)) {
        const request = pending.find(request => request.id === body.requestId);
        if (!request) return reply({ message: 'Request not found.' }, 404);
        if (route.endsWith('/deny') ? !admin : !own(request)) return forbidden();
        if (!visible(request)) return battlesUnavailable();
        const updated = { ...request, status: route.endsWith('/deny') ? 'denied' : 'canceled', reviewedAt: new Date().toISOString(), reviewedByUsername: user.username };
        const next = requests.map(item => item === request ? updated : item);
        if (isBattle(request) && !commitBattleState(next)) return saveError();
        requests = next;
        return reply({ request: updated, message: 'Request closed.' });
      }
      if (method === 'POST' && route === '/map-requests/accept' && typeof body?.requestId === 'string') {
        if (!admin) return forbidden();
        const request = pending.find(item => item.id === body.requestId);
        if (!request) return reply({ message: 'Request not found.' }, 404);
        if (!visible(request)) return battlesUnavailable();
        const change = request.changeSet;
        const isResupply = change.requestType === 'action' && change.actionType === 'resupply';
        const isPointOnly = Array.isArray(change.changes) && change.changes.length === 0
          && ((change.requestType === 'action' && change.actionType === 'search')
            || (change.requestType === 'movement' && change.movementType === 'manoeuvre'));
        let awards;
        if (change.requestType === 'battle') {
          awards = battleAwards(change, readMap().pointRewards, teams);
        } else if (isResupply || isPointOnly) {
          const { requesterTeam, supplyPointsCost = 0, supplyPointsGain = 0, campaignPointsGain = 0 } = change;
          if (!teams.includes(requesterTeam) || [supplyPointsCost, supplyPointsGain, campaignPointsGain]
            .some(value => !Number.isSafeInteger(value) || value < 0)
            || supplyPointsGain > 10 || (isResupply && (campaignPointsGain || supplyPointsCost))) {
            return reply({ message: 'Invalid point amounts in this request.' }, 400);
          }
          if (supplyPointsCost > (map.teamStats?.[requesterTeam]?.supplyPoints ?? 0)) {
            return reply({ message: 'The requester team has insufficient Supply Points.' }, 409);
          }
          awards = [
            [requesterTeam, 'supplyPoints', supplyPointsGain - supplyPointsCost],
            [requesterTeam, 'campaignPoints', campaignPointsGain],
          ];
        }
        if (awards) {
          const stats = structuredClone(map.teamStats ?? {});
          const awardedPoints = [];
          for (const [recipient, field, amount] of awards) {
            stats[recipient] ??= { supplyPoints: 0, campaignPoints: 0 };
            const limit = field === 'supplyPoints' ? 10 : Number.MAX_SAFE_INTEGER;
            const previous = stats[recipient][field] ?? 0;
            stats[recipient][field] = Math.min(limit, Math.max(0, previous + amount));
            const gained = stats[recipient][field] - previous;
            if (gained > 0) awardedPoints.push({ team: recipient, field, amount: gained });
          }
          const updated = {
            ...request, status: 'accepted', reviewedAt: new Date().toISOString(), reviewedByUsername: user.username,
            ...(isBattle(request) ? { awardedPoints } : {}),
          };
          if (!commitBattleState(requests.map(item => item === request ? updated : item), stats)) return saveError();
          return reply({ request: updated, map: readMap(), message: 'Expedition request accepted.' });
        }
      }
    }
    return reply({ message: `The local simulator does not implement ${method} /expedition${route}. No changes were saved.` }, 501);
  };
}
