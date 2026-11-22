import { createAccountStore } from './accounts.mjs';
import { createExpeditionApi } from './expedition-api.mjs';
import { createMockApi } from './mock-api.mjs';

export function createPreviewService(storage) {
  let accounts = createAccountStore(storage);
  const sharedAccounts = {
    list: () => accounts.list(),
    find: username => accounts.find(username),
    assign: (...args) => accounts.assign(...args),
    assignExpedition: (...args) => accounts.assignExpedition(...args),
  };
  const expedition = createExpeditionApi(storage.seed(), sharedAccounts, storage);
  const pyrrhicMembership = createMockApi({}, {}, sharedAccounts);

  return async function previewRequest(input) {
    storage.recover();
    accounts = createAccountStore(storage);
    try {
      if (input.operation === 'initialize') {
        storage.importLegacy(input.legacy);
        accounts = createAccountStore(storage);
        accounts.seedCampaignTestAccounts();
        return { status: 200, payload: {}, accounts: accounts.list() };
      }
      if (input.operation === 'save-account') {
        const entry = accounts.save(input.account);
        return { status: 200, payload: { entry }, accounts: accounts.list() };
      }
      if (input.operation === 'delete-account') {
        accounts.remove(input.id);
        return { status: 200, payload: {}, accounts: accounts.list() };
      }
      if (input.operation === 'assign-campaign-role') {
        if (!['manager', 'owner'].includes(input.account?.role)) {
          return { status: 403, payload: { message: 'Only a preview manager or owner can assign campaign roles.' } };
        }
        const entry = accounts.assignCampaignRole(input.id, input.role);
        return { status: 200, payload: { entry }, accounts: accounts.list() };
      }
      if (input.operation === 'assign-campaign-identity') {
        if (accounts.find(input.account?.username)?.id !== input.id) {
          return { status: 403, payload: { message: 'Only the active account can link its campaign identity.' } };
        }
        const entry = accounts.assignCampaignIdentity(input.id, input.identityId);
        return { status: 200, payload: { entry }, accounts: accounts.list() };
      }
      const url = new URL(input.route, 'http://preview.local');
      let api;
      if (url.pathname.startsWith('/expedition/')) api = expedition;
      else if (url.pathname === '/pyrrhic-war/roles/set-role') api = pyrrhicMembership;
      else return { status: 400, payload: { message: 'Unknown preview route.' } };
      const { account, method, body } = input;
      const response = await api(account, url.href, { method, body });
      return { status: response.status, payload: await response.json(), accounts: accounts.list() };
    } catch (error) {
      return { status: 400, payload: { message: error.message } };
    }
  };
}
