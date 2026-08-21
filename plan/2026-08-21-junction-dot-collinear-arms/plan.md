---
status: completed
experience: none
---

# Junction Dots Ignore Collinear Overlapping Route Arms

## Goal

Fix the reported "extra dot at the PMOS gate" bug. Reproduced in the running
editor and reduced to evidence: finishing a wire on a pin with a double-click
can commit a second same-net route whose arm overlaps the first (e.g.
`(320,320)->(320,260)` and `(320,330)->(320,260)` both ending on the gate).
`contactRequiresJunctionDot` counts raw route arms, so the two visually
coincident arms plus the pin reach the >= 3 threshold and paint a branch dot
where the user sees only one wire meeting one pin. Per the
connectivity-and-routing spec, "a visible dot represents authored branch
topology"; overlapping collinear arms are not a visible branch. The rule now
counts DISTINCT route-arm directions (terminals keep per-pin counting, so
three coincident pins still dot).

## State and Ownership

`git status --short --branch`: clean on `claude/junction-dot-collinear-arms`
branched from up-to-date `main` (PRs #142/#143 merged).

Owned paths:

- `packages/derived/src/contact.ts` and new `contact.test.ts`
- `docs/specs/connectivity-and-routing.md` (one clarifying sentence)
- `plan/2026-08-21-junction-dot-collinear-arms/plan.md`, `plan/log.md`

Shared dependencies: the junction-dot visual contract consumed by
`@icm/render-svg` (both editor canvas and formal export) — behavior changes
only for contacts with multiple same-direction route arms. The duplicate
route creation path itself (wire tool remaining active; engine-level
duplicate/overlap validation) is recorded as follow-up, not owned here.

## Work

1. `contactRequiresJunctionDot`: count distinct route-arm directions instead
   of raw arms; update the doc comment.
2. New `contact.test.ts` primary contract: straight-through (no dot), T
   (dot), corner-into-pin (dot), collinear duplicate arms onto one pin (no
   dot — the regression), three coincident pins (dot), and the evidence
   fields the renderer relies on.
3. Sharpen the spec sentence to name overlapping collinear arms explicitly.

## Validation

- focused `vitest`: `packages/derived/src/contact.test.ts`,
  `packages/render-svg/src` (junction rendering consumers)
- repository typecheck, prettier, markdown links
- `node scripts/check-test-impact.mjs --base main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: junction dots mark visible branches — distinct route-arm
  directions plus terminals >= 3; collinear overlapping arms never dot;
  coincident-pin dots preserved
- Primary checks: `packages/derived/src/contact.test.ts`

## Commit Intent

Committed on `claude/junction-dot-collinear-arms` under the user's standing
commit-push-merge direction as:

```text
fix(derived): ignore collinear route arms in junction dots
```

## Outcome

`contactRequiresJunctionDot` now counts distinct route-arm directions, so
same-Net arms overlapping collinearly (the reproduced duplicate-route
artifact behind the "extra dot at the PMOS gate" report) no longer paint a
branch dot, while straight-through pin taps, three-way branches,
corner-into-pin taps, and coincident-pin dots are unchanged — each locked by
the new `contact.test.ts` primary contract (6 tests, the first direct
coverage of the contact evidence module). The connectivity spec's dot clause
now names the collinear rule. Verified live in the editor (gate wiring stays
dotless; the recovered duplicate-route document renders no gate dot).
Follow-up recorded separately: the wire tool can still commit an invisible
overlapping same-net route (engine-level duplicate/overlap validation).
Validation: derived + render-svg suites, typecheck, prettier, markdown
links, test-impact (base main), and diff checks all green.
