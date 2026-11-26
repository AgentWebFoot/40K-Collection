# 40K-Collection

## React test pages: Pyrrhic War and Expedition

The React account simulator is an optional local development setup. Its JSX
files, `preview/` folder, package manifests, and helper scripts belong in the
repository. Installed dependencies (`node_modules/`), Expedition saves under
`data/expedition/`, and JSON data under `Expedition/` and `PyrrhicWar/` are gitignored. The install script downloads
dependencies, but does not download campaign data.

To set up the simulator on another computer:

1. Install Node.js 20 or newer, including npm.
2. Clone this repository and copy your local campaign data into these paths:

   ```text
   Expedition/expeditionmap.json
   Expedition/location-compendium.json
   PyrrhicWar/campaign-map.json
   PyrrhicWar/pyrrhicCompendium.JSON
   ```

   Supply the location compendium on a new checkout. The Expedition map is an
   optional seed for the first run, and Pyrrhic War uses empty fixtures if its
   JSON files are absent.
3. On Windows, open PowerShell in the repository root and run the install script:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-preview.ps1
   ```

4. Launch the test page:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch-preview.ps1
   ```

   Open the URL printed by the server. Keep the terminal open while testing and
   press **Ctrl+C** to stop. The launch script does not reinstall dependencies.

Both scripts check Node.js and the required repository files and can be run
from any directory using their full paths. Add `-CheckOnly` to check prerequisites
without installing packages or starting the server. `-ExecutionPolicy Bypass`
applies only to that PowerShell process; it does not change your saved policy.

Alternatively, run the npm commands directly from the repository root:

   ```sh
   npm ci
   npm run dev
   ```

`npm ci` installs React, React DOM, React Router DOM, and esbuild using the
provided lockfile. If the local copy has no lockfile, use `npm install` instead.
You do not need to copy `node_modules` or install these packages globally.
On this computer, where the local files and dependencies already exist, just
use the launch script or run `npm run dev`.

Open **http://127.0.0.1:5173** and choose **Pyrrhic War** or **Expedition**.
Use the landing page's **Back** button to return to the project selection page.
Enter a username and select **User**, **Traveler**,
**Manager**, or **Owner**, then click **Apply**. Use the Pyrrhic War landing page to open the
Compendium or Crusade Board. The header remains visible on both pages.

The preview runs the original JSX components. Their missing website auth import
is resolved to `preview/auth.mjs` by the local JSX compiler. The server injects a
fetch adapter into the served iframe response before the page scripts run; the
existing HTML and JavaScript files on disk are unchanged. Refresh the browser
after changing JSX files to rebuild the preview.

The right side of the header lets you **Save**, **Load**,
or **Delete** a saved account. Save uses the username and site permission currently
entered on the left and applies that preview. Usernames are matched without case
sensitivity; saving an existing name updates its site permission and preserves its
game memberships. Saved accounts and assignments are shared by browsers using
the same local preview installation and stored in `data/expedition/accounts.json`.

To test game permission assignment:

1. Save one or more User or Traveler accounts. Both start as Pyrrhic War Viewers
   with no team assigned.
2. Apply or save a Manager or Owner account, then open the settings gear on the
   Pyrrhic War landing page or campaign board.
3. Saved accounts appear in the member list. Assign Viewer, Participant, Writer,
   or Admin access and a team there.
4. Load the saved account from the header to test its assigned game permissions.

Site Manager and Owner retain administrative Pyrrhic War access in the preview. Their inherited access
cannot be downgraded in game settings. Game admins can manage ordinary members;
only a site Owner can change an Owner's team. Deleting an account removes its game
assignment. These are local simulation rules, not production authorization.

The simulator loads the repository map and compendium JSON. Map saves, background
changes, account-specific favorites, request submission/listing/denial work in
memory and survive switching accounts. Refreshing the outer page resets them.
Applying, saving, loading, or deleting a preview reloads the current component
and discards unsaved edits. Saved accounts and membership assignments survive
refreshing the outer page; map changes, requests, and favorites do not.
The shared Compendium reader uses the tarball referenced in the root package
manifest. Pyrrhic War reads its existing compendium JSON, and Expedition groups
its location JSON by terrain. Select **Show Writer Tools**, then **Style Guide**
to save font, size, and heading color for the current project in this browser.
The local simulator returns explicit errors for content mutations, request
acceptance, and image management.

Run `npm test` to check the simulated access rules and supported API behavior.
The local server binds only to `127.0.0.1` and does not write campaign source documents.

## Install Expedition and Pyrrhic War in Travelers Tavern

From the 40K-Collection repository root, build the two npm tarballs:

```powershell
npm ci
npm run pack:games
```

The files are `dist/game-packages/agentwebfoot-expedition-0.1.0.tgz` and
`dist/game-packages/agentwebfoot-pyrrhic-war-0.1.0.tgz`. Use
`npm run pack:expedition -- 0.2.0` or `npm run pack:pyrrhic-war -- 0.2.0`
to release a game independently.

In Travelers Tavern, put the tarballs in `vendor/40k/` so the lockfile can
resolve them on another checkout. Install either game or both:

```powershell
npm install ./vendor/40k/agentwebfoot-expedition-0.1.0.tgz ./vendor/40k/agentwebfoot-pyrrhic-war-0.1.0.tgz
npm exec --offline -- expedition-assets
npm exec --offline -- pyrrhic-war-assets
```

The asset commands copy the map, board, and compendium assets into
`public/games/Expedition` and `public/games/PyrrhicWar`. Run them before
starting or building the host. When migrating a game, replace its Git-based
asset sync with the corresponding asset command so both sources do not write
to the same directory. Carry forward any Travelers Tavern patches the host
still needs before switching the production build.

In the Travelers Tavern frontend, configure the installed games with the
existing authentication module and add their route definitions to the
existing React Router `<Routes>`:

```jsx
import * as auth from './utils/auth';
import * as expedition from '@agentwebfoot/expedition';
import * as pyrrhicWar from '@agentwebfoot/pyrrhic-war';

expedition.configureHost(auth);
pyrrhicWar.configureHost(auth);

const gameRoutes = [...expedition.routes, ...pyrrhicWar.routes];

// Inside the existing <Routes>, replace duplicate routes for those games.
{gameRoutes.map(({ path, Component, props }) =>
  <Route key={path} path={path} element={<Component {...props} />} />
)}
```

The tarballs include the themed compendium readers and their Style Guides.
Travelers Tavern still provides campaign data, authentication, and the API
endpoints the game screens use. Expedition reads location content from
`/games/Expedition/location-compendium.json`, and Pyrrhic War reads compendium
data from `/pyrrhic-war/compendium/data`. Check the hosted backend's coverage
for the newer Expedition screens before enabling them in production.

## Tavrellis Player Command Deck

The **Warhammer Projects** section includes a local Tavrellis player Atlas. It
reuses the preview server's saved accounts, with a separate Hybrid
Campaign player role and one-time character/faction onboarding. The command
deck is deliberately read-only: it displays only the public Atlas projection,
and its future terminal surfaces are visibly inactive.

The preview persists only local Atlas player profiles at
`HybridCampaign/.campaign-preview-state.json`. That ignored file is not a
replacement for hosted authentication. The Atlas is served under
`/hybrid-campaign/`; only its three required visual assets are publicly served.

Expedition uses the same saved site accounts and compact, collapsible header.
Open Expedition Settings as a site Manager, Expedition Admin, or Owner to assign
Viewer, Traveler, or Admin to a saved account. Team assignments and round changes
require Expedition Admin or Owner access.
The site role and Expedition role can be assigned independently. Accounts without
an Expedition assignment start as Viewer with no team, and site Owners retain
Expedition Owner access. Saved site Admin accounts load as Managers and keep their
explicit Expedition assignments.

The Expedition simulator supports map and round saves, team points, member
assignments, request submission and editing, personal and admin request lists,
cancellation, denial, and reading request history. Use **Battles → Pending Reviews**
to confirm reports involving your team. The report enters the Battle Log once all
other Expedition participants confirm, or when an Expedition Admin or Owner
approves it directly. Outside players require no confirmation. Admins can edit battle
rewards in **Battles → Settings**. Reports, team balances, rosters, map edits,
memberships, and admin settings persist on disk. Other map requests last until the
preview server restarts. Admins can
also approve resupply and point-only Search and Manoeuvre requests. Approval of other
requests, history deletion, and bounty mutations return explicit errors. The
bounty list starts empty. Open **Compendium** from the Expedition landing page
to browse its map locations.

### Expedition save files

`npm run build` and `npm run dev` create missing files in `data/expedition/`.
They keep any file already in that directory. Set `EXPEDITION_DATA_DIRECTORY`
to use a different directory for a local installation or server. Keep the
directory outside the public build output and give each installation its own path.

| File | Contents |
| --- | --- |
| `map.json` | Map geometry and tile data |
| `teams/<color>.json` | The team's roster, lore, faction and purchased equipment, and point and credit balances |
| `bounties.json` | Bounty listings and the preview's pending-request data |
| `shop.json` | Storefront catalog and stock |
| `battles.json` | Battle reports, confirmations, equipment use, and rewards |
| `lore.json` | Team lore posts, campaign rounds, and linked tile and battle IDs |
| `settings.json`, `universal-equipment.json`, and `accounts.json` | Campaign settings, shared equipment rules, and saved accounts and assignments |

On first start, the preview reads map geometry and starting balances from
`Expedition/expeditionmap.json` if present. A browser with older preview saves can
import them when it opens an untouched save directory. The preview leaves the
copy in browser storage available for recovery. Once the files contain saves,
opening the app from another browser uses the installation's saved data.

If launch reports that port 5173 is already in use, the preview may already be
running: open **http://127.0.0.1:5173**. To restart it, press **Ctrl+C** in the
terminal that started it, then run the launch script again. Stop the preview
before running the install script; otherwise Windows can lock `esbuild.exe` and
cause an `EPERM` install error. After a failed install, stop the preview and run
the install script again before launching. The scripts check the port before
launching or installing and explain how to resolve a conflict.

The following is the collection of programs I created for use with Travelers Tavern for Warhammer 40k. Warhammer 40k is a Wargame designed to play with hand painted and assembled miniatures. The following are projects that are currently appart of this collection:

## Kill Team Campaign
Warhammer Kill Team is a secondary game system found within the Warhammer 40k universe. Instead of leading an entire army, players control an elite strike force style team known as a Kill Team. Recently, the Ctesiphus Expedition was released, allowing for narrative Kill Team games, where you explore a long lost hostile necron planet while earning and spending points in battles to perform actions and set up camps. The following is two different web based applications I created to assist with running a Ctesiphus Expedition campaign:
- The first is a map designer program which allows you to easily build maps, track team locations and bases, and log information about what tiles have or have not been explored.
- The second is a map viewer which is currently live on the Travelers Tavern website. This map viewer allows for the viewing of the map itself without actually for the editing of it.

## 40k Grid
This program is designed to allow for the creation of custom battlefield layouts for Warhammer 40k. This project from the collection is currently on hiatus. 

## Kill Team Character Sheet
Currently, if one wants to create their own custom Kill Team units or NPO (Non-Player Operatives) within the game of Warhammer Kill Team, there is no true official template. The goal of this project was to create that template for people to utilize. This project from the collection is currently on hiatus. 
