import { roles, createAccountStore, effectiveRole, membershipRoles } from './accounts.mjs';
export { roles } from './accounts.mjs';

// These are local UI test fixtures, not production authorization rules.
export function createMockApi(mapSeed, compendiumSeed, accounts = createAccountStore()) {
  let map = structuredClone(mapSeed);
  let settings = { backgroundImageDataUrl: '' };
  const compendium = structuredClone(compendiumSeed);
  const favorites = new Map();
  const requests = [];
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return async (account, input, options = {}) => {
    if (!account || !roles.includes(account.role)) return reply({ message: 'Invalid simulated account.' }, 401);
    const saved = accounts.find(account.username);
    const identity = { ...account, membershipRole: saved?.membershipRole || 'viewer', team: saved?.team || 0 };
    const { username, team, membershipRole } = identity;
    const role = effectiveRole(identity);
    const user = { id: saved?.id || `preview:${username.trim().toLowerCase()}`, username, displayName: username, role: account.role };
    const favoriteUserKey = username.trim().toLowerCase();
    const admin = ['admin', 'owner'].includes(role);
    const writer = admin || role === 'writer';
    const route = new URL(input).pathname.replace('/pyrrhic-war', '');
    const method = (options.method || 'GET').toUpperCase();
    let body;
    try { body = options.body ? JSON.parse(options.body) : {}; }
    catch { return reply({ message: 'Invalid JSON request.' }, 400); }
    const forbidden = () => reply({ message: `The simulated ${role} account cannot perform this action.` }, 403);
    const patron = target => ({
      id: target.id, username: target.username, email: '', siteRole: target.role,
      pyrrhicWarRole: effectiveRole(target),
      pyrrhicWarMembershipRole: target.role === 'owner' ? 'owner' : target.membershipRole,
      pyrrhicWarTeam: target.team,
      canEditPyrrhicWarRole: admin && !['owner', 'admin'].includes(target.role),
      canEditPyrrhicWarTeam: admin && (target.role !== 'owner' || account.role === 'owner'),
    });
    if (route === '/access') return reply({ user, access: { role, membershipRole, team, canManageRoles: admin, canEditCompendium: writer }, settings });
    if (route === '/roles/list') return admin ? reply({ patrons: accounts.list().map(patron) }) : forbidden();
    if (route === '/roles/set-role' && method === 'POST') {
      if (!admin) return forbidden();
      const target = accounts.list().find(item => item.id === body.targetUserId);
      if (!target) return reply({ message: 'Saved account not found.' }, 404);
      const permissions = patron(target);
      const requestedRole = target.role === 'owner' && body.role === 'owner' ? target.membershipRole : body.role;
      if ((!permissions.canEditPyrrhicWarRole && requestedRole !== target.membershipRole) ||
          (!permissions.canEditPyrrhicWarTeam && body.team !== target.team)) return forbidden();
      if (!membershipRoles.includes(requestedRole) || !Number.isInteger(body.team) || body.team < 0 || body.team > 4) return reply({ message: 'Invalid Pyrrhic War permission or team.' }, 400);
      try {
        return reply({ patron: patron(accounts.assign(target.id, requestedRole, body.team)), message: 'Preview membership saved in this browser.' });
      } catch (error) { return reply({ message: error.message }, 500); }
    }
    if (route === '/map' && method === 'GET') return reply(map);
    if (route === '/map' && method === 'POST') {
      if (!admin) return forbidden();
      if (!body.map || !Array.isArray(body.map.tiles)) return reply({ message: 'A map with tiles is required.' }, 400);
      map = structuredClone(body.map);
      return reply({ map, message: 'Map saved in the local simulator.' });
    }
    if (route === '/background' && ['POST', 'DELETE'].includes(method)) {
      if (!admin) return forbidden();
      settings = { backgroundImageDataUrl: method === 'DELETE' ? '' : body.backgroundImageDataUrl || '' };
      return reply({ settings });
    }
    if (route === '/compendium/data' && method === 'GET') return reply(compendium);
    if (route.startsWith('/favorites')) {
      if (!user) return forbidden();
      const saved = favorites.get(favoriteUserKey) || [];
      if (method === 'GET') return reply({ favorites: saved });
      if (method === 'POST' && route === '/favorites') {
        if (!body.favoriteKey) return reply({ message: 'A favorite key is required.' }, 400);
        const favorite = { ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        favorites.set(favoriteUserKey, [favorite, ...saved.filter(item => item.favoriteKey !== body.favoriteKey)]);
        return reply({ favorite });
      }
      if (method === 'DELETE') {
        favorites.set(favoriteUserKey, saved.filter(item => item.favoriteKey !== decodeURIComponent(route.slice('/favorites/'.length))));
        return reply({ message: 'Favorite removed.' });
      }
    }
    if (route === '/map-requests/list') return admin ? reply({ requests }) : forbidden();
    if (route === '/map-requests' && method === 'POST') {
      if (!['participant', 'writer', 'admin', 'owner'].includes(role)) return forbidden();
      const request = { id: crypto.randomUUID(), username, userId: user.id, createdAt: new Date().toISOString(), changeSet: body.changeSet };
      requests.push(request);
      return reply({ request, message: 'Request submitted to the local simulator.' });
    }
    if (route === '/map-requests/deny' && method === 'POST') {
      if (!admin) return forbidden();
      const index = requests.findIndex(request => request.id === body.requestId);
      if (index < 0) return reply({ message: 'Request not found.' }, 404);
      requests.splice(index, 1);
      return reply({ message: 'Request denied.' });
    }
    if (route.startsWith('/compendium/') && !writer) return forbidden();
    if (route === '/compendium/images' && method === 'GET') return reply({ images: [] });
    return reply({ message: `The local simulator does not implement ${method} ${route}. No changes were saved.` }, 501);
  };
}
