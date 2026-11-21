import { useEffect, useId, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import { unitStatFields } from './unit-stats.mjs';
import { weaponLimits, weaponTypes } from './weapon-profiles.mjs';
import { getActionEffects, unitRuleLimits } from './unit-rules.mjs';
import { prepareUnitImage, unitImageTypes } from './unit-images.mjs';
import { orderedUnitEntries, unitMoveTarget } from './unit-order.mjs';
import { getBountyProgress, loadBounties } from './ExpeditionBounties.jsx';

const profileHeaderBackground = '#91421f';

const styles = {
  page: { minHeight: '100%', padding: 'clamp(16px, 4vw, 48px)', background: 'radial-gradient(ellipse at top, var(--team-tint), #1e1e1e 65%)', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  layout: { width: '100%', maxWidth: '880px', margin: '0 auto', display: 'grid', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '16px' },
  headerControls: { display: 'flex', alignItems: 'end', gap: '8px', marginLeft: 'auto', minWidth: 0, maxWidth: '100%' },
  pencil: { display: 'grid', placeItems: 'center', width: '40px', height: '40px', padding: 0, flexShrink: 0, fontSize: '1.3rem', cursor: 'pointer' },
  title: { margin: '12px 0 0', color: 'var(--team-accent)', font: '700 clamp(1.65rem, 4vw, 2.25rem) system-ui, sans-serif', overflowWrap: 'anywhere' },
  teamColor: { margin: '4px 0 0', color: '#ddd', fontSize: '0.9rem' },
  teamNameForm: { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: '8px', marginTop: '10px', width: 'min(420px, 100%)' },
  link: { color: '#ddd', textUnderlineOffset: '3px' },
  card: { display: 'grid', alignContent: 'start', gap: '14px', minWidth: 0, padding: '18px', border: '1px solid #444', borderTopColor: 'var(--team-accent)', borderRadius: '8px', background: 'linear-gradient(145deg, var(--team-tint), #252525 85%)' },
  heading: { margin: 0, fontSize: '1.1rem' },
  label: { display: 'grid', gap: '5px', fontSize: '0.875rem' },
  form: { display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: '10px' },
  field: { color: '#fff', background: '#191919', border: '1px solid #666', borderRadius: '6px', font: 'inherit', padding: '8px 10px', width: '100%' },
  button: { color: '#fff', background: '#353535', border: '1px solid #666', borderRadius: '6px', font: 'inherit', padding: '8px 12px' },
  note: { color: '#ccc', margin: 0 },
  error: { color: '#ffb5a7', margin: 0 },
  balances: { display: 'flex', flexWrap: 'wrap', gap: '28px', margin: 0 },
  balance: { fontSize: '1.35rem', fontWeight: 700, margin: '4px 0 0', overflowWrap: 'anywhere' },
  balanceActions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' },
  teamOverview: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(310px, 100%), 1fr))', gap: '16px' },
  loreForm: { display: 'grid', gap: '10px', alignItems: 'start' },
  locationList: { display: 'grid', gap: '8px', margin: 0 },
  locationRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: '8px', fontSize: '0.875rem' },
  locationValue: { margin: 0, fontWeight: 600, overflowWrap: 'anywhere' },
  mapLink: { justifySelf: 'start', textDecoration: 'none', background: 'var(--team-accent)', color: '#171717', fontWeight: 700 },
  rosterList: { display: 'grid', gap: '8px', listStyle: 'none', padding: 0, margin: 0 },
  rosterEntry: { padding: '8px 10px', border: '1px solid #555', borderRadius: '6px', background: '#242424', overflowWrap: 'anywhere' },
  unitCard: { minWidth: 0, border: '1px solid #444', borderRadius: '6px', overflow: 'hidden' },
  unitHeader: { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', width: '100%', padding: 0, border: 0, borderRadius: 0, background: profileHeaderBackground, color: 'inherit', textAlign: 'left', font: 'inherit', cursor: 'pointer' },
  unitName: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 100px', minWidth: 0, padding: '10px', overflowWrap: 'anywhere' },
  unitDisclosure: { flexShrink: 0, color: 'var(--team-accent)' },
  sectionToggle: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: 0, border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' },
  sectionBody: { display: 'grid', gap: '14px', minWidth: 0 },
  unitProfile: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', flex: '1 1 176px', minWidth: 0, margin: 0 },
  statCell: { display: 'grid', alignContent: 'start', gap: '3px', padding: '7px 2px', borderInlineStart: '1px solid #444', textAlign: 'center', overflowWrap: 'anywhere' },
  statLabel: { color: '#ccc', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' },
  unitFields: { display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '8px', width: '100%' },
  unitNameField: { flex: '1 1 170px', minWidth: 0 },
  unitStatFields: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', flex: '1 1 280px', minWidth: 0, gap: '8px' },
  statValue: { margin: 0, color: '#fff', fontWeight: 600 },
  unitImage: { display: 'block', width: '100%', height: 'auto', maxHeight: '360px', objectFit: 'contain', background: '#191919', borderTop: '1px solid #444' },
  weaponsTableScroll: { overflowX: 'auto', borderTop: '1px solid #444' },
  weaponsTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  weaponCell: { padding: '7px 9px', textAlign: 'left', verticalAlign: 'top' },
  weaponEditor: { padding: '10px', borderTop: '1px solid #444' },
  cardEditorForm: { display: 'grid', gap: '10px', marginTop: '12px' },
  weaponEntryScroll: { overflowX: 'auto', padding: '2px 2px 4px' },
  weaponEntryRow: {
    display: 'grid',
    gridTemplateColumns: '100px minmax(125px, 2fr) 56px 56px 62px minmax(130px, 3fr) auto',
    alignItems: 'end',
    gap: '6px',
    minWidth: '680px',
  },
  weaponField: { minWidth: 0, height: '36px', padding: '6px', boxSizing: 'border-box' },
  weaponSave: { height: '36px', padding: '6px 10px', whiteSpace: 'nowrap' },
  rulesSection: { display: 'grid', gap: '8px', borderTop: '1px solid #444', padding: '10px' },
  rulesHeading: { margin: 0, fontSize: '0.9rem' },
  ruleSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  ruleIcon: { display: 'inline-grid', placeItems: 'center', minWidth: '32px', minHeight: '30px', padding: '2px 6px', fontSize: '1rem' },
  ruleText: { margin: 0, color: '#eee', fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  action: { border: '1px solid #555', borderRadius: '4px', overflow: 'hidden' },
  actionHeader: { display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 9px', background: profileHeaderBackground, fontSize: '0.85rem' },
  actionName: { overflowWrap: 'anywhere', minWidth: 0, textTransform: 'uppercase' },
  actionCost: { whiteSpace: 'nowrap' },
  actionBody: { display: 'grid', gap: '6px', padding: '8px 9px' },
  actionLine: { display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr)', gap: '5px', alignItems: 'baseline' },
  ruleEditor: { marginTop: '2px' },
  ruleFields: { display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: '8px' },
  effectFields: { display: 'grid', gap: '8px' },
  effectEditor: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'end', gap: '8px' },
  apField: { width: '80px' },
  rowEdit: { padding: '4px 8px', fontSize: '0.8rem', whiteSpace: 'nowrap' },
  orderControls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' },
};

const ruleTextarea = { ...styles.field, resize: 'none' };
const teamColorLabel = color => `${color[0].toUpperCase()}${color.slice(1)}`;
const teamName = team => team.displayName || `${teamColorLabel(team.name)} Team`;
const teamOptionLabel = team => team.displayName ? `${team.displayName} (${teamColorLabel(team.name)})` : teamName(team);
const teamThemes = {
  red: ['#ff8080', '#472628'],
  blue: ['#83baff', '#22374f'],
  green: ['#92dc98', '#233e2d'],
  yellow: ['#f3d35b', '#473c22'],
  purple: ['#cea2ff', '#38284e'],
  white: ['#f5f5f5', '#41444a'],
  black: ['#b8c0cb', '#12151a'],
};
const locationFields = [['bases', 'Base Location'], ['camps', 'Camp Location'], ['positions', 'Team Location']];
const balanceFields = [
  ['supplyPoints', 'Supply Points', 10],
  ['campaignPoints', 'Campaign Points', Number.MAX_SAFE_INTEGER],
  ['credits', 'Credits', Number.MAX_SAFE_INTEGER],
];
const weaponColumns = ['Type', 'Name', 'ATK', 'HIT', 'DMG', 'WR'];

function updateTeam(team, category, data, method = 'POST') {
  return fetchJson(`/expedition/teams/${team}/${category}`, {
    method,
    body: JSON.stringify(data),
  });
}

function UnitImage({ team, unit, editing, onSave }) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const action = unit.image ? 'Replace image' : 'Upload image';

  async function uploadImage(event) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const file = form.elements.namedItem('image').files[0];
    setSaving(true);
    setFeedback(null);
    try {
      const image = await prepareUnitImage(file);
      const { response, payload } = await updateTeam(team.name, 'unit-image', { unitId: unit.id, image });
      if (!response.ok) throw new Error(payload.message || 'Unable to save the unit image.');
      onSave(payload.image);
      form.reset();
      setFeedback({ message: 'Unit image saved.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {unit.image && <img src={unit.image} alt={`${unit.name} unit image`} loading="lazy" style={styles.unitImage} />}
      {team.canUploadUnitImages && (
        <details style={styles.weaponEditor} hidden={!editing}>
          <summary style={{ width: 'fit-content', cursor: 'pointer' }} aria-label={`${action} for ${unit.name}`}>{action}</summary>
          <form style={styles.cardEditorForm} onSubmit={uploadImage}>
            <label style={styles.label}>
              Image file
              <input name="image" type="file" accept={unitImageTypes.join(',')} required disabled={saving} style={styles.field} />
            </label>
            <div><button type="submit" disabled={saving} style={styles.button}>{saving ? 'Saving image…' : 'Save image'}</button></div>
            {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
          </form>
        </details>
      )}
    </>
  );
}

function WeaponEditor({ teamName, unitId, entry, onSave, onCancel }) {
  const [type, setType] = useState(entry?.type ?? 'ranged');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function saveWeapon(event) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const weapon = {
      type, name: data.get('name'), dmg: data.get('dmg'), wr: data.get('wr'),
      atk: form.elements.namedItem('atk').valueAsNumber,
      hit: form.elements.namedItem('hit').valueAsNumber,
    };
    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(teamName, 'weapons', {
        unitId, weapon, ...(entry ? { entryId: entry.id } : {}),
      }, entry ? 'PATCH' : 'POST');
      if (!response.ok) throw new Error(payload.message || 'Unable to save the weapon.');
      onSave(payload.weapon);
      if (!entry) form.reset();
      setFeedback({ message: payload.message || 'Weapon saved.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form style={styles.cardEditorForm} onSubmit={saveWeapon} aria-label={entry ? `Edit ${entry.name}` : undefined}>
      <div style={styles.weaponEntryScroll}>
        <div style={styles.weaponEntryRow}>
          <label style={styles.label}>
            Type
            <select name="weaponType" value={type} onChange={event => setType(event.target.value)} disabled={saving} style={{ ...styles.field, ...styles.weaponField }}>
              {Object.entries(weaponTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Name
            <input name="name" defaultValue={entry?.name} maxLength={weaponLimits.name} required disabled={saving} style={{ ...styles.field, ...styles.weaponField }} />
          </label>
          <label style={styles.label}>
            ATK
            <input name="atk" defaultValue={entry?.atk} type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required disabled={saving} style={{ ...styles.field, ...styles.weaponField }} />
          </label>
          <label style={styles.label}>
            HIT
            <input name="hit" defaultValue={entry?.hit} type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required disabled={saving} style={{ ...styles.field, ...styles.weaponField }} />
          </label>
          <label style={styles.label}>
            DMG
            <input name="dmg" defaultValue={entry?.dmg} placeholder="3/4" maxLength={weaponLimits.dmg} required disabled={saving} style={{ ...styles.field, ...styles.weaponField }} />
          </label>
          <label style={styles.label}>
            WR
            <input name="wr" defaultValue={entry?.wr} aria-label="WR (optional)" placeholder="-" maxLength={weaponLimits.wr} disabled={saving} style={{ ...styles.field, ...styles.weaponField }} />
          </label>
          <button type="submit" disabled={saving} style={{ ...styles.button, ...styles.weaponSave }}>Save weapon</button>
        </div>
      </div>
      {onCancel && <div><button type="button" onClick={onCancel} disabled={saving} style={styles.rowEdit}>Cancel</button></div>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
    </form>
  );
}

function UnitOrderControls({ collection, entries, index, ordering }) {
  const entry = entries[index];
  return (
    <span style={styles.orderControls}>
      {[[-1, 'up', '↑'], [1, 'down', '↓']].map(([direction, label, arrow]) => (
        <button
          key={direction}
          type="button"
          aria-label={`Move ${entry.name} ${label}`}
          title={`Move ${label}`}
          disabled={unitMoveTarget(collection, entries, index, direction) === -1}
          aria-disabled={ordering.busy || undefined}
          onClick={() => { if (!ordering.busy) ordering.move(collection, entry.id, direction); }}
          style={styles.rowEdit}
        >
          <span aria-hidden="true">{arrow}</span>
        </button>
      ))}
    </span>
  );
}

function UnitWeapons({ team, unit, editing, onSave, ordering }) {
  const [editingId, setEditingId] = useState(null);
  const weapons = orderedUnitEntries('weapons', unit.weapons);
  const entry = weapons.find(weapon => weapon.id === editingId);

  return (
    <>
      {weapons.length > 0 && (
        <div style={styles.weaponsTableScroll}>
          <table aria-label={`${unit.name} weapons`} style={styles.weaponsTable}>
            <thead style={{ background: '#303030' }}>
              <tr>
                {weaponColumns.map(label => <th key={label} scope="col" style={styles.weaponCell}>{label}</th>)}
                {editing && <th scope="col" style={styles.weaponCell}>Controls</th>}
              </tr>
            </thead>
            <tbody>
              {weapons.map((weapon, index) => (
                <tr key={weapon.id} style={{ background: index % 2 ? '#2d2d2d' : '#252525' }}>
                  <td style={styles.weaponCell}>{weaponTypes[weapon.type]}</td>
                  <th scope="row" style={{ ...styles.weaponCell, overflowWrap: 'anywhere' }}>{weapon.name}</th>
                  <td style={styles.weaponCell}>{weapon.atk}</td>
                  <td style={styles.weaponCell}>{weapon.hit}+</td>
                  <td style={styles.weaponCell}>{weapon.dmg}</td>
                  <td style={{ ...styles.weaponCell, width: '42%', overflowWrap: 'anywhere' }}>{weapon.wr || '-'}</td>
                  {editing && (
                    <td style={styles.weaponCell}>
                      <div style={styles.orderControls}>
                        <button type="button" aria-label={`Edit weapon ${weapon.name}`} onClick={() => setEditingId(weapon.id)} style={styles.rowEdit}>Edit</button>
                        <UnitOrderControls collection="weapons" entries={weapons} index={index} ordering={ordering} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entry && (
        <div style={styles.weaponEditor} hidden={!editing}>
          <WeaponEditor key={entry.id} teamName={team.name} unitId={unit.id} entry={entry} onCancel={() => setEditingId(null)}
            onSave={weapon => { onSave(weapon); setEditingId(null); }} />
        </div>
      )}
      {team.canAddEntries && (
        <details style={styles.weaponEditor} hidden={!editing}>
          <summary style={{ width: 'fit-content', cursor: 'pointer' }} aria-label={`Add weapon to ${unit.name}`}>Add weapon</summary>
          <WeaponEditor teamName={team.name} unitId={unit.id} onSave={onSave} />
        </details>
      )}
    </>
  );
}

function RuleIcon({ label, symbol, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} style={{ ...styles.button, ...styles.ruleIcon }} {...props}>
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

function RuleEditor({ teamName, unitId, collection, kind, editing, entry, onSave }) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isAction = kind === 'action';
  const [effects, setEffects] = useState(() => {
    const savedEffects = getActionEffects(entry);
    return savedEffects.length ? savedEffects : [''];
  });

  async function saveRule(event) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get('name');
    const rule = isAction
      ? { name, effects, ap: form.elements.namedItem('ap').valueAsNumber, restriction: data.get('restriction') }
      : { name, description: data.get('description') };

    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(teamName, collection, {
        unitId, [kind]: rule, ...(entry ? { entryId: entry.id } : {}),
      }, entry ? 'PATCH' : 'POST');
      if (!response.ok) throw new Error(payload.message || `Unable to save the ${kind}.`);
      onSave(payload[kind]);
      if (isAction) setEffects(entry ? getActionEffects(payload.action) : ['']);
      if (!entry) form.reset();
      setFeedback({ message: payload.message || 'Saved.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.ruleEditor} hidden={!editing}>
      <form style={styles.cardEditorForm} onSubmit={saveRule}>
        <div style={styles.ruleFields}>
          <label style={{ ...styles.label, ...styles.unitNameField }}>
            Name
            <input name="name" defaultValue={entry?.name} maxLength={unitRuleLimits.name} required disabled={saving} style={styles.field} />
          </label>
          {isAction && (
            <label style={{ ...styles.label, ...styles.apField }}>
              AP
              <input name="ap" defaultValue={entry?.ap} type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required disabled={saving} style={styles.field} />
            </label>
          )}
        </div>
        {isAction ? (
          <>
            <div style={styles.effectFields}>
              {effects.map((effect, index) => (
                <div key={index} style={styles.effectEditor}>
                  <label style={styles.label}>
                    Effect {index + 1}
                    <textarea
                      value={effect}
                      onChange={event => {
                        const value = event.target.value;
                        setEffects(current => current.map((text, position) => position === index ? value : text));
                      }}
                      rows={3}
                      maxLength={unitRuleLimits.text}
                      required
                      disabled={saving}
                      style={ruleTextarea}
                    />
                  </label>
                  {effects.length > 1 && (
                    <RuleIcon label={`Remove effect ${index + 1}`} symbol="−" disabled={saving}
                      onClick={() => setEffects(current => current.filter((_, position) => position !== index))} />
                  )}
                </div>
              ))}
              <div><RuleIcon label="Add effect" symbol="+" disabled={saving} onClick={() => setEffects(current => [...current, ''])} /></div>
            </div>
            <label style={styles.label}>
              Restriction (optional)
              <textarea name="restriction" defaultValue={entry?.restriction} rows={2} maxLength={unitRuleLimits.text} disabled={saving} style={ruleTextarea} />
            </label>
          </>
        ) : (
          <label style={styles.label}>
            Description
            <textarea name="description" defaultValue={entry?.description} rows={3} maxLength={unitRuleLimits.text} required disabled={saving} style={ruleTextarea} />
          </label>
        )}
        <div><button type="submit" disabled={saving} style={styles.button}>Save {kind}</button></div>
        {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
      </form>
    </div>
  );
}

function UnitRules({ team, unit, editing, onSave, onRemove, ordering }) {
  const [openEditors, setOpenEditors] = useState({});
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const toggleEditor = (collection, entryId) => setOpenEditors(current => ({
    ...current, [collection]: current[collection] === entryId ? undefined : entryId,
  }));
  const ruleEditor = (collection, kind, entry) => openEditors[collection] === (entry?.id ?? null) && (
    <RuleEditor key={entry?.id ?? kind} teamName={team.name} unitId={unit.id} collection={collection}
      kind={kind} editing={editing} entry={entry} onSave={rule => onSave(collection, rule, Boolean(entry))} />
  );

  async function removeRule(collection, entry) {
    if (removing || !window.confirm(`Remove “${entry.name}” from ${unit.name}?`)) return;
    setRemoving(true);
    setRemoveError('');
    try {
      const { response, payload } = await updateTeam(team.name, collection, { unitId: unit.id, entryId: entry.id }, 'DELETE');
      if (!response.ok) throw new Error(payload.message || 'Unable to remove this entry.');
      onRemove(collection, entry.id);
      setOpenEditors(current => current[collection] === entry.id ? { ...current, [collection]: undefined } : current);
    } catch (error) {
      setRemoveError(error.message);
    } finally {
      setRemoving(false);
    }
  }

  function sectionHeading(collection, title, kind) {
    return (
      <div style={styles.ruleSectionHeader}>
        <h3 style={styles.rulesHeading}>{title}</h3>
        {editing && <RuleIcon label={`Add ${kind}`} symbol="+" aria-expanded={openEditors[collection] === null}
          onClick={() => toggleEditor(collection, null)} />}
      </div>
    );
  }

  function entryControls(collection, kind, index) {
    const entries = unit[collection];
    const entry = entries[index];
    return (
      <div style={styles.orderControls}>
        <RuleIcon label={`Edit ${kind} ${entry.name}`} symbol="✎" aria-expanded={openEditors[collection] === entry.id}
          onClick={() => toggleEditor(collection, entry.id)} />
        <RuleIcon label={`Remove ${kind} ${entry.name}`} symbol="−" disabled={removing}
          onClick={() => removeRule(collection, entry)} />
        <UnitOrderControls collection={collection} entries={entries} index={index} ordering={ordering} />
      </div>
    );
  }

  return (
    <>
      <section aria-label="Abilities" style={editing || unit.abilities?.length ? styles.rulesSection : { display: 'none' }}>
        {sectionHeading('abilities', 'Abilities', 'ability')}
        {ruleEditor('abilities', 'ability')}
        {unit.abilities?.map((ability, index) => (
          <div key={ability.id}>
            <p style={styles.ruleText}><strong>{ability.name}:</strong> {ability.description}</p>
            {editing && entryControls('abilities', 'ability', index)}
            {ruleEditor('abilities', 'ability', ability)}
          </div>
        ))}
      </section>
      <section aria-label="Actions" style={editing || unit.actions?.length ? styles.rulesSection : { display: 'none' }}>
        {sectionHeading('actions', 'Actions', 'action')}
        {ruleEditor('actions', 'action')}
        {unit.actions?.map((action, index) => (
          <article key={action.id} style={styles.action}>
            <div style={styles.actionHeader}>
              <strong style={styles.actionName}>{action.name}</strong>
              <strong style={styles.actionCost}>{action.ap} AP</strong>
            </div>
            <div style={styles.actionBody}>
              {getActionEffects(action).map((effect, index) => (
                <div key={index} style={styles.actionLine}>
                  <span aria-hidden="true" style={{ color: '#84be95' }}>▸</span>
                  <p style={styles.ruleText}>{effect}</p>
                </div>
              ))}
              {action.restriction && (
                <div style={styles.actionLine}>
                  <span aria-hidden="true" style={{ color: '#e48b7f' }}>◆</span>
                  <p style={styles.ruleText}><strong>Restriction:</strong> {action.restriction}</p>
                </div>
              )}
              {editing && entryControls('actions', 'action', index)}
              {ruleEditor('actions', 'action', action)}
            </div>
          </article>
        ))}
      </section>
      {editing && removeError && <p role="alert" style={{ ...styles.error, padding: '10px' }}>{removeError}</p>}
    </>
  );
}

function UnitProfileEditor({ teamName, unit, editing, onSave }) {
  const [name, setName] = useState(unit?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function saveProfile(event) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    const form = event.currentTarget;
    const stats = Object.fromEntries(unitStatFields.map(({ key }) => [
      key, form.elements.namedItem(key).valueAsNumber,
    ]).filter(([, value]) => !Number.isNaN(value)));
    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(teamName, 'units', {
        name, stats, ...(unit ? { unitId: unit.id } : {}),
      }, unit ? 'PATCH' : 'POST');
      if (!response.ok) throw new Error(payload.message || 'Unable to save the unit.');
      onSave(payload.entry);
      if (!unit) form.reset();
      setName(unit ? payload.entry.name : '');
      setFeedback({ message: unit ? 'Unit saved.' : `${payload.entry.name} added.` });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveProfile} style={editing ? styles.form : { display: 'none' }} hidden={!editing}>
      <div style={styles.unitFields}>
        <label style={{ ...styles.label, ...styles.unitNameField }}>
          Unit name
          <input value={name} onChange={event => setName(event.target.value)} maxLength={100} required disabled={saving} style={styles.field} />
        </label>
        <div style={styles.unitStatFields}>
          {unitStatFields.map(({ key, label, min }) => (
            <label key={key} style={styles.label}>
              {label}
              <input
                name={key}
                type="number"
                min={min}
                max={Number.MAX_SAFE_INTEGER}
                step="1"
                defaultValue={unit?.stats?.[key]}
                aria-label={key === 'move' ? 'Move (inches)' : undefined}
                required={!unit || unit.stats?.[key] != null}
                disabled={saving}
                style={styles.field}
              />
            </label>
          ))}
        </div>
      </div>
      <button type="submit" disabled={saving || !name.trim()} style={styles.button}>{unit ? 'Save unit' : 'Add unit'}</button>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
    </form>
  );
}

function UnitCard({ team, unit, editing, onUpdate, onSaveEntry }) {
  const [expanded, setExpanded] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const detailsId = useId();
  const nameId = `${detailsId}-name`;
  const statsId = `${detailsId}-stats`;

  async function moveEntry(collection, entryId, direction) {
    setReordering(true);
    setOrderError('');
    try {
      const { response, payload } = await updateTeam(team.name, 'unit-order', { unitId: unit.id, collection, entryId, direction });
      if (!response.ok) throw new Error(payload.message || 'Unable to save the new order.');
      const positions = new Map(payload.order.map((id, index) => [id, index]));
      const position = entry => positions.get(entry.id) ?? positions.size;
      onUpdate(current => ({
        ...current,
        [collection]: [...(current[collection] ?? [])].sort((left, right) => position(left) - position(right)),
      }));
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setReordering(false);
    }
  }

  const ordering = { busy: reordering, move: moveEntry };
  return (
    <li style={styles.unitCard}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-labelledby={nameId}
        aria-describedby={expanded ? statsId : undefined}
        onClick={() => setExpanded(current => !current)}
        style={styles.unitHeader}
      >
        <span style={styles.unitName}>
          <span aria-hidden="true" style={styles.unitDisclosure}>{expanded ? '▾' : '▸'}</span>
          <strong id={nameId}>{unit.name}</strong>
        </span>
        {expanded && (
          <span id={statsId} style={styles.unitProfile}>
            {unitStatFields.map(({ key, label, suffix }) => (
              <span key={key} style={styles.statCell}>
                <span style={styles.statLabel}>{label}</span>
                <span style={styles.statValue}>{unit.stats?.[key] == null ? '—' : `${unit.stats[key]}${suffix}`}</span>
              </span>
            ))}
          </span>
        )}
      </button>
      <div id={detailsId} hidden={!expanded}>
        <UnitImage team={team} unit={unit} editing={editing} onSave={image => onUpdate(current => ({ ...current, image }))} />
        {team.canAddEntries && (
          <details style={styles.weaponEditor} hidden={!editing}>
            <summary style={{ width: 'fit-content', cursor: 'pointer' }} aria-label={`Edit unit ${unit.name}`}>Edit unit profile</summary>
            <UnitProfileEditor teamName={team.name} unit={unit} editing={editing}
              onSave={profile => onUpdate(current => ({ ...current, name: profile.name, stats: profile.stats }))} />
          </details>
        )}
        <UnitWeapons team={team} unit={unit} editing={editing} onSave={weapon => onSaveEntry('weapons', weapon)} ordering={ordering} />
        <UnitRules team={team} unit={unit} editing={editing} onSave={onSaveEntry} ordering={ordering}
          onRemove={(collection, entryId) => onUpdate(current => ({
            ...current, [collection]: (current[collection] ?? []).filter(entry => entry.id !== entryId),
          }))} />
        {editing && orderError && <p role="alert" style={{ ...styles.error, padding: '10px' }}>{orderError}</p>}
      </div>
    </li>
  );
}

function TeamUnits({ team, editing, onChange }) {
  function updateUnit(unitId, update) {
    onChange(current => ({ units: current.units.map(unit => unit.id === unitId ? update(unit) : unit) }));
  }

  function saveUnitEntry(unitId, collection, entry, replaceOnly) {
    updateUnit(unitId, unit => {
      const entries = unit[collection] ?? [];
      if (entries.some(item => item.id === entry.id)) {
        return { ...unit, [collection]: entries.map(item => item.id === entry.id ? entry : item) };
      }
      return replaceOnly ? unit : { ...unit, [collection]: [...entries, entry] };
    });
  }

  return (
    <section id="expedition-units" style={styles.card} aria-labelledby="expedition-units-heading">
      <h2 id="expedition-units-heading" style={styles.heading}>Units</h2>
      {team.units.length
        ? (
          <ul style={styles.rosterList} role="list">
            {team.units.map(entry => (
              <UnitCard key={entry.id} team={team} unit={entry} editing={editing}
                onUpdate={update => updateUnit(entry.id, update)}
                onSaveEntry={(collection, rule, replaceOnly) => saveUnitEntry(entry.id, collection, rule, replaceOnly)} />
            ))}
          </ul>
        )
        : <p style={styles.note}>No units added yet.</p>}
      {team.canAddEntries && (
        <UnitProfileEditor teamName={team.name} editing={editing}
          onSave={unit => onChange(current => ({ units: [...current.units, unit] }))} />
      )}
    </section>
  );
}

function CollapsibleTeamSection({ id, title, linkTo, linkLabel, children }) {
  const [expanded, setExpanded] = useState(true);
  const headingId = `${id}-heading`;
  const bodyId = `${id}-body`;

  return (
    <section id={id} style={styles.card} aria-labelledby={headingId}>
      <div style={{ ...styles.ruleSectionHeader, flexWrap: 'wrap' }}>
        <h2 id={headingId} style={styles.heading}>
          <button type="button" style={styles.sectionToggle} aria-expanded={expanded} aria-controls={bodyId}
            onClick={() => setExpanded(current => !current)}>
            <span aria-hidden="true" style={styles.unitDisclosure}>{expanded ? '▾' : '▸'}</span>
            {title}
          </button>
        </h2>
        <Link to={linkTo} style={styles.link}>{linkLabel}</Link>
      </div>
      <div id={bodyId} hidden={!expanded} style={expanded ? styles.sectionBody : undefined}>
        {children}
      </div>
    </section>
  );
}

function TeamEquipment({ team, editing, onChange }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const items = team.items ?? [];

  async function addEquipment(event) {
    event.preventDefault();
    const equipmentName = name.trim();
    if (saving || !editing || !equipmentName) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(team.name, 'items', { name: equipmentName });
      if (!response.ok) throw new Error(payload.message || 'Unable to add equipment.');
      const item = payload.entry;
      onChange(current => {
        const entries = current.items ?? [];
        return { items: entries.some(entry => entry.id === item.id) ? entries : [...entries, item] };
      });
      setName('');
      setFeedback({ message: `${item.name} added.` });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleTeamSection id="expedition-equipment" title="Equipment"
      linkTo="/projects/ExpeditionShop" linkLabel="Visit Storefront">
      {items.length ? (
        <ul style={styles.rosterList} role="list">
          {items.map(item => (
            <li key={item.id} style={styles.rosterEntry}>
              <span>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span>
              {item.description && <p style={styles.ruleText}>{item.description}</p>}
            </li>
          ))}
        </ul>
      ) : <p style={styles.note}>No team equipment added yet.</p>}
      {editing && (
        <form onSubmit={addEquipment} style={styles.form}>
          <label style={{ ...styles.label, ...styles.unitNameField }}>
            Equipment name
            <input value={name} onChange={event => setName(event.target.value)} maxLength={100}
              required disabled={saving} style={styles.field} />
          </label>
          <button type="submit" disabled={saving || !name.trim()} style={styles.button}>Add equipment</button>
        </form>
      )}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
    </CollapsibleTeamSection>
  );
}

function ActiveBounties() {
  const [bounties, setBounties] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    loadBounties(signal).then(({ bounties }) => {
      if (!signal.aborted) setBounties(Array.isArray(bounties) ? bounties : []);
    }).catch(error => {
      if (!signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, []);

  const active = bounties?.flatMap(bounty => {
    const { progress, progressMax, isOpen, isClaimed } = getBountyProgress(bounty);
    if (!isOpen || isClaimed || bounty.canAccess === false || !progress || !progressMax) return [];
    return [{ id: bounty.id, name: bounty.name || 'Untitled Bounty', progress, progressMax }];
  });

  return (
    <CollapsibleTeamSection id="expedition-active-bounties" title="Active Bounties"
      linkTo="/projects/ExpeditionBounties" linkLabel="Visit Bounty Board">
      {error && <p role="alert" style={styles.error}>{error}</p>}
      {!error && !active && <p role="status" style={styles.note}>Loading bounty progress…</p>}
      {active?.length === 0 && <p style={styles.note}>You have no active bounties with recorded progress.</p>}
      {active?.length > 0 && (
        <ul style={styles.rosterList} role="list">
          {active.map(({ id, name, progress, progressMax }) => (
            <li key={id} style={styles.rosterEntry}>
              <div style={styles.ruleSectionHeader}>
                <strong>{name}</strong>
                <span>{progress} / {progressMax}</span>
              </div>
              <progress value={progress} max={progressMax} aria-label={`Your progress on ${name}`}
                style={{ width: '100%', height: '8px', accentColor: 'var(--team-accent)' }} />
            </li>
          ))}
        </ul>
      )}
    </CollapsibleTeamSection>
  );
}

function TeamPoints({ team, onChange }) {
  const [values, setValues] = useState(team.points);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function savePoints(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(team.name, 'points', {
        points: Object.fromEntries(balanceFields.map(([key]) => [key, Number(values[key] ?? 0)])),
        expectedPoints: team.points,
      });
      if (payload.points) {
        onChange(() => ({ points: payload.points }));
        setValues(payload.points);
      }
      if (!response.ok) throw new Error(payload.message || 'Unable to save team points.');
      setFeedback({ message: 'Team points saved.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.card} aria-labelledby="expedition-team-balances">
      <h2 id="expedition-team-balances" style={styles.heading}>Point Balances</h2>
      {team.canEditPoints ? (
        <form onSubmit={savePoints} style={styles.form}>
          {balanceFields.map(([key, label, max]) => (
            <label key={key} style={{ ...styles.label, flex: '1 1 105px', minWidth: 0 }}>
              {label}
              <input
                name={key}
                type="number"
                min="0"
                max={max}
                step="1"
                required
                value={values[key] ?? 0}
                onChange={event => setValues({ ...values, [key]: event.target.value })}
                disabled={saving}
                style={styles.field}
              />
            </label>
          ))}
          <button type="submit" disabled={saving} style={styles.button}>Save points</button>
        </form>
      ) : (
        <dl style={styles.balances}>
          {balanceFields.map(([key, label]) => (
            <div key={key}><dt>{label}</dt><dd style={styles.balance}>{team.points[key] ?? 0}</dd></div>
          ))}
        </dl>
      )}
      <div style={styles.balanceActions}>
        <button type="button" disabled title="Battle reporting is coming later"
          style={{ ...styles.button, opacity: 0.6, cursor: 'not-allowed' }}>Report Battle</button>
        <Link to="/projects/ExpeditionBounties" style={{ ...styles.button, textDecoration: 'none' }}>Check Bounties</Link>
      </div>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
    </section>
  );
}

function TeamLocations({ locations }) {
  return (
    <section style={styles.card} aria-labelledby="expedition-team-locations">
      <h2 id="expedition-team-locations" style={styles.heading}>Locations</h2>
      <dl style={styles.locationList}>
        {locationFields.map(([key, label]) => {
          const tiles = locations?.[key] ?? [];
          return (
            <div key={key} style={styles.locationRow}>
              <dt>{label}</dt>
              <dd style={styles.locationValue}>{tiles.length ? tiles.map(id => `Tile ${id}`).join(', ') : '—'}</dd>
            </div>
          );
        })}
      </dl>
      <Link to="/projects/ExpeditionMap" style={{ ...styles.button, ...styles.mapLink }}>View Map</Link>
    </section>
  );
}

function TeamTitle({ team, editing, onSave }) {
  const [name, setName] = useState(() => teamName(team));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function saveName(event) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(team.name, 'name', { name });
      if (!response.ok) throw new Error(payload.message || 'Unable to save the team name.');
      onSave(payload.displayName);
      setName(payload.displayName);
      setFeedback({ message: 'Team name saved.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 style={styles.title}>{teamName(team)}</h1>
      <p style={styles.teamColor}>{teamColorLabel(team.name)}</p>
      {editing && (
        <form onSubmit={saveName} style={styles.teamNameForm}>
          <input aria-label="Team name" value={name} onChange={event => setName(event.target.value)}
            maxLength={100} required disabled={saving} style={{ ...styles.field, flex: '1 1 160px', minWidth: 0 }} />
          <button type="submit" disabled={saving || !name.trim()} style={styles.button}>Save name</button>
          {feedback && <p role={feedback.error ? 'alert' : 'status'} style={{ ...(feedback.error ? styles.error : styles.note), flexBasis: '100%' }}>{feedback.message}</p>}
        </form>
      )}
    </>
  );
}

function TeamLore({ team, editing, onSave }) {
  const lore = team.lore ?? '';
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function saveLore(event) {
    event.preventDefault();
    if (saving || draft === null || draft === lore) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { response, payload } = await updateTeam(team.name, 'lore', { lore: draft, expectedLore: lore });
      if (response.status === 409 && typeof payload.lore === 'string') {
        onSave(payload.lore);
        setFeedback({ error: true, conflict: true, message: payload.message });
        return;
      }
      if (!response.ok) throw new Error(payload.message || 'Unable to save team lore.');
      onSave(payload.lore);
      setDraft(null);
      setFeedback({ message: 'Lore saved.' });
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="expedition-team-lore" style={styles.card} aria-labelledby="expedition-team-lore-heading">
      <h2 id="expedition-team-lore-heading" style={styles.heading}>Lore</h2>
      {editing ? (
        <form onSubmit={saveLore} style={styles.loreForm}>
          <textarea aria-label="Team lore" rows={5} value={draft ?? lore} disabled={saving}
            onChange={event => setDraft(event.target.value)}
            style={{ ...styles.field, boxSizing: 'border-box', resize: 'vertical' }} />
          <button type="submit" disabled={saving || draft === null || draft === lore}
            style={{ ...styles.button, justifySelf: 'start' }}>Save lore</button>
        </form>
      ) : <p style={lore ? styles.ruleText : styles.note}>{lore || 'No team lore has been written yet.'}</p>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} style={feedback.error ? styles.error : styles.note}>{feedback.message}</p>}
      {editing && feedback?.conflict && (
        <div>
          <strong>Currently saved lore</strong>
          <p style={styles.ruleText}>{lore || 'No team lore has been written yet.'}</p>
        </div>
      )}
    </section>
  );
}

export default function ExpeditionTeams() {
  const { hash } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [teams, setTeams] = useState(null);
  const [assignedTeam, setAssignedTeam] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const event = getAuthEventName();
    const refresh = () => setReload(value => value + 1);
    window.addEventListener(event, refresh);
    return () => window.removeEventListener(event, refresh);
  }, []);

  useEffect(() => {
    let ignore = false;
    setTeams(null);
    setEditingTeam(null);
    setLoadError('');
    async function loadTeams() {
      try {
        const { response, payload } = await fetchJson('/expedition/teams', { method: 'GET' });
        if (!response.ok || !Array.isArray(payload.teams)) throw new Error(payload.message || 'Unable to load Expedition teams.');
        if (ignore) return;
        const ownTeam = payload.teams.find(entry => entry.name === payload.assignedTeam)?.name || '';
        setAssignedTeam(ownTeam);
        setTeams(payload.teams);
      } catch (error) {
        if (!ignore) setLoadError(error.message);
      }
    }
    loadTeams();
    return () => { ignore = true; };
  }, [reload]);

  const requestedTeam = searchParams.get('team');
  const team = requestedTeam === null
    ? teams?.find(entry => entry.name === assignedTeam) ?? teams?.[0]
    : teams?.find(entry => entry.name === requestedTeam.trim().toLowerCase());
  const selectedTeam = team?.name;
  useEffect(() => { setEditingTeam(null); }, [selectedTeam]);

  if (requestedTeam === null && selectedTeam) {
    const next = new URLSearchParams(searchParams);
    next.set('team', selectedTeam);
    return <Navigate to={{ search: `?${next}`, hash }} replace />;
  }

  const [accent, tint] = teamThemes[team?.name] ?? ['#dedede', '#292929'];
  const canEditRoster = Boolean(team?.canAddEntries);
  const editing = canEditRoster && editingTeam === selectedTeam;
  const updateSelectedTeam = update => {
    setTeams(current => current?.map(entry => entry.name === selectedTeam ? { ...entry, ...update(entry) } : entry) ?? null);
  };

  return (
    <main style={{ ...styles.page, '--team-accent': accent, '--team-tint': tint }}>
      <div style={styles.layout}>
        <div style={styles.header}>
          <div style={{ flex: '1 1 210px', minWidth: 0 }}>
            <Link to="/projects/Expedition" style={styles.link}>← Expedition</Link>
            {team
              ? <TeamTitle key={team.name} team={team} editing={editing}
                onSave={displayName => updateSelectedTeam(() => ({ displayName }))} />
              : <h1 style={styles.title}>Teams</h1>}
          </div>
          <div style={styles.headerControls}>
            {teams?.length > 0 && (teams.length > 1 || !team) && (
              <label style={{ ...styles.label, minWidth: 0, maxWidth: '280px' }}>
                Team
                <select value={selectedTeam ?? ''} onChange={event => {
                  const next = new URLSearchParams(searchParams);
                  next.set('team', event.target.value);
                  setSearchParams(next);
                }} style={styles.field}>
                  {!team && <option value="" disabled>Choose a team</option>}
                  {teams.map(entry => (
                    <option key={entry.name} value={entry.name}>
                      {teamOptionLabel(entry)}{entry.name === assignedTeam ? ' (your team)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canEditRoster && (
              <button
                type="button"
                aria-label="Edit roster"
                aria-pressed={editing}
                aria-controls="expedition-team-lore expedition-units expedition-equipment"
                title={editing ? 'Done editing roster' : 'Edit roster'}
                onClick={() => setEditingTeam(current => current === selectedTeam ? null : selectedTeam)}
                style={{ ...styles.button, ...styles.pencil, ...(editing ? { background: 'var(--team-tint)', borderColor: 'var(--team-accent)' } : {}) }}
              >
                <span aria-hidden="true">✎</span>
              </button>
            )}
          </div>
        </div>
        {loadError ? (
          <div style={styles.card}>
            <p role="alert" style={styles.error}>{loadError}</p>
            <button type="button" onClick={() => setReload(value => value + 1)} style={{ ...styles.button, justifySelf: 'start' }}>Retry</button>
          </div>
        ) : !teams ? (
          <p role="status" style={styles.note}>Loading Expedition teams…</p>
        ) : !team ? (
          <p style={styles.note}>{teams.length ? 'That team is unavailable. Choose a team to continue.' : 'No Expedition teams are available.'}</p>
        ) : (
          <>
            <div key={team.name} style={styles.layout}>
              <div style={styles.teamOverview}>
                <TeamPoints team={team} onChange={updateSelectedTeam} />
                <TeamLocations locations={team.locations} />
              </div>
              <TeamLore team={team} editing={editing} onSave={lore => updateSelectedTeam(() => ({ lore }))} />
              <TeamUnits team={team} editing={editing} onChange={updateSelectedTeam} />
              <TeamEquipment team={team} editing={editing} onChange={updateSelectedTeam} />
            </div>
            <ActiveBounties key={reload} />
          </>
        )}
      </div>
    </main>
  );
}
