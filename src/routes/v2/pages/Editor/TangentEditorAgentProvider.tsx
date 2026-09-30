/**
 * Hosts a Tangent editor sub-agent bound to this embedded pipeline tab.
 *
 * Builds the same `ToolBridgeApi` the in-editor Sidekick uses — live CSOM
 * mutations against this tab's spec stores plus the shared run/debug reads —
 * and hands it to {@link TangentRemoteEnvProvider} with `mode: "editor"`. A
 * sub-agent Prime spawns into this tab's environment therefore edits the exact
 * pipeline the user is looking at, and its changes are undoable canvas edits.
 *
 * Must render inside the embed's `SharedStoreProvider` + `EditorSessionProvider`
 * so `useSharedStores` / `useEditorSession` resolve this tab's live stores.
 */
import { useReactFlow } from "@xyflow/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { TangentRemoteEnvProvider } from "@/routes/v2/pages/Tangent/components/TangentRemoteEnvProvider";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useLazyBridgeAuth } from "@/routes/v2/shared/components/AiChat/toolBridge/useLazyBridgeAuth";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { idIdentity } from "@/services/projects/resourceTarget";

import { createEditorToolBridge } from "./components/AiChat/toolBridge";
import { fitViewAfterEdits } from "./components/AiChat/toolBridge/fitViewAfterEdits";
import { renamePipelineFileFor } from "./hooks/renamePipelineFileFor";
import { useEditorSession } from "./store/EditorSessionContext";

interface TangentEditorAgentProviderProps {
  sessionId: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
  children?: ReactNode;
}

export function TangentEditorAgentProvider({
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
  children,
}: TangentEditorAgentProviderProps) {
  const { navigation, editor } = useSharedStores();
  const editorSession = useEditorSession();
  const project = useTangentProject();
  const { getBackendUrl, getAuthToken, queryClient } = useLazyBridgeAuth();
  const { getNodes, getEdges } = useReactFlow();
  const runAnnotations = useRunSubmissionAnnotations();
  const runAnnotationsRef = useRef(runAnnotations);

  useEffect(() => {
    runAnnotationsRef.current = runAnnotations;
  }, [runAnnotations]);

  // A single bridge instance per mount: every method re-reads the live spec,
  // active subgraph, and backend/auth values lazily, so navigation and config
  // changes are picked up without rebuilding the bridge (and the worker).
  const [bridge] = useState<ToolBridgeApi>(() =>
    createEditorToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((entry) => entry.displayName),
      getActiveSubgraphTaskId: () => navigation.parentContext?.taskId,
      getNodes,
      getEdges,
      getBackendUrl,
      getAuthToken,
      getRunAnnotations: () => runAnnotationsRef.current,
      queryClient,
      undo: fitViewAfterEdits(editorSession.undo, editor),
      renamePipelineFile: renamePipelineFileFor(
        editorSession.pipelineFile,
        (fileId, title) =>
          project.retitleWorkareaTarget(
            { type: "pipeline", identity: idIdentity(fileId) },
            title,
          ),
      ),
    }),
  );

  return (
    <TangentRemoteEnvProvider
      sessionId={sessionId}
      bridge={bridge}
      context={{ mode: "editor" }}
      environmentId={environmentId}
      onEnvironmentReady={onEnvironmentReady}
      onEnvironmentClosed={onEnvironmentClosed}
      onBridgeReady={onBridgeReady}
      onBridgeClosed={onBridgeClosed}
    >
      {children}
    </TangentRemoteEnvProvider>
  );
}
