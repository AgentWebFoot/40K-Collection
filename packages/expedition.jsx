import { Link } from 'react-router-dom';
import Menu from '../Expedition/Expedition.jsx';
import ExpeditionMap from '../Expedition/ExpeditionMap.jsx';
import ExpeditionTeams from '../Expedition/ExpeditionTeams.jsx';
import ExpeditionBattles from '../Expedition/ExpeditionBattles.jsx';
import ExpeditionLore from '../Expedition/ExpeditionLore.jsx';
import ExpeditionBounties from '../Expedition/ExpeditionBounties.jsx';
import ExpeditionShop from '../Expedition/ExpeditionShop.jsx';
import GameCompendium from '../preview/GameCompendium.jsx';
import { expeditionCompendium } from '../preview/compendium-data.mjs';

import { hasCampaignTools } from './host.mjs';

export { configureHost } from './host.mjs';

const projectPath = '/projects/Expedition';
const assets = '/games/Expedition';

function Expedition() {
  return <Menu compendiumPath={`${projectPath}Compendium`} campaignTools={hasCampaignTools()} />;
}

async function loadLocations(signal) {
  const response = await fetch(`${assets}/location-compendium.json`, { signal });
  if (!response.ok) throw new Error(`Could not load Expedition locations (HTTP ${response.status}).`);
  return response.json();
}

function ExpeditionCompendium() {
  return <GameCompendium title="Expedition Compendium" projectId="expedition"
    backTo={projectPath} loadData={loadLocations} configure={expeditionCompendium}
    themeUrl={`${assets}/compendium-theme.css`} pageStyleUrl={`${assets}/compendium-page.css`} />;
}

function campaignPage(Page, title) {
  return function CampaignPage(props) {
    if (hasCampaignTools()) return <Page {...props} />;
    return <main style={{ minHeight: '100dvh', background: '#1e1e1e', color: '#fff', padding: '24px' }}>
      <Link to={projectPath} style={{ color: 'inherit' }}>‹ Expedition</Link>
      <h1>{title}</h1>
      <p>This page is unavailable on this server.</p>
    </main>;
  };
}

const battlesPage = campaignPage(ExpeditionBattles, 'Battles');

export const routes = [
  { path: projectPath, Component: Expedition },
  { path: `${projectPath}Compendium`, Component: ExpeditionCompendium },
  { path: `${projectPath}Map`, Component: ExpeditionMap },
  { path: `${projectPath}Teams`, Component: campaignPage(ExpeditionTeams, 'Team Management') },
  { path: `${projectPath}Bounties`, Component: ExpeditionBounties },
  { path: `${projectPath}Battles`, Component: battlesPage },
  { path: `${projectPath}Battles/settings`, Component: battlesPage, props: { settings: true } },
  { path: `${projectPath}Lore`, Component: campaignPage(ExpeditionLore, 'Lore') },
  { path: `${projectPath}Shop`, Component: campaignPage(ExpeditionShop, 'Shop') },
];
