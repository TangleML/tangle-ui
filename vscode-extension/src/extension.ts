import { normalizeShellUrl } from "@tangent/local-agent-host/shellUrl.ts";
import * as vscode from "vscode";

import { OktaSsoAuthProvider } from "./auth/oktaSsoAuth.ts";
import { isOktaSsoEnabled } from "./auth/oktaSsoConfig.ts";
import { checkForUpdate, scheduleUpdateCheck } from "./autoUpdate.ts";
import { createRunStatusSource } from "./cli/runStatusSource.ts";
import { TangleDeployCli } from "./cli/tangleDeployCli.ts";
import { componentCommands } from "./commands/components.ts";
import { opsCommands } from "./commands/ops.ts";
import { pipelineRunCommands } from "./commands/pipelineRun.ts";
import { savedPipelineCommands } from "./commands/savedPipelines.ts";
import { transformCommands } from "./commands/transforms.ts";
import { ExtensionConfig } from "./config.ts";
import { TangentController } from "./controller.ts";
import { CurrentProjectState } from "./currentProject.ts";
import { pickProject } from "./projectPicker.ts";
import { ProjectSessions } from "./projectSessions.ts";
import { createProjectViews, type ProjectViews } from "./projectViews.ts";
import {
  askTangleApiToken,
  askTangleApiUrl,
  confirmConnectLink,
  showError,
} from "./prompts.ts";
import { resourceWebPath } from "./resourceKinds.ts";
import type { ResourceNode } from "./resourcesTree.ts";
import type { RunNode } from "./runsTree.ts";
import { SavedPipelinesTreeProvider } from "./savedPipelinesTree.ts";
import type { SessionNode } from "./sessionsTree.ts";
import { normalizeBaseUrl, TangleRestClient } from "./tangleRestClient.ts";
import { SessionChatPanels } from "./webview/chatPanel.ts";

type CommandMap = Record<string, (...args: never[]) => unknown>;

interface Services {
  config: ExtensionConfig;
  currentProject: CurrentProjectState;
  views: ProjectViews;
  sessions: ProjectSessions;
  createTangleClient(): Promise<TangleRestClient>;
}

function originOf(url: string): string {
  return new URL(url).origin;
}

/** The link's target origin, or `undefined` when it matches `current` or is absent. */
function changedOrigin(
  current: string | undefined,
  incoming: string | null,
  normalize: (value: string) => string,
): string | undefined {
  if (!incoming) return undefined;
  const origin = originOf(normalize(incoming));
  return origin === current ? undefined : origin;
}

async function confirmLinkIfNeeded(
  config: ExtensionConfig,
  apiUrl: string | null,
  url: string | null,
): Promise<boolean> {
  const apiOrigin = changedOrigin(
    originOf(config.tangleApiUrl),
    apiUrl,
    normalizeBaseUrl,
  );
  const savedShellOrigin = config.shellUrl
    ? originOf(config.shellUrl)
    : undefined;
  const shellOrigin = changedOrigin(savedShellOrigin, url, normalizeShellUrl);
  if (!apiOrigin && !shellOrigin) return true;
  return confirmConnectLink(shellOrigin, apiOrigin);
}

async function selectLinkProject(
  services: Services,
  query: URLSearchParams,
): Promise<void> {
  const projectId = query.get("projectId");
  if (!projectId) return;
  const client = await services.createTangleClient();
  const project = await client.getProject(projectId);
  await services.currentProject.select({
    id: project.id,
    name: project.name,
  });
}

/**
 * Handles `vscode://tangent.tangent-local-agent/connect?url=<shell url>` with
 * optional `apiUrl` and `projectId`. A link that points at a Shell or Tangle
 * API origin the window is not already connected to must be confirmed first, so
 * a web page cannot silently repoint the editor at an attacker's Shell (whose
 * local sub-agents run in the workspace) or leak the saved Tangle API token to
 * an attacker's API origin. The project name is read from the backend rather
 * than trusted from the link.
 */
async function applyConnectLink(
  services: Services,
  controller: TangentController,
  query: URLSearchParams,
): Promise<void> {
  const apiUrl = query.get("apiUrl");
  const url = query.get("url");
  if (!(await confirmLinkIfNeeded(services.config, apiUrl, url))) return;
  if (apiUrl) await services.config.setTangleApiUrl(normalizeBaseUrl(apiUrl));
  await selectLinkProject(services, query);
  if (url) await controller.connectFromLink(url);
}

function uriHandler(
  services: Services,
  controller: TangentController,
): vscode.UriHandler {
  return {
    handleUri(uri) {
      if (uri.path !== "/connect") return;
      const query = new URLSearchParams(uri.query);
      applyConnectLink(services, controller, query).catch(showError);
    },
  };
}

function openInTangleUi(
  config: ExtensionConfig,
  path: string,
): Thenable<boolean> {
  return vscode.env.openExternal(
    vscode.Uri.parse(`${config.tangleUiUrl}${path}`),
  );
}

async function selectProject(services: Services): Promise<void> {
  try {
    const project = await pickProject(
      await services.createTangleClient(),
      services.currentProject.project?.id,
    );
    if (project) await services.currentProject.select(project);
  } catch (err) {
    showError(err);
  }
}

async function openCurrentProject(services: Services): Promise<unknown> {
  const project = services.currentProject.project;
  if (!project) return selectProject(services);
  return openInTangleUi(
    services.config,
    `/projects/${encodeURIComponent(project.id)}`,
  );
}

async function setTangleApiUrl(services: Services): Promise<void> {
  const { config } = services;
  const input = await askTangleApiUrl(config.tangleApiUrl);
  if (!input) return;
  const token = await askTangleApiToken(await config.tangleApiToken());
  await config.setTangleApiUrl(normalizeBaseUrl(input));
  if (token) await config.setTangleApiToken(token);
  services.views.refreshAll();
}

/** The cached name goes stale when the project is renamed elsewhere. */
async function refreshProjectName(services: Services): Promise<void> {
  const project = services.currentProject.project;
  if (!project) return;
  try {
    const client = await services.createTangleClient();
    const latest = await client.getProject(project.id);
    if (latest.name === project.name) return;
    await services.currentProject.select({ id: latest.id, name: latest.name });
  } catch {
    // The views report an unreachable backend or a deleted project.
  }
}

function projectCommands(services: Services): CommandMap {
  const { config, views, sessions } = services;
  return {
    "tangle.selectProject": () => selectProject(services),
    "tangle.refresh": () => views.refreshAll(),
    "tangle.setApiUrl": () => setTangleApiUrl(services),
    "tangle.openProject": () => openCurrentProject(services),
    "tangle.loadMoreRuns": () => views.runs.loadMore().catch(showError),
    "tangle.openRun": (node: RunNode) =>
      openInTangleUi(config, `/runs/${encodeURIComponent(node.run.id)}`),
    "tangle.openResource": (node: ResourceNode) =>
      openInTangleUi(config, resourceWebPath(node.projectId, node.resource)),
    "tangle.newSession": () => sessions.newSession(),
    "tangle.openSession": (node: SessionNode) => sessions.openSession(node),
    "tangle.renameSession": (node: SessionNode) => sessions.renameSession(node),
    "tangle.detachSession": (node: SessionNode) => sessions.detachSession(node),
  };
}

function tangentCommands(
  controller: TangentController,
  sessions: ProjectSessions,
): CommandMap {
  return {
    "tangent.connect": () => controller.connect(),
    "tangent.disconnect": () => controller.disconnect(),
    "tangent.attachSession": () => sessions.attachSession(),
    "tangent.setPiProxyApiKey": () => controller.setPiProxyApiKey(),
    "tangent.showMenu": () => controller.showMenu(),
  };
}

function registerCommands(commands: CommandMap): vscode.Disposable[] {
  return Object.entries(commands).map(([id, run]) =>
    vscode.commands.registerCommand(id, run),
  );
}

function tangleClientFactory(
  config: ExtensionConfig,
  oktaSso: OktaSsoAuthProvider | undefined,
): () => Promise<TangleRestClient> {
  return async () =>
    new TangleRestClient(
      config.tangleApiUrl,
      await config.tangleApiToken(),
      oktaSso?.cookieProviderFor(config.tangleApiUrl),
    );
}

function configChangeHandler(
  views: ProjectViews,
  refreshCliViews: () => void,
): (event: vscode.ConfigurationChangeEvent) => void {
  return (event) => {
    if (event.affectsConfiguration("tangent.tangleApiUrl")) views.refreshAll();
    if (event.affectsConfiguration("tangent.tangleDeployBin"))
      refreshCliViews();
  };
}

function buildCommandMap(
  context: vscode.ExtensionContext,
  services: Services,
  controller: TangentController,
  cli: TangleDeployCli,
  savedPipelines: SavedPipelinesTreeProvider,
): CommandMap {
  return {
    ...projectCommands(services),
    ...tangentCommands(controller, services.sessions),
    ...pipelineRunCommands(cli),
    ...componentCommands(cli),
    ...savedPipelineCommands(cli),
    ...transformCommands(cli),
    ...opsCommands(cli),
    "tangle.cli.showInstallHelp": () => cli.showInstallHelp(),
    "tangle.savedPipelines.refresh": () => savedPipelines.refresh(),
    "tangent.checkForUpdates": () =>
      checkForUpdate(context, services.config, { interactive: true }),
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const config = new ExtensionConfig(context);
  const oktaSso = isOktaSsoEnabled()
    ? new OktaSsoAuthProvider(context.secrets)
    : undefined;
  const controller = new TangentController(config, oktaSso);
  const currentProject = new CurrentProjectState(config);
  const cli = new TangleDeployCli(config, (line) => controller.log(line));
  const createTangleClient = tangleClientFactory(config, oktaSso);
  const views = createProjectViews({
    currentProject,
    createClient: createTangleClient,
    activeSessionId: () => config.activeSessionId,
    statusFor: createRunStatusSource(cli, createTangleClient),
  });
  const chats = new SessionChatPanels(
    context.extensionUri,
    (line) => controller.log(line),
    oktaSso
      ? (url, options) => oktaSso.getCookieHeader(url, options)
      : undefined,
  );
  const sessions = new ProjectSessions({
    config,
    controller,
    currentProject,
    createTangleClient,
    chats,
    sessionsTree: views.sessions,
  });
  const services: Services = {
    config,
    currentProject,
    views,
    sessions,
    createTangleClient,
  };
  const savedPipelines = new SavedPipelinesTreeProvider(cli);
  const refreshCliViews = () =>
    void cli.refreshAvailability().then(() => savedPipelines.refresh());

  context.subscriptions.push(
    controller,
    currentProject,
    views,
    chats,
    cli,
    savedPipelines,
    vscode.window.createTreeView("tangle.savedPipelines", {
      treeDataProvider: savedPipelines,
    }),
    vscode.window.registerUriHandler(uriHandler(services, controller)),
    controller.onDidAttach(() => views.sessions.showActiveSessionChanged()),
    currentProject.onDidChange(() => controller.reconnectForCurrentProject()),
    vscode.workspace.onDidChangeConfiguration(
      configChangeHandler(views, refreshCliViews),
    ),
    ...registerCommands(
      buildCommandMap(context, services, controller, cli, savedPipelines),
    ),
  );
  controller.autoConnect();
  void refreshProjectName(services);
  refreshCliViews();
  scheduleUpdateCheck(context, config);
}

export function deactivate(): void {}
