import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { createEmptyProject, CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";
import { serializeProject } from "@icm/project-protocol";

import {
  GALLERY_DAILY_SUBMISSION_LIMIT,
  GALLERY_MAX_PROJECT_BYTES,
  GalleryDO,
  routeGalleryRequest,
  type GalleryEnv,
} from "./gallery";
import { AuthDO, type AuthEnv } from "./auth";

function sqliteState() {
  const db = new DatabaseSync(":memory:");
  return {
    storage: {
      sql: {
        exec<T>(query: string, ...bindings: unknown[]) {
          const statement = db.prepare(query);
          if (/^\s*(select|with|pragma)/iu.test(query)) {
            const rows = statement.all(
              ...(bindings as (string | number | null)[]),
            ) as T[];
            return {
              toArray: () => rows,
              one: () => {
                if (rows.length !== 1) throw new Error("expected one row");
                return rows[0]!;
              },
            };
          }
          statement.run(...(bindings as (string | number | null)[]));
          return {
            toArray: () => [] as T[],
            one: () => {
              throw new Error("no rows");
            },
          };
        },
      },
      transactionSync<T>(callback: () => T): T {
        return callback();
      },
    },
  };
}

function environment(adminToken?: string): GalleryEnv {
  const durable = new GalleryDO(sqliteState());
  return {
    GALLERY: {
      getByName: () => ({
        fetch: (input: string, init?: RequestInit) =>
          durable.fetch(new Request(input, init)),
      }),
    },
    ...(adminToken ? { GALLERY_ADMIN_TOKEN: adminToken } : {}),
  };
}

const ORIGIN = "https://gallery.test";
const ADMIN_TOKEN = "secret-token";

function submissionRequest(
  body: unknown,
  overrides: {
    ip?: string;
    origin?: string | null;
    token?: string | null;
    cookie?: string;
  } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (overrides.origin !== null) {
    headers.set("Origin", overrides.origin ?? ORIGIN);
  }
  if (overrides.token !== null) {
    headers.set("Authorization", `Bearer ${overrides.token ?? ADMIN_TOKEN}`);
  }
  if (overrides.cookie) headers.set("Cookie", overrides.cookie);
  headers.set("CF-Connecting-IP", overrides.ip ?? "203.0.113.7");
  return new Request(`${ORIGIN}/api/gallery/submissions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function projectText(name = "Fixture"): string {
  return serializeProject(createEmptyProject("gallery-fixture", name));
}

function previousVersionText(): string {
  const raw = JSON.parse(projectText()) as { schemaVersion: number };
  raw.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION - 1;
  return JSON.stringify(raw);
}

async function route(env: GalleryEnv, request: Request) {
  const response = await routeGalleryRequest(request, env);
  if (!response) throw new Error("gallery route did not match");
  return response;
}

function adminHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function submitOne(
  env: GalleryEnv,
  name: string,
  overrides: { ip?: string; text?: string } = {},
): Promise<string> {
  const response = await route(
    env,
    submissionRequest(
      {
        name,
        author: "tz",
        description: "d",
        projectText: overrides.text ?? projectText(name),
      },
      { ip: overrides.ip ?? "203.0.113.7" },
    ),
  );
  expect(response.status).toBe(201);
  const payload = (await response.json()) as { id: string };
  return payload.id;
}

describe("gallery submissions", () => {
  it("publishes immediately with canonical text and a server preview", async () => {
    const env = environment(ADMIN_TOKEN);
    const id = await submitOne(env, "Ring Oscillator");

    const list = await route(env, new Request(`${ORIGIN}/api/gallery`));
    const listed = (await list.json()) as {
      entries: { id: string; name: string; schemaVersion: number }[];
    };
    expect(listed.entries.map((entry) => entry.id)).toEqual([id]);
    expect(listed.entries[0]).toMatchObject({
      name: "Ring Oscillator",
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    });

    const detail = await route(env, new Request(`${ORIGIN}/api/gallery/${id}`));
    const payload = (await detail.json()) as { projectText: string };
    expect(JSON.parse(payload.projectText)).toMatchObject({
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      name: "Ring Oscillator",
    });

    const preview = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}/preview.svg`),
    );
    expect(preview.headers.get("content-type")).toBe("image/svg+xml");
    expect(await preview.text()).toContain("<svg");
  });

  it("upgrades a previous-schema submission through the protocol", async () => {
    const env = environment(ADMIN_TOKEN);
    const id = await submitOne(env, "Old Schema", {
      text: previousVersionText(),
    });
    const detail = await route(env, new Request(`${ORIGIN}/api/gallery/${id}`));
    const payload = (await detail.json()) as { projectText: string };
    expect(JSON.parse(payload.projectText).schemaVersion).toBe(
      CURRENT_PROJECT_SCHEMA_VERSION,
    );
  });

  it("refuses publishing without the admin bearer while sign-in is pending", async () => {
    const env = environment(ADMIN_TOKEN);
    const anonymous = await route(
      env,
      submissionRequest(
        { name: "X", projectText: projectText() },
        { token: null },
      ),
    );
    expect(anonymous.status).toBe(401);
    const wrongToken = await route(
      env,
      submissionRequest(
        { name: "X", projectText: projectText() },
        { token: "wrong" },
      ),
    );
    expect(wrongToken.status).toBe(401);
  });

  it("rejects invalid fields, foreign origins, oversized and invalid projects", async () => {
    const env = environment(ADMIN_TOKEN);
    const noName = await route(
      env,
      submissionRequest({ name: "  ", projectText: projectText() }),
    );
    expect(noName.status).toBe(400);

    const foreign = await route(
      env,
      submissionRequest(
        { name: "X", projectText: projectText() },
        { origin: "https://evil.example" },
      ),
    );
    expect(foreign.status).toBe(403);

    const oversized = await route(
      env,
      submissionRequest({
        name: "X",
        projectText: "x".repeat(GALLERY_MAX_PROJECT_BYTES + 1),
      }),
    );
    expect(oversized.status).toBe(413);

    const invalid = await route(
      env,
      submissionRequest({ name: "X", projectText: '{"schemaVersion":99}' }),
    );
    expect(invalid.status).toBe(400);
  });

  it("rate-limits one submitter per day without touching others", async () => {
    const env = environment(ADMIN_TOKEN);
    for (let index = 0; index < GALLERY_DAILY_SUBMISSION_LIMIT; index += 1) {
      await submitOne(env, `Entry ${index}`);
    }
    const overflow = await route(
      env,
      submissionRequest({ name: "One more", projectText: projectText() }),
    );
    expect(overflow.status).toBe(429);

    const other = await route(
      env,
      submissionRequest(
        { name: "Other submitter", projectText: projectText() },
        { ip: "198.51.100.2" },
      ),
    );
    expect(other.status).toBe(201);
  });
});

describe("gallery admin sessions (phase G2)", () => {
  async function sessionCookieFor(
    authDurable: AuthDO,
    email: string,
  ): Promise<string> {
    const sent: string[] = [];
    authDurable.fetchLike = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      void input;
      sent.push((JSON.parse(String(init?.body)) as { text: string }).text);
      return Response.json({ id: "email-1" });
    }) as typeof fetch;
    const start = await authDurable.fetch(
      new Request(`${ORIGIN}/api/auth/email/start`, {
        method: "POST",
        headers: { Origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );
    expect(start.status).toBe(202);
    const link = sent[0]!.match(/https?:\/\/\S+/u)![0];
    const callback = await authDurable.fetch(new Request(link));
    const header = callback.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("icm_session="));
    return header!.split(";")[0]!;
  }

  it("accepts an admin session in place of the bearer and refuses others", async () => {
    const authDurable = new AuthDO(sqliteState(), {
      RESEND_API_KEY: "rk",
      ADMIN_EMAILS: "owner@example.com",
    } as AuthEnv);
    const env: GalleryEnv = {
      ...environment(ADMIN_TOKEN),
      AUTH: {
        getByName: () => ({
          fetch: (input: Request | string, init?: RequestInit) =>
            authDurable.fetch(
              typeof input === "string" ? new Request(input, init) : input,
            ),
        }),
      },
    };

    const adminCookie = await sessionCookieFor(authDurable, "owner@example.com");
    const viaSession = await route(
      env,
      submissionRequest(
        { name: "Session Published", projectText: projectText() },
        { token: null, cookie: adminCookie },
      ),
    );
    expect(viaSession.status).toBe(201);

    const ordinaryCookie = await sessionCookieFor(
      authDurable,
      "visitor@example.com",
    );
    const viaOrdinary = await route(
      env,
      submissionRequest(
        { name: "Blocked", projectText: projectText() },
        { token: null, cookie: ordinaryCookie },
      ),
    );
    expect(viaOrdinary.status).toBe(401);

    const recycledList = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/recycled`, {
        headers: { Cookie: adminCookie },
      }),
    );
    expect(recycledList.status).toBe(200);
  });
});

describe("gallery administration", () => {
  it("requires the bearer secret for every admin operation", async () => {
    const env = environment(ADMIN_TOKEN);
    const id = await submitOne(env, "Guarded");

    const anonymous = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}/recycle`, { method: "POST" }),
    );
    expect(anonymous.status).toBe(401);

    const noTokenConfigured = environment();
    const impossible = await route(
      noTokenConfigured,
      new Request(`${ORIGIN}/api/gallery/some-id/recycle`, {
        method: "POST",
        headers: adminHeaders("anything"),
      }),
    );
    expect(impossible.status).toBe(401);
  });

  it("recycles, hides, restores, and only hard-deletes from the bin", async () => {
    const token = ADMIN_TOKEN;
    const env = environment(token);
    const id = await submitOne(env, "Lifecycle");

    const earlyDelete = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}`, {
        method: "DELETE",
        headers: adminHeaders(token),
      }),
    );
    expect(earlyDelete.status).toBe(409);

    const recycle = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}/recycle`, {
        method: "POST",
        headers: adminHeaders(token),
      }),
    );
    expect(recycle.status).toBe(200);

    const list = await route(env, new Request(`${ORIGIN}/api/gallery`));
    expect(((await list.json()) as { entries: unknown[] }).entries).toEqual([]);
    const hidden = await route(env, new Request(`${ORIGIN}/api/gallery/${id}`));
    expect(hidden.status).toBe(404);

    const bin = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/recycled`, {
        headers: adminHeaders(token),
      }),
    );
    const binned = (await bin.json()) as { entries: { id: string }[] };
    expect(binned.entries.map((entry) => entry.id)).toEqual([id]);

    const restore = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}/restore`, {
        method: "POST",
        headers: adminHeaders(token),
      }),
    );
    expect(restore.status).toBe(200);
    const back = await route(env, new Request(`${ORIGIN}/api/gallery`));
    expect(
      ((await back.json()) as { entries: { id: string }[] }).entries,
    ).toHaveLength(1);

    await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}/recycle`, {
        method: "POST",
        headers: adminHeaders(token),
      }),
    );
    const remove = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}`, {
        method: "DELETE",
        headers: adminHeaders(token),
      }),
    );
    expect(remove.status).toBe(200);
    const gone = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/recycled`, {
        headers: adminHeaders(token),
      }),
    );
    expect(((await gone.json()) as { entries: unknown[] }).entries).toEqual([]);
  });

  it("re-serializes stored entries back into the rolling window", async () => {
    const token = ADMIN_TOKEN;
    const env = environment(token);
    const id = await submitOne(env, "Aging Entry");

    // Age the stored record to the previous schema version through the
    // internal update operation, simulating a record left behind by time.
    await env.GALLERY.getByName("gallery").fetch(
      "https://gallery/update-entry",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          projectText: previousVersionText(),
          schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION - 1,
          svgText: "<svg/>",
        }),
      },
    );

    const maintenance = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/maintenance/reserialize`, {
        method: "POST",
        headers: adminHeaders(token),
      }),
    );
    const report = (await maintenance.json()) as {
      upgraded: number;
      failed: unknown[];
    };
    expect(report).toMatchObject({ upgraded: 1, failed: [] });

    const detail = await route(env, new Request(`${ORIGIN}/api/gallery/${id}`));
    const payload = (await detail.json()) as {
      entry: { schemaVersion: number };
      projectText: string;
    };
    expect(payload.entry.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
    expect(JSON.parse(payload.projectText).schemaVersion).toBe(
      CURRENT_PROJECT_SCHEMA_VERSION,
    );
    const preview = await route(
      env,
      new Request(`${ORIGIN}/api/gallery/${id}/preview.svg`),
    );
    expect(await preview.text()).toContain("<svg");
  });
});
