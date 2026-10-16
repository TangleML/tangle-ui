import { createUnsignedJwt } from "@tangent/local-agent-host/remoteEnvToken.ts";
import { parseSessionRef } from "@tangent/local-agent-host/shellUrl.ts";
import * as vscode from "vscode";

import type { CurrentProject, ExtensionConfig } from "./config.ts";
import type { TangentController } from "./controller.ts";
import type { CurrentProjectState } from "./currentProject.ts";
import { projectSelector } from "./projectSelector.ts";
import {
  askNewSessionName,
  askSessionName,
  askSessionRef,
  confirmDetachSession,
  pickBundle,
  showError,
} from "./prompts.ts";
import type { SessionNode, SessionsTreeProvider } from "./sessionsTree.ts";
import type { TangentClient } from "./tangentClient.ts";
import type { TangleRestClient } from "./tangleRestClient.ts";
import type { ChatSession, SessionChatPanels } from "./webview/chatPanel.ts";

export interface ProjectSessionsDeps {
  config: ExtensionConfig;
  controller: TangentController;
  currentProject: CurrentProjectState;
  createTangleClient(): Promise<TangleRestClient>;
  chats: SessionChatPanels;
  sessionsTree: SessionsTreeProvider;
}

interface SessionRequest {
  bundleId: string;
  name: string | undefined;
}

/**
 * Agentic sessions of the current project. A session is created on the Shell,
 * recorded on the project as an `agent_session` resource, and opened in a chat
 * panel. The window's bridge is scoped to the whole project, so every session
 * reaches the local env and file tools.
 */
export class ProjectSessions {
  private readonly deps: ProjectSessionsDeps;

  constructor(deps: ProjectSessionsDeps) {
    this.deps = deps;
  }

  async newSession(): Promise<void> {
    const project = await this.requireProject();
    if (!project) return;
    const client = await this.deps.controller.requireClient();
    if (!client) return;
    const request = await this.askSessionRequest(client);
    if (!request) return;
    try {
      const session = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Starting Tangent session…",
        },
        () => this.startSession(client, project, request),
      );
      await this.openChat(session);
    } catch (err) {
      showError(err);
    }
  }

  async openSession(node: SessionNode): Promise<void> {
    try {
      const client = await this.deps.controller.requireClient();
      if (client) {
        await client.updateSessionTags(node.session.sessionId, [
          projectSelector(node.projectId),
        ]);
      }
      await this.openChat({
        sessionId: node.session.sessionId,
        name: node.session.name,
      });
    } catch (err) {
      showError(err);
    }
  }

  /** Opens any Shell session by URL or id, whether or not it is in a project. */
  async attachSession(): Promise<void> {
    const client = await this.deps.controller.requireClient();
    if (!client) return;
    const input = await askSessionRef(this.deps.config.activeSessionId);
    if (!input) return;
    try {
      const session = await client.getSession(parseSessionRef(input));
      await this.openChat({ sessionId: session.id, name: session.name });
    } catch (err) {
      showError(err);
    }
  }

  async renameSession(node: SessionNode): Promise<void> {
    const name = (await askNewSessionName(node.session.name))?.trim();
    if (!name || name === node.session.name) return;
    try {
      const tangle = await this.deps.createTangleClient();
      await tangle.renameResource(
        node.projectId,
        node.session.resourceId,
        name,
      );
      this.deps.chats.rename(node.session.sessionId, name);
      this.deps.sessionsTree.refresh();
    } catch (err) {
      showError(err);
    }
  }

  async detachSession(node: SessionNode): Promise<void> {
    if (!(await confirmDetachSession(node.session.name))) return;
    try {
      const tangle = await this.deps.createTangleClient();
      await tangle.deleteResource(node.projectId, node.session.resourceId);
      this.deps.chats.close(node.session.sessionId);
      this.deps.sessionsTree.refresh();
    } catch (err) {
      showError(err);
    }
  }

  private async requireProject(): Promise<CurrentProject | undefined> {
    if (!this.deps.currentProject.project) {
      await vscode.commands.executeCommand("tangle.selectProject");
    }
    return this.deps.currentProject.project;
  }

  private async chooseBundle(
    client: TangentClient,
  ): Promise<string | undefined> {
    try {
      return await pickBundle(await client.listBundles());
    } catch (err) {
      showError(err);
      return undefined;
    }
  }

  private async askSessionRequest(
    client: TangentClient,
  ): Promise<SessionRequest | undefined> {
    const bundleId =
      this.deps.config.defaultBundleId ?? (await this.chooseBundle(client));
    if (!bundleId) return undefined;
    const name = await askSessionName();
    if (name === undefined) return undefined;
    return { bundleId, name: name.trim() || undefined };
  }

  private async startSession(
    client: TangentClient,
    project: CurrentProject,
    { bundleId, name }: SessionRequest,
  ): Promise<ChatSession> {
    const session = await client.createSession(bundleId, name, [
      projectSelector(project.id),
    ]);
    const tangle = await this.deps.createTangleClient();
    await tangle.createResource(project.id, {
      entity: "agent_session",
      entityId: session.id,
      name: session.name,
    });
    this.deps.sessionsTree.refresh();
    return { sessionId: session.id, name: session.name };
  }

  private async openChat(session: ChatSession): Promise<void> {
    const client = await this.deps.controller.requireClient();
    const shellUrl = this.deps.controller.shellUrl;
    if (!client || !shellUrl) return;
    await this.deps.controller.attach(session.sessionId);
    const authToken = createUnsignedJwt({
      email: await this.deps.controller.resolveUserEmail(shellUrl),
    });
    await this.deps.chats.open(shellUrl, session, authToken);
  }
}
