import { createMockApi } from './mock-api.mjs';

export const API_URL = window.location.origin;
let account = { username: 'Test Player', role: 'user' };
let savedAccounts = [];
let pyrrhicApi;
const listeners = new Set();

async function send(input, signal) {
  const response = await fetch('/preview/api', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const { payload, accounts: saved } = await response.json();
  if (saved && JSON.stringify(saved) !== JSON.stringify(savedAccounts)) {
    savedAccounts = saved;
    listeners.forEach(listener => listener());
  }
  return { response, payload };
}

async function changeAccounts(input) {
  const { response, payload } = await send(input);
  if (!response.ok) throw new Error(payload.message);
  return payload;
}

export const accounts = {
  list: () => savedAccounts,
  find: username => savedAccounts.find(entry => entry.username.toLowerCase() === username.trim().toLowerCase()),
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  save: async draft => (await changeAccounts({ operation: 'save-account', account: draft })).entry,
  remove: id => changeAccounts({ operation: 'delete-account', id }),
  assignCampaignRole: (id, role) => changeAccounts({ operation: 'assign-campaign-role', id, role, account }),
  assignCampaignIdentity: (id, identityId) => changeAccounts({ operation: 'assign-campaign-identity', id, identityId, account }),
};
export const getAccount = () => account;
export const getAuthEventName = () => 'preview-account-change';
export const readStoredUser = () => ({ id: accounts.find(account.username)?.id || `preview:${account.username.trim().toLowerCase()}`, username: account.username, role: account.role });
export const refreshStoredUser = async () => readStoredUser();
export function setAccount(next) {
  account = next;
  window.dispatchEvent(new Event(getAuthEventName()));
}
async function previewFetch(active, input, options = {}) {
  const url = new URL(input, API_URL);
  if (!url.pathname.startsWith('/expedition/') && url.pathname !== '/pyrrhic-war/roles/set-role') {
    const response = await pyrrhicApi(active, url.href, options);
    return { response, payload: await response.json() };
  }
  return send({ account: active, route: url.pathname + url.search, method: options.method, body: options.body }, options.signal);
}
export const fetchJson = (route, options) => previewFetch(account, route, options);

export async function initialize() {
  const legacy = {};
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('expedition-preview-') || key === 'pyrrhic-preview-accounts-v1') {
        legacy[key] = window.localStorage.getItem(key);
      }
    }
  } catch {
    // Browser storage is only needed to import older preview saves.
  }
  await changeAccounts({ operation: 'initialize', legacy });
  const loadOptionalSeed = async (file, fallback) => {
    const response = await fetch(file);
    if (response.status === 404) {
      console.warn(`Preview seed is absent: ${file}. That project will show an empty local fixture.`);
      return fallback;
    }
    if (!response.ok) throw new Error(`Unable to load ${file}`);
    return response.json();
  };
  const [map, compendium] = await Promise.all([
    loadOptionalSeed('/PyrrhicWar/campaign-map.json', { tiles: [] }),
    loadOptionalSeed('/PyrrhicWar/pyrrhicCompendium.JSON', {}),
  ]);
  pyrrhicApi = createMockApi(map, compendium, accounts);
  window.createPreviewFetch = () => {
    const snapshot = { ...account };
    return async (input, options) => {
      const { response, payload } = await previewFetch(snapshot, input, options);
      return new Response(JSON.stringify(payload), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    };
  };
}
