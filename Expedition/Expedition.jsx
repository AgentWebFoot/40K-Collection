import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import { battlesUnavailableMessage, expeditionBattlesEnabled } from './battle-availability.mjs';
import ExpeditionSettings from './ExpeditionSettings.jsx';

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
  gear: { position: 'absolute', top: '8px', right: '12px', width: '42px', height: '42px', padding: 0, fontSize: '1.25rem' },
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

export default function Expedition() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [round, setRound] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const eventName = getAuthEventName();
    const refresh = () => {
      setSettingsOpen(false);
      setSession(null);
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

  function handleMemberChange(member) {
    if (member.id !== session?.user?.id) return;
    const role = member.expeditionRole;
    const canManageRoles = ['admin', 'owner'].includes(role);
    setSession(current => current && ({
      ...current, access: { ...current.access, canManageRoles, role, team: member.expeditionTeam },
    }));
    if (!canManageRoles) setSettingsOpen(false);
  }

  return (
    <main style={styles.page}>
      <button type="button" onClick={() => navigate('/projects')} style={styles.backButton}>
        &lt; Back
      </button>
      {canManage && (
        <button type="button" onClick={() => setSettingsOpen(true)} style={{ ...styles.button, ...styles.gear }}
          aria-label="Open Expedition settings" aria-haspopup="dialog" aria-expanded={settingsOpen} title="Expedition settings">
          <span aria-hidden="true">⚙</span>
        </button>
      )}
      <div style={styles.titleBox}>
        Expedition
        {round != null && <p style={styles.round}>Round {round}</p>}
      </div>
      <div style={styles.actions}>
        <button type="button" style={{ ...styles.button, ...styles.disabledButton }}>
          Compendium
        </button>
        <Link to="/projects/ExpeditionMap" style={styles.button}>
          Map
        </Link>
        <Link to="/projects/ExpeditionTeams" style={styles.button}>
          Team Management
        </Link>
        {expeditionBattlesEnabled ? (
          <Link to="/projects/ExpeditionBattles" style={styles.button}>Battles</Link>
        ) : (
          <button type="button" disabled title={battlesUnavailableMessage} style={{ ...styles.button, ...styles.disabledButton }}>
            Battles
          </button>
        )}
      </div>
      {canManage && settingsOpen && (
        <ExpeditionSettings role={session.access.role} round={round} onRoundChange={setRound}
          onMemberChange={handleMemberChange} onClose={() => setSettingsOpen(false)} />
      )}
    </main>
  );
}
