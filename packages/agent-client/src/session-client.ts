import {
  AgentCapabilitiesResponseSchema,
  AgentRenderResponseSchema,
  AgentSchematicEditSchema,
  AGENT_API_VERSION,
  type AgentCircuitRequest,
  type AgentCircuitResponse,
  type AgentFileResourceRequest,
  type AgentFileResourceResponse,
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
import { AgentSessionError } from "./errors.js";
import { AgentHttpClient, type ClaimSuccess } from "./http-client.js";
import {
  type ConnectorStore,
  type StoredConnectorCredential,
} from "./connector-store.js";
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
  now?: () => number;
  newRequestId?: () => string;
  /** Automatic exact-payload retry attempts after a local network failure. */
  networkRetryAttempts?: number;
  tokenExpiryGraceMs?: number;
  connectorStore?: ConnectorStore;
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
 * Bearer tokens remain process-local and are sent only in Authorization
 * headers. A revocable connector credential may be persisted by M4 so a new
 * MCP process can resume without another claim-code hand-off.
 */
export class AgentSessionClient {
  readonly connection: ConnectionTracker;
  private readonly http: AgentHttpClient;
  private readonly cache = new SnapshotCache();
  private readonly now: () => number;
  private readonly newRequestId: () => string;
  private readonly networkRetryAttempts: number;
  private readonly tokenExpiryGraceMs: number;
  private readonly connectorStore: ConnectorStore | undefined;
  private readonly inflight = new Map<string, Promise<AgentCircuitResponse>>();
  private session: ActiveSession | null = null;
  private capabilitiesCache: AgentCapabilitiesResponse | null = null;
  private resumePromise: Promise<ActiveSession | null> | null = null;

  constructor(options: AgentSessionClientOptions) {
    this.http = options.http;
    this.now = options.now ?? (() => Date.now());
    this.newRequestId =
      options.newRequestId ?? (() => `req-${crypto.randomUUID()}`);
    this.networkRetryAttempts = options.networkRetryAttempts ?? 1;
    this.tokenExpiryGraceMs = options.tokenExpiryGraceMs ?? 30_000;
    this.connectorStore = options.connectorStore;
    this.connection = new ConnectionTracker(this.now);
  }

  /**
   * Pair or re-check the current session. With a claim code, redeem it and
   * replace prior local state. Without one, reuse the in-memory bearer or
   * resume the persisted connector.
   */
  async connect(claimCode?: string): Promise<ConnectReport> {
    if (claimCode === undefined || claimCode.trim() === "") {
      const resumed = await this.tryResume();
      if (resumed === null) {
        throw new AgentSessionError(
          "CLAIM_REQUIRED",
          "no valid saved connector; pass a claim code from the editor's connect panel",
          "unrecoverable-credential",
        );
      }
      return resumed;
    }
    this.connection.apply("claim-started");
    try {
      const claim: ClaimSuccess = await this.http.claim(claimCode.trim());
      this.session = this.activeSession(claim);
      await this.persistConnector(claim);
      return await this.establishContext("claimed");
    } catch (error) {
      if (!this.session) this.connection.apply("reset");
      throw error;
    }
  }

  private async tryResume(): Promise<ConnectReport | null> {
    let stored = this.session;
    if (!stored || !this.tokenValid(stored)) {
      stored = await this.resumeConnector();
    }
    if (!stored) return null;
    this.connection.apply("resume-started");
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

  /** Invoke the canonical browser-hosted file-resource contract. */
  async fileResource(
    request: AgentFileResourceRequest,
  ): Promise<AgentFileResourceResponse> {
    return this.withAuthorization((session) =>
      this.http.files(session.sessionId, session.agentToken, request),
    );
  }

  /** Revoke the server session and forget the durable connector locally. */
  async disconnect(): Promise<void> {
    try {
      const session = await this.ensureSession();
      await this.http.disconnect(session.sessionId, session.agentToken);
    } finally {
      await this.discardCredential("DISCONNECTED");
    }
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
   * Compile high-level actions against a fresh Snapshot, require one atomic
   * transaction, dry-run it, then commit it. A concurrent human edit surfaces
   * as `STATE_CHANGED` with the objects that moved, never as a blind overwrite.
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
    const entry = await this.snapshot(options.documentId, { refresh: true });
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

    if (compiled.length !== 1) {
      return {
        ok: false,
        stage: "compile",
        code: "ACTION_BATCH_NOT_ATOMIC",
        message:
          "this action batch requires multiple underlying transactions; split it at the edit/wire boundary and refresh between calls",
        revision: entry.revision,
        transactions: compiled.length,
      };
    }

    let revision = entry.revision;
    const transaction = compiled[0]!;
    const dryRunResponse = await this.send(
      this.transactRequest(transaction, documentId, revision, true),
    );
    if (!dryRunResponse.ok) {
      return {
        ok: false,
        stage: "dry-run",
        code: dryRunResponse.error.code,
        message: dryRunResponse.error.message,
        revision,
      };
    }
    if (options.dryRunOnly) {
      return {
        ok: true,
        stage: "done",
        dryRun: true,
        transactions: 1,
        revision,
      };
    }

    const response = await this.send(
      this.transactRequest(transaction, documentId, revision, false),
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
    this.cache.markDirty(documentId, revision);

    const report: ApplyActionsReport = {
      ok: true,
      stage: "done",
      transactions: 1,
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
    const cached = this.cachedSnapshot(options.documentId);
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
          ...(cached ? { revision: cached.revision } : {}),
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
        ...(cached ? { revision: cached.revision } : {}),
      };
    }
    const entry = await this.snapshot(options.documentId, { refresh: true });
    const documentId = entry.documentId;
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
    documentId: string,
    expectedRevision: number,
    dryRun: boolean,
  ): AgentCircuitRequest {
    return {
      ...baseRequest(this.newRequestId()),
      operation: "transact",
      documentId,
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
    const existing = this.inflight.get(request.requestId);
    if (existing) return existing;
    const pending = this.dispatch(request);
    this.inflight.set(request.requestId, pending);
    try {
      return await pending;
    } finally {
      this.inflight.delete(request.requestId);
    }
  }

  private async dispatch(
    request: AgentCircuitRequest,
  ): Promise<AgentCircuitResponse> {
    let attempts = 0;
    for (;;) {
      try {
        const response = await this.withAuthorization((session) =>
          this.http.circuit(session.sessionId, session.agentToken, request),
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
    await this.connectorStore?.clear();
  }

  private async ensureSession(): Promise<ActiveSession> {
    if (this.session && this.tokenValid(this.session)) return this.session;
    const resumed = await this.resumeConnector();
    if (!resumed) {
      throw new AgentSessionError(
        this.session ? "TOKEN_EXPIRED" : "NOT_CONNECTED",
        "no valid connector pairing; call connect with a claim code",
        "unrecoverable-credential",
      );
    }
    return resumed;
  }

  private async withAuthorization<T>(
    operation: (session: ActiveSession) => Promise<T>,
  ): Promise<T> {
    let session = await this.ensureSession();
    try {
      return await operation(session);
    } catch (error) {
      if (
        error instanceof AgentSessionError &&
        (error.code === "TOKEN_INVALID" || error.code === "TOKEN_EXPIRED")
      ) {
        this.session = null;
        session = await this.ensureSession();
        try {
          return await operation(session);
        } catch (retryError) {
          if (
            retryError instanceof AgentSessionError &&
            retryError.category === "unrecoverable-credential"
          ) {
            await this.discardCredential(retryError.code);
          }
          throw retryError;
        }
      }
      if (
        error instanceof AgentSessionError &&
        error.category === "unrecoverable-credential"
      ) {
        await this.discardCredential(error.code);
      }
      throw error;
    }
  }

  private async resumeConnector(): Promise<ActiveSession | null> {
    if (!this.connectorStore) return null;
    if (this.resumePromise) return this.resumePromise;
    this.resumePromise = this.resumeConnectorOnce();
    try {
      return await this.resumePromise;
    } finally {
      this.resumePromise = null;
    }
  }

  private async resumeConnectorOnce(): Promise<ActiveSession | null> {
    const stored = await this.connectorStore?.load();
    if (
      !stored ||
      stored.apiBaseUrl !== this.http.baseUrl ||
      this.now() >= stored.connectorExpiresAt
    ) {
      if (stored) await this.connectorStore?.clear();
      return null;
    }
    this.connection.apply("resume-started");
    try {
      const claim = await this.http.resumeConnector(
        stored.sessionId,
        stored.connectorToken,
      );
      this.session = this.activeSession(claim);
      await this.persistConnector(claim);
      return this.session;
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

  private activeSession(claim: ClaimSuccess): ActiveSession {
    return {
      sessionId: claim.sessionId,
      agentToken: claim.agentToken,
      tokenExpiresAt: claim.tokenExpiresAt,
      scopes: [...claim.scopes],
      projectId: claim.projectId,
      documentIds: [...claim.documentIds],
    };
  }

  private async persistConnector(claim: ClaimSuccess): Promise<void> {
    if (!this.connectorStore) return;
    const credential: StoredConnectorCredential = {
      version: 1,
      apiBaseUrl: this.http.baseUrl,
      sessionId: claim.sessionId,
      connectorToken: claim.connectorToken,
      connectorExpiresAt: claim.connectorExpiresAt,
      storedAt: this.now(),
    };
    await this.connectorStore.save(credential);
  }

  private tokenValid(session: { tokenExpiresAt: number }): boolean {
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
