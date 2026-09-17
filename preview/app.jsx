import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import PyrrhicWar from '../PyrrhicWar/PyrrhicWar.jsx';
import PyrrhicWarMap from '../PyrrhicWar/PyrrhicWarMap.jsx';
import PyrrhicWarCompendium from '../PyrrhicWar/PyrrhicWarCompendium.jsx';
import Expedition from '../Expedition/Expedition.jsx';
import ExpeditionMap from '../Expedition/ExpeditionMap.jsx';
import HybridCampaign from '../HybridCampaign/HybridCampaign.jsx';
import { initialize, setAccount, getAccount, accounts } from './auth.mjs';
import { campaignRoles, roles, effectiveRole, expeditionRole } from './accounts.mjs';

const label = value => value[0].toUpperCase() + value.slice(1);
function ProjectPicker() {
  return <main className="project-picker">
    <h1>Choose a project</h1>
    <section className="project-section" aria-labelledby="warhammer-projects-title"><p className="project-kicker">Warhammer Projects</p><h2 id="warhammer-projects-title">Campaign workspaces</h2><div className="project-choices">
      <Link className="project-choice" to="/projects/PyrrhicWar"><strong>Pyrrhic War</strong><span>Campaign board &amp; compendium</span></Link>
      <Link className="project-choice" to="/projects/Expedition"><strong>Expedition</strong><span>Expedition map</span></Link>
      <Link className="project-choice project-choice-featured" to="/projects/HybridCampaign#/atlas"><strong>Senseweeks’s Hybrid Campaign Experiment</strong><span>Tavrellis player command deck</span></Link>
    </div></section>
  </main>;
}
function App() {
  const location = useLocation();
  const isExpedition = location.pathname.startsWith('/projects/Expedition');
  const isPyrrhicWar = location.pathname.startsWith('/projects/PyrrhicWar');
  const isHybridCampaign = location.pathname.startsWith('/projects/HybridCampaign');
  const [draft, setDraft] = useState(getAccount());
  const [active, setActive] = useState(getAccount());
  const [saved, setSaved] = useState(accounts.list());
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => accounts.subscribe(() => setSaved(accounts.list())), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value });
  const apply = next => {
    const normalized = { username: next.username.trim(), role: next.role };
    if (!normalized.username) throw new Error('Enter a username first.');
    setAccount(normalized); setActive(normalized); setVersion(value => value + 1);
  };
  const run = action => {
    setError(''); setMessage('');
    try { action(); } catch (error) { setError(error.message); }
  };
  const activeMember = saved.find(item => item.username.toLowerCase() === active.username.toLowerCase());
  const chosen = saved.find(item => String(item.id) === selected);
  return <main className="app">
    <header className={`simulator-header${collapsed ? ' is-collapsed' : ''}`}>
      <button type="button" className="header-toggle"
        aria-expanded={!collapsed} aria-controls="account-controls"
        aria-label={collapsed ? 'Show account controls' : 'Hide account controls'}
        title={collapsed ? 'Expand' : 'Collapse'}
        onClick={() => setCollapsed(value => !value)}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d={collapsed ? 'M3 6l5 5 5-5' : 'M3 10l5-5 5 5'} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      <div id="account-controls" hidden={collapsed}>
      <div className="header-columns">
        <section className="account-editor" aria-label="Account controls">
          <form onSubmit={event => { event.preventDefault(); run(() => { apply(draft); setMessage('Applied.'); }); }}>
            <label>Username<input name="username" value={draft.username} onChange={change} maxLength={80} required /></label>
            <label>Permission<select name="role" value={draft.role} onChange={change}>{roles.map(role => <option key={role} value={role}>{label(role)}</option>)}</select></label>
            <button type="submit">Apply</button>
          </form>
          <p className="active-account"><strong>{active.username}</strong><span>{label(active.role)}</span>
            {isPyrrhicWar && <span>Pyrrhic War: {label(effectiveRole({ ...active, membershipRole: activeMember?.membershipRole }))}</span>}
            {isExpedition && <span>Expedition: {label(expeditionRole({ ...active, expeditionMembershipRole: activeMember?.expeditionMembershipRole }))}</span>}
            {isHybridCampaign && <span>Hybrid Campaign: {activeMember?.campaignRole ? label(activeMember.campaignRole) : 'not assigned'}</span>}
          </p>
        </section>
        <section className="saved-accounts" aria-labelledby="saved-title">
          <h2 id="saved-title" className="visually-hidden">Saved accounts</h2>
          <button type="button" className="save-account" onClick={() => run(() => {
            const entry = accounts.save(draft);
            setSelected(String(entry.id)); apply(entry);
            setMessage('Saved.');
          })}>Save</button>
          <label>Saved accounts<select value={selected} onChange={event => setSelected(event.target.value)}>
            <option value="">{saved.length ? 'Select account' : 'No accounts'}</option>
            {saved.map(entry => <option key={entry.id} value={entry.id}>{entry.username} — {label(entry.role)}</option>)}
          </select></label>
          <div className="saved-actions">
            <button type="button" disabled={!chosen} onClick={() => run(() => {
              setDraft({ username: chosen.username, role: chosen.role }); apply(chosen);
              setMessage('Loaded.');
            })}>Load</button>
            <button type="button" className="delete-account" disabled={!chosen} onClick={() => run(() => {
              accounts.remove(chosen.id); setSelected('');
              if (chosen.username.toLowerCase() === active.username.toLowerCase()) {
                const fallback = { username: 'Test Player', role: 'user' };
                setDraft(fallback); apply(fallback);
              } else { setVersion(value => value + 1); }
              setMessage('Deleted.');
            })}>Delete</button>
          </div>
          {['admin', 'owner'].includes(active.role) && <label>Hybrid Campaign role<select value={chosen?.campaignRole || ''} disabled={!chosen} onChange={event => run(() => {
            if (!chosen || !event.target.value) return;
            accounts.assignCampaignRole(chosen.id, event.target.value);
            setMessage(`Campaign role assigned: ${label(event.target.value)}.`);
          })}><option value="">Choose saved account</option>{campaignRoles.map(role => <option key={role} value={role}>{label(role)}</option>)}</select></label>}
        </section>
      </div>
      <p role="status" aria-live="polite">{message}</p>
      {error && <p role="alert" className="error">{error}</p>}
      </div>
    </header>
    <section className="preview-content" key={version}>
      <Routes>
        <Route path="/projects" element={<ProjectPicker />} />
        <Route path="/projects/PyrrhicWar" element={<PyrrhicWar />} />
        <Route path="/projects/PyrrhicWarMap" element={<PyrrhicWarMap />} />
        <Route path="/projects/PyrrhicWarCompendium" element={<PyrrhicWarCompendium />} />
        <Route path="/projects/Expedition" element={<Expedition />} />
        <Route path="/projects/ExpeditionMap" element={<ExpeditionMap />} />
        <Route path="/projects/HybridCampaign" element={<HybridCampaign />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </section>
  </main>;
}

initialize().then(() => createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>))
  .catch(error => { document.getElementById('root').textContent = `Unable to start the preview: ${error.message}`; });
