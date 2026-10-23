import {
  type HostedAgent,
  LocalAgentBridge,
} from "@tangent/local-agent-host/bridge.ts";
import { createFileTools } from "@tangent/local-agent-host/remoteFileTools.ts";
import { startScopedConnection } from "@tangent/local-agent-host/scopedConnection.ts";
import {
  normalizeShellUrl,
  sessionIdFromUrl,
} from "@tangent/local-agent-host/shellUrl.ts";
import { connectRemoteEnvironment } from "@tangent/remote-subagent";
import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";
import * as vscode from "vscode";

import type { OktaSsoAuthProvider } from "./auth/oktaSsoAuth.ts";
import { cookieAwareMint } from "./auth/remoteEnvTokenMint.ts";
import type { ExtensionConfig } from "./config.ts";
import { EarlyMessageBuffer } from "./earlyMessageBuffer.ts";
import { projectSelector } from "./projectSelector.ts";
import { askProxyApiKey, askShellUrl } from "./prompts.ts";
import { StatusView } from "./statusView.ts";
import { TangentClient } from "./tangentClient.ts";

interface MenuAction extends vscode.QuickPickItem {
  run(): unknown;
}

function runCommand(command: string): () => Thenable<unknown> {
  return () => vscode.commands.executeCommand(command);
}

function windowDescription(
  appName: string,
  windowName: string | undefined,
  workspacePath: string | undefined,
): string {
  const parts = [appName];
  if (windowName) parts.push(`— ${windowName}`);
  if (workspacePath) parts.push(`in ${workspacePath}`);
  return parts.join(" ");
}

/**
 * Socket.IO treats its URL as an origin and takes the path separately, so a
 * Shell mounted under a prefix must move that prefix into `socketPath`;
 * otherwise the `/remote-env` transport drops it and hits the host root.
 */
function shellSocketConfig(shellUrl: string): {
  socketUrl: string;
  socketPath: string;
} {
  const url = new URL(shellUrl);
  const prefix = url.pathname.replace(/\/+$/, "");
  return { socketUrl: url.origin, socketPath: `${prefix}/socket.io` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function describeDetail(value: unknown): string {
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * socket.io reports a failed handshake as the opaque `websocket error`; the
 * cause lives on `description` (an HTTP status or the underlying error) and
 * `context`. Surfacing both turns a dead-end log into one that names a login
 * redirect, a 401, or a wrong transport path.
 */
function connectErrorDetail(error: unknown): string {
  if (!isRecord(error)) return String(error);
  const parts: string[] = [];
  if (typeof error.message === "string") parts.push(error.message);
  if (error.description !== undefined) {
    parts.push(`description=${describeDetail(error.description)}`);
  }
  if (error.context !== undefined) {
    parts.push(`context=${describeDetail(error.context)}`);
  }
  return parts.join(" ");
}

/** Host identity this window advertises so a viewer knows which editor is connected. */
function windowMetadata(): Record<string, string> {
  const appName = vscode.env.appName;
  const windowName = vscode.workspace.name;
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const metadata: Record<string, string> = {
    editor: appName,
    capabilities:
      "runs local pi sub-agents that edit files + run the terminal in this workspace",
    description: windowDescription(appName, windowName, workspacePath),
  };
  if (windowName) metadata.windowName = windowName;
  if (workspacePath) metadata.workspacePath = workspacePath;
  return metadata;
}

/**
 * Owns the live connection to the Shell: the `/remote-env` bridge that hosts
 * local pi sub-agents and file tools, and the session REST client. The bridge is
 * scoped to one project at a time, so every session in that project can reach it;
 * a different window can serve a different project. The status bar reflects its
 * state.
 */
export class TangentController implements vscode.Disposable {
  private readonly config: ExtensionConfig;
  private readonly logChannel = vscode.window.createOutputChannel(
    "Tangent Local Agent",
  );
  private readonly status = new StatusView();
  private readonly attached = new vscode.EventEmitter<string>();
  readonly onDidAttach = this.attached.event;
  private bridge: LocalAgentBridge | undefined;
  private client: TangentClient | undefined;
  private connectedShellUrl: string | undefined;
  private stopConnection: (() => void) | undefined;
  private socketCookie: string | undefined;
  private readonly oktaSso: OktaSsoAuthProvider | undefined;
  private readonly earlyMessages = new EarlyMessageBuffer((line) =>
    this.log(line),
  );

  constructor(config: ExtensionConfig, oktaSso?: OktaSsoAuthProvider) {
    this.config = config;
    this.oktaSso = oktaSso;
    this.renderStatus();
  }

  get shellUrl(): string | undefined {
    return this.connectedShellUrl;
  }

  log(line: string): void {
    this.logChannel.appendLine(line);
  }

  autoConnect(): void {
    const url = this.config.shellUrl;
    if (!this.config.autoConnect || !url) return;
    this.start(url);
  }

  /** The setup flow: ask for the Shell URL, then connect. */
  async connect(prefillUrl?: string): Promise<void> {
    const input = await askShellUrl(
      prefillUrl ?? this.config.shellUrl ?? "http://localhost:5173",
    );
    if (!input) return;
    await this.finishConnect(input);
  }

  /** Connects to a deep link's Shell URL, already confirmed by the caller. */
  async connectFromLink(url: string): Promise<void> {
    await this.finishConnect(url);
  }

  private async finishConnect(input: string): Promise<void> {
    const url = normalizeShellUrl(input);
    await this.config.setShellUrl(url);
    const sessionId = sessionIdFromUrl(input);
    if (sessionId) await this.config.setActiveSessionId(sessionId);
    this.start(url);
  }

  disconnect(): void {
    this.teardownBridge();
    this.client = undefined;
    this.connectedShellUrl = undefined;
    this.renderStatus();
  }

  private teardownBridge(): void {
    this.stopConnection?.();
    this.stopConnection = undefined;
    this.bridge?.dispose();
    this.bridge = undefined;
    this.earlyMessages.reset();
  }

  async requireClient(): Promise<TangentClient | undefined> {
    if (!this.client) await this.connect();
    return this.client;
  }

  /**
   * Makes `sessionId` this window's active session for the chat panel, status
   * bar, and the Sessions tree marker. The remote-env host is project-scoped, so
   * this no longer reconnects the bridge — every session in the project is
   * already served by the one connection.
   */
  async attach(sessionId: string): Promise<void> {
    await this.config.setActiveSessionId(sessionId);
    this.renderStatus();
    this.attached.fire(sessionId);
  }

  /**
   * Rebinds the remote-env host to the current project, reconnecting the bridge
   * with a token minted for the new project's selector. Called when the window's
   * project changes; a window with no project tears the connection down.
   */
  reconnectForCurrentProject(): void {
    if (!this.connectedShellUrl) return;
    const project = this.config.currentProject;
    if (!project) {
      this.teardownBridge();
      this.renderStatus();
      return;
    }
    void this.connectProject(project.id);
  }

  async setPiProxyApiKey(): Promise<void> {
    const key = await askProxyApiKey();
    if (key) await this.config.setPiProxyApiKey(key);
  }

  async showMenu(): Promise<void> {
    const picked = await vscode.window.showQuickPick(this.menuActions(), {
      title: "Tangent Local Agent",
    });
    await picked?.run();
  }

  dispose(): void {
    this.disconnect();
    this.status.dispose();
    this.attached.dispose();
    this.logChannel.dispose();
  }

  private start(url: string): void {
    this.disconnect();
    this.connectedShellUrl = url;
    this.client = new TangentClient(url, this.oktaSso?.cookieProviderFor(url));
    const project = this.config.currentProject;
    if (project) void this.connectProject(project.id);
    this.renderStatus();
  }

  /**
   * (Re)connects the bridge scoped to `projectId`: a fresh bridge whose token the
   * gateway routes to every session tagged for the project, kept alive by
   * re-minting before the token expires. Replaces any previous project's
   * connection.
   */
  private async connectProject(projectId: string): Promise<void> {
    const url = this.connectedShellUrl;
    if (!url) return;
    const initialEnvironmentId = await this.config.environmentId(projectId);
    if (this.connectedShellUrl !== url) return;
    this.stopConnection?.();
    this.bridge?.dispose();
    const bridge = this.createBridge(url, projectId);
    this.bridge = bridge;
    this.stopConnection = startScopedConnection({
      shellUrl: url,
      selector: projectSelector(projectId),
      email: await this.resolveUserEmail(url),
      initialEnvironmentId,
      ...this.scopedMint(url),
      connect: (token, environmentId) =>
        void this.connectBridge(bridge, url, token, environmentId),
      onError: (message) => {
        this.log(`remote-env token: ${message}`);
        this.renderStatus();
      },
    });
    this.renderStatus();
  }

  /**
   * Refreshes the SSO cookie the socket handshake carries, then (re)connects the
   * bridge. Node's socket.io does not send cookies on its own, so without this
   * the `/remote-env` WebSocket upgrade reaches the SSO gate unauthenticated and
   * fails as an opaque `websocket error`, even though the REST and mint paths —
   * which set `Cookie` themselves — succeed.
   */
  private async connectBridge(
    bridge: LocalAgentBridge,
    url: string,
    token: string,
    environmentId: string,
  ): Promise<void> {
    this.socketCookie = this.oktaSso
      ? await this.oktaSso.cookieProviderFor(url)()
      : undefined;
    bridge.connect(token, environmentId);
  }

  /**
   * The identity this window mints as: the real OktaSSO user when the gate is
   * on, otherwise the configured dev identity.
   */
  async resolveUserEmail(audienceUrl: string): Promise<string> {
    const okta = this.oktaSso
      ? await this.oktaSso.getAuthenticatedEmail(audienceUrl)
      : undefined;
    return okta ?? this.config.userEmail;
  }

  /** The SSO-cookie mint for this Shell, or nothing when the gate is off. */
  private scopedMint(url: string): {
    mint?: ReturnType<typeof cookieAwareMint>;
  } {
    const cookieProvider = this.oktaSso?.cookieProviderFor(url);
    return cookieProvider ? { mint: cookieAwareMint(cookieProvider) } : {};
  }

  private createBridge(url: string, projectId: string): LocalAgentBridge {
    const metadata = windowMetadata();
    const { socketUrl, socketPath } = shellSocketConfig(url);
    return new LocalAgentBridge(
      {
        url: socketUrl,
        selector: projectSelector(projectId),
        tools: createFileTools(
          () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        ),
        piLaunchOptions: () => this.config.piLaunchOptions(),
        log: (line) => this.log(line),
        onChange: () => this.renderStatus(),
        onSpawned: (agent) => void this.notifySpawned(agent),
      },
      // The bridge's connect factory is the only seam to advertise this window's
      // identity, pin the mounted-prefix transport path, and carry the SSO cookie
      // that Node's socket.io does not send on the WebSocket handshake.
      (options) => this.openRemoteEnv(options, metadata, socketPath),
    );
  }

  private openRemoteEnv(
    options: Parameters<typeof connectRemoteEnvironment>[0],
    metadata: Record<string, string>,
    socketPath: string,
  ): ReturnType<typeof connectRemoteEnvironment> {
    const client = connectRemoteEnvironment(
      {
        ...options,
        handlers: this.earlyMessages.wrap(options.handlers),
        socketPath,
        metadata,
      },
      (uri, opts) => io(uri, this.withCookie(opts)),
    );
    this.watchSocket(client.socket);
    return client;
  }

  private withCookie(
    opts: Partial<ManagerOptions & SocketOptions>,
  ): Partial<ManagerOptions & SocketOptions> {
    if (!this.socketCookie) return opts;
    return {
      ...opts,
      extraHeaders: { ...opts.extraHeaders, Cookie: this.socketCookie },
    };
  }

  private watchSocket(socket: Socket): void {
    socket.on("connect_error", (error: Error) => {
      const transport = socket.io.engine?.transport?.name ?? "unknown";
      const cookie = this.socketCookie ? "yes" : "no";
      this.log(
        `remote-env connect_error (transport=${transport}, cookie=${cookie}): ${connectErrorDetail(error)}`,
      );
    });
  }

  private async notifySpawned(agent: HostedAgent): Promise<void> {
    this.earlyMessages.markReady(agent.agentId);
    const choice = await vscode.window.showInformationMessage(
      `Tangent started local sub-agent "${agent.name}".`,
      "Stop",
      "Show Log",
    );
    if (choice === "Stop") this.bridge?.stopAgent(agent.agentId);
    if (choice === "Show Log") this.logChannel.show(true);
  }

  private menuActions(): MenuAction[] {
    if (!this.bridge) {
      return [
        { label: "$(plug) Connect Local Agent", run: () => this.connect() },
        { label: "$(gear) Settings", run: () => this.openSettings() },
      ];
    }
    const agents = this.bridge.listAgents().map((agent) => ({
      label: `$(debug-stop) Stop "${agent.name}"`,
      run: () => this.bridge?.stopAgent(agent.agentId),
    }));
    return [
      { label: "$(add) New Session", run: runCommand("tangle.newSession") },
      {
        label: "$(link) Attach to Session",
        run: runCommand("tangent.attachSession"),
      },
      ...agents,
      { label: "$(output) Show Log", run: () => this.logChannel.show() },
      { label: "$(debug-disconnect) Disconnect", run: () => this.disconnect() },
    ];
  }

  private openSettings(): Thenable<unknown> {
    return vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:tangent.tangent-local-agent",
    );
  }

  private renderStatus(): void {
    this.status.render({
      bridge: this.bridge,
      shellUrl: this.connectedShellUrl,
      project: this.config.currentProject?.name,
      sessionId: this.config.activeSessionId,
    });
  }
}
