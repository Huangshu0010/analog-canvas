import { describe, expect, it } from "vitest";

import { createId, deriveStableId } from "./ids.js";

describe("stable identity", () => {
  it("derives the same ID from the same framed source identity", () => {
    expect(deriveStableId("instance", "source.spi", "M1")).toBe(
      deriveStableId("instance", "source.spi", "M1"),
    );
    expect(deriveStableId("instance", "source.spi", "M1")).not.toBe(
      deriveStableId("instance", "source.spiM", "1"),
    );
  });

  it("creates prefixed IDs from an injected UUID source", () => {
    expect(
      createId("route", () => "00000000-0000-4000-8000-000000000000"),
    ).toBe("route-00000000-0000-4000-8000-000000000000");
  });
});
