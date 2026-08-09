# Razavi Extension Documentation

## Goal

Document the live Razavi palette/authority logic and provide a concise,
repeatable procedure for adding a new Reference-calibrated component. Archive
the remaining large VSS-era visual documents so they do not enter ordinary
implementation context.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
 M plan/log.md
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? plan/2026-08-09-razavi-fidelity-measurement-hardening/
?? probe-conflicts.mjs
```

These are separate target artifacts. `plan/log.md` is read-only because it is
already modified by another target; this target records its facts in this plan
and its commit instead.

## Owned Files

- `docs/README.md`
- `docs/current/README.md`
- `docs/specs/razavi-component-extension.md`
- `docs/specs/README.md`
- `docs/archive/README.md`
- `docs/archive/roadmap/phase-5-symbols-and-visual-quality.md`
- `docs/archive/architecture-and-pipeline-review.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-5-symbols-and-visual-quality.md`
- `docs/architecture-and-pipeline-review.md`
- `plan/2026-08-09-razavi-extension-documentation/plan.md`

## Read-Only Files

- `plan/log.md`
- `lib/circuit.vss`, `tools/vss-import/`, and all VSS archive evidence

## Expected Work

1. Publish the sole current procedure for extending the Razavi component set.
2. Link that procedure from the default reading set and style specification
   index.
3. Move the two large obsolete VSS-era visual records into the archive and
   leave compact supersession redirects at their former locations.

## Outcome

The default reading set now points directly to the Razavi component extension
contract. The obsolete architecture walkthrough and Phase 5 visual record are
stored under `docs/archive/`; their former paths are short redirects only.

## Validation

- `rg -n "generate-visio|VssMasterIR|icm-vss-master-ir" docs/current docs/specs/razavi-component-extension.md`
- `git diff --check`
- `git status --short --branch`

The search proves the default current set and extension guide do not prescribe
the retired protocol. Diff/status protect the documentation move and unrelated
worktree changes.

## Commit Intent

Commit as:

```text
docs: document Razavi component extension and archive legacy visual records
```
