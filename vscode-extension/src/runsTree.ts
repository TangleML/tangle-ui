import * as vscode from "vscode";

import type { RunStatusFor } from "./cli/runStatusSource.ts";
import {
  isRunActive,
  overallRunStatus,
  runStatusIcon,
  runStatusLabel,
} from "./runStatus.ts";
import type { ProjectRun } from "./tangleRestClient.ts";
import {
  type MessageNode,
  messageNode,
  ProjectTree,
  type ProjectTreeDeps,
  themeIcon,
} from "./treeNodes.ts";

const RUN_POLL_INTERVAL_MS = 10_000;
const UNNAMED_PIPELINE = "Unnamed pipeline";

export interface RunNode {
  kind: "run";
  run: ProjectRun;
  status: string | undefined;
}

interface LoadMoreNode {
  kind: "loadMore";
}

type RunsTreeNode = RunNode | LoadMoreNode;

interface LoadedRuns {
  projectId: string;
  runs: RunNode[];
  nextPageToken: string | null;
}

function runDescription({ run, status }: RunNode): string {
  const parts = [runStatusLabel(status)];
  if (run.createdAt) parts.push(run.createdAt.toLocaleString());
  return parts.join(" · ");
}

function runItem(node: RunNode): vscode.TreeItem {
  const { run } = node;
  const item = new vscode.TreeItem(
    run.pipelineName ?? UNNAMED_PIPELINE,
    vscode.TreeItemCollapsibleState.None,
  );
  item.id = `run:${run.id}`;
  item.description = runDescription(node);
  item.tooltip = [
    `Run ${run.id}`,
    run.createdBy ? `Started by ${run.createdBy}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  item.iconPath = themeIcon(runStatusIcon(node.status));
  item.contextValue = "tangleRun";
  item.command = {
    command: "tangle.openRun",
    title: "Open Run",
    arguments: [node],
  };
  return item;
}

function loadMoreItem(): vscode.TreeItem {
  const item = new vscode.TreeItem(
    "Load more runs…",
    vscode.TreeItemCollapsibleState.None,
  );
  item.iconPath = new vscode.ThemeIcon("ellipsis");
  item.command = { command: "tangle.loadMoreRuns", title: "Load More Runs" };
  return item;
}

async function withLatestStatus(
  statusFor: RunStatusFor,
  node: RunNode,
): Promise<RunNode> {
  try {
    const stats = await statusFor(node.run.id);
    return { ...node, status: overallRunStatus(stats) };
  } catch {
    return node;
  }
}

export interface RunsTreeDeps extends ProjectTreeDeps {
  statusFor: RunStatusFor;
}

/**
 * The current project's runs, newest first. While the view is visible, runs
 * that can still change status are re-polled so the list reflects live state.
 */
export class RunsTreeProvider extends ProjectTree<RunsTreeNode> {
  private readonly statusFor: RunStatusFor;
  private loaded: LoadedRuns | undefined;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private visible = false;

  constructor(deps: RunsTreeDeps) {
    super(deps);
    this.statusFor = deps.statusFor;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.schedulePoll();
  }

  async loadMore(): Promise<void> {
    const loaded = this.loaded;
    if (!loaded?.nextPageToken) return;
    const page = await this.fetchRuns(loaded.projectId, loaded.nextPageToken);
    if (this.loaded !== loaded) return;
    this.loaded = {
      ...loaded,
      runs: [...loaded.runs, ...page.runs],
      nextPageToken: page.nextPageToken,
    };
    this.rerender();
  }

  override dispose(): void {
    this.stopPolling();
    super.dispose();
  }

  protected override reset(): void {
    this.loaded = undefined;
    this.stopPolling();
  }

  protected async loadRoot(
    projectId: string,
  ): Promise<(RunsTreeNode | MessageNode)[]> {
    if (this.loaded?.projectId !== projectId) {
      const page = await this.fetchRuns(projectId);
      this.loaded = { projectId, ...page };
    }
    this.schedulePoll();
    if (this.loaded.runs.length === 0) return [messageNode("No runs yet")];
    const loadMore: LoadMoreNode[] = this.loaded.nextPageToken
      ? [{ kind: "loadMore" }]
      : [];
    return [...this.loaded.runs, ...loadMore];
  }

  protected itemFor(node: RunsTreeNode): vscode.TreeItem {
    return node.kind === "run" ? runItem(node) : loadMoreItem();
  }

  private async fetchRuns(
    projectId: string,
    pageToken?: string,
  ): Promise<Omit<LoadedRuns, "projectId">> {
    const client = await this.deps.createClient();
    const page = await client.listProjectRuns(projectId, pageToken);
    const runs = await Promise.all(
      page.items.map((run) =>
        withLatestStatus(this.statusFor, {
          kind: "run",
          run,
          status: undefined,
        }),
      ),
    );
    return { runs, nextPageToken: page.nextPageToken };
  }

  private hasActiveRuns(): boolean {
    return this.loaded?.runs.some((node) => isRunActive(node.status)) ?? false;
  }

  private schedulePoll(): void {
    if (this.pollTimer || !this.visible || !this.hasActiveRuns()) return;
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined;
      // A failed poll stops polling; the next refresh shows the error.
      this.pollActiveRuns().catch(() => undefined);
    }, RUN_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
  }

  private async pollActiveRuns(): Promise<void> {
    const loaded = this.loaded;
    if (!loaded || !this.visible) return;
    const runs = await Promise.all(
      loaded.runs.map((node) =>
        isRunActive(node.status)
          ? withLatestStatus(this.statusFor, node)
          : node,
      ),
    );
    if (this.loaded !== loaded) return;
    this.loaded = { ...loaded, runs };
    this.rerender();
  }
}
