import type { InstanceValueSource } from "@icm/derived";
import type { Annotation, RouteEndpoint, SchematicDocument } from "@icm/model";

import { componentParameters } from "../features/component-insert/component-parameters";

export function endpointTestId(endpoint: RouteEndpoint): string {
  switch (endpoint.kind) {
    case "terminal":
      return `terminal-${endpoint.instanceId}-${endpoint.pinName}`;
    case "junction":
      return `junction-${endpoint.junctionId}`;
  }
}

export function maxRoutingCounter(document: SchematicDocument): number {
  const ids = [
    ...document.instances.map((item) => item.id),
    ...document.nets.map((item) => item.id),
    ...document.routes.map((item) => item.id),
    ...document.junctions.map((item) => item.id),
    ...document.annotations.map((item) => item.id),
    ...document.layoutGroups.map((item) => item.id),
    ...document.constraints.map((item) => item.id),
  ];
  let maximum = 0;
  for (const id of ids) {
    for (const match of id.matchAll(
      /(?:route-ui|junction-ui|net-ui)-(\d+)/gu,
    )) {
      maximum = Math.max(maximum, Number(match[1]));
    }
  }
  return maximum;
}

export function previewInstanceValueSource(
  instance: SchematicDocument["instances"][number],
  draft: { instanceId: string | null; parameters: Record<string, string> },
): InstanceValueSource {
  if (draft.instanceId !== instance.id) return instance;
  const parameters = { ...(instance.netlist?.parameters ?? {}) };
  for (const parameter of componentParameters(instance.symbolId)) {
    const value = (draft.parameters[parameter.key] ?? "").trim();
    if (value === "") delete parameters[parameter.key];
    else parameters[parameter.key] = value;
  }
  return {
    symbolId: instance.symbolId,
    netlist: Object.keys(parameters).length > 0 ? { parameters } : undefined,
  };
}

export function instanceLabelAnnotationFor(
  document: SchematicDocument,
  instanceId: string,
): Annotation | undefined {
  return document.annotations.find(
    (annotation) =>
      (annotation.kind === "instance-label" ||
        annotation.kind === "net-label") &&
      (annotation.binding?.kind === "instance-schematic-name" ||
        annotation.binding?.kind === "cell-terminal-name" ||
        annotation.binding?.kind === "net-name") &&
      annotation.anchor.kind === "object" &&
      annotation.anchor.objectId === instanceId,
  );
}
