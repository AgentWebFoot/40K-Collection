import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hostModule = await import('../HybridCampaign/server/atlas-preview-host.ts');
const { createAtlasPreviewHost } = hostModule.default ?? hostModule;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = host => new Promise((resolve, reject) => { const server = http.createServer((request, response) => host.handle(request, response)); server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server)); });
const close = server => new Promise(resolve => server.close(resolve));
const headers = (role, account = 'preview-account:test') => ({ 'X-Preview-Campaign-Role': role, 'X-Preview-Campaign-Account': account });
const keysIn = value => Array.isArray(value) ? value.flatMap(keysIn) : value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => [key, ...keysIn(child)]) : [];

test('Atlas preview profiles are account-bound, persistent, and expose only the player command-deck projection', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'atlas-preview-'));
  const snapshotPath = path.join(temp, 'state.json');
  let server;
  try {
    const host = await createAtlasPreviewHost(projectRoot, { snapshotPath });
    assert.equal(host.getProfiles().length, 5);
    assert.deepEqual(host.getProfiles().map(profile => profile.supportingFactionRecipientId).sort(), ['adeptus-astartes', 'adeptus-mechanicus', 'agents-imperium', 'astra-militarum', 'grey-knights']);
    server = await listen(host);
    const port = server.address().port;
    const call = (route, init = {}) => fetch(`http://127.0.0.1:${port}${route}`, init);
    const player = headers('player', 'preview-account:player-one');

    const optionsResponse = await call('/hybrid-campaign/api/preview/onboarding-options', { headers: player });
    assert.equal(optionsResponse.status, 200);
    assert.equal(optionsResponse.headers.get('cache-control'), 'no-store');
    const options = await optionsResponse.json();
    assert.equal(options.factions.length, 5);

    const onboarding = await call('/hybrid-campaign/api/preview/onboarding', { method: 'POST', headers: { ...player, 'Content-Type': 'application/json' }, body: JSON.stringify({ characterName: 'Integration Player', supportingFactionRecipientId: options.factions[0].id, supportingFactionName: 'Verification Cohort' }) });
    assert.equal(onboarding.status, 201);
    const created = await onboarding.json();
    assert.equal(created.identity.role, 'player');

    const atlasResponse = await call('/hybrid-campaign/api/atlas', { headers: player });
    assert.equal(atlasResponse.status, 200);
    const atlas = await atlasResponse.json();
    assert.deepEqual(Object.keys(atlas).sort(), ['campaignDate', 'locations', 'partyLocationId', 'playerName', 'urgentSignals']);
    assert.equal(atlas.campaignDate, 'M7 D5, 412.M42');
    assert.equal(atlas.playerName, 'Integration Player');
    assert.equal(atlas.partyLocationId, null);
    assert.equal(atlas.locations.length, 16);
    assert.deepEqual(atlas.locations.find(location => location.id === 'location-eonope').mapPosition, { x: 70.5, y: 13.5 });
    assert.deepEqual(Object.keys(atlas.locations[0]).sort(), ['authorityAccess', 'consequences', 'detailStatus', 'id', 'mapLabel', 'mapPosition', 'publicDescription', 'title']);
    assert.equal(atlas.urgentSignals.length, 0);
    const prohibited = new Set(['gmSecrets', 'sourceReference', 'contacts', 'routes', 'travel', 'evidence', 'assets', 'audit', 'notes']);
    assert.deepEqual(keysIn(atlas).filter(key => prohibited.has(key)), []);

    const formerWorldRoute = await call('/hybrid-campaign/api/campaign/world', { headers: player });
    assert.equal(formerWorldRoute.status, 404);
    const forgedRole = await call('/hybrid-campaign/api/atlas', { headers: headers('owner-gm', 'preview-account:player-one') });
    assert.equal(forgedRole.status, 403);
    await close(server); server = undefined;

    const restarted = await createAtlasPreviewHost(projectRoot, { snapshotPath });
    assert.equal(restarted.getProfiles().length, 6);
    server = await listen(restarted);
    const persisted = await fetch(`http://127.0.0.1:${server.address().port}/hybrid-campaign/api/preview/profile`, { headers: player });
    assert.equal(persisted.status, 200);
    assert.equal((await persisted.json()).profile.identityId, created.identity.id);
  } finally { if (server) await close(server); await rm(temp, { recursive: true, force: true }); }
});
