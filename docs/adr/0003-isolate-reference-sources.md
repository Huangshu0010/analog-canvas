# 0003 - Isolate Reference Sources Behind a Pinned Manifest

Status: `accepted`

Date: `2026-08-07`

Owners: `references/`, `scripts/fetch-references.ps1`

## Context

The project benefits from studying existing parsers and canvas implementations,
but submodules and vendored repositories would blur product ownership and make
builds depend on unrelated histories. Different references also have different
license and migration constraints.

## Decision

Reference repositories are recorded in `references/manifest.json` with an
immutable commit, declared license, usage classification, allowed scope, and
excluded scope. The fetch script clones them into ignored `.reference-src/`
directories. Product builds and tests must succeed without those directories.

Code or fixtures moved into the product require a bounded migration target and
provenance record. They must adopt destination-package contracts and cannot
retain a runtime import back to the reference checkout.

## Alternatives considered

### Git submodules

- Benefits: visible pins in the repository tree.
- Costs: nested Git workflow, accidental build coupling, and noisy ownership.
- Reason not selected: references are research inputs, not source dependencies.

### Copy complete upstream repositories

- Benefits: easy local inspection.
- Costs: repository bloat and unclear product boundaries.
- Reason not selected: only narrow capabilities are relevant.

## Consequences

### Positive

- Reference provenance is explicit and reproducible.
- Production source remains entirely inside this project's package structure.
- CI proves the absence of hidden Reference dependencies.

### Negative or limiting

- Developers fetch references explicitly when performing an audit.
- Every optional reference pin must be updated deliberately.

## Compatibility and migration

Existing local clones are not adopted automatically. The fetch script refuses
to overwrite a checkout with a different origin or immutable revision.

## Validation

- Manifest entries use full commit hashes.
- Fetch-script tests verify known, unknown, and mismatched reference handling.
- A clean CI checkout builds without `.reference-src/`.

## Related documents

- [`references/README.md`](../../references/README.md)
- [`0002-typescript-core-and-tool-boundary.md`](0002-typescript-core-and-tool-boundary.md)
