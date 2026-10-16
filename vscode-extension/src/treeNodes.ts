import * as vscode from "vscode";

import type { CurrentProject } from "./config.ts";
import { errorMessage } from "./prompts.ts";
import type { TangleRestClient } from "./tangleRestClient.ts";

export interface MessageNode {
  kind: "message";
  label: string;
  icon: string;
  command?: vscode.Command;
}

export interface ColoredIcon {
  id: string;
  color?: string;
}

export interface ProjectTreeDeps {
  currentProject(): CurrentProject | undefined;
  createClient(): Promise<TangleRestClient>;
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function themeIcon({ id, color }: ColoredIcon): vscode.ThemeIcon {
  return new vscode.ThemeIcon(
    id,
    color ? new vscode.ThemeColor(color) : undefined,
  );
}

export function messageNode(label: string, icon = "info"): MessageNode {
  return { kind: "message", label, icon };
}

function errorNode(err: unknown): MessageNode {
  return {
    kind: "message",
    label: errorMessage(err),
    icon: "error",
    command: { command: "tangle.setApiUrl", title: "Set Tangle API URL" },
  };
}

function isMessageNode(node: { kind: string }): node is MessageNode {
  return node.kind === "message";
}

function messageItem(node: MessageNode): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.label,
    vscode.TreeItemCollapsibleState.None,
  );
  item.iconPath = new vscode.ThemeIcon(node.icon);
  item.command = node.command;
  return item;
}

/**
 * A flat list scoped to the current project. Without a project it is empty, so
 * the view's welcome content offers the project picker instead.
 */
export abstract class ProjectTree<TNode extends { kind: string }>
  implements vscode.TreeDataProvider<TNode | MessageNode>, vscode.Disposable
{
  protected readonly deps: ProjectTreeDeps;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(deps: ProjectTreeDeps) {
    this.deps = deps;
  }

  refresh(): void {
    this.reset();
    this.changed.fire();
  }

  getTreeItem(node: TNode | MessageNode): vscode.TreeItem {
    if (isMessageNode(node)) return messageItem(node);
    return this.itemFor(node);
  }

  async getChildren(
    node?: TNode | MessageNode,
  ): Promise<(TNode | MessageNode)[]> {
    const project = this.deps.currentProject();
    if (node || !project) return [];
    try {
      return await this.loadRoot(project.id);
    } catch (err) {
      return [errorNode(err)];
    }
  }

  dispose(): void {
    this.changed.dispose();
  }

  /** Re-renders from what is already loaded, without fetching. */
  protected rerender(): void {
    this.changed.fire();
  }

  protected reset(): void {}

  protected abstract loadRoot(
    projectId: string,
  ): Promise<(TNode | MessageNode)[]>;

  protected abstract itemFor(node: TNode): vscode.TreeItem;
}
