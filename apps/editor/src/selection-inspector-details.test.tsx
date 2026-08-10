import type { VisualDiagnostic } from "@icm/derived";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SelectionInspectorDetails,
  summarizeVisualDiagnostics,
} from "./selection-inspector-details";

const structural: VisualDiagnostic = {
  code: "BROKEN_ROUTE",
  severity: "error",
  category: "structural",
  confidence: "high",
  gateEligible: true,
  message: "Route is broken",
  objectIds: ["route-1"],
};

const observation: VisualDiagnostic = {
  code: "CROWDED_LABEL",
  severity: "info",
  category: "observation",
  confidence: "medium",
  gateEligible: false,
  message: "Label is crowded",
  objectIds: ["label-1"],
};

describe("selection inspector details", () => {
  it("partitions visual diagnostics and counts only gate failures", () => {
    expect(summarizeVisualDiagnostics([structural, observation])).toEqual({
      all: [structural, observation],
      structural: [structural],
      observations: [observation],
      blockingCount: 1,
    });
  });

  it("renders each diagnostic category once from the shared summary", () => {
    const markup = renderToStaticMarkup(
      <SelectionInspectorDetails
        snapshot={{
          selected: "route-1",
          internalRouteCount: 1,
          revision: 4,
          sourceStatus: "generated",
          documentCount: 2,
          activeDocumentId: "document-main",
          activeInstanceCount: 3,
          projectInstanceCount: 5,
          netCount: 2,
          tool: "pointer",
          flightlineCount: 0,
          crossingCount: 1,
          annotationCount: 2,
          status: "Selected route-1",
        }}
        importDiagnostics={[
          {
            code: "SPICE_NOTE",
            severity: "info",
            stage: "import",
            message: "Imported",
          },
        ]}
        visualSummary={summarizeVisualDiagnostics([structural, observation])}
        onSelectVisualDiagnostic={() => undefined}
      />,
    );

    const structuralList = markup.match(
      /<ul data-testid="visual-diagnostics">.*?<\/ul>/u,
    )?.[0];
    const observationList = markup.match(
      /<ul data-testid="visual-observations">.*?<\/ul>/u,
    )?.[0];
    expect(structuralList).toContain("BROKEN_ROUTE");
    expect(structuralList).not.toContain("CROWDED_LABEL");
    expect(observationList).toContain("CROWDED_LABEL");
    expect(observationList).not.toContain("BROKEN_ROUTE");
    expect(markup).toContain("SPICE_NOTE");
    expect(markup).toContain('data-testid="blocking-diagnostic-count">1');
  });
});
