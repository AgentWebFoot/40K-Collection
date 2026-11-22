import { roles, expeditionRole, expeditionRoles, expeditionTeams } from './accounts.mjs';
import '../Expedition/point-rewards.js';
import {
  battleEquipmentLimit, battleParticipants, battlePayoutAwards, battlesUnavailableMessage, battleSubmissionRound, battleTypes,
  equipmentCount, expeditionBattlesEnabled, projectedBattlePayouts, validateBattle, validRewardOverrides,
} from '../Expedition/battle-rules.mjs';
import {
  orderedUnitEntries, unitMoveTarget, unitStatFields, validUnitImage, validateUnitRule, validateWeaponProfile,
} from '../Expedition/unit-rules.mjs';
import { factionEquipmentLimits, factionEquipmentSlotCount, factionEquipmentSlots } from '../Expedition/faction-equipment.mjs';
import { universalEquipment } from '../Expedition/universal-equipment.mjs';

const { validateSettings, readSettings, battleFields, mapGroups } = globalThis.ExpeditionPointRewards;
const teams = expeditionTeams.filter(Boolean);
const isBattle = request => request?.changeSet?.requestType === 'battle';
const battleStateKey = 'expedition-preview-battles';
const roundStorageKey = 'expedition-preview-round';
const shopStorageKey = 'expedition-preview-shop';
const universalEquipmentStorageKey = 'expedition-preview-universal-equipment';
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
const positiveQuantity = value => Number.isSafeInteger(value) && value > 0;
const purchaseRemaining = purchase => purchase.quantity - (purchase.usedQuantity ?? 0);
function equipmentAction(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string') return null;
  const action = value.trim();
  return action.length <= factionEquipmentLimits.description ? action : null;
}
const equipmentRules = ({ description, action }) => ({
  ...(description ? { description } : {}), ...(action ? { action } : {}),
});
const validStockLimit = value => value === null || positiveQuantity(value);

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
    const { units, items, displayName, lore, factionEquipment } = JSON.parse(stored);
    if (!Array.isArray(units) || !Array.isArray(items)) throw new Error('Invalid stored roster.');
    return {
      units, items,
      ...(Array.isArray(factionEquipment) ? { factionEquipment } : {}),
      ...(typeof displayName === 'string' && displayName.trim() ? { displayName } : {}),
      ...(typeof lore === 'string' ? { lore } : {}),
    };
  };
  const writeRoster = (team, roster) => {
    if (storage) storage.setItem(rosterKey(team), JSON.stringify(roster));
    else rosters.set(team, roster);
  };
  let universalProfiles = {};
  const readUniversalProfiles = () => {
    const stored = storage?.getItem(universalEquipmentStorageKey);
    return stored ? JSON.parse(stored) : universalProfiles;
  };
  const universalCatalog = () => {
    const profiles = readUniversalProfiles();
    return universalEquipment.map(item => ({ ...item, ...profiles[item.id] }));
  };
  let shopState;
  const readShop = () => {
    if (shopState) return shopState;
    const items = JSON.parse(storage?.getItem(shopStorageKey) ?? '[]');
    if (!Array.isArray(items)) throw new Error('Invalid stored shop inventory.');
    return {
      items: items.map(item => ({ ...item, perUser: 1, remaining: null })),
      purchases: [],
    };
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
  let lorePosts = [];
  function purchaseUses(reports) {
    const uses = new Map();
    for (const report of reports) {
      for (const { items } of report.equipmentUsed ?? []) {
        for (const item of items) {
          if (item.kind === 'purchased') uses.set(item.id, (uses.get(item.id) ?? 0) + item.quantity);
        }
      }
    }
    return uses;
  }
  function battleEquipmentOptions(team, replacingReport) {
    const reserved = purchaseUses(requests.filter(report => report.status === 'pending' && report.id !== replacingReport));
    const faction = factionEquipmentSlots(readRoster(team).factionEquipment).flatMap((entry, index) =>
      entry ? [{ id: `faction:${index + 1}`, name: entry.name, kind: 'faction', available: 1, ...equipmentRules(entry) }] : []);
    const purchased = readShop().purchases.filter(item => item.team === team)
      .map(item => ({
        id: item.id, name: item.name, kind: 'purchased',
        available: purchaseRemaining(item) - (reserved.get(item.id) ?? 0),
        ...equipmentRules(item),
      })).filter(item => item.available > 0);
    const universal = universalCatalog().map(item => ({ ...item, id: `universal:${item.id}`, kind: 'universal', available: 1 }));
    return [...faction, ...purchased, ...universal];
  }
  function readBattleEquipment(choices, team, replacingReport) {
    if (!Array.isArray(choices) || choices.some(choice => typeof choice?.id !== 'string' || !positiveQuantity(choice.quantity))
      || equipmentCount(choices) > battleEquipmentLimit || new Set(choices.map(choice => choice.id)).size !== choices.length) {
      return { status: 400, message: `Choose up to ${battleEquipmentLimit} pieces of equipment.` };
    }
    if (!choices.length) return { items: [] };
    let options;
    try {
      options = new Map(battleEquipmentOptions(team, replacingReport).map(item => [item.id, item]));
    } catch {
      return { status: 500, message: 'Unable to load available battle equipment.' };
    }
    const items = [];
    for (const { id, quantity } of choices) {
      const option = options.get(id);
      if (!option || quantity > option.available) return { status: 409, message: 'Some selected equipment is unavailable. Refresh the equipment list and choose again.' };
      items.push({ id, quantity, name: option.name, kind: option.kind });
    }
    return { items };
  }
  function commitCampaignState(nextRequests, teamStats = map.teamStats, shop = shopState, nextMap) {
    try {
      const state = { battles: nextRequests.filter(isBattle), teamStats, shop };
      if (storage?.writeCampaignState) storage.writeCampaignState({ ...state, map: nextMap });
      else storage?.setItem(battleStateKey, JSON.stringify(state));
      requests = nextRequests;
      map.teamStats = teamStats;
      shopState = shop;
      return true;
    } catch {
      return false;
    }
  }
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  async function handleRequest(account, input, options = {}) {
    if (!account || !roles.includes(account.role)) return reply({ message: 'Invalid simulated account.' }, 401);
    const saved = accounts.find(account.username);
    const role = expeditionRole({ ...saved, role: account.role });
    const team = saved?.expeditionTeam || '';
    const admin = ['admin', 'owner'].includes(role);
    const canManageRoles = admin || account.role === 'manager';
    const user = { id: saved?.id || `preview:${account.username.trim().toLowerCase()}`, username: account.username, role: account.role };
    const route = new URL(input).pathname.replace(/^\/expedition/, '');
    const method = (options.method || 'GET').toUpperCase();
    let body;
    try { body = options.body ? JSON.parse(options.body) : {}; }
    catch { return reply({ message: 'Invalid JSON request.' }, 400); }
    const forbidden = () => reply({ message: 'This account cannot perform that Expedition action.' }, 403);
    const battlesUnavailable = () => reply({ message: battlesUnavailableMessage }, 503);
    if (!battlesEnabled && ['/battles', '/battle-settings', '/battle-equipment'].includes(route)) return battlesUnavailable();
    const own = request => request.requesterUserId === user.id;
    const canSeeBattle = request => admin || own(request) || (team && battleParticipants(request.changeSet).includes(team));
    const canLog = admin || (role === 'traveler' && Boolean(team));
    const battleReview = request => {
      const { changeSet, status } = request;
      const sameTeamJointOp = changeSet.battleType === 'joint-op' && changeSet.battleOpponent === changeSet.requesterTeam;
      const requiredTeams = battleParticipants(changeSet).filter(participant =>
        teams.includes(participant) && (participant !== changeSet.requesterTeam || sameTeamJointOp));
      const confirmedTeams = (request.confirmedTeams ?? []).filter(participant => requiredTeams.includes(participant));
      return {
        requiredTeams,
        confirmedTeams,
        canConfirm: status === 'pending' && canLog && !own(request) && requiredTeams.includes(team) && !confirmedTeams.includes(team),
        canApprove: status === 'pending' && admin,
        canEdit: status === 'accepted' ? admin : status === 'pending' && (admin || (canLog && own(request))),
        requiresAdminApproval: Object.keys(request.rewardOverrides ?? {}).length > 0,
      };
    };
    const battleReport = ({ requesterEmail, ...request }) => ({
      ...request, own: own(request), revision: request.revision ?? 1, review: battleReview(request),
      ...(request.status === 'pending' ? {
        projectedRewards: projectedBattlePayouts(request.changeSet, readMap().pointRewards, teams, map.teamStats, request.rewardOverrides),
      } : {}),
    });
    const isStaleReview = request => body?.expectedRevision != null && body.expectedRevision !== (request.revision ?? 1);
    const staleReview = () => reply({ message: 'The battle report was edited. Refresh the report before continuing.' }, 409);
    const saveError = () => reply({ message: 'Unable to save Expedition battles and point balances in browser storage.' }, 500);
    const acceptRequest = (request, awards, approvalMethod, shop = shopState) => {
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
      const battle = isBattle(request);
      const updated = {
        ...request, status: 'accepted', reviewedAt: new Date().toISOString(), reviewedByUsername: user.username,
        ...(battle ? { awardedPoints, approvalMethod } : {}),
      };
      const next = requests.some(item => item.id === updated.id)
        ? requests.map(item => item.id === updated.id ? updated : item)
        : [...requests, updated];
      if (!commitCampaignState(next, stats, shop)) return saveError();
      return reply({ request: battle ? battleReport(updated) : updated, map: readMap(), message: 'Expedition request accepted.' });
    };
    const acceptBattle = (request, approvalMethod) => {
      const uses = purchaseUses([request]);
      let shop = shopState;
      if (uses.size) {
        const current = readShop();
        const purchases = new Map(current.purchases.map(item => [item.id, item]));
        for (const [id, quantity] of uses) {
          const item = purchases.get(id);
          if (!item || quantity > purchaseRemaining(item)) return reply({ message: 'Purchased equipment used in this report is unavailable.' }, 409);
        }
        shop = { ...current, purchases: current.purchases.map(item => uses.has(item.id)
          ? { ...item, usedQuantity: (item.usedQuantity ?? 0) + uses.get(item.id) } : item) };
      }
      return acceptRequest(request, battlePayoutAwards(request.changeSet, readMap().pointRewards, teams, request.rewardOverrides), approvalMethod, shop);
    };
    try {
      const stored = storage?.getItem(battleStateKey);
      if (stored) {
        const { battles, teamStats, shop, map: savedMap } = JSON.parse(stored);
        requests = [...requests.filter(request => !isBattle(request)), ...battles];
        if (savedMap) map = savedMap;
        if (teamStats) map.teamStats = teamStats;
        shopState = shop;
      }
    } catch {
      return reply({ message: 'Unable to load Expedition battles and point balances from browser storage.' }, 500);
    }
    if (route === '/shop' || route.startsWith('/shop/')) {
      const purchase = route === '/shop/purchase' && method === 'POST';
      const create = route === '/shop' && method === 'POST';
      const read = route === '/shop' && method === 'GET';
      const manage = route === '/shop' && method === 'PATCH';
      if (!read && !create && !manage && !purchase) return reply({ message: 'Invalid shop action.' }, 405);
      const canPurchase = teams.includes(team) && (admin || role === 'traveler');
      if (purchase ? !canPurchase : !read && !admin) return forbidden();
      try {
        const shop = readShop();
        const { items, purchases } = shop;
        const credits = canPurchase ? readTeamPoints(team).credits : null;
        function catalog(state, balance = credits) {
          const owned = new Map();
          for (const entry of state.purchases) {
            if (entry.buyer === user.id) owned.set(entry.listingId, (owned.get(entry.listingId) ?? 0) + entry.quantity);
          }
          return {
            items: state.items.filter(item => admin || item.visible === true).map(item => ({ ...item, owned: owned.get(item.id) ?? 0 })),
            canManage: admin, canPurchase, credits: balance,
          };
        }
        if (read) return reply(catalog(shop));

        const saveError = () => reply({ message: 'Unable to save the shop in browser storage.' }, 500);
        if (create) {
          const name = typeof body?.name === 'string' ? body.name.trim() : '';
          const description = typeof body?.description === 'string' ? body.description.trim() : '';
          if (!name || name.length > 100) return reply({ message: 'Enter a name from 1 to 100 characters.' }, 400);
          if (!description || description.length > 2000) return reply({ message: 'Enter an ability from 1 to 2,000 characters.' }, 400);
          const action = equipmentAction(body.action);
          if (action === null) return reply({ message: 'Enter the optional action as text up to 4,000 characters.' }, 400);
          if (!validCredits(body.cost)) return reply({ message: 'Enter a credit cost of 0 or more in whole numbers.' }, 400);
          const item = { id: crypto.randomUUID(), name, description, ...(action ? { action } : {}), cost: body.cost, visible: false, perUser: 1, remaining: null };
          const next = { ...shop, items: [...items, item] };
          return commitCampaignState(requests, map.teamStats, next)
            ? reply({ ...catalog(next), message: `${name} added to Backrooms.` }, 201) : saveError();
        }

        const item = items.find(entry => entry.id === body?.id);
        if (!item || (purchase && item.visible !== true)) {
          return reply({ ...(purchase && catalog(shop)), message: 'Shop listing not found.' }, 404);
        }
        const replaceItem = updated => items.map(entry => entry === item ? updated : entry);
        if (manage) {
          const { stock, visible } = body;
          if (visible !== false && (!validStockLimit(stock?.perUser) || !validStockLimit(stock?.total))) {
            return reply({ message: 'Enter a whole number of at least 1 or choose Unlimited.' }, 400);
          }
          const updated = visible === false
            ? { ...item, visible: false }
            : { ...item, visible: true, perUser: stock.perUser, remaining: stock.total };
          const next = { ...shop, items: replaceItem(updated) };
          const message = visible === false ? `${item.name} removed from Storefront.` : `${item.name} stocked in Storefront.`;
          return commitCampaignState(requests, map.teamStats, next) ? reply({ ...catalog(next), message }) : saveError();
        }

        const { quantity } = body;
        if (!positiveQuantity(quantity)) return reply({ message: 'Enter a quantity of at least 1.' }, 400);
        if (item.remaining !== null && quantity > item.remaining) {
          return reply({ ...catalog(shop), message: 'There is not enough stock for this purchase.' }, 409);
        }
        const owned = purchases.filter(entry => entry.listingId === item.id && entry.buyer === user.id)
          .reduce((sum, entry) => sum + entry.quantity, 0);
        if (item.perUser !== null && quantity > item.perUser - owned) {
          return reply({ ...catalog(shop), message: 'This purchase exceeds your limit for this item.' }, 409);
        }
        const cost = item.cost * quantity;
        if (cost > credits) return reply({ ...catalog(shop), message: 'Your team does not have enough credits.' }, 409);
        const equipment = { id: crypto.randomUUID(), listingId: item.id, buyer: user.id, team, name: item.name, description: item.description,
          ...(item.action ? { action: item.action } : {}), quantity };
        const balance = credits - cost;
        const stats = { ...map.teamStats, [team]: { ...map.teamStats?.[team], credits: balance } };
        const updated = { ...item, remaining: item.remaining === null ? null : item.remaining - quantity };
        const next = { items: replaceItem(updated), purchases: [...purchases, equipment] };
        return commitCampaignState(requests, stats, next)
          ? reply({ ...catalog(next, balance), message: `${item.name} added to team Equipment.` }, 201) : saveError();
      } catch {
        return reply({ message: 'Unable to load or save the shop in browser storage.' }, 500);
      }
    }
    const patron = target => ({
      id: target.id, username: target.username, email: '', siteRole: target.role,
      expeditionRole: expeditionRole(target),
      expeditionMembershipRole: target.role === 'owner' ? 'owner' : target.expeditionMembershipRole || 'viewer',
      expeditionTeam: target.expeditionTeam || '',
      canEditExpeditionRole: canManageRoles && target.role !== 'owner',
      canEditExpeditionTeam: admin && (target.role !== 'owner' || role === 'owner'),
    });
    if (route === '/access') return reply({ user, access: { role, membershipRole: saved?.expeditionMembershipRole || 'viewer', team, canManageRoles, canUseAdminMode: admin } });
    if (route === '/roles/list') return canManageRoles ? reply({ patrons: accounts.list().map(patron) }) : forbidden();
    if (route === '/roles/set-role' && method === 'POST') {
      if (!canManageRoles) return forbidden();
      const target = accounts.list().find(item => item.id === body.targetUserId);
      if (!target) return reply({ message: 'Saved account not found.' }, 404);
      const currentRole = target.expeditionMembershipRole || 'viewer';
      const currentTeam = target.expeditionTeam || '';
      const nextRole = target.role === 'owner' && body.role === 'owner' ? currentRole : body.role;
      const nextTeam = admin ? body.team : currentTeam;
      if (target.role === 'owner' && (nextRole !== currentRole || (role !== 'owner' && (!admin || nextTeam !== currentTeam)))) return forbidden();
      if (!expeditionRoles.includes(nextRole) || !expeditionTeams.includes(nextTeam)) return reply({ message: 'Invalid Expedition permission or team.' }, 400);
      try { return reply({ patron: patron(accounts.assignExpedition(target.id, nextRole, nextTeam)), message: 'Expedition membership saved.' }); }
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
    if (route === '/lore') {
      const canPost = canLog && teams.includes(team);
      const round = readRound();
      const tiles = (map.tiles ?? []).filter(tile => typeof tile?.id === 'string' && tile.id && Number(tile.type) !== 0)
        .map(({ id, locationNumber }) => ({ id, locationNumber }));
      const visibleBattles = battlesEnabled
        ? requests.filter(request => isBattle(request) && request.status === 'accepted' && canSeeBattle(request)) : [];
      const battleById = new Map(visibleBattles.map(({ id, changeSet, createdAt }) => [id, {
        id, name: typeof changeSet.battleName === 'string' && changeSet.battleName.trim() || 'Unnamed battle',
        type: battleTypes[changeSet.battleType], date: String(changeSet.battleDate || createdAt || '').slice(0, 10),
        round: battleSubmissionRound(changeSet),
        tileId: typeof changeSet.battleLocation === 'string' ? changeSet.battleLocation.trim() || null : null,
      }]));
      const eligibleBattleIds = new Set(canPost ? visibleBattles.filter(({ changeSet }) => battleParticipants(changeSet).includes(team))
        .map(({ id }) => id) : []);
      const visiblePost = ({ battleId, ...post }) => ({
        ...post, battle: battleById.get(battleId) ?? null, hasBattle: Boolean(battleId),
      });
      if (method !== 'GET' && method !== 'POST') return reply({ message: 'Invalid lore action.' }, 405);
      if (method === 'POST' && !canPost) return forbidden();
      try {
        const posts = storage?.readLore?.() ?? lorePosts;
        if (method === 'GET') {
          const battles = [...eligibleBattleIds].map(id => battleById.get(id)).sort((first, second) => second.date.localeCompare(first.date));
          return reply({ posts: posts.map(visiblePost), round, canPost, tiles, battles });
        }

        const title = typeof body?.title === 'string' ? body.title.trim() : '';
        const text = typeof body?.text === 'string' ? body.text.trim() : '';
        if (!title || title.length > 120 || !text || text.length > 12000) {
          return reply({ message: 'Enter a title of up to 120 characters and lore of up to 12,000 characters.' }, 400);
        }
        const battleId = body.battleId ?? '';
        if (battleId !== '' && !eligibleBattleIds.has(battleId)) {
          return reply({ message: 'Choose an approved battle your team participated in.' }, 400);
        }
        const linkedBattle = battleById.get(battleId);
        const manualTile = typeof body.tileId === 'string' ? body.tileId.trim() : body.tileId ?? '';
        const tileId = linkedBattle?.tileId ?? manualTile;
        if (linkedBattle?.tileId == null && tileId !== '' && !tiles.some(tile => tile.id === tileId)) {
          return reply({ message: 'Enter an existing map tile ID, such as 9-20.' }, 400);
        }
        const linkedRound = linkedBattle?.round;
        if (linkedRound == null && (!validRound(body.round) || body.round > round)) {
          return reply({ message: `Choose a round from 1 through ${round}.` }, 400);
        }
        const post = {
          id: crypto.randomUUID(), title, text, round: linkedRound ?? body.round, team, teamName: readRoster(team).displayName ?? '',
          author: user.username, createdAt: new Date().toISOString(), tileId, battleId,
        };
        const next = [post, ...posts];
        if (storage?.writeLore) storage.writeLore(next);
        else lorePosts = next;
        return reply({ post: visiblePost(post) }, 201);
      } catch {
        return reply({ message: `Unable to ${method === 'POST' ? 'save' : 'load'} Expedition lore.` }, 500);
      }
    }
    if (route === '/battles' && method === 'GET') {
      const visible = requests.filter(request => isBattle(request) && canSeeBattle(request));
      return reply({
        battles: visible.filter(request => request.status === 'accepted').map(battleReport),
        pendingBattles: visible.filter(request => request.status === 'pending' && (canLog || own(request))).map(battleReport),
        team, teams, canLog, canReview: admin,
      });
    }
    if (route === '/battle-equipment' && method === 'GET') {
      const params = new URL(input).searchParams;
      const target = params.get('team');
      if (!canLog || !teams.includes(target) || (!admin && team !== target)) return forbidden();
      const editing = requests.find(report => report.id === params.get('edit') && report.status === 'pending' && isBattle(report) && own(report));
      try {
        return reply({ equipment: battleEquipmentOptions(target, editing?.id) });
      } catch {
        return reply({ message: 'Unable to load available battle equipment.' }, 500);
      }
    }
    if (route === '/universal-equipment' && method === 'PATCH') {
      if (!admin) return forbidden();
      const item = universalEquipment.find(entry => entry.id === body?.id);
      if (!item) return reply({ message: 'Universal equipment not found.' }, 404);
      const description = typeof body.description === 'string' ? body.description.trim() : null;
      const action = equipmentAction(body.action);
      if (description === null || description.length > factionEquipmentLimits.description || action === null) {
        return reply({ message: 'Enter ability and action text up to 4,000 characters each.' }, 400);
      }
      try {
        const profiles = readUniversalProfiles();
        const current = { ...item, ...profiles[item.id] };
        if (body.expectedDescription !== current.description || body.expectedAction !== (current.action ?? '')) {
          return reply({ equipment: current, message: 'This equipment changed while you were editing. Review the saved rules before saving again.' }, 409);
        }
        const updated = { ...item, description, ...(action ? { action } : {}) };
        const next = { ...profiles, [item.id]: { description, ...(action ? { action } : {}) } };
        storage?.setItem(universalEquipmentStorageKey, JSON.stringify(next));
        universalProfiles = next;
        return reply({ equipment: updated, message: 'Universal equipment saved.' });
      } catch {
        return reply({ message: 'Unable to save universal equipment in browser storage.' }, 500);
      }
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
      const teamStats = storage?.writeCampaignState ? map.teamStats : withCurrentCredits(body.map.teamStats);
      if (!commitCampaignState(requests, teamStats, shopState, body.map)) return saveError();
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
      if (!commitCampaignState(requests, withCurrentCredits(stats))) return saveError();
      return reply({ teamStats: map.teamStats, message: 'Team points saved locally.' });
    }
    if (route === '/teams' && method === 'GET') {
      try {
        const locations = getTeamLocations(map.tiles);
        return reply({
          assignedTeam: team,
          universalEquipment: universalCatalog(),
          teams: teams.map(name => {
            const roster = readRoster(name);
            const purchased = (shopState?.purchases ?? []).filter(item => item.team === name && purchaseRemaining(item) > 0)
              .map(item => ({ id: item.id, name: item.name, description: item.description,
                ...(item.action ? { action: item.action } : {}), quantity: purchaseRemaining(item) }));
            return {
              name,
              ...roster,
              items: [...roster.items, ...purchased],
              factionEquipment: factionEquipmentSlots(roster.factionEquipment),
              points: readTeamPoints(name),
              locations: locations.get(name),
              canAddEntries: admin || (role === 'traveler' && name === team),
              canAddEquipment: admin,
              canUploadUnitImages: role === 'traveler' && name === team,
              canEditPoints: admin,
            };
          }),
        });
      } catch {
        return reply({ message: 'Unable to load team rosters from browser storage.' }, 500);
      }
    }
    const teamRoute = route.match(/^\/teams\/([a-z]+)\/(name|lore|units|items|faction-equipment|points|weapons|abilities|actions|unit-image|unit-order)$/);
    if (teamRoute && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      const [, target, collection] = teamRoute;
      if (!teams.includes(target)) return reply({ message: 'Expedition team not found.' }, 404);
      const editing = method === 'PATCH';
      const deleting = method === 'DELETE';
      if (deleting && !['abilities', 'actions'].includes(collection)) {
        return reply({ message: 'Removal is available for abilities and actions.' }, 405);
      }
      if (editing && ['name', 'lore', 'items', 'faction-equipment', 'points', 'unit-image', 'unit-order'].includes(collection)) {
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
        if (!commitCampaignState(requests, stats)) return saveError();
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
      if (collection === 'items' && !admin) return forbidden();
      if (collection === 'faction-equipment') {
        const { slot, equipment, expectedEquipment } = body ?? {};
        const isEquipment = entry => entry === null || (entry && typeof entry.name === 'string'
          && typeof entry.description === 'string' && equipmentAction(entry.action) !== null);
        if (!Number.isInteger(slot) || slot < 1 || slot > factionEquipmentSlotCount
          || !isEquipment(equipment) || !isEquipment(expectedEquipment)) {
          return reply({ message: `Choose a faction equipment slot from 1 to ${factionEquipmentSlotCount} and enter its name and description as text.` }, 400);
        }
        const name = equipment?.name.trim() ?? '';
        const description = equipment?.description.trim() ?? '';
        const action = equipmentAction(equipment?.action);
        if (equipment && (!name || name.length > factionEquipmentLimits.name || description.length > factionEquipmentLimits.description)) {
          return reply({ message: `Enter a name up to ${factionEquipmentLimits.name} characters and a description up to ${factionEquipmentLimits.description} characters.` }, 400);
        }
        try {
          const roster = readRoster(target);
          const factionEquipment = factionEquipmentSlots(roster.factionEquipment);
          const current = factionEquipment[slot - 1];
          if (current?.name !== expectedEquipment?.name || current?.description !== expectedEquipment?.description
            || (current?.action ?? '') !== (expectedEquipment?.action ?? '')) {
            return reply({ equipment: current, message: 'This slot changed while you were editing. Review the saved equipment before saving again.' }, 409);
          }
          const updated = equipment ? { name, description, ...(action ? { action } : {}) } : null;
          factionEquipment[slot - 1] = updated;
          writeRoster(target, { ...roster, factionEquipment });
          return reply({ equipment: updated, message: updated ? 'Faction equipment saved.' : 'Faction equipment slot cleared.' });
        } catch {
          return reply({ message: 'Unable to save faction equipment in browser storage.' }, 500);
        }
      }
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
      if (collection === 'lore') {
        if (typeof body?.lore !== 'string' || typeof body.expectedLore !== 'string') {
          return reply({ message: 'Enter team lore as text.' }, 400);
        }
        try {
          const roster = readRoster(target);
          const current = roster.lore ?? '';
          if (body.expectedLore !== current) {
            return reply({ lore: current, message: 'Team lore changed while you were editing. Review the saved version before saving again.' }, 409);
          }
          const lore = body.lore.trim();
          writeRoster(target, { ...roster, lore });
          return reply({ lore });
        } catch {
          return reply({ message: 'Unable to save team lore in browser storage.' }, 500);
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
      } else if (collection === 'items') {
        const description = body.description === undefined ? '' : typeof body.description === 'string' ? body.description.trim() : null;
        const action = equipmentAction(body.action);
        if (description === null || description.length > factionEquipmentLimits.description || action === null) {
          return reply({ message: 'Enter ability and action text up to 4,000 characters each.' }, 400);
        }
        Object.assign(entry, equipmentRules({ description, action }));
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
    if (route === '/bounties/list') {
      try {
        const saved = JSON.parse(storage?.getItem('expedition-preview-bounties') ?? 'null');
        return reply(saved ?? { bounties: [], pendingRequests: [] });
      } catch {
        return reply({ message: 'Unable to read the Expedition bounty data.' }, 500);
      }
    }
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
        const existing = route.endsWith('/update') ? requests.find(request => request.id === body.requestId
          && (request.status === 'pending' || (request.status === 'accepted' && isBattle(request)))) : null;
        if (route.endsWith('/update') && !existing) return reply({ message: 'Request not found.' }, 404);
        if (existing?.status === 'accepted' && !admin) return forbidden();
        if (existing && !admin && !own(existing)) return forbidden();
        if (!admin && (!team || body.changeSet.requesterTeam !== team)) return reply({ message: 'Choose your assigned Expedition team.' }, 403);
        if (!visible(existing) || !visible(body)) return battlesUnavailable();
        if (existing && isBattle(existing) !== (body.changeSet.requestType === 'battle')) {
          return reply({ message: 'A battle report cannot be converted into a map request or vice versa.' }, 400);
        }
        if (isBattle(existing) && isStaleReview(existing)) return staleReview();
        const changeSet = structuredClone(body.changeSet);
        if (isBattle(body)) {
          const submissionRound = existing ? battleSubmissionRound(existing.changeSet) : readRound();
          if (submissionRound == null) delete changeSet.submissionRound;
          else changeSet.submissionRound = submissionRound;
        }
        if (existing?.status === 'accepted') {
          const error = validateBattle(changeSet, teams, map.tiles, { recordedLocation: existing.changeSet.battleLocation });
          if (error) return reply({ message: error }, 400);
          const updated = {
            ...existing, changeSet, revision: (existing.revision ?? 1) + 1,
            updatedAt: new Date().toISOString(),
          };
          if (!commitCampaignState(requests.map(item => item === existing ? updated : item))) return saveError();
          return reply({ request: battleReport(updated), message: 'Battle report updated.' });
        }
        let equipmentUsed;
        let rewardOverrides;
        if (body.changeSet.requestType === 'battle') {
          const error = validateBattle(body.changeSet, teams, map.tiles);
          if (error) return reply({ message: error }, 400);
          rewardOverrides = body.rewardOverrides === undefined ? existing?.rewardOverrides ?? {} : body.rewardOverrides;
          if (!validRewardOverrides(body.changeSet, teams, rewardOverrides)) {
            return reply({ message: 'Enter valid reward amounts for participating Expedition teams. Supply Points must be between 0 and 10.' }, 400);
          }
          const reporter = existing?.equipmentUsed?.find(use => use.source === 'reporter');
          if (!existing || own(existing)) {
            const previousChoices = reporter?.team === body.changeSet.requesterTeam ? reporter.items : [];
            const result = readBattleEquipment(body.equipment ?? previousChoices, body.changeSet.requesterTeam, existing?.id);
            if (result.message) return reply({ message: result.message }, result.status);
            equipmentUsed = [{ source: 'reporter', team: body.changeSet.requesterTeam, player: user.username, items: result.items }];
          } else {
            equipmentUsed = reporter?.team === body.changeSet.requesterTeam ? [reporter] : [];
          }
        }
        const request = {
          ...(existing || { id: crypto.randomUUID(), requesterUserId: user.id, requesterUsername: user.username, requesterEmail: '', createdAt: new Date().toISOString() }),
          changeSet, status: 'pending', updatedAt: new Date().toISOString(),
          ...(body.changeSet.requestType === 'battle' ? {
            equipmentUsed, rewardOverrides, confirmedTeams: [], revision: existing ? (existing.revision ?? 1) + 1 : 1,
          } : {}),
        };
        if (isBattle(request)) {
          const review = battleReview(request);
          if (!review.requiresAdminApproval && review.requiredTeams.length === 0) return acceptBattle(request, 'participants');
        }
        const next = existing ? requests.map(item => item === existing ? request : item) : [...requests, request];
        if (isBattle(request) && !commitCampaignState(next)) return saveError();
        requests = next;
        return reply({ request: isBattle(request) ? battleReport(request) : request, message: 'Expedition request saved locally.' });
      }
      if (method === 'POST' && route === '/map-requests/confirm') {
        const request = pending.find(item => item.id === body?.requestId && isBattle(item));
        if (!request || !canSeeBattle(request)) return reply({ message: 'Battle report not found.' }, 404);
        if (!visible(request)) return battlesUnavailable();
        const review = battleReview(request);
        if (!canLog || own(request) || !review.requiredTeams.includes(team)) return forbidden();
        if (isStaleReview(request)) return staleReview();
        if (review.confirmedTeams.includes(team)) return reply({ request: battleReport(request), message: 'Your team already confirmed this report.' });
        const result = readBattleEquipment(body.equipment ?? [], team);
        if (result.message) return reply({ message: result.message }, result.status);
        const updated = {
          ...request, confirmedTeams: [...review.confirmedTeams, team], updatedAt: new Date().toISOString(),
          equipmentUsed: [...(request.equipmentUsed ?? []), { source: 'participant', team, player: user.username, items: result.items }],
        };
        if (!review.requiresAdminApproval && updated.confirmedTeams.length === review.requiredTeams.length) return acceptBattle(updated, 'participants');
        if (!commitCampaignState(requests.map(item => item === request ? updated : item))) return saveError();
        return reply({ request: battleReport(updated), message: 'Your team confirmed the battle report.' });
      }
      if (method === 'POST' && ['/map-requests/deny', '/map-requests/cancel-own'].includes(route)) {
        const request = pending.find(request => request.id === body.requestId);
        if (!request) return reply({ message: 'Request not found.' }, 404);
        if (route.endsWith('/deny') ? !admin : !own(request)) return forbidden();
        if (!visible(request)) return battlesUnavailable();
        if (isBattle(request) && isStaleReview(request)) return staleReview();
        const updated = { ...request, status: route.endsWith('/deny') ? 'denied' : 'canceled', reviewedAt: new Date().toISOString(), reviewedByUsername: user.username };
        const next = requests.map(item => item === request ? updated : item);
        if (isBattle(request) && !commitCampaignState(next)) return saveError();
        requests = next;
        return reply({ request: isBattle(updated) ? battleReport(updated) : updated, message: 'Request closed.' });
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
          if (isStaleReview(request)) return staleReview();
          return acceptBattle(request, 'admin');
        }
        if (isResupply || isPointOnly) {
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
        if (awards) return acceptRequest(request, awards);
      }
    }
    return reply({ message: `The local simulator does not implement ${method} /expedition${route}. No changes were saved.` }, 501);
  }
  const locks = globalThis.window?.navigator?.locks;
  return (account, input, options) => storage && locks
    ? locks.request(battleStateKey, () => handleRequest(account, input, options))
    : handleRequest(account, input, options);
}
