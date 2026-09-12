import { createMockApi } from './mock-api.mjs';
import { createAccountStore } from './accounts.mjs';
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
  const seeds = await Promise.all(['campaign-map.json', 'pyrrhicCompendium.JSON'].map(async name => {
    const response = await fetch(`/PyrrhicWar/${name}`);
    if (!response.ok) throw new Error(`Unable to load ${name}`);
    return response.json();
  }));
  accounts = createAccountStore(window.localStorage);
  api = createMockApi(...seeds, accounts);
  window.createPreviewFetch = () => {
    const snapshot = { ...account };
    return (url, options) => api(snapshot, url, options);
  };
}
