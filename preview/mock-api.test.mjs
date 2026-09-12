import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockApi } from './mock-api.mjs';
import { createAccountStore, roles } from './accounts.mjs';

const account = (role, username = 'Alice') => ({ role, username });
const call = (api, user, route, method = 'GET', body) => api(user, `http://localhost/pyrrhic-war${route}`, { method, body: body && JSON.stringify(body) });
const storage = () => { let data = null; return { getItem: () => data, setItem: (_, value) => { data = value; } }; };

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
