---
status: completed
experience: none
---

# Free Port Net lifecycle

## Goal

Make Free Net Ports use Net names as their electrical identity: separately
placed Ports with the same name join one Net, and deleting the final Port from
an otherwise empty local Net removes the now-unreachable Net and its derived
Net label. Releasing an Instance must also release its `P<n>` designator.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/codex/insert-unification [ahead 1]
```

The isolated worktree is clean. The earlier, unrelated Port text-style commit
is awaiting a retry after a transient push TLS failure; this target builds on
it and does not rewrite it. Owned paths:

- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/component-insert/*.test.ts`
- `packages/edit-engine/src/instance-lifecycle.ts`
- `packages/edit-engine/src/instance-lifecycle.test.ts`
- the minimal edit-engine contract files and tests needed for explicit empty
  local-Net disposal
- this plan and `plan/log.md`

Read-only shared dependencies: the existing named-Net planner, transaction
validation, SVG Net-label binding, Agent edit schema, and formal Cell Port
lifecycle. Free Net Port cleanup must not alter formal Cell interface Nets,
global Nets, routed Nets, or junction-bearing Nets.

## Work

1. Reuse the existing deterministic named-Net planner when authoring a Free
   Net Port, so an explicit duplicate Net name merges electrically rather than
   merely duplicating a display string.
2. Extend the existing `disconnect_endpoint` lifecycle with narrow automatic
   pruning of an unreachable local Net. The transaction must prune only after
   the last terminal leaves and only when no route, junction, annotation,
   layout, MOS-default, or formal Cell-interface reference remains. This
   preserves the existing flat protocol instead of adding a one-off Port edit.
3. Have instance deletion plan this cleanup only for Nets made empty by the
   selected Free Port deletion. Preserve all non-Free-Port and visual/routed
   lifecycle behavior.
4. Add unit and browser regressions for delete/recreate `P1`, same-name Port
   electrical unification, and cleanup safety boundaries.

## Validation

- `pnpm test:local packages/edit-engine/src/instance-lifecycle.test.ts packages/edit-engine/src/transaction.test.ts apps/editor/src/features/component-insert/*.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep="Free Net Port"`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Free Port name equality means one electrical Net; deleting its
  final terminal does not retain an unreachable local Net, label, or instance
  designator; a live/routed/global/interface Net cannot be disposed.
- Primary checks: lifecycle and transaction unit tests plus the actual editor
  `P` placement/delete/replacement browser flow.

## Commit Intent

```text
fix(editor): complete free port net lifecycle
```

## Outcome

Free Port authoring now projects its pending candidate through the existing
name-first Net planner. Therefore repeated case-insensitive names merge into
one electrical Net, while a new name remains a new local Net. Instance
deletion removes object-anchored Net labels before disconnecting endpoints;
the transaction then prunes only a local Net with no remaining electrical or
durable authored references. This releases the final Free Port's `P<n>`
designator for deterministic reuse without deleting global, routed, labelled,
layout-owned, MOS-owned, or formal-interface Nets.

Validation passed: focused edit-engine tests (9 tests), three browser Port
workflows (same-name merge/lifecycle, direct shortcut, and wired Ports),
typecheck, Prettier, test-impact, and diff checks.

Commit pending.
