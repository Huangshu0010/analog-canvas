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
  /** Show the default user-facing schematic label. */
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
  if (options.formalTerminalId) {
    const terminalName = defaultInstanceLabel(
      document,
      instance,
      resolver,
      styleProfile,
    );
    if (terminalName) {
      annotations.push({
        ...terminalName,
        binding: {
          kind: "cell-terminal-name",
          terminalId: options.formalTerminalId,
        },
      });
    }
    return annotations;
  }
  const label = defaultInstanceLabel(
    document,
    instance,
    resolver,
    styleProfile,
  );
  if (options.showDesignator !== false && label) {
    annotations.push({
      ...label,
      binding: { kind: "instance-schematic-name", instanceId: instance.id },
    });
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

/**
 * Materialize only the default visual labels a retained Instance lacks when it
 * enters the canvas. Imported SPICE starts in the Placement Tray, so this
 * keeps its already-imported Reference visible without replacing a label the
 * user has already positioned, hidden, or edited.
 */
export function missingDefaultInstanceDisplayAnnotations(
  document: SchematicDocument,
  instance: Instance,
  resolver: SymbolResolver,
  styleProfile: SchematicStyleProfile,
): readonly Annotation[] {
  if (!instance.placement) return [];
  const formalTerminalId = document.netlist?.terminals.find(
    (terminal) => terminal.interfaceInstanceId === instance.id,
  )?.id;
  const freePortNet =
    !formalTerminalId &&
    (instance.symbolId === "port" || instance.symbolId === "port-filled")
      ? document.nets.find((net) =>
          net.terminals.some((terminal) => terminal.instanceId === instance.id),
        )
      : undefined;
  const candidates = defaultInstanceDisplayAnnotations(
    document,
    instance,
    resolver,
    styleProfile,
    formalTerminalId ? { formalTerminalId } : {},
  ).map((candidate) =>
    freePortNet
      ? {
          ...candidate,
          kind: "net-label" as const,
          binding: { kind: "net-name" as const, netId: freePortNet.id },
          netId: freePortNet.id,
        }
      : candidate,
  );
  return candidates.filter(
    (candidate) =>
      !document.annotations.some((existing) =>
        isSameDefaultProjection(existing, candidate),
      ),
  );
}

function isSameDefaultProjection(
  existing: Annotation,
  candidate: Annotation,
): boolean {
  if (existing.id === candidate.id) return true;
  const existingBinding = existing.binding;
  const candidateBinding = candidate.binding;
  if (!existingBinding || !candidateBinding) return false;
  if (
    existingBinding.kind === "instance-schematic-name" &&
    candidateBinding.kind === "instance-schematic-name"
  ) {
    return existingBinding.instanceId === candidateBinding.instanceId;
  }
  if (
    existingBinding.kind === "net-name" &&
    candidateBinding.kind === "net-name"
  ) {
    return existingBinding.netId === candidateBinding.netId;
  }
  if (
    existingBinding.kind === "cell-terminal-name" &&
    candidateBinding.kind === "cell-terminal-name"
  ) {
    return existingBinding.terminalId === candidateBinding.terminalId;
  }
  return false;
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
