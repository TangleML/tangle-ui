import * as vscode from "vscode";

import type { TangleDeployCli } from "../cli/tangleDeployCli.ts";
import { showError } from "../prompts.ts";

/**
 * Wraps a command handler so it first confirms the CLI is installed (prompting
 * to install it when not) and reports any failure, keeping every CLI-backed
 * command a thin, uniform shell over the binary.
 */
export function guard<Args extends unknown[]>(
  cli: TangleDeployCli,
  run: (...args: Args) => unknown,
): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    try {
      if (await cli.ensureAvailable()) await run(...args);
    } catch (err) {
      showError(err);
    }
  };
}

function isFile(uri: vscode.Uri | undefined): uri is vscode.Uri {
  return uri?.scheme === "file";
}

function matchesExt(path: string, exts: string[] | undefined): boolean {
  return !exts || exts.some((ext) => path.toLowerCase().endsWith(ext));
}

/**
 * The file a file action runs on: an explicit explorer/editor target when the
 * command carries one, otherwise the active editor's document.
 */
export function targetFilePath(
  resource: vscode.Uri | undefined,
  exts?: string[],
): string | undefined {
  const uri = isFile(resource)
    ? resource
    : vscode.window.activeTextEditor?.document.uri;
  if (!isFile(uri) || !matchesExt(uri.fsPath, exts)) return undefined;
  return uri.fsPath;
}

export async function requireFilePath(
  resource: vscode.Uri | undefined,
  exts: string[],
  noun: string,
): Promise<string | undefined> {
  const path = targetFilePath(resource, exts);
  if (!path) {
    await vscode.window.showWarningMessage(
      `Open or select a ${noun} (${exts.join(", ")}) first.`,
    );
  }
  return path;
}

export async function confirmWarning(
  message: string,
  action: string,
): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    action,
  );
  return choice === action;
}

export function askText(
  title: string,
  options: { prompt?: string; placeHolder?: string; value?: string } = {},
): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title,
    ...options,
    ignoreFocusOut: true,
  });
}

/** A save-dialog path for a command that writes a file, defaulting next to `base`. */
export async function askOutputPath(
  defaultName: string,
): Promise<string | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultUri = folder
    ? vscode.Uri.joinPath(folder, defaultName)
    : undefined;
  const uri = await vscode.window.showSaveDialog({ defaultUri });
  return uri?.fsPath;
}

export async function askFolder(): Promise<string | undefined> {
  const [folder] =
    (await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    })) ?? [];
  return folder?.fsPath;
}

export async function openVirtualDocument(
  content: string,
  language: string,
): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language,
  });
  await vscode.window.showTextDocument(document);
}
