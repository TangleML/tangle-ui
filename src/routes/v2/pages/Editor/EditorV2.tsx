import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { useQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { type ReactNode, useEffect } from "react";
import type { FallbackProps } from "react-error-boundary";

import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { LocalPipelineMigration } from "@/components/shared/LocalPipelineMigration";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { TourSaveExploreDialog } from "@/providers/TourProvider/TourSaveExploreDialog";
import { TourSecretsDialog } from "@/providers/TourProvider/TourSecretsDialog";
import { APP_ROUTES } from "@/routes/appRoutes";
import { readProjectIdParam } from "@/routes/projectRunSearch";
import { QuickRunSubmitterProvider } from "@/routes/v2/pages/Editor/components/QuickRunSubmitterContext";
import {
  AiChatStoreProvider,
  useAiChatStore,
} from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
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
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineDraftRef,
  isRemotePipelineRef,
  type PipelineRef,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
} from "@/services/pipelineStorage/types";

import { createEditorAgentWorker } from "./components/AiChat/editorAgentWorker";
import { useDebugPanelWindow } from "./components/DebugPanel";
import { DriverPermissionGate } from "./components/DriverPermissionGate";
import { createNewPipeline } from "./components/EditorMenuBar/components/fileMenu.actions";
import { EditorMenuBar } from "./components/EditorMenuBar/EditorMenuBar";
import { EditorTourBridge } from "./components/EditorTourBridge/EditorTourBridge";
import { EmptyEditorState } from "./components/EmptyEditorState";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { RemotePipelineError } from "./components/RemotePipelineView/RemotePipelineError";
import { RemotePipelineShell } from "./components/RemotePipelineView/RemotePipelineShell";
import { RemotePipelineView } from "./components/RemotePipelineView/RemotePipelineView";
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
import { useRemoteDraftPromotion } from "./hooks/useRemoteDraftPromotion";
import { useRunsAndSubmissionWindow } from "./hooks/useRunsAndSubmissionWindow";
import { useSeedInitialDockLayoutFromPreset } from "./hooks/useSeedInitialDockLayoutFromPreset";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useTipOfTheDayWindow } from "./hooks/useTipOfTheDayWindow";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { editorRegistry } from "./nodes";
import { EditorSessionProvider } from "./store/EditorSessionContext";

interface PipelineEditorProps {
  pipelineRef: EditorPipelineRef;
}

const PipelineEditorSkeleton = () => (
  <LoadingScreen message="Loading pipeline..." />
);

const PipelineLoadError = ({ error, resetErrorBoundary }: FallbackProps) => (
  <BlockStack fill align="center" inlineAlign="center" gap="3">
    <p role="alert">
      {error instanceof Error ? error.message : "Unable to load pipeline."}
    </p>
    <Button variant="outline" onClick={resetErrorBoundary}>
      Retry
    </Button>
  </BlockStack>
);

const PipelineEditor = withSuspenseWrapper(
  observer(({ pipelineRef }: PipelineEditorProps) => {
    const {
      data: { spec: rootSpec, file, restoredUndoStore, saveState },
    } = useLoadSpec(pipelineRef);
    const { navigation } = useSharedStores();
    const tourMode = useTourMode();

    useWindowPersistence(tourMode ? TOUR_WINDOW_LAYOUT_ID : "editor");
    useDockAreaAccordion();
    useSpecLifecycle(rootSpec, file, restoredUndoStore, saveState);
    useRemoteDraftPromotion(pipelineRef, file);
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

    const aiEnabled = useFlagValue("ai-assistant");
    useAiChatWindow(aiEnabled);

    useComponentSearchV2Window(componentSearchV2Enabled);
    useSeedInitialDockLayoutFromPreset(componentSearchV2Enabled);

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
  PipelineLoadError,
);

function EditorV2Content({
  pipelineRef,
}: {
  pipelineRef: EditorPipelineRef | null;
}) {
  const { navigation } = useSharedStores();
  const tourMode = useTourMode();
  const navigate = useNavigate();
  const projectId = useRouterState({
    select: (state) => readProjectIdParam(state.matches.at(-1)?.search),
  });

  const requestedName =
    pipelineRef &&
    !isRemotePipelineRef(pipelineRef) &&
    !isRemotePipelineDraftRef(pipelineRef)
      ? pipelineRef.name
      : null;
  useEffect(() => {
    navigation.setRequestedPipelineName(requestedName);
  }, [navigation, requestedName]);

  let body: ReactNode;
  if (pipelineRef) {
    const editor = <PipelineEditor pipelineRef={pipelineRef} />;
    body = (
      <DriverPermissionGate pipelineRef={pipelineRef}>
        {"source" in pipelineRef ? (
          editor
        ) : (
          <LocalPipelineMigration
            pipelineRef={pipelineRef}
            projectId={projectId}
            onMigrated={(file, clearProjectContext) => {
              void navigate({
                to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
                params: { pipelineId: file.id },
                search: {
                  projectId: clearProjectContext ? undefined : projectId,
                },
                replace: true,
                resetScroll: false,
              });
            }}
          >
            {editor}
          </LocalPipelineMigration>
        )}
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
          <QuickRunSubmitterProvider>
            <EditorMenuBar />
            <EditorTourBridge />
            <TourSaveExploreDialog />
            <TourSecretsDialog />
            <ForcedSearchProvider>{body}</ForcedSearchProvider>
          </QuickRunSubmitterProvider>
        </ReactFlowProvider>
      </ComponentEditorProvider>
    </ComponentLibraryProvider>
  );
}

function RemotePipelineSkeleton() {
  return (
    <RemotePipelineShell>
      <PipelineEditorSkeleton />
    </RemotePipelineShell>
  );
}

const RemotePipelineDocumentView = withSuspenseWrapper(
  ({
    pipelineRef,
  }: {
    pipelineRef: RemotePipelineRef | RemotePipelineDraftRef;
  }) => {
    const {
      data: { spec, file },
    } = useLoadSpec(pipelineRef);
    return file.folder.driver.canEdit === true ? (
      <EditorV2Document key={file.initialId} pipelineRef={pipelineRef} />
    ) : (
      <RemotePipelineView spec={spec} />
    );
  },
  RemotePipelineSkeleton,
  ({ error, resetErrorBoundary }: FallbackProps) => (
    <RemotePipelineError error={error} onRetry={resetErrorBoundary} />
  ),
  ({ pipelineRef }) => [getEditorPipelineIdentity(pipelineRef)],
);

function CreateLocalPipeline({
  name,
  draftId,
}: {
  name: string;
  draftId: string;
}) {
  const storage = usePipelineStorage();
  const navigate = useNavigate();
  const {
    data: file,
    error,
    refetch,
  } = useQuery({
    queryKey: ["new-local-pipeline", draftId],
    queryFn: () => createNewPipeline(storage, name),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!file) return;
    void navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: file.storageKey },
      search: (previous) => ({ ...previous, fileId: file.id }),
      replace: true,
      resetScroll: false,
    });
  }, [file, navigate]);

  return error ? (
    <PipelineLoadError
      error={error}
      resetErrorBoundary={() => void refetch()}
    />
  ) : (
    <PipelineEditorSkeleton />
  );
}

function RemotePipelineEditor({
  pipeline,
}: {
  pipeline:
    | { source: "remote"; pipelineId: string }
    | { source: "draft"; name: string; draftId: string };
}) {
  const { backendUrl, ready, configured } = useBackend();
  if (!ready) return <RemotePipelineSkeleton />;
  if (pipeline.source === "draft" && createsLocalPipelines(configured)) {
    return (
      <CreateLocalPipeline name={pipeline.name} draftId={pipeline.draftId} />
    );
  }
  if (!configured) {
    return (
      <RemotePipelineShell>
        <BlockStack gap="3" className="p-6">
          <Paragraph role="alert">
            Configure a backend to open pipelines.
          </Paragraph>
          <Button asChild variant="outline">
            <RouterLink to={APP_ROUTES.SETTINGS_BACKEND}>
              Backend settings
            </RouterLink>
          </Button>
        </BlockStack>
      </RemotePipelineShell>
    );
  }
  return (
    <RemotePipelineDocumentView pipelineRef={{ ...pipeline, backendUrl }} />
  );
}

// Non-editor-v2 routes (e.g. `/tour/$tourId`) pass `pipelineRef` directly.
// Without a prop, we fall back to the committed route match.
export function EditorV2({
  pipelineRef: pipelineRefProp,
}: {
  pipelineRef?: PipelineRef | null;
} = {}) {
  // The editor lives on a shared layout so changing a draft's URL does not
  // unmount it. Read the leaf match rather than the layout's empty params.
  const match = useRouterState({
    select: (state) => state.matches.at(-1),
  });
  const params = match?.params;
  const search = match?.search ?? {};
  if (
    pipelineRefProp === undefined &&
    params &&
    "pipelineId" in params &&
    typeof params.pipelineId === "string"
  ) {
    return (
      <RemotePipelineEditor
        pipeline={{ source: "remote", pipelineId: params.pipelineId }}
      />
    );
  }

  const fileId =
    "fileId" in search && typeof search.fileId === "string"
      ? search.fileId
      : undefined;

  const pipelineName =
    params &&
    "pipelineName" in params &&
    typeof params.pipelineName === "string"
      ? params.pipelineName
      : null;

  const draft =
    match?.context && "newPipeline" in match.context
      ? match.context.newPipeline
      : undefined;
  if (pipelineRefProp === undefined && draft) {
    return (
      <RemotePipelineEditor
        pipeline={{
          source: "draft",
          ...draft,
        }}
      />
    );
  }

  const pipelineRef: PipelineRef | null =
    pipelineRefProp !== undefined
      ? pipelineRefProp
      : pipelineName
        ? { name: pipelineName, fileId }
        : null;

  return <EditorV2Document key="local-editor" pipelineRef={pipelineRef} />;
}

function EditorV2Document({
  pipelineRef,
}: {
  pipelineRef: EditorPipelineRef | null;
}) {
  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <EditorSessionProvider>
          <AiChatStoreProvider
            createWorker={createEditorAgentWorker}
            context={{ mode: "editor" }}
          >
            <ChatDocumentLifecycle pipelineRef={pipelineRef} />
            <DialogProvider>
              <EditorV2Content pipelineRef={pipelineRef} />
            </DialogProvider>
          </AiChatStoreProvider>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </div>
  );
}

function ChatDocumentLifecycle({
  pipelineRef,
}: {
  pipelineRef: EditorPipelineRef | null;
}) {
  const chat = useAiChatStore();
  const identity =
    pipelineRef && !("source" in pipelineRef)
      ? getEditorPipelineIdentity(pipelineRef)
      : "remote-or-empty";
  useEffect(
    () => () => {
      // Stop in-flight tools before the stable local editor stores load another
      // document. Keep the conversation and its bindings to those live stores.
      for (const thread of chat.threads) thread.abort();
    },
    [chat, identity],
  );
  return null;
}
