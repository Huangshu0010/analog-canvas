# Analog Canvas

Analog Canvas is a local-first, connectivity-aware schematic editor. Import
structural SPICE, edit a typed circuit model in the browser, save one portable
Project file, and export formal drawings.

## Start here

- **Use the editor:** [Getting started](docs/user/getting-started.md),
  [schematic hierarchy](docs/user/schematic-hierarchy.md),
  [compatibility](docs/user/project-compatibility.md), and
  [troubleshooting](docs/user/troubleshooting.md).
- **Understand the product:** [current architecture](docs/overall-product-plan.md)
  and [documentation map](docs/README.md).
- **Develop or contribute:** [working rules](AGENTS.md),
  [current development reading set](docs/current/README.md), and
  [validation commands](#validation) and the [test system](docs/testing/README.md).

## Run locally

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open the displayed loopback URL. Create a circuit from the component palette,
or import one `.cir`, `.sp`, or `.spi` entry together with its local include
files. Use **File / Save Project** to download the authoritative
`.icproj.json` file; browser recovery is only a non-authoritative safety copy.

## What the repository contains

- `apps/editor/`: React/SVG editor.
- `apps/local-host/`: loopback-only production host for the installable PWA.
- `packages/model/`, `packages/project-protocol/`, and `packages/edit-engine/`:
  current persisted circuit model, bounded file compatibility, and atomic
  mutation boundary.
- `packages/spice/`, `packages/devices/`, `packages/symbols/`, and
  `packages/netlist/`: structural SPICE import, built-in device facts, symbol
  semantics, and deterministic design-netlist export.
- `packages/exporters/` and `packages/render-svg/`: formal SVG, PNG, and PDF
  output.
- `docs/`: current architecture, user guides, normative contracts, ADRs, and
  delivery plans.

The [Razavi reference manifest](fixtures/visual-reference/razavi-reference-v1/)
is the sole visual authority.

## Validation

```powershell
# Review the planned validation surface before expensive checks
pnpm gate:plan -- --base origin/main
pnpm gate:preflight -- --base origin/main

# Focused implementation loop
pnpm test:local <test-paths>
pnpm test:e2e:local <spec-paths> --grep <pattern>

# Automated affected checks selected from the real diff
pnpm gate:affected -- --base origin/main

# Branch integration
pnpm gate:branch

# Required local gate before a non-document delivery reaches main
pnpm gate:full
```

Gate planning is advisory and conservatively falls back to the full gate for
unknown paths or validation-policy changes. Use the smallest relevant check
during development; the canonical complete gate and GitHub required checks
still apply before mainline delivery. Every target also closes with
`git diff --check` and `git status --short --branch`; see [AGENTS.md](AGENTS.md)
for the delivery gate.

## Citation

If you use Analog Canvas in research, teaching, or another publication, cite:

> Zengchun Chen and Zhishuai Zhang. _Analog Canvas_. 2026.
> Available at: https://github.com/chenzc24/Analog-Canvas

```bibtex
@software{chen2026analogcanvas,
  author = {Chen, Zengchun and Zhang, Zhishuai},
  title = {Analog Canvas},
  year = {2026},
  url = {https://github.com/chenzc24/Analog-Canvas},
  note = {Software repository}
}
```
