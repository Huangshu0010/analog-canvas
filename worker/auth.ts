export * from "./auth-do";
import type { AuthEnv, SessionUser } from "./auth-do";

/**
 * Resolve the signed-in user (with the per-request admin flag) for another
 * worker module, from the incoming request's cookies. Null when the auth
 * binding is absent, the session is missing, or anything fails.
 */
export async function sessionUserOf(
  request: Request,
  env: Partial<AuthEnv>,
): Promise<SessionUser | null> {
  if (!env.AUTH) return null;
  try {
    const response = await env.AUTH.getByName("auth").fetch(
      "https://auth/internal/session-user",
      { headers: { cookie: request.headers.get("Cookie") ?? "" } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { user?: SessionUser | null };
    return payload.user ?? null;
  } catch {
    return null;
  }
}

/**
 * All `/api/auth/*` routing: forwarded verbatim to the AuthDO singleton.
 * Returns null for unrelated paths.
 */
export async function routeAuthRequest(
  request: Request,
  env: AuthEnv,
): Promise<Response | null> {
  if (!new URL(request.url).pathname.startsWith("/api/auth/")) return null;
  return env.AUTH.getByName("auth").fetch(request);
}
