import {
  AgentCapabilitiesResponseSchema,
  AgentRenderResponseSchema,
  AgentSchematicEditSchema,
  AGENT_API_VERSION,
  type AgentCircuitRequest,
  type AgentCircuitResponse,
  type AgentTransactRequest,
} from "@icm/agent-adapter";
import { z } from "zod";
import {
  ConnectionTracker,
  type ConnectionSnapshot,
} from "./connection-state.js";

type AgentCapabilitiesResponse = z.infer<
  typeof AgentCapabilitiesResponseSchema
>;
type AgentRenderResponse = z.infer<typeof AgentRenderResponseSchema>;
import { CredentialStore } from "./credential-store.js";
import { AgentSessionError } from "./errors.js";
import { AgentHttpClient, type ClaimSuccess } from "./http-client.js";
import {
  SnapshotCache,
  changedObjectIds,
  snapshotSummary,
  type CachedSnapshot,
  type SnapshotSummary,
} from "./snapshot-cache.js";
import {
  ActionCompileError,
  compileActions,
  type CompiledTransaction,
} from "./authoring-helper.js";

interface ActiveSession {
  sessionId: string;
  agentToken: string;
  tokenExpiresAt: number;
  scopes: string[];
  projectId: string;
  documentIds: string[];
}

export interface AgentSessionClientOptions {
  http: AgentHttpClient;
  credentials: CredentialStore;
  now?: () => number;
  newRequestId?: () => string;
  /** Automatic exact-payload retry attempts after a local network failure. */
  networkRetryAttempts?: number;
  tokenExpiryGraceMs?: number;
}

export interface ConnectReport {
  mode: "claimed" | "resumed";
  projectId: string;
  documentIds: string[];
  tokenExpiresAt: number;
  capabilities: {
    operations: string[];
    editKinds: string[];
    permissions: Record<string, unknown>;
    limits: Record<string, number>;
  };
  context: SnapshotSummary | null;
}

export interface StatusReport extends ConnectionSnapshot {
  sessionId: string | null;
  projectId: string | null;
  documentIds: string[];
  tokenExpiresAt: number | null;
  tokenValid: boolean;
  cachedDocuments: string[];
}

export interface ApplyActionsReport {
  ok: boolean;
  stage: "compile" | "dry-run" | "commit" | "done";
  /** Machine code for a failure (`STATE_CHANGED`, engine code, ...). */
  code?: string;
  message?: string;
  actionIndex?: number;
  actionKind?: string;
  revision?: number;
  transactions?: number;
  changedObjectIds?: string[];
  errors?: number;
  warnings?: number;
  dryRun?: boolean;
}

function baseRequest(requestId: string): {
  apiVersion: typeof AGENT_API_VERSION;
  requestId: string;
} {
  return { apiVersion: AGENT_API_VERSION, requestId };
}

/**
 * Unified Agent-side Helper (ADR 0020). Owns claim/resume, token and session
 * state, capabilities/revision caches, exact-payload request-ID retry, the
 * Snapshot cache, and compilation-plus-execution of high-level actions.
 * Tokens never leave this class except into the credential store.
 */
export class AgentSessionClient {
  readonly connection: ConnectionTracker;
  private readonly http: AgentHttpClient;
  private readonly credentials: CredentialStore;
  private readonly cache = new SnapshotCache();
  private readonly now: () => number;
  private readonly newRequestId: () => string;
  private readonly networkRetryAttempts: number;
  private readonly tokenExpiryGraceMs: number;
  private readonly inflight = new Map<string, Promise<AgentCircuitResponse>>();
  private session: ActiveSession | null = null;
  private capabilitiesCache: AgentCapabilitiesResponse | null = null;

  constructor(options: AgentSessionClientOptions) {
    this.http = options.http;
    this.credentials = options.credentials;
    this.now = options.now ?? (() => Date.now());
    this.newRequestId =
      options.newRequestId ?? (() => `req-${crypto.randomUUID()}`);
    this.networkRetryAttempts = options.networkRetryAttempts ?? 1;
    this.tokenExpiryGraceMs = options.tokenExpiryGraceMs ?? 30_000;
    this.connection = new ConnectionTracker(this.now);
  }

  /**
   * Pair or resume. With a claim code, redeem it (replacing any prior local
   * state). Without one, resume from the stored credential while its token is
   * still valid; otherwise fail with `CLAIM_REQUIRED`.
   */
  async connect(claimCode?: string): Promise<ConnectReport> {
    if (claimCode === undefined || claimCode.trim() === "") {
      const resumed = await this.tryResume();
      if (resumed === null) {
        throw new AgentSessionError(
          "CLAIM_REQUIRED",
          "no valid stored pairing; pass a claim code from the editor's connect panel",
          "unrecoverable-credential",
        );
      }
      return resumed;
    }
    this.connection.apply("claim-started");
    const claim: ClaimSuccess = await this.http.claim(claimCode.trim());
    this.session = {
      sessionId: claim.sessionId,
      agentToken: claim.agentToken,
      tokenExpiresAt: claim.tokenExpiresAt,
      scopes: claim.scopes,
      projectId: claim.projectId,
      documentIds: claim.documentIds,
    };
    await this.credentials.save({
      version: 1,
      apiBaseUrl: this.http.baseUrl,
      sessionId: claim.sessionId,
      agentToken: claim.agentToken,
      tokenExpiresAt: claim.tokenExpiresAt,
      scopes: claim.scopes,
      projectId: claim.projectId,
      documentIds: claim.documentIds,
      storedAt: this.now(),
    });
    return this.establishContext("claimed");
  }

  private async tryResume(): Promise<ConnectReport | null> {
    const stored = await this.credentials.load();
    if (!stored || stored.apiBaseUrl !== this.http.baseUrl) return null;
    if (!this.tokenValid(stored)) return null;
    this.connection.apply("resume-started");
    this.session = {
      sessionId: stored.sessionId,
      agentToken: stored.agentToken,
      tokenExpiresAt: stored.tokenExpiresAt,
      scopes: stored.scopes,
      projectId: stored.projectId,
      documentIds: stored.documentIds,
    };
    try {
      return await this.establishContext("resumed");
    } catch (error) {
      if (
        error instanceof AgentSessionError &&
        error.category === "unrecoverable-credential"
      ) {
        await this.discardCredential(error.code);
      }
      throw error;
    }
  }

  private async establishContext(
    mode: "claimed" | "resumed",
  ): Promise<ConnectReport> {
    const capabilities = await this.capabilities({ force: true });
    let context: SnapshotSummary | null = null;
    let editorOffline = false;
    const documentId = this.session?.documentIds[0];
    if (documentId) {
      try {
        context = snapshotSummary(await this.snapshot(documentId));
      } catch (error) {
        // An offline editor still leaves a paired, resumable session; the
        // host will see editor-offline through connection_status.
        if (
          error instanceof AgentSessionError &&
          (error.category === "editor-offline" || error.category === "network")
        ) {
          editorOffline = true;
        } else {
          throw error;
        }
      }
    }
    if (!editorOffline) {
      this.connection.apply("request-succeeded");
    }
    return {
      mode,
      projectId: this.session?.projectId ?? "",
      documentIds: [...(this.session?.documentIds ?? [])],
      tokenExpiresAt: this.session?.tokenExpiresAt ?? 0,
      capabilities: {
        operations: [...capabilities.capabilities.operations],
        editKinds: [...capabilities.capabilities.editKinds],
        permissions: capabilities.capabilities.permissions as unknown as Record<
          string,
          unknown
        >,
        limits: capabilities.capabilities.limits as unknown as Record<
          string,
          number
        >,
      },
      context,
    };
  }

  async status(): Promise<StatusReport> {
    return {
      ...this.connection.snapshot,
      sessionId: this.session?.sessionId ?? null,
      projectId: this.session?.projectId ?? null,
      documentIds: [...(this.session?.documentIds ?? [])],
      tokenExpiresAt: this.session?.tokenExpiresAt ?? null,
      tokenValid: this.session ? this.tokenValid(this.session) : false,
      cachedDocuments: [...this.cache.documents()],
    };
  }

  async capabilities(
    options: { force?: boolean } = {},
  ): Promise<AgentCapabilitiesResponse> {
    if (this.capabilitiesCache && !options.force) return this.capabilitiesCache;
    const response = await this.send({
      ...baseRequest(this.newRequestId()),
      operation: "capabilities",
    });
    const parsed = AgentCapabilitiesResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new AgentSessionError(
        "INVALID_RESPONSE",
        "capabilities response failed schema validation",
        "request-rejected",
      );
    }
    this.capabilitiesCache = parsed.data;
    return parsed.data;
  }

  /** Cached Snapshot for a document, fetching a fresh one when absent/dirty. */
  async snapshot(
    documentId?: string,
    options: { refresh?: boolean } = {},
  ): Promise<CachedSnapshot> {
    const target = documentId ?? this.defaultDocumentId();
    const cached = this.cache.get(target);
    if (cached && !cached.dirty && !options.refresh) return cached;
    return this.refreshSnapshot(target);
  }

  async refreshSnapshot(documentId?: string): Promise<CachedSnapshot> {
    const target = documentId ?? this.defaultDocumentId();
    const requestId = this.newRequestId();
    const response = await this.send({
      ...baseRequest(requestId),
      operation: "snapshot",
      documentId: target,
    });
    if (!response.ok || response.operation !== "snapshot") {
      throw new AgentSessionError(
        response.ok ? "INVALID_RESPONSE" : response.error.code,
        response.ok
          ? "unexpected operation for snapshot"
          : response.error.message,
        "request-rejected",
      );
    }
    const snapshotResponse = response;
    const entry: CachedSnapshot = {
      documentId: target,
      revision: snapshotResponse.revision,
      snapshot: snapshotResponse.snapshot,
      diagnostics: [...snapshotResponse.diagnostics],
      fetchedAt: this.now(),
      requestId,
      dirty: false,
    };
    this.cache.set(entry);
    return entry;
  }

  summary(documentId?: string): SnapshotSummary | null {
    const target = documentId ?? this.defaultDocumentId();
    return this.cache.summary(target);
  }

  cachedSnapshot(documentId?: string): CachedSnapshot | null {
    return this.cache.get(documentId ?? this.defaultDocumentId());
  }

  async render(
    options: {
      documentId?: string;
      mode?: "formal" | "diagnostics";
      bounds?: { x: number; y: number; width: number; height: number };
    } = {},
  ): Promise<AgentRenderResponse> {
    const documentId = options.documentId ?? this.defaultDocumentId();
    const response = await this.send({
      ...baseRequest(this.newRequestId()),
      operation: "render",
      documentId,
      mode: options.mode ?? "formal",
      ...(options.bounds ? { bounds: options.bounds } : {}),
    });
    if (!response.ok || response.operation !== "render") {
      throw new AgentSessionError(
        response.ok ? "INVALID_RESPONSE" : response.error.code,
        response.ok
          ? "unexpected operation for render"
          : response.error.message,
        "request-rejected",
      );
    }
    return response;
  }

  /**
   * Compile high-level actions against the current Snapshot, dry-run every
   * produced transaction, then commit them in order. A concurrent human edit
   * surfaces as `STATE_CHANGED` with the objects that moved, never as a blind
   * overwrite.
   */
  async applyActions(
    actions: readonly unknown[],
    options: {
      documentId?: string;
      verify?: boolean;
      dryRunOnly?: boolean;
    } = {},
  ): Promise<ApplyActionsReport> {
    const verify = options.verify ?? true;
    const entry = await this.snapshot(options.documentId);
    const documentId = entry.documentId;
    let compiled: CompiledTransaction[];
    try {
      compiled = compileActions(actions, {
        snapshot: entry.snapshot,
        allocateId: (prefix) => `${prefix}-${crypto.randomUUID()}`,
        maxEditsPerTransaction:
          this.capabilitiesCache?.capabilities.limits.maxTransactionEdits ?? 64,
      });
    } catch (error) {
      if (error instanceof ActionCompileError) {
        return {
          ok: false,
          stage: "compile",
          code: "ACTION_COMPILE_FAILED",
          message: error.message,
          actionIndex: error.index,
          actionKind: error.actionKind,
          revision: entry.revision,
        };
      }
      throw error;
    }

    let revision = entry.revision;
    for (const transaction of compiled) {
      const response = await this.send(
        this.transactRequest(transaction, revision, true),
      );
      if (!response.ok) {
        return {
          ok: false,
          stage: "dry-run",
          code: response.error.code,
          message: response.error.message,
          revision,
        };
      }
    }
    if (options.dryRunOnly) {
      return {
        ok: true,
        stage: "done",
        dryRun: true,
        transactions: compiled.length,
        revision,
      };
    }

    for (const transaction of compiled) {
      const response = await this.send(
        this.transactRequest(transaction, revision, false),
      );
      if (!response.ok) {
        if (response.error.code === "STALE_REVISION") {
          return this.stateChangedReport(entry, response.error.message);
        }
        return {
          ok: false,
          stage: "commit",
          code: response.error.code,
          message: response.error.message,
          revision,
        };
      }
      if (response.operation !== "transact") {
        return {
          ok: false,
          stage: "commit",
          code: "INVALID_RESPONSE",
          message: "unexpected operation for transact",
          revision,
        };
      }
      revision = response.revision;
    }
    this.cache.markDirty(documentId, revision);

    const report: ApplyActionsReport = {
      ok: true,
      stage: "done",
      transactions: compiled.length,
      revision,
    };
    if (verify) {
      const fresh = await this.refreshSnapshot(documentId);
      const { errors, warnings } = snapshotSummary(fresh);
      report.changedObjectIds = changedObjectIds(
        entry.snapshot,
        fresh.snapshot,
      );
      report.errors = errors;
      report.warnings = warnings;
    }
    return report;
  }

  /** Escape hatch for callers that read the advanced-edits resource. */
  async advancedTransact(
    edits: readonly unknown[],
    options: { documentId?: string; dryRun?: boolean } = {},
  ): Promise<ApplyActionsReport> {
    const entry = await this.snapshot(options.documentId);
    const documentId = entry.documentId;
    const validated: AgentTransactRequest["edits"] = [];
    for (const edit of edits) {
      const parsed = AgentSchematicEditSchema.safeParse(edit);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return {
          ok: false,
          stage: "compile",
          code: "EDIT_SCHEMA_INVALID",
          message: issue
            ? `${issue.path.join(".")}: ${issue.message}`
            : "edit failed contract validation",
          revision: entry.revision,
        };
      }
      validated.push(parsed.data);
    }
    if (validated.length === 0) {
      return {
        ok: false,
        stage: "compile",
        code: "EDIT_SCHEMA_INVALID",
        message: "at least one edit is required",
        revision: entry.revision,
      };
    }
    const response = await this.send({
      ...baseRequest(this.newRequestId()),
      operation: "transact",
      documentId,
      transactionId: `txn-${crypto.randomUUID()}`,
      expectedRevision: entry.revision,
      ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
      edits: validated,
    });
    if (!response.ok) {
      if (response.error.code === "STALE_REVISION") {
        return this.stateChangedReport(entry, response.error.message);
      }
      return {
        ok: false,
        stage: "commit",
        code: response.error.code,
        message: response.error.message,
        revision: entry.revision,
      };
    }
    if (response.operation !== "transact") {
      return {
        ok: false,
        stage: "commit",
        code: "INVALID_RESPONSE",
        message: "unexpected operation for transact",
        revision: entry.revision,
      };
    }
    if (response.applied && !options.dryRun) {
      this.cache.markDirty(documentId, response.revision);
    }
    const report: ApplyActionsReport = {
      ok: true,
      stage: "done",
      transactions: 1,
      revision: response.revision,
    };
    return report;
  }

  private async stateChangedReport(
    entry: CachedSnapshot,
    message: string,
  ): Promise<ApplyActionsReport> {
    const fresh = await this.refreshSnapshot(entry.documentId);
    return {
      ok: false,
      stage: "commit",
      code: "STATE_CHANGED",
      message:
        message ??
        "the document revision changed; re-inspect the affected objects and retry",
      revision: fresh.revision,
      changedObjectIds: changedObjectIds(entry.snapshot, fresh.snapshot),
    };
  }

  private transactRequest(
    transaction: CompiledTransaction,
    expectedRevision: number,
    dryRun: boolean,
  ): AgentCircuitRequest {
    return {
      ...baseRequest(this.newRequestId()),
      operation: "transact",
      documentId: this.defaultDocumentId(),
      transactionId: `txn-${crypto.randomUUID()}`,
      expectedRevision,
      dryRun,
      ...(transaction.form === "edits"
        ? { edits: transaction.edits ?? [] }
        : { wireIntent: transaction.wireIntent }),
    };
  }

  /**
   * Send one four-operation request. Identical request IDs share the
   * in-flight promise, and a local network failure retries the exact same
   * payload once, which the relay deduplicates server-side.
   */
  private async send(
    request: AgentCircuitRequest,
  ): Promise<AgentCircuitResponse> {
    const session = this.requireSession();
    if (!this.tokenValid(session)) {
      this.connection.apply("credential-revoked", "TOKEN_EXPIRED");
      await this.credentials.clear();
      this.session = null;
      throw new AgentSessionError(
        "TOKEN_EXPIRED",
        "agent token expired; a new claim code is required",
        "unrecoverable-credential",
      );
    }
    const existing = this.inflight.get(request.requestId);
    if (existing) return existing;
    const pending = this.dispatch(request, session);
    this.inflight.set(request.requestId, pending);
    try {
      return await pending;
    } finally {
      this.inflight.delete(request.requestId);
    }
  }

  private async dispatch(
    request: AgentCircuitRequest,
    session: ActiveSession,
  ): Promise<AgentCircuitResponse> {
    let attempts = 0;
    for (;;) {
      try {
        const response = await this.http.circuit(
          session.sessionId,
          session.agentToken,
          request,
        );
        this.connection.apply("request-succeeded");
        return response;
      } catch (error) {
        if (!(error instanceof AgentSessionError)) throw error;
        if (
          error.category === "network" &&
          attempts < this.networkRetryAttempts
        ) {
          attempts += 1;
          this.connection.apply("transport-interrupted", error.code);
          continue;
        }
        if (error.category === "editor-offline") {
          this.connection.apply("editor-detached", error.code);
          throw error;
        }
        if (error.category === "unrecoverable-credential") {
          await this.discardCredential(error.code);
          throw error;
        }
        throw error;
      }
    }
  }

  private async discardCredential(code: string): Promise<void> {
    this.connection.apply("credential-revoked", code);
    this.session = null;
    this.capabilitiesCache = null;
    await this.credentials.clear();
  }

  private requireSession(): ActiveSession {
    if (!this.session) {
      throw new AgentSessionError(
        "NOT_CONNECTED",
        "not paired; call connect first",
        "unrecoverable-credential",
      );
    }
    return this.session;
  }

  private tokenValid(
    session: { tokenExpiresAt: number } | ActiveSession | StoredLike,
  ): boolean {
    return this.now() < session.tokenExpiresAt - this.tokenExpiryGraceMs;
  }

  private defaultDocumentId(): string {
    const documentId = this.session?.documentIds[0];
    if (!documentId) {
      throw new AgentSessionError(
        "NOT_CONNECTED",
        "no authorized document; call connect first",
        "unrecoverable-credential",
      );
    }
    return documentId;
  }
}

interface StoredLike {
  tokenExpiresAt: number;
}
