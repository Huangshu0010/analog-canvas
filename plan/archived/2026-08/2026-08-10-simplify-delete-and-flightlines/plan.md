---
status: completed
experience: none
---

# Simplify Delete and flightlines

## Goal

Make ordinary wire deletion remove an unambiguous electrical branch, keep
geometry-only rerouting out of the normal GUI, and turn flightlines into
clickable routing guidance rather than pseudo-objects users are expected to
delete.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns:

- `packages/edit-engine/src/transaction.ts`
- focused Edit Engine routing tests
- `packages/agent-adapter/src/service.ts` and its edit-policy test
- generated Agent API schema/OpenAPI fixtures under `fixtures/agent-api/`
- `packages/derived/src/connectivity.ts` and focused connectivity tests
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/features/selection/delete-selection.ts` and tests
- focused editor E2E tests
- relevant routing/edit-engine specifications
- this plan and `plan/log.md`

Shared contracts are the persisted Net/Route/Junction model and Agent edit
schema; the Agent adapter allowlist therefore belongs to this target. No
project-file schema change is planned: `cut_connection` derives a
deterministic Net partition and uses the existing Net records internally.
`make_flightline` remains an advanced/API geometry-only operation for now but
is removed from the normal canvas UI.

## Work

1. Add atomic `cut_connection`: remove one Route, preserve a redundant cycle,
   or split a fully routed Net deterministically. Reject partial/imported Nets
   whose unrouted members make the electrical cut ambiguous.
2. Route every normal wire/Junction/mixed-selection Delete through that edit;
   remove the ordinary Unroute action and misleading geometry-only statuses.
3. Improve flightline endpoints by choosing the nearest frontier pair between
   routed components with a straight-line metric and stable tie-breaking.
4. Make a flightline clickable as a Wire source/target hint and default SPICE
   workflow guidance to the selected Net rather than treating flightlines as
   deletable persisted objects.
5. Update focused specifications and regressions.

## Validation

- Focused Edit Engine routing Vitest for cuts, cycles, partitions, and
  ambiguous imported Nets.
- Focused Derived connectivity Vitest for nearest frontier MST selection.
- Focused editor selection tests and Playwright Delete/flightline flows.
- Edit Engine, Derived, and editor builds.
- `git diff --check` and `git status --short --branch`.

## Commit Intent

Commit as:

```text
fix(editor): simplify wire deletion and flightline guidance
```

## Outcome

Implemented one ordinary Route deletion semantic backed by the atomic
`cut_connection` edit. Fully routed local Nets split deterministically,
redundant cycles retain their Net, isolated free wires remove their empty local
Net, and ambiguous partially routed or global-Net partitions reject without
guessing. Removed GUI Unroute, moved all normal Route/Junction/mixed Delete
paths to the new edit, and retained `make_flightline` only for explicit
endpoint disconnection and advanced API rerouting.

Flightlines now use nearest visible frontier endpoints with a straight-line
component MST, provide a wide click target that starts or completes Wire, and
remain hidden on an unselected SPICE-bound Document until a related instance,
endpoint, Junction, or Route selects its Net. Agent schemas and generated API
artifacts publish the new operation.

Validation passed: 43 focused Vitest tests, four focused Playwright flows,
repository TypeScript checking, Edit Engine/Derived/Agent builds through the
Agent artifact generator, editor production build, Agent API artifact check,
and `git diff --check`. The existing editor large-chunk warning remains.
