import { normalizeShellUrl } from "@tangent/local-agent-host/shellUrl.ts";
import * as vscode from "vscode";

import type { TangentBundle } from "./tangentClient.ts";
import { normalizeBaseUrl } from "./tangleRestClient.ts";

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function showError(err: unknown): void {
  void vscode.window.showErrorMessage(errorMessage(err));
}

export async function confirmConnectLink(
  shellOrigin: string | undefined,
  apiOrigin: string | undefined,
): Promise<boolean> {
  const targets = [
    shellOrigin ? `Shell: ${shellOrigin}` : "",
    apiOrigin ? `Tangle API: ${apiOrigin}` : "",
  ].filter(Boolean);
  const choice = await vscode.window.showWarningMessage(
    "Connect this editor to a Tangent Shell from a link?",
    {
      modal: true,
      detail: `A link wants this window to connect to:\n${targets.join(
        "\n",
      )}\n\nLocal sub-agents from this Shell can edit files and run the terminal in this workspace, and the saved Tangle API token is sent to the API host.`,
    },
    "Connect",
  );
  return choice === "Connect";
}

export function askShellUrl(value: string): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "Tangent Shell URL",
    prompt: "The Shell to connect to. A session URL also attaches to it.",
    value,
    ignoreFocusOut: true,
    validateInput: (input) => {
      try {
        normalizeShellUrl(input);
        return undefined;
      } catch (err) {
        return errorMessage(err);
      }
    },
  });
}

export function askSessionRef(
  value: string | undefined,
): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "Attach to Tangent session",
    prompt: "Paste a session URL or id.",
    value,
    ignoreFocusOut: true,
  });
}

export function askSessionName(): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "Session name (optional)",
    ignoreFocusOut: true,
  });
}

export function askNewSessionName(value: string): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "Rename session",
    value,
    ignoreFocusOut: true,
    validateInput: (input) =>
      input.trim() ? undefined : "The name cannot be empty.",
  });
}

export async function confirmDetachSession(name: string): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    `Remove "${name}" from this project?`,
    {
      modal: true,
      detail: "The session itself stays on the Tangent Shell.",
    },
    "Remove",
  );
  return choice === "Remove";
}

export function askProxyApiKey(): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "Pi proxy API key",
    prompt: "Used by local pi sub-agents when tangent.piProxyUrl is set.",
    password: true,
    ignoreFocusOut: true,
  });
}

export function askTangleApiUrl(value: string): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: "Tangle API URL",
    prompt: "Base URL of the Tangle backend, e.g. http://localhost:8000.",
    value,
    ignoreFocusOut: true,
    validateInput: (input) => {
      try {
        normalizeBaseUrl(input);
        return undefined;
      } catch (err) {
        return errorMessage(err);
      }
    },
  });
}

/** Asks for the backend token; an empty answer keeps `existing`. */
export async function askTangleApiToken(
  existing: string | undefined,
): Promise<string | undefined> {
  const input = await vscode.window.showInputBox({
    title: "Tangle API token (optional)",
    prompt: existing
      ? "Bearer token for the Tangle backend. Leave empty to keep the saved one."
      : "Bearer token for the Tangle backend. Leave empty if it needs none.",
    password: true,
    ignoreFocusOut: true,
  });
  if (input === undefined) return undefined;
  return input.trim() || existing;
}

export async function pickBundle(
  bundles: TangentBundle[],
): Promise<string | undefined> {
  if (bundles.length === 0) {
    void vscode.window.showWarningMessage(
      "The Shell has no agent bundles to start a session from.",
    );
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    bundles.map((bundle) => ({
      label: bundle.name,
      description: bundle.version,
      detail: bundle.description,
      id: bundle.id,
    })),
    { title: "Start a session from which agent bundle?" },
  );
  return picked?.id;
}
