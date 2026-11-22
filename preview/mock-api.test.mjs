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
function expeditionAdmin(db, username = 'Expedition Organizer') {
  const admin = db.save(account('user', username));
  return db.assignExpedition(admin.id, 'admin', '');
}
function expeditionTraveler(db, team) {
  const player = db.save(account('user', `${team} traveler`));
  return db.assignExpedition(player.id, 'traveler', team);
}

const enableBattles = { battlesEnabled: true };

test('site accounts have only the four requested roles and start with the correct access', async () => {
  assert.deepEqual(roles, ['user', 'traveler', 'manager', 'owner']);
  const api = createMockApi({ tiles: [] }, {});
  for (const role of roles) {
    const payload = await (await call(api, account(role), '/access')).json();
    assert.equal(payload.access.canEditCompendium, ['manager', 'owner'].includes(role));
    assert.equal(payload.access.canManageRoles, ['manager', 'owner'].includes(role));
    assert.equal(payload.access.role, ({ manager: 'admin', owner: 'owner' })[role] || 'viewer');
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

test('legacy site admins load as Managers with their existing Expedition assignments', () => {
  const disk = storage();
  const db = createAccountStore(disk);
  const manager = db.save(account('manager'));
  db.assignExpedition(manager.id, 'traveler', 'red');
  const key = 'pyrrhic-preview-accounts-v1';
  const oldState = JSON.parse(disk.getItem(key));
  oldState.accounts[0].role = 'admin';
  disk.setItem(key, JSON.stringify(oldState));
  assert.deepEqual(createAccountStore(disk).find('Alice'), {
    ...manager, expeditionMembershipRole: 'traveler', expeditionTeam: 'red',
  });
});

test('site managers can list saved accounts and assign membership used on subsequent requests', async () => {
  const disk = storage();
  const db = createAccountStore(disk);
  const alice = db.save(account('traveler'));
  const api = createMockApi({}, {}, db);
  const admin = account('manager', 'Manager');
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
  assert.equal((await update(account('manager'), owner.id, 'viewer', 1)).status, 403);
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
  assert.equal((await call(api, account('manager'), '/map', 'POST', { map: { tiles: [], rows: 2 } })).status, 200);
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
  const admin = expeditionAdmin(db, 'Organizer');
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
  const admin = expeditionAdmin(db, 'Organizer');
  const manager = db.save(account('manager', 'Manager'));
  const api = createExpeditionApi({}, db);
  const update = (user, id, role, team) => expeditionCall(api, user, '/roles/set-role', 'POST', { targetUserId: id, role, team });
  assert.equal((await expeditionCall(api, alice, '/roles/list')).status, 403);
  assert.equal((await update(alice, alice.id, 'admin', 'red')).status, 403);
  assert.equal((await update(owner, alice.id, 'writer', 'red')).status, 400);
  assert.equal((await update(owner, alice.id, 'traveler', 1)).status, 400);
  assert.equal((await update(admin, owner.id, 'owner', 'red')).status, 403);
  assert.equal((await update(owner, owner.id, 'owner', 'red')).status, 200);
  const { patrons } = await (await expeditionCall(api, manager, '/roles/list')).json();
  const member = patrons.find(item => item.id === alice.id);
  assert.equal(member.canEditExpeditionRole, true);
  assert.equal(member.canEditExpeditionTeam, false);
  assert.equal((await update(manager, owner.id, 'admin', 'blue')).status, 403);
  assert.equal((await update(owner, alice.id, 'traveler', 'red')).status, 200);
  for (const role of ['viewer', 'admin', 'traveler']) {
    const updated = await (await update(manager, alice.id, role, 'blue')).json();
    assert.equal(updated.patron.expeditionRole, role);
    assert.equal(updated.patron.expeditionTeam, 'red');
    assert.equal(updated.patron.siteRole, 'user');
  }
  assert.equal((await expeditionCall(api, manager, '/round', 'POST', { round: 2, expectedRound: 1 })).status, 403);
  assert.equal((await expeditionCall(api, manager, '/map', 'POST', { map: { tiles: [] } })).status, 403);
  assert.equal((await call(createMockApi({}, {}, db), admin, '/roles/list')).status, 403);
  assert.equal((await update(admin, manager.id, 'admin', 'blue')).status, 200);
  const { user, access } = await (await expeditionCall(api, manager, '/access')).json();
  assert.equal(user.role, 'manager');
  assert.equal(access.role, 'admin');
  assert.equal(access.team, 'blue');
  assert.equal((await update(owner, manager.id, 'traveler', 'blue')).status, 200);
  assert.equal((await expeditionCall(api, manager, '/roles/list')).status, 200);
  assert.equal((await expeditionCall(api, manager, '/map', 'POST', { map: { tiles: [] } })).status, 403);
  assert.equal(db.find('Manager').role, 'manager');
});

test('Expedition maps are isolated from Pyrrhic War and source seeds', async () => {
  const db = createAccountStore();
  const seed = { tiles: [], round: 1 };
  const expedition = createExpeditionApi(seed, db);
  const pyrrhic = createMockApi({ tiles: [], rows: 21 }, {}, db);
  assert.equal((await expeditionCall(expedition, account('user'), '/map', 'POST', { map: { tiles: [], round: 2 } })).status, 403);
  assert.equal((await expeditionCall(expedition, expeditionAdmin(db), '/map', 'POST', { map: { tiles: [], round: 2 } })).status, 200);
  assert.equal((await (await expeditionCall(expedition, account('user'), '/map')).json()).round, 2);
  assert.deepEqual(await (await call(pyrrhic, account('user'), '/map')).json(), { tiles: [], rows: 21 });
  assert.equal(seed.round, 1);
});

test('Expedition menu round changes persist without overwriting the Map or accepting stale edits', async () => {
  const db = createAccountStore();
  const browserStorage = storage();
  const seed = { round: 2, tiles: [{ id: '0-0', marker: 'red' }] };
  const api = createExpeditionApi(seed, db, browserStorage);
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
  assert.equal(battleResult.request.approvalMethod, 'admin');
  assert.deepEqual(battleResult.request.review.confirmedTeams, []);
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
  const admin = expeditionAdmin(accounts, 'Reviewer');
  const browserStorage = storage();
  const seed = { tiles: [{ id: '1-2', marker: 'blue' }, { id: '1-3', marker: 'yellow' }] };
  let api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  const list = async user => (await expeditionCall(api, user, '/battles')).json();
  const changeSet = {
    requestType: 'battle', battleType: 'multiplayer-op', requesterTeam: 'red',
    battleOpponents: ['blue', 'green'], battleWinners: ['blue', 'green'], battleLocation: '1-2',
    submissionRound: 2, battleName: 'The Lantern Gate', battleDate: '2026-11-19',
    lore: 'The lights went out.\nThe gate held.', comment: 'Night operation.',
  };
  const submit = battle => expeditionCall(api, red, '/map-requests', 'POST', { changeSet: battle });
  assert.equal((await submit({ ...changeSet, battleLocation: '1-3' })).status, 400);
  assert.equal((await submit({ ...changeSet, battleWinners: ['yellow'] })).status, 400);
  const { request } = await (await submit(changeSet)).json();
  assert.equal((await list(red)).pendingBattles[0].own, true);
  assert.equal((await list(red)).pendingBattles[0].review.canConfirm, false);
  assert.equal((await list(blue)).pendingBattles[0].review.canConfirm, true);
  assert.equal((await list(green)).pendingBattles[0].changeSet.battleLocation, '1-2');
  assert.deepEqual((await list(yellow)).pendingBattles, []);
  assert.deepEqual((await list(admin)).battles, []);

  api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  const review = (user, action, expectedRevision) => expeditionCall(api, user, `/map-requests/${action}`, 'POST', { requestId: request.id, expectedRevision });
  const accept = user => review(user, 'accept');
  assert.equal((await accept(blue)).status, 403);
  assert.equal((await review(red, 'confirm')).status, 403);
  assert.equal((await review(yellow, 'confirm')).status, 404);
  assert.equal((await review(blue, 'confirm', request.revision)).status, 200);
  assert.deepEqual((await (await review(blue, 'confirm')).json()).request.review.confirmedTeams, ['blue']);
  assert.equal((await list(admin)).pendingBattles[0].review.canApprove, true);
  assert.deepEqual((await list(admin)).battles, []);
  const updated = await expeditionCall(api, red, '/map-requests/update', 'POST', { requestId: request.id, changeSet: { ...changeSet, comment: 'Revised operation.' } });
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).request.review.confirmedTeams, []);
  assert.equal((await review(green, 'confirm', request.revision)).status, 409);
  assert.equal((await review(blue, 'confirm')).status, 200);
  api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  assert.deepEqual((await list(admin)).battles, []);
  assert.equal((await review(admin, 'accept', request.revision)).status, 409);
  assert.equal((await (await expeditionCall(api, blue, '/map')).json()).teamStats?.blue?.campaignPoints ?? 0, 0);
  const finalized = await review(green, 'confirm');
  assert.equal(finalized.status, 200);
  assert.equal((await finalized.json()).request.status, 'accepted');
  api = createExpeditionApi(seed, accounts, browserStorage, enableBattles);
  assert.equal((await accept(admin)).status, 404);
  const { battles: [result], pendingBattles } = await list(blue);
  assert.deepEqual(pendingBattles, []);
  assert.deepEqual((await list(yellow)).battles, []);
  assert.equal(result.status, 'accepted');
  assert.equal(result.reviewedByUsername, 'Green player');
  assert.equal(result.approvalMethod, 'participants');
  assert.equal(result.changeSet.comment, 'Revised operation.');
  assert.equal(result.changeSet.battleName, 'The Lantern Gate');
  assert.equal(result.changeSet.battleDate, '2026-11-19');
  assert.equal(result.changeSet.lore, 'The lights went out.\nThe gate held.');
  assert.equal(result.awardedPoints.length, 3);
  const map = await (await expeditionCall(api, blue, '/map')).json();
  assert.equal(map.teamStats.blue.campaignPoints, 3);
  assert.equal(map.teamStats.green.campaignPoints, 3);
  assert.equal(map.teamStats.red.supplyPoints, 2);
});

test('either Expedition side can file a shared report and choose a winner or draw', async () => {
  const db = createAccountStore();
  const red = db.save(account('user', 'Red Reporter'));
  db.assignExpedition(red.id, 'traveler', 'red');
  const blue = db.save(account('user', 'Blue Reporter'));
  db.assignExpedition(blue.id, 'traveler', 'blue');
  const seed = { tiles: [{ id: '1-2', marker: 'blue' }] };
  for (const [reporter, other, requesterTeam, opponent] of [[red, blue, 'red', 'blue'], [blue, red, 'blue', 'red']]) {
    const api = createExpeditionApi(seed, db);
    const submit = battleOutcome => expeditionCall(api, reporter, '/map-requests', 'POST', {
      changeSet: { requestType: 'battle', battleType: 'standard', requesterTeam, battleOpponent: opponent, battleLocation: '1-2', battleOutcome },
    });
    const list = async user => (await expeditionCall(api, user, '/battles')).json();
    assert.equal((await submit('green')).status, 400);
    const { request } = await (await submit('blue')).json();
    const [shared] = (await list(other)).pendingBattles;
    assert.equal(shared.id, request.id);
    assert.equal(shared.changeSet.battleOutcome, 'blue');
    assert.equal(shared.own, false);
    assert.equal((await list(reporter)).pendingBattles.length, 1);
    const approved = await expeditionCall(api, other, '/map-requests/confirm', 'POST', { requestId: request.id });
    assert.equal(approved.status, 200);
    const { request: accepted } = await approved.json();
    assert.deepEqual(accepted.awardedPoints, [
      { team: 'blue', field: 'campaignPoints', amount: 2 },
      { team: 'red', field: 'supplyPoints', amount: 1 },
    ]);
    const { request: drawn } = await (await submit('draw')).json();
    assert.equal((await list(other)).pendingBattles.find(battle => battle.id === drawn.id).changeSet.battleOutcome, 'draw');
  }
});

test('a same-team Joint Op requires confirmation by a teammate other than the author', async () => {
  const db = createAccountStore();
  const reporter = expeditionTraveler(db, 'red');
  const teammate = db.save(account('user', 'Joint partner'));
  db.assignExpedition(teammate.id, 'traveler', 'red');
  const viewer = db.save(account('user', 'Red viewer'));
  db.assignExpedition(viewer.id, 'viewer', 'red');
  const admin = expeditionAdmin(db);
  const api = createExpeditionApi({ tiles: [{ id: '1-1', marker: 'red' }] }, db);
  const submit = () => expeditionCall(api, reporter, '/map-requests', 'POST', {
    changeSet: {
      requestType: 'battle', battleType: 'joint-op', requesterTeam: 'red', battleOpponent: 'red',
      battleLocation: '1-1', battleOutcome: 'joint-win',
    },
  });
  const { request } = await (await submit()).json();
  const review = (user, action, requestId = request.id) => expeditionCall(api, user, `/map-requests/${action}`, 'POST', { requestId });
  assert.deepEqual(request.review.requiredTeams, ['red']);
  assert.equal((await review(reporter, 'confirm')).status, 403);
  assert.equal((await review(viewer, 'confirm')).status, 403);
  const confirmed = await review(teammate, 'confirm');
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).request.status, 'accepted');

  const { request: denied } = await (await submit()).json();
  assert.equal((await review(admin, 'deny', denied.id)).status, 200);
  const log = await (await expeditionCall(api, reporter, '/battles')).json();
  assert.deepEqual(log.pendingBattles, []);
  assert.deepEqual(log.battles.map(item => item.id), [request.id]);
});

test('Expedition battle settings and Map reward settings save independently', async () => {
  const db = createAccountStore();
  const api = createExpeditionApi({ tiles: [] }, db, storage(), enableBattles);
  const { battleFields, mapGroups, readSettings } = globalThis.ExpeditionPointRewards;
  const defaults = readSettings();
  const valuesFor = fields => Object.fromEntries(fields.map(([key]) => [key, defaults[key]]));
  const battle = { ...valuesFor(battleFields), jointCampaign: 7 };
  const mapRewards = { ...valuesFor(mapGroups.flatMap(([, fields]) => fields)), baseTarget: 4 };
  const save = (user, route, pointRewards) => expeditionCall(api, user, route, 'POST', { pointRewards });
  const admin = expeditionAdmin(db);
  assert.equal((await save(account('user'), '/battle-settings', battle)).status, 403);
  assert.equal((await save(account('manager'), '/battle-settings', battle)).status, 403);
  assert.equal((await save(admin, '/battle-settings', { ...battle, baseTarget: 2 })).status, 400);
  assert.equal((await save(admin, '/battle-settings', battle)).status, 200);
  assert.equal((await save(admin, '/point-rewards', mapRewards)).status, 200);
  const saved = (await (await expeditionCall(api, admin, '/map')).json()).pointRewards;
  assert.equal(saved.baseTarget, 4);
  assert.equal(saved.jointCampaign, 7);
});

test('scored battles project rewards and require Admin approval for manual payouts', async () => {
  const db = createAccountStore();
  const red = expeditionTraveler(db, 'red');
  const blue = expeditionTraveler(db, 'blue');
  const admin = expeditionAdmin(db);
  const seed = { tiles: [{ id: '1-1', marker: 'red' }], teamStats: { blue: { supplyPoints: 9, campaignPoints: 0 } } };
  const api = createExpeditionApi(seed, db, storage());
  const call = (user, route, body) => expeditionCall(api, user, route, body ? 'POST' : 'GET', body);
  const changeSet = {
    requestType: 'battle', battleType: 'standard', requesterTeam: 'red', battleOpponent: 'blue',
    battleLocation: '1-1', battleScores: { red: 9, blue: 6 },
  };
  for (const battleScores of [{ red: 9 }, { red: 9, blue: -1 }, { red: 9, blue: 0.5 }, { red: 9, blue: 0, green: 1 }]) {
    assert.equal((await call(red, '/map-requests', { changeSet: { ...changeSet, battleScores } })).status, 400);
  }
  for (const rewardOverrides of [{ green: { credits: 4 } }, { red: { supplyPoints: 11 } }, { red: { credits: -1 } }]) {
    assert.equal((await call(red, '/map-requests', { changeSet, rewardOverrides })).status, 400);
  }
  const rewardOverrides = { red: { campaignPoints: 4, credits: 7 }, blue: { supplyPoints: 3 } };
  const { request } = await (await call(red, '/map-requests', { changeSet, rewardOverrides })).json();
  assert.equal(request.review.requiresAdminApproval, true);
  assert.deepEqual(request.projectedRewards, [
    { team: 'red', campaignPoints: 4, supplyPoints: 0, credits: 7 },
    { team: 'blue', campaignPoints: 0, supplyPoints: 1, credits: 0, cappedRewards: { supplyPoints: 3 } },
  ]);
  const review = { requestId: request.id, expectedRevision: request.revision };
  const { request: confirmed } = await (await call(blue, '/map-requests/confirm', review)).json();
  assert.equal(confirmed.status, 'pending');
  assert.deepEqual(confirmed.review.confirmedTeams, ['blue']);
  assert.equal((await call(red, '/map-requests/accept', review)).status, 403);
  assert.deepEqual((await (await call(red, '/battles')).json()).battles, []);
  assert.deepEqual((await (await call(red, '/map')).json()).teamStats, seed.teamStats);
  const { request: approved, map } = await (await call(admin, '/map-requests/accept', review)).json();
  assert.equal(approved.approvalMethod, 'admin');
  assert.deepEqual(map.teamStats, {
    red: { campaignPoints: 4, supplyPoints: 0, credits: 7 },
    blue: { campaignPoints: 0, supplyPoints: 10 },
  });
  assert.equal((await call(admin, '/map-requests/accept', review)).status, 404);

  const outside = { ...changeSet, battleOpponent: 'outside-player', battleScores: { red: 5, 'outside-player': 5 } };
  const { request: immediate } = await (await call(red, '/map-requests', { changeSet: outside })).json();
  assert.equal(immediate.status, 'accepted');
  const { request: expedited } = await (await call(red, '/map-requests', {
    changeSet: outside, rewardOverrides: { red: { credits: 1 } },
  })).json();
  assert.equal(expedited.status, 'pending');
  assert.equal(expedited.review.requiresAdminApproval, true);
});

test('Multiplayer scores pay only the highest tied teams the draw reward', async () => {
  const db = createAccountStore();
  const admin = expeditionAdmin(db);
  const api = createExpeditionApi({ tiles: [{ id: '1-1', marker: 'red' }] }, db);
  const call = (route, body) => expeditionCall(api, admin, route, 'POST', body);
  const { request } = await (await call('/map-requests', { changeSet: {
    requestType: 'battle', battleType: 'multiplayer-op', requesterTeam: 'red', battleOpponent: 'blue',
    battleOpponents: ['blue', 'green', 'outside-player'], battleLocation: '1-1',
    battleScores: { red: 7, blue: 9, green: 9, 'outside-player': 7 },
  } })).json();
  assert.deepEqual(request.projectedRewards, [
    { team: 'red', campaignPoints: 0, supplyPoints: 2, credits: 0 },
    { team: 'blue', campaignPoints: 4, supplyPoints: 0, credits: 0 },
    { team: 'green', campaignPoints: 4, supplyPoints: 0, credits: 0 },
  ]);
  const { request: approved } = await (await call('/map-requests/accept', { requestId: request.id })).json();
  assert.deepEqual(approved.awardedPoints, [
    { team: 'red', field: 'supplyPoints', amount: 2 },
    { team: 'blue', field: 'campaignPoints', amount: 4 },
    { team: 'green', field: 'campaignPoints', amount: 4 },
  ]);
});

test('only Expedition admins can edit an approved battle, including reports on historical tiles', async () => {
  const db = createAccountStore();
  const reporter = expeditionTraveler(db, 'red');
  const manager = db.save(account('manager', 'Site Manager'));
  db.assignExpedition(manager.id, 'traveler', 'red');
  const admin = expeditionAdmin(db);
  const disk = storage();
  const seed = { tiles: [{ id: '1-1', marker: 'red' }] };
  let api = createExpeditionApi(seed, db, disk);
  const call = (user, route, body) => expeditionCall(api, user, route, body ? 'POST' : 'GET', body);
  const changeSet = {
    requestType: 'battle', battleType: 'standard', requesterTeam: 'red',
    battleOpponent: 'outside-player', battleLocation: '1-1', battleOutcome: 'red',
    battleName: 'Old report',
  };
  const { request } = await (await call(reporter, '/map-requests', { changeSet })).json();
  assert.equal(request.status, 'accepted');
  assert.equal(request.review.canEdit, false);

  api = createExpeditionApi({ tiles: [{ id: '1-1', marker: 'blue' }] }, db, disk);
  const edit = (user, fields) => call(user, '/map-requests/update', {
    requestId: request.id, expectedRevision: request.revision, changeSet: { ...changeSet, ...fields },
  });
  assert.equal((await edit(reporter, { battleName: 'Reporter edit' })).status, 403);
  assert.equal((await edit(manager, { battleName: 'Manager edit' })).status, 403);
  assert.equal((await edit(admin, { battleLocation: '9-9' })).status, 400);
  const response = await edit(admin, { battleName: 'Corrected report' });
  assert.equal(response.status, 200);
  const { request: updated } = await response.json();
  assert.equal(updated.status, 'accepted');
  assert.equal(updated.review.canEdit, true);
  assert.equal(updated.changeSet.battleLocation, '1-1');
  assert.equal(updated.changeSet.battleName, 'Corrected report');
  assert.equal(updated.revision, request.revision + 1);
  assert.equal(updated.reviewedAt, request.reviewedAt);
  assert.deepEqual(updated.awardedPoints, request.awardedPoints);
  assert.equal((await edit(admin, { battleName: 'Stale edit' })).status, 409);
  const log = await (await call(reporter, '/battles')).json();
  assert.equal(log.battles[0].changeSet.battleName, 'Corrected report');
  assert.deepEqual(log.pendingBattles, []);
  assert.equal((await (await call(admin, '/map')).json()).teamStats.red.campaignPoints, 2);
});

test('battle loadouts reserve and consume purchased copies once while faction equipment stays reusable', async () => {
  const db = createAccountStore();
  const admin = expeditionAdmin(db);
  const red = expeditionTraveler(db, 'red');
  const blue = expeditionTraveler(db, 'blue');
  const green = expeditionTraveler(db, 'green');
  const disk = storage();
  const seed = { tiles: [{ id: '1-1', marker: 'blue' }] };
  let api = createExpeditionApi(seed, db, disk);
  const call = (user, route, body, method = body ? 'POST' : 'GET') => expeditionCall(api, user, route, method, body);
  const { items: [kit] } = await (await call(admin, '/shop', {
    name: 'Medkit', description: 'A field dressing.', action: 'Apply dressing.', cost: 0,
  })).json();
  assert.equal((await call(admin, '/shop', { id: kit.id, stock: { perUser: 2, total: 2 } }, 'PATCH')).status, 200);
  assert.equal((await call(blue, '/shop/purchase', { id: kit.id, quantity: 2 })).status, 201);
  assert.equal((await call(blue, '/teams/blue/faction-equipment', {
    slot: 1, equipment: { name: 'Optics', description: '' }, expectedEquipment: null,
  })).status, 200);
  const options = async () => (await (await call(blue, '/battle-equipment?team=blue')).json()).equipment;
  const teamGear = async () => (await (await call(blue, '/teams')).json()).teams.find(team => team.name === 'blue').items;
  const [faction, purchased] = await options();
  assert.equal(purchased.action, 'Apply dressing.');
  assert.equal((await teamGear())[0].action, 'Apply dressing.');
  const optics = { id: faction.id, quantity: 1 };
  const medkit = { id: purchased.id, quantity: 1 };
  assert.equal(purchased.available, 2);
  assert.equal((await call(red, '/battle-equipment?team=blue')).status, 403);

  const standard = {
    requestType: 'battle', battleType: 'standard', requesterTeam: 'blue',
    battleOpponent: 'red', battleLocation: '1-1', battleOutcome: 'blue',
  };
  const { request: canceled } = await (await call(blue, '/map-requests', { changeSet: standard, equipment: [medkit] })).json();
  assert.equal((await options())[1].available, 1);
  const editable = await call(blue, `/battle-equipment?team=blue&edit=${canceled.id}`);
  assert.equal((await editable.json()).equipment[1].available, 2);
  assert.equal((await call(blue, '/map-requests/cancel-own', { requestId: canceled.id })).status, 200);
  assert.equal((await options())[1].available, 2);
  const { request: battle } = await (await call(red, '/map-requests', { changeSet: {
    ...standard, battleType: 'multiplayer-op', requesterTeam: 'red', battleOpponent: 'blue', battleOpponents: ['blue', 'green'],
  } })).json();
  const confirm = (player, equipment) => call(player, '/map-requests/confirm', { requestId: battle.id, equipment });
  assert.equal((await confirm(blue, [{ ...medkit, quantity: 5 }])).status, 400);
  assert.equal((await confirm(blue, [optics, optics])).status, 400);
  assert.equal((await confirm(blue, [{ ...optics, quantity: 2 }])).status, 409);
  assert.equal((await confirm(green, [medkit])).status, 409);
  assert.equal((await confirm(blue, [optics, medkit])).status, 200);
  assert.equal((await options())[1].available, 1);
  assert.equal((await teamGear())[0].quantity, 2);
  assert.equal((await call(blue, '/map-requests', {
    changeSet: { ...standard, battleOpponent: 'outside-player' }, equipment: [{ ...medkit, quantity: 2 }],
  })).status, 409);

  api = createExpeditionApi(seed, db, disk);
  const completed = await confirm(green, []);
  assert.equal(completed.status, 200);
  const { request: approved } = await completed.json();
  assert.equal(approved.status, 'accepted');
  assert.deepEqual(approved.equipmentUsed.find(use => use.team === 'blue').items, [
    { ...optics, name: 'Optics', kind: 'faction' }, { ...medkit, name: 'Medkit', kind: 'purchased' },
  ]);
  assert.equal((await confirm(green, [])).status, 404);
  assert.equal((await teamGear())[0].quantity, 1);
  const edited = await call(admin, '/map-requests/update', {
    requestId: approved.id, expectedRevision: approved.revision,
    changeSet: { ...approved.changeSet, battleName: 'Updated equipment report' }, equipment: [medkit],
  });
  assert.equal(edited.status, 200);
  assert.deepEqual((await edited.json()).request.equipmentUsed, approved.equipmentUsed);
  assert.equal((await teamGear())[0].quantity, 1);

  const last = await call(blue, '/map-requests', {
    changeSet: { ...standard, battleOpponent: 'outside-player' }, equipment: [optics, medkit],
  });
  assert.equal((await last.json()).request.status, 'accepted');
  api = createExpeditionApi(seed, db, disk);
  assert.deepEqual((await options()).filter(item => item.kind !== 'universal'), [faction]);
  assert.deepEqual(await teamGear(), []);
  assert.equal((await call(blue, '/shop/purchase', { id: kit.id, quantity: 1 })).status, 409);
});

test('all teams can reuse the Universal Equipment catalog and only Expedition admins can edit its rules', async () => {
  const db = createAccountStore();
  const admin = expeditionAdmin(db);
  const red = expeditionTraveler(db, 'red');
  const blue = expeditionTraveler(db, 'blue');
  const disk = storage();
  const seed = { tiles: [{ id: '1-1', marker: 'red' }] };
  let api = createExpeditionApi(seed, db, disk);
  const options = async (player, team) =>
    (await (await expeditionCall(api, player, `/battle-equipment?team=${team}`)).json()).equipment.filter(item => item.kind === 'universal');
  const save = (player, body) => expeditionCall(api, player, '/universal-equipment', 'PATCH', body);
  const { universalEquipment } = await (await expeditionCall(api, red, '/teams')).json();
  assert.deepEqual(universalEquipment.map(item => item.name), [
    'Ammo Cache', 'Portable Barricade', 'Razor Wire', 'Comms Device', 'Mines', 'Light Barricade',
    'Utility Grenades', 'Heavy Barricade', 'Ladders', 'Explosive Grenades', 'Breaching Charge',
  ]);
  assert.ok(universalEquipment.every(item => item.description === '' && !item.action));
  const body = { id: 'ammo-cache', description: '  Fixture ability.  ', action: '  Fixture action.  ', expectedDescription: '', expectedAction: '' };
  assert.equal((await save(red, body)).status, 403);
  assert.equal((await save(admin, { ...body, id: 'made-up-item' })).status, 404);
  assert.equal((await save(admin, body)).status, 200);
  assert.equal((await save(admin, body)).status, 409);
  api = createExpeditionApi(seed, db, disk);
  const catalog = await options(red, 'red');
  assert.deepEqual(await options(blue, 'blue'), catalog);
  assert.deepEqual(catalog[0], {
    id: 'universal:ammo-cache', name: 'Ammo Cache', description: 'Fixture ability.', action: 'Fixture action.',
    available: 1, kind: 'universal',
  });
  const submit = equipment => expeditionCall(api, red, '/map-requests', 'POST', {
    equipment, changeSet: {
      requestType: 'battle', battleType: 'standard', requesterTeam: 'red',
      battleOpponent: 'outside-player', battleLocation: '1-1', battleScores: { red: 2, 'outside-player': 1 },
    },
  });
  assert.equal((await submit(catalog.slice(0, 5).map(item => ({ id: item.id, quantity: 1 })))).status, 400);
  for (let use = 0; use < 2; use++) {
    const { request } = await (await submit([{ id: catalog[0].id, quantity: 1 }])).json();
    assert.equal(request.status, 'accepted');
    assert.equal(request.equipmentUsed[0].items[0].kind, 'universal');
  }
  assert.deepEqual(await options(red, 'red'), catalog);
  const cleared = await save(admin, { ...body, action: '', expectedDescription: 'Fixture ability.', expectedAction: 'Fixture action.' });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).equipment.action, undefined);
});

test('Expedition rewards distinguish victors, draws and losers for each battle size', () => {
  const { battleAwards, readSettings } = globalThis.ExpeditionPointRewards;
  const teams = ['red', 'blue', 'green', 'yellow'];
  const awards = (battleType, battleOutcome, extra = {}, settings) => battleAwards({
    battleType, battleOutcome, requesterTeam: 'red', battleOpponent: 'blue', ...extra,
  }, settings, teams);
  const campaign = (team, amount) => [team, 'campaignPoints', amount];
  const supply = (team, amount) => [team, 'supplyPoints', amount];

  assert.deepEqual(awards('standard', 'red'), [campaign('red', 2), supply('blue', 1)]);
  assert.deepEqual(awards('standard', 'draw'), [supply('red', 1), supply('blue', 1)]);
  assert.deepEqual(awards('joint-op', 'joint-win'), [campaign('red', 1), campaign('blue', 1)]);
  assert.deepEqual(awards('joint-op', 'joint-loss'), []);
  assert.deepEqual(awards('joint-op', 'draw'), []);
  assert.deepEqual(awards('adversary-op', 'blue'), [campaign('blue', 3), supply('red', 2)]);
  assert.deepEqual(awards('adversary-op', 'draw'), [supply('red', 2), supply('blue', 2)]);
  const three = { battleOpponents: ['blue', 'green'] };
  const four = { battleOpponents: ['blue', 'green', 'yellow'] };
  const tied = { battleTiedTeams: ['blue', 'green'] };
  assert.deepEqual(awards('multiplayer-op', 'blue', three), [
    supply('red', 2), campaign('blue', 3), supply('green', 2),
  ]);
  assert.deepEqual(awards('multiplayer-op', 'blue', four), [
    supply('red', 2), campaign('blue', 4), supply('green', 2), supply('yellow', 2),
  ]);
  assert.deepEqual(awards('multiplayer-op', 'draw', { ...three, ...tied }), [
    supply('red', 2), campaign('blue', 3), campaign('green', 3),
  ]);
  assert.deepEqual(awards('multiplayer-op', 'draw', { ...four, ...tied }), [
    supply('red', 2), campaign('blue', 4), campaign('green', 4), supply('yellow', 2),
  ]);
  assert.deepEqual(awards('compound-op', 'draw'), []);
  assert.equal(readSettings({ multiplayerWinCampaignPerTeam: 2 }).multiplayerWin3Campaign, 6);
  assert.equal(readSettings({ multiplayerWinCampaignPerTeam: 2 }).multiplayerDraw4Campaign, 8);
});

test('a Multiplayer draw pays the configured tied and losing teams exactly once on approval', async () => {
  const db = createAccountStore();
  const admin = expeditionAdmin(db);
  const opponents = ['blue', 'green', 'yellow'].map(team => expeditionTraveler(db, team));
  const disk = storage();
  const seed = { tiles: [{ id: '1-1', marker: 'red' }] };
  let api = createExpeditionApi(seed, db, disk);
  const call = (route, body) => expeditionCall(api, admin, route, body ? 'POST' : 'GET', body);
  const { battleFields, readSettings } = globalThis.ExpeditionPointRewards;
  const settings = readSettings({ multiplayerDraw4Campaign: 6, multiplayerDraw4Supply: 1, multiplayerLossSupply: 3 });
  const pointRewards = Object.fromEntries(battleFields.map(([key]) => [key, settings[key]]));
  assert.equal((await call('/battle-settings', { pointRewards })).status, 200);
  const changeSet = {
    requestType: 'battle', battleType: 'multiplayer-op', requesterTeam: 'red', battleOpponent: 'blue', battleLocation: '1-1',
    battleOpponents: ['blue', 'green', 'yellow'], battleOutcome: 'draw', battleTiedTeams: ['red', 'green'],
  };
  for (const battleTiedTeams of [[], ['green'], ['red', 'red'], ['red', 'purple']]) {
    assert.equal((await call('/map-requests', { changeSet: { ...changeSet, battleTiedTeams } })).status, 400);
  }
  const { request } = await (await call('/map-requests', { changeSet })).json();
  assert.equal((await (await call('/map')).json()).teamStats?.red?.campaignPoints ?? 0, 0);
  api = createExpeditionApi(seed, db, disk);
  for (const opponent of opponents.slice(0, -1)) {
    assert.equal((await expeditionCall(api, opponent, '/map-requests/confirm', 'POST', { requestId: request.id })).status, 200);
  }
  const final = await expeditionCall(api, opponents.at(-1), '/map-requests/confirm', 'POST', { requestId: request.id });
  assert.equal(final.status, 200);
  const { request: approved, map } = await final.json();
  assert.equal(approved.status, 'accepted');
  assert.equal(approved.awardedPoints.length, 6);
  assert.deepEqual(map.teamStats, {
    red: { campaignPoints: 6, supplyPoints: 1 }, blue: { campaignPoints: 0, supplyPoints: 3 },
    green: { campaignPoints: 6, supplyPoints: 1 }, yellow: { campaignPoints: 0, supplyPoints: 3 },
  });
  assert.equal((await call('/map-requests/accept', { requestId: request.id })).status, 404);
});

test('Expedition Battles can be paused without losing reports or changing other Map requests', async () => {
  const db = createAccountStore();
  const admin = expeditionAdmin(db);
  const blue = expeditionTraveler(db, 'blue');
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
  assert.equal((await expeditionCall(api, blue, '/map-requests/confirm', 'POST', { requestId: approved.id })).status, 200);
  const { request: pending } = await (await call('/map-requests', 'POST', { changeSet })).json();

  api = createExpeditionApi(seed, db, browserStorage, { battlesEnabled: false });
  assert.equal((await call('/battles')).status, 503);
  assert.equal((await call('/battle-settings', 'POST', {})).status, 503);
  assert.equal((await call('/map-requests', 'POST', { changeSet })).status, 503);
  assert.equal((await call('/map-requests/update', 'POST', { requestId: pending.id, changeSet })).status, 503);
  for (const action of ['accept', 'deny', 'cancel-own', 'confirm']) {
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
  const { battles, pendingBattles } = await (await call('/battles')).json();
  assert.deepEqual(battles.map(battle => battle.id), [approved.id]);
  assert.deepEqual(pendingBattles.map(battle => battle.id), [pending.id]);
  const map = await (await call('/map')).json();
  assert.equal(map.pointRewards.standardWinCampaign, 5);
  assert.equal(map.pointRewards.baseTarget, 4);
  assert.equal(map.teamStats.red.campaignPoints, 5);
});

test('Expedition Backrooms restricts catalog management and migrates existing shop listings', async () => {
  const db = createAccountStore();
  const member = db.save(account('user', 'Quartermaster'));
  db.assignExpedition(member.id, 'admin', '');
  const manager = account('user', 'Quartermaster');
  const viewer = account('user');
  const owner = account('owner');
  const browserStorage = storage();
  const legacy = { id: 'legacy', name: 'Compass', description: 'Find your way.', cost: 0, visible: true };
  browserStorage.setItem('expedition-preview-shop', JSON.stringify([legacy]));
  let api = createExpeditionApi({ tiles: [] }, db, browserStorage);
  const shop = (user, method, body) => expeditionCall(api, user, '/shop', method, body);
  const listing = { name: ' Survey kit ', description: ' Equipment for scouting. ', cost: 12 };

  assert.equal((await shop(viewer, 'POST', listing)).status, 403);
  for (const fields of [{ name: ' ' }, { description: ' ' }, { cost: -1 }, { cost: 0.5 }, { cost: '12' }]) {
    assert.equal((await shop(manager, 'POST', { ...listing, ...fields })).status, 400);
  }
  const created = await shop(manager, 'POST', listing);
  assert.equal(created.status, 201);
  const { items: [migrated, item] } = await created.json();
  assert.deepEqual(migrated, { ...legacy, perUser: 1, remaining: null, owned: 0 });
  assert.deepEqual(item, { id: item.id, name: 'Survey kit', description: 'Equipment for scouting.', cost: 12, visible: false, perUser: 1, remaining: null, owned: 0 });
  assert.deepEqual(await (await shop(viewer)).json(), { items: [migrated], canManage: false, canPurchase: false, credits: null });
  assert.deepEqual((await (await shop(owner)).json()).items, [migrated, item]);
  const stock = { perUser: null, total: 3 };
  assert.equal((await shop(viewer, 'PATCH', { id: item.id, stock })).status, 403);
  assert.equal((await shop(manager, 'PATCH', { id: 'missing', stock })).status, 404);
  assert.equal((await shop(manager, 'PATCH', { id: item.id, stock: { perUser: 0, total: null } })).status, 400);
  assert.equal((await shop(manager, 'PATCH', { id: item.id, stock })).status, 200);
  const stocked = { ...item, visible: true, perUser: null, remaining: 3 };
  assert.deepEqual((await (await shop(viewer)).json()).items, [migrated, stocked]);

  api = createExpeditionApi({ tiles: [] }, db, browserStorage);
  assert.deepEqual((await (await shop(viewer)).json()).items, [migrated, stocked]);
  assert.equal((await shop(owner, 'PATCH', { id: item.id, visible: false })).status, 200);
  assert.deepEqual((await (await shop(viewer)).json()).items, [migrated]);
  assert.deepEqual((await (await shop(manager)).json()).items, [migrated, { ...stocked, visible: false }]);
});

test('Expedition purchases spend shared credits, enforce stock and per-user limits, and persist equipment', async () => {
  const db = createAccountStore();
  const alice = db.save(account('user'));
  const bob = db.save(account('user', 'Bob'));
  const carol = db.save(account('user', 'Carol'));
  db.assignExpedition(alice.id, 'traveler', 'red');
  db.assignExpedition(bob.id, 'traveler', 'red');
  db.assignExpedition(carol.id, 'traveler', 'blue');
  const admin = expeditionAdmin(db);
  const disk = storage();
  let failWrite = false;
  const browserStorage = {
    getItem: disk.getItem,
    setItem(key, value) {
      if (failWrite) throw new Error('Storage full');
      disk.setItem(key, value);
    },
  };
  const seed = { tiles: [], teamStats: { red: { credits: 24 }, blue: { credits: 1 } } };
  let api = createExpeditionApi(seed, db, browserStorage);
  const call = (user, path, method, body) => expeditionCall(api, user, path, method, body);
  const { items: [listing] } = await (await call(admin, '/shop', 'POST', {
    name: 'Medkit', description: 'Treat an injury.', cost: 6,
  })).json();
  const buy = (buyer, quantity = 1) => call(buyer, '/shop/purchase', 'POST', { id: listing.id, quantity });
  const stock = (perUser, total) => call(admin, '/shop', 'PATCH', { id: listing.id, stock: { perUser, total } });
  const roster = async name => (await (await call(admin, '/teams')).json()).teams.find(team => team.name === name);
  assert.equal((await buy(alice)).status, 404);
  assert.equal((await stock(1, 3)).status, 200);
  assert.equal((await buy(account('user', 'Unassigned'))).status, 403);
  assert.equal((await buy(carol)).status, 409);
  assert.equal((await buy(alice, 0)).status, 400);
  assert.equal((await buy(alice, 2)).status, 409);
  assert.equal((await call(admin, '/teams/red/items', 'POST', { name: 'Radio' })).status, 201);
  failWrite = true;
  assert.equal((await buy(alice)).status, 500);
  failWrite = false;
  assert.equal((await roster('red')).points.credits, 24);
  assert.deepEqual((await roster('red')).items.map(item => item.name), ['Radio']);
  assert.equal((await (await call(alice, '/shop')).json()).items[0].remaining, 3);
  const results = await Promise.all([buy(alice), buy(alice)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  const red = await roster('red');
  assert.equal(red.points.credits, 18);
  assert.equal(red.items.length, 2);
  const item = red.items.find(entry => entry.name === 'Medkit');
  assert.deepEqual(item, { id: item.id, name: 'Medkit', description: 'Treat an injury.', quantity: 1 });
  assert.deepEqual((await roster('blue')).items, []);

  assert.equal((await buy(bob)).status, 201);
  const capped = await buy(alice);
  assert.equal(capped.status, 409);
  assert.match((await capped.json()).message, /exceeds your limit/);
  assert.equal((await stock(2, 1)).status, 200);
  assert.equal((await buy(alice)).status, 201);
  assert.equal((await (await call(alice, '/shop')).json()).items[0].remaining, 0);
  assert.equal((await buy(alice)).status, 409);

  api = createExpeditionApi(seed, db, browserStorage);
  assert.equal((await roster('red')).points.credits, 6);
  assert.deepEqual((await roster('red')).items.map(entry => entry.name), ['Radio', 'Medkit', 'Medkit', 'Medkit']);
  assert.equal((await stock(null, null)).status, 200);
  assert.equal((await buy(alice, 2)).status, 409);
  assert.equal((await buy(alice)).status, 201);
  const emptyBalance = (await roster('red')).points;
  assert.equal(emptyBalance.credits, 0);
  assert.equal((await (await call(alice, '/shop')).json()).items[0].remaining, null);
  assert.equal((await call(admin, '/teams/red/points', 'POST', {
    points: { ...emptyBalance, credits: 12 }, expectedPoints: emptyBalance,
  })).status, 200);
  assert.equal((await buy(alice, 2)).status, 201);
  assert.ok((await roster('red')).items.some(entry => entry.name === 'Medkit' && entry.quantity === 2));
});

test('Expedition travelers can add units to their assigned roster and general equipment requires an admin', async () => {
  const db = createAccountStore();
  const alice = db.save(account('user'));
  const bob = db.save(account('user', 'Bob'));
  db.assignExpedition(alice.id, 'traveler', 'red');
  db.assignExpedition(bob.id, 'viewer', 'red');
  const traveler = account('user');
  const viewer = account('user', 'Bob');
  const admin = expeditionAdmin(db);
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
  assert.equal((await add(admin, 'red', 'items', '   ')).status, 400);
  assert.equal((await add(traveler, 'red', 'units', '  Scouts  ')).status, 201);
  assert.equal((await add(traveler, 'red', 'items', 'Survey kit')).status, 403);
  assert.equal((await add(admin, 'red', 'items', 'Survey kit')).status, 201);
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
  assert.equal(ownTeam.canAddEquipment, false);
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
  assert.ok(adminTeams.every(team => team.canAddEquipment));
  assert.equal(adminTeams.find(team => team.name === 'blue').units[0].name, 'Veterans');
});

test('Expedition rosters have four editable faction equipment slots separate from general equipment', async () => {
  const db = createAccountStore();
  const red = expeditionTraveler(db, 'red');
  const admin = expeditionAdmin(db);
  const viewer = db.save(account('user', 'Red Viewer'));
  db.assignExpedition(viewer.id, 'viewer', 'red');
  const disk = storage();
  const seed = { tiles: [] };
  const legacy = { units: [], items: [{ id: 'radio', name: 'Radio' }] };
  disk.setItem('expedition-preview-roster-red', JSON.stringify(legacy));
  let api = createExpeditionApi(seed, db, disk);
  const roster = async name => (await (await expeditionCall(api, red, '/teams')).json()).teams.find(team => team.name === name);
  const save = (user, team, slot, equipment, expectedEquipment = null) =>
    expeditionCall(api, user, `/teams/${team}/faction-equipment`, 'POST', { slot, equipment, expectedEquipment });
  const equipment = { name: '  Scout Optics  ', description: '  Improves visibility.\nWorks in darkness.  ', action: '  Scan.  ' };
  assert.deepEqual((await roster('red')).factionEquipment, [null, null, null, null]);
  assert.equal((await save(red, 'blue', 1, equipment)).status, 403);
  assert.equal((await save(viewer, 'red', 1, equipment)).status, 403);
  assert.equal((await save(admin, 'blue', 1, equipment)).status, 200);
  assert.equal((await save(red, 'red', 5, equipment)).status, 400);
  assert.equal((await save(red, 'red', 1, { ...equipment, name: ' ' })).status, 400);
  const saved = { name: 'Scout Optics', description: 'Improves visibility.\nWorks in darkness.', action: 'Scan.' };
  const first = await save(red, 'red', 1, { ...equipment, quantity: 1 });
  assert.equal(first.status, 200);
  assert.deepEqual((await first.json()).equipment, saved);
  for (const slot of [2, 3, 4]) {
    assert.equal((await save(red, 'red', slot, { name: `Equipment ${slot}`, description: '' })).status, 200);
  }
  api = createExpeditionApi(seed, db, disk);
  assert.equal((await roster('red')).factionEquipment.filter(Boolean).length, 4);
  assert.deepEqual((await roster('red')).items, legacy.items);
  const conflict = await save(red, 'red', 1, null);
  assert.equal(conflict.status, 409);
  assert.deepEqual((await conflict.json()).equipment, saved);
  assert.equal((await save(red, 'red', 1, null, saved)).status, 200);
  const replacement = { name: 'Survey kit', description: '' };
  assert.equal((await save(red, 'red', 1, replacement)).status, 200);
  assert.deepEqual((await roster('red')).factionEquipment[0], replacement);
  assert.deepEqual((await roster('blue')).factionEquipment, [saved, null, null, null]);
});

test('Expedition team names can be changed without changing team colors or rosters', async () => {
  const db = createAccountStore();
  const traveler = db.save(account('user'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const admin = expeditionAdmin(db);
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

test('Expedition lore respects roster permissions and persists independently for each team', async () => {
  const db = createAccountStore();
  const traveler = db.save(account('user'));
  db.assignExpedition(traveler.id, 'traveler', 'red');
  const viewer = account('user', 'Viewer');
  const admin = expeditionAdmin(db);
  const browserStorage = storage();
  const seed = { tiles: [] };
  const roster = { displayName: 'Night Scouts', units: [{ id: 'unit', name: 'Scout' }], items: [{ id: 'item', name: 'Radio' }] };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify(roster));
  let api = createExpeditionApi(seed, db, browserStorage);
  const save = (user, team, lore, expectedLore = '') =>
    expeditionCall(api, user, `/teams/${team}/lore`, 'POST', { lore, expectedLore });
  const lore = 'The Scouts guard the canyon.\n\nTheir camp is hidden.';

  assert.equal((await save(viewer, 'red', lore)).status, 403);
  assert.equal((await save(traveler, 'blue', lore)).status, 403);
  assert.equal((await save(traveler, 'red', null)).status, 400);
  const saved = await save(traveler, 'red', `  ${lore}  `);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { lore });
  const stale = await save(admin, 'red', 'Stale edit');
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).lore, lore);
  assert.equal((await save(admin, 'blue', 'The Harbor Guard watch the docks.')).status, 200);

  api = createExpeditionApi(seed, db, browserStorage);
  const { teams } = await (await expeditionCall(api, viewer, '/teams')).json();
  const red = teams.find(team => team.name === 'red');
  assert.equal(red.lore, lore);
  assert.equal(red.displayName, roster.displayName);
  assert.deepEqual(red.units, roster.units);
  assert.deepEqual(red.items, roster.items);
  assert.equal(teams.find(team => team.name === 'blue').lore, 'The Harbor Guard watch the docks.');
  assert.equal((await save(traveler, 'red', '', lore)).status, 200);
  assert.equal(JSON.parse(browserStorage.getItem('expedition-preview-roster-red')).lore, '');
});

test('Expedition units require four valid stats and preserve older roster entries', async () => {
  const db = createAccountStore();
  const admin = expeditionAdmin(db);
  const browserStorage = storage();
  const legacy = { id: 'older-unit', name: 'Veteran' };
  browserStorage.setItem('expedition-preview-roster-red', JSON.stringify({ units: [legacy], items: [] }));
  const api = createExpeditionApi({ tiles: [] }, db, browserStorage);
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
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
  const db = createAccountStore();
  const api = createExpeditionApi(seed, db);
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
  assert.equal((await expeditionCall(api, expeditionAdmin(db), '/map', 'POST', { map: nextMap })).status, 200);
  assert.deepEqual((await list()).find(team => team.name === 'red').locations, {
    bases: [], camps: [], positions: ['4-5'],
  });
});

test('Expedition Team Management edits the Map balances and rejects stale edits', async () => {
  const db = createAccountStore();
  const player = db.save(account('user'));
  db.assignExpedition(player.id, 'traveler', 'red');
  const admin = expeditionAdmin(db);
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
  const admin = expeditionAdmin(db);
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
    changeSet: { requestType: 'battle', battleType: 'standard', battleResult: 'won', requesterTeam: 'red', battleOpponent: 'outside-player', battleLocation: '0-0' },
  })).json();
  assert.deepEqual(request.review.requiredTeams, []);
  assert.equal(request.status, 'accepted');
  assert.equal((await call(admin, '/map-requests/accept', 'POST', { requestId: request.id })).status, 404);
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
  const admin = expeditionAdmin(db);
  assert.equal((await expeditionCall(api, admin, '/map-requests/deny', 'POST', { requestId: second.request.id })).status, 200);
  assert.equal((await (await expeditionCall(api, admin, '/map-requests/list')).json()).requests.length, 0);
  assert.equal((await (await expeditionCall(api, alice, '/map-requests/history')).json()).requests.length, 2);
  assert.equal((await expeditionCall(api, admin, '/map-requests/accept', 'POST', {})).status, 501);
});
