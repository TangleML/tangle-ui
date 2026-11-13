import type { Tangent } from "@tangent/embed-react";
import type { QueryClient } from "@tanstack/react-query";

import { toResourceItem } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import { sessionFilesKey } from "@/routes/v2/pages/Tangent/hooks/useProjectSessionFiles";
import {
  SESSION_RESOURCES,
  sessionsOf,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import {
  runEntry,
  sessionRunsKey,
  sessionRunsOf,
} from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import type {
  ProjectCardEntry,
  ProjectCardToolDeps,
} from "@/routes/v2/pages/Tangent/services/createProjectCardRemoteTools";
import type { RunInspectDeps } from "@/routes/v2/pages/Tangent/services/createWorkareaRemoteTools";
import {
  archivedTargets,
  setProjectItemArchived,
} from "@/routes/v2/pages/Tangent/services/projectArchive";
import { mergeProjectRuns } from "@/routes/v2/pages/Tangent/services/projectRunEntries";
import {
  listSessionFiles,
  pinSessionFile,
  type SessionFileRecord,
  unpinSessionFile,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import { listProjectRuns } from "@/services/projects/projectRunsService";
import { getProject } from "@/services/projects/projectsService";
import { MAX_PAGE_SIZE } from "@/services/projects/queryDefaults";
import {
  documentResourceInput,
  pipelineRunResourceInput,
} from "@/services/projects/resourceDescriptor";
import {
  formatWorkareaTarget,
  idIdentity,
  parseIdentity,
  runTarget,
  type WorkareaTarget,
} from "@/services/projects/resourceTarget";
import {
  type ListProjectResourcesParams,
  ProjectsQueryKeys,
} from "@/services/projects/types";
import { projectResourcesQueryOptions } from "@/services/projects/useProjectResources";

interface ProjectCardHandlerOptions {
  projectId: string;
  queryClient: QueryClient;
  getActiveSessionId: () => string | undefined;
  getBaseUrl: () => string | undefined;
  getAuthToken: () => string | undefined;
  getTangent: () => Tangent;
  getRunDetails: RunInspectDeps["getRunDetails"];
  onResourcesChanged: () => Promise<void>;
}

const CARD_RESOURCES: ListProjectResourcesParams = {
  entity: ["document", "pipeline"],
  pageSize: MAX_PAGE_SIZE,
};

const NOTHING_LOCAL = {
  unavailable: new Set<string>(),
  currentNames: new Map<string, string>(),
};

interface AttachedEntry {
  target: WorkareaTarget;
  name: string;
  at: Date | null;
}

const newestFirst = (a: { at: Date | null }, b: { at: Date | null }) =>
  (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0);

function entriesOf(
  attached: AttachedEntry[],
  type: WorkareaTarget["type"],
): ProjectCardEntry[] {
  return attached
    .filter(({ target }) => target.type === type)
    .sort(newestFirst)
    .map(({ target, name, at }) => ({
      target: formatWorkareaTarget(target),
      name,
      at,
    }));
}

/**
 * The project card's reads and writes, outside React, for the agent's tools.
 * Reads skip the cache so the agent sees what's there now, and writes refresh
 * what the card shows.
 */
export function createProjectCardHandlers({
  projectId,
  queryClient,
  getActiveSessionId,
  getBaseUrl,
  getAuthToken,
  getTangent,
  getRunDetails,
  onResourcesChanged,
}: ProjectCardHandlerOptions): ProjectCardToolDeps {
  const fetchResources = async (params: ListProjectResourcesParams) =>
    (
      await queryClient.fetchQuery({
        ...projectResourcesQueryOptions(projectId, params),
        staleTime: 0,
      })
    ).items;

  function requireBaseUrl(): string {
    const baseUrl = getBaseUrl();
    if (!baseUrl) throw new Error("This page can't reach Tangent right now.");
    return baseUrl;
  }

  async function listChatFiles(
    baseUrl: string,
    sessionId: string,
  ): Promise<SessionFileRecord[]> {
    try {
      return await queryClient.fetchQuery({
        queryKey: sessionFilesKey(baseUrl, sessionId),
        queryFn: () =>
          listSessionFiles({ baseUrl, sessionId, authToken: getAuthToken() }),
        staleTime: 0,
      });
    } catch {
      // The card skips a chat it can't read, such as someone else's.
      return [];
    }
  }

  return {
    getActiveSessionId,

    async listEntries() {
      const [summaries, projectRuns] = await Promise.all([
        fetchResources(CARD_RESOURCES),
        listProjectRuns(projectId),
      ]);
      const attached = summaries.flatMap((summary) => {
        const item = toResourceItem(summary, NOTHING_LOCAL, new Map());
        return item?.target
          ? [{ target: item.target, name: item.name, at: summary.createdAt }]
          : [];
      });
      const runs = mergeProjectRuns(
        projectRuns.items,
        attached
          .filter(({ target }) => target.type === "run")
          .map(({ target, name, at }) => ({
            id: parseIdentity(target.identity).value,
            pipelineName: name,
            ranAt: at,
          })),
      );
      return {
        runs: runs.map((run) => ({
          target: formatWorkareaTarget(runTarget(run.id)),
          name: run.pipelineName,
          at: run.ranAt,
        })),
        pipelines: entriesOf(attached, "pipeline"),
        documents: entriesOf(attached, "document"),
      };
    },

    async listArchived() {
      return archivedTargets((await getProject(projectId)).metadata);
    },

    async setArchived(target, archived) {
      await setProjectItemArchived(projectId, target, archived);
      await queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(projectId),
        exact: true,
      });
    },

    async listFiles() {
      const baseUrl = requireBaseUrl();
      const sessions = sessionsOf(await fetchResources(SESSION_RESOURCES));
      const files = await Promise.all(
        sessions.map(({ sessionId }) => listChatFiles(baseUrl, sessionId)),
      );
      return files
        .flat()
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    },

    async pinFile(sessionId, path, title) {
      const baseUrl = requireBaseUrl();
      await pinSessionFile({
        baseUrl,
        sessionId,
        authToken: getAuthToken(),
        path,
        title,
      });
      await queryClient.invalidateQueries({
        queryKey: sessionFilesKey(baseUrl, sessionId),
      });
    },

    async unpinFile(sessionId, path) {
      const baseUrl = requireBaseUrl();
      await unpinSessionFile({
        baseUrl,
        sessionId,
        authToken: getAuthToken(),
        path,
      });
      await queryClient.invalidateQueries({
        queryKey: sessionFilesKey(baseUrl, sessionId),
      });
    },

    async listChatRuns(sessionId) {
      return sessionRunsOf(await getTangent().listResources(sessionId));
    },

    async dismissChatRun(sessionId, runId) {
      const tangent = getTangent();
      const run = sessionRunsOf(await tangent.listResources(sessionId)).find(
        ({ id }) => id === runId,
      );
      if (!run) return false;
      await tangent.addResource(sessionId, runEntry(run, true));
      await queryClient.invalidateQueries({
        queryKey: sessionRunsKey(sessionId),
      });
      return true;
    },

    async addRun(runId, name) {
      const target = formatWorkareaTarget(runTarget(runId));
      const summaries = await fetchResources(CARD_RESOURCES);
      if (summaries.some(({ metadata }) => metadata?.identity === target)) {
        return { added: false, target };
      }
      const run = await getRunDetails(runId);
      await createProjectResource(
        projectId,
        pipelineRunResourceInput(
          runId,
          name ?? run.pipeline_name ?? `Run ${runId}`,
        ),
      );
      await onResourcesChanged();
      return { added: true, target };
    },

    async addDocument(title, content) {
      const resource = await createProjectResource(
        projectId,
        documentResourceInput(title, content),
      );
      await onResourcesChanged();
      return formatWorkareaTarget({
        type: "document",
        identity: idIdentity(resource.id),
      });
    },
  };
}
