import { hasBlockingVisualDiagnostics } from "@icm/derived";
import type {
  Diagnostic,
  DiagnosticDomain,
  DiagnosticSeverity,
  VisualDiagnostic,
} from "@icm/derived";
import { useMemo, useState } from "react";
import type { SpiceDiagnostic } from "@icm/spice";

import type { EditorTool } from "../../interaction/interaction-state";

export interface SelectionInspectorSnapshot {
  selected: string;
  internalRouteCount: number;
  revision: number;
  sourceStatus: string;
  documentCount: number;
  activeDocumentId: string;
  activeInstanceCount: number;
  projectInstanceCount: number;
  netCount: number;
  tool: EditorTool;
  flightlineCount: number;
  crossingCount: number;
  annotationCount: number;
  status: string;
}

export interface VisualDiagnosticSummary {
  all: readonly VisualDiagnostic[];
  structural: readonly VisualDiagnostic[];
  observations: readonly VisualDiagnostic[];
  blockingCount: number;
}

export interface SelectionInspectorDetailsProps {
  snapshot: SelectionInspectorSnapshot;
  importDiagnostics: readonly SpiceDiagnostic[];
  visualSummary: VisualDiagnosticSummary;
  onSelectVisualDiagnostic(diagnostic: VisualDiagnostic): void;
}

export function summarizeVisualDiagnostics(
  diagnostics: readonly VisualDiagnostic[],
): VisualDiagnosticSummary {
  return {
    all: diagnostics,
    structural: diagnostics.filter(
      (diagnostic) => diagnostic.category === "structural",
    ),
    observations: diagnostics.filter(
      (diagnostic) => diagnostic.category === "observation",
    ),
    blockingCount: diagnostics.filter((diagnostic) =>
      hasBlockingVisualDiagnostics([diagnostic]),
    ).length,
  };
}

export function SelectionInspectorDetails({
  snapshot,
  importDiagnostics,
  visualSummary,
  onSelectVisualDiagnostic,
}: SelectionInspectorDetailsProps) {
  return (
    <>
      <dl className="inspector">
        <dt>Selected</dt>
        <dd>{snapshot.selected}</dd>
        <dt>Internal routes</dt>
        <dd data-testid="selected-internal-route-count">
          {snapshot.internalRouteCount}
        </dd>
        <dt>Revision</dt>
        <dd data-testid="revision">{snapshot.revision}</dd>
        <dt>Source status</dt>
        <dd data-testid="source-status">{snapshot.sourceStatus}</dd>
        <dt>Documents</dt>
        <dd data-testid="document-count">{snapshot.documentCount}</dd>
        <dt>Current Document</dt>
        <dd data-testid="active-document-id">{snapshot.activeDocumentId}</dd>
        <dt>Document instances</dt>
        <dd data-testid="active-instance-count">
          {snapshot.activeInstanceCount}
        </dd>
        <dt>Instances</dt>
        <dd data-testid="instance-count">{snapshot.projectInstanceCount}</dd>
        <dt>Nets</dt>
        <dd data-testid="net-count">{snapshot.netCount}</dd>
        <dt>Tool</dt>
        <dd data-testid="active-tool">{snapshot.tool}</dd>
        <dt>Flightlines</dt>
        <dd data-testid="flightline-count">{snapshot.flightlineCount}</dd>
        <dt>Crossings</dt>
        <dd data-testid="crossing-count">{snapshot.crossingCount}</dd>
        <dt>Annotations</dt>
        <dd data-testid="annotation-count">{snapshot.annotationCount}</dd>
        <dt>Structural diagnostics</dt>
        <dd data-testid="structural-diagnostic-count">
          {visualSummary.structural.length}
        </dd>
        <dt>Visual observations</dt>
        <dd data-testid="visual-diagnostic-count">
          {visualSummary.observations.length}
        </dd>
        <dt>Blocking diagnostics</dt>
        <dd data-testid="blocking-diagnostic-count">
          {visualSummary.blockingCount}
        </dd>
        <dt>Status</dt>
        <dd aria-live="polite">{snapshot.status}</dd>
      </dl>
      <section aria-label="Import diagnostics" className="diagnostics">
        <h2>Import Diagnostics</h2>
        {importDiagnostics.length === 0 ? <p>No import diagnostics</p> : null}
        <ul data-testid="import-diagnostics">
          {importDiagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.code}-${index}`}
              data-severity={diagnostic.severity}
            >
              <strong>{diagnostic.code}</strong>: {diagnostic.message}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Visual diagnostics" className="diagnostics">
        <h2>Diagnostics</h2>
        {visualSummary.all.length === 0 ? <p>No visual diagnostics</p> : null}
        {visualSummary.structural.length > 0 ? (
          <h3>Structural issues</h3>
        ) : null}
        <ul data-testid="visual-diagnostics">
          {visualSummary.structural.map((diagnostic, index) => (
            <li
              key={`${diagnostic.code}-${diagnostic.objectIds.join("-")}-${index}`}
              data-severity={diagnostic.severity}
              data-category={diagnostic.category}
              data-confidence={diagnostic.confidence}
            >
              <button
                type="button"
                data-testid={`diagnostic-${index}`}
                onClick={() => onSelectVisualDiagnostic(diagnostic)}
              >
                <strong>{diagnostic.code}</strong>
                {diagnostic.objectIds.length > 0
                  ? `: ${diagnostic.objectIds.join(", ")}`
                  : ""}
              </button>
            </li>
          ))}
        </ul>
        {visualSummary.observations.length > 0 ? (
          <h3>Visual observations</h3>
        ) : null}
        <ul data-testid="visual-observations">
          {visualSummary.observations.map((diagnostic, index) => (
            <li
              key={`observation-${diagnostic.code}-${diagnostic.objectIds.join("-")}-${index}`}
              data-severity={diagnostic.severity}
              data-category={diagnostic.category}
              data-confidence={diagnostic.confidence}
            >
              <button
                type="button"
                data-testid={`observation-${index}`}
                onClick={() => onSelectVisualDiagnostic(diagnostic)}
              >
                <strong>{diagnostic.code}</strong>
                {diagnostic.objectIds.length > 0
                  ? `: ${diagnostic.objectIds.join(", ")}`
                  : ""}
                {` (${diagnostic.confidence} confidence)`}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export interface ProjectDiagnosticsSectionProps {
  diagnostics: readonly Diagnostic[];
  documentLabel(documentId: string): string;
  onSelectDiagnostic(diagnostic: Diagnostic): void;
}

type DiagnosticSeverityFilter = "all" | DiagnosticSeverity;

const DIAGNOSTIC_SEVERITY_FILTERS: readonly DiagnosticSeverityFilter[] = [
  "all",
  "error",
  "warning",
  "info",
];

type ProjectDomainFilter = "all" | DiagnosticDomain;

function DiagnosticFilters({
  diagnostics,
  domainFilter,
  severityFilter,
  onDomainFilterChange,
  onSeverityFilterChange,
}: {
  diagnostics: readonly Diagnostic[];
  domainFilter: ProjectDomainFilter;
  severityFilter: DiagnosticSeverityFilter;
  onDomainFilterChange(filter: ProjectDomainFilter): void;
  onSeverityFilterChange(filter: DiagnosticSeverityFilter): void;
}) {
  const domains = [
    "all" as const,
    ...[...new Set(diagnostics.map((diagnostic) => diagnostic.domain))].sort(),
  ];
  return (
    <>
      <div className="diagnostic-filters" aria-label="Diagnostic domains">
        {domains.map((filter) => {
          const count =
            filter === "all"
              ? diagnostics.length
              : diagnostics.filter((diagnostic) => diagnostic.domain === filter)
                  .length;
          return (
            <button
              key={filter}
              type="button"
              data-testid={`diagnostic-domain-${filter}`}
              aria-pressed={domainFilter === filter}
              onClick={() => onDomainFilterChange(filter)}
            >
              {filter === "all" ? "All domains" : filter} ({count})
            </button>
          );
        })}
      </div>
      <div className="diagnostic-filters" aria-label="Diagnostic severities">
        {DIAGNOSTIC_SEVERITY_FILTERS.map((filter) => {
          const count =
            filter === "all"
              ? diagnostics.length
              : diagnostics.filter(
                  (diagnostic) => diagnostic.severity === filter,
                ).length;
          return (
            <button
              key={filter}
              type="button"
              data-testid={`diagnostic-severity-${filter}`}
              aria-pressed={severityFilter === filter}
              onClick={() => onSeverityFilterChange(filter)}
            >
              {filter === "all" ? "All severities" : filter} ({count})
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Project-wide diagnostic workbench for compatible, locator-backed domains. */
export function ProjectDiagnosticsSection({
  diagnostics,
  documentLabel,
  onSelectDiagnostic,
}: ProjectDiagnosticsSectionProps) {
  const [domainFilter, setDomainFilter] = useState<ProjectDomainFilter>("all");
  const [severityFilter, setSeverityFilter] =
    useState<DiagnosticSeverityFilter>("all");
  const visibleDiagnostics = useMemo(
    () =>
      diagnostics.filter(
        (diagnostic) =>
          (domainFilter === "all" || diagnostic.domain === domainFilter) &&
          (severityFilter === "all" || diagnostic.severity === severityFilter),
      ),
    [diagnostics, domainFilter, severityFilter],
  );
  return (
    <section
      aria-label="Project diagnostics"
      className="diagnostics erc-diagnostics"
    >
      <h2>
        Schematic diagnostics ({visibleDiagnostics.length}/{diagnostics.length})
      </h2>
      <DiagnosticFilters
        diagnostics={diagnostics}
        domainFilter={domainFilter}
        severityFilter={severityFilter}
        onDomainFilterChange={setDomainFilter}
        onSeverityFilterChange={setSeverityFilter}
      />
      <ul data-testid="project-diagnostics">
        {visibleDiagnostics.map((diagnostic) => (
          <li
            key={diagnostic.id}
            data-domain={diagnostic.domain}
            data-document-id={diagnostic.primary.documentId}
            data-severity={diagnostic.severity}
            data-confidence={diagnostic.confidence}
          >
            <button
              type="button"
              data-testid={`project-diagnostic-${diagnostic.id}`}
              onClick={() => onSelectDiagnostic(diagnostic)}
            >
              <strong>
                {diagnostic.domain.toUpperCase()} / {diagnostic.code}
              </strong>
              : {diagnostic.message}
              <small>
                Cell: {documentLabel(diagnostic.primary.documentId)}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
