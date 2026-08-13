---
status: completed
experience: none
---

# Compatibility Corpus and Runtime-Retirement Audit

## Goal

Establish the first bounded M4 proof: an explicit current-versus-migration
corpus, with every supported historic Project proven to take one sequential
path to schema v8. Reconcile current user guidance with that supported file
boundary. A later M4 target may remove a compatibility reader only after this
corpus identifies it as obsolete. This target does not add simulation, PVT,
waveform, or design-netlist export.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean after M3. This target owns the compatibility corpus,
migration tests, any production readers proven redundant by those tests, and
the current Project/API/session/user documentation that describes support.

- `fixtures/projects/**` and explicit migration-input fixtures
- `packages/model/src/migration-*.ts` and migration/persistence tests
- focused model, derived, Agent and editor tests necessary for corpus evidence
- production compatibility readers only after the absence audit identifies
  them as obsolete
- `docs/specs/{project-file-format,schematic-model,agent-api,web-agent-session}.md`
- `docs/{agent,user}/**` current support wording
- `plan/log.md` and this target plan

Read-only shared dependencies:

- `docs/roadmap/agent-takeover-v2-completion-plan.md` (M4 exit contract)
- renderer/export golden fixtures and Agent generated artifacts; edit only if
  validation proves an intentional current-form update is required
- VDD, Port, RichText/VisualAnchor and typed-netlist migrations from M0--M3

## Work

1. Inventory all committed Project fixtures, determine their schema class,
   and divide them into immutable migration inputs versus canonical current
   Projects. Do not rewrite historic corpus inputs.
2. Add a corpus manifest/test that sequentially migrates every supported
   historic input and validates canonical reparse/save stability, typed
   electrical facts, and absence of retired current-form fields.
3. Add representative structural-SPICE import evidence for ordered terminal
   facts and immutable provenance, alongside the existing hierarchy, Port,
   Power, RichText/VisualAnchor, NoConnect and Razavi fixture coverage. Name
   any unsupported input rather than guessing topology.
4. Run a repository-wide production-reader audit and record which candidates
   remain migration-only versus which require a separate retirement target.
5. Reconcile the current Project-file and user compatibility documentation so
   schema versions and supported import/save behaviour have one description.
   Mark historical materials as historical rather than silently rewriting them.

## Validation

- focused migration/corpus/import/topology/formal-render tests
- `pnpm agent-api:artifacts --check` if shared Agent schema changes
- `pnpm docs:check`, `pnpm typecheck`, `git diff --check`
- `pnpm verify:branch`, justified because schema migration, fixtures, editor,
  Agent, renderer and documentation boundaries meet in this target
- `git status --short --branch`

## Commit Intent

Commit as:

```text
test(model): establish current project compatibility corpus
```

## Outcome

Added `fixtures/projects/compatibility-corpus.json` as the explicit inventory
of all shipped fixture and saved-circuit Project files. The focused corpus test
proves that all current files are canonical schema-v8 and every named historic
input sequentially migrates to a stable schema-v8 serialization; the known
invalid Project remains an explicit rejected case. It also checks that the
resulting current form has neither persisted `spice.*` properties nor the
retired `routeAttachment` field.

The production-source audit found no runtime `spice.*` consumer: the remaining
occurrences are migration code and boundary rejection diagnostics. VDD/Port
catalog entries and source guards remain intentional migration/presentation
support, while the `routeAttachmentPlacement` helper name remains a
non-persisted geometry compatibility seam; neither is removed in this bounded
baseline. `docs/user/project-compatibility.md` now describes schema v8, the
one-way migration/save lifecycle, recovery authority, and the corpus.

Validation passed: focused corpus/persistence/v7-to-v8 tests (14 tests),
typecheck, Markdown-link check, `git diff --check`, and the recorded reader
audit. A full `pnpm verify:branch` remains for the later M4 retirement target
that changes production compatibility code.
