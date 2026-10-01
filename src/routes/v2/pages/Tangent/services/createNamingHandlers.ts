import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
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
  getPipelineBridge: () => PipelineNaming | undefined;
  onRenamed: () => Promise<void>;
}

type PipelineNaming = Pick<
  ToolBridgeApi,
  "getPipelineState" | "setPipelineName"
>;

export interface NamingHandlers {
  renameProject: (name: string) => Promise<{ renamed: boolean }>;
  nameSession: (name: string) => Promise<void>;
  namePipeline: (name: string) => Promise<{ renamed: boolean }>;
}

/**
 * Called from a tool rather than a render, so these go through the services
 * instead of the hooks around them: no component is mounted at the moment a
 * turn decides what to call something.
 */
export function createNamingHandlers({
  projectId,
  getActiveSessionId,
  getPipelineBridge,
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

    async namePipeline(name) {
      // Driven through the open tab's bridge rather than the resource row: the
      // canvas holds the spec, and only the bridge moves the spec, the file and
      // the row together. A row renamed on its own disagrees with the pipeline.
      const bridge = getPipelineBridge();
      if (!bridge) return { renamed: false };

      const state = await bridge.getPipelineState();
      if (!state.nameIsProvisional) return { renamed: false };

      await bridge.setPipelineName(name);
      await onRenamed();
      return { renamed: true };
    },
  };
}
