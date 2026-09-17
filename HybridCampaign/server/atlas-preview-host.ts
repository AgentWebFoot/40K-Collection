import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPlayerAtlasProjection } from './atlas-service';
import { campaignTestPlayers } from '../test-player-fixtures.mjs';

export type PreviewPlayerProfile = {
  id: string;
  accountKey: string;
  identityId: string;
  characterName: string;
  supportingFactionRecipientId: string;
  supportingFactionName: string;
  createdAt: string;
  updatedAt: string;
};

type PreviewSnapshot = { schemaVersion: 2; savedAt: string; profiles: PreviewPlayerProfile[] };

const factions = [
  { id: 'adeptus-astartes', name: 'Adeptus Astartes' },
  { id: 'adeptus-mechanicus', name: 'Adeptus Mechanicus' },
  { id: 'agents-imperium', name: 'Agents of the Imperium' },
  { id: 'astra-militarum', name: 'Astra Militarum' },
  { id: 'grey-knights', name: 'Grey Knights' },
] as const;

const json = (response: ServerResponse, value: unknown, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
};
const fail = (response: ServerResponse, message: string, status = 400) => json(response, { error: message }, status);
const header = (request: IncomingMessage, name: string) => typeof request.headers[name] === 'string' ? request.headers[name]!.trim() : '';
const now = () => new Date().toISOString();
const profileShape = (value: unknown): value is PreviewPlayerProfile => !!value && typeof value === 'object'
  && ['id', 'accountKey', 'identityId', 'characterName', 'supportingFactionRecipientId', 'supportingFactionName', 'createdAt', 'updatedAt']
    .every(key => typeof (value as Record<string, unknown>)[key] === 'string');

const readJson = async (request: IncomingMessage) => new Promise<Record<string, unknown>>((resolveBody, reject) => {
  let body = '';
  let bytes = 0;
  request.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 16 * 1024) { request.destroy(); reject(new Error('The Atlas profile request is too large.')); return; }
    body += chunk;
  });
  request.on('end', () => {
    try { resolveBody(body ? JSON.parse(body) as Record<string, unknown> : {}); }
    catch { reject(new Error('The Atlas profile request must contain valid JSON.')); }
  });
  request.on('error', reject);
});

/**
 * Local-only bridge between saved Tavern-preview accounts and the read-only
 * Atlas. This is intentionally not a general campaign service or auth system.
 */
export async function createAtlasPreviewHost(projectRoot: string, options: { snapshotPath?: string } = {}) {
  const snapshotPath = options.snapshotPath ?? resolve(projectRoot, 'HybridCampaign', '.campaign-preview-state.json');
  let profiles: PreviewPlayerProfile[] = [];
  if (existsSync(snapshotPath)) {
    try {
      const parsed = JSON.parse(await readFile(snapshotPath, 'utf8')) as { profiles?: unknown[] };
      profiles = (parsed.profiles ?? []).filter(profileShape).map(profile => ({ ...profile }));
    } catch {
      // A corrupt local-only preview state must not prevent the Atlas preview
      // from starting. The next profile mutation writes a clean slim snapshot.
      profiles = [];
    }
  }

  let changed = false;
  for (const fixture of campaignTestPlayers) {
    const accountKey = `preview-test:${fixture.id}`;
    if (profiles.some(profile => profile.accountKey === accountKey)) continue;
    const createdAt = now();
    profiles.push({ id: `atlas-profile-${fixture.id}`, accountKey, identityId: `atlas-identity-${fixture.id}`, characterName: fixture.characterName, supportingFactionRecipientId: fixture.recipientId, supportingFactionName: fixture.supportingFactionName, createdAt, updatedAt: createdAt });
    changed = true;
  }
  const persist = async () => {
    const snapshot: PreviewSnapshot = { schemaVersion: 2, savedAt: now(), profiles };
    await mkdir(dirname(snapshotPath), { recursive: true });
    const temporary = `${snapshotPath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot, null, 2), 'utf8');
    await rename(temporary, snapshotPath);
  };
  if (changed) await persist();

  const playerFor = (request: IncomingMessage, requireProfile = true) => {
    if (header(request, 'x-preview-campaign-role') !== 'player') throw new Error('This command deck is cleared for player accounts only.');
    const accountKey = header(request, 'x-preview-campaign-account');
    if (!accountKey || accountKey.length > 160) throw new Error('The local player account is unavailable. Reload the preview and try again.');
    const profile = profiles.find(entry => entry.accountKey === accountKey);
    if (requireProfile && !profile) throw new Error('This account needs a Tavrellis player profile.');
    return { accountKey, profile };
  };

  const onboard = async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const { accountKey, profile: existing } = playerFor(request, false);
      if (existing) return fail(response, 'This account already has a Tavrellis player profile.', 409);
      const body = await readJson(request);
      const characterName = typeof body.characterName === 'string' ? body.characterName.trim() : '';
      const recipientId = typeof body.supportingFactionRecipientId === 'string' ? body.supportingFactionRecipientId : '';
      const supportingFactionName = typeof body.supportingFactionName === 'string' ? body.supportingFactionName.trim() : '';
      if (!characterName || characterName.length > 80) return fail(response, 'Enter a character name of 1–80 characters.');
      if (!supportingFactionName || supportingFactionName.length > 120) return fail(response, 'Enter a supporting faction or warband name of 1–120 characters.');
      if (!factions.some(faction => faction.id === recipientId)) return fail(response, 'Choose an approved supporting faction.');
      if (profiles.some(profile => profile.characterName.localeCompare(characterName, undefined, { sensitivity: 'accent' }) === 0)) return fail(response, 'That character name is already assigned to a local player profile.', 409);
      const createdAt = now();
      const profile: PreviewPlayerProfile = { id: randomUUID(), accountKey, identityId: randomUUID(), characterName, supportingFactionRecipientId: recipientId, supportingFactionName, createdAt, updatedAt: createdAt };
      profiles = [...profiles, profile];
      await persist();
      return json(response, { profile, identity: { id: profile.identityId, name: profile.characterName, role: 'player' } }, 201);
    } catch (error) { return fail(response, error instanceof Error ? error.message : 'The player profile could not be created.', 403); }
  };

  return {
    getProfiles: () => profiles.map(profile => ({ ...profile })),
    async handle(request: IncomingMessage, response: ServerResponse) {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      try {
        if (pathname === '/hybrid-campaign/api/preview/profile' && request.method === 'GET') {
          const { profile } = playerFor(request, false);
          return json(response, { profile: profile ? { ...profile } : null });
        }
        if (pathname === '/hybrid-campaign/api/preview/onboarding-options' && request.method === 'GET') {
          playerFor(request, false);
          return json(response, { factions });
        }
        if (pathname === '/hybrid-campaign/api/preview/onboarding' && request.method === 'POST') return onboard(request, response);
        if (pathname === '/hybrid-campaign/api/atlas' && request.method === 'GET') {
          const { profile } = playerFor(request);
          return json(response, createPlayerAtlasProjection(profile!.characterName));
        }
        return fail(response, 'No Atlas endpoint matches this request.', 404);
      } catch (error) { return fail(response, error instanceof Error ? error.message : 'The Atlas service is unavailable.', 403); }
    },
  };
}
