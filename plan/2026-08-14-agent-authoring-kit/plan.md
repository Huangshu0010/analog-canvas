---
status: completed
experience: none
---

# External Agent Authoring Kit

## Goal

Extend the deployed Agent Kit so an external Agent without this repository can
create a small Razavi-style schematic from an empty Document using product facts
rather than guessing symbol IDs, pin order, variants, or VDD semantics. Keep
the existing four Circuit operations unchanged and avoid a dynamic catalog API.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-authoring-kit
```

The worktree is clean. This target owns the browser-safe Agent Kit projection,
its generated authoring facts, focused tests, the public-session/Agent docs,
and factual plan records:

- `packages/agent-adapter/src/agent-kit.ts` and focused tests
- `packages/agent-adapter/src/index.ts` and package export metadata to keep the
  Kit out of the browser editor bundle
- `worker/agent-session.ts` and its focused test for the public Kit-route
  payload version
- a compact generated authoring-catalog module plus its deterministic generator
- `scripts/` and root `package.json` wiring required to regenerate/check that
  owned artifact
- `docs/agent/README.md`, `docs/agent/api-usage.md`, and the relevant accepted
  Agent-session/API specifications, runtime behavior guide, and reproducible
  examples
- `plan/2026-08-14-agent-authoring-kit/plan.md` and `plan/log.md`

Read-only shared dependencies are the Razavi source catalog/assets,
`packages/edit-engine` typed mutations, generated OpenAPI, Worker relay, and
browser connection UI. The Kit must not add a Circuit operation, credential,
Project payload, catalog query, or alternate mutation path.

## Work

1. Derive a small static authoring catalog from the reviewed Razavi catalog:
   product identity, constructible symbol IDs, canonical pins, default/hidden
   variants, and the VDD/GND/Port authoring primitives. Exclude drawing
   geometry, SVG primitives, Project data, and credentials.
2. Include that projection and a concise create-from-empty workflow in the
   existing public Kit. State the authority split: static Kit catalog for known
   built-ins; Snapshot for browser objects; OpenAPI/capabilities for requests
   and permissions; unknown/custom symbols require a human fact.
3. Correct ambiguous recovery/catalog wording in the public Agent docs without
   moving repository-only generator or RouteGraph instructions into the Kit.
4. Add a black-box regression proving the downloaded Kit contains enough facts
   to construct a CMOS inverter in two phases (create, refresh, then wire),
   while preserving the existing small, secret-free Kit boundary.

## Validation

- focused Agent-kit/catalog and Agent-service contract tests
- generator freshness/check for the owned generated artifact
- `pnpm typecheck`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

The branch changes a public payload and source-derived asset projection; run
`pnpm verify:branch` before review. The mainline gate remains frozen install +
`pnpm ci:check` and remote required checks before merging.

## Commit Intent

Commit as:

```text
feat(agent): publish Razavi authoring kit
```

## Outcome

Published Kit v2 with a 9.1 KB generated projection of the reviewed Razavi
catalog: constructible symbol IDs, canonical pins, default/hidden variants,
and the VDD rail primitive, without symbol geometry or Project data. The Kit
now documents two-phase construction and MOS bulk facts, and public documents
distinguish this static product material from a dynamic catalog operation.

The black-box Kit test creates, refreshes, wires, bulk-reconciles, validates,
and formally renders a CMOS inverter through the existing four-operation API.
The Kit moved to the `@icm/agent-adapter/kit` subpath so it remains absent from
the editor browser bundle and is delivered only by the Worker route.

Validation passed: focused Kit/Worker tests (24 tests), generator freshness,
typecheck, Markdown-link checks, `git diff --check`, and `pnpm verify:branch`
(104 files / 567 tests, all workspace builds, production smoke). The mainline
frozen-install/`pnpm ci:check` and remote required checks remain pending before
merge.
