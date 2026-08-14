import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Locally stored pairing state for the MCP adapter (design milestone M1).
 *
 * This is a local convenience resume record, not a server-issued persistent
 * credential: it keeps the redeemed bearer so an MCP restart can resume while
 * the token and session are still valid. Server-issued connector credentials
 * with web-side revoke UI remain milestone M4. The token is a secret: it is
 * written to a user-level file and must never be surfaced through tool
 * results, resources, or logs.
 */
export interface StoredConnectorCredential {
  version: 1;
  apiBaseUrl: string;
  sessionId: string;
  agentToken: string;
  tokenExpiresAt: number;
  scopes: string[];
  projectId: string;
  documentIds: string[];
  storedAt: number;
}

export const CREDENTIAL_FILE_VERSION = 1;

export interface CredentialStoreOptions {
  filePath: string;
}

export class CredentialStore {
  private readonly filePath: string;

  constructor(options: CredentialStoreOptions) {
    this.filePath = options.filePath;
  }

  get path(): string {
    return this.filePath;
  }

  async load(): Promise<StoredConnectorCredential | null> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as StoredConnectorCredential;
      if (
        parsed?.version !== CREDENTIAL_FILE_VERSION ||
        typeof parsed.apiBaseUrl !== "string" ||
        typeof parsed.sessionId !== "string" ||
        typeof parsed.agentToken !== "string" ||
        typeof parsed.tokenExpiresAt !== "number" ||
        !Array.isArray(parsed.scopes) ||
        typeof parsed.projectId !== "string" ||
        !Array.isArray(parsed.documentIds)
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async save(credential: StoredConnectorCredential): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(credential, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    // Windows ignores the file mode above; chmod is best-effort everywhere.
    await chmod(this.filePath, 0o600).catch(() => undefined);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

export function defaultCredentialFilePath(
  home: string,
  env: Record<string, string | undefined>,
): string {
  const override = env.ANALOG_CANVAS_MCP_CREDENTIALS;
  if (override && override.trim().length > 0) return override;
  return join(home, ".analog-canvas", "connector.json");
}
