import type { LocalAgentBridge } from "@tangent/local-agent-host/bridge.ts";
import * as vscode from "vscode";

export interface StatusSnapshot {
  bridge: LocalAgentBridge | undefined;
  shellUrl: string | undefined;
  project: string | undefined;
  sessionId: string | undefined;
}

function statusText(bridge: LocalAgentBridge | undefined): string {
  if (!bridge || bridge.state === "disconnected") {
    return "$(debug-disconnect) Tangent";
  }
  if (bridge.state === "connecting") return "$(sync~spin) Tangent";
  const count = bridge.listAgents().length;
  return count > 0
    ? `$(radio-tower) Tangent · ${count}`
    : "$(radio-tower) Tangent";
}

function statusTooltip({
  bridge,
  shellUrl,
  project,
  sessionId,
}: StatusSnapshot): string {
  if (!bridge) return "Not connected — click to connect.";
  return [
    `Shell: ${shellUrl}`,
    project ? `Project: ${project}` : "",
    bridge.environmentId ? `Environment: ${bridge.environmentId}` : "",
    sessionId ? `Session: ${sessionId}` : "",
    bridge.lastError ? `Last error: ${bridge.lastError}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The status bar item: connection state and live sub-agent count; click for the menu. */
export class StatusView implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );

  constructor() {
    this.item.command = "tangent.showMenu";
    this.item.show();
  }

  render(snapshot: StatusSnapshot): void {
    this.item.text = statusText(snapshot.bridge);
    this.item.tooltip = statusTooltip(snapshot);
  }

  dispose(): void {
    this.item.dispose();
  }
}
