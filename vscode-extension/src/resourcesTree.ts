import * as vscode from "vscode";

import { resourceKind } from "./resourceKinds.ts";
import type { ProjectResource } from "./tangleRestClient.ts";
import { type MessageNode, messageNode, ProjectTree } from "./treeNodes.ts";

const UNNAMED_RESOURCE = "Untitled resource";

export interface ResourceNode {
  kind: "resource";
  projectId: string;
  resource: ProjectResource;
}

function resourceItem(node: ResourceNode): vscode.TreeItem {
  const { resource } = node;
  const kind = resourceKind(resource);
  const item = new vscode.TreeItem(
    resource.name ?? UNNAMED_RESOURCE,
    vscode.TreeItemCollapsibleState.None,
  );
  item.id = `resource:${resource.id}`;
  item.description = kind.label;
  item.tooltip = [
    `${kind.label} · updated ${resource.updatedAt.toLocaleString()}`,
    resource.createdBy ? `Added by ${resource.createdBy}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  item.iconPath = new vscode.ThemeIcon(kind.icon);
  item.contextValue = "tangleResource";
  item.command = {
    command: "tangle.openResource",
    title: "Open Resource",
    arguments: [node],
  };
  return item;
}

/**
 * The current project's pipelines and documents. Sessions are resources too,
 * but they get their own view.
 */
export class ResourcesTreeProvider extends ProjectTree<ResourceNode> {
  protected async loadRoot(
    projectId: string,
  ): Promise<(ResourceNode | MessageNode)[]> {
    const client = await this.deps.createClient();
    const resources = await client.listAllResources(projectId, [
      "pipeline",
      "document",
    ]);
    if (resources.length === 0) return [messageNode("No resources yet")];
    return resources
      .toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((resource) => ({ kind: "resource", projectId, resource }));
  }

  protected itemFor(node: ResourceNode): vscode.TreeItem {
    return resourceItem(node);
  }
}
