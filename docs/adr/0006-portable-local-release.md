# ADR 0006: Portable Local Web Release

Status: `accepted`

Date: 2026-08-07

## Context

The editor is already a browser application and its core, Edit Engine,
rendering, and Agent API are transport-independent packages. Phase 7 needs a
versioned, installable, local-first product without making a native desktop
shell a prerequisite for export and recovery correctness.

## Decision

Version 0.1 is distributed as a static editor bundle plus a Node 24 local host.
The host binds only to loopback. The editor is an installable PWA on Chromium
and continues to work through the local origin after its shell is cached.

Formal browser saves are canonical Project downloads. Origin-local recovery is
separate application data. The Node adapter is the reference implementation
for root-bounded atomic filesystem saves and AppData recovery.

The Agent HTTP adapter remains separately opt-in and token protected. The
static host neither enables nor proxies Agent access.

## Consequences

- One browser UI is used in development and the release artifact.
- Users need Node 24 for the portable host; Chromium provides PWA installation.
- A signed native executable and OS file-association installer are deferred.
- Native shell selection cannot change core persistence, export, or Edit
  Engine contracts.

## Rejected alternatives

- Electron or Tauri in Phase 7: adds a second runtime, packaging toolchain, and
  security surface before the product workflows are stable.
- Serving on a LAN interface: violates the local-only default and expands the
  threat model without a collaboration requirement.
- Treating a Vite development server as a release artifact: it is not a
  versioned production host and has no release smoke contract.
