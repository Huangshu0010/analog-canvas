import { expect, test } from "@playwright/test";
import type { WebSocketRoute } from "@playwright/test";

import { clickCommand, openMenu } from "./editor-fixtures.js";

type SessionMessage = {
  kind: string;
  requestId: string;
  payload: unknown;
};

test("grants a browser Agent, edits through the live host, and shares undo", async ({
  page,
}) => {
  const sessionId = "session-e2e";
  const editorSecret = "editor-secret-e2e";
  const responses: SessionMessage[] = [];
  let browserSocket: WebSocketRoute | null = null;
  let sessionCreates = 0;
  let revokeControls = 0;

  await page.routeWebSocket(
    `**/api/agent/sessions/${sessionId}/editor`,
    (socket) => {
      expect(socket.protocols()).toEqual(["icm-agent-session", editorSecret]);
      browserSocket = socket;
      socket.onMessage((message) => {
        responses.push(JSON.parse(String(message)) as SessionMessage);
      });
    },
  );
  await page.route("**/api/agent/sessions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/agent/sessions") {
      sessionCreates += 1;
      const body = request.postDataJSON() as {
        projectId: string;
        projectSessionId: string;
        documentIds: string[];
        scopes: string[];
      };
      expect(body.projectId).toBe("project-main");
      expect(body.projectSessionId).toMatch(/^project-main:\d+$/u);
      expect(body.documentIds).toEqual(["document-main"]);
      expect(body.scopes).toContain("circuit.edit.connectivity");
      expect(body.scopes).toContain("editor.semantic-control");
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          session: {
            sessionId,
            editorSecret,
            claimCode: `${sessionId}.one-time-claim`,
            claimExpiresAt: Date.now() + 300_000,
            expiresAt: Date.now() + 3_600_000,
          },
        },
      });
      return;
    }
    if (request.method() === "POST" && url.pathname.endsWith("/control")) {
      const body = request.postDataJSON() as { action?: string };
      if (body.action === "revoke") revokeControls += 1;
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, status: "active" },
      });
      return;
    }
    if (request.method() === "DELETE") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.abort();
  });

  await page.goto("/");
  const agentMenu = await openMenu(page, "Agent");
  await agentMenu.getByRole("button", { name: "Connect Agent" }).click();
  await page.getByTestId("agent-preset-full").click();
  await expect(page.getByTestId("agent-claim-code")).toHaveText(
    `${sessionId}.one-time-claim`,
  );
  await expect.poll(() => browserSocket !== null).toBe(true);
  const socket = browserSocket!;

  socket.send(
    JSON.stringify({
      protocolVersion: "1.0",
      sessionId,
      messageId: "ready-message",
      requestId: "ready-event",
      sentAt: new Date().toISOString(),
      kind: "event",
      payload: { type: "session.ready", sessionId },
    }),
  );
  await expect(page.getByTestId("agent-status")).toContainText(
    "Agent connected",
  );

  const sendCircuitRequest = async (
    requestId: string,
    payload: Record<string, unknown>,
  ): Promise<SessionMessage> => {
    const responseCount = responses.filter(
      (message) =>
        message.requestId === requestId && message.kind === "circuit-response",
    ).length;
    socket.send(
      JSON.stringify({
        protocolVersion: "1.0",
        sessionId,
        messageId: `message-${requestId}`,
        requestId,
        sentAt: new Date().toISOString(),
        kind: "circuit-request",
        payload,
      }),
    );
    await expect
      .poll(
        () =>
          responses.filter(
            (message) =>
              message.requestId === requestId &&
              message.kind === "circuit-response",
          ).length,
      )
      .toBe(responseCount + 1);
    return responses
      .filter(
        (message) =>
          message.requestId === requestId &&
          message.kind === "circuit-response",
      )
      .at(-1)!;
  };

  const snapshot = await sendCircuitRequest("snapshot-before", {
    apiVersion: "2.0",
    requestId: "snapshot-before",
    operation: "snapshot",
    documentId: "document-main",
  });
  expect(snapshot.kind).toBe("circuit-response");
  expect(snapshot.payload).toMatchObject({
    ok: true,
    operation: "snapshot",
    revision: 0,
  });

  const semantic = await sendCircuitRequest("semantic-fit", {
    apiVersion: "2.0",
    requestId: "semantic-fit",
    operation: "transact",
    documentId: "document-main",
    transactionId: "semantic-fit-transaction",
    expectedRevision: 0,
    semanticIntent: { kind: "fit-document" },
  });
  expect(semantic.payload).toMatchObject({
    ok: true,
    operation: "transact",
    applied: false,
    revision: 0,
    proposedRevision: 0,
    semantic: {
      kind: "fit-document",
      documentId: "document-main",
      objectIds: [],
    },
  });
  await expect(page.getByTestId("revision")).toHaveText("0");

  const transaction = await sendCircuitRequest("agent-edit", {
    apiVersion: "2.0",
    requestId: "agent-edit",
    operation: "transact",
    documentId: "document-main",
    transactionId: "agent-transaction-e2e",
    expectedRevision: 0,
    edits: [
      {
        kind: "add_instance",
        instance: {
          id: "Ragent",
          symbolId: "resistor",
          placement: null,
          properties: {},
        },
      },
    ],
  });
  expect(transaction.payload).toMatchObject({
    ok: true,
    operation: "transact",
    applied: true,
    revision: 1,
  });
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect
    .poll(() =>
      responses.some(
        (message) =>
          message.kind === "event" &&
          (message.payload as { actorKind?: string }).actorKind === "agent",
      ),
    )
    .toBe(true);

  const replay = await sendCircuitRequest("agent-edit", {
    apiVersion: "2.0",
    requestId: "agent-edit",
    operation: "transact",
    documentId: "document-main",
    transactionId: "agent-transaction-e2e",
    expectedRevision: 0,
    edits: [
      {
        kind: "add_instance",
        instance: {
          id: "Ragent",
          symbolId: "resistor",
          placement: null,
          properties: {},
        },
      },
    ],
  });
  expect(replay.payload).toEqual(transaction.payload);
  await expect(page.getByTestId("revision")).toHaveText("1");

  await page
    .getByTestId("connect-agent-panel")
    .getByRole("button", { name: "Close" })
    .click();
  await clickCommand(page, "Edit", "Undo");
  await expect(page.getByTestId("active-instance-count")).toHaveText("0");
  await expect
    .poll(() =>
      responses.some(
        (message) =>
          message.kind === "event" &&
          (message.payload as { actorKind?: string }).actorKind === "human",
      ),
    )
    .toBe(true);

  const reopenedAgentMenu = await openMenu(page, "Agent");
  await reopenedAgentMenu
    .getByRole("button", { name: "Connect Agent" })
    .click();
  await expect(page.getByTestId("agent-status")).toContainText(
    "Agent connected",
  );
  const originalSocket = browserSocket as WebSocketRoute | null;
  if (!originalSocket) throw new Error("Agent WebSocket was not connected");
  originalSocket.close();
  await expect.poll(() => browserSocket !== originalSocket).toBe(true);
  await expect(page.getByTestId("agent-status")).toContainText(
    "Agent connected",
  );
  await page.getByTestId("agent-pause").click();
  await expect(page.getByTestId("agent-status")).toContainText("Paused");
  await page.getByTestId("agent-resume").click();
  await expect(page.getByTestId("agent-status")).toContainText(
    "Agent connected",
  );
  await page.getByTestId("agent-rotate").click();
  await expect.poll(() => sessionCreates).toBe(2);
  await expect.poll(() => revokeControls).toBe(1);
  await expect(page.getByTestId("agent-claim-code")).toHaveText(
    `${sessionId}.one-time-claim`,
  );
  await expect(page.getByTestId("agent-status")).toContainText(
    "Waiting for Agent to claim",
  );
  await page.getByTestId("agent-revoke").click();
  await expect(page.getByTestId("agent-status")).toContainText("Revoked");
});
