---
status: completed
experience: none
---

# Remove Compatibility Re-exports

## Goal

Delete deprecated editor wiring shims and redundant render-svg re-export
modules so callers import contracts from their actual owners.

## State and Ownership

The branch starts clean from merged `main`. This target owns the two editor
wiring shims and callers, render-svg compatibility modules/index exports and
callers, redundant wrapper tests, this plan, and its log entry. Underlying Edit
Engine, Derived, model, rendering behavior, and RichText implementation are
read-only.

## Work

1. Redirect editor wiring imports to `@icm/edit-engine`, remove the two
   deprecated local modules, and relocate their non-duplicated behavior tests
   to the Edit Engine owner.
2. Redirect render-svg internals and editor consumers to `@icm/derived` or
   `@icm/model`; remove compatibility re-export modules, merging any unique
   assertions into the owning package's tests before deleting wrapper tests.
3. Verify no removed path or root export remains in use.

## Validation

- Repository import/reference audit for every removed module and symbol.
- Focused wiring, label-placement, style-profile, render, and editor tests.
- Typecheck, build, `git diff --check`, and status.

## Commit Intent

```text
refactor: remove compatibility re-exports
```

## Outcome

Removed the deprecated editor `wire-editing` / `wire-path` shims and the
render-svg markup, label-placement, and style-profile re-export modules. All
callers now import from the owning Edit Engine, Derived, or model package.

The wiring tests were not actually duplicated at the owner, so they were moved
to Edit Engine rather than deleted. Unique style-token and label-placement
assertions were merged into Derived tests before deleting the wrapper tests.
This preserves behavioral coverage while eliminating five compatibility
modules, two wrapper-owned test files, and their false ownership boundary.

The removed-path audit found no remaining references. Sixty-seven focused
tests passed, followed by workspace typecheck, production build, full formatting
check, and `git diff --check`.
