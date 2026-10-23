import * as vscode from "vscode";

import type { CurrentProject, ExtensionConfig } from "./config.ts";

const HAS_PROJECT_CONTEXT = "tangle.hasProject";

/**
 * The project the Tangle views are scoped to. Persisted per workspace so each
 * window can follow a different project.
 */
export class CurrentProjectState implements vscode.Disposable {
  private readonly config: ExtensionConfig;
  private readonly changed = new vscode.EventEmitter<
    CurrentProject | undefined
  >();
  readonly onDidChange = this.changed.event;

  constructor(config: ExtensionConfig) {
    this.config = config;
    void this.syncContextKey();
  }

  get project(): CurrentProject | undefined {
    return this.config.currentProject;
  }

  async select(project: CurrentProject): Promise<void> {
    await this.config.setCurrentProject(project);
    await this.syncContextKey();
    this.changed.fire(project);
  }

  dispose(): void {
    this.changed.dispose();
  }

  private async syncContextKey(): Promise<void> {
    await vscode.commands.executeCommand(
      "setContext",
      HAS_PROJECT_CONTEXT,
      Boolean(this.project),
    );
  }
}
