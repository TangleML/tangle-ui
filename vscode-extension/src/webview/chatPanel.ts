import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import {
  type ColorScheme,
  type ThemeMessage,
  webviewToHostMessage,
} from "./chatConfig.ts";
import { chatPageHtml } from "./chatHtml.ts";
import { EmbedProxy, type ProxyCookieProvider } from "./embedProxy.ts";

const VIEW_TYPE = "tangent.sessionChat";

export interface ChatSession {
  sessionId: string;
  name: string;
}

function colorSchemeFor(theme: vscode.ColorTheme): ColorScheme {
  const light =
    theme.kind === vscode.ColorThemeKind.Light ||
    theme.kind === vscode.ColorThemeKind.HighContrastLight;
  return light ? "light" : "dark";
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export type CookieHeaderFor = (
  shellUrl: string,
  options?: { forceRefresh?: boolean },
) => Promise<string | undefined>;

/**
 * One chat panel per Tangent session, each rendering the embedded Tangent chat.
 * The embed talks to the Shell through a loopback {@link EmbedProxy}, started
 * once per Shell URL and shared by its panels.
 */
export class SessionChatPanels implements vscode.Disposable {
  private readonly extensionUri: vscode.Uri;
  private readonly log: (line: string) => void;
  private readonly cookieHeaderFor: CookieHeaderFor | undefined;
  private readonly panels = new Map<string, vscode.WebviewPanel>();
  private readonly proxies = new Map<string, Promise<EmbedProxy>>();
  private readonly themeListener: vscode.Disposable;

  constructor(
    extensionUri: vscode.Uri,
    log: (line: string) => void,
    cookieHeaderFor?: CookieHeaderFor,
  ) {
    this.extensionUri = extensionUri;
    this.log = log;
    this.cookieHeaderFor = cookieHeaderFor;
    this.themeListener = vscode.window.onDidChangeActiveColorTheme((theme) =>
      this.broadcastTheme(colorSchemeFor(theme)),
    );
  }

  async open(
    shellUrl: string,
    session: ChatSession,
    authToken: string,
  ): Promise<void> {
    const existing = this.panels.get(session.sessionId);
    if (existing) {
      existing.reveal();
      return;
    }
    const proxy = await this.proxyFor(shellUrl);
    const panel = this.createPanel(session, proxy, authToken);
    this.panels.set(session.sessionId, panel);
    panel.onDidDispose(() => this.panels.delete(session.sessionId));
  }

  rename(sessionId: string, name: string): void {
    const panel = this.panels.get(sessionId);
    if (panel) panel.title = name;
  }

  close(sessionId: string): void {
    this.panels.get(sessionId)?.dispose();
  }

  dispose(): void {
    for (const panel of this.panels.values()) panel.dispose();
    this.themeListener.dispose();
    for (const proxy of this.proxies.values()) {
      void proxy.then((started) => started.dispose()).catch(() => undefined);
    }
    this.proxies.clear();
  }

  private proxyFor(shellUrl: string): Promise<EmbedProxy> {
    const existing = this.proxies.get(shellUrl);
    if (existing) return existing;
    const started = this.startProxy(shellUrl);
    started.catch(() => this.proxies.delete(shellUrl));
    this.proxies.set(shellUrl, started);
    return started;
  }

  private async startProxy(shellUrl: string): Promise<EmbedProxy> {
    return EmbedProxy.start(shellUrl, {
      log: this.log,
      cookieProvider: this.cookieProviderFor(shellUrl),
    });
  }

  private cookieProviderFor(shellUrl: string): ProxyCookieProvider | undefined {
    const cookieHeaderFor = this.cookieHeaderFor;
    if (!cookieHeaderFor) return undefined;
    return (options) => cookieHeaderFor(shellUrl, options);
  }

  private createPanel(
    session: ChatSession,
    proxy: EmbedProxy,
    authToken: string,
  ): vscode.WebviewPanel {
    const distUri = vscode.Uri.joinPath(this.extensionUri, "dist");
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      session.name,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [distUri],
        portMapping: [
          { webviewPort: proxy.port, extensionHostPort: proxy.port },
        ],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      "resources",
      "tangle.svg",
    );
    const { webview } = panel;
    webview.html = chatPageHtml({
      cspSource: webview.cspSource,
      scriptUri: webview
        .asWebviewUri(vscode.Uri.joinPath(distUri, "chat.js"))
        .toString(),
      nonce: randomBytes(16).toString("base64"),
      embedOrigin: proxy.origin,
      config: {
        embedBaseUrl: proxy.baseUrl,
        sessionId: session.sessionId,
        colorScheme: colorSchemeFor(vscode.window.activeColorTheme),
        authToken,
      },
    });
    webview.onDidReceiveMessage((message) => this.onMessage(proxy, message));
    return panel;
  }

  private onMessage(proxy: EmbedProxy, message: unknown): void {
    const parsed = webviewToHostMessage.safeParse(message);
    if (!parsed.success) return;
    const data = parsed.data;
    if (data.type === "error") {
      this.log(`chat: ${data.message}`);
      void vscode.window.showErrorMessage(data.message);
      return;
    }
    const url = proxy.toTargetUrl(data.url);
    if (isWebUrl(url)) void vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private broadcastTheme(colorScheme: ColorScheme): void {
    const message: ThemeMessage = { type: "theme", colorScheme };
    for (const panel of this.panels.values()) {
      void panel.webview.postMessage(message);
    }
  }
}
