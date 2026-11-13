import type { Tangent } from "@tangent/embed-react";
import type { QueryClient } from "@tanstack/react-query";

import { toResourceItem } from "@/routes/v2/pages/Tangent/hooks/useProjectResourceItems";
import {
  SESSION_RESOURCES,
  sessionsOf,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import {
  dismissSessionRun,
  type SessionRun,
  sessionRunsOf,
} from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import type { RunInspectDeps } from "@/routes/v2/pages/Tangent/services/createWorkareaRemoteTools";
import {
  archivedTargets,
  setProjectItemArchived,
} from "@/routes/v2/pages/Tangent/services/projectArchive";
import { projectCardLists } from "@/routes/v2/pages/Tangent/services/projectCardEntries";
import {
  type SessionFileRecord,
  sessionFilesOf,
  setSessionFilePinned,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { sessionResourcesQuery } from "@/routes/v2/pages/Tangent/services/sessionResources";
import { attachPipelineRunOnce } from "@/services/projects/attachPipelineRun";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import { listProjectRuns } from "@/services/projects/projectRunsService";
import { getProject } from "@/services/projects/projectsService";
import { MAX_PAGE_SIZE } from "@/services/projects/queryDefaults";
import { documentResourceInput } from "@/services/projects/resourceDescriptor";
import {
  formatWorkareaTarget,
  idIdentity,
  isRunOrExecutionId,
  runTarget,
} from "@/services/projects/resourceTarget";
import type { ListProjectResourcesParams } from "@/services/projects/types";
import type { LocalPipelineStatus } from "@/services/projects/useLocalPipelineStatus";
import { projectResourcesQueryOptions } from "@/services/projects/useProjectResources";

/** A row on the project card, addressed by its formatted workarea target. */
export interface ProjectCardEntry {
  target: string;
  name: string;
  at: Date | null;
  archived: boolean;
}

interface ProjectCardEntries {
  runs: ProjectCardEntry[];
  pipelines: ProjectCardEntry[];
  documents: ProjectCardEntry[];
}

/** Live handles into the project card and the chat's runs pill. */
export interface ProjectCardToolDeps {
  getActiveSessionId: () => string | undefined;
  listEntries: () => Promise<ProjectCardEntries>;
  setArchived: (target: string, archived: boolean) => Promise<void>;
  listFiles: () => Promise<SessionFileRecord[]>;
  listChatFiles: (sessionId: string) => Promise<SessionFileRecord[]>;
  pinFile: (sessionId: string, path: string, title: string) => Promise<void>;
  unpinFile: (sessionId: string, path: string) => Promise<void>;
  listChatRuns: (sessionId: string) => Promise<SessionRun[]>;
  dismissChatRun: (sessionId: string, runId: string) => Promise<boolean>;
  addRun: (
    runId: string,
    name?: string,
  ) => Promise<{ added: boolean; target: string }>;
  addDocument: (title: string, content: string) => Promise<string>;
}

/** What this browser knows about the project's pipelines, as the card shows them. */
export interface PipelineLookups {
  localPipelines: LocalPipelineStatus;
  remotePipelineNames: ReadonlyMap<string, string>;
}

interface ProjectCardHandlerOptions {
  projectId: string;
  queryClient: QueryClient;
  getActiveSessionId: () => string | undefined;
  getBaseUrl: () => string | undefined;
  getAuthToken: () => string | undefined;
  getTangent: () => Tangent;
  getPipelineLookups: () => PipelineLookups;
  getRunDetails: RunInspectDeps["getRunDetails"];
  onResourcesChanged: () => Promise<void>;
}

const CARD_RESOURCES: ListProjectResourcesParams = {
  entity: ["document", "pipeline"],
  pageSize: MAX_PAGE_SIZE,
};

function entryOf({
  key,
  name,
  at,
  archived,
}: {
  key: string;
  name: string;
  at: Date | null;
  archived: boolean;
}): ProjectCardEntry {
  return { target: key, name, at, archived };
}

/**
 * The project card's reads and writes, outside React, for the agent's tools
 * and the chat's commands. Reads skip the cache so the agent sees what's there
 * now; writes are the ones the card's own buttons make.
 */
export function createProjectCardHandlers({
  projectId,
  queryClient,
  getActiveSessionId,
  getBaseUrl,
  getAuthToken,
  getTangent,
  getPipelineLookups,
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

  const readChat = (sessionId: string) =>
    queryClient.fetchQuery({
      ...sessionResourcesQuery(getTangent(), sessionId),
      staleTime: 0,
    });

  const readChatFiles = (sessionId: string) =>
    readChat(sessionId).then(
      (resources) => sessionFilesOf(sessionId, resources),
      // The card skips a chat it can't read, such as someone else's.
      (): SessionFileRecord[] => [],
    );

  function fileRequest(sessionId: string, path: string, title = path) {
    const baseUrl = getBaseUrl();
    if (!baseUrl) throw new Error("This page can't reach Tangent right now.");
    return { baseUrl, sessionId, authToken: getAuthToken(), path, title };
  }

  return {
    getActiveSessionId,

    async listEntries() {
      const [summaries, projectRuns, project] = await Promise.all([
        fetchResources(CARD_RESOURCES),
        listProjectRuns(projectId),
        getProject(projectId),
      ]);
      const { localPipelines, remotePipelineNames } = getPipelineLookups();
      const lists = projectCardLists({
        items: summaries.flatMap(
          (summary) =>
            toResourceItem(summary, localPipelines, remotePipelineNames) ?? [],
        ),
        summaries,
        projectRuns: projectRuns.items,
        archived: new Set(archivedTargets(project.metadata)),
      });
      return {
        runs: lists.runs.map((run) =>
          entryOf({ ...run, name: run.pipelineName, at: run.ranAt }),
        ),
        pipelines: lists.pipelines.map((item) =>
          entryOf({ ...item, at: item.addedAt }),
        ),
        documents: lists.documents.map((item) =>
          entryOf({ ...item, at: item.addedAt }),
        ),
      };
    },

    setArchived: (target, archived) =>
      setProjectItemArchived(queryClient, projectId, target, archived),

    async listFiles() {
      const sessions = sessionsOf(await fetchResources(SESSION_RESOURCES));
      const files = await Promise.all(
        sessions.map(({ sessionId }) => readChatFiles(sessionId)),
      );
      return files
        .flat()
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    },

    async listChatFiles(sessionId) {
      const sessions = sessionsOf(await fetchResources(SESSION_RESOURCES));
      const inProject = sessions.some(
        (session) => session.sessionId === sessionId,
      );
      return inProject ? readChatFiles(sessionId) : [];
    },

    pinFile: (sessionId, path, title) =>
      setSessionFilePinned(
        queryClient,
        fileRequest(sessionId, path, title),
        true,
      ),

    unpinFile: (sessionId, path) =>
      setSessionFilePinned(queryClient, fileRequest(sessionId, path), false),

    async listChatRuns(sessionId) {
      return sessionRunsOf(await readChat(sessionId));
    },

    async dismissChatRun(sessionId, runId) {
      const run = sessionRunsOf(await readChat(sessionId)).find(
        ({ id }) => id === runId,
      );
      if (!run) return false;
      await dismissSessionRun(queryClient, getTangent(), sessionId, run);
      return true;
    },

    async addRun(runId, name) {
      if (!isRunOrExecutionId(runId)) {
        throw new Error(
          `\`${runId}\` isn't a pipeline run's id: an id holds only letters, digits, hyphens and underscores.`,
        );
      }
      const target = formatWorkareaTarget(runTarget(runId));
      const added = await attachPipelineRunOnce(projectId, {
        runId,
        // Fetched even when named, so a run id that doesn't exist isn't added.
        pipelineName: async () => {
          const run = await getRunDetails(runId);
          return name ?? run.pipeline_name ?? `Run ${runId}`;
        },
      });
      if (added) await onResourcesChanged();
      return { added, target };
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
