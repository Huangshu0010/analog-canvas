# Editor Source Architecture

The editor source tree is organized by ownership rather than file type. Keep
tests beside the implementation whose contract they protect.

## Directory Responsibilities

- `app/`: top-level editor composition and orchestration.
- `canvas/`: reusable canvas geometry, hit resolution, and drag-session
  infrastructure. It must not own document transactions.
- `components/`: reusable presentational shells that do not own editor model
  state.
- `document/`: document navigation, transaction, and project recovery
  lifecycle boundaries.
- `interaction/`: application-wide interaction state, shortcut intent mapping,
  and orientation commands shared by feature adapters.
- `features/`: user-facing editing domains. Each feature owns its pure
  proposals, local view adapters, and tests.
  - `clipboard/`: copy and paste proposals.
  - `drafting/`: drafting creation and manipulation.
  - `selection/`: visual selection, deletion, geometry, and inspector details.
  - `text-editing/`: annotation and drafting-text editing.
  - `wiring/`: wire proposals, manual paths, and route interaction geometry.
- `demos/`: bundled project fixtures used by the editor.
- `presentation/`: the accepted Razavi presentation policy adapter.
- `snap/`: shared snapping candidates and engine.

`main.tsx`, `styles.css`, and `vite-env.d.ts` remain at the source root because
they are build/runtime entry infrastructure rather than product domains.

## Dependency Direction

Dependencies flow toward stable contracts:

```text
main -> app -> features/components/document/interaction/canvas
                    -> packages/*
```

Feature and infrastructure modules must not import `app/App.tsx`. Pure
proposal, reducer, and geometry modules must not import React components.
Cross-feature imports should be avoided; move a genuinely shared primitive to
`canvas/`, `document/`, `interaction/`, `snap/`, or an appropriate workspace
package instead.

Do not add broad barrel files merely to shorten imports. Explicit module paths
make ownership visible and reduce accidental dependency cycles.
