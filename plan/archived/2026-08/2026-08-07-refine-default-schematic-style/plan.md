---
status: completed
experience: none
---

# Refine Default Schematic Style

## Goal

Refine the overall product plan so the general-purpose manual editor retains
free placement and routing while all human- and AI-created wires, junctions,
instance labels, net labels, power labels, text, and electrical annotations use
one consistent textbook-style monochrome graphical language by default.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. No existing changes overlap this documentation target.

## Owned Files

- `docs/overall-product-plan.md`
- `plan/2026-08-07-refine-default-schematic-style/plan.md`
- `plan/log.md`

## Read-Only Files

- `README.md`
- `AGENTS.md`
- `plan/README.md`
- `lib/circuit.vss`
- `netlists/`
- The user-provided schematic reference image

## Shared Dependencies

- Existing document, route, junction, annotation, SVG rendering, and export
  contracts in the overall product plan
- The decision that page layout remains general and primarily manual
- The reference image's wire and annotation language, excluding its particular
  component placement and signal-flow layout

## Expected Work

1. State that free manual layout and the default graphical language are
   independent concerns.
2. Define the built-in `textbook-monochrome-v1` rendering theme and its token
   responsibilities.
3. Specify route, flightline, junction, crossing, annotation, rich-text,
   overlay, and export behavior.
4. Update repository modules, validation, implementation phases, and MVP
   acceptance criteria to cover the graphical contract.
5. Review the resulting plan for consistency and record the result.

## Validation

- `git diff --check`
- `git status --short --branch`
- Check Markdown fenced-code balance.
- Confirm the final plan contains `textbook-monochrome-v1`, route stroke
  rules, junction/crossing rules, typed annotations, rich schematic text,
  overlay/export separation, renderer modules, visual validation, and the
  explicit statement that the theme does not impose page layout.

These checks cover a documentation-only architecture refinement without
claiming runtime rendering or electrical validation.

## Experience Signal (for human review)

## Commit Intent

Commit as:

```text
Define default schematic graphical language
```
