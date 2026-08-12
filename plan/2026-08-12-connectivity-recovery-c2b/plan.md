---
status: completed
experience: none
---

# Connectivity recovery C2b — NoConnect clipboard transfer

## Goal

Preserve NoConnect electrical declarations when an internal selected instance
subgraph is copied, previewed, and pasted. A copied terminal must be remapped
to the copied instance and get a fresh NoConnect id, never silently point to
the source instance.

## State and ownership

The worktree is clean after C2a. This target owns editor clipboard code/tests,
its own plan, and `plan/log.md`. It depends read-only on C2a's typed edits and
model NoConnect schema. UI glyph/hit interaction remains outside this target.

## Validation

Focused clipboard tests plus edit-engine transaction test through paste;
workspace typecheck, Prettier and `git diff --check`.

## Outcome

`SchematicClipboard` now carries terminal NoConnect declarations for selected
instances. Preview preserves them against the copied source ids; paste gives
each declaration a fresh id and remaps its terminal to the copied instance via
the C2a typed edit. NoConnect records for ports cannot enter this
instance-selection clipboard path, which is intentional until port selection
has its own copy contract.

Validation: workspace typecheck; 12 focused clipboard/transaction tests;
targeted Prettier and `git diff --check`.
