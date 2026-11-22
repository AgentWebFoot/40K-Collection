# Atlas-Only Archive Audit

**Audit date:** 2026-09-14
**Branch reviewed:** `attempt-1`
**Baseline protected:** `origin/main` at `ad204b2`
**Decision boundary:** retain every original-project file unchanged. From this branch's work, retain only the player Atlas command deck, its direct read-only data/account support, and the three assets it renders. Everything else introduced by this branch is an archive candidate.

## Scope and non-negotiable rules

This is a proposed archive manifest, not an executed archive. No files have been moved or deleted by this audit.

1. Nothing that existed in `origin/main` is in scope for archival, relocation, or removal.
2. The active implementation after the work must still provide the Hybrid Campaign entry point and the player Atlas at `#/atlas`.
3. The Atlas must keep its saved local account/test-player flow because the page needs a character name, faction-bound identity, and persistent test fixtures.
4. The Atlas remains player-safe and read-only. It may show published worlds, public dossiers, published urgent signals, campaign date, and a published location assignment. It must not carry forward GM workflow, auction, roster, resource, operation, or exchange implementations merely because they are adjacent in the present branch.
5. Each archive batch belongs under the Git-ignored local folder `Archive/YYYY-MM-DD - atlas-only reduction/`. Its `MANIFEST.md` must identify the source path, archive path, reason, dependency replacement, and restoration instructions.

## Retain in the active branch

These are the only branch-delivered capabilities that remain active. Several currently share files with unrelated functionality, so the listed files must be **extracted or rewritten**, not retained wholesale.

| Required active capability | Current source | Required active outcome |
| --- | --- | --- |
| Hybrid Campaign preview entry point | `preview/app.jsx`, `preview/server.mjs`, `HybridCampaign/HybridCampaign.jsx` | Preserve only the Hybrid card/route and the wrapper that starts the Atlas. Do not disturb original project cards or routes. |
| Account-selected player identity and onboarding | `preview/accounts.mjs`, `preview/auth.mjs`, `HybridCampaign/HybridCampaign.jsx`, `HybridCampaign/test-player-fixtures.mjs` | Retain only the lightweight role/profile binding, approved faction choices, onboarding, and persistent per-faction dummy players required to render a named player Atlas. |
| Read-only player Atlas | `HybridCampaign/src/features/world/WorldPage.tsx`, `HybridCampaign/src/App.tsx`, `HybridCampaign/src/styles.css`, `HybridCampaign/src/runtime.ts`, `HybridCampaign/src/types.ts` | Extract a dedicated Atlas root, view model/types, request function, and Atlas-only stylesheet. Keep map pins, labels, selection, dossier, signal rail, party marker, date display, keyboard support, responsive layout, and inactive terminal surfaces. |
| Public campaign projection | `HybridCampaign/server/preview-host.ts`, `HybridCampaign/server/campaign-service.ts`, `HybridCampaign/server/api-middleware.ts`, `HybridCampaign/server/world-seeds.ts` | Replace broad campaign service/API with a minimal Atlas endpoint that returns only the player-safe fields actually rendered: campaign date, published location records/map coordinates, public dossier fields/consequences, published urgent signals, and a published party location where available. |
| Three Atlas assets | paths below | Keep only the actual command-deck frame, Inquisition seal, and unlabelled Tavrellis map. |

### Assets to retain

- `HybridCampaign/public/backgrounds/tavrellis-command-bridge-frame.png`
- `HybridCampaign/public/branding/inquisitorial-command-seal.png`
- `HybridCampaign/public/world-atlas/tavrellis-system-unlabelled-map.png`

## Archive whole files and directories

These branch-added files have no direct Atlas responsibility under the narrowed scope. Archive them as complete units after their active references are removed.

### Gilded Index, auction, exchange, ceremony, and rewards

```text
HybridCampaign/src/ceremony.ts
HybridCampaign/src/market.ts
HybridCampaign/src/relay.ts
HybridCampaign/src/miren.css
HybridCampaign/src/components/CeremonyCommand.tsx
HybridCampaign/src/components/Dossier.tsx
HybridCampaign/src/components/GovernancePanel.tsx
HybridCampaign/src/components/MarketModal.tsx
HybridCampaign/src/data/bidders.ts
HybridCampaign/src/data/catalogue.json
HybridCampaign/src/data/discoveryTemplates.ts
HybridCampaign/src/features/market/AuctionDesk.tsx
HybridCampaign/src/features/objectives/ObjectiveRegister.tsx
HybridCampaign/src/features/history/ClosedHistory.tsx
HybridCampaign/src/features/rewards/RewardsPage.tsx
HybridCampaign/src/features/player/PlayerRoutes.tsx
```

### Army, resource, briefing, operation, and GM control workflows

```text
HybridCampaign/src/features/army/ArmyPage.tsx
HybridCampaign/src/features/campaign/CampaignLedger.tsx
HybridCampaign/src/features/campaign/CampaignManagement.tsx
HybridCampaign/src/features/campaign/EconomyPage.tsx
HybridCampaign/src/features/campaign/GmAccess.tsx
HybridCampaign/src/features/operations/OperationsPage.tsx
HybridCampaign/src/features/operations/PlayerOperations.tsx
HybridCampaign/src/features/operations/UniversalOperationDesk.tsx
HybridCampaign/src/features/player/AuthGateway.tsx
HybridCampaign/src/ui/AtTableShell.tsx
HybridCampaign/src/ui/CommitContext.tsx
HybridCampaign/src/ui/ErrorDialog.tsx
HybridCampaign/src/main.tsx
HybridCampaign/src/campaign-time.ts
HybridCampaign/server/source-manifest.json
```

### Broad implementation files to archive only after narrow replacements exist

The following are mixed-purpose. They cannot be simply moved until their Atlas-only replacement is active and verified.

| Current file | Why it cannot remain as-is | Archive action after replacement |
| --- | --- | --- |
| `HybridCampaign/src/App.tsx` | Routes into the Gilded Index, GM controls, armies, briefings, resources, and operations. | Replace with an Atlas-only root (or extract a new root), then archive the present router. |
| `HybridCampaign/src/features/world/WorldPage.tsx` | Contains both the retained player Atlas and GM world management/editor logic. | Move `PlayerAtlas` and its small helpers into an Atlas-specific component; archive this mixed page. |
| `HybridCampaign/src/styles.css` | Contains global styles for the Atlas plus all other branch interfaces. | Extract only Atlas selectors into `atlas.css`; archive the broad stylesheet. |
| `HybridCampaign/src/types.ts` | Defines models for the entire campaign implementation, including non-player-safe shapes. | Define a narrow `atlas-types.ts`; archive the broad type file. |
| `HybridCampaign/server/campaign-service.ts` | Provides broad campaign authority and previously exposed fields outside the Atlas projection. | Replace with a read-only Atlas projection service; archive it. |
| `HybridCampaign/server/api-middleware.ts` | Handles a broader API surface than this player page requires. | Replace with one narrow Atlas request handler; archive it. |
| `HybridCampaign/server/preview-host.ts` | Hosts all branch features and broad state. | Retain only the small request wiring/test-account persistence needed by the reduced endpoint, or split it and archive the feature host. |
| `HybridCampaign/server/world-seeds.ts` | Contains more campaign/world data than the player Atlas may need. | Extract just public location records, stored map coordinates, date, and player-facing urgent signals; archive the original seed module. |
| `HybridCampaign/src/runtime.ts` | Includes runtime/client behaviors beyond the one Atlas fetch path. | Keep only a minimal public Atlas fetch helper if still useful; otherwise inline it and archive this file. |
| `HybridCampaign/HybridCampaign.jsx` | Imports the broad application and legacy feature styling. | Rewrite as the local account/onboarding + Atlas wrapper only; archive the current broad wrapper. |

## Archive branch-added assets

There are **35** branch-added public assets in the reviewed commit. Three are retained for Atlas, leaving **32 archive candidates**. None belongs in the active Atlas bundle after reduction.

### Gilded Index and auction presentation

```text
HybridCampaign/public/backgrounds/gilded-index-auction-salon-background.png
HybridCampaign/public/branding/gilded-index-crest-emblem.png
HybridCampaign/public/bidders/
HybridCampaign/public/ceremony/cassian-verid-opening-portrait.png
HybridCampaign/public/ceremony/garran-thule-miren-evacuation.png
HybridCampaign/public/ceremony/gilded-index-guard-detail-portrait.png
HybridCampaign/public/ceremony/miren-quill-rostrum-portrait.png
HybridCampaign/public/exchange/miren-quill-counter-portrait.png
HybridCampaign/public/pool-reveals/
```

### Superseded and unused Atlas/image assets

```text
HybridCampaign/public/world-atlas/tavrellis-system-named-map.png
```

The named map is not retained because the active Atlas correctly renders labels as accessible HTML overlays over the unlabelled base map. Keeping both would preserve a redundant, large asset and risks labels diverging.

### Dice Box runtime assets

```text
HybridCampaign/public/dice-box-assets/
```

These seven tracked files were branch-added for a feature outside the Atlas. The current working tree already reports them as missing; this audit does not treat that as permission to delete or silently discard them. Their tracked versions must be recovered into the dated archive batch before they are removed from active branch history/worktree state.

## Required edits to pre-existing files

These files predate the branch and are protected. Retain only the minimal branch hunks that keep the Atlas operable; do not archive or replace the original file as a whole.

| Protected file | Keep from branch | Remove/revert from branch |
| --- | --- | --- |
| `.gitignore` | `/Archive/` rule and any necessary local Atlas test snapshot exclusion. | Unrelated ignore entries introduced by branch work. |
| `package.json`, `package-lock.json` | Only runtime/build packages demonstrably required by the reduced Atlas host. | `lucide-react`, `pg`, and any other dependency used solely by archived features. Keep `tsx` only if the remaining server still needs TypeScript execution. |
| `preview/accounts.mjs` | Account/profile persistence and per-faction test identities required by Atlas. | State or helpers used solely by Gilded Index/GM workflow. |
| `preview/app.jsx` | Hybrid Campaign import, card, and route. | No original cards or routes may be changed. |
| `preview/auth.mjs` | Atlas-compatible local identity synchronization only. | Branch behaviors for archived screens. |
| `preview/server.mjs` | Static serving and the small Atlas API route. | Broad Hybrid service routes and any obsolete proxy/middleware. |
| `preview/mock-api.test.mjs` | Existing tests plus Atlas account/endpoint assertions. | Assertions tied only to archived features. |
| `preview/style.css` | Only styling necessary for the existing project picker to expose Hybrid Campaign. | Branch styling for archived page shells. |
| `scripts/install-preview.ps1`, `scripts/launch-preview.ps1`, `scripts/preview-port.ps1` | Minimal launch support required to run the reduced Atlas preview. | Feature-specific startup or service code no longer needed. |
| `README.md` | A concise Atlas-preview note only if useful. | Claims that the archived Gilded Index/GM feature set remains active. |

## Required new/reduced active shape

The archive is safe only if active source dependencies resolve to a small, explicit surface. A suitable target is:

```text
HybridCampaign/
  HybridCampaign.jsx                 # local profile/onboarding + Atlas wrapper
  test-player-fixtures.mjs           # persistent dummy player per approved faction
  public/
    backgrounds/tavrellis-command-bridge-frame.png
    branding/inquisitorial-command-seal.png
    world-atlas/tavrellis-system-unlabelled-map.png
  server/
    atlas-service.ts                  # player-safe read-only DTO construction
    atlas-api.ts                      # single request handler, if separate
    atlas-seeds.ts                    # only public Atlas seed fields
  src/
    AtlasApp.tsx
    features/atlas/PlayerAtlas.tsx
    features/atlas/atlas-types.ts
    features/atlas/atlas.css
    features/atlas/runtime.ts         # only if fetch helper remains warranted
```

Names are implementation guidance, not a demand for this exact folder structure. The important constraint is that retained code has no import, API request, or runtime asset dependency on archived content.

## Archive order and validation gates

1. Create the reduced Atlas modules and point the existing Hybrid preview route to them.
2. Replace broad server behavior with a player-safe read-only Atlas response. Do not expose source references, routes, travel participant lists/notes, assets, evidence, GM records, unpublished worlds, or hidden pressure data.
3. Prove the saved test-player fixtures persist across preview restarts and that every approved faction still has one selectable test account.
4. Remove active imports/references to every planned archive path. Search source, CSS, tests, scripts, and preview host before moving files.
5. Restore the seven missing Dice Box files from Git into the archive batch, then move all approved branch-only candidates into `Archive/YYYY-MM-DD - atlas-only reduction/` with a complete `MANIFEST.md`.
6. Remove those files from the active branch, not from the original project baseline.
7. Remove unneeded dependencies and refresh the lockfile.
8. Verify the following before considering the reduction complete:
   - original project picker and every original project route still load;
   - `#/atlas` loads for a saved test player and for onboarding;
   - all 16 published bodies select the correct public dossier by mouse, Enter, and Space;
   - only the three retained assets are requested by the Atlas;
   - the date, party marker, signals, map labels, dossier, and inactive terminal display remain functional and accessible;
   - terminal surfaces remain inert—no navigation or mutation endpoints exist;
   - public response/DOM contains no GM-only fields;
   - `npm test` and a production build pass; and
   - `git diff --check` is clean.

## Explicit exclusions from this archive

The archive must not contain, alter, or delete any file that was already in `origin/main`, including the original project applications and their assets under `40kCrusadeBoard`, `40kGrid`, `Expedition`, `KillTeamCampaign`, `KillTeamCharacterSheet`, and `PyrrhicWar`.

### Protected-project compatibility exception

`preview/auth.mjs` retains one small branch-added fallback for absent ignored
seed files. The original Pyrrhic War and Expedition routes otherwise abort
during browser startup in this checkout because their local JSON fixtures return
404. The fallback supplies empty local data only when a seed is absent; it does
not modify original source data, grant access, or add a Hybrid feature. It is
retained to keep the protected original projects runnable alongside the Atlas.

## Remaining follow-up

The archive has been executed as a recoverable local batch and the archived
paths are removed from the active worktree. `package.json` and
`package-lock.json` still list `lucide-react` and `pg`; the active-source scan
finds no remaining runtime import of either. Their removal is deferred because
changing shared package dependencies needs separate confirmation that the
protected original preview does not rely on them.
