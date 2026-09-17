import { campaignTestPlayers } from '../HybridCampaign/test-player-fixtures.mjs';

export const roles = ['user', 'traveler', 'admin', 'owner'];
export const membershipRoles = ['viewer', 'participant', 'writer', 'admin'];
export const effectiveRole = account => ['admin', 'owner'].includes(account.role) ? account.role : account.membershipRole || 'viewer';
export const expeditionRoles = ['viewer', 'traveler', 'admin'];
export const expeditionTeams = ['', 'red', 'blue', 'green', 'yellow', 'purple', 'white', 'black'];
export const expeditionRole = account => ['admin', 'owner'].includes(account.role) ? account.role : account.expeditionMembershipRole || 'viewer';
/** Campaign roles are a separate, local-preview assignment. They never alter site permission. */
export const campaignRoles = ['owner-gm', 'gm', 'co-gm', 'player', 'display'];

// Numeric IDs match the unchanged board's member-selection contract.
export function createAccountStore(storage) {
  const key = 'pyrrhic-preview-accounts-v1';
  const raw = storage?.getItem(key);
  let state = raw ? JSON.parse(raw) : { nextId: 1, accounts: [] };
  if (!Number.isSafeInteger(state.nextId) || !Array.isArray(state.accounts) || state.accounts.some(account =>
    !Number.isSafeInteger(account.id) || typeof account.username !== 'string' || !roles.includes(account.role) ||
    !membershipRoles.includes(account.membershipRole) || !Number.isInteger(account.team) || account.team < 0 || account.team > 4 ||
    (account.campaignRole !== undefined && !campaignRoles.includes(account.campaignRole)) ||
    (account.testFixtureId !== undefined && !campaignTestPlayers.some(fixture => fixture.id === account.testFixtureId)) ||
    (account.campaignIdentityId !== undefined && typeof account.campaignIdentityId !== 'string'))) {
    throw new Error('Saved preview accounts are invalid. Clear the pyrrhic-preview-accounts-v1 browser storage entry to reset them.');
  }
  const listeners = new Set();
  const commit = next => {
    storage?.setItem(key, JSON.stringify(next));
    state = next;
    listeners.forEach(listener => listener());
  };
  const find = username => state.accounts.find(account => account.username.toLowerCase() === String(username).trim().toLowerCase());
  return {
    list: () => structuredClone(state.accounts),
    find: username => { const account = find(username); return account ? { ...account } : null; },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    save({ username, role }) {
      username = String(username).trim();
      if (!username || username.length > 80 || !roles.includes(role)) throw new Error('Enter a username and a valid site permission.');
      const existing = find(username);
      const account = { ...(existing || { id: state.nextId, membershipRole: 'viewer', team: 0 }), username, role };
      commit({ nextId: state.nextId + (existing ? 0 : 1), accounts: [...state.accounts.filter(item => item.id !== account.id), account] });
      return { ...account };
    },
    remove(id) {
      commit({ ...state, accounts: state.accounts.filter(account => account.id !== id) });
    },
    assign(id, membershipRole, team) {
      if (!membershipRoles.includes(membershipRole) || !Number.isInteger(team) || team < 0 || team > 4) throw new Error('Choose a valid Pyrrhic War permission and team.');
      const existing = state.accounts.find(account => account.id === id);
      if (!existing) throw new Error('Saved account not found.');
      const account = { ...existing, membershipRole, team };
      commit({ ...state, accounts: state.accounts.map(item => item.id === id ? account : item) });
      return { ...account };
    },
    assignExpedition(id, membershipRole, team) {
      if (!expeditionRoles.includes(membershipRole) || !expeditionTeams.includes(team)) throw new Error('Choose a valid Expedition permission and team.');
      const existing = state.accounts.find(account => account.id === id);
      if (!existing) throw new Error('Saved account not found.');
      const account = { ...existing, expeditionMembershipRole: membershipRole, expeditionTeam: team };
      commit({ ...state, accounts: state.accounts.map(item => item.id === id ? account : item) });
      return { ...account };
    },
    assignCampaignRole(id, campaignRole) {
      if (!campaignRoles.includes(campaignRole)) throw new Error('Choose a valid Hybrid Campaign role.');
      const existing = state.accounts.find(account => account.id === id);
      if (!existing) throw new Error('Saved account not found.');
      const account = { ...existing, campaignRole, campaignIdentityId: campaignRole === 'player' ? existing.campaignIdentityId : undefined };
      commit({ ...state, accounts: state.accounts.map(item => item.id === id ? account : item) });
      return { ...account };
    },
    assignCampaignIdentity(id, campaignIdentityId) {
      if (typeof campaignIdentityId !== 'string' || !campaignIdentityId.trim()) throw new Error('A valid campaign identity is required.');
      const existing = state.accounts.find(account => account.id === id);
      if (!existing || existing.campaignRole !== 'player') throw new Error('Only a saved player account may receive a campaign identity.');
      const account = { ...existing, campaignIdentityId: campaignIdentityId.trim() };
      commit({ ...state, accounts: state.accounts.map(item => item.id === id ? account : item) });
      return { ...account };
    },
    /** Seed the five clearly-labelled player fixtures only in the browser preview. */
    seedCampaignTestAccounts() {
      let nextId = state.nextId;
      const nextAccounts = [...state.accounts];
      for (const fixture of campaignTestPlayers) {
        if (nextAccounts.some(account => account.testFixtureId === fixture.id)) continue;
        nextAccounts.push({ id: nextId++, username: fixture.accountName, role: 'user', membershipRole: 'viewer', team: 0, campaignRole: 'player', testFixtureId: fixture.id });
      }
      if (nextId !== state.nextId) commit({ nextId, accounts: nextAccounts });
      return nextAccounts.filter(account => account.testFixtureId).map(account => ({ ...account }));
    },
  };
}
