import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useId, useRef } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import {
  SuspenseWrapper,
  withSuspenseWrapper,
} from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { RunSubmissionScopeProvider } from "@/providers/RunSubmissionScopeProvider";
import { QuickRunSubmitterProvider } from "@/routes/v2/pages/Editor/components/QuickRunSubmitterContext";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  type SharedUIStore,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { SharedStoreRegistrar } from "@/routes/v2/shared/store/SharedStoreRegistrar";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { DriverPermissionGate } from "./components/DriverPermissionGate";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { useAutoSaveOnLeave } from "./hooks/useAutoSaveOnLeave";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useComponentSearchV2Window } from "./hooks/useComponentSearchV2Window";
import { useEditorEscapeShortcut } from "./hooks/useEditorEscapeShortcut";
import { useEmbeddedInitialDockLayout } from "./hooks/useEmbeddedInitialDockLayout";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { useLoadSpec } from "./hooks/useLoadSpec";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import { usePipelineFile } from "./hooks/usePipelineFile";
import { useRecentRunsWindow } from "./hooks/useRecentRunsWindow";
import { useRunsAndSubmissionWindow } from "./hooks/useRunsAndSubmissionWindow";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { editorRegistry } from "./nodes";
import { readOnlyEditorRegistry } from "./nodes/readOnlyEditorRegistry";
import {
  EditorSessionProvider,
  useEditorSession,
} from "./store/EditorSessionContext";
import { TangentEditorAgentProvider } from "./TangentEditorAgentProvider";

interface EmbeddedPipelineEditorProps {
  pipelineRef: PipelineRef;
  isActive: boolean;
  projectId: string;
  onStoreReady?: (store: SharedUIStore) => void;
  onStoreClosed?: () => void;
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

interface EmbeddedEditorAgentBoundaryProps {
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

interface EmbeddedPipelineEditorCanvasProps extends EmbeddedEditorAgentBoundaryProps {
  file: PipelineFile;
  isActive: boolean;
}

/**
 * Hosts the Tangent editor sub-agent only when this editor is embedded in a
 * Tangent session. The standalone `/editor-v2` route renders without a
 * `sessionId`, so it stays entirely agent-free.
 */
function EmbeddedEditorAgentBoundary({
  sessionId,
  ...rest
}: EmbeddedEditorAgentBoundaryProps) {
  if (!sessionId) return null;
  return <TangentEditorAgentProvider sessionId={sessionId} {...rest} />;
}

const EmbeddedPipelineEditorSkeleton = () => (
  <LoadingScreen message="Loading pipeline..." />
);

const EmbeddedPipelineEditorCanvas = withSuspenseWrapper(
  observer(
    ({
      file,
      isActive,
      ...agentBoundaryProps
    }: EmbeddedPipelineEditorCanvasProps) => {
      const session = useEditorSession();
      const {
        data: { spec: rootSpec, restoredUndoStore },
      } = useLoadSpec(file, session.id);
      const { navigation } = useSharedStores();
      const canvasRef = useRef<HTMLDivElement | null>(null);

      useSpecLifecycle(rootSpec, file, restoredUndoStore);
      useAutoSaveOnLeave(session.autoSave, isActive);
      useSelectionWindowSync({
        contextPanel: {
          defaultDockState: undefined,
          getInitialPosition: () => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return { x: window.innerWidth - 340, y: 80 };
            return { x: rect.right - 300 - 12, y: rect.top + 12 };
          },
        },
      });
      useLinkedWindowCleanup();

      const componentSearchV2Enabled = useFlagValue("component-search-v2");
      useComponentLibraryWindow(file.canEdit && !componentSearchV2Enabled);
      usePipelineDetailsWindow();
      useHistoryWindow(file.canEdit);

      useRecentRunsWindow();
      useRunsAndSubmissionWindow({ renderSubmitter: true });
      useUndoRedoKeyboard(file.canEdit);
      useShortcutListener(isActive);
      useEditorEscapeShortcut();

      useComponentSearchV2Window(file.canEdit && componentSearchV2Enabled);
      useEmbeddedInitialDockLayout(componentSearchV2Enabled);

      const activeSpec = navigation.activeSpec;

      if (!activeSpec) return null;

      return (
        <>
          <NodeRegistryProvider
            key={file.canEdit ? "editable" : "readonly"}
            registry={file.canEdit ? editorRegistry : readOnlyEditorRegistry}
          >
            <SpecProvider spec={activeSpec}>
              <InlineStack
                className="flex-1 min-h-0 w-full"
                blockAlign="stretch"
                wrap="nowrap"
                data-testid="editor-v2"
                data-editor-ready="true"
              >
                <div ref={canvasRef} className="relative flex-1 min-w-0 h-full">
                  <FlowCanvas
                    key={activeSpec.$id ?? "root"}
                    spec={activeSpec}
                    className="h-full"
                  />
                  <WindowContainer />
                </div>
                <DockArea side="right" />
              </InlineStack>
            </SpecProvider>
          </NodeRegistryProvider>
          {file.canEdit && (
            <EmbeddedEditorAgentBoundary {...agentBoundaryProps} />
          )}
        </>
      );
    },
  ),
  EmbeddedPipelineEditorSkeleton,
);

export function EmbeddedPipelineEditor(props: EmbeddedPipelineEditorProps) {
  const editorId = useId();
  const storage = usePipelineStorage();
  return (
    <SuspenseWrapper
      fallback={<EmbeddedPipelineEditorSkeleton />}
      resetKeys={[
        storage.scope,
        props.pipelineRef.fileId,
        props.pipelineRef.name,
      ]}
    >
      <ResolvedEmbeddedPipelineEditor {...props} editorId={editorId} />
    </SuspenseWrapper>
  );
}

function ResolvedEmbeddedPipelineEditor({
  pipelineRef,
  isActive,
  projectId,
  onStoreReady,
  onStoreClosed,
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
  editorId,
}: EmbeddedPipelineEditorProps & { editorId: string }) {
  const storage = usePipelineStorage();
  const { data: file } = usePipelineFile(pipelineRef, editorId);
  if (!file) return null;
  return (
    <RunSubmissionScopeProvider projectId={projectId}>
      <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
        <SharedStoreProvider key={`${storage.scope}:${file.id}`}>
          <SharedStoreRegistrar
            onReady={onStoreReady}
            onClosed={onStoreClosed}
          />
          <QuickRunSubmitterProvider>
            <EditorSessionProvider>
              <ComponentLibraryProvider>
                <ComponentEditorProvider>
                  <ReactFlowProvider>
                    <ForcedSearchProvider>
                      <DriverPermissionGate file={file}>
                        <EmbeddedPipelineEditorCanvas
                          file={file}
                          isActive={isActive}
                          sessionId={sessionId}
                          environmentId={environmentId}
                          onEnvironmentReady={onEnvironmentReady}
                          onEnvironmentClosed={onEnvironmentClosed}
                          onBridgeReady={onBridgeReady}
                          onBridgeClosed={onBridgeClosed}
                        />
                      </DriverPermissionGate>
                    </ForcedSearchProvider>
                  </ReactFlowProvider>
                </ComponentEditorProvider>
              </ComponentLibraryProvider>
            </EditorSessionProvider>
          </QuickRunSubmitterProvider>
        </SharedStoreProvider>
      </div>
    </RunSubmissionScopeProvider>
  );
}
