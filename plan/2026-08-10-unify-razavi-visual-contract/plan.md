# Unify the Razavi Visual Contract

## Goal

Replace the scattered Razavi style, extension, and pixel-alignment rules with
one normative Markdown contract, while preserving both hollow and filled Port
symbols and every existing construction and fidelity method. Replace the
fidelity CLI's hard-coded device registry with one hash-pinned declarative
registry owned by the Razavi reference fixture.

## Dirty-State Decision

The worktree contains concurrent editor, model, derived, renderer, E2E, plan,
and log changes. `packages/render-svg/src/render.ts` is therefore read-only even
though the unified contract describes its behavior. The specification files,
reference manifest, fidelity CLI, and new registry owned by this target are
currently clean. `plan/log.md` contains unrelated concurrent entries; this
target will append only an isolated factual entry and will not stage or rewrite
the existing hunks.

The preceding experience-extraction target also has uncommitted documentation
changes. They are related context but remain separately owned; this target may
link to that experience note but will not fold it into the normative contract.

## Owned Paths

- `docs/specs/razavi-visual-contract.md`
- `docs/specs/razavi-textbook-style.md`
- `docs/specs/razavi-component-extension.md`
- Razavi-specific references in `docs/specs/visual-language.md`
- `docs/specs/README.md`
- `docs/current/README.md`
- direct active-document links in `docs/adr/0011-retire-visio-vss-as-visual-authority.md`,
  `docs/architecture-and-pipeline-review.md`,
  `docs/roadmap/phase-5-symbols-and-visual-quality.md`, and
  `docs/agent/knowledge/razavi-style-canon.md`
- the normative-entry link in
  `docs/experience/razavi-symbol-construction-and-pixel-calibration.md`
- `fixtures/visual-reference/razavi-reference-v1/fidelity-targets.json`
- the fidelity-registry hash/path fields in
  `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/razavi-fidelity-diff.mjs`
- `scripts/lib/razavi-reference-authority.mjs`
- fidelity-registry validation in `scripts/generate-razavi-symbol-catalog.mjs`
- the stale formal-Port profile-color assertion in
  `packages/render-svg/src/render.test.ts`
- `plan/2026-08-10-unify-razavi-visual-contract/plan.md`
- one isolated appended entry in `plan/log.md`

## Read-Only Paths

- all `*.png` reference assets and existing `*-geometry.json` measurements
- `packages/symbols/assets/razavi-v1/*.symbol.json` and `catalog.json`
- `packages/render-svg/src/render.ts`, all other renderer files,
  `packages/derived/**`, and all concurrent dirty code
- the preceding experience target plan and all other `docs/experience/**` paths
- `lib/circuit.vss` and retired VSS tooling

## Shared Dependencies

- ADR 0011 sole-authority decision
- Symbol DSL electrical-pin and primitive contracts
- existing hollow `port`, filled `port-filled`, formal Port, and Junction
  behavior
- current fidelity metrics, rasterization, and output behavior
- catalog generation and `symbols:razavi:check`

## Expected Work

1. Create one accepted Razavi visual contract covering authority, Port
   semantics, coordinate ownership, symbol construction, registration,
   exposure, IoU/soft-IoU diagnostics, failure behavior, and extension steps.
2. Convert the two replaced Razavi specs into short superseded redirects and
   update documentation navigation.
3. Correct the generic visual-language statement so formal Port, hollow Port
   symbol, filled Port symbol, and Junction are not conflated.
4. Move every current fidelity target declaration into one reference-owned
   JSON registry without changing the target set or rendering behavior.
5. Hash-pin and validate the registry through `symbols:razavi:check`, then make
   the fidelity CLI load it instead of a hard-coded object.

## Validation

- verify the registry contains the exact pre-change target set and mappings
- run Prettier on owned JSON/MJS/Markdown paths
- run `pnpm symbols:razavi:check`
- build Symbols, Model, Derived, Render-SVG, and Exporters as required by the
  fidelity CLI
- run representative symbol and formal-scene fidelity targets
- verify documentation links and redirect targets
- run `git diff --check` and inspect target-only status/diff

## Commit Intent

Keep the contract/registry consolidation isolated from concurrent editor and
renderer work. Commit only if the owned files and isolated log hunk can be
staged without mixing other targets.

## Outcome

- Added `razavi-visual-contract.md` as the sole Razavi-specific normative
  contract, including distinct formal/hollow/filled Port semantics and the
  complete current executable profile token table.
- Replaced the two former Razavi specs with stable redirects and updated active
  documentation and experience links.
- Replaced the fidelity CLI's hard-coded target table with a 15-target,
  manifest-pinned registry. All targets now have fixed reference-owned windows;
  the seven previous candidate-derived windows were frozen at their existing
  values without changing scores.
- Added one shared authority loader used by catalog validation and the fidelity
  runner to verify every manifest-pinned raster, measurement, and registry.
- Validation passed: authority/catalog check, five package builds, all-target
  fidelity run, catalog Vitest 17/17, formal-Port Vitest 1/1, Prettier, local
  links, and `git diff --check`.
- Left the target uncommitted because unrelated concurrent work remains in the
  branch and shared `plan/log.md`; no mixed staging was performed.
