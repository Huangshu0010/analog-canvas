---
status: completed
experience: none
---

# Connectivity recovery C2a — NoConnect electrical lifecycle core

## Goal

Turn persisted schema-v3 NoConnect records into editable electrical facts: add,
remove, reference-safe deletion, topology hashing and Agent Snapshot exposure.
Clipboard transfer and visual glyph/hit creation are distinct follow-up targets;
this target does not claim C2's complete editor lifecycle.

## State and Ownership

Clean branch after C1. Owned files are the edit-engine transaction protocol and
tests, editor clipboard and tests, derived topology hash and tests, agent
snapshot schema/builder/tests, target plan and log. Model schema/migration are
read-only because v3 already validates the persisted form.

## Work / validation

Add typed NoConnect edits and deletion checks; add deterministic hash/snapshot
representation; run focused package tests, typecheck, formatting and diff
checks. Clipboard, renderer and UI creation are explicitly not in scope.

## Outcome

Implemented C2a: `add_no_connect`/`remove_no_connect` transaction edits,
NoConnect reference protection for instance deletion, topology-hash inclusion,
and Agent Snapshot exposure. The Agent service classifies these edits as
connectivity edits. Clipboard transfer and renderer/editor interaction remain
unimplemented follow-up work and must not be represented as complete.

Validation: workspace typecheck; 20 focused topology-hash, snapshot and
transaction tests; targeted Prettier; `git diff --check`.
