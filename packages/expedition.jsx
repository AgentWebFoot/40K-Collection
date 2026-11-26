import Menu from '../Expedition/Expedition.jsx';
import ExpeditionMap from '../Expedition/ExpeditionMap.jsx';
import ExpeditionTeams from '../Expedition/ExpeditionTeams.jsx';
import ExpeditionBattles from '../Expedition/ExpeditionBattles.jsx';
import ExpeditionLore from '../Expedition/ExpeditionLore.jsx';
import ExpeditionBounties from '../Expedition/ExpeditionBounties.jsx';
import ExpeditionShop from '../Expedition/ExpeditionShop.jsx';
import GameCompendium from '../preview/GameCompendium.jsx';
import { expeditionCompendium } from '../preview/compendium-data.mjs';

export { configureHost } from './host.mjs';

const projectPath = '/projects/Expedition';
const assets = '/games/Expedition';

function Expedition() {
  return <Menu compendiumPath={`${projectPath}Compendium`} />;
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

export const routes = [
  { path: projectPath, Component: Expedition },
  { path: `${projectPath}Compendium`, Component: ExpeditionCompendium },
  { path: `${projectPath}Map`, Component: ExpeditionMap },
  { path: `${projectPath}Teams`, Component: ExpeditionTeams },
  { path: `${projectPath}Bounties`, Component: ExpeditionBounties },
  { path: `${projectPath}Battles`, Component: ExpeditionBattles },
  { path: `${projectPath}Battles/settings`, Component: ExpeditionBattles, props: { settings: true } },
  { path: `${projectPath}Lore`, Component: ExpeditionLore },
  { path: `${projectPath}Shop`, Component: ExpeditionShop },
];
