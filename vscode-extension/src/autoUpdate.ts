import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import * as vscode from "vscode";

import type { ExtensionConfig } from "./config.ts";
import { errorMessage } from "./prompts.ts";
import {
  type ExtensionManifest,
  isExtensionManifest,
  isNewerVersion,
  isTrustedUpdateUrl,
  manifestUrl,
  resolveVsixUrl,
} from "./updateManifest.ts";

const SKIPPED_VERSION_KEY = "tangent.skippedUpdateVersion";
const STARTUP_CHECK_DELAY_MS = 5000;

function currentVersion(context: vscode.ExtensionContext): string {
  const version: unknown = context.extension.packageJSON?.version;
  return typeof version === "string" ? version : "0.0.0";
}

async function fetchManifest(baseUrl: string): Promise<ExtensionManifest> {
  const url = manifestUrl(baseUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `The update server returned ${response.status} for ${url}.`,
    );
  }
  const data: unknown = await response.json().catch(() => undefined);
  if (!isExtensionManifest(data)) {
    throw new Error(`The update manifest at ${url} was not readable.`);
  }
  return data;
}

async function downloadVsix(url: string): Promise<vscode.Uri> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Could not download the extension: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dir = await mkdtemp(path.join(tmpdir(), "tangent-local-agent-"));
  const file = vscode.Uri.file(path.join(dir, "tangent-local-agent.vsix"));
  await vscode.workspace.fs.writeFile(file, bytes);
  return file;
}

async function installUpdate(
  manifest: ExtensionManifest,
  baseUrl: string,
): Promise<void> {
  const vsixUrl = resolveVsixUrl(baseUrl, manifest.url);
  if (!isTrustedUpdateUrl(vsixUrl)) {
    throw new Error(
      "Refusing to install an update over an insecure connection. Set tangent.updateBaseUrl to an https:// URL.",
    );
  }
  const vsixUri = await downloadVsix(vsixUrl);
  try {
    await vscode.commands.executeCommand(
      "workbench.extensions.installExtension",
      vsixUri,
    );
  } finally {
    await rm(path.dirname(vsixUri.fsPath), { recursive: true, force: true });
  }

  const reload = await vscode.window.showInformationMessage(
    `Tangent Local Agent ${manifest.version} installed.`,
    "Reload Window",
  );
  if (reload === "Reload Window") {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}

async function loadManifest(
  baseUrl: string,
  interactive: boolean,
): Promise<ExtensionManifest | null> {
  try {
    return await fetchManifest(baseUrl);
  } catch (err) {
    if (interactive) {
      vscode.window.showErrorMessage(
        `Could not check for updates: ${errorMessage(err)}`,
      );
    }
    return null;
  }
}

function isSkipped(
  context: vscode.ExtensionContext,
  interactive: boolean,
  version: string,
): boolean {
  return (
    !interactive &&
    context.globalState.get<string>(SKIPPED_VERSION_KEY) === version
  );
}

async function offerUpdate(
  context: vscode.ExtensionContext,
  config: ExtensionConfig,
  manifest: ExtensionManifest,
  current: string,
): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    `Tangent Local Agent ${manifest.version} is available (you have ${current}).`,
    "Update",
    "Skip This Version",
  );
  if (choice === "Update") {
    try {
      await installUpdate(manifest, config.updateBaseUrl);
    } catch (err) {
      vscode.window.showErrorMessage(`Update failed: ${errorMessage(err)}`);
    }
  } else if (choice === "Skip This Version") {
    await context.globalState.update(SKIPPED_VERSION_KEY, manifest.version);
  }
}

function notifyUpToDate(interactive: boolean, current: string): void {
  if (interactive) {
    vscode.window.showInformationMessage(
      `Tangent Local Agent is up to date (${current}).`,
    );
  }
}

export async function checkForUpdate(
  context: vscode.ExtensionContext,
  config: ExtensionConfig,
  options: { interactive?: boolean } = {},
): Promise<void> {
  const interactive = options.interactive ?? false;
  const current = currentVersion(context);
  const manifest = await loadManifest(config.updateBaseUrl, interactive);

  if (!manifest) return;

  if (!isNewerVersion(manifest.version, current)) {
    notifyUpToDate(interactive, current);
    return;
  }

  if (isSkipped(context, interactive, manifest.version)) return;

  await offerUpdate(context, config, manifest, current);
}

export function scheduleUpdateCheck(
  context: vscode.ExtensionContext,
  config: ExtensionConfig,
): void {
  if (!config.autoCheckUpdates) return;
  const timer = setTimeout(() => {
    void checkForUpdate(context, config);
  }, STARTUP_CHECK_DELAY_MS);
  context.subscriptions.push(new vscode.Disposable(() => clearTimeout(timer)));
}
