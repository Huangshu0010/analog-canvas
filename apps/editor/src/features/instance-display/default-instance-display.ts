import {
  defaultInstanceLabelPlacement,
  displayableInstanceValue,
  type SchematicStyleProfile,
} from "@icm/derived";
import { defaultDraftTextDocument } from "@icm/model";
import type { Annotation, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  defaultInstanceLabel,
  defaultInstanceValue,
} from "../wiring/route-interaction-geometry";

type Instance = SchematicDocument["instances"][number];

export interface DefaultInstanceDisplayOptions {
  readonly showDesignator?: boolean;
  readonly showValue?: boolean;
  readonly masterName?: string;
  readonly formalTerminalId?: string;
}

/**
 * One editor policy for default labels. Electrical facts remain in the typed
 * Instance/Cell model; this factory only creates their visual projections.
 */
export function defaultInstanceDisplayAnnotations(
  document: SchematicDocument,
  instance: Instance,
  resolver: SymbolResolver,
  styleProfile: SchematicStyleProfile,
  options: DefaultInstanceDisplayOptions = {},
): readonly Annotation[] {
  const annotations: Annotation[] = [];
  const designator = defaultInstanceLabel(
    document,
    instance,
    resolver,
    styleProfile,
  );
  if (options.showDesignator !== false && designator) {
    annotations.push({
      ...designator,
      ...(options.formalTerminalId
        ? { id: `instance-reference-${instance.id}` }
        : {}),
      binding: { kind: "instance-designator", instanceId: instance.id },
    });
  }
  if (options.formalTerminalId) {
    const terminalName = defaultInstanceLabel(
      document,
      instance,
      resolver,
      styleProfile,
      "value",
    );
    if (terminalName) {
      annotations.push({
        ...terminalName,
        id: `instance-label-${instance.id}`,
        binding: {
          kind: "cell-terminal-name",
          terminalId: options.formalTerminalId,
        },
      });
    }
  }
  if (options.masterName) {
    const master = defaultMasterNameAnnotation(
      document,
      instance,
      resolver,
      styleProfile,
      options.masterName,
    );
    if (master) annotations.push(master);
  } else if (
    options.showValue &&
    displayableInstanceValue(instance).kind === "displayable"
  ) {
    const value = defaultInstanceValue(
      document,
      instance,
      resolver,
      styleProfile,
    );
    if (value) annotations.push(value);
  }
  return annotations;
}

function defaultMasterNameAnnotation(
  document: SchematicDocument,
  instance: Instance,
  resolver: SymbolResolver,
  styleProfile: SchematicStyleProfile,
  masterName: string,
): Annotation | null {
  if (!instance.placement || masterName.trim() === "") return null;
  const resolved = resolver.resolve(
    instance.symbolId,
    instance.symbolVariantId,
  );
  if (!resolved) return null;
  const placement = defaultInstanceLabelPlacement(
    instance,
    resolved,
    styleProfile,
    document.presentation.grid,
    "value",
  );
  if (!placement) return null;
  const position = placement.position;
  return {
    id: `instance-master-${instance.id}`,
    kind: "instance-value",
    content: defaultDraftTextDocument(masterName),
    anchor: {
      kind: "object",
      objectId: instance.id,
      localOffset: {
        x: position.x - instance.placement.position.x,
        y: position.y - instance.placement.position.y,
      },
      fallbackPosition: position,
    },
    alignment: placement.alignment,
    rotation: 0,
    locked: false,
  };
}
