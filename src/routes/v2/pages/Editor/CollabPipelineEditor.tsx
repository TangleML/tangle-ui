import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { InlineStack } from "@/components/ui/layout";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { AiChatStoreProvider } from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import { useCanvasControlsWindow } from "@/routes/v2/shared/components/MiniMap/useCanvasControlsWindow";
import { useDockAreaAccordion } from "@/routes/v2/shared/hooks/useDockAreaAccordion";
import { useFocusMode } from "@/routes/v2/shared/hooks/useFocusMode";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import { useWindowPersistence } from "@/routes/v2/shared/windows/windowPersistence";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { createEditorAgentWorker } from "./components/AiChat/editorAgentWorker";
import { useCollabDebugWindow } from "./components/CollabDebug/useCollabDebugWindow";
import { CollabEditorMenuBar } from "./components/CollabEditorMenuBar/CollabEditorMenuBar";
import { useDebugPanelWindow } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { QuickRunSubmitterProvider } from "./components/QuickRunSubmitterContext";
import { RemoteCursorsOverlay } from "./components/RemoteCursors/RemoteCursorsOverlay";
import { useAiChatWindow } from "./hooks/useAiChatWindow";
import { useCollabRoom } from "./hooks/useCollabRoom";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useComponentSearchV2Window } from "./hooks/useComponentSearchV2Window";
import { useEditorEscapeShortcut } from "./hooks/useEditorEscapeShortcut";
import { useEmptyCollabRoot } from "./hooks/useEmptyCollabRoot";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import { usePipelineTreeWindow } from "./hooks/usePipelineTreeWindow";
import { usePropertiesWindowPositioning } from "./hooks/usePropertiesWindowPositioning";
import { useRecentRunsWindow } from "./hooks/useRecentRunsWindow";
import { useRunsAndSubmissionWindow } from "./hooks/useRunsAndSubmissionWindow";
import { useSeedInitialDockLayoutFromPreset } from "./hooks/useSeedInitialDockLayoutFromPreset";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useTipOfTheDayWindow } from "./hooks/useTipOfTheDayWindow";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { editorRegistry } from "./nodes";
import { EditorSessionProvider } from "./store/EditorSessionContext";

const COLLAB_WINDOW_LAYOUT_ID = "collab-editor";

const CollabPipelineEditorCanvas = observer(
  ({ roomId }: { roomId: string }) => {
    const rootSpec = useEmptyCollabRoot();
    const [pipelineRef] = useState<PipelineRef>(() => ({ name: roomId }));
    const { navigation } = useSharedStores();

    useWindowPersistence(COLLAB_WINDOW_LAYOUT_ID);
    useDockAreaAccordion();
    useSpecLifecycle(rootSpec, pipelineRef);
    useSelectionWindowSync();
    usePropertiesWindowPositioning();
    useLinkedWindowCleanup();

    const componentSearchV2Enabled = useFlagValue("component-search-v2");
    useComponentLibraryWindow(!componentSearchV2Enabled);
    usePipelineDetailsWindow();
    usePipelineTreeWindow();
    useHistoryWindow();
    useCanvasControlsWindow("v2.pipeline_canvas");
    useRecentRunsWindow();
    useRunsAndSubmissionWindow();
    useUndoRedoKeyboard();
    useFocusMode();
    useShortcutListener();
    useEditorEscapeShortcut();
    useDebugPanelWindow();
    useTipOfTheDayWindow();

    const { active: collabActive } = useCollabRoom();
    useCollabDebugWindow(collabActive);

    const aiEnabled = useFlagValue("ai-assistant");
    useAiChatWindow(aiEnabled);

    useComponentSearchV2Window(componentSearchV2Enabled);
    useSeedInitialDockLayoutFromPreset(componentSearchV2Enabled);

    const activeSpec = navigation.activeSpec;
    if (!activeSpec) return null;

    return (
      <NodeRegistryProvider registry={editorRegistry}>
        <SpecProvider spec={activeSpec}>
          <CollabEditorMenuBar roomId={roomId} />
          <InlineStack
            className="flex-1 min-h-0 w-full"
            blockAlign="stretch"
            wrap="nowrap"
            data-testid="editor-v2"
            data-editor-ready="true"
          >
            <DockArea side="left" />
            <div
              className="relative flex-1 min-w-0 h-full"
              data-tour="editor-canvas"
            >
              <FlowCanvas
                key={activeSpec.$id ?? "root"}
                spec={activeSpec}
                className="h-full"
              />
              <RemoteCursorsOverlay />
              <WindowContainer />
            </div>
            <DockArea side="right" />
          </InlineStack>
        </SpecProvider>
      </NodeRegistryProvider>
    );
  },
);

export function CollabPipelineEditor() {
  const params = useParams({ strict: false });
  const roomId =
    "roomId" in params && typeof params.roomId === "string"
      ? params.roomId
      : null;

  if (!roomId) return null;

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <EditorSessionProvider>
          <AiChatStoreProvider
            createWorker={createEditorAgentWorker}
            context={{ mode: "editor" }}
          >
            <DialogProvider>
              <ComponentLibraryProvider>
                <ComponentEditorProvider>
                  <ReactFlowProvider>
                    <QuickRunSubmitterProvider>
                      <ForcedSearchProvider>
                        <CollabPipelineEditorCanvas
                          key={roomId}
                          roomId={roomId}
                        />
                      </ForcedSearchProvider>
                    </QuickRunSubmitterProvider>
                  </ReactFlowProvider>
                </ComponentEditorProvider>
              </ComponentLibraryProvider>
            </DialogProvider>
          </AiChatStoreProvider>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </div>
  );
}
