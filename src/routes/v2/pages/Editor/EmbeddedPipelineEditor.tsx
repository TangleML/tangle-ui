import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useRef } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
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
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { DriverPermissionGate } from "./components/DriverPermissionGate";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useComponentSearchV2Window } from "./hooks/useComponentSearchV2Window";
import { useEditorEscapeShortcut } from "./hooks/useEditorEscapeShortcut";
import { useEmbeddedInitialDockLayout } from "./hooks/useEmbeddedInitialDockLayout";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { useLoadSpec } from "./hooks/useLoadSpec";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import { useRecentRunsWindow } from "./hooks/useRecentRunsWindow";
import { useRunsAndSubmissionWindow } from "./hooks/useRunsAndSubmissionWindow";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { editorRegistry } from "./nodes";
import { EditorSessionProvider } from "./store/EditorSessionContext";
import { TangentEditorAgentProvider } from "./TangentEditorAgentProvider";

interface EmbeddedPipelineEditorProps {
  pipelineRef: PipelineRef;
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
  pipelineRef: PipelineRef;
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
      pipelineRef,
      ...agentBoundaryProps
    }: EmbeddedPipelineEditorCanvasProps) => {
      const {
        data: { spec: rootSpec, restoredUndoStore },
      } = useLoadSpec(pipelineRef);
      const { navigation } = useSharedStores();
      const canvasRef = useRef<HTMLDivElement | null>(null);

      useSpecLifecycle(rootSpec, pipelineRef, restoredUndoStore);
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
      useComponentLibraryWindow(!componentSearchV2Enabled);
      usePipelineDetailsWindow();
      useHistoryWindow();

      useRecentRunsWindow();
      useRunsAndSubmissionWindow();
      useUndoRedoKeyboard();
      useShortcutListener();
      useEditorEscapeShortcut();

      useComponentSearchV2Window(componentSearchV2Enabled);
      useEmbeddedInitialDockLayout(componentSearchV2Enabled);

      const activeSpec = navigation.activeSpec;

      if (!activeSpec) return null;

      return (
        <>
          <NodeRegistryProvider registry={editorRegistry}>
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
          <EmbeddedEditorAgentBoundary {...agentBoundaryProps} />
        </>
      );
    },
  ),
  EmbeddedPipelineEditorSkeleton,
);

export function EmbeddedPipelineEditor({
  pipelineRef,
  onStoreReady,
  onStoreClosed,
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: EmbeddedPipelineEditorProps) {
  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <SharedStoreRegistrar onReady={onStoreReady} onClosed={onStoreClosed} />
        <EditorSessionProvider>
          <ComponentLibraryProvider>
            <ComponentEditorProvider>
              <ReactFlowProvider>
                <ForcedSearchProvider>
                  <DriverPermissionGate pipelineRef={pipelineRef}>
                    <EmbeddedPipelineEditorCanvas
                      pipelineRef={pipelineRef}
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
      </SharedStoreProvider>
    </div>
  );
}
