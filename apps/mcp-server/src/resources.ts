import {
  mcpResources,
  type McpResourceDocument,
} from "./resources.generated.js";
import { RpcMethodError } from "./protocol.js";
import type { McpResourceContent, McpResourceEntry } from "./protocol.js";

export const ADVANCED_EDITS_RESOURCE_URI =
  "analog-canvas://contract/advanced-edits";

export function listResourceEntries(): McpResourceEntry[] {
  return mcpResources.map((resource: McpResourceDocument) => ({
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
  }));
}

export function readResourceContent(uri: string): McpResourceContent {
  const resource = mcpResources.find(
    (candidate: McpResourceDocument) => candidate.uri === uri,
  );
  if (!resource) {
    throw new RpcMethodError(-32602, `Unknown resource: ${uri}`);
  }
  return {
    uri: resource.uri,
    mimeType: resource.mimeType,
    text: resource.text,
  };
}
