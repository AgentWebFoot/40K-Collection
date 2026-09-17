import { createMockApi } from './mock-api.mjs';
import { createAccountStore } from './accounts.mjs';
import { createExpeditionApi } from './expedition-api.mjs';
export const API_URL = window.location.origin;
let account = { username: 'Test Player', role: 'user' };
export let accounts;
let api;
export const getAccount = () => account;
export const getAuthEventName = () => 'preview-account-change';
export const readStoredUser = () => ({ id: accounts?.find(account.username)?.id || `preview:${account.username.trim().toLowerCase()}`, username: account.username, role: account.role });
export const refreshStoredUser = async () => readStoredUser();
export function setAccount(next) {
  account = next;
  window.dispatchEvent(new Event(getAuthEventName()));
}
export async function fetchJson(route, options) {
  const response = await api(account, new URL(route, API_URL).href, options);
  return { response, payload: await response.json() };
}
export async function initialize() {
  const loadOptionalSeed = async (name, fallback) => {
    const response = await fetch(name);
    if (response.status === 404) {
      console.warn(`Preview seed is absent: ${name}. That project will show an empty local fixture.`);
      return fallback;
    }
    if (!response.ok) throw new Error(`Unable to load ${name}`);
    return response.json();
  };
  // These ignored local data files are absent in this checkout. Their absence
  // must not prevent the protected original preview projects from starting.
  const seeds = await Promise.all([
    loadOptionalSeed('/PyrrhicWar/campaign-map.json', { tiles: [] }),
    loadOptionalSeed('/PyrrhicWar/pyrrhicCompendium.JSON', {}),
    loadOptionalSeed('/Expedition/expeditionmap.json', { tiles: [] }),
  ]);
  accounts = createAccountStore(window.localStorage);
  // Atlas test accounts are explicitly local and are materialised by its host.
  accounts.seedCampaignTestAccounts();
  const pyrrhicApi = createMockApi(seeds[0], seeds[1], accounts);
  const expeditionApi = createExpeditionApi(seeds[2], accounts);
  api = (account, url, options) => new URL(url).pathname.startsWith('/expedition/')
    ? expeditionApi(account, url, options) : pyrrhicApi(account, url, options);
  window.createPreviewFetch = () => {
    const snapshot = { ...account };
    return (url, options) => api(snapshot, url, options);
  };
}
