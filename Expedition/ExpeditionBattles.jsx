import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { battlesUnavailableMessage, expeditionBattlesEnabled } from './battle-availability.mjs';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import { battleTypes, battleTeamList, battleParticipants, battleResultOptions, battleOutcome, battleLocationOptions, validateBattle } from './battle-rules.mjs';
import './point-rewards.js';

const { battleFields, readSettings } = globalThis.ExpeditionPointRewards;
const battlePath = '/projects/ExpeditionBattles';
const emptyBattle = { battleType: '', battleSide: '', battleOpponent: '', battleOpponents: [], battleLocation: '', battleResult: '', battleWinners: [], comment: '' };
const statusLabels = { pending: 'Pending review', accepted: 'Approved', denied: 'Denied', canceled: 'Canceled' };
const teamLabel = team => team === 'outside-player' ? 'Outside Player' : team ? `${team[0].toUpperCase()}${team.slice(1)} Team` : 'Unknown team';
const styles = {
  page: { minHeight: '100%', padding: 'clamp(16px, 4vw, 40px)', background: '#1e1e1e', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  layout: { display: 'grid', gap: '18px', width: '100%', maxWidth: '900px', margin: '0 auto' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' },
  heading: { margin: 0, color: 'inherit', font: '700 1.8rem system-ui, sans-serif' },
  subheading: { margin: 0, fontSize: '1.1rem' },
  link: { color: '#eee', textUnderlineOffset: '4px' },
  card: { display: 'grid', gap: '12px', minWidth: 0, padding: '16px', background: '#272727', border: '1px solid #4a4a4a', borderRadius: '8px' },
  fields: { display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))' },
  field: { width: '100%', color: '#fff', background: '#1a1a1a', padding: '8px', border: '1px solid #666', borderRadius: '5px', font: 'inherit' },
  button: { color: '#fff', background: '#383838', border: '1px solid #666', borderRadius: '5px', padding: '8px 12px', font: 'inherit' },
  label: { display: 'grid', gap: '5px', fontSize: '0.9rem' },
  note: { margin: 0, color: '#ddd' },
  error: { margin: 0, color: '#ffb5a7' },
  details: { display: 'grid', gap: '6px', margin: 0, overflowWrap: 'anywhere' },
};
const navButton = { ...styles.button, display: 'inline-flex', justifyContent: 'center', minWidth: '110px', textDecoration: 'none', fontWeight: 600 };
const activeNavButton = { ...navButton, background: '#555', borderColor: '#aaa' };

async function request(path, body) {
  const options = body ? { method: 'POST', body: JSON.stringify(body) } : { method: 'GET' };
  const { response, payload } = await fetchJson(`/expedition${path}`, options);
  if (!response.ok) throw new Error(payload.message || 'Unable to load or save Expedition battles.');
  return payload;
}

function SelectField({ label, options, value, onChange, required = true }) {
  return (
    <label style={styles.label}>
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} required={required} style={styles.field}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
    </label>
  );
}

function CheckGroup({ title, choices, selected, limit, onChange }) {
  return (
    <fieldset style={{ ...styles.card, margin: 0 }}>
      <legend>{title}</legend>
      <div style={styles.row}>
        {choices.map(team => (
          <label key={team} style={{ ...styles.row, gap: '5px' }}>
            <input
              type="checkbox" checked={selected.includes(team)}
              disabled={!selected.includes(team) && selected.length >= limit}
              onChange={event => onChange(event.target.checked ? [...selected, team] : selected.filter(value => value !== team))}
            />
            {teamLabel(team)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BattleForm({ data, record, onSave, onClose }) {
  const { access, map } = data;
  const [draft, setDraft] = useState(() => ({
    ...emptyBattle, requesterTeam: access.team || '', ...record?.changeSet,
    battleOpponents: battleTeamList(record?.changeSet.battleOpponents),
    battleWinners: modelWinners(record?.changeSet),
    comment: record?.changeSet.comment || '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const multiplayer = draft.battleType === 'multiplayer-op';
  const compound = draft.battleType === 'compound-op';
  const joint = draft.battleType === 'joint-op';
  const opponents = [...access.teams.filter(team => joint || team !== draft.requesterTeam), ...(joint ? [] : ['outside-player'])];
  const hasOpponents = multiplayer ? draft.battleOpponents.length >= 2 : Boolean(draft.battleOpponent);
  const locations = hasOpponents ? battleLocationOptions(draft, map.tiles) : [];
  const set = patch => setDraft(current => ({ ...current, ...patch }));

  async function submit(event) {
    event.preventDefault();
    const { battleType, battleSide, battleOpponent, battleOpponents, battleLocation, battleResult, battleWinners, requesterTeam, comment } = draft;
    const changeSet = {
      requestType: 'battle', changes: [], submissionRound: record?.changeSet.submissionRound ?? map.round ?? 1,
      battleType, battleSide, battleLocation, requesterTeam, comment: comment.trim(),
      battleOpponent: multiplayer ? battleOpponents[0] : battleOpponent,
      battleOpponents, battleResult, battleWinners, battleWinner: battleWinners[0] || '',
    };
    const invalid = validateBattle(changeSet, access.teams, map.tiles);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(changeSet, record?.id);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={styles.card} onSubmit={submit}>
      <h2 style={styles.subheading}>{record ? 'Edit battle report' : 'Log a battle'}</h2>
      <fieldset disabled={busy} style={{ display: 'grid', gap: '12px', border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div style={styles.fields}>
          {access.canReview && (
            <SelectField label="Reporting team" options={access.teams.map(team => [team, teamLabel(team)])}
              value={draft.requesterTeam} onChange={requesterTeam => set({ ...emptyBattle, requesterTeam, comment: draft.comment })} />
          )}
          <SelectField label="Battle type" options={Object.entries(battleTypes)} value={draft.battleType}
            onChange={battleType => set({ ...emptyBattle, battleType, comment: draft.comment })} />
          {compound && (
            <SelectField label="Reporting team’s role" options={[[ 'attacker', 'Attacker' ], [ 'defender', 'Defender' ]]}
              value={draft.battleSide} onChange={battleSide => set({ battleSide, battleLocation: '', battleResult: '' })} />
          )}
          {draft.battleType && !multiplayer && (!compound || draft.battleSide) && (
            <SelectField label={joint ? 'Teammate' : 'Opponent'} options={opponents.map(team => [team, teamLabel(team)])}
              value={draft.battleOpponent} onChange={battleOpponent => set({ battleOpponent, battleLocation: '', battleResult: '' })} />
          )}
          {locations.length > 0 && (
            <SelectField label="Battle tile" options={locations.map(tile => [tile.id, `Tile ${tile.id}${tile.locationNumber ? ` · Location ${tile.locationNumber}` : ''}`])}
              value={draft.battleLocation} onChange={battleLocation => set({ battleLocation })} />
          )}
          {!multiplayer && draft.battleLocation && (
            <SelectField label={compound ? 'Winner' : 'Result'} options={Object.entries(battleResultOptions(draft.battleType))}
              value={draft.battleResult} onChange={battleResult => set({ battleResult })} />
          )}
        </div>
        {multiplayer && (
          <CheckGroup title="Opponents (2–3)" choices={opponents} selected={draft.battleOpponents} limit={3}
            onChange={battleOpponents => set({ battleOpponents, battleWinners: [], battleLocation: '' })} />
        )}
        {hasOpponents && locations.length === 0 && <p style={styles.note}>No eligible tiles for these participants on the current map.</p>}
        {multiplayer && draft.battleLocation && (
          <CheckGroup title="Winners" choices={battleParticipants(draft)} selected={draft.battleWinners}
            onChange={battleWinners => set({ battleWinners })} />
        )}
        <label style={styles.label}>
          Notes
          <textarea value={draft.comment} onChange={event => set({ comment: event.target.value })} rows={3} style={styles.field} />
        </label>
        <div style={styles.row}>
          <button type="submit" style={styles.button}>{record ? 'Save battle report' : 'Submit for review'}</button>
          <button type="button" onClick={onClose} style={styles.button}>Close</button>
        </div>
      </fieldset>
      {error && <p role="alert" style={styles.error}>{error}</p>}
    </form>
  );
}

function BattleSettings({ initial }) {
  const [values, setValues] = useState(() => readSettings(initial));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const pointRewards = Object.fromEntries(battleFields.map(([key]) => [key, Number(values[key])]));
      const response = await request('/battle-settings', { pointRewards });
      setValues(readSettings(response.pointRewards));
      setFeedback({ text: 'Battle settings saved.' });
    } catch (error) {
      setFeedback({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={styles.card} onSubmit={save}>
      <h2 style={styles.subheading}>Battle Point Rewards</h2>
      <fieldset disabled={busy} style={{ ...styles.fields, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {battleFields.map(([key, label, , max]) => (
          <label key={key} style={styles.label}>
            {label}
            <input type="number" min="0" max={max ?? Number.MAX_SAFE_INTEGER} step="1" required value={values[key]}
              onChange={event => setValues({ ...values, [key]: event.target.value })} style={styles.field} />
          </label>
        ))}
      </fieldset>
      <div><button type="submit" disabled={busy} style={styles.button}>Save battle settings</button></div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.text}</p>}
    </form>
  );
}

function BattleRecord({ record, access, reviewing, onReview, onEdit }) {
  const battle = record.changeSet;
  const { winners, result } = battleOutcome(battle);
  const pending = record.status === 'pending';
  const own = record.own;
  const date = value => new Date(value).toLocaleString();
  return (
    <article style={styles.card}>
      <div style={{ ...styles.row, justifyContent: 'space-between' }}>
        <h3 style={styles.subheading}>{battleTypes[battle.battleType] || 'Battle'} · {battle.battleLocation ? `Tile ${battle.battleLocation}` : 'Tile unrecorded'}</h3>
        <strong>{statusLabels[record.status] || record.status}</strong>
      </div>
      <dl style={styles.details}>
        <div><dt style={{ display: 'inline' }}>Teams </dt><dd style={{ display: 'inline', margin: 0 }}>{battleParticipants(battle).map(teamLabel).join(', ')}</dd></div>
        <div><dt style={{ display: 'inline' }}>Outcome </dt><dd style={{ display: 'inline', margin: 0 }}>{winners.length ? `${winners.map(teamLabel).join(', ')} won${result ? ` (${result})` : ''}` : result}</dd></div>
        {battle.battleSide && <div><dt style={{ display: 'inline' }}>Reporting role </dt><dd style={{ display: 'inline', margin: 0 }}>{teamLabel(battle.requesterTeam)} ({battle.battleSide})</dd></div>}
      </dl>
      <p style={styles.note}>
        {battle.submissionRound ? `Round ${battle.submissionRound} · ` : ''}Logged by {record.requesterUsername || 'Unknown'}{record.createdAt ? ` · ${date(record.createdAt)}` : ''}
      </p>
      {record.reviewedAt && <p style={styles.note}>{statusLabels[record.status]} {date(record.reviewedAt)}{record.reviewedByUsername ? ` by ${record.reviewedByUsername}` : ''}</p>}
      {battle.comment && <p style={{ ...styles.note, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{battle.comment}</p>}
      {record.awardedPoints?.length > 0 && (
        <p style={styles.note}>{record.awardedPoints.map(({ team, amount, field }) => `${teamLabel(team)} +${amount} ${field === 'supplyPoints' ? 'Supply' : 'Campaign'} Points`).join(' · ')}</p>
      )}
      {pending && (own || access.canReview) && (
        <div style={styles.row}>
          {(access.canReview || (own && access.canLog)) && <button type="button" disabled={reviewing} onClick={onEdit} style={styles.button}>Edit</button>}
          {access.canReview && (
            <>
              <button type="button" disabled={reviewing} onClick={() => onReview('accept')} style={styles.button}>Approve</button>
              <button type="button" disabled={reviewing} onClick={() => onReview('deny')} style={styles.button}>Deny</button>
            </>
          )}
          {own && <button type="button" disabled={reviewing} onClick={() => onReview('cancel-own')} style={styles.button}>Cancel report</button>}
        </div>
      )}
    </article>
  );
}

const loadBattles = async () => {
  const [access, map] = await Promise.all([request('/battles'), request('/map')]);
  return { access, map };
};

function modelWinners(battle) {
  return battle?.battleType === 'multiplayer-op' ? battleOutcome(battle).winners : [];
}

export default function ExpeditionBattles(props) {
  if (expeditionBattlesEnabled) return <BattlePage {...props} />;
  return (
    <main style={styles.page}>
      <div style={styles.layout}>
        <Link to="/projects/Expedition" style={styles.link}>← Expedition</Link>
        <h1 style={styles.heading}>Battles</h1>
        <p style={styles.note}>{battlesUnavailableMessage}</p>
      </div>
    </main>
  );
}

function BattlePage({ settings = false }) {
  const [data, setData] = useState(null);
  const [editor, setEditor] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const event = getAuthEventName();
    const refresh = () => setReload(value => value + 1);
    window.addEventListener(event, refresh);
    return () => window.removeEventListener(event, refresh);
  }, []);

  useEffect(() => {
    let canceled = false;
    setLoadError('');
    setData(null);
    setEditor(null);
    setFeedback(null);
    setFilter('');
    loadBattles().then(
      result => { if (!canceled) setData(result); },
      error => { if (!canceled) setLoadError(error.message); },
    );
    return () => { canceled = true; };
  }, [reload, settings]);

  function updateRecord(record) {
    setData(current => current && ({
      ...current,
      access: {
        ...current.access,
        battles: current.access.battles.some(item => item.id === record.id)
          ? current.access.battles.map(item => item.id === record.id ? { ...item, ...record } : item)
          : [{ ...record, own: true }, ...current.access.battles],
      },
    }));
  }

  async function saveBattle(changeSet, id) {
    const response = await request(id ? '/map-requests/update' : '/map-requests', { changeSet, ...(id ? { requestId: id } : {}) });
    updateRecord(response.request);
    setEditor(null);
    setFeedback({ text: id ? 'Battle report updated.' : 'Battle report submitted for review.' });
  }

  async function review(action, id) {
    setReviewing(true);
    setFeedback(null);
    try {
      const response = await request(`/map-requests/${action}`, { requestId: id });
      updateRecord(response.request);
      if (editor?.id === id) setEditor(null);
      setFeedback({ text: action === 'accept' ? 'Battle approved.' : action === 'deny' ? 'Battle denied.' : 'Battle report canceled.' });
    } catch (error) {
      setFeedback({ text: error.message, error: true });
    } finally {
      setReviewing(false);
    }
  }

  const battles = (data?.access.battles ?? []).filter(record => !filter || battleParticipants(record.changeSet).includes(filter))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return (
    <main style={styles.page}>
      <div style={styles.layout}>
        <Link to="/projects/Expedition" style={styles.link}>← Expedition</Link>
        <h1 style={styles.heading}>Battles</h1>
        <nav aria-label="Battles" style={styles.row}>
          <Link to={battlePath} aria-current={settings ? undefined : 'page'} style={settings ? navButton : activeNavButton}>Battle Log</Link>
          {data?.access.canReview && (
            <Link to={`${battlePath}/settings`} aria-current={settings ? 'page' : undefined} style={settings ? activeNavButton : navButton}>Settings</Link>
          )}
        </nav>
        {loadError ? (
          <div style={styles.card}>
            <p role="alert" style={styles.error}>{loadError}</p>
            <div><button type="button" onClick={() => setReload(value => value + 1)} style={styles.button}>Retry</button></div>
          </div>
        ) : !data ? <p role="status" style={styles.note}>Loading battles…</p>
          : settings ? (
            data.access.canReview ? <BattleSettings initial={data.map.pointRewards} /> : <p style={styles.note}>Battle settings are available to Expedition admins and owners.</p>
          ) : (
            <>
              <div style={styles.row}>
                {data.access.canLog && <button type="button" onClick={() => setEditor({})} style={styles.button}>Log a battle</button>}
                {data.access.canReview && (
                  <label style={styles.label}>
                    Filter by team
                    <select value={filter} onChange={event => setFilter(event.target.value)} style={styles.field}>
                      <option value="">All teams</option>
                      {data.access.teams.map(team => <option key={team} value={team}>{teamLabel(team)}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.text}</p>}
              {editor && <BattleForm key={editor.id || 'new'} data={data} record={editor.id ? editor : null} onSave={saveBattle} onClose={() => setEditor(null)} />}
              {battles.length ? battles.map(record => (
                <BattleRecord key={record.id} record={record} access={data.access} reviewing={reviewing}
                  onEdit={() => setEditor(record)} onReview={action => review(action, record.id)} />
              )) : <p style={styles.note}>{filter ? 'No battles for this team.' : 'No battles recorded for your teams yet.'}</p>}
            </>
          )}
      </div>
    </main>
  );
}
