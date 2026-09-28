/**
 * Connects the Tangent project workspace to the `/remote-env` gateway as the
 * session's default environment.
 *
 * This one environment does two jobs on a single socket:
 * - Hosts the workarea RPC **tools** (open / list / read / close tabs, plus
 *   run inspect) so an agent can arrange and read the Dynamic Workarea.
 * - Hosts an editor sub-agent **runtime** (spawn / message / kill) bound to a
 *   routing bridge that drives whichever pipeline tab is active. This catches
 *   editor spawns that Prime does not bind to a specific tab's environment; per
 *   tab, the embedded views still host their own environment for spawns
 *   explicitly bound to that tab.
 *
 * It mints a scoped token, boots the agent worker, connects, and re-registers
 * the tool catalog on reconnect. It renders `children` unchanged.
 */
import { useQueryClient } from "@tanstack/react-query";
import * as Comlink from "comlink";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { RemoteEnvWorkerApi } from "@/agent/createRemoteEnvWorkerApi";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { connectRemoteEnvWithRefresh } from "@/routes/v2/pages/Tangent/services/connectRemoteEnvWithRefresh";
import {
  createActiveTabRoutingBridge,
  createAgentTargetRouter,
} from "@/routes/v2/pages/Tangent/services/createActiveTabRoutingBridge";
import {
  createWorkareaRemoteTools,
  type RunInspectDeps,
} from "@/routes/v2/pages/Tangent/services/createWorkareaRemoteTools";
import { createRemoteEnvAgentWorker } from "@/routes/v2/pages/Tangent/services/remoteEnvAgentWorker";
import { createRemoteEnvHost } from "@/routes/v2/pages/Tangent/services/remoteEnvHost";
import { localPipelineByNameResourceExtraData } from "@/routes/v2/pages/Tangent/workarea/resourceExtraData";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import { createProjectResource } from "@/services/projects/projectResourcesService";
import {
  ProjectResourcesQueryKeys,
  ProjectsQueryKeys,
} from "@/services/projects/types";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";
import { extractCloneableTaskArguments } from "@/utils/nodes/taskArguments";

interface TangentProjectAgentProviderProps {
  sessionId: string | undefined;
  children: ReactNode;
}

/**
 * @todo: deduplicate with ClonePipelineButton
 */
async function clonePipelineFromRun(
  runInspect: RunInspectDeps,
  runId: string,
): Promise<{ pipelineName: string }> {
  const run = await runInspect.getRunDetails(runId);
  const rootExecutionId = run.root_execution_id;
  if (!rootExecutionId) {
    throw new Error(`Run ${runId} has no root execution to clone.`);
  }
  const details = await runInspect.getExecutionDetails(rootExecutionId);
  const componentSpec = details.task_spec.componentRef.spec;

  if (!isValidComponentSpec(componentSpec)) {
    throw new Error(`Run ${runId} has no pipeline spec to clone.`);
  }
  const taskArguments = extractCloneableTaskArguments(
    details.task_spec.arguments,
  );
  // The API types the spec as ComponentSpecOutput (nullable name); the domain
  // ComponentSpec differs only in that nullability and is handled at runtime by
  // downstream consumers, matching useRunViewLoadState.
  const canonicalName = extractCanonicalName(
    buildTaskSpecShape(details?.task_spec, componentSpec),
  );

  const name = getInitialName(componentSpec, canonicalName);
  const result = await copyRunToPipeline(
    componentSpec,
    runId,
    name,
    taskArguments,
  );

  if (!result.name) {
    throw new Error(`Failed to clone the pipeline for run ${runId}.`);
  }
  return { pipelineName: result.name };
}

export function TangentProjectAgentProvider({
  sessionId,
  children,
}: TangentProjectAgentProviderProps) {
  const notify = useToastNotification();
  const { config: aiConfig } = useAiProviderSettings();
  const { backendUrl } = useBackend();
  const queryClient = useQueryClient();
  const store = useTangentProject();
  const { baseUrl } = useTangentBaseUrl(store.projectId);

  const authToken = useRemoteEnvAuthToken();
  const authTokenRef = useRef(authToken);
  const backendUrlRef = useRef(backendUrl);
  const notifyRef = useRef(notify);
  const aiConfigRef = useRef(aiConfig);
  const workerRef = useRef<Comlink.Remote<RemoteEnvWorkerApi> | null>(null);

  // A project-level backend bridge for the run inspect tools: read-only run and
  // execution fetches that don't need any one tab's canvas spec, so Prime can
  // inspect runs without spawning a sub-agent. Backend/auth are read lazily via
  // refs so a single instance survives config changes.
  const [runInspect] = useState<RunInspectDeps>(() => {
    const deps: BridgeDeps = {
      getSpec: () => null,
      getActiveSubgraphPath: () => [],
      getActiveSubgraphTaskId: () => undefined,
      getBackendUrl: () => backendUrlRef.current,
      getAuthToken: () => authTokenRef.current,
      queryClient,
    };
    const run = createRunBridgeHandlers(deps);
    const debug = createDebugBridgeHandlers(deps);
    return {
      getRunDetails: run.getRunDetails,
      debugPipelineRun: run.debugPipelineRun,
      getExecutionDetails: debug.getExecutionDetails,
      getExecutionState: debug.getExecutionState,
      getContainerState: debug.getContainerState,
      getContainerLog: debug.getContainerLog,
    };
  });

  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  // Push AI config into the worker whenever the user changes it, so a turn
  // uses the latest provider settings without rebuilding the connection.
  useEffect(() => {
    aiConfigRef.current = aiConfig;
    void workerRef.current?.setAiConfig(aiConfig);
  }, [aiConfig]);

  const refreshProjectResources = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ProjectResourcesQueryKeys.All(store.projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(store.projectId),
      }),
    ]);
  };

  const [tools] = useState(() =>
    createWorkareaRemoteTools(() => ({
      openTarget: (target, title) => store.openWorkareaTarget(target, title),
      getTabs: () => store.workareaTabs,
      getActiveTabId: () => store.activeWorkareaTabId ?? undefined,
      closeTab: (id) => store.closeWorkareaTab(id),
      getEnvironmentId: (id) => store.getTabEnvironmentId(id),
      waitForEnvironment: (id) => store.waitForTabEnvironment(id),
      runInspect,
      clonePipeline: async (runId) => {
        const { pipelineName } = await clonePipelineFromRun(runInspect, runId);
        await createProjectResource(store.projectId, {
          entity: "document",
          name: pipelineName,
          extraData: localPipelineByNameResourceExtraData(pipelineName),
          payload: {},
        });
        await refreshProjectResources();
        return { pipelineName };
      },
      refreshResources: refreshProjectResources,
    })),
  );
  const [routingBridge] = useState(() =>
    createActiveTabRoutingBridge(() => store.getActiveTabBridge()),
  );
  const [agentTargets] = useState(() =>
    createAgentTargetRouter(() => store.getActiveTabBridge()),
  );

  useEffect(() => {
    if (!sessionId || !baseUrl) return;
    const activeSessionId = sessionId;

    const onError = (message: string) => notifyRef.current(message, "error");

    const worker = createRemoteEnvAgentWorker();
    const remote = Comlink.wrap<RemoteEnvWorkerApi>(worker);
    workerRef.current = remote;

    void remote.init(Comlink.proxy(routingBridge), { mode: "editor" });
    void remote.setAiConfig(aiConfigRef.current);

    const host = createRemoteEnvHost({
      url: baseUrl,
      worker: remote,
      onError,
      tools,
      sessionId: activeSessionId,
      agentTargets,
    });

    const stop = connectRemoteEnvWithRefresh({
      host,
      baseUrl,
      sessionId: activeSessionId,
      // A stable id so this project-level workarea host keeps its place across
      // token refreshes, mirroring the per-tab `${sessionId}:${tabId}` ids.
      initialEnvironmentId: `${activeSessionId}:workarea`,
      getAuthToken: () => authTokenRef.current,
      onError,
    });

    return () => {
      stop();
      host.disconnect();
      worker.terminate();
      workerRef.current = null;
    };
  }, [sessionId, tools, routingBridge, agentTargets, baseUrl]);

  return <>{children}</>;
}
