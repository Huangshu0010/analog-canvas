# ADR 0012: Permit scoped PDF vector evidence for Razavi assets

Status: `accepted`

Date: `2026-08-10`

Owners: `fixtures/visual-reference`, `packages/symbols`, `scripts`, `tools`

## Context

ADR 0011 retired Visio/VSS and made the Razavi reference manifest the sole
visual authority. The accepted screenshot set contains no inductor, while
Figure 15.21 of the approved Razavi textbook contains a clean PDF-native
inductor path. Reconstructing that curve from pixels would discard coordinates,
stroke width, and Bézier control points already present in the source.

PDF geometry still lacks electrical pin identity, the 10-unit connection grid,
and Symbol DSL semantics. It also must not create a second authority or merge
PDF parsing into the existing raster comparison implementation.

## Decision

The schema-version-1 Razavi manifest may contain an optional
`vectorEvidence` array. Each entry is scoped and must pin:

- evidence ID and `pdf-vector-extract` kind;
- source PDF SHA-256, PDF page, printed page, and figure;
- committed vector-extract JSON and SHA-256;
- committed raster witness and SHA-256; and
- the visual features governed by that evidence.

The full source PDF remains external. The committed extract is the deterministic
geometry input, and the raster witness is the comparison input. The authority
loader hash-checks both. Manifests without `vectorEvidence` remain valid, so no
schema migration is required.

The tool boundaries are mandatory:

1. `tools/pdf-vector-extract/` parses the PDF and creates evidence.
2. A family generator converts pinned evidence to Symbol DSL and supplies
   electrical pin anchors explicitly.
3. `scripts/razavi-fidelity-diff.mjs` compares the rendered Symbol with the
   witness and never edits either source.

This decision is applied only to the inductor in this target. It does not
authorize converting other components or replacing their raster evidence.

## Inductor mapping

The Figure 15.21 path is retained as one continuous Bézier path. Its PDF stroke
width maps to the Razavi `normal` stroke role. Visual endpoints are extended
along their existing centerline to electrical pins `(0,-30)` and `(0,30)`,
which preserves the source curve while satisfying the 10-unit grid. Electrical
pin names, order, and SPICE `L` mapping are product semantics added outside the
PDF extract.

## Consequences

- The inductor keeps source-level curve precision and traceable textbook
  provenance.
- Existing raster targets and schema-version-1 manifests behave unchanged.
- Poppler antialiasing may affect a regenerated witness, so committed hashes
  remain authoritative and the vector JSON is the Symbol-generation input.
- PDF sources cannot supply electrical correctness; pin semantics still
  require explicit review and tests.

## Validation

- Extractor rejects a mismatched textbook SHA-256 or path fingerprint.
- Authority loader accepts legacy manifests and rejects modified vector
  extracts or witnesses.
- The inductor generator has write and stale-check modes.
- Symbol/catalog tests enforce continuous geometry, on-grid pins, provenance,
  palette exposure, and SPICE import mapping.
- The existing fidelity runner produces the inductor reference/render/diff
  report from the raster witness.

## Related documents

- [`0011-retire-visio-vss-as-visual-authority.md`](0011-retire-visio-vss-as-visual-authority.md)
- [`../specs/razavi-visual-contract.md`](../specs/razavi-visual-contract.md)
- [`../../tools/pdf-vector-extract/README.md`](../../tools/pdf-vector-extract/README.md)
- [`../../fixtures/visual-reference/razavi-reference-v1/manifest.json`](../../fixtures/visual-reference/razavi-reference-v1/manifest.json)
