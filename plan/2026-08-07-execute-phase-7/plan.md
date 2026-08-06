# Execute Phase 7 Export and Hardening

## Goal

Ship a versioned local-first v0.1 release candidate with deterministic
SVG/PNG/PDF export, fault-safe persistence and recovery, measured performance
budgets, actionable diagnostics, bounded vendor-dialect profiles, an
installable PWA served by a loopback-only local host, and release/security
evidence.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. Phase 6 is committed and pushed. No user-owned or
unrelated dirty files overlap this target.

## Owned Files

- `docs/adr/0006-portable-local-release.md`
- `docs/specs/export.md`
- `docs/specs/performance.md`
- `docs/specs/persistence-and-recovery.md`
- Phase 7 roadmap/status and documentation indexes
- `docs/user/`, `docs/release/`, and the compatibility report
- `packages/exporters/`
- `packages/platform-node/`
- bounded export-page-bound correction in `packages/render-svg/`
- bounded dialect changes and tests in `packages/spice/`
- recovery, export, diagnostics, accessibility, and PWA changes in
  `apps/editor/`
- `apps/local-host/`
- Phase 7 fixtures, scripts, package metadata, CI, and workspace configuration
- `plan/2026-08-07-execute-phase-7/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/`, `netlists/`, and `.reference-src/`
- Phase 0-6 golden fixtures except where a compatibility check reads them
- core model/edit/symbol contracts

## Shared Dependencies

- canonical Project validation and serialization
- the formal SVG renderer and visual-quality diagnostics
- SPICE source preservation, typed syntax, and transient IR
- Agent API loopback security and bounded query semantics
- Chromium installability rules for localhost PWAs

## Frozen Decisions

- v0.1 is a portable local web application: a loopback-only Node host serves a
  versioned installable PWA. A native shell/installer is deferred and is not a
  hidden Phase 7 dependency.
- Formal SVG is the sole export scene. PNG is rasterized from that SVG; PDF
  embeds the same raster at the same declared page bounds. Vector PDF is a
  documented post-v0.1 enhancement.
- Browser formal save downloads canonical `.icproj.json`. Browser recovery is
  origin-local application data and requires explicit restore/discard.
- The Node platform adapter provides root-bounded atomic formal saves and
  recovery storage with fault injection; recovery never replaces a formal file
  unless validated and explicitly promoted.
- Performance acceptance uses repeatable representative fixtures and generous
  CI-safe budgets. Measurements are reported; unstable microbenchmarks are not
  used as correctness assertions.
- Vendor claims are structural import profiles, not simulator-equivalence
  claims. v0.1 adds explicit LTspice and Xyce profiles; HSPICE/PSpice remain
  losslessly preserved with published gaps until dedicated corpora exist.
- No MCP, cloud service, simulation engine, arbitrary filesystem access, or
  automatic layout guarantee is added.

## Expected Work

1. Accept export/performance/release contracts and the portable-release ADR.
2. Implement deterministic Node SVG/PNG/PDF exporters, browser export actions,
   cross-format fixtures, magic-byte/geometry checks, and rendered PDF review.
3. Implement root-bounded atomic filesystem storage, AppData recovery records,
   corruption/interruption/promotion tests, and browser recovery UI.
4. Add explicit LTspice/Xyce structural profiles, compatibility fixtures, an
   import diagnostic report, and documented vendor gaps.
5. Add representative performance fixtures and measured import/render/query/
   edit/save budgets.
6. Add PWA metadata, offline shell, loopback-only production host, versioned
   release bundle, smoke tests, accessibility/error-state checks, and release
   documentation.
7. Run all repository and release gates, update the factual log, commit, push,
   and complete a final Phase 0-7 audit.

## Validation

- focused exporter, persistence, recovery, dialect, host, and UI tests
- deterministic SVG/PNG/PDF artifact checks and PDF render inspection
- forced pre-replace failure and corrupt-recovery tests
- performance budget report on the representative fixture
- PWA manifest/service-worker and loopback/root-security tests
- frozen install, formatting, reference immutability, typecheck, all tests,
  workspace build, artifact checks, and Playwright acceptance
- Markdown links/fences, package contents, `git diff --check`, and final status

## Experience Signal (for human review)

None at target start. No experience note will be extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 7 release hardening
```

## Outcome

- Accepted the portable local release, formal export, and performance
  contracts for v0.1.
- Delivered canonical Project open/save, separate recovery, root-bounded
  atomic Node storage, diagnostics UI, deterministic SVG/PNG/PDF artifacts,
  explicit LTspice/Xyce profiles, and a measured 500-instance baseline.
- Delivered generated PWA icons, offline caching, a loopback-only static host,
  versioned release bundle, release smoke test, compatibility/user/release
  documentation, and CI release gates.
- PDF render inspection caught missing fonts and clipped output labels. The
  exporter now uses a bundled serif family and text-aware formal bounds; the
  final one-page golden was re-rendered and visually accepted.
- Frozen install, formatting, immutable references, schema/artifact checks,
  typecheck, 89 tests in 26 files, build, performance/export/PWA/release checks,
  eight Playwright workflows, Markdown links/fences, no-MCP package inspection,
  and `git diff --check` passed.
