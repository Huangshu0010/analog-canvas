# Archived: VSS-derived Razavi Style Canon

Status: `superseded` by
[ADR 0011](../../adr/0011-retire-visio-vss-as-visual-authority.md) on
`2026-08-09`.

This document records the former VSS-derived profile only. It MUST NOT be
loaded by an Agent or used for current style, geometry, arrow, typography, or
stroke decisions. The active source is the raster-authoritative
[`Razavi visual contract`](../../specs/razavi-visual-contract.md).

# Razavi fixed-style hard canon (historical record)

Owner: `packages/render-svg` and `packages/symbols` for the token values; Agent
reasoning for applying the canon when placing, routing, and labeling. Strength:
**hard** for the coordinate, typography, and stroke/node canon described here;
**not a canon** for routing topology, elbow/trunk choice, obstacle avoidance,
or composition. Trigger: any placement, label text, Route geometry, or
visual-token decision under the `razavi-textbook-v1` profile.

This is an Agent-facing curated view of the fixed-style hard canon. At the time,
the authoritative source was `docs/specs/razavi-textbook-style.md` (status
`proposed`, version `0.1`); it is now replaced by the
[`Razavi visual contract`](../../specs/razavi-visual-contract.md). The runtime
token values quoted here were read from
`packages/render-svg/src/style-profile.ts`.

## What the fixed style is, and is not

The fixed style has exactly three asset layers:

1. component geometry and electrical anchors;
2. typography and schematic-math composition;
3. stroke, node, and arrow presentation.

Routing topology, automatic layout, elbow choice, obstacle avoidance, and
interactive wire gestures **are not fixed-style assets**. They consume this
profile but belong to separate routing and layout judgment. Conflating style
fidelity with routing quality is the error this canon exists to prevent: the
three layers above are mechanically judgeable; routing is not.

When this profile is in effect, treat the coordinate, typography, and
stroke/node rules below as hard constraints the renderer will enforce or
visually expose. Treat any routing decision as your own judgment, guided by
[`routing-and-diagnostics.md`](../../agent/knowledge/routing-and-diagnostics.md),
[`schematic-expression.md`](../../agent/knowledge/schematic-expression.md), and
[`layout-guidance.md`](../../agent/layout-guidance.md) — not by this canon.

## Coordinate canon

- Canonical connection grid: `10` scene units.
- VSS conversion scale: `100` scene units per Visio internal inch.
- Electrical pin anchors must be divisible by `10` on both axes.
- Component placement must preserve connection-grid alignment after rotation
  and mirroring. Choose positions on the grid so rotated/mirrored pin anchors
  remain on-grid.
- Geometry may use integer scene coordinates between connection-grid points.
- Formal geometry and strokes scale together with the exported scene.
- Formal SVG must not use `vector-effect="non-scaling-stroke"`; stroke widths
  scale with the scene.
- Formal foreground is `#202020`; background is `#ffffff`.

Practical consequence for placement: when you `place_instance` or
`move_instance`, prefer positions where both axes are multiples of `10`, so
every pin's resolved `pagePosition` stays on-grid. Pin page coordinates are
derived from the symbol's `pin.at` transformed by placement; off-grid placement
produces off-grid pins, which the acceptance gates reject.

## Typography canon

Formal instance, Net, current, voltage, and supply labels use schematic-math
composition. The persisted string stays human-readable; the renderer composes
base and subscript runs. The rules the renderer enforces:

- An explicit underscore has priority: `base_subscript` parses the content
  after `_` as an explicit subscript run.
- For semantic instance labels, the alphabetic designator is the base and the
  remaining identifier is the subscript:
  `M1` → italic bold `M` + subscript `1`; `R1` → `R` + `1`.
- For recognized voltage/current/power labels, the leading `V` or `I` is the
  base and the remaining identifier is the subscript:
  `VDD` → `V` + `DD`; `Vb1` → `V` + `b1`; `IX` → `I` + `X`.
- Plain notes and figure captions are **never** implicitly parsed as math.
- `+`, `-`, parentheses, and numeric values remain upright unless explicitly
  included in a math run. A trailing `+` or `-` on a recognized V/I label stays
  in a separate upright suffix run.
- Text stays upright under component rotation or mirroring; the label does not
  rotate with the device.

Token values (scene units): `fontFamily` `Arial,'Helvetica Neue',Helvetica,
sans-serif`; `mathWeight 700`; `mathStyle italic`; `plainWeight 400`;
instance/Net/power/annotation font size `16`; polarity and caption font size
`14`; `subscriptScale 0.68`; subscript baseline shift `0.30em` downward;
`labelGap 6`; `lineHeight 1.0`.

Practical consequence for labeling: write label strings the way you want them
read (`M1`, `VDD`, `VIN+`, `Vb1`); the renderer composes the math. Do not
manually insert subscript markup or Unicode subscripts. Do not rely on
formatting a caption as if it were a Net label — captions render as upright
plain text.

## Stroke and node canon

Only semantic stroke roles may choose line widths. A source-generated asset
maps reviewed VSS weights to roles: `1.2` point → `normal`, `2.16` point →
`emphasis`. Unknown source weights block generation rather than clustering
silently. Roles and values (scene units):

| Role           | Value  | Use                                            |
| -------------- | -----: | ---------------------------------------------- |
| `wire`         | `1.6`  | Conductors                                     |
| `symbol`       | `1.6`  | Unmigrated component compatibility geometry    |
| `normal`       | `1.2`  | Reviewed normal Visio component geometry       |
| `emphasis`     | `2.16` | MOS gates and reviewed heavy Visio geometry    |
| `supply`       | `1.8`  | GND/VDD/VSS bars                               |
| `annotation`   | `1.6`  | Current arrows and polarity geometry           |

Line cap `butt`; line join `miter`; miter limit `4`. Junction and Port origin
radius `3.0`; supply bar width `20`; current arrow length `24`; arrow head
length `10`, width `7`.

Connection-origin truth — the renderer draws based on explicit object kind, not
on geometric degree:

| Object                        | Formal appearance                            |
| ----------------------------- | -------------------------------------------- |
| Device pin anchor             | Invisible                                    |
| Placed signal Port origin     | Filled foreground circle, radius `3.0`       |
| Power Port with power label   | Supply bar width `20`; no overlapping dot    |
| Explicit Junction             | Filled foreground circle, radius `3.0`       |
| Two-wire corner               | No extra dot                                 |
| Non-connected geometric cross | No dot and no bridge                         |

Degree alone does not create a dot. Connectivity and explicit object kind are
the authority. A positioned Port renders as power presentation only when a
persisted `power-label` annotation is attached to that Port ID.

Practical consequence for routing: a crossing you draw without an explicit
Junction object is a crossing, not a connection, and renders with no dot. To
make a T or X branch connect, add an explicit `add_junction` (with `split` when
it lands on an existing Route) — the dot then appears automatically. Do not
expect a dot from geometry alone.

## Out of scope (the boundary)

The following are **not** part of this hard canon and are not implied by the
fixed style. They are routing and composition judgment:

- Route topology: trunk vs. branch vs. labeled-islands vs. direct.
- Elbow choice and bend direction.
- Trunk placement, lane assignment, and shared-rail decisions.
- Obstacle avoidance and detour length.
- Label density, spacing margins, and overall composition.
- Bus alignment and wire-to-symbol clearance.

For those, read the routing and composition authorities above. This canon only
says what the renderer will enforce for coordinates, text, strokes, and nodes;
it does not say how to route.

## Provenance and stability

This doc tracks `razavi-textbook-style.md`, which is `proposed`. Token values
may change before RV-7 acceptance (the spec's RV-7 step is what switches
new-Project/new-import defaults to `razavi-textbook-v1` after all gates pass).
The spec remains authoritative on conflict; if the spec and this doc disagree,
report the drift rather than choosing one silently. Existing Projects retain
their persisted `textbook-monochrome-v1` profile; opening an old Project does
not silently switch it to Razavi.

## Counterevidence and failure modes

- An off-grid pin (`pagePosition` not divisible by `10`) means the placement is
  wrong, not that the grid canon is advisory. Move the instance onto the grid.
- A label rendered as upright plain text when you expected a subscript means
  the string was not a recognized instance/V/I form, or was a caption — not that
  math composition failed. Use an explicit underscore for unambiguous
  subscripts.
- A missing dot at a crossing you intended as a connection means no explicit
  Junction object exists there — not that the renderer omitted it. Add the
  Junction.
- A Route that renders with a wrong width means the Route's segment role was
  not set as expected, or a legacy numeric width was clustered — do not "fix" it
  by overriding the width; check the role assignment.
- A formal-scene dot on a device pin is always a defect; device pin anchors
  are invisible. Do not add visible marks to pin anchors.
