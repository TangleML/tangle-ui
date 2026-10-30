import * as vscode from "vscode";

import type { CurrentProject } from "./config.ts";
import type { ProjectSummary, TangleRestClient } from "./tangleRestClient.ts";
import { pluralize } from "./treeNodes.ts";

interface ProjectPickItem extends vscode.QuickPickItem {
  project: ProjectSummary;
}

function resourceSummary(project: ProjectSummary): string {
  return Object.entries(project.resourceCounts)
    .filter(([, count]) => count > 0)
    .map(([entity, count]) => pluralize(count, entity.replace(/_/g, " ")))
    .join(", ");
}

function toPickItem(
  project: ProjectSummary,
  currentId: string | undefined,
): ProjectPickItem {
  return {
    label: project.name,
    description:
      project.id === currentId ? "current" : resourceSummary(project),
    detail: project.description ?? undefined,
    project,
  };
}

export async function pickProject(
  client: TangleRestClient,
  currentId: string | undefined,
): Promise<CurrentProject | undefined> {
  const items = client
    .listAllProjects()
    .then((projects) =>
      projects.map((project) => toPickItem(project, currentId)),
    );
  const picked = await vscode.window.showQuickPick(items, {
    title: "Select Tangle project",
    placeHolder: "The project the Runs, Resources, and Sessions views show",
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!picked) return undefined;
  return { id: picked.project.id, name: picked.project.name };
}
