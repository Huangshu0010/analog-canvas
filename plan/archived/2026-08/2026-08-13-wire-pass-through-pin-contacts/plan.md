---
status: completed
experience: none
---

# Wire Pass-Through Pin Contacts

## Goal

When an authored wire passes exactly through existing visible device pins,
materialize those compatible pins into the wire's Net and split the route at
each contact in the same atomic transaction, so real branch dots appear for
all catalog devices.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-electrical-contact...origin/codex/unified-electrical-contact
```

The worktree is clean. Read-only inspection of the live GUI established that
V4 and X9 own split route endpoints, while exact-coordinate GND5, C6, C7, and
R8 pins are not route endpoints or Net members. This target owns:

- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/wire-editing.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-13-wire-pass-through-pin-contacts/plan.md`
- `plan/log.md`

Shared dependencies are `WireSource`, manual orthogonal path normalization,
visible endpoint Net ownership, and atomic edit ordering. The persisted schema
and renderer junction rule remain read-only.

## Work

1. Add a planner that orders compatible intermediate terminal contacts along
   an orthogonal wire path and emits one route section per contact.
2. Treat an exact visible pin crossed by the newly authored wire centerline as
   explicit connection intent, including the normal typed Net merge; symbol
   bodies, nearby pins, and unrelated route crossings remain non-contacts.
3. Make GUI wire commit pass visible device pins through the shared planner.
4. Cover multiple passive pins on one long wire, bends, deterministic Net
   merge ordering, and browser-visible split topology/junction dots.

## Validation

- `pnpm test:local packages/edit-engine/src/wire-editing.test.ts packages/derived/src/contact.test.ts packages/render-svg/src/render.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "connects every compatible pin crossed by one wire"`
- `pnpm --filter @icm/edit-engine build`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix: connect compatible pins along authored wires
```

## Outcome

The live GUI proved the missing dots were unmaterialized pass-through contacts,
not catalog pin-coordinate errors. Wire commit now orders every exact visible
terminal along its resolved orthogonal path, connects/merges those endpoints,
and emits one real route section between consecutive contacts in the original
atomic transaction. Symbol-body overlap and off-path pins remain inert. Forty
focused unit/render tests, edit-engine build, workspace typecheck, and the new
browser regression all passed.
