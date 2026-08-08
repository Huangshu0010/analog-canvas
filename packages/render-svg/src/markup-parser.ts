// ADR 0010: the markup <-> RichText AST converter lives in @icm/model so the
// editor, renderer, and Agent share one implementation (P0-1). This module
// re-exports it for backward compatibility with the earlier render-svg home.
export {
  flattenRichText as flattenMarkup,
  normalizeRichText,
  parseMarkup,
  serializeMarkup,
} from "@icm/model";
export type { MarkupDocument, MarkupRun } from "@icm/model";
