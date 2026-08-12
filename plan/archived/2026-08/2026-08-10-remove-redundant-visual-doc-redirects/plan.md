---
status: completed
experience: none
---

# Remove Redundant Visual Documentation Redirects

## Goal

Remove six redirect-only visual/VSS documentation files after the unified
Razavi visual contract and archive structure made them redundant. Preserve all
unique history, current methodology, functional contracts, and discoverability
through direct canonical links and one archive former-path mapping.

## Dirty-State Decision

`git status --short --branch` started clean on `main...origin/main`. No existing
work overlaps this documentation-only cleanup.

## Owned Paths

Deleted redirect-only files:

- `docs/specs/razavi-textbook-style.md`
- `docs/specs/razavi-component-extension.md`
- `docs/specs/vss-development-import.md`
- `docs/architecture-and-pipeline-review.md`
- `docs/roadmap/phase-5-symbols-and-visual-quality.md`
- `docs/agent/knowledge/razavi-style-canon.md`

Updated references and mapping:

- `docs/specs/README.md`
- `docs/specs/symbol-dsl.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-8-direct-manipulation-and-manual-authoring.md`
- `docs/adr/0008-agent-local-route-tree-expander.md`
- `docs/archive/README.md`
- `docs/archive/visio-vss/razavi-style-canon.md`
- `skills/circuit-layout/references/manifest.md`
- `plan/2026-08-10-remove-redundant-visual-doc-redirects/plan.md`
- one isolated entry in `plan/log.md`

## Read-Only Paths

- `docs/specs/razavi-visual-contract.md`
- `docs/specs/visual-language.md`
- `docs/specs/symbol-dsl.md` except the retired VSS link
- `docs/adr/0011-retire-visio-vss-as-visual-authority.md`
- archive document bodies except the two stale current-spec links
- historical `plan/**` prose and all implementation code/assets

## Shared Dependencies

- unified Razavi visual contract
- ADR 0011 archive boundary
- `docs/archive/` historical evidence
- Circuit Layout Skill reference routing

## Expected Work

1. Delete only redirect files with no unique contract or historical content.
2. Point active documentation and Skill references directly to the unified
   contract or archive originals.
3. Preserve former-path discoverability in `docs/archive/README.md` without
   rewriting historical plans.
4. Confirm no live Markdown link targets a deleted path.

## Validation

- verify all six files are absent and their canonical replacements exist
- scan active docs and Skill references for deleted link targets
- check local Markdown links in every changed document
- format edited prose while preserving unrelated historical table layout
- run `git diff --check` and final status review

## Commit Intent

Commit the isolated documentation cleanup on the current branch after the user
explicitly authorized taking ownership of the previously concurrent changes.

## Outcome

- Removed all six redirect-only files without deleting unique normative or
  historical content.
- Updated active references to the unified Razavi contract or archive originals
  and added one compact former-path mapping to the archive index.
- Repaired three pre-existing broken links in the archived style canon while it
  was already in scope.
- Validation passed: deleted-path check, changed-document link check, targeted
  formatting review, `git diff --check`, and final status review.
- The user later authorized taking ownership on `agent/fix-ci-baseline`.
  Revalidation confirmed all six redirects are absent, canonical replacements
  exist, all local links in nine changed files resolve, four pinned Skill
  references validate, and `git diff --check` passes. Ready for isolated
  staging and commit.
