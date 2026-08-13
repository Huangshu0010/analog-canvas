import { describe, expect, it } from "vitest";

import { createEmptyProject } from "./factories.js";
import { migrateV6ToV7 } from "./migration-v6-to-v7.js";
import { parseProject } from "./persistence.js";

describe("schema 6 to 7 annotation migration", () => {
  it("separates legacy Net identity from its visual route anchor", () => {
    const migrated = migrateV6ToV7({
      schemaVersion: 6,
      documents: [
        {
          id: "main",
          nets: [{ id: "net-out", terminals: [], ports: [] }],
          routes: [{ id: "route-out" }],
          annotations: [
            {
              id: "out-label",
              kind: "net-label",
              text: "V_out",
              attachedObjectId: "net-out",
              position: { x: 80, y: 20 },
              routeAttachment: {
                routeId: "route-out",
                segmentIndex: 0,
                t: 0.5,
                normalOffset: -8,
                direction: "forward",
              },
              alignment: "middle",
              rotation: 0,
              locked: false,
            },
          ],
        },
      ],
    }) as { schemaVersion: number; documents: Array<Record<string, unknown>> };

    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.documents[0]?.annotations).toEqual([
      expect.objectContaining({
        id: "out-label",
        netId: "net-out",
        content: expect.any(Object),
        anchor: expect.objectContaining({
          kind: "route",
          routeId: "route-out",
        }),
      }),
    ]);
    const label = (
      migrated.documents[0]?.annotations as Array<Record<string, unknown>>
    )[0]!;
    expect(label).not.toHaveProperty("text");
    expect(label).not.toHaveProperty("routeAttachment");
    expect(label).not.toHaveProperty("attachedObjectId");
  });

  it("makes an unresolved historic label explicitly free without inventing a Net", () => {
    const project = createEmptyProject("legacy", "Legacy") as unknown as {
      schemaVersion: number;
      documents: Array<Record<string, unknown>>;
    };
    project.schemaVersion = 6;
    project.documents[0]!.annotations = [
      {
        id: "orphan-label",
        kind: "net-label",
        text: "ORPHAN",
        attachedObjectId: "missing-net",
        position: { x: 30, y: 40 },
        offset: { x: 0, y: 0 },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
    ];

    const parsed = parseProject(JSON.stringify(project));
    expect(parsed.documents[0]!.annotations).toEqual([]);
    expect(parsed.documents[0]!.drafting?.objects).toEqual([
      expect.objectContaining({
        kind: "text",
        anchor: { kind: "free", position: { x: 30, y: 40 } },
      }),
    ]);
  });
});
