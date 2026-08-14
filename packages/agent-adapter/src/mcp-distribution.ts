import distribution from "../../../config/agent-mcp-distribution.json" with { type: "json" };

export const AGENT_MCP_BOOTSTRAP_FORMAT = "analog-canvas-mcp-bootstrap-v1";

export interface AgentMcpBootstrapManifest {
  format: typeof AGENT_MCP_BOOTSTRAP_FORMAT;
  name: string;
  version: string;
  transport: "stdio";
  requirements: { node: string };
  launch: {
    command: "npx";
    args: readonly string[];
  };
  hosts: {
    codex: { command: string };
    claudeCode: { command: string; windowsCommand: string };
    cursor: {
      config: {
        mcpServers: Record<
          string,
          { command: string; args: readonly string[] }
        >;
      };
    };
  };
  distribution: {
    packageName: string;
    npmPublished: boolean;
    downloadUrl: string;
    sha256: string;
  };
  documentationUrl: string;
  fallback: {
    kitUrl: string;
    openApiUrl: string;
  };
}

export function agentMcpBootstrapManifest(
  publicOrigin: string,
): AgentMcpBootstrapManifest {
  const origin = publicOrigin.replace(/\/$/u, "");
  const releaseBase = `https://github.com/${distribution.release.repository}/releases/download/${distribution.release.tag}`;
  const downloadUrl = `${releaseBase}/${distribution.release.asset}`;
  const packageSpec = distribution.npmPublished
    ? `${distribution.packageName}@${distribution.version}`
    : downloadUrl;
  const launchArgs = distribution.npmPublished
    ? ["--yes", packageSpec]
    : ["--yes", `--package=${packageSpec}`, distribution.binaryName];
  const launchText = ["npx", ...launchArgs].join(" ");

  return {
    format: AGENT_MCP_BOOTSTRAP_FORMAT,
    name: distribution.name,
    version: distribution.version,
    transport: "stdio",
    requirements: { node: distribution.node },
    launch: { command: "npx", args: launchArgs },
    hosts: {
      codex: {
        command: `codex mcp add ${distribution.name} -- ${launchText}`,
      },
      claudeCode: {
        command: `claude mcp add ${distribution.name} --scope user -- ${launchText}`,
        windowsCommand: `claude mcp add ${distribution.name} --scope user -- cmd /c ${launchText}`,
      },
      cursor: {
        config: {
          mcpServers: {
            [distribution.name]: {
              command: "npx",
              args: launchArgs,
            },
          },
        },
      },
    },
    distribution: {
      packageName: distribution.packageName,
      npmPublished: distribution.npmPublished,
      downloadUrl,
      sha256: distribution.release.sha256,
    },
    documentationUrl: `https://github.com/${distribution.release.repository}/blob/main/docs/agent/mcp-install.md`,
    fallback: {
      kitUrl: `${origin}/api/agent/kit`,
      openApiUrl: `${origin}/api/agent/openapi.json`,
    },
  };
}
