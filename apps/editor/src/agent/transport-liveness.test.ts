import { describe, expect, it } from "vitest";

import {
  createHeartbeat,
  isHeartbeatAck,
  isTransportStale,
} from "./transport-liveness";

describe("Agent transport liveness", () => {
  it("creates and recognizes only session-bound heartbeat control frames", () => {
    expect(createHeartbeat("session-1", "nonce-1")).toEqual({
      protocolVersion: "1.0",
      sessionId: "session-1",
      kind: "heartbeat",
      nonce: "nonce-1",
    });
    expect(
      isHeartbeatAck(
        {
          protocolVersion: "1.0",
          sessionId: "session-1",
          kind: "heartbeat-ack",
          nonce: "nonce-1",
        },
        "session-1",
      ),
    ).toBe(true);
    expect(
      isHeartbeatAck(
        {
          protocolVersion: "1.0",
          sessionId: "other-session",
          kind: "heartbeat-ack",
          nonce: "nonce-1",
        },
        "session-1",
      ),
    ).toBe(false);
  });

  it("marks a connection stale at the shared timeout boundary", () => {
    expect(isTransportStale(10_000, 54_999)).toBe(false);
    expect(isTransportStale(10_000, 55_000)).toBe(true);
  });
});
