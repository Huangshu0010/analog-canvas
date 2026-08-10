---
status: completed
experience: none
---

# Remove VCCS and audit common-device scale

## Goal

Remove the voltage-controlled current source from the product and determine,
with explicit geometry measurements, whether the recently added PDF-derived
devices share the established Razavi canvas scale.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns:

- the common PDF extractor/generator entries for `vccs`;
- the VCCS Symbol asset, evidence, witness, manifest, fidelity registration,
  generated catalog, GUI catalog tests, and affected SPICE/catalog tests;
- the VCCS-dependent hybrid-pi fixture and its active documentation/tests;
- a factual cross-device geometry measurement recorded in this plan;
- `plan/2026-08-11-remove-vccs-audit-common-scale/plan.md` and `plan/log.md`.

The target also owns the NPN, PNP, diode, and ideal-switch normalized geometry
because measurement established one shared defect: each uses a 60-unit primary
pin span while the reviewed compact-device system uses 40 units. Their native
PDF geometry will be uniformly scaled by `2/3` around the origin; stroke roles
remain unchanged. Op-amp, voltage-amplifier, inductor, MOS, passive, and source
assets remain read-only because their block/coil-specific extents do not share
this compact-device contract.

The SPICE parser/compiler family for `G` remains read-only and supported as
syntax/IR. Removing its reviewed graphical symbol intentionally makes Project
import report the existing unsupported-symbol diagnostic instead of narrowing
the accepted SPICE grammar.

## Work

1. Remove VCCS from extraction, evidence, catalog, GUI, SPICE mapping, and
   fidelity targets.
2. Measure view boxes, pin spans, and visible primitive bounds for the recent
   PDF-derived devices against the established MOS/passive/source assets.
3. Uniformly correct the compact NPN/PNP/diode/ideal-switch primary span from
   60 to 40 units while preserving source geometry and common stroke widths.
4. Record which dimensions were source-derived and which use product logical
   normalization, then regenerate, validate, inspect the GUI, commit, and push.

Measured audit before correction:

| Family                                     | Primary pin span | Result                          |
| ------------------------------------------ | ---------------: | ------------------------------- |
| NMOS / PMOS                                |               40 | compact-device baseline         |
| resistor / capacitor / independent sources |               40 | compact-device baseline         |
| NPN / PNP                                  |               60 | oversized by 50%                |
| diode / ideal switch                       |               60 | oversized by 50%                |
| inductor                                   |               60 | retained; four-loop coil family |
| op-amp / voltage amplifier                 |          90 / 80 | retained; analog-block family   |

## Validation

- authority and common/catalog generator stale checks
- focused Symbol, editor catalog, and mapping tests
- repository typecheck and editor production build
- GUI inspection confirming VCCS removal
- `git diff --check` and final status

## Commit Intent

Commit as:

```text
fix(symbols): remove VCCS and normalize device scale
```

## Outcome

Removed VCCS from the reviewed Symbol assets, evidence manifest, fidelity
targets, generated catalog, GUI, automatic SPICE import mapping, and its
dependent hybrid-pi fixture. The SPICE parser/compiler still accepts `G` into
IR, while Project import now returns the existing unsupported-symbol diagnostic
because no graphical controlled-source asset is approved.

The scale audit confirmed that NPN, PNP, diode, and ideal switch had been
normalized at a 60-unit primary pin span, versus the established 40-unit
compact-device span. Their complete geometry, including arrows and connection
leads, is now uniformly scaled by `2/3`; stroke roles remain unchanged. The
inductor and analog-block families retain their independently justified sizes.

Validation passed: authority and generator stale checks; 39 focused tests;
Symbols/Derived/Render builds; repository typecheck; editor production build;
four registered fidelity comparisons with zero registration lift and
anti-alias-only verdicts; formatting; live GUI catalog inspection; and
`git diff --check`. The editor build retains its existing large-chunk warning.
