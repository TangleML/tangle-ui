import * as vscode from "vscode";

import type { TangleDeployCli } from "./cli/tangleDeployCli.ts";

interface ActionNode {
  kind: "action";
  label: string;
  icon: string;
  commandId: string;
}

interface GroupNode {
  kind: "group";
  label: string;
  icon: string;
  children: ActionNode[];
}

type SavedNode = GroupNode | ActionNode;

function action(label: string, icon: string, command: string): ActionNode {
  return { kind: "action", label, icon, commandId: `tangle.cli.${command}` };
}

const GROUPS: GroupNode[] = [
  {
    kind: "group",
    label: "Saved pipelines",
    icon: "repo",
    children: [
      action("List", "list-unordered", "listSavedPipelines"),
      action("Save definition…", "save", "deploySavedPipeline"),
      action("Ship from Python…", "rocket", "shipSavedPipeline"),
      action("Sync from Python…", "sync", "syncSavedPipeline"),
      action("Read…", "book", "readSavedPipeline"),
      action("Run…", "run", "runSavedPipeline"),
      action("Configure…", "gear", "configureSavedPipeline"),
      action("Delete…", "trash", "deleteSavedPipeline"),
    ],
  },
  {
    kind: "group",
    label: "Scheduling",
    icon: "clock",
    children: [
      action("List schedules", "list-unordered", "listSchedules"),
      action("Manage schedule…", "edit", "manageSchedule"),
    ],
  },
  {
    kind: "group",
    label: "Subscriptions",
    icon: "bell",
    children: [
      action("List subscriptions", "list-unordered", "listSubscriptions"),
      action("Manage subscription…", "edit", "manageSubscription"),
    ],
  },
];

function groupItem(node: GroupNode): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.label,
    vscode.TreeItemCollapsibleState.Expanded,
  );
  item.iconPath = new vscode.ThemeIcon(node.icon);
  return item;
}

function actionItem(node: ActionNode): vscode.TreeItem {
  const item = new vscode.TreeItem(
    node.label,
    vscode.TreeItemCollapsibleState.None,
  );
  item.iconPath = new vscode.ThemeIcon(node.icon);
  item.command = { command: node.commandId, title: node.label };
  return item;
}

/**
 * A static, CLI-backed menu of saved-pipeline, schedule, and subscription
 * actions. Each entry runs an existing `tangle.cli.*` command (guarded by the
 * install prompt). When the CLI is absent the tree is empty so the view's
 * welcome offers to install it.
 */
export class SavedPipelinesTreeProvider
  implements vscode.TreeDataProvider<SavedNode>, vscode.Disposable
{
  private readonly cli: TangleDeployCli;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(cli: TangleDeployCli) {
    this.cli = cli;
  }

  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(node: SavedNode): vscode.TreeItem {
    return node.kind === "group" ? groupItem(node) : actionItem(node);
  }

  getChildren(node?: SavedNode): SavedNode[] {
    if (!node) return this.cli.availableNow === false ? [] : GROUPS;
    return node.kind === "group" ? node.children : [];
  }

  dispose(): void {
    this.changed.dispose();
  }
}
