---
status: completed
experience: none
---

# Connectivity recovery C8a — ERC symbol and hierarchy interface rules

## Goal

Extend ERC only with deterministic facts available from the current persisted
model and SymbolResolver: unresolved symbols, missing child Documents, and
parent-symbol/child-port count or name mismatches.

## State and ownership

Clean branch after C7a. This target owns derived ERC code/tests, plan and log.
SPICE model-binding evidence and pin-role electrical policies remain read-only
future work; they must not be inferred from display strings.

## Validation

Focused ERC/index tests, workspace typecheck, Prettier and `git diff --check`.

## Outcome

ERC now reports unresolved symbols, missing hierarchy targets, and child
Document interface count/name mismatches with canonical locators. These rules
use only direct model/resolver evidence. Model availability and floating
gate/bulk policies remain explicitly open because the current schema does not
contain sufficient typed evidence for a reliable result.

Validation: workspace typecheck; 18 focused ERC/index tests; targeted Prettier
and `git diff --check`.
