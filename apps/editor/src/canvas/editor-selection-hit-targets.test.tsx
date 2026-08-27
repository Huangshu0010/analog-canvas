import {
  resolveDocumentRoutingGeometry,
  resolveDocumentStyleProfile,
} from "@icm/derived";
import { createEmptyDocument } from "@icm/model";
import { builtInSymbols, InMemorySymbolResolver } from "@icm/symbols";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EditorSelectionHitTargets } from "./editor-selection-hit-targets";

describe("editor selection hit targets", () => {
  it("renders a selected route from resolved geometry", () => {
    const document = createEmptyDocument("cell", "Cell");
    document.nets.push({ id: "net", terminals: [] });
    document.junctions.push(
      { id: "a", netId: "net", position: { x: 0, y: 0 }, role: "route-anchor" },
      {
        id: "b",
        netId: "net",
        position: { x: 40, y: 0 },
        role: "route-anchor",
      },
    );
    document.routes.push({
      id: "route",
      netId: "net",
      from: { kind: "junction", junctionId: "a" },
      to: { kind: "junction", junctionId: "b" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    const resolver = new InMemorySymbolResolver(builtInSymbols);
    const geometry = resolveDocumentRoutingGeometry(
      document,
      resolver,
    ).routes.get("route")!;
    const markup = renderToStaticMarkup(
      <EditorSelectionHitTargets
        document={document}
        resolver={resolver}
        routeGeometryRecords={[{ route: document.routes[0]!, geometry }]}
        styleProfile={resolveDocumentStyleProfile(document.presentation)}
        tool="pointer"
        selectedInstanceIds={[]}
        selectedRouteId="route"
        supplementalRouteIds={[]}
        selectedInternalRouteIds={new Set()}
        selectedAnnotationId={null}
        supplementalAnnotationIds={[]}
        cellSymbolLayoutInstanceId={null}
        onInstanceClick={vi.fn()}
        onInstanceOpen={vi.fn()}
        onInstancePointerDown={vi.fn()}
        onRoutePointerDown={vi.fn()}
        onAnnotationPointerDown={vi.fn()}
        onAnnotationEdit={vi.fn()}
      />,
    );
    expect(markup).toContain('data-testid="route-hit-route"');
    expect(markup).toContain('class="route-hit selected"');
  });
});
