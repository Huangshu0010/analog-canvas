import { describe, expect, it } from "vitest";

import {
  AGENT_OPERATING_KIT_FORMAT,
  AGENT_OPERATING_KIT_VERSION,
  agentOperatingKit,
} from "./agent-kit.js";

describe("Agent operating Kit", () => {
  it("contains the small provider-neutral working set", () => {
    expect(agentOperatingKit).toMatchObject({
      format: AGENT_OPERATING_KIT_FORMAT,
      version: AGENT_OPERATING_KIT_VERSION,
    });
    expect(agentOperatingKit.files.map((file) => file.path)).toEqual([
      "README.md",
      "AGENTS.md",
      "skills/icm-circuit-session/SKILL.md",
      "references/session-contract.md",
    ]);
  });

  it("contains operating guidance but never a credential or Project payload", () => {
    const text = agentOperatingKit.files.map((file) => file.content).join("\n");
    expect(text).toContain("snapshot");
    expect(text).toContain("transact");
    expect(text).toContain("OpenAPI");
    expect(text).not.toContain("agentToken:");
    expect(text).not.toContain("claimCode:");
  });
});
