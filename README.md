# 40K-Collection

## React test pages: Pyrrhic War and Expedition

The React account simulator is an optional local development setup. Its JSX
files, `preview/` folder, package manifests, and helper scripts belong in the
repository. Installed dependencies (`node_modules/`) and JSON data under
`Expedition/` and `PyrrhicWar/` are gitignored. The install script downloads
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

   These files are kept locally and must be supplied separately on a new checkout.
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
**Admin**, or **Owner**, then click **Apply**. Use the Pyrrhic War landing page to open the
Compendium or Crusade Board. The header remains visible on both pages.

The preview runs the original JSX components. Their missing website auth import
is resolved to `preview/auth.mjs` by the local JSX compiler. The server injects a
fetch adapter into the served iframe response before the page scripts run; the
existing HTML and JavaScript files on disk are unchanged. Restart `npm run dev`
after changing JSX files to rebuild the preview.

The right side of the header lets you **Save**, **Load**,
or **Delete** a saved account. Save uses the username and site permission currently
entered on the left and applies that preview. Usernames are matched without case
sensitivity; saving an existing name updates its site permission and preserves its
Pyrrhic War membership. Saved accounts and game assignments persist in this
browser's local storage, separately for each host and port.

To test game permission assignment:

1. Save one or more User or Traveler accounts. Both start as Pyrrhic War Viewers
   with no team assigned.
2. Apply or save an Admin or Owner account, then open the settings gear on the
   Pyrrhic War landing page or campaign board.
3. Saved accounts appear in the member list. Assign Viewer, Participant, Writer,
   or Admin access and a team there.
4. Load the saved account from the header to test its assigned game permissions.

Site Admin and Owner retain administrative game access. Their inherited access
cannot be downgraded in game settings. Game admins can manage ordinary members;
only a site Owner can change an Owner's team. Deleting an account removes its game
assignment. These are local simulation rules, not production authorization.

The simulator loads the repository map and compendium JSON. Map saves, background
changes, account-specific favorites, request submission/listing/denial work in
memory and survive switching accounts. Refreshing the outer page resets them.
Applying, saving, loading, or deleting a preview reloads the current component
and discards unsaved edits. Saved accounts and membership assignments survive
refreshing the outer page; map changes, requests, and favorites do not.
Compendium mutations, request acceptance, and image management
are not implemented: they return explicit errors. The embedded compendium
still needs internet access for its existing React CDN scripts.

Run `npm test` to check the simulated access rules and supported API behavior.
The local server binds only to `127.0.0.1` and does not write campaign source documents.

## Tavrellis Player Command Deck

The **Warhammer Projects** section includes a local Tavrellis player Atlas. It
reuses the existing browser-local saved accounts, with a separate Hybrid
Campaign player role and one-time character/faction onboarding. The command
deck is deliberately read-only: it displays only the public Atlas projection,
and its future terminal surfaces are visibly inactive.

The preview persists only local Atlas player profiles at
`HybridCampaign/.campaign-preview-state.json`. That ignored file is not a
replacement for hosted authentication. The Atlas is served under
`/hybrid-campaign/`; only its three required visual assets are publicly served.

Expedition uses the same saved site accounts and compact, collapsible header.
Its game assignments are separate from Pyrrhic War: open the Expedition map as
an Admin or Owner, then use its settings to assign Viewer, Traveler, or Admin
and a color team to a saved account. Existing saved accounts remain available;
accounts without an Expedition assignment start as Viewer with no team. Site
Admins and Owners retain administrative access in both games.

The Expedition simulator supports map and round saves, team points, member
assignments, request submission and editing, personal and admin request lists,
cancellation, denial, and reading request history. Memberships persist in browser
storage; map and request changes last until the outer page is refreshed and stay
separate from Pyrrhic War. Request acceptance, history deletion, and bounty
mutations are not simulated and return explicit errors. The bounty list starts
empty. Expedition's Compendium is unavailable in the supplied landing page.
The original Expedition HTML and map assets are served without modifying files.

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
