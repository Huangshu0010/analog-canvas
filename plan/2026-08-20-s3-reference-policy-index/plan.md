---
status: completed
experience: none
---

# S3 Reference Policy and Index

## Goal

Establish the one ReferencePolicy/ReferenceIndex foundation used by insertion,
clipboard, hierarchy, Properties, and netlist analysis. It must separate stable
instance IDs from export references and preserve every current visible
designator result.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan [ahead 3]
```

The worktree is clean after S2. This target owns the shared devices/derived
reference contract and direct editor, clipboard, hierarchy, edit-engine, and
netlist consumers. S4 bulk changes and its 5,000-instance bounded edit are
not included unless required by the single-reference contract; they remain a
separate target once the base index is proven.

Read-only dependencies: schema-14 instance model, S1 typed field writers,
S2 Properties UI, and existing insertion/paste/hierarchy characterization
tests.

## Work

1. Define policy (`required(prefix)` or `none`) and a per-Cell case-folded
   ReferenceIndex with allocation and validation evidence. Subcircuits use X;
   reviewed non-emitting markers remain without a netlist record.
2. Replace direct array scans in new insertion/reference allocation and
   netlist validation with that shared index. Preserve current placement-label
   numbering separately only where marker presentation requires it.
3. Add a single-instance rename planner and route Properties Reference through
   it; reject wrong prefix or duplicate references before any commit.
4. Characterize current insertion/paste/hierarchy results and add index/
   planner validation tests. Do not implement S4 bulk renumbering or a second
   allocator in this target.

## Validation

- focused device/derived, edit-engine, netlist, editor and clipboard tests
- focused insertion/property/browser characterization
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: reference allocation, validation, typed rename, and current
  visible insertion/copy results all share one policy/index.

## Commit Intent

```text
feat(reference): establish shared allocation and validation
```

## Outcome

Implemented the shared, case-folded ReferencePolicy/ReferenceIndex in
`@icm/devices`. Device, hierarchy, insertion, clipboard and rectangle-to-Cell
authoring now allocate through it; hierarchy IDs can remain stable independently
of their X reference. The typed single-reference planner drives the existing
Properties panel, and the edit engine repeats its policy check atomically.
Canonical reference labels update on rename while hand-authored text remains
unchanged. Netlist extraction consumes the same diagnostics and accepts
net-markers without an invented netlist record.

Validation passed:

- `pnpm typecheck`
- focused unit contracts (reference, hierarchy, transaction, netlist,
  insertion, clipboard): 58 tests passed
- focused Properties and hierarchy browser contracts: 8 tests passed
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`

Commit status: committed locally with this target's implementation changes.
