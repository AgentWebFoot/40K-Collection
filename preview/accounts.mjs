export const roles = ['user', 'traveler', 'admin', 'owner'];
export const membershipRoles = ['viewer', 'participant', 'writer', 'admin'];
export const effectiveRole = account => ['admin', 'owner'].includes(account.role) ? account.role : account.membershipRole || 'viewer';

// Numeric IDs match the unchanged board's member-selection contract.
export function createAccountStore(storage) {
  const key = 'pyrrhic-preview-accounts-v1';
  const raw = storage?.getItem(key);
  let state = raw ? JSON.parse(raw) : { nextId: 1, accounts: [] };
  if (!Number.isSafeInteger(state.nextId) || !Array.isArray(state.accounts) || state.accounts.some(account =>
    !Number.isSafeInteger(account.id) || typeof account.username !== 'string' || !roles.includes(account.role) ||
    !membershipRoles.includes(account.membershipRole) || !Number.isInteger(account.team) || account.team < 0 || account.team > 4)) {
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
  };
}
