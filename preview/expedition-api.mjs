import { roles, expeditionRole, expeditionRoles, expeditionTeams } from './accounts.mjs';

export function createExpeditionApi(seed, accounts) {
  let map = structuredClone(seed);
  const requests = [];
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return async (account, input, options = {}) => {
    if (!account || !roles.includes(account.role)) return reply({ message: 'Invalid simulated account.' }, 401);
    const saved = accounts.find(account.username);
    const role = expeditionRole({ ...saved, role: account.role });
    const team = saved?.expeditionTeam || '';
    const admin = ['admin', 'owner'].includes(role);
    const user = { id: saved?.id || `preview:${account.username.trim().toLowerCase()}`, username: account.username, role: account.role };
    const route = new URL(input).pathname.replace(/^\/expedition/, '');
    const method = (options.method || 'GET').toUpperCase();
    let body;
    try { body = options.body ? JSON.parse(options.body) : {}; }
    catch { return reply({ message: 'Invalid JSON request.' }, 400); }
    const forbidden = () => reply({ message: 'This account cannot perform that Expedition action.' }, 403);
    const patron = target => ({
      id: target.id, username: target.username, email: '', siteRole: target.role,
      expeditionRole: expeditionRole(target),
      expeditionMembershipRole: target.role === 'owner' ? 'owner' : target.expeditionMembershipRole || 'viewer',
      expeditionTeam: target.expeditionTeam || '',
      canEditExpeditionRole: admin && !['owner', 'admin'].includes(target.role),
    });
    if (route === '/access') return reply({ user, access: { role, membershipRole: saved?.expeditionMembershipRole || 'viewer', team, canManageRoles: admin } });
    if (route === '/roles/list') return admin ? reply({ patrons: accounts.list().map(patron) }) : forbidden();
    if (route === '/roles/set-role' && method === 'POST') {
      if (!admin) return forbidden();
      const target = accounts.list().find(item => item.id === body.targetUserId);
      if (!target) return reply({ message: 'Saved account not found.' }, 404);
      const currentRole = target.expeditionMembershipRole || 'viewer';
      // The unchanged board submits "owner" from the disabled inherited-role control.
      const nextRole = ['owner', 'admin'].includes(target.role) && body.role === 'owner' ? currentRole : body.role;
      if ((!patron(target).canEditExpeditionRole && nextRole !== currentRole) ||
          (target.role === 'owner' && account.role !== 'owner' && body.team !== (target.expeditionTeam || ''))) return forbidden();
      if (!expeditionRoles.includes(nextRole) || !expeditionTeams.includes(body.team)) return reply({ message: 'Invalid Expedition permission or team.' }, 400);
      try { return reply({ patron: patron(accounts.assignExpedition(target.id, nextRole, body.team)), message: 'Expedition membership saved.' }); }
      catch (error) { return reply({ message: error.message }, 500); }
    }
    if (route === '/map' && method === 'GET') return reply(map);
    if (route === '/map' && method === 'POST') {
      if (!admin) return forbidden();
      if (!body.map || !Array.isArray(body.map.tiles)) return reply({ message: 'A map with tiles is required.' }, 400);
      map = structuredClone(body.map);
      return reply({ map, message: 'Expedition map saved locally.' });
    }
    if (route === '/team-stats' && method === 'POST') {
      if (!admin) return forbidden();
      const stats = body.teamStats;
      if (!stats || expeditionTeams.filter(Boolean).some(team =>
        !Number.isFinite(stats[team]?.supplyPoints) || stats[team].supplyPoints < 0 ||
        !Number.isFinite(stats[team]?.campaignPoints) || stats[team].campaignPoints < 0)) return reply({ message: 'Invalid team points.' }, 400);
      map.teamStats = structuredClone(stats);
      return reply({ teamStats: map.teamStats, message: 'Team points saved locally.' });
    }
    if (route === '/bounties/list') return reply({ bounties: [], pendingRequests: [] });
    if (route.startsWith('/map-requests')) {
      const own = request => request.requesterUserId === user.id;
      const pending = requests.filter(request => request.status === 'pending');
      if (route === '/map-requests/list') return admin ? reply({ requests: pending }) : forbidden();
      if (route === '/map-requests/mine') return reply({ requests: pending.filter(own) });
      if (route === '/map-requests/history') return reply({ requests: requests.filter(request => request.status !== 'pending') });
      if (method === 'POST' && ['/map-requests', '/map-requests/update'].includes(route)) {
        if (!admin && role !== 'traveler') return forbidden();
        if (!body.changeSet || typeof body.changeSet !== 'object' || Array.isArray(body.changeSet)) return reply({ message: 'A change set is required.' }, 400);
        const existing = route.endsWith('/update') ? pending.find(request => request.id === body.requestId) : null;
        if (route.endsWith('/update') && !existing) return reply({ message: 'Request not found.' }, 404);
        if (existing && !admin && !own(existing)) return forbidden();
        if (!admin && (!team || body.changeSet.requesterTeam !== team)) return reply({ message: 'Choose your assigned Expedition team.' }, 403);
        const request = {
          ...(existing || { id: crypto.randomUUID(), requesterUserId: user.id, requesterUsername: user.username, requesterEmail: '', createdAt: new Date().toISOString() }),
          changeSet: structuredClone(body.changeSet), status: 'pending', updatedAt: new Date().toISOString(),
        };
        if (existing) requests.splice(requests.indexOf(existing), 1, request); else requests.push(request);
        return reply({ request, message: 'Expedition request saved locally.' });
      }
      if (method === 'POST' && ['/map-requests/deny', '/map-requests/cancel-own'].includes(route)) {
        const request = pending.find(request => request.id === body.requestId);
        if (!request) return reply({ message: 'Request not found.' }, 404);
        if (route.endsWith('/deny') ? !admin : !own(request)) return forbidden();
        request.status = route.endsWith('/deny') ? 'denied' : 'canceled';
        request.reviewedAt = new Date().toISOString();
        return reply({ request, message: 'Request closed.' });
      }
    }
    return reply({ message: `The local simulator does not implement ${method} /expedition${route}. No changes were saved.` }, 501);
  };
}
