import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import {
  battleEquipmentLimit, battleLocationOptions, battleOutcome, battleParticipants, battleRewardFields, battlesUnavailableMessage,
  battleSubmissionRound, battleTeamList, battleTypes, equipmentCount, expeditionBattlesEnabled, projectedBattlePayouts, validBattleScores,
  validateBattle, validRewardOverrides,
} from './battle-rules.mjs';
import EquipmentRules from './EquipmentRules.jsx';
import { styles, teamMarkerColors, sortButton, clockFace, clockHands, filterIcon, filterBadge } from './expedition-log-styles.mjs';
import './point-rewards.js';

const { battleFields, battleGroups, readSettings } = globalThis.ExpeditionPointRewards;
const battlePath = '/projects/ExpeditionBattles';
const emptyBattleChoices = { battleType: '', battleSide: '', battleOpponent: '', battleOpponents: [], battleLocation: '', battleOutcome: '', scores: {} };
const statusLabels = { pending: 'Pending review', accepted: 'Approved', denied: 'Denied', canceled: 'Canceled' };
const battleSortOptions = {
  date: { ascending: 'oldest', descending: 'newest' },
  name: { ascending: 'name-asc', descending: 'name-desc' },
};
const teamLabel = team => team === 'outside-player' ? 'Outside Player' : team ? `${team[0].toUpperCase()}${team.slice(1)} Team` : 'Unknown team';
const battleTypeLabel = record => battleTypes[record.changeSet.battleType] || 'Battle';
const battleName = record => typeof record.changeSet.battleName === 'string' && record.changeSet.battleName.trim() || 'Unnamed battle';
const battleDate = record => String(record.changeSet.battleDate || record.createdAt || '');
const tileTeams = tile => [...new Set([tile?.marker, tile?.secondaryMarker])]
  .filter(team => Object.hasOwn(teamMarkerColors, team));
const navButton = { ...styles.button, display: 'inline-flex', justifyContent: 'center', minWidth: '110px', textDecoration: 'none', fontWeight: 600 };
const activeNavButton = { ...navButton, background: '#555', border: '1px solid #aaa' };
const pairedFields = { ...styles.fields, alignItems: 'start' };
async function request(path, body) {
  const options = body ? { method: 'POST', body: JSON.stringify(body) } : { method: 'GET' };
  const { response, payload } = await fetchJson(`/expedition${path}`, options);
  if (!response.ok) throw new Error(payload.message || 'Unable to load or save Expedition battles.');
  return payload;
}

function useBattleEquipment(team, editId) {
  const [state, setState] = useState(null);
  const [reload, setReload] = useState(0);
  const query = new URLSearchParams(team ? { team } : {});
  if (editId) query.set('edit', editId);
  const path = team ? `/battle-equipment?${query}` : '';
  useEffect(() => {
    if (!path) return;
    let ignore = false;
    setState(null);
    request(path).then(
      payload => { if (!ignore) setState({ path, items: payload.equipment }); },
      error => { if (!ignore) setState({ path, error: error.message }); },
    );
    return () => { ignore = true; };
  }, [path, reload]);
  const current = state?.path === path ? state : null;
  return { items: current?.items ?? [], ready: !path || Boolean(current?.items), error: current?.error,
    retry: () => setReload(value => value + 1) };
}

function BattleEquipmentPicker({ inventory, selected, onChange, disabled }) {
  const total = equipmentCount(selected);
  const unavailable = selected.some(entry => !inventory.items.some(item => item.id === entry.id && item.available >= entry.quantity));
  function choose(id, quantity) {
    const rest = selected.filter(item => item.id !== id);
    onChange(quantity ? [...rest, { id, quantity }] : rest);
  }

  return (
    <fieldset disabled={disabled} style={{ ...styles.card, margin: 0 }}>
      <legend>Equipment used</legend>
      <div style={{ ...styles.row, justifyContent: 'space-between' }}>
        <p style={styles.note}>{total} of {battleEquipmentLimit} selected</p>
        {inventory.ready && <button type="button" style={styles.button} onClick={inventory.retry}>Refresh equipment</button>}
      </div>
      {inventory.error ? (
        <div style={styles.row}>
          <p role="alert" style={styles.error}>{inventory.error}</p>
          <button type="button" style={styles.button} onClick={inventory.retry}>Retry equipment</button>
        </div>
      ) : !inventory.ready ? <p role="status" style={styles.note}>Loading equipment…</p>
        : (
          <>
            {[['universal', 'Universal Equipment', 'Unlimited use'], ['faction', 'Faction Equipment', 'Unlimited use'],
              ['purchased', 'Purchased Equipment', 'Single use']].map(([kind, title, rule]) => {
              const items = inventory.items.filter(item => item.kind === kind);
              return (
                <div key={kind} style={styles.stack}>
                  <strong>{title} · {rule}</strong>
                  {items.length === 0 && <p style={styles.note}>None available.</p>}
                  {items.map(item => {
                    const quantity = selected.find(entry => entry.id === item.id)?.quantity ?? 0;
                    const max = Math.min(item.available, battleEquipmentLimit - total + quantity);
                    return (
                      <div key={item.id} style={{ display: 'grid', gap: '5px' }}>
                        {kind !== 'purchased' ? (
                          <label style={{ ...styles.row, gap: '6px' }}>
                            <input type="checkbox" checked={quantity > 0} disabled={!quantity && max <= 0}
                              onChange={event => choose(item.id, event.target.checked ? 1 : 0)} />
                            {item.name}
                          </label>
                        ) : (
                          <label style={styles.label}>
                            {item.name} · {item.available} available
                            <select style={styles.field} value={quantity} disabled={max === 0}
                              onChange={event => choose(item.id, Number(event.target.value))}>
                              {Array.from({ length: Math.max(quantity, max) + 1 }, (_, amount) => (
                                <option key={amount} value={amount} disabled={amount > max}>{amount}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {(item.description || item.action) && (
                          <details>
                            <summary style={{ cursor: 'pointer' }} aria-label={`${item.name} rules`}>Rules</summary>
                            <EquipmentRules equipment={item} showEmptyAbility />
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {unavailable && (
              <div style={styles.row}>
                <p style={styles.error}>Some selected equipment is unavailable.</p>
                <button type="button" style={styles.button} onClick={() => onChange([])}>Clear selection</button>
              </div>
            )}
          </>
        )}
    </fieldset>
  );
}

function SelectField({ label, options, value, onChange, disabled = false, placeholder = `Select ${label.toLowerCase()}`, markers = [] }) {
  return (
    <label style={styles.label}>
      <span style={styles.labelRow}>
        {label}
        {markers.map(team => <span key={team} title={teamLabel(team)} aria-hidden="true"
          style={{ ...styles.teamMarker, backgroundColor: teamMarkerColors[team] }} />)}
      </span>
      <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required style={styles.field}>
        <option value="">{placeholder}</option>
        {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
      </select>
    </label>
  );
}

function CheckGroup({ title, choices, selected, limit, onChange, disabled = false, hint }) {
  return (
    <fieldset disabled={disabled} style={{ ...styles.card, margin: 0 }}>
      <legend>{title}</legend>
      {hint && <p style={styles.note}>{hint}</p>}
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

function JointOutcomeField({ value, onChange, disabled }) {
  return (
    <fieldset disabled={disabled} style={{ ...styles.card, margin: 0 }}>
      <legend>Outcome</legend>
      <div style={styles.row}>
        {[['joint-win', 'Joint victory'], ['joint-loss', 'Joint defeat'], ['draw', 'Draw']].map(([option, label]) => (
          <label key={option} style={{ ...styles.row, gap: '5px' }}>
            <input type="radio" name="battle-winner" value={option} checked={value === option} required
              onChange={() => onChange(option)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BattleRewardTable({ rows, overrides, onOverride }) {
  return (
    <table aria-label="Projected rewards" style={{ width: '100%', tableLayout: 'fixed', textAlign: 'left', borderSpacing: '6px', overflowWrap: 'anywhere' }}>
      <thead><tr>
        <th scope="col">Participant</th>
        {Object.entries(battleRewardFields).map(([key, { label }]) => <th key={key} scope="col">{label}</th>)}
      </tr></thead>
      <tbody>{rows.map(row => (
        <tr key={row.team}>
          <th scope="row">{teamLabel(row.team)}</th>
          {Object.entries(battleRewardFields).map(([key, { label, max }]) => (
            <td key={key}>
              {row.cappedRewards?.[key] == null ? row[key] : row[key] === 0 ? '0 (At Cap)' : (
                <>
                  {row.cappedRewards[key]} earned
                  <small style={{ display: 'block', color: '#ddd' }}>{row[key]} can be added (balance cap)</small>
                </>
              )}
              {onOverride && (
                <input aria-label={`Override ${teamLabel(row.team)} ${label}`} type="number" min="0" max={max} step="1"
                  placeholder="Default" style={styles.field} value={overrides[row.team]?.[key] ?? ''}
                  onChange={event => onOverride(row.team, key, event.target.value)} />
              )}
            </td>
          ))}
        </tr>
      ))}</tbody>
    </table>
  );
}

function BattleForm({ data, record, onSave, onClose }) {
  const { access, map } = data;
  const recordedBattle = record?.changeSet;
  const approved = record?.status === 'accepted';
  const recordedLocation = approved ? recordedBattle.battleLocation : undefined;
  const [draft, setDraft] = useState(() => ({
    ...emptyBattleChoices, requesterTeam: access.team || '', ...recordedBattle,
    battleOpponents: battleTeamList(recordedBattle?.battleOpponents),
    battleOutcome: recordedBattle?.battleType === 'joint-op'
      ? (recordedBattle.battleOutcome === 'draw' ? 'draw' : battleOutcome(recordedBattle).winners.length ? 'joint-win' : 'joint-loss')
      : '',
    scores: recordedBattle?.battleScores ?? {},
    battleName: recordedBattle?.battleName || '',
    battleDate: recordedBattle?.battleDate || '',
    lore: recordedBattle?.lore || '',
    comment: recordedBattle?.comment || '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState(() => record?.rewardOverrides ?? {});
  const [overrideEnabled, setOverrideEnabled] = useState(() => Object.keys(overrides).length > 0);
  const canChooseEquipment = !approved && (!record || record.own);
  const [equipment, setEquipment] = useState(() => record?.equipmentUsed?.find(use => use.source === 'reporter')?.items
    .map(({ id, quantity }) => ({ id, quantity })) ?? []);
  const inventory = useBattleEquipment(canChooseEquipment ? draft.requesterTeam : '', record?.id);
  const multiplayer = draft.battleType === 'multiplayer-op';
  const compound = draft.battleType === 'compound-op';
  const joint = draft.battleType === 'joint-op';
  const opponents = [...access.teams.filter(team => joint || team !== draft.requesterTeam), ...(joint ? [] : ['outside-player'])];
  const hasOpponents = multiplayer ? draft.battleOpponents.length >= 2 : Boolean(draft.battleOpponent);
  const participants = battleParticipants(draft);
  const scores = Object.fromEntries(participants.map(team => [team, draft.scores[team] ?? '']));
  const useRecordedOutcome = !joint && recordedBattle && !recordedBattle.battleScores
    && recordedBattle.battleType === draft.battleType && recordedBattle.requesterTeam === draft.requesterTeam
    && (recordedBattle.battleSide || '') === draft.battleSide
    && battleParticipants(recordedBattle).join(',') === participants.join(',')
    && Object.values(scores).every(score => score === '');
  const legacyOutcome = useRecordedOutcome ? Object.fromEntries(Object.entries({
    battleResult: recordedBattle.battleResult, battleOutcome: recordedBattle.battleOutcome,
    battleWinner: recordedBattle.battleWinner, battleWinners: recordedBattle.battleWinners, battleTiedTeams: recordedBattle.battleTiedTeams,
  }).filter(([, value]) => value !== undefined)) : null;
  const outcome = joint ? { battleOutcome: draft.battleOutcome } : legacyOutcome ?? { battleScores: scores };
  const contest = {
    battleType: draft.battleType, battleSide: draft.battleSide, battleLocation: draft.battleLocation,
    requesterTeam: draft.requesterTeam, battleOpponent: multiplayer ? draft.battleOpponents[0] : draft.battleOpponent,
    battleOpponents: draft.battleOpponents, ...outcome,
  };
  const rewardOverrides = overrideEnabled
    ? Object.fromEntries(Object.entries(overrides).filter(([team]) => participants.includes(team))) : {};
  const validOverrides = validRewardOverrides(contest, access.teams, rewardOverrides);
  const payoutReady = draft.requesterTeam && hasOpponents && (joint ? draft.battleOutcome : useRecordedOutcome || validBattleScores(contest));
  const rewardRows = payoutReady
    ? projectedBattlePayouts(contest, map.pointRewards, access.teams, map.teamStats, validOverrides ? rewardOverrides : {}) : [];
  const canChooseTile = draft.battleType && draft.requesterTeam && hasOpponents && (!compound || draft.battleSide);
  const locations = canChooseTile ? battleLocationOptions(draft, map.tiles) : [];
  if (recordedLocation && !locations.some(tile => tile.id === recordedLocation)) {
    locations.push(map.tiles?.find(tile => tile.id === recordedLocation) ?? { id: recordedLocation });
  }
  const locationOptions = locations.map(tile => {
    const parts = [`Tile ${tile.id}`];
    if (tile.locationNumber) parts.push(`Location ${tile.locationNumber}`);
    const teams = tileTeams(tile);
    if (teams.length) parts.push(teams.map(teamLabel).join(', '));
    return [tile.id, parts.join(' · ')];
  });
  const selectedTile = locations.find(tile => tile.id === draft.battleLocation);
  const set = patch => setDraft(current => ({ ...current, ...patch }));

  function changeReward(team, field, value) {
    setOverrides(current => {
      const next = { ...current };
      const amounts = { ...next[team] };
      if (value === '') delete amounts[field];
      else amounts[field] = Number(value);
      if (Object.keys(amounts).length) next[team] = amounts;
      else delete next[team];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!inventory.ready) return;
    const { battleName, battleDate, lore, comment } = draft;
    const changeSet = {
      requestType: 'battle', changes: [],
      battleName: battleName.trim(), battleDate, lore: lore.trim(), comment: comment.trim(),
      ...contest,
    };
    const invalid = validateBattle(changeSet, access.teams, map.tiles, { recordedLocation });
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!approved && !validOverrides) {
      setError('Enter valid whole-number reward amounts for each participating team.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(changeSet, record, canChooseEquipment ? equipment : undefined, approved ? undefined : rewardOverrides);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={styles.card} onSubmit={submit}>
      <h2 style={styles.subheading}>{record ? 'Edit battle report' : 'Log a battle'}</h2>
      {!record && <p style={styles.note}>Either side can submit. The report publishes when the other Expedition participants confirm it or an Admin approves it.</p>}
      {approved && <p style={styles.note}>Rewards and equipment usage are recorded at approval.</p>}
      {!approved && record?.review?.confirmedTeams.length > 0 && <p style={styles.note}>Saving changes resets the player confirmations.</p>}
      <fieldset disabled={busy} style={{ ...styles.stack, border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div style={styles.stack}>
          {access.canReview && (
            <SelectField label="Reporting team" options={access.teams.map(team => [team, teamLabel(team)])}
              value={draft.requesterTeam} onChange={requesterTeam => {
                setEquipment([]);
                setOverrides({});
                set({ requesterTeam, battleOpponent: '', battleOpponents: [], battleLocation: '', battleOutcome: '', scores: {} });
              }} />
          )}
          <div style={pairedFields}>
            <label style={styles.label}>
              Name Battle
              <input type="text" value={draft.battleName} onChange={event => set({ battleName: event.target.value })} style={styles.field} />
            </label>
            <label style={styles.label}>
              Battle date
              <input type="date" value={draft.battleDate} onChange={event => set({ battleDate: event.target.value })}
                style={{ ...styles.field, colorScheme: 'dark' }} />
            </label>
          </div>
          <div style={pairedFields}>
            <SelectField label="Battle type" options={Object.entries(battleTypes)} value={draft.battleType}
              onChange={battleType => {
                setOverrides({});
                set({ ...emptyBattleChoices, battleType });
              }} />
            {multiplayer ? (
              <CheckGroup title="Opponents (2–3)" choices={opponents} selected={draft.battleOpponents} limit={3}
                disabled={!draft.requesterTeam} hint={!draft.requesterTeam ? 'Select the reporting team.' : undefined}
                onChange={battleOpponents => set({ battleOpponents, battleLocation: '' })} />
            ) : (
              <SelectField label={joint ? 'Teammate' : 'Opponent'} options={opponents.map(team => [team, teamLabel(team)])}
                disabled={!draft.battleType || !draft.requesterTeam}
                value={draft.battleOpponent} onChange={battleOpponent => set({ battleOpponent, battleLocation: '' })} />
            )}
          </div>
          {compound && (
            <SelectField label="Reporting team’s role" options={[[ 'attacker', 'Attacker' ], [ 'defender', 'Defender' ]]}
              value={draft.battleSide} onChange={battleSide => set({ battleSide, battleLocation: '' })} />
          )}
          <div style={pairedFields}>
            <SelectField label="Battle tile" options={locationOptions} markers={tileTeams(selectedTile)}
              disabled={!locations.length}
              placeholder={locations.length ? undefined : canChooseTile ? 'No eligible tiles' : 'Select participants and any required role first'}
              value={draft.battleLocation} onChange={battleLocation => set({ battleLocation })} />
            {joint ? (
              <JointOutcomeField value={draft.battleOutcome} disabled={!draft.requesterTeam || !hasOpponents}
                onChange={battleOutcome => set({ battleOutcome })} />
            ) : (
              <fieldset disabled={!draft.battleType || !draft.requesterTeam || !hasOpponents} style={{ ...styles.card, margin: 0 }}>
                <legend>Scores</legend>
                {participants.map(team => (
                  <label key={team} style={styles.label}>
                    {teamLabel(team)} score
                    <input type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required={!useRecordedOutcome}
                      value={scores[team]} style={styles.field}
                      onChange={event => set({ scores: { ...draft.scores, [team]: event.target.value === '' ? '' : Number(event.target.value) } })} />
                  </label>
                ))}
                {useRecordedOutcome && <p style={styles.note}>Leave scores blank to keep the recorded outcome.</p>}
              </fieldset>
            )}
          </div>
        </div>
        {canChooseEquipment && draft.requesterTeam && (
          <BattleEquipmentPicker inventory={inventory} selected={equipment} onChange={setEquipment} />
        )}
        <label style={styles.label}>
          Lore
          <textarea value={draft.lore} onChange={event => set({ lore: event.target.value })} rows={4} style={styles.field} />
        </label>
        <label style={styles.label}>
          Notes
          <textarea value={draft.comment} onChange={event => set({ comment: event.target.value })} rows={3} style={styles.field} />
        </label>
        {!approved && (
          <fieldset style={{ ...styles.card, margin: 0 }}>
            <legend>Projected rewards</legend>
            {rewardRows.length > 0 ? (
              <>
                <label style={styles.row}>
                  <input type="checkbox" checked={overrideEnabled} onChange={event => {
                    setOverrideEnabled(event.target.checked);
                    if (!event.target.checked) setOverrides({});
                  }} />
                  Override rewards
                </label>
                <BattleRewardTable rows={rewardRows} overrides={rewardOverrides} onOverride={overrideEnabled ? changeReward : undefined} />
                {overrideEnabled && <p style={styles.note}>Manual reward amounts require Expedition Admin approval.</p>}
              </>
            ) : <p style={styles.note}>{joint ? 'Choose the Joint Op outcome to calculate rewards.' : 'Enter all participant scores to calculate rewards.'}</p>}
          </fieldset>
        )}
        <div style={styles.row}>
          <button type="submit" disabled={!inventory.ready} style={styles.button}>{record ? 'Save battle report' : 'Submit for review'}</button>
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
      <fieldset disabled={busy} style={{ ...styles.stack, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {battleGroups.map(([title, rows]) => (
          <fieldset key={title} style={{ ...styles.card, margin: 0 }}>
            <legend>{title}</legend>
            <table style={{ width: '100%', tableLayout: 'fixed', textAlign: 'left', borderSpacing: '6px' }}>
              <thead><tr><th scope="col">Outcome</th><th scope="col">Campaign Points</th><th scope="col">Supply Points</th></tr></thead>
              <tbody>
                {rows.map(({ label, fields }) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {fields.map(([key, points, , max]) => (
                      <td key={key}>
                        <input aria-label={`${title} ${label} ${points}`} type="number" min="0"
                          max={max ?? Number.MAX_SAFE_INTEGER} step="1" required value={values[key]}
                          onChange={event => setValues({ ...values, [key]: event.target.value })} style={styles.field} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </fieldset>
        ))}
      </fieldset>
      <p style={styles.note}>Compound Op rewards are pending.</p>
      <div><button type="submit" disabled={busy} style={styles.button}>Save battle settings</button></div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.text}</p>}
    </form>
  );
}

function BattleRecord({ record, access, reviewing, onReview, onEdit }) {
  const battle = record.changeSet;
  const battleDetails = `${battleTypeLabel(record)} · ${battle.battleLocation ? `Tile ${battle.battleLocation}` : 'Tile unrecorded'}`;
  const { winners, result, tied } = battleOutcome(battle);
  const outcomeLabel = tied?.length ? `Draw · ${tied.map(teamLabel).join(', ')} tied for first`
    : winners.length ? `${winners.map(teamLabel).join(', ')} won${result ? ` (${result})` : ''}` : result;
  const pending = record.status === 'pending';
  const own = record.own;
  const review = record.review;
  const [equipment, setEquipment] = useState([]);
  const inventory = useBattleEquipment(review?.canConfirm ? access.team : '');
  const equipmentUsed = record.equipmentUsed?.filter(use => use.items.length) ?? [];
  const awaiting = review?.requiredTeams.filter(team => !review.confirmedTeams.includes(team)) ?? [];
  const date = value => new Date(value).toLocaleString();
  return (
    <article style={styles.card}>
      <div style={{ ...styles.row, justifyContent: 'space-between' }}>
        <h3 style={{ ...styles.subheading, overflowWrap: 'anywhere' }}>{battle.battleName || battleDetails}</h3>
        <strong>{statusLabels[record.status] || record.status}</strong>
      </div>
      {battle.battleName && <p style={styles.note}>{battleDetails}</p>}
      <dl style={styles.details}>
        <div><dt style={{ display: 'inline' }}>Logged in round </dt><dd style={{ display: 'inline', margin: 0 }}>
          {battleSubmissionRound(battle) ?? 'Unrecorded'}
        </dd></div>
        {battle.battleDate && (
          <div>
            <dt style={{ display: 'inline' }}>Battle date </dt>
            <dd style={{ display: 'inline', margin: 0 }}>
              <time dateTime={battle.battleDate}>
                {new Date(battle.battleDate).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })}
              </time>
            </dd>
          </div>
        )}
        <div><dt style={{ display: 'inline' }}>Teams </dt><dd style={{ display: 'inline', margin: 0 }}>{battleParticipants(battle).map(teamLabel).join(', ')}</dd></div>
        {battle.battleScores && (
          <div><dt style={{ display: 'inline' }}>Scores </dt><dd style={{ display: 'inline', margin: 0 }}>
            {battleParticipants(battle).map(team => `${teamLabel(team)} ${battle.battleScores[team]}`).join(' · ')}
          </dd></div>
        )}
        <div><dt style={{ display: 'inline' }}>Outcome </dt><dd style={{ display: 'inline', margin: 0 }}>{outcomeLabel}</dd></div>
        {battle.battleSide && <div><dt style={{ display: 'inline' }}>Reporting role </dt><dd style={{ display: 'inline', margin: 0 }}>{teamLabel(battle.requesterTeam)} ({battle.battleSide})</dd></div>}
      </dl>
      <p style={styles.note}>
        Logged by {record.requesterUsername || 'Unknown'}{record.createdAt ? ` · ${date(record.createdAt)}` : ''}
      </p>
      {record.reviewedAt && <p style={styles.note}>{statusLabels[record.status]} {date(record.reviewedAt)}
        {record.approvalMethod === 'participants' ? ' by participant confirmation'
          : record.reviewedByUsername ? ` by ${record.reviewedByUsername}` : ''}</p>}
      {battle.lore && <div><strong>Lore</strong><p style={styles.prose}>{battle.lore}</p></div>}
      {battle.comment && <p style={styles.prose}>{battle.comment}</p>}
      {equipmentUsed.length > 0 && (
        <div style={styles.stack}>
          <strong>Equipment used</strong>
          {equipmentUsed.map(({ source, team, player, items }) => (
            <p key={`${source}:${team}`} style={styles.note}>
              {player} ({teamLabel(team)}) · {items.map(item => `${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ')}
            </p>
          ))}
        </div>
      )}
      {record.awardedPoints?.length > 0 && (
        <p style={styles.note}>{record.awardedPoints.map(({ team, amount, field }) => `${teamLabel(team)} +${amount} ${battleRewardFields[field].label}`).join(' · ')}</p>
      )}
      {pending && (
        <div style={styles.stack}>
          {record.projectedRewards?.length > 0 && <BattleRewardTable rows={record.projectedRewards} />}
          {review?.requiresAdminApproval && <p style={styles.note}>Reward overrides require Expedition Admin approval.</p>}
          {review?.confirmedTeams.length > 0 && <p style={styles.note}>Confirmed by {review.confirmedTeams.map(teamLabel).join(', ')}</p>}
          <p style={styles.note}>{awaiting.length ? `Waiting for ${awaiting.map(teamLabel).join(', ')} to confirm.`
            : 'No participant confirmations required.'}</p>
        </div>
      )}
      {review?.canConfirm && (
        <BattleEquipmentPicker inventory={inventory} selected={equipment} onChange={setEquipment} disabled={reviewing} />
      )}
      {(review?.canEdit || (pending && (own || access.canReview || review?.canConfirm))) && (
        <div style={styles.row}>
          {review?.canConfirm && <button type="button" disabled={reviewing || !inventory.ready}
            onClick={() => onReview('confirm', equipment)} style={styles.button}>Confirm report</button>}
          {review?.canEdit && <button type="button" disabled={reviewing} onClick={onEdit} style={styles.button}>Edit</button>}
          {pending && access.canReview && (
            <>
              <button type="button" disabled={reviewing || !review?.canApprove} onClick={() => onReview('accept')}
                title="Approve without waiting for participant confirmations" style={styles.button}>Approve as Admin</button>
              <button type="button" disabled={reviewing} onClick={() => onReview('deny')} style={styles.button}>Deny</button>
            </>
          )}
          {pending && own && <button type="button" disabled={reviewing} onClick={() => onReview('cancel-own')} style={styles.button}>Cancel report</button>}
        </div>
      )}
    </article>
  );
}

function entryColors(battle, participants) {
  const { winners, result, tied } = battleOutcome(battle);
  const leaders = tied?.length ? tied : result === 'Draw' ? participants : winners;
  const colors = leaders.map(team => teamMarkerColors[team] ?? '#888');
  if (colors.length <= 1) return colors[0] || '#666';
  const stops = colors.map((color, index) => `${color} ${100 * index / colors.length}% ${100 * (index + 1) / colors.length}%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function battleQuery(query, changes) {
  const next = new URLSearchParams(query);
  for (const [key, value] of Object.entries(changes)) {
    next.delete(key);
    const values = Array.isArray(value) ? value : [value];
    values.filter(Boolean).forEach(item => next.append(key, item));
  }
  return next;
}

function BattleFilterGroup({ title, choices, selected, onChange }) {
  return (
    <fieldset style={{ ...styles.stack, margin: 0, padding: '8px', border: '1px solid #666', borderRadius: '5px' }}>
      <legend>{title}</legend>
      {choices.map(([key, label]) => (
        <label key={key} style={{ ...styles.row, gap: '6px' }}>
          <input type="checkbox" checked={selected.includes(key)}
            onChange={event => onChange(event.target.checked ? [...selected, key] : selected.filter(value => value !== key))} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function BattleLog({ pending, records, teams, query, updateQuery, selectedId, onSelect, onRefresh }) {
  const filterDialog = useRef(null);
  const search = query.get('q') || '';
  const sortValue = query.get('sort');
  const sortBy = Object.values(battleSortOptions.name).includes(sortValue) ? 'name' : 'date';
  const direction = sortValue === battleSortOptions[sortBy].ascending ? 'ascending' : 'descending';
  const nextDirection = direction === 'ascending' ? 'descending' : 'ascending';
  const nextSortBy = sortBy === 'name' ? 'date' : 'name';
  const directionLabel = `Sort order is ${direction}. Switch to ${nextDirection}.`;
  const sortByLabel = `Sorting by ${sortBy}. Switch to ${nextSortBy}.`;
  const types = Object.entries(battleTypes);
  const entries = records.map(record => ({ record, participants: battleParticipants(record.changeSet) }));
  const playerChoices = [...new Set([...teams, ...entries.flatMap(entry => entry.participants)])].map(team => [team, teamLabel(team)]);
  const typeFilters = query.getAll('type').filter(type => Object.hasOwn(battleTypes, type));
  const playerFilters = query.getAll('player').filter(player => playerChoices.some(([key]) => player === key));
  const filterCount = typeFilters.length + playerFilters.length;
  const filterLabel = filterCount ? `Filter battles (${filterCount} active)` : 'Filter battles';
  const refreshLabel = pending ? 'Refresh pending reviews' : 'Refresh battle log';
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = entries.filter(({ record, participants }) => {
    if (typeFilters.length && !typeFilters.includes(record.changeSet.battleType)) return false;
    if (playerFilters.length && !participants.some(team => playerFilters.includes(team))) return false;
    const searchable = [battleName(record), battleTypeLabel(record), ...participants.map(teamLabel), record.requesterUsername]
      .join(' ').toLowerCase();
    return searchTerms.every(term => searchable.includes(term));
  });
  visible.sort(({ record: first }, { record: second }) => {
    const byName = battleName(first).localeCompare(battleName(second), undefined, { sensitivity: 'base', numeric: true });
    const byDate = battleDate(first).localeCompare(battleDate(second));
    const order = direction === 'ascending' ? 1 : -1;
    return sortBy === 'name' ? order * byName || -byDate : order * byDate || byName;
  });

  return (
    <aside aria-label={pending ? 'Pending reviews' : 'Battle log'} style={{ ...styles.card, ...styles.sidebar }}>
      <h2 style={styles.subheading}>{pending ? 'Pending Reviews' : 'Battle Log'}</h2>
      <label style={styles.label}>
        Search battles
        <input type="search" value={search} onChange={event => updateQuery({ q: event.target.value })} style={styles.field} />
      </label>
      <div role="group" aria-label="Battle log controls" style={{ ...styles.row, flexWrap: 'nowrap', gap: '8px' }}>
        <button type="button" style={sortButton} aria-label={directionLabel} title={directionLabel}
          onClick={() => updateQuery({ sort: battleSortOptions[sortBy][nextDirection] })}>
          <span aria-hidden="true">{direction === 'ascending' ? '↑' : '↓'}</span>
        </button>
        <button type="button" style={sortButton} aria-label={sortByLabel} title={sortByLabel}
          onClick={() => updateQuery({ sort: battleSortOptions[nextSortBy][direction] })}>
          {sortBy === 'name' ? <span aria-hidden="true">A</span> : <span aria-hidden="true" style={clockFace}><span style={clockHands} /></span>}
        </button>
        <button type="button" aria-haspopup="dialog" aria-controls="battle-filters" aria-label={filterLabel} title={filterLabel}
          style={{ ...sortButton, position: 'relative' }} onClick={() => filterDialog.current.showModal()}>
          <span aria-hidden="true" style={filterIcon} />
          {filterCount > 0 && <span aria-hidden="true" style={filterBadge}>{filterCount}</span>}
        </button>
        <button type="button" style={sortButton} aria-label={refreshLabel} title={refreshLabel} onClick={onRefresh}>
          <span aria-hidden="true">↻</span>
        </button>
      </div>
      <dialog id="battle-filters" ref={filterDialog} aria-labelledby="battle-filters-title" style={styles.filterDialog}>
        <div style={styles.stack}>
          <h2 id="battle-filters-title" style={styles.subheading}>Filter battles</h2>
          <div style={pairedFields}>
            <BattleFilterGroup title="Battle types" choices={types} selected={typeFilters} onChange={type => updateQuery({ type })} />
            <BattleFilterGroup title="Participants" choices={playerChoices} selected={playerFilters} onChange={player => updateQuery({ player })} />
          </div>
          <div style={{ ...styles.row, justifyContent: 'flex-end' }}>
            <button type="button" style={styles.button} disabled={filterCount === 0}
              onClick={() => updateQuery({ type: [], player: [] })}>Clear filters</button>
            <button type="button" style={styles.button} onClick={() => filterDialog.current.close()}>Done</button>
          </div>
        </div>
      </dialog>
      {visible.length ? (
        <nav aria-label="Battle reports" style={styles.reportList}>
          <ul style={styles.entries}>
            {visible.map(({ record, participants }) => {
              const next = battleQuery(query, { battle: record.id });
              const color = entryColors(record.changeSet, participants);
              const selected = record.id === selectedId;
              return (
                <li key={record.id}>
                  <Link to={{ pathname: battlePath, search: `?${next}` }} onClick={onSelect}
                    aria-current={selected ? 'true' : undefined}
                    style={{ ...styles.entry, borderColor: selected ? '#eee' : '#666',
                      background: `linear-gradient(#161616cc, #161616cc), ${color}` }}>
                    <span aria-hidden="true" style={{ height: '4px', borderRadius: '3px', background: color, boxShadow: '0 0 0 1px #ffffff40' }} />
                    <strong>{battleName(record)}</strong>
                    <span>{battleTypeLabel(record)}</span>
                    <span style={styles.note}>{participants.map(teamLabel).join(', ')}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : <p role="status" style={styles.note}>{entries.length ? 'No battles match your search and filters.'
        : pending ? 'No reports awaiting review.' : 'No approved battles yet.'}</p>}
    </aside>
  );
}

const loadBattles = async () => {
  const [access, map] = await Promise.all([request('/battles'), request('/map')]);
  return { access, map };
};

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
  const [query, setQuery] = useSearchParams();
  const [data, setData] = useState(null);
  const [editor, setEditor] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const pendingView = query.get('view') === 'review';
  const selectedId = query.get('battle');
  const records = pendingView ? data?.access.pendingBattles : data?.access.battles;
  const selectedBattle = records?.find(record => record.id === selectedId);
  const activeEditor = editor?.selectedId === selectedId ? editor : null;
  const queryString = query.toString();
  const search = queryString ? `?${queryString}` : '';

  function updateQuery(changes, replace = true) {
    setQuery(current => battleQuery(current, changes), { replace });
  }

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
    loadBattles().then(
      result => { if (!canceled) setData(result); },
      error => { if (!canceled) setLoadError(error.message); },
    );
    return () => { canceled = true; };
  }, [reload, settings]);

  function updateRecord(record) {
    const updatedRecords = (records, status) => {
      const remaining = records.filter(item => item.id !== record.id);
      return record.status === status ? [record, ...remaining] : remaining;
    };
    setData(current => current && ({
      ...current,
      access: {
        ...current.access,
        battles: updatedRecords(current.access.battles, 'accepted'),
        pendingBattles: updatedRecords(current.access.pendingBattles, 'pending'),
      },
    }));
  }

  async function saveBattle(changeSet, record, equipment, rewardOverrides) {
    const response = await request(record ? '/map-requests/update' : '/map-requests', {
      changeSet, equipment, rewardOverrides, ...(record ? { requestId: record.id, expectedRevision: record.revision } : {}),
    });
    updateRecord(response.request);
    const needsReview = response.request.status === 'pending';
    if (pendingView !== needsReview || response.request.id !== selectedId) {
      updateQuery({ view: needsReview ? 'review' : '', battle: response.request.id }, false);
    }
    setEditor(null);
    setFeedback({ text: record ? 'Battle report updated.' : needsReview ? 'Battle report submitted for review.' : 'Battle added to the log.' });
  }

  async function review(action, record, equipment) {
    setReviewing(true);
    setFeedback(null);
    try {
      const response = await request(`/map-requests/${action}`, { requestId: record.id, expectedRevision: record.revision, equipment });
      updateRecord(response.request);
      if (response.request.status === 'accepted') updateQuery({ view: '', battle: record.id });
      else if (action !== 'confirm') updateQuery({ battle: '' });
      setFeedback({ text: {
        accept: 'Battle approved and added to the log.',
        confirm: response.request.status === 'accepted' ? 'All participants confirmed. Battle added to the log.' : response.message,
        deny: 'Battle denied.', 'cancel-own': 'Battle report canceled.',
      }[action] });
    } catch (error) {
      setFeedback({ text: error.message, error: true });
    } finally {
      setReviewing(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={{ ...styles.layout, maxWidth: settings ? styles.layout.maxWidth : '1200px' }}>
        <header style={{ ...styles.row, justifyContent: 'space-between' }}>
          <Link to="/projects/Expedition" style={styles.link}>← Expedition</Link>
          {data?.access.canReview && (
            <Link to={{ pathname: `${battlePath}/settings`, search }} aria-current={settings ? 'page' : undefined} style={settings ? activeNavButton : navButton}>Settings</Link>
          )}
        </header>
        <h1 style={styles.heading}>Battles</h1>
        {settings ? <div><Link to={{ pathname: battlePath, search }} style={navButton}>← Battles</Link></div>
          : data && (data.access.canLog || data.access.pendingBattles.length > 0) && (
            <nav aria-label="Battle views" style={styles.row}>
              <Link to={{ pathname: battlePath, search: `?${battleQuery(query, { view: '', battle: '' })}` }}
                style={pendingView ? navButton : activeNavButton} aria-current={pendingView ? undefined : 'page'}>Battle Log</Link>
              <Link to={{ pathname: battlePath, search: `?${battleQuery(query, { view: 'review', battle: '' })}` }}
                style={pendingView ? activeNavButton : navButton} aria-current={pendingView ? 'page' : undefined}>
                Pending Reviews ({data.access.pendingBattles.length})
              </Link>
            </nav>
          )}
        {loadError ? (
          <div style={styles.card}>
            <p role="alert" style={styles.error}>{loadError}</p>
            <div><button type="button" onClick={() => setReload(value => value + 1)} style={styles.button}>Retry</button></div>
          </div>
        ) : !data ? <p role="status" style={styles.note}>Loading battles…</p>
          : settings ? (
            data.access.canReview ? <BattleSettings initial={data.map.pointRewards} /> : <p style={styles.note}>Battle settings are available to Expedition admins and owners.</p>
          ) : (
            <div style={styles.log}>
              <BattleLog pending={pendingView} records={records} teams={data.access.teams} query={query} updateQuery={updateQuery}
                selectedId={selectedId} onSelect={() => { setEditor(null); setFeedback(null); }}
                onRefresh={() => setReload(value => value + 1)} />
              <section aria-label="Battle report" style={{ ...styles.stack, ...styles.report }}>
                {data.access.canLog && (
                  <div><button type="button" onClick={() => { setFeedback(null); setEditor({ selectedId, record: null }); }}
                    style={styles.button}>Log a battle</button></div>
                )}
                {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.text}</p>}
                {activeEditor ? (
                  <BattleForm key={activeEditor.record?.id || 'new'} data={data} record={activeEditor.record}
                    onSave={saveBattle} onClose={() => setEditor(null)} />
                ) : selectedBattle ? (
                  <BattleRecord key={`${selectedBattle.id}:${selectedBattle.revision}`} record={selectedBattle} access={data.access} reviewing={reviewing}
                    onEdit={() => setEditor({ selectedId, record: selectedBattle })} onReview={(action, equipment) => review(action, selectedBattle, equipment)} />
                ) : (
                  <p style={{ ...styles.card, margin: 0 }}>
                    {selectedId ? 'This battle report is unavailable.' : 'Select a battle to view its report.'}
                  </p>
                )}
              </section>
            </div>
          )}
      </div>
    </main>
  );
}
