---
status: completed
experience: none
---

# S2 Component Properties Workbench

## Goal

Expand the existing single-instance Properties surface into the S2 descriptor-
driven workbench while retaining every established immediate-edit and display
gesture. This target covers the shared field projection/writer, netlist target
view, and atomic Additional Parameters authoring; S3 supplies the final shared
Reference policy/index used to enforce prefix and uniqueness.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan [ahead 2]
```

The worktree is clean after S0/S1 commits. This target owns the Properties
workbench and the parameter patch contract. It may extend to the edit engine,
descriptor/netlist projection helpers, focused documentation, plan log, and
root audit only when required by the same field protocol. No user or other
worker changes are present.

Read-only shared dependencies: S1 descriptor contract; existing property
gesture tests; S3 reference policy; S6 hierarchy/external-interface authoring.

## Work

1. Make the parameter patch writer apply set/unset atomically and reject a
   final case-folded duplicate parameter record, so Additional Parameters and
   known fields share exactly one record semantics.
2. Project Identity, target, known parameters, Additional Parameters, Display,
   and read-only source evidence from typed facts into the current selected-
  Instance Properties panel. Keep placement/orientation, Value/Reference
   toggles, canvas text editing, and Discard behavior unchanged.
3. Add an explicit Additional Parameters Apply/Cancel work surface. It may use
   one patch transaction but must never create a second property bag or issue
   per-row commits.
4. Expose typed Reference/binding writers in the panel only with the S3 shared
   policy; until then do not create a local prefix/duplicate validator.
5. Add focused edit and UI tests, current-contract documentation, and factual
   plan close-out.

## Validation

- focused edit-engine, derived/netlist, and Properties/App tests
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: one case-folded netlist-parameter record; one atomic Additional
  Parameters Apply; existing known-field and display gestures remain stable.

## Commit Intent

```text
feat(properties): add typed component workbench
```

## Outcome

Delivered the descriptor-backed Component Properties workbench without
changing established known-field, placement, rotation, display-toggle, canvas
text, or Discard gestures. Identity, target, and immutable imported evidence
now project typed facts. Required-model targets use `set_instance_binding`;
Additional Parameters use an explicit Apply/Cancel table and one atomic
`patch_instance_netlist_parameters` transaction.

Parameter patches now construct a final record before commit, reject
case-folded duplicates, and allow an atomic case-only rename. The remaining
Reference input and its field diagnostics deliberately move with S3's shared
ReferencePolicy/ReferenceIndex; no local prefix/duplicate validator was added.

Validation passed: `pnpm typecheck`; focused unit contracts (46 tests across
App, netlist authoring, and transaction paths, plus the Additional Parameters
unit contracts); focused Component Properties Playwright workflow; `pnpm
docs:check`; `pnpm test:impact -- --base origin/main`; and `git diff --check`.

Commit status: committed locally on `codex/phase1-schematic-foundation-plan`.
