import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchJson, getAuthEventName, readStoredUser, refreshStoredUser } from '../../utils/auth';

const styles = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    boxSizing: 'border-box',
    background:
      'radial-gradient(circle at top, rgba(132, 47, 47, 0.24), transparent 34%), linear-gradient(180deg, #241312 0%, #160d0c 55%, #0c0707 100%)',
    color: '#f4e7d7',
    fontFamily: '"Trebuchet MS", sans-serif',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: '8px',
    left: '12px',
    zIndex: 1000,
    minWidth: '104px',
    padding: '9px 14px',
    border: '1px solid rgba(124, 19, 19, 0.92)',
    borderRadius: '6px',
    background: 'linear-gradient(180deg, rgba(108, 10, 10, 0.98), rgba(52, 5, 5, 0.99))',
    color: '#f9e6de',
    cursor: 'pointer',
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '0.92rem',
    fontWeight: 700,
    boxSizing: 'border-box',
    boxShadow: '0 10px 24px rgba(24, 3, 3, 0.48)',
  },
  titleBox: {
    minWidth: '320px',
    maxWidth: '100%',
    padding: '14px 18px',
    border: '1px solid rgba(116, 67, 52, 0.45)',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(245, 235, 220, 0.98), rgba(214, 183, 158, 0.95))',
    color: '#241312',
    fontFamily: 'Georgia, serif',
    fontSize: '1.35rem',
    fontWeight: 700,
    boxSizing: 'border-box',
    boxShadow: '0 16px 40px rgba(12, 7, 7, 0.42)',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '14px',
    padding: '18px',
    border: '1px solid rgba(214, 170, 114, 0.32)',
    borderRadius: '8px',
    background: 'rgba(32, 16, 16, 0.9)',
    boxShadow: '0 16px 40px rgba(12, 7, 7, 0.42)',
  },
  button: {
    minWidth: '180px',
    padding: '12px 18px',
    border: '1px solid #9d6248',
    borderRadius: '6px',
    background: 'rgba(245, 235, 220, 0.95)',
    color: '#241312',
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '1rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  gearButton: {
    position: 'absolute',
    top: '8px',
    right: '12px',
    zIndex: 1000,
    width: '44px',
    height: '44px',
    border: '1px solid rgba(214, 170, 114, 0.42)',
    borderRadius: '6px',
    background: 'rgba(32, 16, 16, 0.9)',
    color: '#f4e7d7',
    cursor: 'pointer',
    fontSize: '22px',
    lineHeight: 1,
    boxSizing: 'border-box',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'rgba(12, 7, 7, 0.78)',
  },
  modal: {
    width: 'min(980px, 100%)',
    maxHeight: '82dvh',
    overflow: 'auto',
    padding: '20px',
    border: '1px solid rgba(214, 170, 114, 0.32)',
    borderRadius: '8px',
    background: 'linear-gradient(180deg, rgba(36, 19, 18, 0.98), rgba(12, 7, 7, 0.98))',
    color: '#f4e7d7',
    boxShadow: '0 18px 42px rgba(12, 7, 7, 0.48)',
    textAlign: 'left',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px',
  },
  settingsSummary: {
    color: 'rgba(244, 231, 215, 0.82)',
    fontSize: '0.94rem',
    lineHeight: 1.5,
  },
  patronRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, auto) minmax(180px, auto)',
    gap: '12px',
    alignItems: 'start',
    padding: '12px 0',
    borderTop: '1px solid rgba(214, 170, 114, 0.16)',
  },
  controlBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  controlLabel: {
    fontSize: '0.85rem',
    color: 'rgba(244, 231, 215, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  select: {
    minWidth: '160px',
    padding: '8px 10px',
    border: '1px solid rgba(214, 170, 114, 0.42)',
    borderRadius: '6px',
    background: 'rgba(245, 235, 220, 0.95)',
    color: '#241312',
    fontFamily: '"Trebuchet MS", sans-serif',
    fontSize: '0.95rem',
    fontWeight: 700,
  },
  smallButton: {
    padding: '7px 10px',
    border: '1px solid #9d6248',
    borderRadius: '6px',
    background: 'rgba(245, 235, 220, 0.95)',
    color: '#241312',
    fontWeight: 700,
    cursor: 'pointer',
  },
  mutedText: {
    color: 'rgba(244, 231, 215, 0.72)',
    fontSize: '0.9rem',
  },
  statusText: {
    marginTop: '12px',
    color: '#d6aa72',
    fontWeight: 700,
  },
};

function formatPyrrhicWarRole(role = 'viewer') {
  const normalizedRole = String(role).trim().toLowerCase();
  if (normalizedRole === 'participant') return 'Participant';
  if (normalizedRole === 'writer') return 'Writer';
  if (normalizedRole === 'admin') return 'Admin';
  if (normalizedRole === 'owner') return 'Owner';
  return 'Viewer';
}

function formatPyrrhicWarTeam(team = 0) {
  switch (Number(team)) {
    case 1:
      return 'Imperial Forces';
    case 2:
      return 'United Chaos';
    case 3:
      return 'Forces of Change';
    case 4:
      return 'Marauders';
    default:
      return 'No Team';
  }
}

export default function PyrrhicWar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => readStoredUser());
  const [pyrrhicAccess, setPyrrhicAccess] = useState({
    role: 'viewer',
    team: 0,
    canManageRoles: false,
    canEditCompendium: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [patrons, setPatrons] = useState([]);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isPatronsBusy, setIsPatronsBusy] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function syncUser() {
      const storedUser = readStoredUser();
      setUser(storedUser);

      if (!storedUser) {
        if (!ignore) {
          setPyrrhicAccess({
            role: 'viewer',
            team: 0,
            canManageRoles: false,
            canEditCompendium: false,
          });
        }
        return;
      }

      try {
        await refreshStoredUser();
        const { response, payload } = await fetchJson('/pyrrhic-war/access', {
          method: 'GET',
        });

        if (!ignore && response.ok) {
          setPyrrhicAccess({
            role: payload.access?.role || 'viewer',
            team: Number(payload.access?.team || 0),
            canManageRoles: Boolean(payload.access?.canManageRoles),
            canEditCompendium: Boolean(payload.access?.canEditCompendium),
          });
        }
      } catch (_error) {
        if (!ignore) {
          setPyrrhicAccess({
            role: 'viewer',
            team: 0,
            canManageRoles: false,
            canEditCompendium: false,
          });
        }
      }
    }

    window.addEventListener(getAuthEventName(), syncUser);
    syncUser();

    return () => {
      ignore = true;
      window.removeEventListener(getAuthEventName(), syncUser);
    };
  }, []);

  async function loadPatrons() {
    if (!pyrrhicAccess.canManageRoles) return;

    setIsPatronsBusy(true);
    setSettingsMessage('');

    try {
      const { response, payload } = await fetchJson('/pyrrhic-war/roles/list', {
        method: 'POST',
      });

      if (!response.ok) {
        setSettingsMessage(payload.message || 'Unable to load Pyrrhic War members.');
        return;
      }

      setPatrons(payload.patrons || []);
    } catch (_error) {
      setSettingsMessage('Unable to load Pyrrhic War members.');
    } finally {
      setIsPatronsBusy(false);
    }
  }

  function openSettings() {
    setIsSettingsOpen(true);
    loadPatrons();
  }

  async function handleMembershipChange(patron, nextRole, nextTeam) {
    setIsPatronsBusy(true);
    setSettingsMessage('');

    try {
      const { response, payload } = await fetchJson('/pyrrhic-war/roles/set-role', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: patron.id,
          role: nextRole,
          team: Number(nextTeam || 0),
        }),
      });

      if (!response.ok) {
        setSettingsMessage(payload.message || 'Unable to update that Pyrrhic War member.');
        return;
      }

      setPatrons((prev) => prev.map((item) => (item.id === payload.patron.id ? payload.patron : item)));
      setSettingsMessage(payload.message || 'Pyrrhic War access updated.');

      if (payload.patron.id === user?.id) {
        const { response: accessResponse, payload: accessPayload } = await fetchJson('/pyrrhic-war/access', {
          method: 'GET',
        });

        if (accessResponse.ok) {
          setPyrrhicAccess({
            role: accessPayload.access?.role || 'viewer',
            team: Number(accessPayload.access?.team || 0),
            canManageRoles: Boolean(accessPayload.access?.canManageRoles),
            canEditCompendium: Boolean(accessPayload.access?.canEditCompendium),
          });
        }
      }
    } catch (_error) {
      setSettingsMessage('Unable to update that Pyrrhic War member.');
    } finally {
      setIsPatronsBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <button type="button" onClick={() => navigate('/projects')} style={styles.backButton}>
        &lt; Back
      </button>
      {pyrrhicAccess.canManageRoles && (
        <button
          type="button"
          onClick={openSettings}
          style={styles.gearButton}
          aria-label="Open Pyrrhic War settings"
          title="Pyrrhic War settings"
        >
          &#9881;
        </button>
      )}
      <div style={styles.titleBox}>Pyrrhic War</div>
      <div style={styles.actions}>
        <Link to="/projects/PyrrhicWarCompendium" style={styles.button}>
          Compendium
        </Link>
        <Link to="/projects/PyrrhicWarMap" style={styles.button}>
          Crusade Board
        </Link>
      </div>
      {isSettingsOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'Georgia, serif' }}>Pyrrhic War Settings</h2>
                <div style={styles.settingsSummary}>
                  {user?.username || 'This user'} currently has Pyrrhic War {formatPyrrhicWarRole(pyrrhicAccess.role)} access for{' '}
                  {formatPyrrhicWarTeam(pyrrhicAccess.team)}.
                </div>
              </div>
              <button type="button" style={styles.smallButton} onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>

            <div style={styles.mutedText}>
              Owners, website admins, and Pyrrhic War admins can manage Pyrrhic War access and team assignments.
            </div>
            <div style={styles.mutedText}>
              The `Writer` role can edit the Pyrrhic War compendium without granting crusade-board admin access.
            </div>

            {settingsMessage && <div style={styles.statusText}>{settingsMessage}</div>}

            <div style={{ marginTop: '12px' }}>
              {isPatronsBusy && patrons.length === 0 ? (
                <div>Loading members...</div>
              ) : (
                patrons.map((patron) => (
                  <div key={patron.id} style={styles.patronRow}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{patron.username || 'Unnamed user'}</div>
                      <div style={styles.mutedText}>{patron.email}</div>
                      <div style={styles.mutedText}>
                        Current: {formatPyrrhicWarRole(patron.pyrrhicWarRole)} for {formatPyrrhicWarTeam(patron.pyrrhicWarTeam)}
                      </div>
                    </div>
                    <div style={styles.controlBlock}>
                      <label htmlFor={`pyrrhic-role-${patron.id}`} style={styles.controlLabel}>
                        Access
                      </label>
                      <select
                        id={`pyrrhic-role-${patron.id}`}
                        style={styles.select}
                        value={patron.pyrrhicWarMembershipRole === 'owner' ? 'owner' : patron.pyrrhicWarMembershipRole || 'viewer'}
                        onChange={(event) => handleMembershipChange(patron, event.target.value, patron.pyrrhicWarTeam)}
                        disabled={isPatronsBusy || !patron.canEditPyrrhicWarRole || patron.pyrrhicWarRole === 'owner'}
                      >
                        {patron.pyrrhicWarRole === 'owner' ? (
                          <option value="owner">Owner</option>
                        ) : (
                          <>
                            <option value="viewer">Viewer</option>
                            <option value="participant">Participant</option>
                            <option value="writer">Writer</option>
                            <option value="admin">Admin</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div style={styles.controlBlock}>
                      <label htmlFor={`pyrrhic-team-${patron.id}`} style={styles.controlLabel}>
                        Team
                      </label>
                      <select
                        id={`pyrrhic-team-${patron.id}`}
                        style={styles.select}
                        value={String(Number(patron.pyrrhicWarTeam || 0))}
                        onChange={(event) =>
                          handleMembershipChange(
                            patron,
                            patron.pyrrhicWarRole === 'owner' ? 'owner' : patron.pyrrhicWarMembershipRole || 'viewer',
                            Number(event.target.value)
                          )
                        }
                        disabled={isPatronsBusy || !patron.canEditPyrrhicWarTeam}
                      >
                        <option value="0">No Team</option>
                        <option value="1">Imperial Forces</option>
                        <option value="2">United Chaos</option>
                        <option value="3">Forces of Change</option>
                        <option value="4">Marauders</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
