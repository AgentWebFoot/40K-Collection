import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeExpeditionData, openExpeditionStorage } from './expedition-storage.mjs';
import { createPreviewService } from './service.mjs';
import { createAccountStore } from './accounts.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), '40k-expedition-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return {
    directory,
    read: file => JSON.parse(readFileSync(path.join(directory, file), 'utf8')),
    write: (file, value) => writeFileSync(path.join(directory, file), JSON.stringify(value)),
  };
}

const seed = { rows: 1, cols: 1, tiles: [{ id: '1-1', marker: 'red' }], round: 3, teamStats: { red: { supplyPoints: 2 } } };
const owner = { username: 'Owner', role: 'owner' };

test('Expedition build initialization only creates missing files and separates the map from team saves', t => {
  const { directory, read, write } = fixture(t);
  initializeExpeditionData(directory, seed);
  assert.deepEqual(read('map.json'), { rows: 1, cols: 1, tiles: seed.tiles });
  assert.deepEqual(read('settings.json'), { round: 3 });
  assert.deepEqual(read('teams/red.json').points, { supplyPoints: 2, campaignPoints: 0, credits: 0 });
  assert.deepEqual(read('bounties.json'), { bounties: [], pendingRequests: [] });
  assert.deepEqual(read('shop.json'), { items: [] });
  assert.deepEqual(read('battles.json'), { battles: [] });
  assert.deepEqual(read('lore.json'), { posts: [] });
  const savedBlue = { ...read('teams/blue.json'), displayName: 'Existing team' };
  write('teams/blue.json', savedBlue);
  initializeExpeditionData(directory, { ...seed, cols: 2, round: 8 });
  assert.equal(read('map.json').cols, 1);
  assert.equal(read('settings.json').round, 3);
  assert.deepEqual(read('teams/blue.json'), savedBlue);
});

test('legacy browser saves are imported once and later builds preserve the migrated data', async t => {
  const { directory, read } = fixture(t);
  const storage = openExpeditionStorage(directory, seed);
  const service = createPreviewService(storage);
  const fresh = await service({ operation: 'initialize' });
  assert.equal(fresh.accounts.filter(account => account.testFixtureId).length, 5);
  const legacy = {
    'pyrrhic-preview-accounts-v1': JSON.stringify({ accounts: [{
      id: 1, username: 'Traveler', role: 'user', membershipRole: 'viewer', team: 0, expeditionMembershipRole: 'traveler', expeditionTeam: 'red',
    }], nextId: 2 }),
    'expedition-preview-roster-red': JSON.stringify({ units: [], items: [], displayName: 'Imported team' }),
    'expedition-preview-battles': JSON.stringify({
      battles: [], teamStats: { red: { supplyPoints: 6, campaignPoints: 4 } }, shop: {
        items: [{ name: 'Imported shop fixture' }], purchases: [{ id: 'item', name: 'Imported gear', team: 'red', quantity: 1 }],
      },
    }),
  };
  const initialized = await service({ operation: 'initialize', legacy });
  assert.equal(initialized.status, 200);
  assert.equal(initialized.accounts[0].expeditionTeam, 'red');
  const player = initialized.accounts[0];
  assert.equal((await service({ operation: 'assign-campaign-role', account: owner, id: player.id, role: 'player' })).status, 200);
  assert.equal((await service({ operation: 'assign-campaign-identity', account: player, id: player.id, identityId: 'tavrellis-test' })).status, 200);
  assert.equal(createAccountStore(storage).find(player.username).campaignIdentityId, 'tavrellis-test');
  assert.equal(read('teams/red.json').displayName, 'Imported team');
  assert.equal(read('teams/red.json').points.campaignPoints, 4);
  assert.equal(read('shop.json').items[0].name, 'Imported shop fixture');
  assert.equal(Object.hasOwn(read('shop.json'), 'purchases'), false);
  assert.equal(read('teams/red.json').purchases[0].name, 'Imported gear');
  await service({ operation: 'initialize', legacy: {
    ...legacy, 'expedition-preview-roster-red': JSON.stringify({ units: [], items: [], displayName: 'Different browser' }),
  } });
  assert.equal(read('teams/red.json').displayName, 'Imported team');
});

test('map edits and battle payouts persist through a restart in their respective JSON files', async t => {
  const { directory, read, write } = fixture(t);
  let service = createPreviewService(openExpeditionStorage(directory, seed));
  const call = (route, body) => service({ account: owner, route: '/expedition' + route,
    method: body ? 'POST' : 'GET', body: body && JSON.stringify(body) });
  const map = { ...seed, cols: 2, teamStats: { red: { supplyPoints: 9 } }, shop: { items: [] } };
  assert.equal((await call('/map', { map })).status, 200);
  assert.equal(read('map.json').cols, 2);
  assert.equal(read('teams/red.json').points.supplyPoints, 2);
  const { payload: { request } } = await call('/map-requests', { changeSet: {
    requestType: 'battle', battleType: 'standard', requesterTeam: 'red', battleOpponent: 'outside-player',
    battleLocation: '1-1', battleScores: { red: 2, 'outside-player': 1 },
  } });
  assert.equal(request.status, 'accepted');
  assert.equal(read('battles.json').battles[0].id, request.id);
  assert.equal(read('teams/red.json').points.campaignPoints, 2);
  assert.deepEqual(read('map.json'), { rows: 1, cols: 2, tiles: seed.tiles });
  const red = read('teams/red.json');
  write('.pending-write.json', { 'teams/red.json': { ...red, points: { ...red.points, credits: 5 } } });
  service = createPreviewService(openExpeditionStorage(directory, seed));
  const savedMap = (await call('/map')).payload;
  assert.equal(savedMap.cols, 2);
  assert.deepEqual(savedMap.teamStats.red, { supplyPoints: 2, campaignPoints: 2, credits: 5 });
  assert.equal((await call('/battles')).payload.battles[0].id, request.id);
});

test('Battles keep their submission round and linked Lore inherits the round and tile', async t => {
  const { directory, read } = fixture(t);
  const storage = openExpeditionStorage(directory, seed);
  const accounts = createAccountStore(storage);
  const traveler = { username: 'Lore Writer', role: 'user' };
  accounts.assignExpedition(accounts.save(traveler).id, 'traveler', 'red');
  accounts.assignExpedition(accounts.save(owner).id, 'admin', 'green');
  const viewer = { username: 'Other Player', role: 'manager' };
  let service = createPreviewService(storage);
  const call = (account, route, body) => service({ account, route: '/expedition' + route,
    method: body ? 'POST' : 'GET', body: body && JSON.stringify(body) });
  const changeSet = {
    requestType: 'battle', battleName: 'Night Raid', battleType: 'standard', requesterTeam: 'red',
    battleOpponent: 'outside-player', battleLocation: '1-1', battleScores: { red: 2, 'outside-player': 1 }, submissionRound: 1,
  };
  const approved = await call(owner, '/map-requests', { changeSet });
  assert.equal(approved.payload.request.status, 'accepted');
  assert.equal(approved.payload.request.changeSet.submissionRound, 3);
  const pending = await call(traveler, '/map-requests', { changeSet: {
    ...changeSet, battleOpponent: 'blue', battleScores: { red: 2, blue: 1 },
  } });
  assert.equal(pending.payload.request.status, 'pending');
  assert.equal(pending.payload.request.changeSet.submissionRound, 3);
  assert.equal((await call(owner, '/round', { round: 5, expectedRound: 3 })).status, 200);
  const edited = await call(owner, '/map-requests/update', { requestId: approved.payload.request.id,
    changeSet: { ...changeSet, submissionRound: 5 } });
  assert.equal(edited.payload.request.changeSet.submissionRound, 3);
  const editedPending = await call(traveler, '/map-requests/update', { requestId: pending.payload.request.id,
    changeSet: { ...pending.payload.request.changeSet, submissionRound: 5 } });
  assert.equal(editedPending.payload.request.changeSet.submissionRound, 3);
  const draft = { title: 'The Long March', text: 'Our group reached the crossing.', round: 2, tileId: 'missing',
    battleId: approved.payload.request.id, team: 'blue', author: 'Another person' };
  assert.equal((await call(viewer, '/lore', draft)).status, 403);
  const ownerLore = (await call(owner, '/lore')).payload;
  assert.equal(ownerLore.canPost, true);
  assert.deepEqual(ownerLore.battles, []);
  assert.equal((await call(owner, '/lore', draft)).status, 400);
  assert.equal((await call(traveler, '/lore', { ...draft, battleId: '', tileId: '', round: 6 })).status, 400);
  assert.equal((await call(traveler, '/lore', { ...draft, battleId: '' })).status, 400);
  assert.equal((await call(traveler, '/lore', { ...draft, battleId: pending.payload.request.id })).status, 400);
  const published = await call(traveler, '/lore', draft);
  assert.equal(published.status, 201);
  const { post } = published.payload;
  assert.equal(post.team, 'red');
  assert.equal(post.author, traveler.username);
  assert.equal(post.round, 3);
  assert.equal(post.tileId, '1-1');
  assert.equal(post.battle.name, 'Night Raid');
  assert.equal(post.battle.round, 3);
  assert.equal(post.battle.tileId, '1-1');
  assert.equal(read('lore.json').posts[0].battleId, draft.battleId);

  initializeExpeditionData(directory, seed);
  service = createPreviewService(openExpeditionStorage(directory, seed));
  const visible = (await call(traveler, '/lore')).payload;
  assert.deepEqual(visible.posts, [post]);
  assert.deepEqual(visible.battles.map(battle => battle.id), [draft.battleId]);
  assert.equal(visible.battles[0].round, 3);
  assert.equal(visible.battles[0].tileId, '1-1');
  assert.equal((await call(owner, '/lore')).payload.posts[0].battle.id, draft.battleId);
  const otherUser = (await call(viewer, '/lore')).payload;
  assert.equal(otherUser.canPost, false);
  assert.equal(otherUser.posts[0].text, draft.text);
  assert.equal(otherUser.posts[0].battle, null);
  assert.equal(Object.hasOwn(otherUser.posts[0], 'battleId'), false);
});
