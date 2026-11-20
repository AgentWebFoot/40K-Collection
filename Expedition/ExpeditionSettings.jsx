import { useEffect, useRef, useState } from 'react';
import { fetchJson } from '../../utils/auth';
import { expeditionRoles, expeditionTeams } from './expedition-membership.mjs';

const styles = {
  dialog: { width: 'min(680px, calc(100% - 32px))', maxHeight: '82dvh', boxSizing: 'border-box', overflow: 'auto', border: '1px solid #555', borderRadius: '12px', padding: '18px', background: '#242424', color: '#fff' },
  layout: { display: 'grid', gap: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  heading: { margin: 0, color: 'inherit', fontSize: '1.1rem' },
  label: { display: 'grid', gap: '4px', minWidth: 0, fontSize: '0.875rem' },
  form: { display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '8px' },
  input: { width: '100%', minWidth: 0, padding: '7px 9px', background: '#161616', border: '1px solid #666', borderRadius: '5px', color: '#fff', font: 'inherit', boxSizing: 'border-box' },
  button: { padding: '7px 10px', background: '#343434', color: '#fff', border: '1px solid #666', borderRadius: '5px', font: 'inherit' },
  members: { display: 'grid', gap: '8px' },
  member: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', alignItems: 'center', gap: '10px', padding: '10px', background: '#1b1b1b', border: '1px solid #494949', borderRadius: '6px', overflowWrap: 'anywhere' },
  status: { margin: 0, color: '#ddd' },
  error: { margin: 0, color: '#ffb5a7' },
};

const capitalize = value => value ? value[0].toUpperCase() + value.slice(1) : '';

function SettingsStatus({ feedback }) {
  return feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.status}>{feedback.message}</p>;
}

export default function ExpeditionSettings({ role, round, onRoundChange, onMemberChange, onClose }) {
  const dialog = useRef(null);
  const [draftRound, setDraftRound] = useState(null);
  const [roundBusy, setRoundBusy] = useState(false);
  const [roundFeedback, setRoundFeedback] = useState(null);
  const [members, setMembers] = useState(null);
  const [membersBusy, setMembersBusy] = useState(true);
  const [memberFeedback, setMemberFeedback] = useState(null);
  const [memberRevision, setMemberRevision] = useState(0);

  useEffect(() => { dialog.current.showModal(); }, []);

  useEffect(() => {
    let ignore = false;
    setMembersBusy(true);
    setMemberFeedback(null);
    async function loadMembers() {
      try {
        const { response, payload } = await fetchJson('/expedition/roles/list', { method: 'POST' });
        if (!response.ok) throw new Error(payload.message || 'Unable to load Expedition members.');
        if (!ignore) setMembers(Array.isArray(payload.patrons) ? payload.patrons : []);
      } catch (error) {
        if (!ignore) setMemberFeedback({ error: true, message: error.message });
      } finally {
        if (!ignore) setMembersBusy(false);
      }
    }
    loadMembers();
    return () => { ignore = true; };
  }, [memberRevision]);

  async function saveRound(event) {
    event.preventDefault();
    if (roundBusy || round == null) return;
    setRoundBusy(true);
    setRoundFeedback(null);
    try {
      const { response, payload } = await fetchJson('/expedition/round', {
        method: 'POST',
        body: JSON.stringify({ round: Number(draftRound ?? round), expectedRound: round }),
      });
      if (Number.isSafeInteger(payload.round) && payload.round >= 1) {
        onRoundChange(payload.round);
        setDraftRound(null);
      }
      if (!response.ok) throw new Error(payload.message || 'Unable to save the round.');
      setRoundFeedback({ message: 'Round saved.' });
    } catch (error) {
      setRoundFeedback({ error: true, message: error.message });
    } finally {
      setRoundBusy(false);
    }
  }

  async function saveMember(member, nextRole, nextTeam) {
    if (membersBusy) return;
    setMembersBusy(true);
    setMemberFeedback(null);
    try {
      const { response, payload } = await fetchJson('/expedition/roles/set-role', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: member.id, role: nextRole, team: nextTeam }),
      });
      if (!response.ok) throw new Error(payload.message || 'Unable to save the team assignment.');
      setMembers(current => current.map(item => item.id === payload.patron.id ? payload.patron : item));
      setMemberFeedback({ message: payload.message || 'Team assignment saved.' });
      onMemberChange(payload.patron);
    } catch (error) {
      setMemberFeedback({ error: true, message: error.message });
    } finally {
      setMembersBusy(false);
    }
  }

  return (
    <dialog id="expedition-menu-settings" ref={dialog} aria-labelledby="expedition-menu-settings-title" onClose={onClose} style={styles.dialog}>
      <div style={styles.layout}>
        <div style={styles.header}>
          <h2 id="expedition-menu-settings-title" style={styles.heading}>Expedition Settings</h2>
          <button type="button" style={styles.button} onClick={() => dialog.current.close()} aria-label="Close settings">×</button>
        </div>
        <form onSubmit={saveRound} style={styles.form}>
          <label style={{ ...styles.label, width: '125px' }}>
            Round Number
            <input type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required
              value={draftRound ?? round ?? ''} onChange={event => setDraftRound(event.target.value)}
              disabled={roundBusy || round == null} style={styles.input} />
          </label>
          <button type="submit" disabled={roundBusy || round == null} style={styles.button}>Save Round</button>
        </form>
        <SettingsStatus feedback={roundFeedback} />
        <section style={styles.layout} aria-labelledby="expedition-menu-team-assignments">
          <div style={styles.header}>
            <h3 id="expedition-menu-team-assignments" style={styles.heading}>Team Assignments</h3>
            <button type="button" disabled={membersBusy} style={styles.button} onClick={() => setMemberRevision(value => value + 1)}>Refresh Members</button>
          </div>
          <SettingsStatus feedback={memberFeedback} />
          {members == null && membersBusy && <p role="status" style={styles.status}>Loading Expedition members…</p>}
          {members?.length === 0 && <p style={styles.status}>No Expedition members found.</p>}
          {members?.length > 0 && (
            <div style={styles.members}>
              {members.map(member => {
                const name = member.username || member.email || 'Unnamed user';
                const membershipRole = member.canEditExpeditionRole ? member.expeditionMembershipRole || 'viewer' : 'owner';
                const team = member.expeditionTeam || '';
                return (
                  <div key={member.id} style={styles.member}>
                    <strong>{name}</strong>
                    <label style={styles.label}>
                      Access
                      <select aria-label={`Expedition access for ${name}`} value={membershipRole}
                        disabled={!member.canEditExpeditionRole || membersBusy} style={styles.input}
                        onChange={event => saveMember(member, event.target.value, team)}>
                        {member.canEditExpeditionRole
                          ? expeditionRoles.map(access => <option key={access} value={access}>{capitalize(access)}</option>)
                          : <option value="owner">{capitalize(member.expeditionRole)}</option>}
                      </select>
                    </label>
                    <label style={styles.label}>
                      Team
                      <select aria-label={`Team for ${name}`} value={team}
                        disabled={membersBusy || (member.siteRole === 'owner' && role !== 'owner')} style={styles.input}
                        onChange={event => saveMember(member, membershipRole, event.target.value)}>
                        {expeditionTeams.map(color => <option key={color} value={color}>{capitalize(color) || 'No Team'}</option>)}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}
