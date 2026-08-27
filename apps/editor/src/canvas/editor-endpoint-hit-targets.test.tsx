import type { WireSource } from "@icm/edit-engine";
import { createEmptyDocument } from "@icm/model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorEndpointHitTargets } from "./editor-endpoint-hit-targets";

describe("editor endpoint hit targets", () => {
  it("marks the selected junction endpoint active", () => {
    const endpoint = { kind: "junction" as const, junctionId: "j1" };
    const source: WireSource = {
      endpoint,
      netId: "net",
      connection: {
        endpoint,
        contactPoint: { x: 10, y: 20 },
        gridLanding: { x: 10, y: 20 },
        escapePath: [],
        outward: null,
      },
      preludeEdits: [],
    };
    const markup = renderToStaticMarkup(
      <EditorEndpointHitTargets
        document={createEmptyDocument("cell", "Cell")}
        endpoints={[source]}
        tool="pointer"
        selectedRoute={undefined}
        selectedRouteSegmentIndex={null}
        selectedEndpoint={source}
        supplementalJunctionIds={[]}
        endpointLabel={() => "junction-j1"}
        onEndpointActions={vi.fn()}
        onPowerRailStretch={vi.fn()}
        onJunctionSelect={vi.fn()}
        onWireEndpoint={vi.fn()}
      />,
    );
    expect(markup).toContain('data-testid="junction-j1"');
    expect(markup).toContain('class="endpoint-hit active"');
  });
});
