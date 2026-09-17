import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AtlasLocation, PlayerAtlasProjection } from './atlas-types';

type Terminal = { id: string; label: string; note: string };
const bridgeTerminals: readonly Terminal[] = [
  { id: 'army', label: 'Army manager', note: 'Force-record terminal integration pending.' },
  { id: 'briefings', label: 'Briefings', note: 'Published record terminal integration pending.' },
  { id: 'resources', label: 'Cell resources', note: 'Shared asset terminal integration pending.' },
  { id: 'operations', label: 'Operations', note: 'Published operation terminal integration pending.' },
];
const lowerTerminals: readonly Terminal[] = [
  { id: 'travel', label: 'Travel corridors', note: 'Journey-planning terminal integration pending.' },
  { id: 'activities', label: 'Location activities', note: 'Published activity terminal integration pending.' },
  { id: 'relationships', label: 'Relationships & leads', note: 'Player-safe lead terminal integration pending.' },
];

const responseJson = async <T,>(response: Response): Promise<T> => {
  const raw = await response.text();
  if (!raw.trim()) throw new Error('The command deck returned an empty response.');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new Error('The command deck returned an invalid response.'); }
  if (!response.ok) throw new Error(typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'The command deck is unavailable.');
  return body as T;
};

const TerminalControl = ({ terminal }: { terminal: Terminal }) => <button className="atlas-terminal-control" type="button" disabled aria-disabled="true" title={terminal.note}>
  <strong>{terminal.label}</strong><span>Terminal integration pending.</span>
</button>;

const Dossier = ({ location }: { location: AtlasLocation | undefined }) => <article className="atlas-detail atlas-side-dossier" aria-live="polite">
  {location ? <>
    <span className="world-meta">{location.detailStatus === 'dossier' ? 'Dossier' : 'Map-only'} · published</span>
    <h2>{location.title}</h2>
    <p>{location.publicDescription}</p>
    <p><strong>Access:</strong> {location.authorityAccess}</p>
    {location.consequences.map((consequence, index) => <p key={`${location.id}-${index}`}><strong>Known consequence:</strong> {consequence}</p>)}
    <section className="atlas-available-actions" aria-label="Available location actions"><h3>Available actions</h3><p>No duties or opportunities are currently assigned at this location.</p></section>
  </> : <p>Loading the cleared Tavrellis survey feed…</p>}
</article>;

type LabelAnchor = 'right' | 'left' | 'above' | 'below';
type LabelLayout = { anchor: LabelAnchor; x: number; y: number };
type LabelRect = { left: number; top: number; right: number; bottom: number };
type WorldExclusionZone = { x: number; y: number; radiusX: number; radiusY: number };

const labelsOverlap = (first: LabelRect, second: LabelRect) =>
  first.left < second.right + 4 && first.right + 4 > second.left && first.top < second.bottom + 4 && first.bottom + 4 > second.top;

const labelOverlapsWorld = (label: LabelRect, world: WorldExclusionZone) => {
  const nearestX = Math.max(label.left, Math.min(world.x, label.right));
  const nearestY = Math.max(label.top, Math.min(world.y, label.bottom));
  return ((nearestX - world.x) / world.radiusX) ** 2 + ((nearestY - world.y) / world.radiusY) ** 2 < 1;
};

// Approximate visible world disks in the fixed public holomap artwork. These
// are display-only geometry: the published location coordinates remain the
// canonical map data, while tags are kept outside the rendered planets.
const worldClearance: Record<string, { x: number; y: number }> = {
  'location-uzazaban': { x: .03, y: .04 }, 'location-ex-morvan': { x: .034, y: .045 },
  'location-calverna': { x: .05, y: .065 }, 'location-eonope': { x: .043, y: .057 },
  'location-iscara': { x: .022, y: .03 }, 'location-warp-meridian': { x: .075, y: .1 },
  'location-auroria': { x: .045, y: .06 }, 'location-gork': { x: .034, y: .045 },
  'location-carthax': { x: .036, y: .05 }, 'location-orison': { x: .052, y: .07 },
  'location-alecto': { x: .03, y: .04 }, 'location-khelt': { x: .03, y: .04 },
  'location-xill': { x: .034, y: .045 }, 'location-cthon': { x: .03, y: .04 },
  'location-pyraxis': { x: .052, y: .07 }, 'location-noxara': { x: .043, y: .055 },
};

const sameLayouts = (first: Record<string, LabelLayout>, second: Record<string, LabelLayout>) => {
  const firstIds = Object.keys(first);
  return firstIds.length === Object.keys(second).length && firstIds.every(id => first[id]?.anchor === second[id]?.anchor && first[id]?.x === second[id]?.x && first[id]?.y === second[id]?.y);
};

export default function AtlasApp({ accountKey }: { accountKey: string }) {
  const [deck, setDeck] = useState<PlayerAtlasProjection>();
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [labelLayouts, setLabelLayouts] = useState<Record<string, LabelLayout>>({});
  const mapRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  useEffect(() => {
    let active = true;
    void fetch('/hybrid-campaign/api/atlas', { cache: 'no-store', headers: { Accept: 'application/json', 'X-Preview-Campaign-Role': 'player', 'X-Preview-Campaign-Account': accountKey } })
      .then(responseJson<PlayerAtlasProjection>)
      .then(data => { if (active) { setDeck(data); setSelectedId(current => current || data.locations[0]?.id || ''); } })
      .catch(problem => { if (active) setError(problem instanceof Error ? problem.message : 'The command deck is unavailable.'); });
    return () => { active = false; };
  }, [accountKey]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !deck?.locations.length) return;
    const arrangeLabels = () => {
      const width = map.clientWidth;
      const height = map.clientHeight;
      if (!width || !height) return;
      const placed: LabelRect[] = [];
      // A tag is its own physical plate on the hololith: preserve open space around
      // every targeting stud, not merely between the text plates themselves.
      const pinExclusionZones = deck.locations.map(location => {
        const x = map.clientLeft + (location.mapPosition.x / 100) * width;
        const y = map.clientTop + (location.mapPosition.y / 100) * height;
        return { left: x - 8, top: y - 8, right: x + 8, bottom: y + 8 };
      });
      const worldExclusionById = new Map(deck.locations.map(location => {
        const clearance = worldClearance[location.id] ?? { x: .04, y: .055 };
        return [location.id, {
          x: map.clientLeft + (location.mapPosition.x / 100) * width,
          y: map.clientTop + (location.mapPosition.y / 100) * height,
          radiusX: width * clearance.x + 4,
          radiusY: height * clearance.y + 4,
        }] as const;
      }));
      const worldExclusionZones = [...worldExclusionById.values()];
      const labelGap = 17;
      const next: Record<string, LabelLayout> = {};
      const orderedLocations = [...deck.locations].sort((first, second) => {
        const firstDensity = deck.locations.filter(location => Math.abs(location.mapPosition.x - first.mapPosition.x) < 15 && Math.abs(location.mapPosition.y - first.mapPosition.y) < 13).length;
        const secondDensity = deck.locations.filter(location => Math.abs(location.mapPosition.x - second.mapPosition.x) < 15 && Math.abs(location.mapPosition.y - second.mapPosition.y) < 13).length;
        return secondDensity - firstDensity || first.mapPosition.y - second.mapPosition.y || first.mapPosition.x - second.mapPosition.x;
      });
      for (const location of orderedLocations) {
        const label = labelRefs.current.get(location.id);
        if (!label) continue;
        const labelWidth = label.offsetWidth;
        const labelHeight = label.offsetHeight;
        const pointX = map.clientLeft + (location.mapPosition.x / 100) * width;
        const pointY = map.clientTop + (location.mapPosition.y / 100) * height;
        const ownWorld = worldExclusionById.get(location.id);
        const outwardX = Math.max(0, (ownWorld?.radiusX ?? 0) + 2 - labelGap);
        const outwardY = Math.max(0, (ownWorld?.radiusY ?? 0) + 2 - labelGap);
        const preferred: LabelAnchor[] = location.mapPosition.x > 58 ? ['left', 'above', 'below', 'right'] : ['right', 'above', 'below', 'left'];
        // Drift in small physical increments. Scaling by label width made a single
        // collision correction look detached from its planet on dense areas.
        const driftSteps = [0, -8, 8, -16, 16, -24, 24, -32, 32, -40, 40, -48, 48, -56, 56, -64, 64];
        let chosen: { layout: LabelLayout; rect: LabelRect } | undefined;
        const candidates = preferred.flatMap((anchor, preference) => driftSteps.map(drift => {
            const x = anchor === 'right' || anchor === 'left' ? outwardX : drift;
            const y = anchor === 'above' || anchor === 'below' ? outwardY : drift;
            const left = anchor === 'right' ? pointX + labelGap + x : anchor === 'left' ? pointX - labelGap - x - labelWidth : pointX - labelWidth / 2 + x;
            const top = anchor === 'above' ? pointY - labelGap - y - labelHeight : anchor === 'below' ? pointY + labelGap + y : pointY - labelHeight / 2 + y;
            const rect = { left, top, right: left + labelWidth, bottom: top + labelHeight };
            const nearestX = Math.max(rect.left, Math.min(pointX, rect.right));
            const nearestY = Math.max(rect.top, Math.min(pointY, rect.bottom));
            return { layout: { anchor, x, y }, rect, distance: Math.hypot(nearestX - pointX, nearestY - pointY), preference };
          })).sort((first, second) => first.distance - second.distance || first.preference - second.preference);
        for (const candidate of candidates) {
          if (candidate.rect.left < 6 || candidate.rect.top < 6 || candidate.rect.right > width - 6 || candidate.rect.bottom > height - 6 || placed.some(existing => labelsOverlap(candidate.rect, existing)) || pinExclusionZones.some(pin => labelsOverlap(candidate.rect, pin)) || worldExclusionZones.some(world => labelOverlapsWorld(candidate.rect, world))) continue;
          chosen = candidate;
          break;
        }
        if (!chosen) {
          const horizontalStep = Math.max(12, Math.round(labelWidth / 2));
          const verticalStep = labelHeight + 5;
          for (let top = 6; top <= height - labelHeight - 6 && !chosen; top += verticalStep) {
            for (let left = 6; left <= width - labelWidth - 6; left += horizontalStep) {
              const rect = { left, top, right: left + labelWidth, bottom: top + labelHeight };
              if (placed.some(existing => labelsOverlap(rect, existing)) || pinExclusionZones.some(pin => labelsOverlap(rect, pin)) || worldExclusionZones.some(world => labelOverlapsWorld(rect, world))) continue;
              chosen = {
                layout: { anchor: 'below', x: left - (pointX - labelWidth / 2), y: top - (pointY + labelGap) },
                rect,
              };
              break;
            }
          }
        }
        if (chosen) {
          next[location.id] = chosen.layout;
          placed.push(chosen.rect);
        }
      }
      setLabelLayouts(current => sameLayouts(current, next) ? current : next);
    };
    arrangeLabels();
    const observer = new ResizeObserver(arrangeLabels);
    observer.observe(map);
    labelRefs.current.forEach(label => observer.observe(label));
    window.addEventListener('resize', arrangeLabels);
    return () => { observer.disconnect(); window.removeEventListener('resize', arrangeLabels); };
  }, [deck?.locations]);

  const selected = deck?.locations.find(location => location.id === selectedId) ?? deck?.locations[0];
  const partyLocation = deck?.locations.find(location => location.id === deck.partyLocationId);
  if (error) return <main className="display atlas-page atlas-command-deck"><section className="atlas-load-error" role="alert"><h2>Hololithic chart unavailable</h2><p>The command deck cannot retrieve its cleared survey feed. Reload the page and try again.</p></section></main>;
  return <main className="display atlas-page atlas-command-deck">
    <header className="atlas-command-top">
      <div className="atlas-bridge-title"><img className="atlas-inquisition-sigil" src="/hybrid-campaign/assets/branding/inquisitorial-command-seal.png" alt="" aria-hidden="true"/><div>
        <p className="eyebrow">Inquisitorial command bridge · public survey feed</p><h1>Tavrellis hololithic chart</h1>
        <p className="atlas-welcome">Welcome aboard, {deck?.playerName ?? 'authorised operative'}.</p>
        <div className="atlas-command-status" aria-label="Player campaign status"><span>Location <b>{partyLocation?.title ?? 'No published assignment'}</b></span><span>Operation <b>No published operation</b></span><span>Signals <b>{deck?.urgentSignals.length ?? 0}</b></span></div>
      </div></div>
      <nav className="atlas-tool-strip" aria-label="Future player terminals">{bridgeTerminals.map(terminal => <TerminalControl terminal={terminal} key={terminal.id}/>)}</nav>
    </header>
    <aside className="atlas-ongoings" aria-labelledby="atlas-signals-title"><p className="eyebrow">Vox & astropathic traffic</p><h2 id="atlas-signals-title">Priority reports</h2>
      {deck?.urgentSignals.length ? deck.urgentSignals.map(signal => <article className={`atlas-alert atlas-alert-${signal.severity}`} key={signal.id}><strong>{signal.title}</strong><span>{signal.detail}</span></article>) : <p className="atlas-empty">No priority reports await your attention.</p>}
    </aside>
    <section className="atlas-system-panel" aria-label="Interactive Tavrellis system map">
      <div className="atlas-screen-heading"><span>Hololithic system survey · Tavrellis</span><span className="atlas-map-date"><small>Campaign date</small><b>{deck?.campaignDate ?? 'Acquiring chronometer data'}</b></span><span>Clearance: Cell public</span></div>
      <p className="atlas-selection-announcement" aria-live="polite">{selected ? `${selected.title} selected.` : 'No location selected.'}</p>
      <div className="atlas-holomap"><div className="atlas-map" ref={mapRef}>
        <img src="/hybrid-campaign/assets/world-atlas/tavrellis-system-unlabelled-map.png" alt="Tavrellis system holomap"/>
        {partyLocation ? <span className="atlas-party-marker" role="img" aria-label={`Current Cell position: ${partyLocation.title}`} style={{ left: `${partyLocation.mapPosition.x}%`, top: `${partyLocation.mapPosition.y}%` }}><span>⌖</span></span> : <span className="atlas-party-marker-note">POSITION // AWAITING PUBLIC ASSIGNMENT</span>}
        {deck?.locations.map(location => {
          const labelLayout = labelLayouts[location.id] ?? { anchor: 'right' as const, x: 0, y: 0 };
          const labelStyle = { '--atlas-label-offset-x': `${labelLayout.x}px`, '--atlas-label-offset-y': `${labelLayout.y}px` } as CSSProperties;
          const leadVector = labelLayout.anchor === 'right' ? { x: 17 + labelLayout.x, y: labelLayout.y } : labelLayout.anchor === 'left' ? { x: -(17 + labelLayout.x), y: labelLayout.y } : labelLayout.anchor === 'above' ? { x: labelLayout.x, y: -(17 + labelLayout.y) } : { x: labelLayout.x, y: 17 + labelLayout.y };
          const leadStyle = { '--atlas-lead-length': `${Math.max(0, Math.hypot(leadVector.x, leadVector.y) - 6)}px`, '--atlas-lead-angle': `${Math.atan2(leadVector.y, leadVector.x)}rad` } as CSSProperties;
          return <button className="atlas-pin" type="button" key={location.id} data-location-id={location.id} aria-label={`View ${location.title}`} aria-pressed={selected?.id === location.id} title={location.title} style={{ left: `${location.mapPosition.x}%`, top: `${location.mapPosition.y}%` }} onClick={() => setSelectedId(location.id)}><span className="atlas-pin-dot" aria-hidden="true"/><span className="atlas-pin-lead" style={leadStyle} aria-hidden="true"/><span ref={element => { if (element) labelRefs.current.set(location.id, element); else labelRefs.current.delete(location.id); }} className={`atlas-pin-label atlas-pin-label-${labelLayout.anchor}`} style={labelStyle} aria-hidden="true">{location.mapLabel}</span></button>;
        })}
      </div><div className="atlas-holotable-plinth" aria-hidden="true"><span className="atlas-holotable-support"/><span className="atlas-holotable-support"/></div><span className="atlas-tracked-body" aria-hidden="true">{selected ? `TRACKED BODY // ${selected.mapLabel.toUpperCase()}` : 'TRACKED BODIES // ACQUIRING'}</span></div>
    </section>
    <aside className="atlas-quick" aria-labelledby="atlas-terminal-title"><Dossier location={selected}/><p className="eyebrow">Sanctioned command terminal</p><h2 id="atlas-terminal-title">Requisition & records</h2>{lowerTerminals.map(terminal => <TerminalControl terminal={terminal} key={terminal.id}/>)}</aside>
  </main>;
}
