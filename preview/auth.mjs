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
  const seeds = await Promise.all(['/PyrrhicWar/campaign-map.json', '/PyrrhicWar/pyrrhicCompendium.JSON', '/Expedition/expeditionmap.json'].map(async name => {
    const response = await fetch(name);
    if (!response.ok) throw new Error(`Unable to load ${name}`);
    return response.json();
  }));
  accounts = createAccountStore(window.localStorage);
  const pyrrhicApi = createMockApi(seeds[0], seeds[1], accounts);
  const expeditionApi = createExpeditionApi(seeds[2], accounts);
  api = (account, url, options) => new URL(url).pathname.startsWith('/expedition/')
    ? expeditionApi(account, url, options) : pyrrhicApi(account, url, options);
  window.createPreviewFetch = () => {
    const snapshot = { ...account };
    return (url, options) => api(snapshot, url, options);
  };
}
