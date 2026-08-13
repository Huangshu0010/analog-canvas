---
status: completed
experience: none
---

# Repair Compatibility Corpus Inventory

## Goal

Repair the compatibility corpus so it inventories only tracked, shipped
Projects. The remote unit gate found that the corpus mistakenly lists an
ignored local Agent scratch export, which makes a clean checkout fail while a
developer machine with the ignored file passes.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. This target owns:

- `fixtures/projects/compatibility-corpus.json`
- `packages/model/src/compatibility-corpus.test.ts`
- this plan and the corresponding factual log entry

Read-only authorities are `.gitignore`, the existing corpus test, and the
ignored local `netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.icproj.json`.
The file is deliberately ignored and must not be promoted to a shipping
fixture as a CI repair.

## Work

1. Make the corpus test enumerate Git-tracked Projects rather than raw files,
   so ignored local scratch exports cannot contaminate its release inventory.
2. Remove the ignored scratch export from the declared migration corpus.
3. Run the corpus test in a state that no longer depends on the local ignored
   file, then repeat the relevant local CI command.
3. Push the focused fix and wait for the new remote required checks.

## Validation

- `pnpm test:local packages/model/src/compatibility-corpus.test.ts`
- `pnpm ci:unit`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
test(model): exclude ignored scratch Project from corpus
```

## Outcome

Remote CI showed that the declared corpus named an ignored, untracked scratch
Project. The inventory now derives its discovered set from Git-tracked Projects,
and the scratch export has been removed from the corpus. The focused corpus
test (4 tests) and full local unit suite (725 tests) pass without depending on
the ignored local file.
