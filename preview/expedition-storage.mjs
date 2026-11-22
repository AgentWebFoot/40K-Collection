import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expeditionTeams } from '../Expedition/expedition-membership.mjs';
import { createAccountStore } from './accounts.mjs';

const teams = expeditionTeams.filter(Boolean);
const root = fileURLToPath(new URL('../', import.meta.url));
export const expeditionDataDirectory = path.resolve(process.env.EXPEDITION_DATA_DIRECTORY || path.join(root, 'data', 'expedition'));
const prefix = 'expedition-preview-';
const accountKey = 'pyrrhic-preview-accounts-v1';
const settingNames = { round: 'round', 'supply-point-costs': 'supplyPointCosts', 'movement-limit': 'movementLimit', 'point-rewards': 'pointRewards' };
const teamFile = team => `teams/${team}.json`;
const savedPointDefaults = { supplyPoints: 0, campaignPoints: 0, credits: 0 };
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const equal = (first, second) => JSON.stringify(first) === JSON.stringify(second);
let seededAccounts;
createAccountStore({
  getItem: () => null,
  setItem: (_key, value) => { seededAccounts = JSON.parse(value); },
}).seedCampaignTestAccounts();

function mapOnly({ rows, cols, tiles }) {
  return { rows, cols, tiles };
}

function defaultsFor(seed) {
  return {
    'map.json': mapOnly(seed),
    'battles.json': { battles: [] },
    'lore.json': { posts: [] },
    'shop.json': { items: [] },
    'bounties.json': { bounties: [], pendingRequests: [] },
    'universal-equipment.json': {},
    'settings.json': Object.fromEntries(Object.values(settingNames).filter(key => seed[key] !== undefined).map(key => [key, seed[key]])),
    'accounts.json': { nextId: 1, accounts: [] },
    ...Object.fromEntries(teams.map(team => [teamFile(team), {
      units: [], items: [], purchases: [], points: { ...savedPointDefaults, ...seed.teamStats?.[team] },
    }])),
  };
}

export function readExpeditionSeed(file = path.join(root, 'Expedition', 'expeditionmap.json')) {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code === 'ENOENT') return { rows: 1, cols: 1, tiles: [] };
    throw error;
  }
}

export function initializeExpeditionData(directory = expeditionDataDirectory, seed = readExpeditionSeed()) {
  mkdirSync(path.join(directory, 'teams'), { recursive: true });
  for (const [file, value] of Object.entries(defaultsFor(seed))) {
    try {
      writeFileSync(path.join(directory, file), json(value), { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

export function openExpeditionStorage(directory = expeditionDataDirectory, seed = readExpeditionSeed()) {
  const defaults = defaultsFor(seed);
  const journalFile = path.join(directory, '.pending-write.json');
  const read = file => JSON.parse(readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/, ''));

  function replace(target, value) {
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temp, json(value), { flag: 'wx' });
      renameSync(temp, target);
    } finally {
      rmSync(temp, { force: true });
    }
  }

  function recover() {
    if (!existsSync(journalFile)) return;
    const writes = JSON.parse(readFileSync(journalFile, 'utf8'));
    for (const [file, value] of Object.entries(writes)) {
      if (!Object.hasOwn(defaults, file)) throw new Error('Invalid file in the Expedition save journal.');
      replace(path.join(directory, file), value);
    }
    rmSync(journalFile);
  }

  function commit(values) {
    recover();
    const writes = Object.fromEntries(Object.entries(values).filter(([file, value]) => !equal(read(file), value)));
    if (!Object.keys(writes).length) return;
    replace(journalFile, writes);
    recover();
  }

  initializeExpeditionData(directory, seed);
  recover();

  const fileKeys = {
    [accountKey]: 'accounts.json', [`${prefix}shop`]: 'shop.json', [`${prefix}bounties`]: 'bounties.json',
    [`${prefix}universal-equipment`]: 'universal-equipment.json',
    ...Object.fromEntries(teams.map(team => [`${prefix}roster-${team}`, teamFile(team)])),
  };
  const teamStats = () => Object.fromEntries(teams.map(team => [team, read(teamFile(team)).points]));
  function readShop() {
    const { purchases = [], ...catalog } = read('shop.json');
    return { ...catalog, purchases: [...purchases, ...teams.flatMap(team => read(teamFile(team)).purchases ?? [])] };
  }
  function writeCampaignState({ battles, teamStats: stats, shop, map }) {
    const values = { 'battles.json': { battles } };
    const { purchases, ...catalog } = shop ?? {};
    if (shop !== undefined) values['shop.json'] = catalog;
    if (map) values['map.json'] = mapOnly(map);
    for (const team of teams) {
      if (stats?.[team] || purchases) values[teamFile(team)] = {
        ...read(teamFile(team)), ...(stats?.[team] ? { points: stats[team] } : {}),
        ...(purchases ? { purchases: purchases.filter(item => item.team === team) } : {}),
      };
    }
    commit(values);
  }

  return {
    recover,
    seed: () => ({ ...read('map.json'), ...read('settings.json'), teamStats: teamStats() }),
    writeCampaignState,
    readLore: () => read('lore.json').posts,
    writeLore: posts => commit({ 'lore.json': { posts } }),
    getItem(key) {
      if (key === `${prefix}battles`) return JSON.stringify({ ...read('battles.json'), teamStats: teamStats(), shop: readShop(), map: read('map.json') });
      if (key === `${prefix}shop`) return null;
      const setting = settingNames[key.slice(prefix.length)];
      if (key.startsWith(prefix) && setting) return JSON.stringify(read('settings.json')[setting]) ?? null;
      const file = fileKeys[key];
      return file ? JSON.stringify(read(file)) : null;
    },
    setItem(key, raw) {
      const value = JSON.parse(raw);
      const setting = settingNames[key.slice(prefix.length)];
      if (key.startsWith(prefix) && setting) {
        commit({ 'settings.json': { ...read('settings.json'), [setting]: value } });
        return;
      }
      const file = fileKeys[key];
      if (!file) throw new Error('Unknown Expedition save key.');
      const current = file.startsWith('teams/') ? read(file) : null;
      commit({ [file]: current ? { ...value, points: current.points, purchases: current.purchases ?? [] } : value });
    },
    importLegacy(legacy) {
      if (!legacy || !Object.keys(legacy).length || Object.keys(defaults).some(file => {
        const saved = read(file);
        // A visit that only seeded the Atlas fixtures should still allow a legacy import.
        if (file === 'accounts.json' && equal(saved, seededAccounts)) return false;
        if (file === 'shop.json' && equal(saved, { items: [], purchases: [] })) return false;
        if (file.startsWith('teams/') && saved.purchases === undefined) return !equal(saved, { ...defaults[file], purchases: undefined });
        return !equal(saved, defaults[file]);
      })) return false;
      const values = {};
      for (const [key, file] of Object.entries(fileKeys)) {
        if (!Object.hasOwn(legacy, key)) continue;
        if (key === accountKey) createAccountStore({ getItem: () => legacy[key] });
        const value = JSON.parse(legacy[key]);
        if (file.startsWith('teams/')) {
          if (!Array.isArray(value?.units) || !Array.isArray(value?.items)) throw new Error('Invalid legacy Expedition roster.');
          values[file] = { ...value, points: defaults[file].points, purchases: [] };
        } else if (file === 'shop.json') {
          if (!Array.isArray(value)) throw new Error('Invalid legacy Expedition shop.');
          values[file] = { items: value.map(item => ({ ...item, perUser: 1, remaining: null })) };
        } else values[file] = value;
      }
      const oldCampaign = legacy[`${prefix}battles`] ? JSON.parse(legacy[`${prefix}battles`]) : {};
      if (oldCampaign.battles) {
        if (!Array.isArray(oldCampaign.battles)) throw new Error('Invalid legacy Expedition battle reports.');
        values['battles.json'] = { battles: oldCampaign.battles };
      }
      if (oldCampaign.shop && (!Array.isArray(oldCampaign.shop.items) || !Array.isArray(oldCampaign.shop.purchases))) {
        throw new Error('Invalid legacy Expedition shop.');
      }
      const { purchases = [], ...catalog } = oldCampaign.shop ?? {};
      if (oldCampaign.shop) values['shop.json'] = catalog;
      const importedSettings = { ...defaults['settings.json'] };
      for (const [key, field] of Object.entries(settingNames)) {
        if (legacy[prefix + key] !== undefined) importedSettings[field] = JSON.parse(legacy[prefix + key]);
      }
      values['settings.json'] = importedSettings;
      for (const team of teams) {
        const file = teamFile(team);
        if (oldCampaign.teamStats?.[team] || purchases.some(item => item.team === team)) values[file] = {
          ...(values[file] ?? defaults[file]),
          points: { ...defaults[file].points, ...oldCampaign.teamStats?.[team] },
          purchases: purchases.filter(item => item.team === team),
        };
      }
      commit(values);
      return true;
    },
  };
}
