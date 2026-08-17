import type { DeviceDescriptor, DeviceDescriptorIssue } from "./contract.js";

export function validateDeviceDescriptors(
  descriptors: readonly DeviceDescriptor[],
): DeviceDescriptorIssue[] {
  const issues: DeviceDescriptorIssue[] = [];
  const seen = new Set<string>();
  for (const descriptor of descriptors) {
    if (seen.has(descriptor.symbolId)) {
      issues.push({
        symbolId: descriptor.symbolId,
        message: "Duplicate device descriptor",
      });
      continue;
    }
    seen.add(descriptor.symbolId);
    if (
      descriptor.referencePrefix !== null &&
      !/^[A-Z][A-Z0-9_]*$/u.test(descriptor.referencePrefix)
    ) {
      issues.push({
        symbolId: descriptor.symbolId,
        message: `Invalid reference prefix: ${descriptor.referencePrefix}`,
      });
    }
    const pinNames = new Set<string>();
    for (const pinName of descriptor.pinOrder) {
      if (pinNames.has(pinName)) {
        issues.push({
          symbolId: descriptor.symbolId,
          message: `Duplicate device pin: ${pinName}`,
        });
      }
      pinNames.add(pinName);
    }
    const parameterNames = new Set<string>();
    for (const parameter of descriptor.requiredParameters) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(parameter)) {
        issues.push({
          symbolId: descriptor.symbolId,
          message: `Invalid required parameter name: ${parameter}`,
        });
      } else if (parameterNames.has(parameter.toLowerCase())) {
        issues.push({
          symbolId: descriptor.symbolId,
          message: `Duplicate required parameter: ${parameter}`,
        });
      }
      parameterNames.add(parameter.toLowerCase());
    }
  }
  return issues;
}
