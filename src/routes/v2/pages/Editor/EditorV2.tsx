import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import {
  useLocation,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { type ReactNode, useEffect, useState } from "react";

import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { TourSaveExploreDialog } from "@/providers/TourProvider/TourSaveExploreDialog";
import { TourSecretsDialog } from "@/providers/TourProvider/TourSecretsDialog";
import { getEditorLocation } from "@/routes/editorRoutes";
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
import {
  TOUR_WINDOW_LAYOUT_ID,
  useWindowPersistence,
} from "@/routes/v2/shared/windows/windowPersistence";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { createEditorAgentWorker } from "./components/AiChat/editorAgentWorker";
import { useDebugPanelWindow } from "./components/DebugPanel";
import { DriverPermissionGate } from "./components/DriverPermissionGate";
import { EditorMenuBar } from "./components/EditorMenuBar/EditorMenuBar";
import { EditorTourBridge } from "./components/EditorTourBridge/EditorTourBridge";
import { EmptyEditorState } from "./components/EmptyEditorState";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { useAiChatWindow } from "./hooks/useAiChatWindow";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useComponentSearchV2Window } from "./hooks/useComponentSearchV2Window";
import { useEditorEscapeShortcut } from "./hooks/useEditorEscapeShortcut";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { useLoadSpec } from "./hooks/useLoadSpec";
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
import { readOnlyEditorRegistry } from "./nodes/readOnlyEditorRegistry";
import {
  EditorSessionProvider,
  useEditorSession,
} from "./store/EditorSessionContext";

interface PipelineEditorProps {
  pipelineRef: PipelineRef;
  routeRef: PipelineRef;
}

declare module "@tanstack/history" {
  interface HistoryState {
    editorPipelineSession?: {
      scope: string;
      pipelineName: string;
      pipelineRef: PipelineRef;
    };
  }
}

const PipelineEditorSkeleton = () => (
  <LoadingScreen message="Loading pipeline..." />
);

const PipelineEditor = withSuspenseWrapper(
  observer(({ pipelineRef, routeRef }: PipelineEditorProps) => {
    const session = useEditorSession();
    const storage = usePipelineStorage();
    const {
      data: { spec: rootSpec, file, restoredUndoStore },
    } = useLoadSpec(pipelineRef, session.id);
    const { navigation } = useSharedStores();
    const navigate = useNavigate();
    const tourMode = useTourMode();
    const referenceId = file.referenceId;
    const displayName = file.displayName;
    const storageKind = file.storageKind;

    useEffect(() => {
      if (tourMode) return;
      addRecentlyViewed({
        type: "pipeline",
        id: referenceId,
        name: displayName,
      });
    }, [referenceId, displayName, tourMode]);

    useEffect(() => {
      if (tourMode || storageKind !== "remote") return;
      const location = getEditorLocation(file);
      if (routeRef.name === location.params.pipelineName && !routeRef.fileId)
        return;
      void navigate({
        ...location,
        replace: true,
        resetScroll: false,
        // A new address for this document must not recreate its model or undo history.
        state: {
          editorPipelineSession: {
            scope: storage.scope,
            pipelineName: location.params.pipelineName,
            pipelineRef,
          },
        },
      });
    }, [
      navigate,
      file,
      pipelineRef,
      routeRef.name,
      routeRef.fileId,
      referenceId,
      storageKind,
      storage.scope,
      tourMode,
    ]);

    useWindowPersistence(tourMode ? TOUR_WINDOW_LAYOUT_ID : "editor");
    useDockAreaAccordion();
    useSpecLifecycle(rootSpec, file, restoredUndoStore);
    useSelectionWindowSync();
    usePropertiesWindowPositioning();
    useLinkedWindowCleanup();

    const componentSearchV2Enabled = useFlagValue("component-search-v2");
    useComponentLibraryWindow(file.canEdit && !componentSearchV2Enabled);
    usePipelineDetailsWindow();
    usePipelineTreeWindow();
    useHistoryWindow(file.canEdit);
    useCanvasControlsWindow("v2.pipeline_canvas");
    useRecentRunsWindow();
    useRunsAndSubmissionWindow();
    useUndoRedoKeyboard(file.canEdit);
    useFocusMode();
    useShortcutListener();
    useEditorEscapeShortcut();
    useDebugPanelWindow(file.canEdit);
    useTipOfTheDayWindow();

    const aiEnabled = useFlagValue("ai-assistant");
    useAiChatWindow(aiEnabled && file.canEdit);

    useComponentSearchV2Window(componentSearchV2Enabled && file.canEdit);
    useSeedInitialDockLayoutFromPreset(componentSearchV2Enabled);

    const activeSpec = navigation.activeSpec;

    if (!activeSpec) return null;

    return (
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
            <DockArea side="left" />
            <div
              className="relative flex-1 min-w-0 h-full"
              data-tour="editor-canvas"
            >
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
  }),
  PipelineEditorSkeleton,
);

function EditorV2Content({
  pipelineRef,
  routeRef,
}: {
  pipelineRef: PipelineRef | null;
  routeRef: PipelineRef | null;
}) {
  const { navigation } = useSharedStores();
  const tourMode = useTourMode();

  useEffect(() => {
    navigation.setRequestedPipelineName(pipelineRef?.name ?? null);
  }, [navigation, pipelineRef?.name]);

  let body: ReactNode;
  if (pipelineRef) {
    body = (
      <DriverPermissionGate pipelineRef={pipelineRef}>
        <PipelineEditor
          pipelineRef={pipelineRef}
          routeRef={routeRef ?? pipelineRef}
        />
      </DriverPermissionGate>
    );
  } else if (tourMode) {
    body = <PipelineEditorSkeleton />;
  } else {
    body = <EmptyEditorState />;
  }

  return (
    <ComponentLibraryProvider>
      <ComponentEditorProvider>
        <ReactFlowProvider>
          <EditorMenuBar />
          <EditorTourBridge />
          <TourSaveExploreDialog />
          <TourSecretsDialog />
          <ForcedSearchProvider>{body}</ForcedSearchProvider>
        </ReactFlowProvider>
      </ComponentEditorProvider>
    </ComponentLibraryProvider>
  );
}

// Non-editor-v2 routes (e.g. `/tour/$tourId`) pass `pipelineRef` directly.
// Without a prop, we fall back to reading the route's params/search.
export function EditorV2({
  pipelineRef: pipelineRefProp,
}: {
  pipelineRef?: PipelineRef | null;
} = {}) {
  const params = useParams({ strict: false });
  const storage = usePipelineStorage();
  const locationState = useLocation({ select: (location) => location.state });
  const search = useSearch({ strict: false });
  const fileId =
    "fileId" in search && typeof search.fileId === "string"
      ? search.fileId
      : undefined;

  const pipelineName =
    "pipelineName" in params && typeof params.pipelineName === "string"
      ? params.pipelineName
      : null;

  const routeRef: PipelineRef | null =
    pipelineRefProp !== undefined
      ? pipelineRefProp
      : pipelineName
        ? { name: pipelineName, fileId }
        : null;
  const [activePipeline, setActivePipeline] = useState({
    scope: storage.scope,
    pipelineRef: routeRef,
  });
  const preservedSession = locationState.editorPipelineSession;
  const pipelineRef =
    pipelineRefProp === undefined &&
    preservedSession?.scope === storage.scope &&
    activePipeline.scope === storage.scope &&
    activePipeline.pipelineRef?.name === preservedSession.pipelineRef.name &&
    activePipeline.pipelineRef?.fileId ===
      preservedSession.pipelineRef.fileId &&
    preservedSession.pipelineName === routeRef?.name &&
    !routeRef?.fileId
      ? preservedSession.pipelineRef
      : routeRef;
  // History aliases only preserve the currently mounted document, never a later reopening.
  if (
    activePipeline.scope !== storage.scope ||
    activePipeline.pipelineRef?.name !== pipelineRef?.name ||
    activePipeline.pipelineRef?.fileId !== pipelineRef?.fileId
  ) {
    setActivePipeline({ scope: storage.scope, pipelineRef });
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider
        key={`${storage.scope}:${pipelineRef?.fileId ?? pipelineRef?.name ?? "empty"}`}
      >
        <EditorSessionProvider>
          <AiChatStoreProvider
            createWorker={createEditorAgentWorker}
            context={{ mode: "editor" }}
          >
            <DialogProvider>
              <EditorV2Content pipelineRef={pipelineRef} routeRef={routeRef} />
            </DialogProvider>
          </AiChatStoreProvider>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </div>
  );
}
