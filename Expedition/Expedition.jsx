import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import { battleTypes, battlesUnavailableMessage, expeditionBattlesEnabled } from './battle-rules.mjs';
import { loadBounties } from './ExpeditionBounties.jsx';
import ExpeditionSettings from './ExpeditionSettings.jsx';
import { expeditionTeams } from './expedition-membership.mjs';
import { styles as logStyles } from './expedition-log-styles.mjs';

const styles = {
  page: {
    position: 'relative',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box',
    background: '#1e1e1e',
    color: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    width: 'min(412px, 100%)',
    boxSizing: 'border-box',
    gap: '14px',
    padding: '18px',
    border: '1px solid #444',
    borderRadius: '8px',
    background: '#2a2a2a',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
  },
  titleBox: {
    width: 'min(374px, 100%)',
    padding: '14px 18px',
    border: '1px solid #444',
    borderRadius: '8px',
    background: '#2a2a2a',
    color: '#ffffff',
    fontSize: '1.25rem',
    fontWeight: 700,
    boxSizing: 'border-box',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
  },
  button: {
    padding: '12px clamp(6px, 2vw, 18px)',
    overflowWrap: 'anywhere',
    border: '1px solid #666',
    borderRadius: '6px',
    background: '#202020',
    color: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '1rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  tools: { position: 'absolute', top: '8px', right: '12px', display: 'flex', gap: '8px' },
  icon: { width: '42px', height: '42px', padding: 0, fontSize: '1.25rem' },
  badge: { position: 'absolute', top: '-5px', right: '-5px', minWidth: '17px', padding: '1px 3px', color: '#171717',
    background: '#ffce73', borderRadius: '10px', fontSize: '0.7rem', boxSizing: 'border-box' },
  round: { margin: '5px 0 0', fontSize: '0.9rem', fontWeight: 600, color: '#ccc' },
  backButton: {
    position: 'absolute',
    top: '8px',
    left: '12px',
    zIndex: 1000,
    minWidth: '104px',
    padding: '9px 14px',
    border: '1px solid #666',
    borderRadius: '6px',
    background: '#202020',
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.92rem',
    fontWeight: 700,
    boxSizing: 'border-box',
  },
};

async function requestList(path, signal, method = 'GET') {
  const { response, payload } = await fetchJson(path, { method, signal, ...(method === 'POST' && { body: '{}' }) });
  if (response.status === 403 && path.endsWith('/mine')) return { requests: [] };
  if (!response.ok) throw new Error('Unable to load requests.');
  return payload;
}

async function loadRequestAlerts(session, signal, includeBattles) {
  const admin = session.access.canUseAdminMode;
  const own = record => record.own === true || (session.user?.id != null && String(record.requesterUserId) === String(session.user.id));
  const pending = record => record?.id != null && (record.status == null || record.status === 'pending');
  const sources = [['Map', requestList(`/expedition/map-requests/${admin ? 'list' : 'mine'}`, signal, 'POST')],
    ['Bounties', loadBounties(signal)]];
  if (includeBattles) sources.push(['Battles', requestList('/expedition/battles', signal)]);
  const results = await Promise.allSettled(sources.map(([, request]) => request));
  const entries = [];
  const errors = [];

  function add(area, record, mine, title, to, round, action) {
    const date = typeof record.createdAt === 'string' ? record.createdAt : '';
    entries.push({ key: `${area}-${record.id}`, area, mine, title, to, round, date,
      from: record.requesterUsername, action });
  }

  results.forEach((result, index) => {
    const [area] = sources[index];
    if (result.status === 'rejected') { errors.push(area); return; }
    const payload = result.value;
    if (area === 'Map') {
      for (const record of payload.requests ?? []) {
        const change = record?.changeSet ?? {};
        if (!pending(record) || change.requestType === 'battle' || (!admin && !own(record))) continue;
        const kind = change.requestType === 'movement' ? change.movementType : change.actionType || change.requestType;
        const title = kind ? `${kind[0].toUpperCase()}${kind.slice(1)} request` : 'Map request';
        add(area, record, own(record), title, `/projects/ExpeditionMap?${new URLSearchParams({ request: record.id })}`,
          change.submissionRound);
      }
    } else if (area === 'Bounties') {
      const bounties = payload.bounties ?? [];
      const names = new Map(bounties.map(bounty => [String(bounty.id), bounty.name]));
      const requests = new Map();
      for (const record of payload.pendingRequests ?? []) {
        if (pending(record) && (admin || own(record))) requests.set(String(record.id), { record, mine: own(record), bountyId: record.bountyId });
      }
      for (const bounty of bounties) {
        const record = bounty.myPendingRequest;
        if (pending(record) && (record.requesterUserId == null || own(record))) {
          requests.set(String(record.id), { record, mine: true, bountyId: bounty.id });
        }
      }
      for (const { record, mine, bountyId } of requests.values()) {
        const kind = record.request?.requestType === 'claim' ? 'Claim' : 'Progress';
        const anchor = admin ? `bounty-request-${record.id}` : `bounty-${bountyId}`;
        add(area, record, mine, `${names.get(String(bountyId)) || 'Bounty'} · ${kind}`, `/projects/ExpeditionBounties#${anchor}`,
          record.request?.submissionRound);
      }
    } else {
      for (const record of payload.pendingBattles ?? []) {
        if (!pending(record)) continue;
        const mine = own(record);
        if (!mine && !record.review?.canConfirm && !record.review?.canApprove) continue;
        const change = record.changeSet ?? {};
        const name = (typeof change.battleName === 'string' && change.battleName.trim()) || battleTypes[change.battleType] || 'Battle report';
        const action = !mine && record.review?.canConfirm ? 'Confirm battle' : undefined;
        add(area, record, mine, name, `/projects/ExpeditionBattles?${new URLSearchParams({ view: 'review', battle: record.id })}`,
          change.submissionRound, action);
      }
    }
  });
  entries.sort((first, second) => second.date.localeCompare(first.date));
  return { entries, errors };
}

function RequestAlerts({ session, includeBattles }) {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [revision, setRevision] = useState(0);
  const count = data?.entries.length ?? 0;
  const label = count ? `Expedition request alerts (${count})` : 'Expedition request alerts';

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    loadRequestAlerts(session, controller.signal, includeBattles).then(
      result => { if (!controller.signal.aborted) setData(result); },
      () => { if (!controller.signal.aborted) setData({ entries: [], errors: ['Expedition'] }); },
    );
    return () => controller.abort();
  }, [session, revision, includeBattles]);

  function show() {
    setRevision(value => value + 1);
    dialog.current.showModal();
    setOpen(true);
  }

  return (
    <>
      <button type="button" style={{ ...styles.button, ...styles.icon, position: 'relative' }} onClick={show}
        aria-label={label} title={label} aria-haspopup="dialog" aria-controls="expedition-request-alerts" aria-expanded={open}>
        <span aria-hidden="true">!</span>
        {count > 0 && <span aria-hidden="true" style={styles.badge}>{count}</span>}
      </button>
      <dialog ref={dialog} id="expedition-request-alerts" aria-labelledby="expedition-alert-title"
        style={{ ...logStyles.filterDialog, textAlign: 'left' }} onClose={() => setOpen(false)}>
        <div style={logStyles.stack}>
          <div style={{ ...logStyles.row, justifyContent: 'space-between' }}>
            <h2 id="expedition-alert-title" style={logStyles.subheading}>Expedition Requests</h2>
            <form method="dialog"><button style={logStyles.button}>Close</button></form>
          </div>
          {session === null ? <p role="alert" style={logStyles.error}>Unable to verify Expedition access.</p>
            : !data ? <p role="status" style={logStyles.note}>Loading requests…</p> : (
              <>
                {data.errors.length > 0 && <p role="alert" style={logStyles.error}>Couldn’t load requests from {data.errors.join(', ')}.</p>}
                {!count && !data.errors.length && <p style={logStyles.note}>You have no active requests or approvals waiting.</p>}
                {[['My active requests', true], ['Needs your approval', false]].map(([title, mine]) => {
                  const entries = data.entries.filter(entry => entry.mine === mine);
                  return entries.length > 0 && (
                    <section key={title} style={logStyles.stack}>
                      <h3 style={logStyles.subheading}>{title}</h3>
                      <ul style={logStyles.entries}>
                        {entries.map(entry => (
                          <li key={entry.key}>
                            <Link style={{ ...logStyles.entry, background: '#1a1a1a' }} to={entry.to}>
                              <strong>{entry.title}</strong>
                              <span style={logStyles.note}>
                                {[entry.area, entry.round ? `Round ${entry.round}` : '', !mine && entry.from ? `From ${entry.from}` : '',
                                  mine ? 'Pending review' : entry.action || 'Awaiting approval'].filter(Boolean).join(' · ')}
                              </span>
                              {entry.date && Number.isFinite(Date.parse(entry.date)) && (
                                <time dateTime={entry.date} style={{ ...logStyles.note, fontSize: '0.85rem' }}>
                                  {new Date(entry.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                </time>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </>
            )}
        </div>
      </dialog>
    </>
  );
}

export default function Expedition({ compendiumPath, campaignTools = true } = {}) {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  if (view === 'bounties') return <Navigate to="/projects/ExpeditionBounties" replace />;
  if (view === 'shop') return <Navigate to="/projects/ExpeditionShop" replace />;
  return <ExpeditionMenu compendiumPath={compendiumPath} campaignTools={campaignTools} />;
}

function ExpeditionMenu({ compendiumPath, campaignTools }) {
  const navigate = useNavigate();
  const [session, setSession] = useState();
  const [round, setRound] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const eventName = getAuthEventName();
    const refresh = () => {
      setSettingsOpen(false);
      setSession(undefined);
      setAuthRevision(value => value + 1);
    };
    window.addEventListener(eventName, refresh);
    return () => window.removeEventListener(eventName, refresh);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchJson('/expedition/access', { method: 'GET' }).then(({ response, payload }) => {
      if (!ignore) setSession(response.ok ? payload : null);
    }).catch(() => { if (!ignore) setSession(null); });
    fetchJson('/expedition/round', { method: 'GET' }).then(({ response, payload }) => {
      if (!ignore && response.ok && Number.isSafeInteger(payload.round)) setRound(payload.round);
    }).catch(() => { if (!ignore) setRound(null); });
    return () => { ignore = true; };
  }, [authRevision]);

  const canManage = Boolean(session?.access?.canManageRoles);
  const includeBattles = campaignTools && expeditionBattlesEnabled;
  const assignedTeam = session?.access?.team;
  const teamSearch = assignedTeam && expeditionTeams.includes(assignedTeam)
    ? `?${new URLSearchParams({ team: assignedTeam })}`
    : '';

  function handleMemberChange(member) {
    if (member.id !== session?.user?.id) return;
    const role = member.expeditionRole;
    const canUseAdminMode = ['admin', 'owner'].includes(role);
    const canManageRoles = canUseAdminMode || member.siteRole === 'manager';
    setSession(current => current && ({
      ...current, access: { ...current.access, canManageRoles, canUseAdminMode, role, team: member.expeditionTeam },
    }));
    if (!canManageRoles) setSettingsOpen(false);
  }

  return (
    <main style={styles.page}>
      <button type="button" onClick={() => navigate('/projects')} style={styles.backButton}>
        &lt; Back
      </button>
      <div style={styles.tools}>
        <RequestAlerts key={authRevision} session={session} includeBattles={includeBattles} />
        {canManage && (
          <button type="button" onClick={() => setSettingsOpen(true)} style={{ ...styles.button, ...styles.icon }}
            aria-label="Open Expedition settings" aria-haspopup="dialog" aria-expanded={settingsOpen} title="Expedition settings">
            <span aria-hidden="true">⚙</span>
          </button>
        )}
      </div>
      <div style={styles.titleBox}>
        Expedition
        {round != null && <p style={styles.round}>Round {round}</p>}
      </div>
      <div style={styles.actions}>
        {compendiumPath ? (
          <Link to={compendiumPath} style={styles.button}>Compendium</Link>
        ) : (
          <button type="button" disabled style={{ ...styles.button, ...styles.disabledButton }}>Compendium</button>
        )}
        <Link to="/projects/ExpeditionMap" style={styles.button}>
          Map
        </Link>
        {includeBattles ? (
          <Link to="/projects/ExpeditionBattles" style={styles.button}>Battles</Link>
        ) : (
          <button type="button" disabled title={battlesUnavailableMessage} style={{ ...styles.button, ...styles.disabledButton }}>
            Battles
          </button>
        )}
        {campaignTools && <Link to="/projects/ExpeditionLore" style={styles.button}>Lore</Link>}
        <Link to="/projects/ExpeditionBounties" style={styles.button}>
          Bounties
        </Link>
        {campaignTools && <>
          <Link to="/projects/ExpeditionShop" style={styles.button}>Shop</Link>
          <Link to={{ pathname: '/projects/ExpeditionTeams', search: teamSearch }} style={{ ...styles.button, gridColumn: '1 / -1' }}>
            Team Management
          </Link>
        </>}
      </div>
      {canManage && settingsOpen && (
        <ExpeditionSettings canUseAdminMode={session.access.canUseAdminMode} round={round} onRoundChange={setRound}
          onMemberChange={handleMemberChange} onClose={() => setSettingsOpen(false)} />
      )}
    </main>
  );
}
