import * as vscode from "vscode";

import {
  type MessageNode,
  messageNode,
  ProjectTree,
  type ProjectTreeDeps,
} from "./treeNodes.ts";

const UNNAMED_SESSION = "Untitled session";

const START_SESSION_NODE: MessageNode = {
  ...messageNode("No sessions yet. Start one…", "add"),
  command: { command: "tangle.newSession", title: "New Session" },
};

export interface ProjectSession {
  resourceId: string;
  sessionId: string;
  name: string;
  createdAt: Date;
}

export interface SessionNode {
  kind: "session";
  projectId: string;
  session: ProjectSession;
}

interface SessionsTreeDeps extends ProjectTreeDeps {
  activeSessionId(): string | undefined;
}

function sessionItem(node: SessionNode, isActive: boolean): vscode.TreeItem {
  const { session } = node;
  const item = new vscode.TreeItem(
    session.name,
    vscode.TreeItemCollapsibleState.None,
  );
  const created = session.createdAt.toLocaleString();
  item.id = `session:${session.resourceId}`;
  item.description = isActive ? `local env · ${created}` : created;
  item.tooltip = [
    `Session ${session.sessionId}`,
    isActive ? "Local sub-agents and file tools run in this window." : "",
  ]
    .filter(Boolean)
    .join("\n");
  item.iconPath = new vscode.ThemeIcon(
    isActive ? "comment-discussion" : "comment",
  );
  item.contextValue = "tangleSession";
  item.command = {
    command: "tangle.openSession",
    title: "Open Session",
    arguments: [node],
  };
  return item;
}

/**
 * The current project's agentic sessions: `agent_session` resources whose
 * entity id is a Tangent Shell session id.
 */
export class SessionsTreeProvider extends ProjectTree<SessionNode> {
  private readonly activeSessionId: () => string | undefined;

  constructor(deps: SessionsTreeDeps) {
    super(deps);
    this.activeSessionId = deps.activeSessionId;
  }

  /** Moves the "local env" marker without refetching the sessions. */
  showActiveSessionChanged(): void {
    this.rerender();
  }

  protected async loadRoot(
    projectId: string,
  ): Promise<(SessionNode | MessageNode)[]> {
    const client = await this.deps.createClient();
    const resources = await client.listAllResources(projectId, [
      "agent_session",
    ]);
    const sessions = resources.flatMap((resource): SessionNode[] =>
      resource.entityId
        ? [
            {
              kind: "session",
              projectId,
              session: {
                resourceId: resource.id,
                sessionId: resource.entityId,
                name: resource.name ?? UNNAMED_SESSION,
                createdAt: resource.createdAt,
              },
            },
          ]
        : [],
    );
    if (sessions.length === 0) return [START_SESSION_NODE];
    return sessions.toSorted(
      (a, b) => b.session.createdAt.getTime() - a.session.createdAt.getTime(),
    );
  }

  protected itemFor(node: SessionNode): vscode.TreeItem {
    return sessionItem(node, node.session.sessionId === this.activeSessionId());
  }
}
