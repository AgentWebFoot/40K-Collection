import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockApi } from './mock-api.mjs';
import { campaignRoles, createAccountStore, roles } from './accounts.mjs';
import { createExpeditionApi } from './expedition-api.mjs';

const account = (role, username = 'Alice') => ({ role, username });
const call = (api, user, route, method = 'GET', body) => api(user, `http://localhost/pyrrhic-war${route}`, { method, body: body && JSON.stringify(body) });
const storage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
};
const expeditionCall = (api, user, route, method = 'GET', body) => api(user, `http://localhost/expedition${route}`, { method, body: body && JSON.stringify(body) });
const enableBattles = { battlesEnabled: true };

test('site accounts have only the four requested roles and start with the correct access', async () => {
  assert.deepEqual(roles, ['user', 'traveler', 'admin', 'owner']);
  const api = createMockApi({ tiles: [] }, {});
  for (const role of roles) {
    const payload = await (await call(api, account(role), '/access')).json();
    assert.equal(payload.access.canEditCompendium, ['admin', 'owner'].includes(role));
    assert.equal(payload.access.canManageRoles, ['admin', 'owner'].includes(role));
    assert.equal(payload.access.role, ['admin', 'owner'].includes(role) ? role : 'viewer');
    assert.equal(payload.access.team, 0);
  }
});

test('accounts update without duplicates and assignments survive a reload', () => {
  const disk = storage();
  let db = createAccountStore(disk);
  const original = db.save(account('user', ' Alice '));
  db.assign(original.id, 'writer', 3);
  db.save(account('traveler', 'ALICE'));
  db = createAccountStore(disk);
  assert.deepEqual(db.list(), [{ id: original.id, username: 'ALICE', role: 'traveler', membershipRole: 'writer', team: 3 }]);
  db.remove(original.id);
  assert.equal(createAccountStore(disk).list().length, 0);
  assert.ok(db.save(account('user', 'Alice')).id > original.id);
});

test('campaign test accounts seed once with a player for every approved faction', () => {
  const disk = storage();
  let db = createAccountStore(disk);
  const first = db.seedCampaignTestAccounts();
  assert.equal(first.length, 5);
  assert.deepEqual(first.map(account => account.campaignRole), ['player', 'player', 'player', 'player', 'player']);
  const ids = first.map(account => account.id);
  assert.deepEqual(db.seedCampaignTestAccounts().map(account => account.id), ids);
  db = createAccountStore(disk);
  assert.deepEqual(db.list().filter(account => account.testFixtureId).map(account => account.testFixtureId), ['test-adeptus-astartes', 'test-adeptus-mechanicus', 'test-agents-imperium', 'test-astra-militarum', 'test-grey-knights']);
});

test('Hybrid Campaign role and identity assignments stay separate from site permissions', () => {
  const disk = storage();
  let db = createAccountStore(disk);
  const player = db.save(account('traveler', 'Campaign Player'));
  assert.deepEqual(campaignRoles, ['owner-gm', 'gm', 'co-gm', 'player', 'display']);
  db.assignCampaignRole(player.id, 'player');
  db.assignCampaignIdentity(player.id, 'campaign-identity-1');
  db = createAccountStore(disk);
  const restored = db.find('Campaign Player');
  assert.equal(restored.role, 'traveler');
  assert.equal(restored.campaignRole, 'player');
  assert.equal(restored.campaignIdentityId, 'campaign-identity-1');
  db.assignCampaignRole(player.id, 'display');
  assert.equal(db.find('Campaign Player').campaignIdentityId, undefined);
  assert.throws(() => db.assignCampaignIdentity(player.id, 'other'), /Only a saved player account/);
});

test('saving fails honestly when browser storage cannot persist', () => {
  const db = createAccountStore({ getItem: () => null, setItem: () => { throw new Error('Storage full'); } });
  assert.throws(() => db.save(account('user')), /Storage full/);
  assert.equal(db.list().length, 0);
});

test('admin can list saved accounts and assign membership used on subsequent requests', async () => {
  const disk = storage();
  const db = createAccountStore(disk);
  const alice = db.save(account('traveler'));
  const api = createMockApi({}, {}, db);
  const admin = account('admin', 'Manager');
  assert.equal((await call(api, alice, '/roles/list', 'POST')).status, 403);
  const { patrons } = await (await call(api, admin, '/roles/list', 'POST')).json();
  assert.equal(patrons[0].id, alice.id);
  assert.equal(typeof patrons[0].id, 'number');
  const assigned = await call(api, admin, '/roles/set-role', 'POST', { targetUserId: alice.id, role: 'writer', team: 2 });
  assert.equal(assigned.status, 200);
  assert.equal((await (await call(api, alice, '/access')).json()).access.canEditCompendium, true);
  const reloaded = createMockApi({}, {}, createAccountStore(disk));
  assert.equal((await (await call(reloaded, alice, '/access')).json()).access.team, 2);
  db.remove(alice.id);
  assert.equal((await (await call(api, alice, '/access')).json()).access.canEditCompendium, false);
});

test('membership updates reject unauthorized access, invalid input, and owner demotion', async () => {
  const db = createAccountStore();
  const alice = db.save(account('user'));
  const owner = db.save(account('owner', 'Owner'));
  const api = createMockApi({}, {}, db);
  const update = (user, id, role, team) => call(api, user, '/roles/set-role', 'POST', { targetUserId: id, role, team });
  assert.equal((await update(alice, alice.id, 'admin', 1)).status, 403);
  assert.equal((await update(owner, alice.id, 'owner', 1)).status, 400);
  assert.equal((await update(owner, alice.id, 'writer', 8)).status, 400);
  assert.equal((await update(owner, 999, 'writer', 1)).status, 404);
  assert.equal((await update(account('admin'), owner.id, 'viewer', 1)).status, 403);
  assert.equal((await update(owner, owner.id, 'owner', 4)).status, 200);
  assert.equal(db.find('Owner').role, 'owner');
});

test('game admins can manage members and self-demotion removes that access immediately', async () => {
  const db = createAccountStore();
  const alice = db.save(account('user'));
  db.assign(alice.id, 'admin', 1);
  const api = createMockApi({}, {}, db);
  assert.equal((await call(api, alice, '/roles/list')).status, 200);
  await call(api, alice, '/roles/set-role', 'POST', { targetUserId: alice.id, role: 'viewer', team: 1 });
  assert.equal((await call(api, alice, '/roles/list')).status, 403);
});

test('map edits respect assigned permissions without changing the source data', async () => {
  const seed = { tiles: [], rows: 1 };
  const db = createAccountStore();
  const alice = db.save(account('traveler'));
  db.assign(alice.id, 'participant', 1);
  const api = createMockApi(seed, {}, db);
  assert.equal((await call(api, alice, '/map', 'POST', { map: { tiles: [], rows: 2 } })).status, 403);
  assert.equal((await call(api, alice, '/map-requests', 'POST', { changeSet: { changes: [] } })).status, 200);
  assert.equal((await call(api, account('admin'), '/map', 'POST', { map: { tiles: [], rows: 2 } })).status, 200);
  assert.equal((await (await call(api, alice, '/map')).json()).rows, 2);
  assert.equal(seed.rows, 1);
});

test('favorites stay isolated between usernames, including unsaved accounts', async () => {
  const api = createMockApi({}, {});
  const key = 'lore/a?b#c';
  await call(api, account('user'), '/favorites', 'POST', { favoriteKey: key });
  assert.equal((await (await call(api, account('traveler'), '/favorites')).json()).favorites.length, 1);
  assert.equal((await (await call(api, account('user', 'Bob'), '/favorites')).json()).favorites.length, 0);
  await call(api, account('user'), `/favorites/${encodeURIComponent(key)}`, 'DELETE');
  assert.equal((await (await call(api, account('user'), '/favorites')).json()).favorites.length, 0);
});

test('Expedition assignments persist separately from existing Pyrrhic War assignments', async () => {
  const disk = storage();
  const db = createAccountStore(disk);
  const alice = db.save(account('traveler'));
  db.assign(alice.id, 'writer', 3);
  const api = createExpeditionApi({ tiles: [] }, db);
  const admin = account('admin', 'Manager');
  assert.equal((await (await expeditionCall(api, alice, '/access')).json()).access.role, 'viewer');
  const assigned = await expeditionCall(api, admin, '/roles/set-role', 'POST', { targetUserId: alice.id, role: 'traveler', team: 'purple' });
  assert.equal(assigned.status, 200);
  const reloaded = createAccountStore(disk);
  assert.equal(reloaded.find('Alice').membershipRole, 'writer');
  assert.equal(reloaded.find('Alice').team, 3);
  const payload = await (await expeditionCall(createExpeditionApi({}, reloaded), alice, '/access')).json();
  assert.equal(payload.access.role, 'traveler');
  assert.equal(payload.access.team, 'purple');
  assert.equal(payload.user.id, alice.id);
  reloaded.save(account('user', 'Alice'));
  assert.equal(reloaded.find('Alice').expeditionTeam, 'purple');
});

test('Expedition settings enforce authority and the correct game roles and teams', async () => {
  const db = createAccountStore();
  const alice = db.save(account('user'));
  const owner = db.save(account('owner', 'Owner'));
  const admin = db.save(account('admin', 'Manager'));
  const api = createExpeditionApi({}, db);
  const update = (user, id, role, team) => expeditionCall(api, user, '/roles/set-role', 'POST', { targetUserId: id, role, team });
  assert.equal((await expeditionCall(api, alice, '/roles/list')).status, 403);
  assert.equal((await update(alice, alice.id, 'admin', 'red')).status, 403);
  assert.equal((await update(owner, alice.id, 'writer', 'red')).status, 400);
  assert.equal((await update(owner, alice.id, 'traveler', 1)).status, 400);
  assert.equal((await update(admin, owner.id, 'owner', 'red')).status, 403);
  assert.equal((await update(owner, owner.id, 'owner', 'red')).status, 200);
  // The original board sends "owner" for all disabled inherited-role selects.
  assert.equal((await update(owner, admin.id, 'owner', 'blue')).status, 200);
  assert.equal((await (await expeditionCall(api, admin, '/access')).json()).access.role, 'admin');
});

test('Expedition maps are isolated from Pyrrhic War and source seeds', async () => {
  const db = createAccountStore();
  const seed = { tiles: [], round: 1 };
  const expedition = createExpeditionApi(seed, db);
  const pyrrhic = createMockApi({ tiles: [], rows: 21 }, {}, db);
  assert.equal((await expeditionCall(expedition, account('user'), '/map', 'POST', { map: { tiles: [], round: 2 } })).status, 403);
  assert.equal((await expeditionCall(expedition, account('admin'), '/map', 'POST', { map: { tiles: [], round: 2 } })).status, 200);
  assert.equal((await (await expeditionCall(expedition, account('user'), '/map')).json()).round, 2);
  assert.deepEqual(await (await call(pyrrhic, account('user'), '/map')).json(), { tiles: [], rows: 21 });
  assert.equal(seed.round, 1);
});

test('Expedition menu round changes persist without overwriting the Map or accepting stale edits', async () => {
  const db = createAccountStore();
  const browserStorage = storage();
  const seed = { round: 2, tiles: [{ id: '0-0', marker: 'red' }] };
  const api = createExpeditionApi(seed, db, browserStorage);
  const admin = account('admin');
  const viewer = account('user');
  const setRound = (user, round, expectedRound = 2) => expeditionCall(api, user, '/round', 'POST', { round, expectedRound });

  assert.deepEqual(await (await expeditionCall(api, viewer, '/round')).json(), { round: 2 });
  assert.equal((await setRound(viewer, 4)).status, 403);
  assert.equal((await setRound(admin, 0)).status, 400);
  assert.equal((await setRound(admin, 2.5)).status, 400);
  assert.equal((await setRound(admin, 4)).status, 200);
  assert.deepEqual(await (await expeditionCall(api, viewer, '/map')).json(), { ...seed, round: 4 });

  const conflict = await setRound(admin, 5);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).round, 4);
  const staleMap = { round: 2, tiles: [{ id: '0-0', marker: 'blue' }] };
  const { map } = await (await expeditionCall(api, admin, '/map', 'POST', { map: staleMap })).json();
  assert.deepEqual(map, { ...staleMap, round: 4 });

  const reloaded = createExpeditionApi(seed, db, browserStorage);
  assert.deepEqual(await (await expeditionCall(reloaded, viewer, '/round')).json(), { round: 4 });
  assert.deepEqual(await (await expeditionCall(reloaded, viewer, '/map')).json(), { ...seed, round: 4 });
});

test('Expedition Supply Point costs are admin-only, validated, and survive map saves and reloads', async () => {
  const db = createAccountStore();
  const settingsStorage = storage();
  const seed = { tiles: [], round: 1 };
  const api = createExpeditionApi(seed, db, settingsStorage);
  const admin = account('admin');
  const viewer = account('user');
  const costs = { manoeuvre: 2, regroup: 4, scout: 0, encamp: 5, demolish: 6, search: 1 };
  const save = (user, supplyPointCosts) => expeditionCall(api, user, '/supply-point-costs', 'POST', { supplyPointCosts });

  assert.equal((await save(viewer, costs)).status, 403);
  assert.equal((await save(admin, { ...costs, scout: -1 })).status, 400);
  assert.equal((await save(admin, { ...costs, scout: 0.5 })).status, 400);
  assert.equal((await save(admin, { ...costs, scout: 11 })).status, 400);
  assert.equal((await save(admin, { ...costs, scout: undefined })).status, 400);
  assert.deepEqual((await (await expeditionCall(api, viewer, '/map')).json()), seed);
  assert.deepEqual((await (await save(admin, costs)).json()).supplyPointCosts, costs);

  const staleMap = { ...seed, round: 2, supplyPointCosts: { ...costs, scout: 1 } };
  const savedMap = await (await expeditionCall(api, admin, '/map', 'POST', { map: staleMap })).json();
  assert.equal(savedMap.map.round, 2);
  assert.deepEqual(savedMap.map.supplyPointCosts, costs);
  assert.deepEqual((await (await expeditionCall(api, viewer, '/map')).json()).supplyPointCosts, costs);

  const reloaded = createExpeditionApi(seed, db, settingsStorage);
  assert.deepEqual((await (await expeditionCall(reloaded, viewer, '/map')).json()).supplyPointCosts, costs);
});

test('Expedition movement limits are admin-only and persist independently of Supply Point costs', async () => {
  const db = createAccountStore();
  const settingsStorage = storage();
  const costs = { manoeuvre: 1, regroup: 1, scout: 1, encamp: 2, demolish: 3, search: 0 };
  const seed = { tiles: [], movementLimit: 3 };
  const api = createExpeditionApi(seed, db, settingsStorage);
  const admin = account('admin');
  const viewer = account('user');
  const saveLimit = (user, movementLimit) => expeditionCall(api, user, '/movement-limit', 'POST', { movementLimit });

  assert.equal((await saveLimit(viewer, 4)).status, 403);
  for (const invalid of [-1, 0.5, '4', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await saveLimit(admin, invalid)).status, 400);
  }
  assert.equal((await (await expeditionCall(api, viewer, '/map')).json()).movementLimit, 3);
  assert.equal((await expeditionCall(api, admin, '/supply-point-costs', 'POST', { supplyPointCosts: costs })).status, 200);
  assert.equal((await (await saveLimit(admin, 0)).json()).movementLimit, 0);
  const savedMap = await (await expeditionCall(api, admin, '/map', 'POST', { map: { ...seed, round: 2 } })).json();
  assert.deepEqual(savedMap.map, { tiles: [], round: 2, movementLimit: 0, supplyPointCosts: costs });

  const reloaded = createExpeditionApi(seed, db, settingsStorage);
  assert.deepEqual((await (await expeditionCall(reloaded, viewer, '/map')).json()), {
    tiles: [], movementLimit: 0, supplyPointCosts: costs,
  });
});

test('Expedition point rewards persist and drive battle and resupply approvals', async () => {
  const db = createAccountStore();
  const settingsStorage = storage();
  const traveler = db.save(account('traveler'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const admin = account('admin');
  const seed = { tiles: [{ id: '0-0', marker: 'red' }], teamStats: { blue: { supplyPoints: 8, campaignPoints: 0 } } };
  const api = createExpeditionApi(seed, db, settingsStorage, enableBattles);
  const { readSettings } = globalThis.ExpeditionPointRewards;
  const rewards = readSettings({ standardWinCampaign: 6, standardLossSupply: 5, ownCampMin: 0, ownCampMax: 2 });
  const save = (user, pointRewards) => expeditionCall(api, user, '/point-rewards', 'POST', { pointRewards });

  assert.equal((await save(traveler, rewards)).status, 403);
  assert.equal((await save(admin, { ...rewards, ownCampMin: 3 })).status, 400);
  assert.equal((await save(admin, { ...rewards, standardLossSupply: 11 })).status, 400);
  assert.deepEqual((await (await save(admin, rewards)).json()).pointRewards, rewards);

  const reloaded = createExpeditionApi(seed, db, settingsStorage, enableBattles);
  const submit = async changeSet => {
    const response = await expeditionCall(reloaded, traveler, '/map-requests', 'POST', {
      changeSet: { ...changeSet, requesterTeam: 'red' },
    });
    assert.equal(response.status, 200);
    return (await response.json()).request.id;
  };
  const accept = (user, requestId) => expeditionCall(reloaded, user, '/map-requests/accept', 'POST', { requestId });
  assert.deepEqual((await (await expeditionCall(reloaded, traveler, '/map')).json()).pointRewards, rewards);

  const battle = await submit({ requestType: 'battle', battleType: 'standard', battleResult: 'won', battleOpponent: 'blue', battleLocation: '0-0' });
  assert.equal((await accept(traveler, battle)).status, 403);
  const battleResult = await (await accept(admin, battle)).json();
  assert.equal(battleResult.request.status, 'accepted');
  assert.equal(battleResult.map.teamStats.red.campaignPoints, 6);
  assert.equal(battleResult.map.teamStats.blue.supplyPoints, 10);
  assert.equal((await accept(admin, battle)).status, 404);

  const resupply = await submit({ requestType: 'action', actionType: 'resupply', supplyPointsGain: 2, resupplyPrepared: true });
  const resupplyResult = await (await accept(admin, resupply)).json();
  assert.deepEqual(resupplyResult.map.teamStats.red, { supplyPoints: 2, campaignPoints: 6 });
});

test('Expedition Battles shows reports to participants and persists approvals with their payouts', async () => {
  const accounts = createAccountStore();
  const player = (name, team) => {
    const member = accounts.save(account('user', name));
    accounts.assignExpedition(member.id, 'traveler', team);
    return member;
  };
  const red = player('Red player', 'red');
  const blue = player('Blue player', 'blue');
  const green = player('Green player', 'green');
  const yellow = player('Yellow player', 'yellow');
  const admin = account('admin', 'Reviewer');
  const browserStorage = storage();
  const seed = { tiles: [{ id: '1-2', marker: 'blue' }, { id: '1-3', marker: 'yellow' }] };
  let api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  const list = async user => (await (await expeditionCall(api, user, '/battles')).json()).battles;
  const changeSet = {
    requestType: 'battle', battleType: 'multiplayer-op', requesterTeam: 'red',
    battleOpponents: ['blue', 'green'], battleWinners: ['blue', 'green'], battleLocation: '1-2',
    submissionRound: 2, comment: 'Night operation.',
  };
  const submit = battle => expeditionCall(api, red, '/map-requests', 'POST', { changeSet: battle });
  assert.equal((await submit({ ...changeSet, battleLocation: '1-3' })).status, 400);
  assert.equal((await submit({ ...changeSet, battleWinners: ['yellow'] })).status, 400);
  const { request } = await (await submit(changeSet)).json();
  assert.equal((await list(red))[0].own, true);
  assert.equal((await list(blue))[0].own, false);
  assert.equal((await list(green))[0].changeSet.battleLocation, '1-2');
  assert.equal((await list(yellow)).length, 0);
  assert.equal((await list(admin)).length, 1);

  api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  const accept = user => expeditionCall(api, user, '/map-requests/accept', 'POST', { requestId: request.id });
  assert.equal((await accept(blue)).status, 403);
  assert.equal((await accept(admin)).status, 200);
  api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  assert.equal((await accept(admin)).status, 404);
  const [result] = await list(blue);
  assert.equal(result.status, 'accepted');
  assert.equal(result.reviewedByUsername, 'Reviewer');
  assert.equal(result.changeSet.comment, 'Night operation.');
  assert.equal(result.awardedPoints.length, 3);
  const map = await (await expeditionCall(api, blue, '/map')).json();
  assert.equal(map.teamStats.blue.campaignPoints, 3);
  assert.equal(map.teamStats.green.campaignPoints, 3);
  assert.equal(map.teamStats.red.supplyPoints, 2);
});

test('Expedition battle settings and Map reward settings save independently', async () => {
  const api = createExpeditionApi({ tiles: [] }, createAccountStore(), storage(), enableBattles);
  const { battleFields, mapGroups, readSettings } = globalThis.ExpeditionPointRewards;
  const defaults = readSettings();
  const valuesFor = fields => Object.fromEntries(fields.map(([key]) => [key, defaults[key]]));
  const battle = { ...valuesFor(battleFields), jointCampaign: 7 };
  const mapRewards = { ...valuesFor(mapGroups.flatMap(([, fields]) => fields)), baseTarget: 4 };
  const save = (user, route, pointRewards) => expeditionCall(api, user, route, 'POST', { pointRewards });
  const admin = account('admin');
  assert.equal((await save(account('user'), '/battle-settings', battle)).status, 403);
  assert.equal((await save(admin, '/battle-settings', { ...battle, baseTarget: 2 })).status, 400);
  assert.equal((await save(admin, '/battle-settings', battle)).status, 200);
  assert.equal((await save(admin, '/point-rewards', mapRewards)).status, 200);
  const saved = (await (await expeditionCall(api, admin, '/map')).json()).pointRewards;
  assert.equal(saved.baseTarget, 4);
  assert.equal(saved.jointCampaign, 7);
});

test('Expedition Battles can be paused without losing reports or changing other Map requests', async () => {
  const db = createAccountStore();
  const admin = account('admin');
  const browserStorage = storage();
  const seed = { tiles: [{ id: '0-0', marker: 'red' }] };
  const changeSet = {
    requestType: 'battle', battleType: 'standard', battleResult: 'won',
    requesterTeam: 'red', battleOpponent: 'blue', battleLocation: '0-0',
  };
  let api = createExpeditionApi(seed, db, browserStorage, enableBattles);
  const call = (route, method, body) => expeditionCall(api, admin, route, method, body);
  const { readSettings } = globalThis.ExpeditionPointRewards;
  assert.equal((await call('/point-rewards', 'POST', { pointRewards: readSettings({ standardWinCampaign: 5 }) })).status, 200);
  const { request: approved } = await (await call('/map-requests', 'POST', { changeSet })).json();
  assert.equal((await call('/map-requests/accept', 'POST', { requestId: approved.id })).status, 200);
  const { request: pending } = await (await call('/map-requests', 'POST', { changeSet })).json();

  api = createExpeditionApi(seed, db, browserStorage, { battlesEnabled: false });
  assert.equal((await call('/battles')).status, 503);
  assert.equal((await call('/battle-settings', 'POST', {})).status, 503);
  assert.equal((await call('/map-requests', 'POST', { changeSet })).status, 503);
  assert.equal((await call('/map-requests/update', 'POST', { requestId: pending.id, changeSet })).status, 503);
  for (const action of ['accept', 'deny', 'cancel-own']) {
    assert.equal((await call(`/map-requests/${action}`, 'POST', { requestId: pending.id })).status, 503);
  }
  const { requests: history } = await (await call('/map-requests/history')).json();
  assert.deepEqual(history, []);
  assert.equal((await call('/map-requests', 'POST', { changeSet: { requestType: 'action', actionType: 'search' } })).status, 200);
  const { requests: visible } = await (await call('/map-requests/list')).json();
  assert.equal(visible.length, 1);
  assert.equal(visible[0].changeSet.actionType, 'search');
  assert.equal((await call('/point-rewards', 'POST', { pointRewards: readSettings({ standardWinCampaign: 9, baseTarget: 4 }) })).status, 200);

  api = createExpeditionApi(seed, db, browserStorage, enableBattles);
  const { battles } = await (await call('/battles')).json();
  assert.deepEqual(battles.map(battle => [battle.id, battle.status]), [[approved.id, 'accepted'], [pending.id, 'pending']]);
  const map = await (await call('/map')).json();
  assert.equal(map.pointRewards.standardWinCampaign, 5);
  assert.equal(map.pointRewards.baseTarget, 4);
  assert.equal(map.teamStats.red.campaignPoints, 5);
});

test('Expedition travelers can add units and items only to their assigned roster', async () => {
  const db = createAccountStore();
  const alice = db.save(account('user'));
  const bob = db.save(account('user', 'Bob'));
  db.assignExpedition(alice.id, 'traveler', 'red');
  db.assignExpedition(bob.id, 'viewer', 'red');
  const traveler = account('user');
  const viewer = account('user', 'Bob');
  const admin = account('admin');
  const browserStorage = storage();
  const seed = { tiles: [], teamStats: { red: { supplyPoints: 3, campaignPoints: 2 } } };
  const api = createExpeditionApi(seed, db, browserStorage);
  const stats = { apl: 2, move: 6, save: 4, wounds: 8 };
  const add = (user, team, category, name) => expeditionCall(api, user, `/teams/${team}/${category}`, 'POST', {
    name,
    ...(category === 'units' ? { stats } : {}),
  });

  assert.equal((await add(traveler, 'blue', 'units', 'Scouts')).status, 403);
  assert.equal((await add(viewer, 'red', 'units', 'Scouts')).status, 403);
  assert.equal((await add(traveler, 'red', 'items', '   ')).status, 400);
  assert.equal((await add(traveler, 'red', 'units', '  Scouts  ')).status, 201);
  assert.equal((await add(traveler, 'red', 'items', 'Survey kit')).status, 201);
  assert.equal((await add(admin, 'blue', 'units', 'Veterans')).status, 201);

  const reloaded = createExpeditionApi(seed, db, browserStorage);
  const { teams, assignedTeam } = await (await expeditionCall(reloaded, traveler, '/teams')).json();
  assert.equal(assignedTeam, 'red');
  assert.equal(teams.length, 7);
  const ownTeam = teams.find(team => team.name === assignedTeam);
  const otherTeam = teams.find(team => team.name === 'blue');
  assert.deepEqual(ownTeam.units.map(entry => entry.name), ['Scouts']);
  assert.deepEqual(ownTeam.units[0].stats, stats);
  assert.deepEqual(ownTeam.items.map(entry => entry.name), ['Survey kit']);
  assert.equal(ownTeam.items[0].stats, undefined);
  assert.deepEqual(ownTeam.points, { ...seed.teamStats.red, credits: 0 });
  assert.deepEqual(teams.filter(team => team.canAddEntries).map(team => team.name), ['red']);
  assert.ok(teams.every(team => !team.canEditPoints));
  assert.equal(otherTeam.units[0].name, 'Veterans');
  const viewerTeams = (await (await expeditionCall(reloaded, viewer, '/teams')).json()).teams;
  assert.ok(viewerTeams.every(team => !team.canAddEntries && !team.canEditPoints));
  const unassigned = await (await expeditionCall(reloaded, account('user', 'Unassigned'), '/teams')).json();
  assert.equal(unassigned.assignedTeam, '');
  assert.deepEqual(unassigned.teams, viewerTeams);
  const adminTeams = (await (await expeditionCall(reloaded, admin, '/teams')).json()).teams;
  assert.equal(adminTeams.length, 7);
  assert.equal(adminTeams.find(team => team.name === 'blue').units[0].name, 'Veterans');
});

test('Expedition team names can be changed without changing team colors or rosters', async () => {
  const db = createAccountStore();
  const traveler = db.save(account('user'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const admin = account('admin');
  const browserStorage = storage();
  const seed = { tiles: [] };
  const api = createExpeditionApi(seed, db, browserStorage);
  const rename = (user, team, name) => expeditionCall(api, user, `/teams/${team}/name`, 'POST', { name });
  assert.equal((await rename(viewer, 'red', 'Night Scouts')).status, 403);
  assert.equal((await rename(traveler, 'blue', 'Night Scouts')).status, 403);
  assert.equal((await rename(traveler, 'red', '  ')).status, 400);
  assert.equal((await rename(traveler, 'red', 'x'.repeat(101))).status, 400);
  const renamed = await rename(traveler, 'red', '  Night Scouts  ');
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).displayName, 'Night Scouts');
  assert.equal((await rename(admin, 'blue', 'Harbor Guard')).status, 200);
  assert.equal((await expeditionCall(api, traveler, '/teams/red/units', 'POST', {
    name: 'Scout', stats: { apl: 2, move: 6, save: 4, wounds: 8 },
  })).status, 201);

  const reloaded = createExpeditionApi(seed, db, browserStorage);
  const { teams } = await (await expeditionCall(reloaded, viewer, '/teams')).json();
  const red = teams.find(team => team.name === 'red');
  assert.equal(red.displayName, 'Night Scouts');
  assert.equal(red.units[0].name, 'Scout');
  assert.equal(teams.find(team => team.name === 'blue').displayName, 'Harbor Guard');
  assert.equal(teams.find(team => team.name === 'green').displayName, undefined);
});

test('Expedition units require four valid stats and preserve older roster entries', async () => {
  const admin = account('admin');
  const browserStorage = storage();
  const legacy = { id: 'older-unit', name: 'Veteran' };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify({ units: [legacy], items: [] }));
  const api = createExpeditionApi({ tiles: [] }, createAccountStore(), browserStorage);
  const stats = { apl: 2, move: 0, save: 3, wounds: 12 };
  const add = stats => expeditionCall(api, admin, '/teams/red/units', 'POST', { name: 'Guardian', stats });
  for (const invalid of [undefined, { ...stats, apl: 1.5 }, { ...stats, move: -1 }, { ...stats, save: '3' }, { ...stats, wounds: 0 }]) {
    assert.equal((await add(invalid)).status, 400);
  }
  const saved = await add(stats);
  assert.equal(saved.status, 201);
  const { entries } = await saved.json();
  assert.deepEqual(entries[0], legacy);
  assert.deepEqual(entries[1].stats, stats);
});

test('Only assigned Expedition Travelers can upload unit images', async () => {
  const db = createAccountStore();
  const traveler = db.save(account('user'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const admin = account('admin');
  const browserStorage = storage();
  const unit = { id: 'scout', name: 'Scout', weapons: [{ id: 'blade', name: 'Blade' }] };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify({ units: [unit], items: [] }));
  const api = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1kAAAAASUVORK5CYII=';
  const upload = (user, team, image, unitId = unit.id) => expeditionCall(api, user, `/teams/${team}/unit-image`, 'POST', { unitId, image });

  assert.equal((await upload(viewer, 'red', png)).status, 403);
  assert.equal((await upload(admin, 'red', png)).status, 403);
  assert.equal((await upload(traveler, 'blue', png)).status, 403);
  assert.equal((await upload(traveler, 'red', png, 'missing')).status, 404);
  for (const image of [null, 'https://example.com/scout.png', png.replace('image/png', 'image/svg+xml'), 'data:image/png;base64,PHN2Zy8+']) {
    assert.equal((await upload(traveler, 'red', image)).status, 400);
  }
  const response = await upload(traveler, 'red', png);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).image, png);
  assert.equal((await upload(traveler, 'red', png)).status, 200);

  const reloaded = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const read = async user => (await (await expeditionCall(reloaded, user, '/teams')).json()).teams;
  const teams = await read(viewer);
  assert.deepEqual(teams.find(team => team.name === 'red').units, [{ ...unit, image: png }]);
  assert.ok(teams.every(team => !team.canUploadUnitImages));
  assert.deepEqual((await read(traveler)).filter(team => team.canUploadUnitImages).map(team => team.name), ['red']);
  assert.ok((await read(admin)).every(team => !team.canUploadUnitImages));
});

test('Expedition units can store multiple ranged and melee weapons', async () => {
  const db = createAccountStore();
  const player = db.save(account('user'));
  db.assignExpedition(player.id, 'traveler', 'red');
  const admin = account('admin');
  const viewer = account('user', 'Viewer');
  const browserStorage = storage();
  const seed = { tiles: [] };
  const api = createExpeditionApi(seed, db, browserStorage);
  const createUnit = async (team, name) => {
    const response = await expeditionCall(api, admin, `/teams/${team}/units`, 'POST', {
      name, stats: { apl: 2, move: 6, save: 4, wounds: 8 },
    });
    assert.equal(response.status, 201);
    return (await response.json()).entry;
  };
  const red = await createUnit('red', 'Scout');
  const blue = await createUnit('blue', 'Veteran');
  const add = (user, team, unitId, weapon) => expeditionCall(api, user, `/teams/${team}/weapons`, 'POST', { unitId, weapon });
  const ranged = { type: 'ranged', name: 'Combi-weapon', atk: 4, hit: 3, dmg: '3 / 4', wr: ' Range 6″ ' };
  const melee = { type: 'melee', name: 'Blade', atk: 3, hit: 4, dmg: '2/3' };
  assert.equal((await add(viewer, 'red', red.id, ranged)).status, 403);
  assert.equal((await add(player, 'blue', blue.id, ranged)).status, 403);
  assert.equal((await add(player, 'red', blue.id, ranged)).status, 404);
  for (const invalid of [
    { ...ranged, type: 'other' }, { ...ranged, name: ' ' }, { ...ranged, atk: -1 },
    { ...ranged, hit: 0 }, { ...ranged, dmg: '3/4/5' }, { ...ranged, wr: 5 },
  ]) {
    assert.equal((await add(player, 'red', red.id, invalid)).status, 400);
  }
  const first = await add(player, 'red', red.id, ranged);
  assert.equal(first.status, 201);
  const { weapon: savedRanged } = await first.json();
  assert.deepEqual(savedRanged, { id: savedRanged.id, ...ranged, dmg: '3/4', wr: 'Range 6″' });
  const second = await add(player, 'red', red.id, melee);
  assert.equal(second.status, 201);
  const { weapon: savedMelee } = await second.json();
  assert.deepEqual(savedMelee, { id: savedMelee.id, ...melee, wr: '' });
  assert.notEqual(savedMelee.id, savedRanged.id);
  const reloaded = createExpeditionApi(seed, db, browserStorage);
  const { teams } = await (await expeditionCall(reloaded, viewer, '/teams')).json();
  assert.deepEqual(teams.find(team => team.name === 'red').units[0], { ...red, weapons: [savedRanged, savedMelee] });
  assert.deepEqual(teams.find(team => team.name === 'blue').units[0], blue);
});

test('Expedition unit abilities and actions persist with action costs and optional restrictions', async () => {
  const db = createAccountStore();
  const traveler = db.save(account('user'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const browserStorage = storage();
  const original = { id: 'scout', name: 'Scout', weapons: [{ id: 'blade', name: 'Blade' }] };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify({ units: [original], items: [] }));
  const api = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const addAbility = (user, ability, unitId = original.id) => expeditionCall(api, user, '/teams/red/abilities', 'POST', { unitId, ability });
  const addAction = action => expeditionCall(api, traveler, '/teams/red/actions', 'POST', { unitId: original.id, action });
  const ability = { name: 'Explorer', description: ' Survey a tile.\nRecord its terrain. ' };
  const action = { name: 'Signal', description: 'Select a visible tile.', ap: 1, restriction: 'Only once per round.' };

  assert.equal((await addAbility(viewer, ability)).status, 403);
  assert.equal((await addAbility(traveler, ability, 'missing')).status, 404);
  assert.equal((await addAbility(traveler, { ...ability, description: ' ' })).status, 400);
  for (const ap of [undefined, -1, 0.5, '1']) {
    assert.equal((await addAction({ ...action, ap })).status, 400);
  }
  for (const effects of [[], [' '], ['Valid effect', 5], 'Not an array', null]) {
    assert.equal((await addAction({ ...action, effects })).status, 400);
  }
  assert.equal((await addAction({ ...action, restriction: 12 })).status, 400);
  const savedAction = await addAction(action);
  assert.equal(savedAction.status, 201);
  const freeAction = await addAction({ name: 'Wait', description: 'Remain here.', ap: 0 });
  assert.equal(freeAction.status, 201);
  const savedAbility = await addAbility(traveler, ability);
  assert.equal(savedAbility.status, 201);

  const reloaded = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const { teams } = await (await expeditionCall(reloaded, viewer, '/teams')).json();
  const [scout] = teams.find(team => team.name === 'red').units;
  assert.deepEqual(scout.weapons, original.weapons);
  assert.deepEqual(scout.abilities.map(({ id, ...entry }) => entry), [{ ...ability, description: ability.description.trim() }]);
  assert.deepEqual(scout.actions.map(({ id, ...entry }) => entry), [
    { ...action, effects: [action.description] },
    { name: 'Wait', description: 'Remain here.', effects: ['Remain here.'], ap: 0, restriction: '' },
  ]);
});

test('Expedition roster editors update each unit part without replacing its siblings', async () => {
  const db = createAccountStore();
  const player = db.save(account('user'));
  db.assignExpedition(player.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const admin = account('admin');
  const browserStorage = storage();
  const weapon = { id: 'blade', type: 'melee', name: 'Blade', atk: 3, hit: 4, dmg: '2/3', wr: '' };
  const ability = { id: 'scout-rule', name: 'Explorer', description: 'Survey this tile.' };
  const action = { id: 'signal', name: 'Signal', description: 'Select a tile.', ap: 1, restriction: 'Once per round.' };
  const scout = { id: 'scout', name: 'Scout', weapons: [weapon], abilities: [ability], actions: [action] };
  const other = { id: 'other', name: 'Observer', weapons: [{ ...weapon, id: 'other-blade' }] };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify({ units: [scout, other], items: [] }));
  const api = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const edit = (user, team, collection, patch) => expeditionCall(api, user, `/teams/${team}/${collection}`, 'PATCH', { unitId: scout.id, ...patch });

  const profile = { name: 'Veteran Scout', stats: { apl: 2, move: 6, save: 4, wounds: 9 } };
  assert.equal((await edit(viewer, 'red', 'units', profile)).status, 403);
  assert.equal((await edit(player, 'blue', 'units', profile)).status, 403);
  assert.equal((await edit(player, 'red', 'units', { ...profile, unitId: 'missing' })).status, 404);
  assert.equal((await edit(player, 'red', 'units', { ...profile, stats: { apl: -1 } })).status, 400);
  assert.equal((await edit(player, 'red', 'units', { name: 'Renamed Scout' })).status, 200);
  assert.equal((await edit(player, 'red', 'weapons', { entryId: 'other-blade', weapon })).status, 404);

  const updatedWeapon = { ...weapon, type: 'ranged', name: 'Carbine', atk: 4, hit: 3, dmg: '3/5', wr: 'Range 6' };
  const updatedAbility = { ...ability, name: 'Surveyor', description: 'Survey two tiles.' };
  const updatedAction = {
    ...action, name: 'Broadcast', description: 'Select a visible tile.\n\nPlace a marker there.',
    effects: ['Select a visible tile.', 'Place a marker there.'], ap: 0, restriction: '',
  };
  const edits = await Promise.all([
    edit(player, 'red', 'units', profile),
    edit(player, 'red', 'weapons', { entryId: weapon.id, weapon: updatedWeapon }),
    edit(admin, 'red', 'abilities', { entryId: ability.id, ability: updatedAbility }),
    edit(player, 'red', 'actions', { entryId: action.id, action: { ...updatedAction, effects: [' Select a visible tile. ', 'Place a marker there.'] } }),
  ]);
  assert.deepEqual(edits.map(response => response.status), [200, 200, 200, 200]);

  const reloaded = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const { teams } = await (await expeditionCall(reloaded, viewer, '/teams')).json();
  assert.deepEqual(teams.find(team => team.name === 'red').units, [
    { id: scout.id, ...profile, weapons: [updatedWeapon], abilities: [updatedAbility], actions: [updatedAction] },
    other,
  ]);
});

test('Expedition travelers can remove abilities and actions only from their own units', async () => {
  const db = createAccountStore();
  const player = db.save(account('user'));
  db.assignExpedition(player.id, 'traveler', 'red');
  const admin = account('admin');
  const viewer = account('user', 'Viewer');
  const browserStorage = storage();
  const unit = {
    id: 'scout', name: 'Scout',
    weapons: [{ id: 'blade', name: 'Blade' }],
    abilities: [{ id: 'explorer', name: 'Explorer' }, { id: 'spotter', name: 'Spotter' }],
    actions: [{ id: 'signal', name: 'Signal' }, { id: 'wait', name: 'Wait' }],
  };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify({ units: [unit], items: [] }));
  const seed = { tiles: [] };
  const api = createExpeditionApi(seed, db, browserStorage);
  const remove = (user, team, collection, entryId, unitId = unit.id) =>
    expeditionCall(api, user, `/teams/${team}/${collection}`, 'DELETE', { unitId, entryId });
  assert.equal((await remove(viewer, 'red', 'abilities', 'explorer')).status, 403);
  assert.equal((await remove(player, 'blue', 'abilities', 'explorer')).status, 403);
  assert.equal((await remove(player, 'red', 'weapons', 'blade')).status, 405);
  assert.equal((await remove(player, 'red', 'actions', 'signal', 'missing')).status, 404);
  assert.equal((await remove(player, 'red', 'actions', 'explorer')).status, 404);
  assert.equal((await remove(player, 'red', 'abilities', 'explorer')).status, 200);
  assert.equal((await remove(admin, 'red', 'actions', 'signal')).status, 200);
  assert.equal((await remove(player, 'red', 'actions', 'signal')).status, 404);
  const reloaded = createExpeditionApi(seed, db, browserStorage);
  const { teams } = await (await expeditionCall(reloaded, viewer, '/teams')).json();
  assert.deepEqual(teams.find(team => team.name === 'red').units, [{
    ...unit, abilities: [unit.abilities[1]], actions: [unit.actions[1]],
  }]);
});

test('Expedition roster order persists and weapons can move only within their type', async () => {
  const db = createAccountStore();
  const traveler = db.save(account('user'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const storageCopy = storage();
  const unit = {
    id: 'scout', name: 'Scout',
    weapons: [
      { id: 'blade', type: 'melee' }, { id: 'rifle', type: 'ranged' },
      { id: 'hammer', type: 'melee' }, { id: 'carbine', type: 'ranged' },
    ],
    abilities: [{ id: 'survey' }, { id: 'scout' }],
    actions: [{ id: 'signal' }, { id: 'wait' }],
  };
  storageCopy.setItem('expedition-preview-roster-red', JSON.stringify({ units: [unit], items: [] }));
  const seed = { tiles: [] };
  const api = createExpeditionApi(seed, db, storageCopy);
  const move = (collection, entryId, direction, user = traveler, team = 'red') =>
    expeditionCall(api, user, `/teams/${team}/unit-order`, 'POST', { unitId: unit.id, collection, entryId, direction });

  assert.equal((await move('abilities', 'scout', -1, viewer)).status, 403);
  assert.equal((await move('abilities', 'scout', -1, traveler, 'blue')).status, 403);
  assert.equal((await move('name', 'scout', -1)).status, 400);
  assert.equal((await move('actions', 'wait', 0)).status, 400);
  assert.equal((await move('abilities', 'wait', -1)).status, 404);
  assert.equal((await move('weapons', 'carbine', 1)).status, 409);
  assert.equal((await move('weapons', 'blade', -1)).status, 409);
  const rifleOrder = await (await move('weapons', 'carbine', -1)).json();
  assert.deepEqual(rifleOrder.order, ['carbine', 'rifle', 'blade', 'hammer']);
  assert.equal((await move('weapons', 'hammer', -1)).status, 200);
  assert.equal((await move('abilities', 'scout', -1)).status, 200);
  assert.equal((await move('actions', 'signal', 1)).status, 200);

  const reloaded = createExpeditionApi(seed, db, storageCopy);
  const { teams } = await (await expeditionCall(reloaded, viewer, '/teams')).json();
  const saved = teams.find(team => team.name === 'red').units[0];
  assert.deepEqual(saved.weapons.map(entry => entry.id), ['carbine', 'rifle', 'hammer', 'blade']);
  assert.deepEqual(saved.abilities.map(entry => entry.id), ['scout', 'survey']);
  assert.deepEqual(saved.actions.map(entry => entry.id), ['wait', 'signal']);
});

test('Expedition Team Management shows structures and occupied tiles from the current Map', async () => {
  const seed = {
    tiles: [
      { id: '0-1', structure: 'base', structureColor: 'red', marker: 'blue' },
      { id: '1-2', structure: 'camp', structureColor: 'red', marker: 'blue', secondaryMarker: 'red' },
      { id: '2-3', structure: 'camp', structureColor: 'red', marker: 'red', secondaryMarker: 'red' },
      { id: '3-4', structure: 'base', structureColor: 'blue' },
    ],
  };
  const api = createExpeditionApi(seed, createAccountStore());
  const list = async () => (await (await expeditionCall(api, account('user'), '/teams')).json()).teams;
  const teams = await list();
  assert.deepEqual(teams.find(team => team.name === 'red').locations, {
    bases: ['0-1'], camps: ['1-2', '2-3'], positions: ['1-2', '2-3'],
  });
  assert.deepEqual(teams.find(team => team.name === 'blue').locations, {
    bases: ['3-4'], camps: [], positions: ['0-1', '1-2'],
  });
  assert.deepEqual(teams.find(team => team.name === 'green').locations, { bases: [], camps: [], positions: [] });

  const nextMap = { tiles: [{ id: '4-5', marker: 'red' }] };
  assert.equal((await expeditionCall(api, account('admin'), '/map', 'POST', { map: nextMap })).status, 200);
  assert.deepEqual((await list()).find(team => team.name === 'red').locations, {
    bases: [], camps: [], positions: ['4-5'],
  });
});

test('Expedition Team Management edits the Map balances and rejects stale edits', async () => {
  const db = createAccountStore();
  const player = db.save(account('user'));
  db.assignExpedition(player.id, 'traveler', 'red');
  const admin = account('admin');
  const initial = { supplyPoints: 3, campaignPoints: 2 };
  const changed = { supplyPoints: 5, campaignPoints: 8, credits: 12 };
  const api = createExpeditionApi({ tiles: [], teamStats: { red: initial, blue: initial } }, db);
  const save = (user, points, expectedPoints = initial) => expeditionCall(api, user, '/teams/red/points', 'POST', { points, expectedPoints });

  assert.equal((await save(player, changed)).status, 403);
  assert.equal((await save(admin, { ...changed, supplyPoints: 11 })).status, 400);
  assert.equal((await save(admin, changed)).status, 200);
  const map = await (await expeditionCall(api, player, '/map')).json();
  assert.deepEqual(map.teamStats, { red: changed, blue: initial });
  const conflict = await save(admin, initial);
  assert.equal(conflict.status, 409);
  assert.deepEqual((await conflict.json()).points, changed);
  const { teams } = await (await expeditionCall(api, player, '/teams')).json();
  assert.deepEqual(teams[0].points, changed);
});

test('Expedition Credits default to zero and survive Map saves, awards, and reloads', async () => {
  const db = createAccountStore();
  const admin = account('admin');
  const viewer = account('user');
  const browserStorage = storage();
  const base = { supplyPoints: 3, campaignPoints: 2 };
  const seed = { tiles: [{ id: '0-0', marker: 'red' }], teamStats: { red: base } };
  let api = createExpeditionApi(seed, db, browserStorage, enableBattles);
  const call = (user, route, method, body) => expeditionCall(api, user, route, method, body);
  const save = (points, expectedPoints) => call(admin, '/teams/red/points', 'POST', { points, expectedPoints });
  const teamBalance = async () => {
    const { teams } = await (await call(viewer, '/teams')).json();
    return teams.find(team => team.name === 'red').points;
  };
  assert.deepEqual(await teamBalance(), { ...base, credits: 0 });
  for (const credits of [-1, 1.5, '7', null]) {
    assert.equal((await save({ ...base, credits }, base)).status, 400);
  }
  assert.equal((await save({ ...base, credits: 7 }, { ...base, credits: 0 })).status, 200);
  const conflict = await save({ ...base, credits: 4 }, { ...base, credits: 0 });
  assert.equal(conflict.status, 409);
  assert.deepEqual((await conflict.json()).points, { ...base, credits: 7 });
  assert.equal((await save(base, base)).status, 200);
  assert.deepEqual(await teamBalance(), { ...base, credits: 7 });

  const stats = Object.fromEntries(['red', 'blue', 'green', 'yellow', 'purple', 'white', 'black'].map(team => [team, base]));
  assert.equal((await call(admin, '/team-stats', 'POST', { teamStats: stats })).status, 200);
  assert.equal((await call(admin, '/map', 'POST', { map: { ...seed, teamStats: { red: { ...base, credits: 0 } } } })).status, 200);
  const { request } = await (await call(admin, '/map-requests', 'POST', {
    changeSet: { requestType: 'battle', battleType: 'standard', battleResult: 'won', requesterTeam: 'red', battleOpponent: 'blue', battleLocation: '0-0' },
  })).json();
  assert.equal((await call(admin, '/map-requests/accept', 'POST', { requestId: request.id })).status, 200);
  api = createExpeditionApi(seed, db, browserStorage);
  assert.deepEqual(await teamBalance(), { supplyPoints: 3, campaignPoints: 4, credits: 7 });
});

test('Expedition traveler requests support own lists, updates, cancellation, and admin denial', async () => {
  const db = createAccountStore();
  const alice = db.save(account('traveler'));
  const bob = db.save(account('traveler', 'Bob'));
  db.assignExpedition(alice.id, 'traveler', 'red');
  db.assignExpedition(bob.id, 'traveler', 'blue');
  const api = createExpeditionApi({}, db);
  const changeSet = { requestType: 'movement', requesterTeam: 'red', changes: [] };
  assert.equal((await expeditionCall(api, bob, '/map-requests', 'POST', { changeSet })).status, 403);
  const { request } = await (await expeditionCall(api, alice, '/map-requests', 'POST', { changeSet })).json();
  assert.equal(request.requesterUserId, alice.id);
  assert.equal((await (await expeditionCall(api, bob, '/map-requests/mine')).json()).requests.length, 0);
  assert.equal((await expeditionCall(api, bob, '/map-requests/cancel-own', 'POST', { requestId: request.id })).status, 403);
  assert.equal((await expeditionCall(api, alice, '/map-requests/update', 'POST', { requestId: request.id, changeSet })).status, 200);
  assert.equal((await expeditionCall(api, alice, '/map-requests/cancel-own', 'POST', { requestId: request.id })).status, 200);
  assert.equal((await (await expeditionCall(api, alice, '/map-requests/mine')).json()).requests.length, 0);
  const second = await (await expeditionCall(api, alice, '/map-requests', 'POST', { changeSet })).json();
  assert.equal((await expeditionCall(api, account('admin'), '/map-requests/deny', 'POST', { requestId: second.request.id })).status, 200);
  assert.equal((await (await expeditionCall(api, account('admin'), '/map-requests/list')).json()).requests.length, 0);
  assert.equal((await (await expeditionCall(api, alice, '/map-requests/history')).json()).requests.length, 2);
  assert.equal((await expeditionCall(api, account('admin'), '/map-requests/accept', 'POST', {})).status, 501);
});
