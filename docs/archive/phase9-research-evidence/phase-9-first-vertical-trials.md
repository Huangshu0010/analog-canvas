# Phase 9 first Snapshot-driven vertical trials

Date: 2026-08-07

Status: checked initial failure trace and checked recovery trace

## Method

The retired `snapshot-audit.mjs` program
imports each untouched SPICE source, calls API v2 `capabilities`, obtains one
complete Snapshot for every Document, performs a revision-safe v2 dry-run, and
requests a diagnostic render. It makes zero v1 query calls and enables no
optional helper. The deterministic report is
[`initial-vertical-snapshot-audit.json`](artifacts/initial-vertical-snapshot-audit.json).

This is deliberately an initial/failed trace where the product cannot yet
express the next honest edit. It does not retrofit the known RLC/CDAC target
coordinates into the input and does not call the existing recipe's direct model
normalization a valid Agent transaction.

## Results

| Case                       | Documents | Instances | Snapshot result                                           | Blocking next-step gap                                                                   |
| -------------------------- | --------: | --------: | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 100 MHz RLC bandpass       |         1 |        14 | complete primitive pin/Net facts in 14,181 bytes          | three ports are unplaced but no port-placement edit exists                               |
| hierarchical SKY130 CDAC   |         2 |        18 | six hierarchy references and both complete Documents      | five MOS instances retain generic symbols; 15 ports cannot be placed through typed edits |
| unseen SKY130 OTA          |         1 |         6 | complete topology and parameters in 10,693 bytes          | six generic MOS mappings plus six unplaceable ports                                      |
| hierarchical divide-by-two |         7 |        28 | all Documents fit individually; 14 references are visible | primitive MOS leaf Documents remain generic and every imported port is unplaced          |

All calls used the flat v2 operation list
`capabilities/snapshot/transact/render`. Each Snapshot passed its schema and
bidirectional topology checks in the adapter. Diagnostic renders succeeded even
for fully unplaced inputs and reported object-addressed unplaced-instance facts.

## Failure ownership

### Facts: sufficient for the first reasoning pass

The Snapshot supplies all persisted terminals, Net membership, model target,
parameters, Document references, and current placement/routing state. No
region/topology query was needed. The absence of semantic MOS pin names is not a
Snapshot omission: the importer/resolver has not yet established a reviewed PDK
mapping, so retaining generic pins is the safe fact.

### Actions: confirmed product gaps

The typed Edit Engine lacks:

- `set_instance_symbol` for a reviewed symbol remap;
- `place_port` and `move_port` for the same operation available to a human view;
- a safe way for a mapping operation to preserve source model/parameters while
  validating the existing terminal names against the target symbol.

The earlier CDAC recipe worked around these gaps by mutating Document ports,
symbols, and terminal pin names before transactions. That is useful prototype
evidence but fails the Phase 9 single-mutation-boundary requirement.

### Knowledge: not the current blocker

The RLC can be read directly from its passive topology. The CDAC Snapshot exposes
repeated units and reference edges; the OTA exposes paired inputs, shared tail,
active-load connections, and device ratios. The initial Skill/knowledge is
enough to form hypotheses with counterevidence. More pattern cards would not
make the missing edits legal.

### Mechanical cost: do not add a helper yet

Placement/routing expansion is repetitive in the CDAC, but the trial cannot
measure residual cost until PDK normalization and port/symbol edits are legal.
No helper passes the WP-9.8 entry gate at this point.

## Recovery run

The confirmed gaps were closed with reviewed SKY130 mappings,
`set_instance_symbol`, `place_port`, and `move_port`. The repeat audit is
[`post-gap-snapshot-audit.json`](artifacts/post-gap-snapshot-audit.json)
and the end-to-end replay report is
[`recovery-layout-replay.json`](artifacts/recovery-layout-replay.json).

The recovery run:

1. found zero known SKY130 generic MOS mappings and no missing edit kinds;
2. replayed RLC and hierarchical CDAC layouts entirely through v2 typed edits;
3. preserved the imported topology signature in every edited Document;
4. obtained refreshed final Snapshots and diagnostic renders with no final
   visual diagnostics;
5. used four transactions for RLC and eight across both CDAC Documents, with a
   dry-run before every commit and no rollback;
6. kept all optional helpers disabled.

This evidence does not justify a new circuit-specific helper: transaction count
is already small, and the remaining repeated work is generic edit construction
that the existing transaction batching handles. Phase 9 therefore adds no
`draw_cdac`, `place_array`, topology classifier, or Layout Intent layer.
