import type { EmbedCommand } from "@tangent/embed-react";
import * as yaml from "js-yaml";
import { useEffect, useRef } from "react";

import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { hydrateLoadedSpecRefs } from "@/routes/v2/pages/Editor/utils/hydrateSpecRefs";
import { useProjectCardHandlers } from "@/routes/v2/pages/Tangent/context/ProjectCardHandlersContext";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useRecordSessionRun } from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import {
  ASSET_LIMIT,
  assetsResult,
  documentsResult,
  filesResult,
  parsePipelineIds,
  pipelinesResult,
  type ProjectListing,
  RUN_LIMIT,
  runsResult,
  type RunStart,
  runStartsResult,
  targetId,
} from "@/routes/v2/pages/Tangent/services/chatCommandResults";
import type { ProjectCardEntry } from "@/routes/v2/pages/Tangent/services/createProjectCardHandlers";
import {
  type SessionFileRecord,
  sessionFileUrl,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { pipelineRefForTarget } from "@/routes/v2/pages/Tangent/workarea/pipelineRef";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import { useLazyBridgeAuth } from "@/routes/v2/shared/components/AiChat/toolBridge/useLazyBridgeAuth";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  formatWorkareaTarget,
  parseIdentity,
  parseWorkareaTarget,
  runTarget,
} from "@/services/projects/resourceTarget";
import { runExecutionStatsQuery } from "@/services/projects/useProjectRuns";
import { useTeamForSubmission } from "@/services/teams/useTeamForSubmission";
import { buildProjectRunAnnotationKey } from "@/utils/annotations";
import {
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { getErrorMessage } from "@/utils/string";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

/**
 * The chat box's slash commands for a project. The list commands show what the
 * project card does, and `/run` starts pipelines by id. None of them starts
 * the agent; it's sent their results with the next message.
 */
export function useChatCommands(projectId: string): EmbedCommand[] {
  const store = useTangentProject();
  const handlers = useProjectCardHandlers();
  const storage = usePipelineStorage();
  const { getBackendUrl, getAuthToken, queryClient } = useLazyBridgeAuth();
  const { baseUrl } = useTangentBaseUrl(projectId);
  const recordSessionRun = useRecordSessionRun();
  const runTeam = useTeamForSubmission([projectId]);
  const runTeamRef = useRef(runTeam);

  useEffect(() => {
    runTeamRef.current = runTeam;
  }, [runTeam]);

  // Called before a command waits on anything: the person may open another
  // chat while it runs, and the result still goes to the one it ran in.
  const fileLinks = () => ({
    thisChat: store.activeSessionId,
    fileUrl: (file: SessionFileRecord) =>
      baseUrl ? sessionFileUrl(baseUrl, file.sessionId, file.path) : file.path,
  });

  async function statusLabels(runs: ProjectCardEntry[]) {
    const labels = await Promise.all(
      runs.map(async ({ target }) => {
        const stats = await queryClient
          .fetchQuery(runExecutionStatsQuery(targetId(target), true))
          .catch(() => null);
        return stats
          ? [
              [
                target,
                getExecutionStatusLabel(
                  getOverallExecutionStatusFromStats(stats),
                ),
              ] as const,
            ]
          : [];
      }),
    );
    return new Map(labels.flat());
  }

  async function readCard(
    statusCount: number,
    withReports = false,
  ): Promise<ProjectListing> {
    const [entries, files] = await Promise.all([
      handlers.listEntries(),
      withReports ? handlers.listFiles() : [],
    ]);
    const runs = entries.runs.filter(({ archived }) => !archived);
    return {
      ...entries,
      reports: files.filter(({ pinned }) => pinned),
      runStatuses: await statusLabels(runs.slice(0, statusCount)),
    };
  }

  // Loaded the way the editor loads it, so it submits the same way.
  async function specFor({ target, name }: ProjectCardEntry) {
    const parsed = parseWorkareaTarget(target);
    if (parseIdentity(parsed.identity).key === "draft") {
      throw new Error("it's a draft that isn't saved yet");
    }
    const file = await storage.resolvePipeline(
      pipelineRefForTarget(parsed, name, {
        backendUrl: getBackendUrl(),
        storage,
      }),
    );
    const spec = new YamlDeserializer(
      new IncrementingIdGenerator(),
    ).deserialize(yaml.load(await file.read(), PIPELINE_YAML_LOAD_OPTIONS));
    await hydrateLoadedSpecRefs(spec);
    return spec;
  }

  async function start(
    id: string,
    pipelines: ProjectCardEntry[],
    sessionId: string | undefined,
  ): Promise<RunStart> {
    const pipeline = pipelines.find(({ target }) => targetId(target) === id);
    if (!pipeline) return { id, error: "not one of this project's pipelines" };
    try {
      const spec = await specFor(pipeline);
      const result = await createRunBridgeHandlers({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        getBackendUrl,
        getAuthToken,
        queryClient,
        getRunAnnotations: () => ({
          [buildProjectRunAnnotationKey(projectId)]: "true",
        }),
        getRunTeam: () => runTeamRef.current,
      }).submitPipelineRun();
      if (!result.success || !result.runId) {
        return { id, name: pipeline.name, error: result.error };
      }
      if (sessionId) {
        // Best effort: the run has started whether or not the chat noted it.
        await recordSessionRun(sessionId, result.runId, pipeline.name).catch(
          () => undefined,
        );
      }
      return {
        id,
        name: pipeline.name,
        runTarget: formatWorkareaTarget(runTarget(result.runId)),
      };
    } catch (error) {
      return { id, name: pipeline.name, error: getErrorMessage(error) };
    }
  }

  return [
    {
      name: "assets",
      description: "Everything in the project",
      run: async () => {
        const links = fileLinks();
        return assetsResult(await readCard(ASSET_LIMIT, true), links);
      },
    },
    {
      name: "pipelines",
      description: "Project pipelines",
      run: async () => pipelinesResult(await readCard(0)),
    },
    {
      name: "runs",
      description: "Latest runs",
      run: async () => runsResult(await readCard(RUN_LIMIT)),
    },
    {
      name: "documents",
      description: "Project documents",
      run: async () => documentsResult(await readCard(0)),
    },
    {
      name: "files",
      description: "Files the chats made",
      run: async () => {
        const links = fileLinks();
        return filesResult(await handlers.listFiles(), links);
      },
    },
    {
      name: "run",
      description: "Start pipelines by id",
      argumentHint: "<ids>",
      run: async (args) => {
        const ids = parsePipelineIds(args);
        if (ids.length === 0) {
          throw new Error(
            "add pipeline ids separated by commas. /pipelines lists them.",
          );
        }
        // The person may open another chat while these start.
        const sessionId = store.activeSessionId;
        const { pipelines } = await handlers.listEntries();
        const starts: RunStart[] = [];
        for (const id of ids) {
          starts.push(await start(id, pipelines, sessionId));
        }
        return runStartsResult(starts);
      },
    },
  ];
}
