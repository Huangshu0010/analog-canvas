---
status: completed
experience: none
---

# Bundled-Example Promotion Path

## Goal

Answer the user's "can My examples enter the main library?" with a real
channel. "My examples" is deliberately origin-local browser data; the main
library is source code shipped to every visitor. Promotion therefore runs
through the repository: a new `scripts/promote-example.mjs` takes an
exported `.icproj.json` (from the Examples panel's Export button or File >
Save Project), validates it through the protocol boundary, writes the
canonical prettier-formatted asset into `apps/editor/src/examples/`, and
registers it in `library-examples.ts` — one command from exported file to
bundled example, after which the ordinary commit -> PR -> merge -> deploy
flow publishes it. The bundled-examples test becomes promotion-proof
(dynamic contracts instead of a hard-coded two-name list and a
one-document assumption that would reject hierarchical examples).

## State and Ownership

Branched from `origin/main` as `claude/example-promotion`; worktree clean.
PR #148 (insert picker) is in its own CI-merge chain; files are disjoint.

Owned paths:

- `scripts/promote-example.mjs` (new) and
  `scripts/lib/example-promotion.mjs` (+ `.test.mjs`) — registration codemod
  and identifier rules kept as testable helpers per the scripts/lib pattern
- `apps/editor/src/examples/library-examples.test.ts` — promotion-proof
  contracts
- `plan/2026-08-21-example-promotion/plan.md`, `plan/log.md`

Shared dependencies: the bundled-example registry consumed by the Examples
panel and its tests (shape unchanged; only the test's rigidity changes),
and the project-protocol boundary used as-is by the script.

## Work

1. `scripts/lib/example-promotion.mjs`: slug/id validation, import-line and
   registry-entry insertion into the `library-examples.ts` source (pure
   string codemod, duplicate-id refusal), asset file naming.
2. `scripts/promote-example.mjs`: parse arguments (`<file> --id --name
   --description`), validate via `parseProject` (rolling upgrade applies),
   write prettier-formatted canonical JSON, apply the codemod, print the
   follow-up (focused tests + ordinary delivery gate).
3. Refactor `library-examples.test.ts`: every bundled example is
   schema-current, uniquely identified, and openable; the two curated
   examples remain asserted by id without freezing the total count or a
   single-document shape.
4. Smoke-prove the script end to end on a temporary id, run the focused
   suites, then revert the temporary promotion (the tool lands, no junk
   example does).

## Validation

- `node --test`-free: focused `vitest` for
  `scripts/lib/example-promotion.test.mjs` and
  `apps/editor/src/examples/library-examples.test.ts`
- end-to-end smoke: promote a fixture copy under a temp id, rerun the
  examples suite green with three entries, revert
- repository typecheck, prettier, markdown links
- `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: registration codemod inserts exactly one import and one entry
  and refuses duplicates/invalid slugs; bundled examples stay schema-current
  and uniquely identified regardless of count or document depth; curated
  ids remain present
- Primary checks: `scripts/lib/example-promotion.test.mjs`,
  `apps/editor/src/examples/library-examples.test.ts`

## Commit Intent

Committed on `claude/example-promotion` under the user's standing
commit-push-merge direction as:

```text
feat(scripts): add bundled-example promotion path
```

## Outcome

Delivered. `scripts/promote-example.mjs` turns one exported `.icproj.json`
into a bundled Library example in a single command: protocol validation
(rolling upgrade applies), canonical prettier-formatted asset in
`apps/editor/src/examples/`, and registration via a testable codemod in
`scripts/lib/example-promotion.mjs` (kebab-slug rules, duplicate refusal,
precise anchor errors). The bundled-example contracts are now
promotion-proof: per-example schema-current/unique/openable assertions with
the curated pair pinned by id, no frozen count or single-document
assumption. Proven end to end by promoting a fixture copy under a temp id —
examples and editor-shell suites green with three entries — then reverting
so the tool lands without a junk example. Validation: codemod tests (4),
refactored examples suite, typecheck, prettier, markdown links,
test-impact, diff checks.
