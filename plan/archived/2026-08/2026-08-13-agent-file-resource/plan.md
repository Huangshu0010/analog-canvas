---
status: completed
experience: none
---

# Scoped Agent File Resource

## Goal

Complete the remaining browser-Agent file loop without adding a fifth Circuit
operation or a Project-level controller: an authorized Agent can obtain a
canonical Project file and formal SVG/PNG/PDF artifacts, stage bounded
`.icproj.json` or structural-SPICE source inputs, inspect a derived candidate,
and request a visible browser approval. The human alone accepts replacement;
Agent upload never silently replaces the live Project. Simulation, PVT,
waveforms, measurement data, and SPICE/design-netlist export remain excluded.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean after semantic-control commit `319e59e`. This target owns
the new scoped **File Resource** transport schemas/routes, transient session
broker, browser file adapter and approval surface, generated OpenAPI, tests,
and current specifications. It must reuse the current serializer, formal
exporters, SPICE importer, Project replacement, and session machine; it may not
create a second circuit mutation or persistence path.

- `packages/agent-adapter/src/{envelope,schema,openapi,platform}.ts` and
  focused contract tests
- `worker/agent-session.ts` and Worker tests
- `apps/editor/src/agent/*`, browser file adapter/approval UI, and focused E2E
- existing exporter/import/project lifecycle helpers only as read authorities
- generated Agent artifacts, current API/session/file/export specifications,
  roadmap, this plan, and `plan/log.md`

Read-only authorities and constraints:

- `serializeProject()`, `parseProject()`, `importSpiceSources()`,
  `createFormalExportSource()` and browser formal exporters remain the only
  file/artifact derivations.
- `useDocumentController.replaceProject()` and its normal recovery/session
  replacement behavior remain the only acceptance path.
- Durable Object storage may retain only metadata/idempotency state, never raw
  candidate or artifact bytes. Browser memory owns short-lived bytes.
- Public Agent access remains claim, Circuit, and named File Resource routes;
  editor socket/control/internal DO routes remain unpublished.

## Work

1. Freeze a small File Resource request/result vocabulary and independently
   scoped permission set: canonical Project download, formal visual download,
   candidate stage/inspect/discard, and explicit browser approval request.
   Validate filename/media/length/hash/virtual include graph; reject paths,
   URLs, traversal, unbounded blobs, and excluded output kinds.
2. Extend the existing session relay envelope and one browser Host boundary to
   forward File Resource commands with bounded idempotent responses. Reuse its
   current token/session/Project fences and keep raw bytes out of DO storage,
   recovery, logs, and events.
3. Implement one browser adapter that creates canonical Project/formal artifact
   bytes from the live revision and stages Project/SPICE inputs in memory. Show
   the human a candidate summary plus diagnostics and require explicit
   Cancel/Open-and-disconnect decision before calling existing Project
   replacement. Clear candidates on expiry, revoke, replacement, and tab close.
4. Publish the File Resource in OpenAPI/capabilities and copied connection
   instructions. Keep the Circuit operation list unchanged and do not expose
   local paths, raw host filesystem access, or design netlist export.
5. Add deterministic unit/Worker/browser E2E coverage for authorization,
   hash/size/path rejection, byte identity, candidate non-mutation, approval,
   cancellation, terminal cleanup, and session replacement behavior.

## Validation

- focused Agent adapter/Worker/browser file-resource tests and browser E2E
- generated Agent artifact check; docs/type/diff checks
- `pnpm verify:branch`; before any merge to `main`, frozen install, full
  `pnpm ci:check`, and required remote checks

## Commit Intent

```text
feat(agent): add scoped browser file resource
```

## Outcome

Implemented the named, scope-gated File Resource without adding a fifth Circuit
operation. The browser produces canonical Project/formal SVG/PNG/PDF bytes,
stages bounded Project or structural-SPICE candidates only in browser memory,
and requires a visible Reject/Replace Project confirmation. The relay forwards
typed requests through the existing session machine, caches summaries only, and
marks export replies one-shot so it never retains artifact bytes. Candidate
approval reuses the normal Project replacement/session-revocation lifecycle.

Validation passed: focused Agent/Worker/browser-host suites (48 tests), the
browser session E2E (including stage/approval/reject), typecheck, generated API
artifact check, docs check, `git diff --check`, and `pnpm verify:branch` (120
files / 725 tests, workspace build, production smoke).
