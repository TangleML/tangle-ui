import { hostname } from "node:os";
import { fileURLToPath } from "node:url";

import { LocalAgentBridge } from "@tangent/local-agent-host/bridge.ts";
import type { PiLaunchOptions } from "@tangent/local-agent-host/piAdapter.ts";
import { mintRemoteEnvToken } from "@tangent/local-agent-host/remoteEnvToken.ts";
import { createFileTools } from "@tangent/local-agent-host/remoteFileTools.ts";
import { startTokenRefresh } from "@tangent/local-agent-host/tokenRefresh.ts";

import { authFetch, peekCookie } from "./auth.ts";
import { projectSelectorTag } from "./shellClient.ts";

export interface LocalAgentHostOptions {
  shellUrl: string;
  projectId: string;
  cwd: string;
  email?: string;
  log: (line: string) => void;
  onChange?: () => void;
  onSpawned?: (name: string) => void;
}

export interface LocalAgentHostHandle {
  bridge: LocalAgentBridge;
  stop: () => void;
}

/** The pi extension pi loads from disk at spawn time, resolved from the package. */
function resourcePath(name: string): string {
  return fileURLToPath(
    import.meta.resolve(`@tangent/local-agent-host/resources/${name}`),
  );
}

function socketTargetOf(shellUrl: string): { url: string; socketPath: string } {
  const url = new URL(shellUrl);
  const mount = url.pathname.replace(/\/+$/, "");
  return { url: url.origin, socketPath: `${mount}/socket.io` };
}

function hostMetadata(cwd: string): Record<string, string> {
  return {
    editor: "tangent-tui",
    workspacePath: cwd,
    description: `Tangent TUI on ${hostname()}, working in ${cwd}.`,
    capabilities:
      "Runs local pi sub-agents that read, edit, and run commands in this workspace.",
  };
}

/**
 * Connects a {@link LocalAgentBridge} scoped to the project, so Prime can spawn
 * local pi sub-agents and read files in `cwd` for any session tagged for the
 * project. Mirrors the VS Code extension's controller and the headless
 * local-agent-cli: self-mint a scoped token, carry the SSO cookie on the socket
 * handshake, and re-mint before it expires. The token's owner must be the same
 * `email` the chat socket presents, since the Shell only offers a host's tools
 * to prompts from its owner.
 */
export async function startLocalAgentHost(
  options: LocalAgentHostOptions,
): Promise<LocalAgentHostHandle> {
  const selector = projectSelectorTag(options.projectId);
  const { url, socketPath } = socketTargetOf(options.shellUrl);
  const fetchImpl = authFetch(options.shellUrl);
  const launch: PiLaunchOptions & { cwd: string } = {
    bin: process.env.TANGENT_PI_BIN ?? "pi",
    cwd: options.cwd,
    proxyExtensionPath: resourcePath("proxyProvider.ts"),
    sessionResourceExtensionPath: resourcePath("sessionResources.ts"),
  };

  let cookie = await peekCookie(options.shellUrl);
  const bridge = new LocalAgentBridge({
    url,
    socketPath,
    selector,
    metadata: hostMetadata(options.cwd),
    extraHeaders: () => (cookie ? { cookie } : undefined),
    tools: createFileTools(() => options.cwd),
    piLaunchOptions: () => Promise.resolve(launch),
    log: options.log,
    onChange: () => options.onChange?.(),
    onSpawned: (agent) => options.onSpawned?.(agent.name),
  });

  const minted = await mintRemoteEnvToken({
    shellUrl: options.shellUrl,
    selector,
    email: options.email,
    fetchImpl,
  });
  cookie = (await peekCookie(options.shellUrl)) ?? cookie;
  bridge.connect(minted.token, minted.environmentId);

  const stopRefresh = startTokenRefresh(
    {
      mintParams: {
        shellUrl: options.shellUrl,
        selector,
        email: options.email,
        environmentId: minted.environmentId,
        fetchImpl,
      },
      applyToken: async (token) => {
        cookie = (await peekCookie(options.shellUrl)) ?? cookie;
        bridge.connect(token, minted.environmentId);
      },
      log: options.log,
    },
    minted.expiresAtMs,
  );

  return {
    bridge,
    stop: () => {
      stopRefresh();
      bridge.dispose();
    },
  };
}
