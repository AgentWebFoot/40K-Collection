export const teamMarkerColors = {
  red: '#ff6b6b', blue: '#5aa9ff', green: '#7ad67a', yellow: '#f3d35b',
  purple: '#c28bff', white: '#f5f5f5', black: '#111111',
};

export const styles = {
  page: { minHeight: '100%', padding: 'clamp(16px, 4vw, 40px)', background: '#1e1e1e', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  layout: { display: 'grid', gap: '18px', width: '100%', maxWidth: '900px', margin: '0 auto' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' },
  heading: { margin: 0, color: 'inherit', font: '700 1.8rem system-ui, sans-serif' },
  subheading: { margin: 0, fontSize: '1.1rem' },
  link: { color: '#eee', textUnderlineOffset: '4px' },
  card: { display: 'grid', gap: '12px', minWidth: 0, padding: '16px', background: '#272727', border: '1px solid #4a4a4a', borderRadius: '8px' },
  stack: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px' },
  fields: { display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))' },
  field: { width: '100%', boxSizing: 'border-box', color: '#fff', background: '#1a1a1a', padding: '8px', border: '1px solid #666', borderRadius: '5px', font: 'inherit' },
  button: { color: '#fff', background: '#383838', border: '1px solid #666', borderRadius: '5px', padding: '8px 12px', font: 'inherit' },
  label: { display: 'grid', gap: '5px', fontSize: '0.9rem' },
  labelRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  teamMarker: { width: '12px', height: '12px', border: '1px solid #aaa', borderRadius: '50%' },
  note: { margin: 0, color: '#ddd' },
  prose: { margin: 0, color: '#ddd', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  error: { margin: 0, color: '#ffb5a7' },
  details: { display: 'grid', gap: '6px', margin: 0, overflowWrap: 'anywhere' },
  log: { display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: '18px' },
  sidebar: { flex: '1 1 300px', minWidth: 0 },
  report: { flex: '3 1 420px', minWidth: 0 },
  reportList: { maxHeight: 'min(65vh, 720px)', overflowY: 'auto', padding: '3px' },
  filterDialog: { width: 'min(520px, calc(100% - 32px))', maxHeight: '80vh', boxSizing: 'border-box',
    overflowY: 'auto', padding: '16px', color: '#fff', background: '#272727', border: '1px solid #666', borderRadius: '8px' },
  entries: { display: 'grid', gap: '8px', listStyle: 'none', padding: 0, margin: 0 },
  entry: { display: 'grid', gap: '6px', color: '#fff', textDecoration: 'none', padding: '12px', border: '1px solid #666',
    borderRadius: '6px', overflowWrap: 'anywhere' },
};

export const sortButton = { ...styles.button, display: 'inline-grid', placeItems: 'center', width: '36px', height: '34px', padding: 0, fontSize: '1.1rem' };
export const clockFace = { display: 'grid', placeItems: 'center', width: '14px', height: '14px', border: '1px solid currentColor', borderRadius: '50%' };
export const clockHands = { width: '4px', height: '5px', borderLeft: '1px solid currentColor', borderBottom: '1px solid currentColor', transform: 'translate(2px, -2px)' };
export const filterIcon = { width: '15px', height: '15px', backgroundColor: 'currentColor',
  clipPath: 'polygon(0 5%, 100% 5%, 62% 51%, 62% 85%, 38% 100%, 38% 51%)' };
export const filterBadge = { position: 'absolute', top: '-5px', right: '-5px', minWidth: '1rem', padding: '0 2px',
  color: '#1e1e1e', backgroundColor: '#eee', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 };
