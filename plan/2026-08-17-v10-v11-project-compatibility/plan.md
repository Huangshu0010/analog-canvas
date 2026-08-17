---
status: completed
experience: none
---

# Add Rolling v10 to v11 Project Compatibility

## Goal

Allow schema-v10 Project JSON to open through one direct, semantics-preserving
upgrade to the sole schema-v11 in-memory model. Preserve v10 content, expose
migration metadata to file and recovery callers, require an explicit formal
save for upgraded user files, and prove that a migrated Project can use and
persist new v11 RichText fractions.

## State and Ownership

Start state from `git status --short --branch`:

```text
## chore/unify-current-protocol-baseline
?? .worktrees/
```

The untracked `.worktrees/` directory predates this target and is unrelated;
it remains untouched. This target owns:

- `packages/model/src/persistence.ts` and focused persistence tests
- `apps/editor/src/document/` compatibility metadata and recovery handling
- focused editor file/recovery tests and the minimal App file-state wiring
- `apps/editor/e2e/project-file.spec.ts` for the migrated-open/save boundary
- current Project compatibility documentation and a superseding ADR
- `fixtures/projects/compatibility-corpus.json` description only, because its
  current-only wording would otherwise contradict the read adapter
- this target plan, `plan/log.md`, and `plan/root-audit.md`

Shared dependencies are the schema-v11 `CircuitProjectSchema`, browser
recovery record consistency, Project file-state semantics, and Agent/file
callers of `parseProject`. The schema shape, RichText editor UX, canonical
Project payload fixtures, generated Agent artifacts, and `.worktrees/` are
read-only unless validation proves a required compatibility-contract update
and this plan is updated first.

## Work

1. Add a bounded v10-to-v11 read adapter that rewrites only the version and
   validates the result against the current strict schema; reject v9 and future
   schemas and retain current-only serialization.
2. Return source-version/migration metadata for staged file opens, mark an
   upgraded formal file as needing save, and keep ordinary v11 opens unchanged.
3. Make browser recovery compare source metadata correctly and store canonical
   v11 text after migration rather than mismatched legacy bytes.
4. Add focused regressions for content preservation, post-migration fraction
   authoring/round-trip, file staging, recovery consistency, and rejection
   boundaries; document the rolling N-1 policy.
5. Synchronize the review branch with the latest `main`, resolve overlapping
   protocol/test-governance documentation deliberately, repeat required local
   validation, and wait for required remote checks before mainline merge.

## Validation

- `pnpm test:local packages/model/src/persistence.test.ts apps/editor/src/document/project-file-service.test.ts apps/editor/src/document/browser-recovery-contract.test.ts apps/editor/src/document/browser-recovery-store.test.ts`
- focused App test only if file-state behavior requires App wiring
- `pnpm test:e2e:local apps/editor/e2e/project-file.spec.ts --grep "upgrades a schema-10 Project"`
- `pnpm typecheck`
- `pnpm docs:check`
- `pnpm verify:branch`, justified because the read policy crosses model,
  formal-file, recovery, browser, and normative documentation boundaries
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(model): accept schema v10 through a direct v11 upgrade
```

## Outcome

Added one explicit schema-10-to-11 read adapter while retaining schema 11 as
the sole validated in-memory and serialized Project. The adapter reports its
source version, preserves schema-10 content without re-projecting slash text,
and rejects schema 9, older, and future versions. Migrated formal files are
marked dirty with an explicit save prompt; browser recovery validates its
source-version envelope and canonicalizes app-owned legacy storage to
internally consistent schema-11 text.

Focused tests prove preservation of a schema-10 `instance-value`, authoring and
save/reopen of a new schema-11 fraction after migration, file staging metadata,
recovery consistency, and rejection boundaries. The targeted browser flow
proved v10 upload, v11 recovery seeding, and v11 save output. Validation passed
101 affected unit tests, the dedicated Playwright contract, typecheck,
documentation and formatting checks, and `pnpm verify:branch` with 798 unit
tests, all workspace builds, and production editor smoke. General RichText
fraction insertion remains a separate editor feature as documented by ADR
0023. The implementation commit was pushed as `e037a08`; mainline delivery was
reopened after PR #106 reported conflicts with the newer merged protocol/test
system baseline. The branch then merged current `main` at `3dbf743`, retained
both factual log histories, and repeated the clean-state mainline gate from a
frozen install. Final local `pnpm ci:check` passed static contracts, 132 test
files / 809 unit tests, all workspace builds, performance and golden checks,
release/package smoke, and 144 Playwright tests. PR #106 carries the completed
target for required GitHub Actions verification and merge.
