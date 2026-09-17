import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockApi } from './mock-api.mjs';
import { campaignRoles, createAccountStore, roles } from './accounts.mjs';
import { createExpeditionApi } from './expedition-api.mjs';

const account = (role, username = 'Alice') => ({ role, username });
const call = (api, user, route, method = 'GET', body) => api(user, `http://localhost/pyrrhic-war${route}`, { method, body: body && JSON.stringify(body) });
const storage = () => { let data = null; return { getItem: () => data, setItem: (_, value) => { data = value; } }; };
const expeditionCall = (api, user, route, method = 'GET', body) => api(user, `http://localhost/expedition${route}`, { method, body: body && JSON.stringify(body) });

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
