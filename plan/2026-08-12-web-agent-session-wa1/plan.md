---
status: completed
experience: none
---

# WP-WA1 — Browser-Safe Protocol Boundary

## Goal

Separate the Node-only loopback transport from the schemas and operation logic
that the browser must import, and freeze the relay envelope + web-session schemas
so a browser host (WP-WA3) and the Node loopback host consume one Circuit API
schema with no Node-builtin imports in the browser path and no conditional schema
fork.

First implementation code target of the
[`web-agent-session-integration-plan`](../../docs/roadmap/web-agent-session-integration-plan.md);
follows the frozen WP-WA0 contract
([`ADR 0016`](../../docs/adr/0016-browser-authoritative-agent-session.md),
[`web-agent-session.md`](../../docs/specs/web-agent-session.md)).

## State and Ownership

Start state: clean `codex/web-agent-session-architecture`, `git status --short
--branch` shows `## codex/web-agent-session-architecture`.

Dependency inspection findings (drives the minimal-churn decision — no new
package is created):

- `@icm/derived/topology-hash.ts` already contains a synchronous, dependency-free
  `sha256Hex` (private); `derived` has zero Node-builtin usage and is already
  browser-imported by the editor.
- `agent-adapter/src/snapshot.ts` imports `createHash` but never uses it; its only
  Node use is `Buffer.byteLength`.
- `agent-adapter/src/service.ts` uses `createHash("sha256")` (render hash),
  `Buffer.byteLength` (query accounting), and `Buffer.from(...).toString("base64")`
  (render data).
- `agent-adapter/src/http.ts` is the only genuinely Node-only file
  (`node:http`, `node:crypto`, `Buffer`). It is consumed only by its own test via a
  relative import; no app imports the loopback server from the package entry.
- `index.ts` re-exports `http.js`, so the main entry currently pulls `node:http`.

Owned paths:

- `packages/derived/src/topology-hash.ts` (export `sha256Hex`)
- `packages/agent-adapter/src/platform.ts` (new — browser-safe byte/base64 helpers)
- `packages/agent-adapter/src/envelope.ts` (new — frozen relay envelope, events,
  transport error codes)
- `packages/agent-adapter/src/snapshot.ts` (drop Node imports)
- `packages/agent-adapter/src/service.ts` (drop Node imports)
- `packages/agent-adapter/src/index.ts` (browser-safe entry, no http)
- `packages/agent-adapter/src/loopback.ts` (new — Node-only subpath entry)
- `packages/agent-adapter/src/browser-safety.test.ts` (new — boundary test)
- `packages/agent-adapter/package.json` (subpath exports)
- `plan/2026-08-12-web-agent-session-wa1/plan.md`, one `plan/log.md` entry

Read-only / shared:

- `packages/agent-adapter/src/schema.ts` (already browser-safe; reused unchanged)
- `packages/agent-adapter/src/{http,openapi}.ts` and `http.test.ts`
- generated JSON-schema artifacts in `schema.ts` (unchanged)

## Work

1. Export `sha256Hex` from `@icm/derived` (single source of truth; output is
   identical to `createHash("sha256")` over UTF-8 bytes).
2. Add `agent-adapter/src/platform.ts`: `utf8ByteLength(s)` (TextEncoder) and
   `base64EncodeUtf8(s)` (base64 over UTF-8 bytes, no globals).
3. Add `agent-adapter/src/envelope.ts`: `PROTOCOL_VERSION`, the
   `AgentSessionMessageSchema`/type, the event union, and the typed transport
   error-code union — frozen per the WP-WA0 spec.
4. Make `snapshot.ts` browser-safe: remove the unused `createHash` import; use
   `utf8ByteLength`.
5. Make `service.ts` browser-safe: remove `createHash`; use `sha256Hex`,
   `utf8ByteLength`, and `base64EncodeUtf8` on the render path. Output bytes/hash
   are byte-identical.
6. Split exports: `index.ts` exports the browser-safe surface (schema, snapshot,
   service, platform, envelope, openapi) and **not** http. Add `loopback.ts`
   re-exporting http for the Node subpath `./loopback`. Update `package.json`
   exports with the `./loopback` subpath.
7. Add `browser-safety.test.ts`: functionally exercise capabilities/snapshot/
   transact/render through the browser-safe service, and statically assert the
   browser-safe source files contain no `node:` specifiers or `Buffer.` usage.

## Validation

- `git diff --check`, `git status --short --branch`
- `corepack pnpm --filter @icm/agent-adapter test` (service/snapshot/http/parity
  + new browser-safety test) — confirms behavior parity after removing Node imports
- `corepack pnpm typecheck` (workspace) — confirms typing without Node globals in
  the browser-safe files
- Prettier on changed `packages/**`

Rationale: this target changes a shared package's import boundary and crypto
path, so the focused package test suite plus workspace typecheck is the smallest
deterministic cover. No editor/worker code imports the changed surface yet, so no
broader suite is required at this target.

## Commit Intent

```text
feat(agent): split browser-safe protocol boundary (WP-WA1)
```

## Outcome

Split the browser-safe protocol boundary without creating a new package. Exported
the existing dependency-free `sha256Hex` from `@icm/derived`; added
`agent-adapter/platform.ts` (`utf8ByteLength`, `base64EncodeUtf8`) and
`envelope.ts` (frozen `AgentSessionMessage`, event union, transport error codes,
permission scopes); removed `node:crypto`/`Buffer` from `snapshot.ts` and
`service.ts` (render hash/base64/byte-length now use the browser-safe helpers,
byte-identical to the Node equivalents); moved the Node-only loopback to the
`./loopback` subpath so the main entry pulls no `node:` builtins.

Validation: existing `service`/`snapshot`/`http`/`parity` suites stay green
(render base64/sha256 round-trip unchanged); new `browser-safety.test.ts`
exercises capabilities/snapshot/render through the browser-safe service, proves
the platform helpers are byte-identical to Node, parses representative
envelope/scope/error values, and statically asserts the browser-safe source
files contain no `node:` imports or `Buffer.` usage. Workspace `typecheck`
clean. 177 combined derived+adapter tests pass.
