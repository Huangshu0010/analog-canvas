# External evaluation runner contract

The runner is the only mutation/output path for an isolated Phase 9 tier. Do
not edit `starting-project.icproj.json`, a generated final Project, Snapshot,
trace, metric, or SVG directly.

## 1. Inspect through API v2

From the repository root, run:

```powershell
node tools/agent-layout/external-eval-runner.mjs inspect <your-tier-directory>
```

Read only your tier's `context.md`, `result-contract.json`,
`work/capabilities.json`, and `work/initial.snapshots.json`. Do not inspect
another tier. The Snapshot contains all object IDs, pin/Net topology, placement,
hierarchy, and diagnostics required for reasoning.

## 2. Author typed transactions

Write `work/plan.json` in your tier directory:

```json
{
  "transactions": [
    {
      "id": "place-comparator",
      "documentId": "document-id-from-snapshot",
      "edits": [
        {
          "kind": "place_instance",
          "instanceId": "instance-id-from-snapshot",
          "placement": {
            "position": { "x": 200, "y": 160 },
            "rotation": 0,
            "mirror": "none"
          }
        },
        {
          "kind": "place_port",
          "portId": "port-id-from-snapshot",
          "position": { "x": 80, "y": 160 }
        }
      ]
    }
  ]
}
```

Each transaction targets one Document and contains at most 64 edits. Use IDs
from the Snapshot. The runner supplies the current `expectedRevision`, dry-runs
the exact batch, then commits it through Agent Circuit API v2.

Useful route edits have this form:

```json
{
  "kind": "set_route_points",
  "routeId": "new-unique-route-id",
  "netId": "net-id-from-snapshot",
  "from": { "kind": "terminal", "instanceId": "instance-id", "pinName": "D" },
  "to": { "kind": "port", "portId": "port-id" },
  "waypoints": [{ "x": 240, "y": 180 }],
  "segmentModes": ["orthogonal", "orthogonal"]
}
```

Endpoints may be `terminal`, `port`, or `junction`. `add_junction` requires a
unique `junctionId`, an existing `netId`, and a position. Route segment mode
count must match the normalized segment count. Prefer short orthogonal routes;
do not create a Junction merely because unrelated geometry crosses.

## 3. Execute and review

Run:

```powershell
node tools/agent-layout/external-eval-runner.mjs execute <your-tier-directory>
```

If a dry-run fails, revise `work/plan.json`; do not bypass the API. On success,
inspect only your own `result/final.svg`, per-Document renders, final Snapshots,
and diagnostics. You may replace the plan and execute again from the unchanged
starting Project until the result is readable and every instance/port is
placed. The final execution writes every required result file, records the real
API operation sequence, and derives every Snapshot/render from the committed
Project.
