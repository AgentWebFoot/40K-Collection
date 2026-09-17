# Atlas-Only Archive Record

## Decision and boundary

After the archive, the entire `origin/main` project remains active and intact.
From work introduced on `attempt-1`, retain only the Tavrellis Atlas player
page and the smallest account, preview-host, data, and test surface required
to open it at `#/atlas`.

Everything else introduced by this branch was moved on 2026-09-14 into the
Git-ignored local archive batch at
`Archive/2026-09-14 - atlas-only reduction/branch-source/`. The active branch
now uses the narrowed Atlas-only replacement modules described below.

## Immutable original-project baseline

No path or behavior that existed on `origin/main` may be archived, deleted,
renamed, or replaced. That includes all original projects, their assets,
preview routes, account behavior, tests, scripts, and documentation.

For pre-existing files modified by this branch, retain original content and
make any future change as a narrow edit to the branch-added Hybrid Campaign
hunk only.

## Retain from this branch

### Atlas experience

- The player-facing Tavrellis Atlas: map pins, digital labels, selected-world
  dossier, party-location marker, date display, priority reports, disabled
  future-terminal presentation, keyboard behavior, responsive layout, and
  Atlas-specific styling.
- Published player-safe Atlas data: locations, public descriptions and access,
  published consequences, player-facing urgent signals, campaign date, and
  public party-location state.
- Atlas assets only:
  - `public/backgrounds/tavrellis-command-bridge-frame.png`
  - `public/branding/inquisitorial-command-seal.png`
  - `public/world-atlas/tavrellis-system-unlabelled-map.png`

### Minimum integration needed to reach the Atlas

- Existing saved-account behavior remains unchanged. Retain only the
  branch-added Hybrid Campaign role assignment and account-to-player-profile
  binding needed to choose a player for the Atlas.
- Retain player onboarding only if a saved account has no Atlas profile, plus
  the approved-faction options it requires.
- Retain the local preview host only for the account/profile boundary and
  read-only Atlas projection.
- Retain `tsx` only if the remaining preview host remains TypeScript. Remove
  it if the Atlas host is converted to the original JavaScript preview model.
- Retain focused tests for onboarding, role binding, Atlas projection privacy,
  map coordinates, and keyboard selection.

## Archive from this branch

### Player features outside the Atlas

- Gilded Index display, catalogue, ceremony, exchange, recovery counter, and
  auction-pool presentation.
- Army Manager and roster management implementations.
- Player briefings, resources, and operation-briefing implementations. Their
  Atlas terminal treatment may remain visible but must be static and disabled;
  it must not import or request their archived features.

### GM and campaign-administration features

- GM control, market, rewards, objectives, history, campaign management,
  ledger, economy, GM access, operations, universal operation desk, and the
  GM World editor.
- Mission Truth, evidence, source-vault access, operation resolution, force
  records, roster imports, progression, economy mutation, travel planning,
  event control, audits, PostgreSQL scaffolding, and broad control-state
  projection.

### Assets outside the Atlas

- Gilded Index background and crest.
- All bidder, ceremony, exchange, and auction-pool images.
- The unused named Tavrellis map, unused guard portrait, and unused Dice Box
  directory.

## Required extraction work

The current code cannot be archived file-by-file because branch-created files
are mixed-purpose. Perform this extraction before moving the archive set:

1. Split `WorldPage.tsx` into a player-only Atlas module and a separate GM
   World-editor module. Retain only the former in the active project.
2. Replace the combined `App.tsx` with an Atlas-only route root. Its default
   route should be `#/atlas`; Atlas terminal modules remain disabled, local
   presentation only.
3. Replace the broad campaign service and API middleware with a dedicated
   read-only Atlas service. It must expose only profile/onboarding needs and
   an explicit player Atlas DTO; it must not import market, GM, mission,
   source-vault, or economy data.
4. Remove only the branch-added Hybrid Campaign routes, imports, account
   fields, API calls, test cases, scripts, package dependencies, and README
   text that support archived features. Preserve all `origin/main` behavior.
5. Keep the existing project picker and original projects exactly as they are.
   The Hybrid Campaign card may continue to open the Atlas, but the original
   cards and routes must remain unchanged.
6. Move every non-retained branch-created source file and asset together into
   the archive destination, then remove its active runtime references.

## Dependency decisions

| Branch dependency | Atlas-only disposition |
|---|---|
| `lucide-react` | Archive/remove; its only branch use is outside the retained Atlas. |
| `pg` and `PostgresCampaignRepository` | Archive/remove; Atlas preview is local and read-only. |
| `tsx` | Retain only if the extracted Atlas preview host remains TypeScript. |
| `catalogue.json`, bidder data, discovery templates | Archive with Gilded Index/GM code. |
| `market.ts`, `ceremony.ts`, `relay.ts`, `miren.css` | Archive after the Atlas obtains a small dedicated data client. |
| broad `types.ts` | Split; retain only explicit Atlas/profile DTOs. |

## Validation before archival completion

1. A clean install starts the original preview server and all original project
   routes still load unchanged.
2. A saved test player can reach `#/atlas`, see only player-safe data, select
   all sixteen map bodies, and use the map by keyboard.
3. The Atlas contains no active route, fetch, import, or bundled asset from
   the archived Gilded Index, GM, army, economy, operations, or source-vault
   feature set.
4. All three retained Atlas assets return HTTP 200; no archived asset is
   served from `/hybrid-campaign/assets/`.
5. Player API contract tests prove GM fields, source paths, travel notes,
   participant lists, and non-urgent pressures are absent.
6. Run typecheck, unit/API tests, browser responsive/accessibility checks,
   `git diff --check`, and a repository-wide reference scan before committing.

## Archive destination

The dated local archive batch preserves the source-tree layout and includes its
own `MANIFEST.md` with restoration guidance. It is intentionally Git-ignored:
it is easy to locate beside the project without returning retired work to the
active runtime or changing the protected original-project baseline.
