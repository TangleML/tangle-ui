import {
  listProjectResources,
  updateProjectResource,
} from "@/services/projects/projectResourcesService";
import { getProject, updateProject } from "@/services/projects/projectsService";
import {
  hasProvisionalName,
  withoutProvisionalName,
} from "@/services/projects/provisionalName";

interface NamingDeps {
  projectId: string;
  getActiveSessionId: () => string | undefined;
  onRenamed: () => Promise<void>;
}

export interface NamingHandlers {
  renameProject: (name: string) => Promise<{ renamed: boolean }>;
  nameSession: (name: string) => Promise<void>;
}

/**
 * What the agent's naming tools actually do. Called from a tool, not a render,
 * so these go through the services rather than the hooks around them: there is
 * no component mounted at the moment a turn decides what to call something.
 */
export function createNamingHandlers({
  projectId,
  getActiveSessionId,
  onRenamed,
}: NamingDeps): NamingHandlers {
  return {
    async renameProject(name) {
      const project = await getProject(projectId);
      // A name someone chose is the answer; the agent is told not to retry.
      if (!hasProvisionalName(project.extraData)) return { renamed: false };

      await updateProject(projectId, {
        name,
        extraData: withoutProvisionalName(project.extraData),
      });
      await onRenamed();
      return { renamed: true };
    },

    async nameSession(name) {
      const sessionId = getActiveSessionId();
      const { items } = sessionId
        ? await listProjectResources(projectId, { entity: ["agent_session"] })
        : { items: [] };
      const row = items.find((resource) => resource.entityId === sessionId);

      if (!row) {
        throw new Error("This session is not attached to the project yet.");
      }

      await updateProjectResource(projectId, row.id, { name });
      await onRenamed();
    },
  };
}
