import * as vscode from "vscode";

import type { RunStatusFor } from "./cli/runStatusSource.ts";
import type { CurrentProjectState } from "./currentProject.ts";
import { ResourcesTreeProvider } from "./resourcesTree.ts";
import { RunsTreeProvider } from "./runsTree.ts";
import { SessionsTreeProvider } from "./sessionsTree.ts";
import type { TangleRestClient } from "./tangleRestClient.ts";

export interface ProjectViewsDeps {
  currentProject: CurrentProjectState;
  createClient(): Promise<TangleRestClient>;
  activeSessionId(): string | undefined;
  statusFor: RunStatusFor;
}

export interface ProjectViews extends vscode.Disposable {
  runs: RunsTreeProvider;
  resources: ResourcesTreeProvider;
  sessions: SessionsTreeProvider;
  refreshAll(): void;
}

/**
 * The Runs, Resources, and Sessions views of the Tangle container, all scoped
 * to the current project, whose name they show as their description.
 */
export function createProjectViews(deps: ProjectViewsDeps): ProjectViews {
  const treeDeps = {
    currentProject: () => deps.currentProject.project,
    createClient: deps.createClient,
  };
  const runs = new RunsTreeProvider({ ...treeDeps, statusFor: deps.statusFor });
  const resources = new ResourcesTreeProvider(treeDeps);
  const sessions = new SessionsTreeProvider({
    ...treeDeps,
    activeSessionId: deps.activeSessionId,
  });
  const runsView = vscode.window.createTreeView("tangle.runs", {
    treeDataProvider: runs,
  });
  const treeViews = [
    runsView,
    vscode.window.createTreeView("tangle.resources", {
      treeDataProvider: resources,
    }),
    vscode.window.createTreeView("tangle.sessions", {
      treeDataProvider: sessions,
    }),
  ];

  const describe = () => {
    for (const view of treeViews) {
      view.description = deps.currentProject.project?.name;
    }
  };
  const refreshAll = () => {
    runs.refresh();
    resources.refresh();
    sessions.refresh();
  };
  describe();
  runs.setVisible(runsView.visible);

  const disposables: vscode.Disposable[] = [
    runs,
    resources,
    sessions,
    ...treeViews,
    runsView.onDidChangeVisibility((event) => runs.setVisible(event.visible)),
    deps.currentProject.onDidChange(() => {
      describe();
      refreshAll();
    }),
  ];

  return {
    runs,
    resources,
    sessions,
    refreshAll,
    dispose: () => {
      for (const disposable of disposables) disposable.dispose();
    },
  };
}
