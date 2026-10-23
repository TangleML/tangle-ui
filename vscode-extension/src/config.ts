import { randomUUID } from "node:crypto";

import type { PiLaunchOptions } from "@tangent/local-agent-host/piAdapter.ts";
import { DEFAULT_USER } from "@tangent/shared/contracts.ts";
import * as vscode from "vscode";

const SECTION = "tangent";
const PROXY_KEY_SECRET = "tangent.piProxyApiKey";
const TANGLE_API_TOKEN_SECRET = "tangent.tangleApiToken";
const DEFAULT_TANGLE_API_URL = "http://localhost:8000";
const DEFAULT_TANGLE_UI_URL = "http://localhost:3000";
const HOST_ID_KEY = "tangent.hostId";
const ACTIVE_SESSION_KEY = "tangent.activeSessionId";
const CURRENT_PROJECT_KEY = "tangle.currentProject";

export interface CurrentProject {
  id: string;
  name: string;
}

function stringSetting(key: string): string | undefined {
  const value = vscode.workspace
    .getConfiguration(SECTION)
    .get<string>(key)
    ?.trim();
  return value || undefined;
}

/**
 * Settings, secrets, and per-workspace identity for the extension. The host id
 * and active session live in workspace state, so each VS Code window is its own
 * stable remote environment rather than several windows fighting over one id.
 */
export class ExtensionConfig {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  get shellUrl(): string | undefined {
    return stringSetting("shellUrl");
  }

  async setShellUrl(url: string): Promise<void> {
    await vscode.workspace
      .getConfiguration(SECTION)
      .update("shellUrl", url, vscode.ConfigurationTarget.Global);
  }

  get autoConnect(): boolean {
    return (
      vscode.workspace.getConfiguration(SECTION).get<boolean>("autoConnect") ??
      true
    );
  }

  get defaultBundleId(): string | undefined {
    return stringSetting("defaultBundleId");
  }

  /**
   * The identity this window mints scoped `/remote-env` tokens as. The Shell
   * routes a session's spawns and tool calls to the prompting person's hosts,
   * so this must match the email you chat as; defaults to the dev identity.
   */
  get userEmail(): string {
    return stringSetting("userEmail") ?? DEFAULT_USER.email;
  }

  async setPiProxyApiKey(key: string): Promise<void> {
    await this.context.secrets.store(PROXY_KEY_SECRET, key);
  }

  get tangleApiUrl(): string {
    return stringSetting("tangleApiUrl") ?? DEFAULT_TANGLE_API_URL;
  }

  async setTangleApiUrl(url: string): Promise<void> {
    await vscode.workspace
      .getConfiguration(SECTION)
      .update("tangleApiUrl", url, vscode.ConfigurationTarget.Global);
  }

  get tangleUiUrl(): string {
    return (stringSetting("tangleUiUrl") ?? DEFAULT_TANGLE_UI_URL).replace(
      /\/+$/,
      "",
    );
  }

  get tangleDeployBin(): string {
    return stringSetting("tangleDeployBin") ?? "tangle-deploy";
  }

  get updateBaseUrl(): string {
    return (stringSetting("updateBaseUrl") ?? this.tangleUiUrl).replace(
      /\/+$/,
      "",
    );
  }

  get autoCheckUpdates(): boolean {
    return (
      vscode.workspace
        .getConfiguration(SECTION)
        .get<boolean>("autoCheckUpdates") ?? true
    );
  }

  async tangleApiToken(): Promise<string | undefined> {
    return this.context.secrets.get(TANGLE_API_TOKEN_SECRET);
  }

  async setTangleApiToken(token: string): Promise<void> {
    await this.context.secrets.store(TANGLE_API_TOKEN_SECRET, token);
  }

  get activeSessionId(): string | undefined {
    return this.context.workspaceState.get<string>(ACTIVE_SESSION_KEY);
  }

  async setActiveSessionId(sessionId: string): Promise<void> {
    await this.context.workspaceState.update(ACTIVE_SESSION_KEY, sessionId);
  }

  get currentProject(): CurrentProject | undefined {
    return this.context.workspaceState.get<CurrentProject>(CURRENT_PROJECT_KEY);
  }

  async setCurrentProject(project: CurrentProject): Promise<void> {
    await this.context.workspaceState.update(CURRENT_PROJECT_KEY, project);
  }

  /**
   * The id this window asks to keep across token refreshes, so a refresh reuses
   * the same scoped host instead of connecting as a new environment. The Shell
   * honors the pin when it is free, so the minted id is authoritative. The
   * project is part of the id so switching projects connects as a distinct
   * environment — the gateway drops the old one cleanly rather than overwriting
   * its selector in place.
   */
  async environmentId(projectId: string): Promise<string> {
    return `vscode-${await this.hostId()}-${projectId}`;
  }

  /** How local pi sub-agents are launched, resolved fresh for each spawn. */
  async piLaunchOptions(): Promise<PiLaunchOptions> {
    const proxyUrl = stringSetting("piProxyUrl");
    const proxyApiKey =
      (await this.context.secrets.get(PROXY_KEY_SECRET)) ??
      process.env.PI_PROXY_API_KEY;
    return {
      bin: stringSetting("piBin") ?? "pi",
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      model: stringSetting("piModel"),
      proxyUrl,
      proxyApiKey: proxyUrl ? proxyApiKey : undefined,
      proxyExtensionPath: vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "proxyProvider.ts",
      ).fsPath,
      sessionResourceExtensionPath: vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "sessionResources.ts",
      ).fsPath,
    };
  }

  private async hostId(): Promise<string> {
    const existing = this.context.workspaceState.get<string>(HOST_ID_KEY);
    if (existing) return existing;
    const created = randomUUID();
    await this.context.workspaceState.update(HOST_ID_KEY, created);
    return created;
  }
}
