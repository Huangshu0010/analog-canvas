import type { SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { EditTransaction } from "./edit-schema.js";
import type { RejectEdit } from "./transaction-cell-interface.js";
import { followAttachedAnnotations } from "./transaction-instance-annotations.js";
import { applyInstanceRouteFollow } from "./transaction-route-follow.js";
import { lockedLayoutOwner } from "./transaction-routing.js";
import type { RejectedTransaction } from "./transaction-result.js";

type InstanceTransformEdit = Extract<
  EditTransaction["edits"][number],
  {
    kind:
      | "place_instance"
      | "unplace_instance"
      | "move_instance"
      | "rotate_instance"
      | "mirror_instance";
  }
>;

export interface InstanceTransformEditContext {
  draft: SchematicDocument;
  resolver: SymbolResolver | undefined;
  explicitlyAuthoredRouteIds: ReadonlySet<string>;
  changedObjectIds: Set<string>;
  reject: RejectEdit;
}

export type InstanceTransformEditOutcome =
  { ok: true } | { ok: false; rejection: RejectedTransaction };

export function applyInstanceTransformEdit(
  edit: InstanceTransformEdit,
  context: InstanceTransformEditContext,
): InstanceTransformEditOutcome {
  const {
    draft,
    resolver,
    explicitlyAuthoredRouteIds,
    changedObjectIds,
    reject,
  } = context;
  const instance = draft.instances.find(
    (candidate) => candidate.id === edit.instanceId,
  );
  if (!instance) {
    return {
      ok: false,
      rejection: reject(
        "OBJECT_NOT_FOUND",
        `Instance does not exist: ${edit.instanceId}`,
        [],
        [edit.instanceId],
      ),
    };
  }
  const lockOwner = lockedLayoutOwner(draft, edit.instanceId);
  if (lockOwner) {
    return {
      ok: false,
      rejection: reject(
        "EDIT_PRECONDITION",
        `Instance ${edit.instanceId} is locked by layout intent ${lockOwner}`,
      ),
    };
  }

  switch (edit.kind) {
    case "place_instance":
      if (instance.placement !== null) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Instance is already placed: ${edit.instanceId}`,
          ),
        };
      }
      instance.placement = structuredClone(edit.placement);
      changedObjectIds.add(edit.instanceId);
      return { ok: true };
    case "unplace_instance":
      if (instance.placement === null) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Instance is already unplaced: ${edit.instanceId}`,
          ),
        };
      }
      if (
        draft.routes.some((route) =>
          [route.from, route.to].some(
            (endpoint) =>
              endpoint.kind === "terminal" &&
              endpoint.instanceId === edit.instanceId,
          ),
        )
      ) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Instance has routed terminals; detach routes before unplacing: ${edit.instanceId}`,
          ),
        };
      }
      instance.placement = null;
      changedObjectIds.add(edit.instanceId);
      return { ok: true };
    case "move_instance":
    case "rotate_instance":
    case "mirror_instance": {
      if (instance.placement === null) {
        return {
          ok: false,
          rejection: reject(
            "EDIT_PRECONDITION",
            `Instance is not placed: ${edit.instanceId}`,
          ),
        };
      }
      const beforeTransform = structuredClone(draft);
      const oldPlacement = structuredClone(instance.placement);
      if (edit.kind === "move_instance") {
        instance.placement.position = structuredClone(edit.position);
      } else if (edit.kind === "rotate_instance") {
        instance.placement.rotation = edit.rotation;
      } else {
        instance.placement.mirror = edit.mirror;
      }
      followAttachedAnnotations(
        draft,
        edit.instanceId,
        oldPlacement.position,
        oldPlacement,
        instance.placement.position,
        instance.placement,
        changedObjectIds,
        resolver,
      );
      if (resolver) {
        for (const routeId of applyInstanceRouteFollow(
          draft,
          beforeTransform,
          resolver,
          edit.instanceId,
          explicitlyAuthoredRouteIds,
        )) {
          changedObjectIds.add(routeId);
        }
      }
      changedObjectIds.add(edit.instanceId);
      return { ok: true };
    }
  }
}
