import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

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

interface EmbeddedPipelineEditorProps {
  pipelineRef: PipelineRef;
  isActive: boolean;
  onStoreReady?: (store: SharedUIStore) => void;
  onStoreClosed?: () => void;
}

const EmbeddedPipelineEditorSkeleton = () => (
  <LoadingScreen message="Loading pipeline..." />
);

const EmbeddedPipelineEditorCanvas = withSuspenseWrapper(
  observer(
    ({
      pipelineRef,
      isActive,
    }: {
      pipelineRef: PipelineRef;
      isActive: boolean;
    }) => {
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
      useShortcutListener(isActive);
      useEditorEscapeShortcut();

      useComponentSearchV2Window(componentSearchV2Enabled);
      useEmbeddedInitialDockLayout(componentSearchV2Enabled);

      const activeSpec = navigation.activeSpec;

      if (!activeSpec) return null;

      return (
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
                  key={activeSpec?.$id ?? "root"}
                  spec={activeSpec}
                  className="h-full"
                />
                <WindowContainer />
              </div>
              <DockArea side="right" />
            </InlineStack>
          </SpecProvider>
        </NodeRegistryProvider>
      );
    },
  ),
  EmbeddedPipelineEditorSkeleton,
);

function SharedStoreRegistrar({
  onReady,
  onClosed,
}: {
  onReady?: (store: SharedUIStore) => void;
  onClosed?: () => void;
}) {
  const store = useSharedStores();
  const onReadyRef = useRef(onReady);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onReadyRef.current = onReady;
    onClosedRef.current = onClosed;
  });

  // Key registration off the stable store instance, not callback identity, so a
  // parent re-render with fresh callbacks doesn't re-fire ready/closed.
  useEffect(() => {
    onReadyRef.current?.(store);
    return () => onClosedRef.current?.();
  }, [store]);

  return null;
}

export function EmbeddedPipelineEditor({
  pipelineRef,
  isActive,
  onStoreReady,
  onStoreClosed,
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
                      isActive={isActive}
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
