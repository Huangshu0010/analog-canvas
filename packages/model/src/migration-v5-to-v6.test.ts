import { describe, expect, it } from "vitest";

import { migrateV5ToV6 } from "./migration-v5-to-v6.js";

describe("migrateV5ToV6", () => {
  it("advances without converting ordinary Port symbol instances", () => {
    const migrated = migrateV5ToV6({
      schemaVersion: 5,
      documents: [
        {
          instances: [{ id: "P1", symbolId: "port", properties: {} }],
        },
      ],
    });

    expect(migrated).toEqual({
      schemaVersion: 6,
      documents: [
        {
          instances: [{ id: "P1", symbolId: "port", properties: {} }],
        },
      ],
    });
  });
});
