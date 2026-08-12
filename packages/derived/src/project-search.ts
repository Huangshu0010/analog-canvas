import type { CircuitProject } from "@icm/model";

import { directObjectLocator, type ObjectLocator } from "./object-locator.js";

/**
 * Deterministic project-wide search index (ADR 0015 / roadmap WP-R5 core).
 * Case-insensitive exact/prefix/substring matching over instances, nets, and
 * ports, returning `ObjectLocator`s ranked exact > prefix > substring with no
 * fuzzy ranking. Pure backend; the `Ctrl+F` UI and hierarchy navigation consume
 * it later (R9/R10).
 */

export type SearchObjectKind = "instance" | "net" | "port";

export type SearchObjectLocator = ObjectLocator & {
  kind: SearchObjectKind;
};

export type SearchField =
  | "instance-id"
  | "symbol"
  | "spice-name"
  | "property"
  | "net-name"
  | "net-id"
  | "port-name"
  | "port-id";

export type MatchType = "exact" | "prefix" | "substring";

export interface SearchResult {
  locator: SearchObjectLocator;
  label: string;
  field: SearchField;
  matchType: MatchType;
}

const MATCH_RANK: Record<MatchType, number> = {
  exact: 0,
  prefix: 1,
  substring: 2,
};

const KIND_RANK: Record<SearchObjectKind, number> = {
  instance: 0,
  net: 1,
  port: 2,
};

interface Candidate {
  locator: SearchObjectLocator;
  label: string;
  field: SearchField;
  value: string; // lowercased match target
}

function classifyMatch(value: string, query: string): MatchType | null {
  if (value === query) return "exact";
  if (value.startsWith(query)) return "prefix";
  if (value.includes(query)) return "substring";
  return null;
}

function instanceLabel(
  id: string,
  symbolId: string,
  properties: Record<string, unknown>,
): string {
  const spiceName = properties["spice.name"];
  if (typeof spiceName === "string" && spiceName.length > 0) return spiceName;
  return symbolId ?? id;
}

function collectCandidates(project: CircuitProject): Candidate[] {
  const candidates: Candidate[] = [];
  for (const document of project.documents) {
    for (const instance of document.instances) {
      const locator: SearchObjectLocator = directObjectLocator(
        document.id,
        "instance",
        instance.id,
      );
      const label = instanceLabel(
        instance.id,
        instance.symbolId,
        instance.properties,
      );
      candidates.push({
        locator,
        label,
        field: "instance-id",
        value: instance.id.toLowerCase(),
      });
      candidates.push({
        locator,
        label,
        field: "symbol",
        value: instance.symbolId.toLowerCase(),
      });
      const spiceName = instance.properties["spice.name"];
      if (typeof spiceName === "string") {
        candidates.push({
          locator,
          label,
          field: "spice-name",
          value: spiceName.toLowerCase(),
        });
      }
      for (const [key, rawValue] of Object.entries(instance.properties)) {
        // `spice.name` is indexed as a dedicated field above; avoid double-indexing.
        if (key === "spice.name") continue;
        candidates.push({
          locator,
          label: `${key}=${String(rawValue)}`,
          field: "property",
          value: String(rawValue).toLowerCase(),
        });
      }
    }
    for (const net of document.nets) {
      const locator: SearchObjectLocator = directObjectLocator(
        document.id,
        "net",
        net.id,
      );
      const label = net.name ?? net.id;
      candidates.push({
        locator,
        label,
        field: "net-id",
        value: net.id.toLowerCase(),
      });
      if (net.name) {
        candidates.push({
          locator,
          label,
          field: "net-name",
          value: net.name.toLowerCase(),
        });
      }
    }
    for (const port of document.ports) {
      const locator: SearchObjectLocator = directObjectLocator(
        document.id,
        "port",
        port.id,
      );
      const label = port.name;
      candidates.push({
        locator,
        label,
        field: "port-id",
        value: port.id.toLowerCase(),
      });
      candidates.push({
        locator,
        label,
        field: "port-name",
        value: port.name.toLowerCase(),
      });
    }
  }
  return candidates;
}

export interface ProjectSearchIndex {
  search(query: string): readonly SearchResult[];
}

export function buildProjectSearchIndex(
  project: CircuitProject,
): ProjectSearchIndex {
  const candidates = collectCandidates(project);
  return {
    search(query) {
      const normalized = query.trim().toLowerCase();
      if (normalized.length === 0) return [];

      // Keep the best-scoring candidate per object.
      const bestByObject = new Map<
        string,
        { candidate: Candidate; match: MatchType }
      >();
      for (const candidate of candidates) {
        const match = classifyMatch(candidate.value, normalized);
        if (!match) continue;
        const key = `${candidate.locator.documentId}\u0000${candidate.locator.kind}\u0000${candidate.locator.objectId}`;
        const current = bestByObject.get(key);
        if (
          !current ||
          MATCH_RANK[match] < MATCH_RANK[current.match] ||
          (MATCH_RANK[match] === MATCH_RANK[current.match] &&
            candidate.field.localeCompare(current.candidate.field, "en") < 0)
        ) {
          bestByObject.set(key, { candidate, match });
        }
      }

      return [...bestByObject.values()]
        .map(({ candidate, match }): SearchResult => ({
          locator: candidate.locator,
          label: candidate.label,
          field: candidate.field,
          matchType: match,
        }))
        .sort(
          (left, right) =>
            MATCH_RANK[left.matchType] - MATCH_RANK[right.matchType] ||
            left.locator.documentId.localeCompare(
              right.locator.documentId,
              "en",
            ) ||
            KIND_RANK[left.locator.kind] - KIND_RANK[right.locator.kind] ||
            left.locator.objectId.localeCompare(right.locator.objectId, "en"),
        );
    },
  };
}
