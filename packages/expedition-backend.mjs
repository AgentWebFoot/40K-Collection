import { createExpeditionApi } from '../preview/expedition-api.mjs';
import { openExpeditionStorage } from '../preview/expedition-storage.mjs';

const newRoutes = new Set([
  '/battles', '/battle-equipment', '/battle-settings', '/lore', '/shop', '/shop/purchase', '/teams',
  '/universal-equipment', '/point-rewards', '/supply-point-costs', '/movement-limit',
]);
const battleActions = new Set([
  '/map-requests/update', '/map-requests/confirm', '/map-requests/accept', '/map-requests/deny',
  '/map-requests/cancel-own', '/map-requests/history/delete',
]);
const battleId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function handlesCampaignRoute(path, method, body) {
  const route = path.startsWith('/expedition/') ? path.slice('/expedition'.length) : '';
  if (newRoutes.has(route) || /^\/teams\/[a-z]+\/[a-z-]+$/.test(route)) return true;
  if (method !== 'POST') return false;
  if (route === '/map-requests') return body?.changeSet?.requestType === 'battle';
  return battleActions.has(route) && typeof body?.requestId === 'string' && battleId.test(body.requestId);
}

export function createExpeditionBackend({ directory, seed }) {
  if (!directory || !seed) throw new TypeError('Provide an Expedition save directory and map seed.');
  const storage = openExpeditionStorage(directory, seed, { previewAccounts: false });
  const dispatch = createExpeditionApi(seed, null, storage, { identify: identity => identity });
  return async function handleCampaignRequest(input, { identity, method, body, historicalBattles } = {}) {
    storage.recover();
    return dispatch(identity, new URL(input, 'http://expedition.local').href, {
      method, body: body === undefined ? undefined : JSON.stringify(body), historicalBattles,
    });
  };
}
