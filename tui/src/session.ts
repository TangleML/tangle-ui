import {
  type HostResourceInput,
  projectSharedMemorySeed,
  rootConfigSeed,
  sessionMemorySeed,
} from "./sessionSeed.ts";
import type { ShellClient } from "./shellClient.ts";
import type { Project, TangleRestClient } from "./tangleRestClient.ts";

/** Bundle that backs Tangent sessions started from tangle-ui (mirrors TANGENT_BUNDLE_ID). */
const TANGENT_BUNDLE_ID = "tangle";
const SHARED_FOLDER_KEY = "tangentSharedFolderId";
const DEFAULT_SESSION_NAME = "New Tangent session";

function readSharedFolderId(
  metadata: Record<string, unknown>,
): string | undefined {
  const id = metadata[SHARED_FOLDER_KEY];
  return typeof id === "string" && id.trim() !== "" ? id : undefined;
}

/**
 * Returns the project's shared folder id, provisioning it on first use. The
 * project is re-read after the folder is made so a folder another client saved
 * meanwhile wins, leaving ours unused rather than splitting the project's
 * memory. Any failure resolves to undefined so the session still starts, just
 * without the folder.
 */
async function ensureSharedFolderId(
  tangle: TangleRestClient,
  shell: ShellClient,
  project: Project,
): Promise<string | undefined> {
  try {
    const current = await tangle.getProject(project.id);
    const existing = readSharedFolderId(current.metadata);
    if (existing) return existing;

    const folderId = await shell.createSharedFolder(project.name);

    const latest = await tangle.getProject(project.id);
    const saved = readSharedFolderId(latest.metadata);
    if (saved) return saved;

    await tangle.updateProjectMetadata(project.id, {
      ...latest.metadata,
      [SHARED_FOLDER_KEY]: folderId,
    });
    return folderId;
  } catch {
    return undefined;
  }
}

interface StartProjectSessionParams {
  tangle: TangleRestClient;
  shell: ShellClient;
  project: Project;
  name?: string;
  projectInstructions?: string | null;
}

/**
 * Starts a project session the way tangle-ui does: a shared folder mount, the
 * session + project memory seeds, and the root run-config that attributes every
 * submit to the project. No pipeline is created. The session is then attached
 * to the project as an `agent_session` resource so it lists under the project.
 */
export async function startProjectSession({
  tangle,
  shell,
  project,
  name,
  projectInstructions,
}: StartProjectSessionParams): Promise<string> {
  const folderId = await ensureSharedFolderId(tangle, shell, project);
  const sharedMemory = folderId ? projectSharedMemorySeed(folderId) : undefined;
  const rootConfig = rootConfigSeed(project.id);

  const resources: HostResourceInput[] = [
    {
      kind: "memory",
      scope: "session",
      content: sessionMemorySeed(project.id, projectInstructions, {
        hasSharedFolder: sharedMemory !== undefined,
      }),
    },
    rootConfig.resource,
    ...(sharedMemory ? [sharedMemory.resource] : []),
  ];

  const session = await shell.createSession({
    bundleId: TANGENT_BUNDLE_ID,
    projectId: project.id,
    name: name ?? DEFAULT_SESSION_NAME,
    resources,
    env: rootConfig.env,
    ...(sharedMemory ? { memory: sharedMemory.memory } : {}),
  });

  await tangle.createProjectResource(project.id, {
    entity: "agent_session",
    entityId: session.id,
    ...(name ? { name } : {}),
  });

  return session.id;
}
