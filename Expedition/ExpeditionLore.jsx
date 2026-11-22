import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchJson, getAuthEventName } from '../../utils/auth';
import { styles, teamMarkerColors, sortButton, clockFace, clockHands, filterIcon, filterBadge } from './expedition-log-styles.mjs';

const lorePath = '/projects/ExpeditionLore';
const teamLabel = team => `${team[0].toUpperCase()}${team.slice(1)} Team`;
const groupLabel = post => post.teamName || teamLabel(post.team);
const tileLabel = tile => `Tile ${tile.id}${tile.locationNumber ? ` · Location ${tile.locationNumber}` : ''}`;

async function requestLore(options) {
  const { response, payload } = await fetchJson('/expedition/lore', options);
  if (!response.ok) throw new Error(payload.message || 'Unable to load or save Expedition lore.');
  return payload;
}

function LoreLog({ posts, query, updateQuery, onSelect, onRefresh }) {
  const dialog = useRef(null);
  const search = query.get('q') || '';
  const byName = query.get('sort') === 'name';
  const ascending = query.get('order') === 'asc';
  const team = query.get('team') || '';
  const round = query.get('round') || '';
  const filterCount = Number(Boolean(team)) + Number(Boolean(round));
  const rounds = [...new Set(posts.map(post => post.round))].sort((first, second) => second - first);
  const teams = new Map(posts.map(post => [post.team, groupLabel(post)]));
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = posts.filter(post => {
    const searchable = [post.title, post.text, groupLabel(post), teamLabel(post.team), post.author].join(' ').toLowerCase();
    return (!team || post.team === team) && (!round || String(post.round) === round) && terms.every(term => searchable.includes(term));
  }).sort((first, second) => {
    const byTitle = first.title.localeCompare(second.title, undefined, { sensitivity: 'base', numeric: true });
    const byRound = first.round - second.round || first.createdAt.localeCompare(second.createdAt);
    return (ascending ? 1 : -1) * (byName ? byTitle || byRound : byRound || byTitle);
  });
  const directionLabel = `Switch to ${ascending ? 'descending' : 'ascending'} order`;
  const sortLabel = `Sort by ${byName ? 'round' : 'title'}`;
  const filterLabel = filterCount ? `Filter lore (${filterCount} active)` : 'Filter lore';

  return (
    <aside aria-label="Lore log" style={{ ...styles.card, ...styles.sidebar }}>
      <h2 style={styles.subheading}>Lore Log</h2>
      <label style={styles.label}>
        Search lore
        <input type="search" value={search} onChange={event => updateQuery({ q: event.target.value })} style={styles.field} />
      </label>
      <div role="group" aria-label="Lore log controls" style={{ ...styles.row, flexWrap: 'nowrap', gap: '8px' }}>
        <button type="button" style={sortButton} aria-label={directionLabel} title={directionLabel}
          onClick={() => updateQuery({ order: ascending ? '' : 'asc' })}>
          <span aria-hidden="true">{ascending ? '↑' : '↓'}</span>
        </button>
        <button type="button" style={sortButton} aria-label={sortLabel} title={sortLabel}
          onClick={() => updateQuery({ sort: byName ? '' : 'name' })}>
          {byName ? <span aria-hidden="true">A</span> : <span aria-hidden="true" style={clockFace}><span style={clockHands} /></span>}
        </button>
        <button type="button" style={{ ...sortButton, position: 'relative' }} aria-haspopup="dialog" aria-controls="lore-filters"
          aria-label={filterLabel} title={filterLabel} onClick={() => dialog.current.showModal()}>
          <span aria-hidden="true" style={filterIcon} />
          {filterCount > 0 && <span aria-hidden="true" style={filterBadge}>{filterCount}</span>}
        </button>
        <button type="button" style={sortButton} aria-label="Refresh lore log" title="Refresh lore log" onClick={onRefresh}>
          <span aria-hidden="true">↻</span>
        </button>
      </div>
      <dialog ref={dialog} id="lore-filters" style={styles.filterDialog} aria-labelledby="lore-filter-title">
        <div style={styles.stack}>
          <h2 id="lore-filter-title" style={styles.subheading}>Filter lore</h2>
          <label style={styles.label}>
            Team
            <select style={styles.field} value={team} onChange={event => updateQuery({ team: event.target.value })}>
              <option value="">All teams</option>
              {[...teams].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            Round
            <select style={styles.field} value={round} onChange={event => updateQuery({ round: event.target.value })}>
              <option value="">All rounds</option>
              {rounds.map(value => <option key={value} value={value}>Round {value}</option>)}
            </select>
          </label>
          <div style={{ ...styles.row, justifyContent: 'flex-end' }}>
            <button type="button" style={styles.button} disabled={!filterCount} onClick={() => updateQuery({ team: '', round: '' })}>
              Clear filters
            </button>
            <button type="button" style={styles.button} onClick={() => dialog.current.close()}>Done</button>
          </div>
        </div>
      </dialog>
      {visible.length > 0 ? (
        <nav aria-label="Lore posts" style={styles.reportList}>
          <ul style={styles.entries}>
            {visible.map(post => {
              const next = new URLSearchParams(query);
              next.set('post', post.id);
              const selected = query.get('post') === post.id;
              const color = teamMarkerColors[post.team] ?? '#888';
              return (
                <li key={post.id}>
                  <Link to={`${lorePath}?${next}`} onClick={onSelect} aria-current={selected ? 'true' : undefined}
                    style={{ ...styles.entry, borderColor: selected ? '#eee' : '#666',
                      background: `linear-gradient(#161616cc, #161616cc), ${color}` }}>
                    <span aria-hidden="true" style={{ height: '4px', borderRadius: '3px', background: color, boxShadow: '0 0 0 1px #ffffff40' }} />
                    <strong>{post.title}</strong>
                    <span style={styles.note}>Round {post.round} · {groupLabel(post)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : <p style={styles.note}>{posts.length ? 'No lore matches your search or filters.' : 'No lore has been posted yet.'}</p>}
    </aside>
  );
}

function LoreForm({ data, onSave, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manualRound, setManualRound] = useState(String(data.round));
  const [manualTile, setManualTile] = useState('');
  const [battleId, setBattleId] = useState('');
  const battle = data.battles.find(entry => entry.id === battleId);
  const linkedRound = battle?.round;
  const linkedTile = battle?.tileId;

  async function submit(event) {
    event.preventDefault();
    const draft = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSaving(true);
    setError('');
    try {
      await onSave({ ...draft, round: Number(draft.round) });
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
    }
  }

  return (
    <form style={styles.card} onSubmit={submit}>
      <h2 style={styles.subheading}>Write lore</h2>
      <div style={styles.fields}>
        <label style={styles.label}>Title<input style={styles.field} name="title" maxLength={120} required disabled={saving} /></label>
        <label style={styles.label}>
          Round
          <input style={styles.field} name="round" type="number" min={1} max={Math.max(data.round, linkedRound ?? 0)}
            value={linkedRound ?? manualRound} readOnly={linkedRound != null} onChange={event => setManualRound(event.target.value)}
            required disabled={saving} />
          {linkedRound != null && <span style={styles.note}>Uses the linked battle’s round.</span>}
        </label>
      </div>
      <div style={styles.fields}>
        <label style={styles.label}>
          Map tile (optional)
          <input type="text" style={styles.field} name="tileId" placeholder="e.g. 9-20" disabled={saving}
            value={linkedTile ?? manualTile} readOnly={linkedTile != null} onChange={event => setManualTile(event.target.value)} />
          {linkedTile != null && <span style={styles.note}>Uses the linked battle’s tile.</span>}
        </label>
        <label style={styles.label}>
          Battle (optional)
          <select style={styles.field} name="battleId" value={battleId} onChange={event => setBattleId(event.target.value)}
            disabled={saving || !data.battles.length}>
            <option value="">{data.battles.length ? 'No battle' : 'No eligible battles'}</option>
            {data.battles.map(battle => <option key={battle.id} value={battle.id}>
              {[battle.name, battle.type, battle.round != null && `Round ${battle.round}`, battle.date].filter(Boolean).join(' · ')}
            </option>)}
          </select>
        </label>
      </div>
      <label style={styles.label}>
        Lore
        <textarea style={{ ...styles.field, resize: 'vertical' }} name="text" rows={8} maxLength={12000} required disabled={saving} />
      </label>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      <div style={styles.row}>
        <button type="submit" style={styles.button} disabled={saving}>{saving ? 'Publishing…' : 'Publish lore'}</button>
        <button type="button" style={styles.button} disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function LorePost({ post, tiles }) {
  const tile = tiles.find(entry => entry.id === post.tileId);
  return (
    <article style={styles.card}>
      <h2 style={{ ...styles.subheading, overflowWrap: 'anywhere' }}>{post.title}</h2>
      <p style={styles.note}>Round {post.round} · {groupLabel(post)} · Posted by {post.author}</p>
      {(post.tileId || post.hasBattle) && (
        <div style={styles.row}>
          {tile ? <Link to={`/projects/ExpeditionMap?${new URLSearchParams({ tile: tile.id })}`} style={styles.link}>{tileLabel(tile)}</Link>
            : post.tileId && <span style={styles.note}>Tile {post.tileId} (unavailable)</span>}
          {post.battle ? <Link to={`/projects/ExpeditionBattles?${new URLSearchParams({ battle: post.battle.id })}`} style={styles.link}>
            {post.battle.name}
          </Link> : post.hasBattle && <span style={styles.note}>Linked battle unavailable</span>}
        </div>
      )}
      <p style={styles.prose}>{post.text}</p>
    </article>
  );
}

export default function ExpeditionLore() {
  const [query, setQuery] = useSearchParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState(null);
  const selectedId = query.get('post');
  const selected = data?.posts.find(post => post.id === selectedId);
  const refresh = () => setReload(value => value + 1);

  useEffect(() => {
    const event = getAuthEventName();
    window.addEventListener(event, refresh);
    return () => window.removeEventListener(event, refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError('');
    setEditor(null);
    requestLore({ method: 'GET', signal: controller.signal }).then(
      payload => { if (!controller.signal.aborted) setData(payload); },
      failure => { if (!controller.signal.aborted) setLoadError(failure.message); },
    );
    return () => controller.abort();
  }, [reload]);

  function updateQuery(changes, replace = true) {
    setQuery(current => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace });
  }

  async function save(draft) {
    const { post } = await requestLore({ method: 'POST', body: JSON.stringify(draft) });
    setData(current => current && ({ ...current, posts: [post, ...current.posts] }));
    setEditor(null);
    updateQuery({ post: post.id, q: '', round: '', team: '' }, false);
  }

  return (
    <main style={styles.page}>
      <div style={{ ...styles.layout, maxWidth: '1200px' }}>
        <header style={styles.row}><Link to="/projects/Expedition" style={styles.link}>← Expedition</Link></header>
        <h1 style={styles.heading}>Lore</h1>
        {loadError ? (
          <div style={styles.card}>
            <p role="alert" style={styles.error}>{loadError}</p>
            <div><button type="button" style={styles.button} onClick={refresh}>Retry</button></div>
          </div>
        ) : !data ? <p role="status" style={styles.note}>Loading lore…</p> : (
          <div style={styles.log}>
            <LoreLog posts={data.posts} query={query} updateQuery={updateQuery} onSelect={() => setEditor(null)} onRefresh={refresh} />
            <section aria-label="Lore post" style={{ ...styles.stack, ...styles.report }}>
              {data.canPost && editor?.selectedId === selectedId ? <LoreForm data={data} onSave={save} onCancel={() => setEditor(null)} /> : (
                <>
                  {data.canPost && <div><button type="button" style={styles.button} onClick={() => setEditor({ selectedId })}>Write lore</button></div>}
                  {selected ? <LorePost post={selected} tiles={data.tiles} /> : (
                    <p style={{ ...styles.card, ...styles.note }}>{selectedId ? 'This lore post is unavailable.' : 'Select a lore post to read it.'}</p>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
