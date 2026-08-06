import type { SourceBundle, SpiceSourceFile } from "./source-types.js";

export function printSpiceSource(source: SpiceSourceFile): string {
  return source.text;
}

export function printSourceBundle(bundle: SourceBundle): Map<string, string> {
  return new Map(
    bundle.files.map((source) => [source.path, printSpiceSource(source)]),
  );
}
