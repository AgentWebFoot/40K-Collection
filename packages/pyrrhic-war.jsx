import PyrrhicWar from '../PyrrhicWar/PyrrhicWar.jsx';
import PyrrhicWarMap from '../PyrrhicWar/PyrrhicWarMap.jsx';
import GameCompendium from '../preview/GameCompendium.jsx';
import { pyrrhicWarCompendium } from '../preview/compendium-data.mjs';
import { API_URL, fetchJson } from './host.mjs';

export { configureHost } from './host.mjs';

const projectPath = '/projects/PyrrhicWar';
const assets = '/games/PyrrhicWar';

async function loadCompendium(signal) {
  const { response, payload } = await fetchJson('/pyrrhic-war/compendium/data', { signal });
  if (!response.ok) throw new Error(payload?.message || `Could not load Pyrrhic War data (HTTP ${response.status}).`);
  return payload;
}

function PyrrhicWarCompendium() {
  return <GameCompendium title="Pyrrhic War Compendium" projectId="pyrrhic-war"
    backTo={projectPath} loadData={loadCompendium} configure={pyrrhicWarCompendium}
    imageBaseUrl={`${API_URL}${assets}/compendium/images/`}
    themeUrl={`${assets}/compendium-theme.css`} pageStyleUrl={`${assets}/compendium-page.css`} />;
}

export const routes = [
  { path: projectPath, Component: PyrrhicWar },
  { path: `${projectPath}Map`, Component: PyrrhicWarMap },
  { path: `${projectPath}Compendium`, Component: PyrrhicWarCompendium },
];
