import { useCallback, useEffect, useRef, useState } from "react";

import {
  AGENT_API_VERSION,
  AGENT_API_V1_VERSION,
  AGENT_SESSION_PROTOCOL_VERSION,
  AgentSessionEventSchema,
  AgentSessionMessageSchema,
  createAgentCircuitService,
  parseAgentCircuitRequest,
  type AgentOperationHost,
  type AgentPermissions,
  type AgentSessionScope,
} from "@icm/agent-adapter";
import { sha256Hex } from "@icm/derived";
import type { CircuitProject } from "@icm/model";

import type {
  AgentAuditEntry,
  AgentConnectionStatus,
} from "./connect-agent-panel";
import {
  clearAgentSessionRecovery,
  readAgentSessionRecovery,
  writeAgentSessionRecovery,
  type AgentSessionRecoveryRecord,
} from "./session-recovery";

interface CreatedSessionResponse {
  ok: true;
  session: {
    sessionId: string;
    editorSecret: string;
    claimCode: string;
    claimExpiresAt: number;
    expiresAt: number;
  };
}

function isCreatedSessionResponse(
  value: unknown,
): value is CreatedSessionResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { ok?: unknown; session?: unknown };
  if (
    candidate.ok !== true ||
    typeof candidate.session !== "object" ||
    candidate.session === null
  ) {
    return false;
  }
  const session = candidate.session as Record<string, unknown>;
  return (
    typeof session.sessionId === "string" &&
    typeof session.editorSecret === "string" &&
    typeof session.claimCode === "string" &&
    typeof session.claimExpiresAt === "number" &&
    typeof session.expiresAt === "number"
  );
}

type LiveSession = {
  sessionId: string;
  editorSecret: string;
  claimCode: string | null;
  claimExpiresAt: number | null;
  expiresAt: number;
  scopes: AgentSessionScope[];
  socket: WebSocket | null;
  claimed: boolean;
  hasOpened: boolean;
  allowReconnect: boolean;
  reconnectAttempt: number;
  reconnectTimer: number | null;
  reconnect: () => void;
  requestCache: Map<
    string,
    { payloadHash: string; response: unknown; byteLength: number }
  >;
  requestCacheBytes: number;
  requestHashes: Map<string, string>;
};

const BROWSER_CACHE_MAX_ENTRIES = 32;
const BROWSER_CACHE_MAX_BYTES = 16_000_000;
const RECONNECT_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000, 8_000] as const;

function stopReconnect(live: LiveSession): void {
  live.allowReconnect = false;
  if (live.reconnectTimer !== null) {
    window.clearTimeout(live.reconnectTimer);
    live.reconnectTimer = null;
  }
}

export interface AgentSessionViewModel {
  status: AgentConnectionStatus;
  claimCode: string | null;
  scopes: readonly AgentSessionScope[];
  expiresAt: number | null;
  audit: readonly AgentAuditEntry[];
  error: string | null;
}

export interface UseAgentSessionOptions {
  project: CircuitProject;
  projectSessionId: string;
  host: AgentOperationHost;
}

export interface UseAgentSessionResult extends AgentSessionViewModel {
  grant: (scopes: readonly AgentSessionScope[]) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  reconnect: () => void;
  rotate: () => Promise<void>;
  revoke: () => Promise<void>;
}

function permissionsFromScopes(
  scopes: readonly AgentSessionScope[],
): AgentPermissions {
  return {
    query: scopes.includes("circuit.snapshot"),
    snapshot: scopes.includes("circuit.snapshot"),
    render: scopes.includes("circuit.render"),
    sourceSpans: scopes.includes("circuit.source-spans"),
    edit: {
      geometry: scopes.includes("circuit.edit.geometry"),
      connectivity: scopes.includes("circuit.edit.connectivity"),
      presentation: scopes.includes("circuit.edit.presentation"),
    },
  };
}

function socketUrl(sessionId: string): string {
  const url = new URL(
    `/api/agent/sessions/${sessionId}/editor`,
    window.location.href,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function useAgentSession(
  options: UseAgentSessionOptions,
): UseAgentSessionResult {
  const liveRef = useRef<LiveSession | null>(null);
  const recoveryAttemptedForProjectRef = useRef<string | null>(null);
  const projectSessionRef = useRef(options.projectSessionId);
  const revisionRef = useRef(
    new Map(
      options.project.documents.map((document) => [
        document.id,
        document.revision,
      ]),
    ),
  );
  const agentRevisionRef = useRef(new Map<string, number>());
  const [view, setView] = useState<AgentSessionViewModel>({
    status: "idle",
    claimCode: null,
    scopes: [],
    expiresAt: null,
    audit: [],
    error: null,
  });

  const update = useCallback(
    (next: Partial<AgentSessionViewModel>, entry?: AgentAuditEntry) => {
      setView((previous) => ({
        ...previous,
        ...next,
        audit: entry ? [...previous.audit, entry].slice(-32) : previous.audit,
      }));
    },
    [],
  );

  const control = useCallback(
    async (action: "pause" | "resume" | "revoke" | "replace-project") => {
      const live = liveRef.current;
      if (!live) return;
      const response = await fetch(
        `/api/agent/sessions/${live.sessionId}/control`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-editor-secret": live.editorSecret,
          },
          body: JSON.stringify({ action }),
        },
      );
      if (!response.ok)
        throw new Error(`Session control failed (${response.status})`);
    },
    [],
  );

  const revoke = useCallback(async () => {
    const live = liveRef.current;
    if (!live) {
      clearAgentSessionRecovery(window.sessionStorage);
      update({ status: "idle", claimCode: null });
      return;
    }
    stopReconnect(live);
    clearAgentSessionRecovery(window.sessionStorage);
    try {
      await control("revoke");
    } catch {
      // Local revocation remains terminal even when the relay is unreachable.
    }
    live.socket?.close(1000, "revoked");
    liveRef.current = null;
    update(
      { status: "revoked", claimCode: null, error: null },
      { at: Date.now(), kind: "revoked" },
    );
  }, [control, update]);

  const grant = useCallback(
    async (
      scopes: readonly AgentSessionScope[],
      recovery?: AgentSessionRecoveryRecord,
    ) => {
      if (liveRef.current) await revoke();
      update({
        status: recovery ? "reconnecting" : "creating",
        error: null,
        claimCode: null,
        scopes,
      });
      try {
        let created: CreatedSessionResponse | null = null;
        if (!recovery) {
          const response = await fetch("/api/agent/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              projectSessionId: options.projectSessionId,
              projectId: options.project.id,
              documentIds: options.project.documents.map(
                (document) => document.id,
              ),
              scopes,
            }),
          });
          if (!response.ok)
            throw new Error(`Session creation failed (${response.status})`);
          const payload: unknown = await response.json();
          if (!isCreatedSessionResponse(payload)) {
            throw new Error("Session creation returned an invalid response");
          }
          created = payload;
        }
        const live: LiveSession = {
          sessionId: recovery?.sessionId ?? created!.session.sessionId,
          editorSecret: recovery?.editorSecret ?? created!.session.editorSecret,
          claimCode: recovery ? null : created!.session.claimCode,
          claimExpiresAt: recovery ? null : created!.session.claimExpiresAt,
          expiresAt: recovery?.expiresAt ?? created!.session.expiresAt,
          scopes: [...scopes],
          socket: null,
          claimed: recovery !== undefined,
          hasOpened: false,
          allowReconnect: true,
          reconnectAttempt: 0,
          reconnectTimer: null,
          reconnect: () => undefined,
          requestCache: new Map(),
          requestCacheBytes: 0,
          requestHashes: new Map(),
        };
        liveRef.current = live;

        const service = createAgentCircuitService({
          agentId: `web-agent:${live.sessionId}`,
          host: options.host,
          permissions: permissionsFromScopes(scopes),
        });
        const connect = () => {
          if (
            liveRef.current !== live ||
            !live.allowReconnect ||
            Date.now() >= live.expiresAt
          ) {
            return;
          }
          if (
            live.socket?.readyState === WebSocket.OPEN ||
            live.socket?.readyState === WebSocket.CONNECTING
          ) {
            return;
          }
          if (live.reconnectTimer !== null) {
            window.clearTimeout(live.reconnectTimer);
            live.reconnectTimer = null;
          }
          const socket = new WebSocket(socketUrl(live.sessionId), [
            "icm-agent-session",
            live.editorSecret,
          ]);
          live.socket = socket;
          socket.addEventListener("open", () => {
            const firstConnection = !live.hasOpened;
            live.hasOpened = true;
            live.reconnectAttempt = 0;
            live.reconnectTimer = null;
            update(
              {
                status: live.claimed ? "connected" : "waiting-for-agent",
                claimCode: live.claimed ? null : live.claimCode,
                scopes,
                expiresAt: live.expiresAt,
                error: null,
              },
              firstConnection ? { at: Date.now(), kind: "granted" } : undefined,
            );
          });
          socket.addEventListener("message", (event) => {
            let raw: unknown;
            try {
              raw = JSON.parse(String(event.data));
            } catch {
              return;
            }
            const parsed = AgentSessionMessageSchema.safeParse(raw);
            if (!parsed.success || parsed.data.sessionId !== live.sessionId)
              return;
            if (parsed.data.kind === "event") {
              const sessionEvent = AgentSessionEventSchema.safeParse(
                parsed.data.payload,
              );
              if (
                sessionEvent.success &&
                sessionEvent.data.type === "session.ready"
              ) {
                live.claimed = true;
                writeAgentSessionRecovery(window.sessionStorage, {
                  version: 1,
                  sessionId: live.sessionId,
                  editorSecret: live.editorSecret,
                  projectId: options.project.id,
                  projectSessionId: options.projectSessionId,
                  scopes: live.scopes,
                  expiresAt: live.expiresAt,
                });
                update(
                  { status: "connected", claimCode: null },
                  { at: Date.now(), kind: "claimed" },
                );
              } else if (
                sessionEvent.success &&
                sessionEvent.data.type === "session.revoked"
              ) {
                stopReconnect(live);
                clearAgentSessionRecovery(window.sessionStorage);
                socket.close(1000, "session revoked");
                if (liveRef.current === live) liveRef.current = null;
                update(
                  { status: "revoked", claimCode: null },
                  { at: Date.now(), kind: "revoked" },
                );
              } else if (
                sessionEvent.success &&
                sessionEvent.data.type === "session.paused"
              ) {
                update({ status: "paused" });
              }
              return;
            }
            if (parsed.data.kind !== "circuit-request") return;
            const circuitRequest = parseAgentCircuitRequest(
              parsed.data.payload,
            );
            const payloadKey = JSON.stringify(parsed.data.payload);
            const payloadHash = sha256Hex(payloadKey);
            const cached = live.requestCache.get(parsed.data.requestId);
            const sendResponse = (payload: unknown) => {
              socket.send(
                JSON.stringify({
                  protocolVersion: AGENT_SESSION_PROTOCOL_VERSION,
                  sessionId: live.sessionId,
                  messageId: crypto.randomUUID(),
                  requestId: parsed.data.requestId,
                  sentAt: new Date().toISOString(),
                  kind: "circuit-response",
                  payload,
                }),
              );
            };
            const sendRequestError = (
              code: "REQUEST_ID_REUSED" | "REQUEST_RESULT_UNAVAILABLE",
              message: string,
            ) => {
              const candidate = parsed.data.payload as {
                apiVersion?: unknown;
                operation?: unknown;
              };
              sendResponse({
                apiVersion:
                  candidate.apiVersion === AGENT_API_V1_VERSION
                    ? AGENT_API_V1_VERSION
                    : AGENT_API_VERSION,
                requestId: parsed.data.requestId,
                operation:
                  typeof candidate.operation === "string" &&
                  ["query", "snapshot", "transact", "render"].includes(
                    candidate.operation,
                  )
                    ? candidate.operation
                    : "error",
                ok: false,
                error: { code, message },
                diagnostics: [],
              });
            };
            if (cached) {
              if (cached.payloadHash === payloadHash) {
                sendResponse(cached.response);
              } else {
                sendRequestError(
                  "REQUEST_ID_REUSED",
                  "requestId was reused with a different payload",
                );
              }
              return;
            }
            const knownHash = live.requestHashes.get(parsed.data.requestId);
            if (knownHash) {
              sendRequestError(
                knownHash === payloadHash
                  ? "REQUEST_RESULT_UNAVAILABLE"
                  : "REQUEST_ID_REUSED",
                knownHash === payloadHash
                  ? "The request was already executed but its cached result was evicted"
                  : "requestId was reused with a different payload",
              );
              return;
            }
            live.requestHashes.set(parsed.data.requestId, payloadHash);
            const operation = circuitRequest.success
              ? circuitRequest.data.operation
              : "request";
            update(
              { status: "working" },
              { at: Date.now(), kind: "operation", detail: operation },
            );
            // The relay already rejects malformed public payloads, but the
            // browser host repeats that same strict parse before it can touch
            // the live Project. Never route hosted traffic through the local
            // v1/v3 compatibility handler.
            const result = service.handle(parsed.data.payload);
            const responseBytes = new TextEncoder().encode(
              JSON.stringify(result),
            ).byteLength;
            if (responseBytes <= BROWSER_CACHE_MAX_BYTES) {
              live.requestCache.set(parsed.data.requestId, {
                payloadHash,
                response: result,
                byteLength: responseBytes,
              });
              live.requestCacheBytes += responseBytes;
            }
            while (
              live.requestCache.size > BROWSER_CACHE_MAX_ENTRIES ||
              live.requestCacheBytes > BROWSER_CACHE_MAX_BYTES
            ) {
              const oldest = live.requestCache.keys().next().value;
              if (oldest === undefined) break;
              const entry = live.requestCache.get(oldest);
              live.requestCache.delete(oldest);
              live.requestCacheBytes -= entry?.byteLength ?? 0;
            }
            sendResponse(result);
            if (
              result.ok &&
              result.operation === "transact" &&
              result.applied &&
              circuitRequest.success &&
              circuitRequest.data.operation === "transact"
            ) {
              agentRevisionRef.current.set(
                circuitRequest.data.documentId,
                result.revision,
              );
              socket.send(
                JSON.stringify({
                  protocolVersion: AGENT_SESSION_PROTOCOL_VERSION,
                  sessionId: live.sessionId,
                  messageId: crypto.randomUUID(),
                  requestId: parsed.data.requestId,
                  sentAt: new Date().toISOString(),
                  kind: "event",
                  payload: {
                    type: "document.revision-changed",
                    sessionId: live.sessionId,
                    documentId: circuitRequest.data.documentId,
                    revision: result.revision,
                    actorKind: "agent",
                    requestId: parsed.data.requestId,
                    changedObjectIds: [...result.diff.changedObjectIds],
                  },
                }),
              );
            }
            update({ status: "connected" });
          });
          socket.addEventListener("close", () => {
            if (live.socket === socket) live.socket = null;
            if (liveRef.current !== live || !live.allowReconnect) return;
            const delay = RECONNECT_DELAYS_MS[live.reconnectAttempt];
            if (delay === undefined || Date.now() >= live.expiresAt) {
              update({ status: "offline" });
              return;
            }
            live.reconnectAttempt += 1;
            update({ status: "reconnecting" });
            live.reconnectTimer = window.setTimeout(connect, delay);
          });
          socket.addEventListener("error", () => {
            if (liveRef.current === live) {
              update({
                status: "reconnecting",
                error: "Agent relay connection failed",
              });
              socket.close();
            }
          });
        };
        live.reconnect = connect;
        connect();
      } catch (error) {
        liveRef.current = null;
        if (recovery) clearAgentSessionRecovery(window.sessionStorage);
        update({
          status: "idle",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [options.host, options.project, options.projectSessionId, revoke, update],
  );

  useEffect(() => {
    if (recoveryAttemptedForProjectRef.current === options.projectSessionId) {
      return;
    }
    recoveryAttemptedForProjectRef.current = options.projectSessionId;
    const recovery = readAgentSessionRecovery(window.sessionStorage, {
      projectId: options.project.id,
      projectSessionId: options.projectSessionId,
      now: Date.now(),
    });
    if (recovery) void grant(recovery.scopes, recovery);
  }, [grant, options.project.id, options.projectSessionId]);

  const pause = useCallback(async () => {
    try {
      await control("pause");
      update(
        { status: "paused", error: null },
        { at: Date.now(), kind: "paused" },
      );
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [control, update]);

  const resume = useCallback(async () => {
    try {
      await control("resume");
      update(
        {
          status: liveRef.current?.claimed ? "connected" : "waiting-for-agent",
          error: null,
        },
        { at: Date.now(), kind: "resumed" },
      );
    } catch (error) {
      update({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [control, update]);

  const reconnect = useCallback(() => {
    const live = liveRef.current;
    if (!live || Date.now() >= live.expiresAt) return;
    if (live.reconnectTimer !== null) {
      window.clearTimeout(live.reconnectTimer);
      live.reconnectTimer = null;
    }
    live.allowReconnect = true;
    live.reconnectAttempt = 0;
    update({ status: "reconnecting", error: null });
    live.reconnect();
  }, [update]);

  const rotate = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    await grant([...live.scopes]);
  }, [grant]);

  useEffect(() => {
    if (projectSessionRef.current !== options.projectSessionId) return;
    const live = liveRef.current;
    for (const document of options.project.documents) {
      const previousRevision = revisionRef.current.get(document.id);
      revisionRef.current.set(document.id, document.revision);
      if (
        previousRevision === undefined ||
        previousRevision === document.revision ||
        !live?.socket ||
        live.socket.readyState !== WebSocket.OPEN
      ) {
        continue;
      }
      if (agentRevisionRef.current.get(document.id) === document.revision) {
        agentRevisionRef.current.delete(document.id);
        continue;
      }
      live.socket.send(
        JSON.stringify({
          protocolVersion: AGENT_SESSION_PROTOCOL_VERSION,
          sessionId: live.sessionId,
          messageId: crypto.randomUUID(),
          requestId: `human-revision-${document.id}-${document.revision}`,
          sentAt: new Date().toISOString(),
          kind: "event",
          payload: {
            type: "document.revision-changed",
            sessionId: live.sessionId,
            documentId: document.id,
            revision: document.revision,
            actorKind: "human",
            changedObjectIds: [],
          },
        }),
      );
    }
  }, [options.project, options.projectSessionId]);

  useEffect(() => {
    if (projectSessionRef.current === options.projectSessionId) return;
    projectSessionRef.current = options.projectSessionId;
    recoveryAttemptedForProjectRef.current = options.projectSessionId;
    revisionRef.current = new Map(
      options.project.documents.map((document) => [
        document.id,
        document.revision,
      ]),
    );
    agentRevisionRef.current.clear();
    clearAgentSessionRecovery(window.sessionStorage);
    const live = liveRef.current;
    if (!live) return;
    stopReconnect(live);
    void control("replace-project").finally(() => {
      live.socket?.close(1000, "project replaced");
      liveRef.current = null;
      update(
        { status: "revoked", claimCode: null },
        { at: Date.now(), kind: "replaced" },
      );
    });
  }, [control, options.project, options.projectSessionId, update]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const live = liveRef.current;
      if (live && Date.now() >= live.expiresAt) {
        stopReconnect(live);
        clearAgentSessionRecovery(window.sessionStorage);
        live.socket?.close(1000, "expired");
        liveRef.current = null;
        update({ status: "expired", claimCode: null });
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [update]);

  useEffect(
    () => () => {
      const live = liveRef.current;
      if (live) {
        stopReconnect(live);
        if (!live.claimed) {
          clearAgentSessionRecovery(window.sessionStorage);
          void fetch(`/api/agent/sessions/${live.sessionId}`, {
            method: "DELETE",
            headers: { "x-editor-secret": live.editorSecret },
            keepalive: true,
          });
        }
        live.socket?.close(1000, "tab closed");
      }
    },
    [],
  );

  return { ...view, grant, pause, resume, reconnect, rotate, revoke };
}
