import {
  diagnosticPresentationGroup,
  hasBlockingVisualDiagnostics,
} from "@icm/derived";
import type {
  Diagnostic,
  DiagnosticDomain,
  DiagnosticSeverity,
  GlobalNetTraceHop,
  HierarchyNetTrace,
  HierarchyNetTraceHop,
  LiveDiagnosticSnapshot,
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
  importReport: SpiceImportReport | null;
}

export interface SpiceImportReport {
  entryPath: string;
  diagnostics: readonly SpiceDiagnostic[];
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
  importReport,
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
        <dt>Status</dt>
        <dd aria-live="polite">{snapshot.status}</dd>
      </dl>
      <section aria-label="SPICE import report" className="diagnostics">
        <h2>SPICE Import Report</h2>
        <p data-testid="import-report-lifecycle">
          Historical messages captured while importing{" "}
          {importReport?.entryPath ?? "the current source"}; they are not
          current ERC results.
        </p>
        {!importReport || importReport.diagnostics.length === 0 ? (
          <p>No import messages</p>
        ) : null}
        <ul data-testid="import-report-diagnostics">
          {importReport?.diagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.code}-${index}`}
              data-severity={diagnostic.severity}
            >
              <strong>{diagnostic.code}</strong>: {diagnostic.message}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export interface ProjectDiagnosticsSectionProps {
  snapshot: LiveDiagnosticSnapshot;
  documentLabel(documentId: string): string;
  onSelectDiagnostic(diagnostic: Diagnostic): void;
}

export interface NetTraceSectionProps {
  trace: HierarchyNetTrace;
  documentLabel(documentId: string): string;
  onNavigateHop(hop: HierarchyNetTraceHop | GlobalNetTraceHop): void;
}

type NetTraceHop = HierarchyNetTraceHop | GlobalNetTraceHop;

function netTraceHopDetail(hop: NetTraceHop): string {
  return hop.direction === "global"
    ? hop.foldedName
    : `${hop.frame.instanceId}.${hop.frame.parentPinName}`;
}

function netTraceHopAction(hop: NetTraceHop): string {
  if (hop.direction === "global") return "Global";
  return hop.direction === "down" ? "Enter" : "Return";
}

/** Concrete hierarchy edges for the currently highlighted logical Net. */
export function NetTraceSection({
  trace,
  documentLabel,
  onNavigateHop,
}: NetTraceSectionProps) {
  return (
    <section
      aria-label="Hierarchy Net trace"
      className="diagnostics erc-diagnostics net-trace"
    >
      <h2>Hierarchy Net trace ({trace.highlights.length} Cells)</h2>
      <ul data-testid="net-trace-hops">
        {trace.hops.map((hop, index) => (
          <li
            key={`${hop.direction}-${hop.from.documentId}-${hop.from.netId}-${netTraceHopDetail(hop)}-${index}`}
          >
            <button
              type="button"
              data-testid={`net-trace-hop-${index}`}
              onClick={() => onNavigateHop(hop)}
            >
              <strong>{netTraceHopAction(hop)}</strong>:{" "}
              {netTraceHopDetail(hop)} → {documentLabel(hop.to.documentId)} /{" "}
              {hop.to.netId}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
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
  snapshot,
  documentLabel,
  onSelectDiagnostic,
}: ProjectDiagnosticsSectionProps) {
  const diagnostics = snapshot.diagnostics;
  const [domainFilter, setDomainFilter] = useState<ProjectDomainFilter>("all");
  const [severityFilter, setSeverityFilter] =
    useState<DiagnosticSeverityFilter>("all");
  const [showObservations, setShowObservations] = useState(false);
  const observationCount = diagnostics.filter(
    (diagnostic) => diagnosticPresentationGroup(diagnostic) === "observation",
  ).length;
  const availableDiagnostics = useMemo(
    () =>
      showObservations
        ? diagnostics
        : diagnostics.filter(
            (diagnostic) =>
              diagnosticPresentationGroup(diagnostic) === "actionable",
          ),
    [diagnostics, showObservations],
  );
  const availableDomains = new Set(
    availableDiagnostics.map((diagnostic) => diagnostic.domain),
  );
  const effectiveDomainFilter =
    domainFilter === "all" || availableDomains.has(domainFilter)
      ? domainFilter
      : "all";
  const visibleDiagnostics = useMemo(
    () =>
      availableDiagnostics.filter(
        (diagnostic) =>
          (effectiveDomainFilter === "all" ||
            diagnostic.domain === effectiveDomainFilter) &&
          (severityFilter === "all" || diagnostic.severity === severityFilter),
      ),
    [availableDiagnostics, effectiveDomainFilter, severityFilter],
  );
  return (
    <section
      aria-label="Project diagnostics"
      className="diagnostics erc-diagnostics"
    >
      <h2>
        Current schematic diagnostics ({visibleDiagnostics.length}/
        {availableDiagnostics.length})
      </h2>
      <p data-testid="current-diagnostic-revisions">
        Live evidence for {snapshot.projectId}:{" "}
        {snapshot.documentRevisions
          .map(
            ({ documentId, revision }) =>
              `${documentLabel(documentId)} r${revision}`,
          )
          .join(", ")}
      </p>
      {observationCount > 0 ? (
        <button
          type="button"
          data-testid="diagnostic-observations-toggle"
          aria-pressed={showObservations}
          onClick={() => setShowObservations((current) => !current)}
        >
          {showObservations ? "Hide" : "Show"} non-blocking observations (
          {observationCount})
        </button>
      ) : null}
      <DiagnosticFilters
        diagnostics={availableDiagnostics}
        domainFilter={effectiveDomainFilter}
        severityFilter={severityFilter}
        onDomainFilterChange={setDomainFilter}
        onSeverityFilterChange={setSeverityFilter}
      />
      {availableDiagnostics.length === 0 ? (
        <p data-testid="no-current-diagnostics">
          No current actionable diagnostics
        </p>
      ) : visibleDiagnostics.length === 0 ? (
        <p data-testid="no-matching-diagnostics">
          No diagnostics match the current filters
        </p>
      ) : null}
      <ul data-testid="project-diagnostics">
        {visibleDiagnostics.map((diagnostic) => (
          <li
            key={diagnostic.id}
            data-domain={diagnostic.domain}
            data-document-id={diagnostic.primary.documentId}
            data-severity={diagnostic.severity}
            data-confidence={diagnostic.confidence}
            data-presentation={diagnosticPresentationGroup(diagnostic)}
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
