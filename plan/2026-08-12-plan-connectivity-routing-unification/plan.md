---
status: completed
experience: none
---

# Plan connectivity and routing unification

## Goal

Produce a durable, implementation-ready roadmap for consolidating the current
Net/Wire/Junction/flightline and route-geometry behavior before adding P0 ERC,
global search, Net highlighting, and hierarchical trace navigation. Preserve
all validated editor, renderer, import, export, and Agent behavior while giving
confusing accumulated logic an explicit migration and deletion path.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This documentation target owns:

- `docs/roadmap/connectivity-routing-debugging-plan.md`
- the corresponding entry in `docs/roadmap/README.md`
- this plan and `plan/log.md`

Implementation, schemas, accepted specifications, generated artifacts, and
tests are read-only evidence for this target. The roadmap may propose future
changes to those areas but does not authorize or perform them.

Shared dependencies reviewed as current behavior evidence:

- persisted Project/Document/Net/Route/Junction contracts;
- Derived connectivity, route geometry, stretch, flightline, and visual
  diagnostics;
- Edit Engine routing transactions;
- editor Wire, snap, selection, hierarchy, and diagnostic navigation;
- renderer terminal/route-anchor miter bridges;
- SPICE compilation/import binding facts and Agent routing/snapshot behavior.

## Work

1. Inventory existing behavior and confusing implementation seams, including
   features that must survive consolidation even if their current code does
   not.
2. Define frozen terminology, ownership boundaries, unified read models,
   geometry contracts, navigation locators, ERC records, and compatibility
   rules.
3. Decompose implementation into bounded work packages with dependency order,
   migration strategy, validation gates, rollback boundaries, and explicit
   non-goals.
4. Define acceptance matrices for manual Wire, flightlines, route editing,
   hierarchy, SPICE import, Agent edits, export, search/trace, and ERC.
5. Link the roadmap from the roadmap index without changing accepted runtime
   specifications prematurely.

## Validation

- Confirm every named existing behavior has a preservation owner and
  regression surface in the roadmap.
- Confirm every proposed persisted/API change has a migration and compatibility
  step before consumers switch.
- Check referenced paths against the current repository.
- `git diff --check`.
- `git status --short --branch`.

## Commit Intent

Commit as:

```text
docs(roadmap): plan connectivity and routing unification
```

## Outcome

Added an implementation-ready cross-cutting P0 roadmap that freezes the
Net/Wire/Junction/Flightline terminology, separates persisted electrical facts
from connectivity and geometry read models, and sequences the work through 11
bounded work packages. The roadmap includes an explicit preservation matrix
for accumulated manual, Agent, SPICE, renderer, selection, movement, deletion,
hierarchy, and export behavior; additive migration and rollback gates; ERC and
search/trace contracts; file ownership; acceptance scenarios; deterministic
validation; and performance constraints. It is indexed from the roadmap
README and does not change accepted runtime specifications or implementation.

Validation completed:

- every named current compatibility behavior was mapped to a future owner and
  migration acceptance criterion;
- all concrete repository paths named by the plan were confirmed to exist;
- the historical helper audit confirmed the current manual path, Agent escape,
  route bridges, multi-Route drag, local/group stretch, cut semantics,
  Flightline, and label-connectivity implementations are still live;
- Prettier check passed for the new roadmap and target plan;
- `git diff --check` passed.
