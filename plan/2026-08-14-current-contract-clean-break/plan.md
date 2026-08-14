---
status: completed
experience: candidate
---

# Current Contract Clean Break

## Goal

Replace the remaining legacy/compatibility circuit-authoring paths with one
current, exact contract. Preserve both ordinary `port` and `port-filled`
component assets and the browser's existing component-terminal drawing,
snapping, routing, and connectivity behavior. Remove the visual/model
first-class Port path, the legacy VDD symbol, standalone `nmos3`/`pmos3`
assets, symbol-id alias routing, inferred power/MOS-bulk fallbacks, renderer
text fallback, legacy Project/API readers, and divergent GUI/Agent MOS variant
defaults. Publish a catalog-driven current Agent API and a thin client state
machine for claim, request-id, revision, dry-run/commit, render, and recovery.

Razavi visual lint is explicitly out of scope for this target.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-transport-watchdog...origin/codex/agent-transport-watchdog
```

The worktree is clean. The user explicitly requested that this complete target
continue on the current branch; the existing transport-watchdog commit is the
branch baseline and has no uncommitted ownership overlap.

Owned paths:

- `packages/model/**`
- `packages/symbols/**`
- `packages/derived/**`
- `packages/edit-engine/**`
- `packages/render-svg/**`
- `packages/spice/**`
- `packages/netlist/**`
- `packages/agent-adapter/**`
- `apps/editor/**`
- `apps/local-host/**` when the single Agent API changes its loopback surface
- `workers/agent-relay/**` when hosted request validation/versioning changes
- current Agent, Project, symbol, and visual-contract documentation under
  `docs/**`
- affected current fixtures, generated OpenAPI/catalog artifacts, tests, and
  root workspace metadata
- this plan, `plan/root-audit.md`, and `plan/log.md`

Shared dependencies and risk surfaces:

- Project schema and persisted fixtures are intentionally breaking; old
  schema versions must fail rather than migrate.
- The public hosted Agent contract and generated OpenAPI must remain aligned
  with the browser host and Worker relay.
- Both `port` and `port-filled` are current assets and must remain manually
  reachable and electrically connectable through ordinary Instance terminal
  wiring.
- Current exact SPICE-to-canonical-symbol mappings remain supported; legacy
  symbol aliases and guessed asset/power mappings do not.
- `annotation.anchor.fallbackPosition`, transport recovery, and other current
  non-asset meanings of "fallback" are not legacy routing and must not be
  removed indiscriminately.

## Work

1. Inventory current assets, compatibility entry points, generated artifacts,
   and browser/Agent connection behavior; encode the retained and forbidden
   contract in characterization tests.
2. Remove first-class model/Agent/render/editor Ports while preserving both
   `port` and `port-filled` as normal single-pin components and preserving
   their existing manual drawing/connection behavior.
3. Remove the VDD symbol and all of its palette, resolver, netlist, importer,
   fixture, generated, and documentation paths. Make VDD rail creation and
   explicit Net/Junction/terminal wiring the sole VDD authoring path.
4. Remove standalone `nmos3`/`pmos3`; keep canonical four-terminal
   `nmos`/`pmos`, make `textbook-3terminal` the shared deterministic default
   visual variant, and retain explicit bulk-capable electrical semantics.
5. Remove symbol-id aliases from runtime resolution. If search synonyms remain
   useful, keep them as non-resolvable catalog search metadata only.
6. Remove product power/MOS-bulk inference, synthetic `net-global-vdd`/`0`,
   entry-time materialization, and legacy power normalization. Require an
   existing explicit Net for configured or explicit bulk connectivity.
7. Remove renderer-created instance text, whitespace suppressors, legacy text
   parsing/migration, and duplicate presentation authorities. Persist every
   visible editable label as canonical RichText annotation content.
8. Cut Project persistence to the new current schema and remove old automatic
   migration entry points and fixtures. Preserve only current exact validation.
9. Cut the Agent surface to one current catalog-capable version, remove v1/v2
   compatibility request/response paths, regenerate OpenAPI/instructions, and
   ensure every advertised symbol/tool is executable from a reachable state.
10. Add an official thin browser session state machine and retain the existing
    relay safeguards for latest-token replacement, request-id payload binding,
    revision/dry-run discipline, unknown-write recovery, render/refresh, and
    bounded File Resource approval boundaries. Publish the client lifecycle in
    the current API instructions rather than adding a second client package.
11. Update current documentation and deterministic fixtures; delete obsolete
    assets, references, generated output, tests, and historical production
    instructions that would revive a removed path.

## Validation

- Focused model/schema/persistence tests proving only the current Project
  schema is accepted and no first-class Port remains.
- Focused symbol/catalog/resolver tests proving `port` and `port-filled` remain
  exact canonical assets; `vdd`, `nmos3`, `pmos3`, and former aliases fail.
- Focused edit/derived/render tests proving VDD rail and MOS bulk connectivity
  use real explicit Nets and renderer text has one persisted authority.
- Focused Agent adapter/OpenAPI/browser state-machine tests for the sole API
  version, catalog closure, claim/token secrecy, capabilities-once, request-id
  payload binding, stale revisions, unknown-commit recovery, dry-run/commit,
  render/fresh-snapshot, and File Resource approval boundaries.
- Browser E2E for both `port` and `port-filled`: insert, draw from `P`, connect
  to a component terminal, move/transform while retaining endpoint geometry,
  and delete without leaving stale connectivity.
- Browser/Agent E2E creating an inverter with `port` or `port-filled`, Ground,
  canonical MOS default variants, and a VDD rail, with no VDD Instance,
  first-class Port, duplicate implicit label, or disconnected same-name VDD
  Net.
- Asset/catalog/OpenAPI generation checks.
- `pnpm verify:branch` because the change crosses model, edit, render, symbols,
  browser, Worker, and public Agent contracts.
- `pnpm install --frozen-lockfile` followed by `pnpm ci:check` before delivery
  because this is a non-document branch intended for remote review.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit the interdependent contract cut as one bounded implementation commit on
the current branch, followed by a factual plan/log close-out:

```text
refactor(circuit): remove legacy contract routing
plan: complete current contract clean break
```

## Outcome

Removed the legacy Project/Port, symbol alias, VDD symbol, standalone MOS3,
inferred power, implicit text, and multi-version Agent paths. Both `port` and
`port-filled` remain ordinary single-pin component assets; canonical MOS uses
the `textbook-3terminal` default; VDD is an explicit rail; the sole Agent 2.0
surface is guarded by the browser session state machine. Current fixtures,
documentation, OpenAPI/catalog artifacts, and export goldens were regenerated.

Validation passed: 541 unit tests, all workspace builds, `pnpm verify:branch`,
the frozen-lockfile install, full `pnpm ci:check`, and all 95 browser E2E tests.
The repeated legacy-routing failure is retained as an experience candidate for
later human disposition; no experience note was extracted automatically.
