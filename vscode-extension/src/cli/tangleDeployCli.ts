import { spawn } from "node:child_process";

import * as vscode from "vscode";

import type { ExtensionConfig } from "../config.ts";
import {
  buildCliEnv,
  type CliTarget,
  formatCommandLine,
} from "./cliInvocation.ts";

const HAS_CLI_CONTEXT = "tangle.hasCli";
const CAPTURE_TIMEOUT_MS = 60_000;
const TERMINAL_NAME = "Tangle Deploy";
const DOCS_URL =
  "https://github.com/Shopify/discovery/blob/main/oasis/tangle-deploy/README.md";

export interface CaptureResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function workspaceCwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Runs the tangle-deploy CLI as the backend for every write/execute action, so
 * the extension never reimplements its logic. Long-running commands stream in a
 * reused terminal; data commands are captured and parsed from `--json` output.
 */
export class TangleDeployCli implements vscode.Disposable {
  private readonly config: ExtensionConfig;
  private readonly log: (line: string) => void;
  private terminal: vscode.Terminal | undefined;
  private terminalKey: string | undefined;
  private cachedAvailable: boolean | undefined;
  private readonly closeListener: vscode.Disposable;

  constructor(config: ExtensionConfig, log: (line: string) => void) {
    this.config = config;
    this.log = log;
    this.closeListener = vscode.window.onDidCloseTerminal((closed) => {
      if (closed === this.terminal) {
        this.terminal = undefined;
        this.terminalKey = undefined;
      }
    });
  }

  dispose(): void {
    this.closeListener.dispose();
    this.terminal?.dispose();
  }

  async refreshAvailability(): Promise<boolean> {
    const available = await this.probe();
    this.cachedAvailable = available;
    await vscode.commands.executeCommand(
      "setContext",
      HAS_CLI_CONTEXT,
      available,
    );
    return available;
  }

  /** The last probed result, for callers that must not block (status polling). */
  get availableNow(): boolean | undefined {
    return this.cachedAvailable;
  }

  async ensureAvailable(): Promise<boolean> {
    if (await this.refreshAvailability()) return true;
    await this.showInstallHelp();
    return false;
  }

  async showInstallHelp(): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      "The tangle-deploy CLI was not found. Install it, or set its path in tangent.tangleDeployBin.",
      "Install Help",
      "Set Path",
    );
    if (choice === "Install Help") {
      await vscode.env.openExternal(vscode.Uri.parse(DOCS_URL));
    } else if (choice === "Set Path") {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "tangent.tangleDeployBin",
      );
    }
  }

  /**
   * Shows the command in the reused terminal. `execute: false` types it without
   * running, so a command whose required flags the extension cannot prompt for
   * is left for the user to finish.
   */
  runInTerminal(args: string[], options: { execute?: boolean } = {}): void {
    const terminal = this.ensureTerminal();
    terminal.show();
    terminal.sendText(
      formatCommandLine(this.config.tangleDeployBin, args),
      options.execute ?? true,
    );
  }

  async capture(args: string[]): Promise<CaptureResult> {
    const bin = this.config.tangleDeployBin;
    this.log(`$ ${formatCommandLine(bin, args)}`);
    return this.spawn(bin, args);
  }

  async json<T>(args: string[], parse: (data: unknown) => T): Promise<T> {
    const result = await this.capture(args);
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || `CLI exited ${result.code}.`);
    }
    return parse(JSON.parse(result.stdout));
  }

  private target(): CliTarget {
    return { apiBaseUrl: this.config.tangleApiUrl };
  }

  private async probe(): Promise<boolean> {
    const bin = this.config.tangleDeployBin;
    try {
      const result = await this.spawn(bin, ["--help"]);
      if (result.code !== 0) {
        this.log(
          `CLI probe "${bin} --help" exited ${result.code}: ${result.stderr.trim()}`,
        );
      }
      return result.code === 0;
    } catch (error) {
      this.log(`CLI probe could not run "${bin}": ${String(error)}`);
      return false;
    }
  }

  private ensureTerminal(): vscode.Terminal {
    const env = buildCliEnv(this.target());
    const cwd = workspaceCwd();
    const key = JSON.stringify({ env, cwd });
    if (this.terminal && this.terminalKey === key) return this.terminal;
    this.terminal?.dispose();
    this.terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      cwd,
      env,
    });
    this.terminalKey = key;
    return this.terminal;
  }

  private spawn(bin: string, args: string[]): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd: workspaceCwd(),
        env: { ...process.env, ...buildCliEnv(this.target()) },
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill(), CAPTURE_TIMEOUT_MS);
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, code });
      });
    });
  }
}
