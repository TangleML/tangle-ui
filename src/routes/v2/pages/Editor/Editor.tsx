import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { Link as RouterLink, useRouterState } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { type ReactNode, useEffect } from "react";
import type { FallbackProps } from "react-error-boundary";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { TourSaveExploreDialog } from "@/providers/TourProvider/TourSaveExploreDialog";
import { TourSecretsDialog } from "@/providers/TourProvider/TourSecretsDialog";
import { APP_ROUTES } from "@/routes/appRoutes";
import {
  AiChatStoreProvider,
  useAiChatStore,
} from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import { useCanvasControlsWindow } from "@/routes/v2/shared/components/MiniMap/useCanvasControlsWindow";
import { useDockAreaAccordion } from "@/routes/v2/shared/hooks/useDockAreaAccordion";
import { useFocusMode } from "@/routes/v2/shared/hooks/useFocusMode";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import {
  TOUR_WINDOW_LAYOUT_ID,
  useWindowPersistence,
} from "@/routes/v2/shared/windows/windowPersistence";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
} from "@/services/pipelineStorage/types";

import { createEditorAgentWorker } from "./components/AiChat/editorAgentWorker";
import { useDebugPanelWindow } from "./components/DebugPanel";
import { EditorMenuBar } from "./components/EditorMenuBar/EditorMenuBar";
import { EditorTourBridge } from "./components/EditorTourBridge/EditorTourBridge";
import {
  EditorCanvasProvider,
  EditorViewport,
} from "./components/EditorViewport";
import { EmptyEditorState } from "./components/EmptyEditorState";
import { RemotePipelineSaveRecovery } from "./components/RemotePipelineSaveRecovery";
import { RemotePipelineError } from "./components/RemotePipelineView/RemotePipelineError";
import { RemotePipelineShell } from "./components/RemotePipelineView/RemotePipelineShell";
import { RemotePipelineView } from "./components/RemotePipelineView/RemotePipelineView";
import { useAiChatWindow } from "./hooks/useAiChatWindow";
import {
  type EditorDocument,
  useEditorWorkspace,
} from "./hooks/useEditorWorkspace";
import { useLoadSpec } from "./hooks/useLoadSpec";
import { usePipelineTreeWindow } from "./hooks/usePipelineTreeWindow";
import { usePropertiesWindowPositioning } from "./hooks/usePropertiesWindowPositioning";
import { useRemoteDraftPromotion } from "./hooks/useRemoteDraftPromotion";
import { useRemotePipelineUrlSync } from "./hooks/useRemotePipelineUrlSync";
import { useRetainDocument } from "./hooks/useRetainDocument";
import { useSeedInitialDockLayoutFromPreset } from "./hooks/useSeedInitialDockLayoutFromPreset";
import { useTipOfTheDayWindow } from "./hooks/useTipOfTheDayWindow";
import { EditorSessionProvider } from "./store/EditorSessionContext";

const PipelineEditorSkeleton = () => (
  <LoadingScreen message="Loading pipeline..." />
);

const PipelineEditor = observer(function PipelineEditor({
  document,
  pipelineRef,
}: {
  document: EditorDocument;
  pipelineRef?: EditorPipelineRef;
}) {
  const { spec: rootSpec, file } = document;
  const tourMode = useTourMode();

  useWindowPersistence(tourMode ? TOUR_WINDOW_LAYOUT_ID : "editor");
  useDockAreaAccordion();
  useEditorWorkspace(document);
  useRemoteDraftPromotion(pipelineRef, file);
  useChatDocumentLifecycle(file);
  useRemotePipelineUrlSync(rootSpec, file?.remote?.pipelineId);
  usePropertiesWindowPositioning();

  usePipelineTreeWindow();
  useCanvasControlsWindow("v2.pipeline_canvas");
  useFocusMode();
  useDebugPanelWindow();
  useTipOfTheDayWindow();

  const aiEnabled = useFlagValue("ai-assistant");
  useAiChatWindow(aiEnabled);

  useSeedInitialDockLayoutFromPreset();

  return <EditorViewport leftDock={<DockArea side="left" />} />;
});

function EditorContent({
  pipelineRef,
  document,
}: {
  pipelineRef?: EditorPipelineRef;
  document?: EditorDocument;
}) {
  const tourMode = useTourMode();
  const body: ReactNode = document ? (
    <PipelineEditor pipelineRef={pipelineRef} document={document} />
  ) : tourMode ? (
    <PipelineEditorSkeleton />
  ) : (
    <EmptyEditorState />
  );

  return (
    <EditorCanvasProvider>
      <EditorMenuBar />
      <RemotePipelineSaveRecovery />
      <EditorTourBridge />
      <TourSaveExploreDialog />
      <TourSecretsDialog />
      {body}
    </EditorCanvasProvider>
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
    const { data: document } = useLoadSpec(pipelineRef);
    const { spec, file } = document;
    return file.canEdit === true ? (
      <EditorDocument
        key={file.initialId}
        pipelineRef={pipelineRef}
        document={document}
      />
    ) : (
      <RemotePipelineView
        spec={spec}
        file={file}
        pipelineId={file.remote?.pipelineId}
      />
    );
  },
  RemotePipelineSkeleton,
  ({ error, resetErrorBoundary }: FallbackProps) => (
    <RemotePipelineError error={error} onRetry={resetErrorBoundary} />
  ),
  ({ pipelineRef }) => [getEditorPipelineIdentity(pipelineRef)],
);

function RemotePipelineEditor({
  pipeline,
}: {
  pipeline:
    | { source: "remote"; pipelineId: string }
    | {
        source: "draft";
        name: string;
        draftId: string;
      };
}) {
  const { backendUrl, ready, configured } = useBackend();
  const pipelineRef = { ...pipeline, backendUrl };
  useRetainDocument(ready && configured ? pipelineRef : undefined);
  if (!ready) return <RemotePipelineSkeleton />;
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
  return <RemotePipelineDocumentView pipelineRef={pipelineRef} />;
}

// Tours supply an in-memory document. Saved pipelines come from the route.
export function Editor({
  spec,
}: {
  spec?: ComponentSpec;
} = {}) {
  // The editor lives on a shared layout so changing a draft's URL does not
  // unmount it. Read the leaf match rather than the layout's empty params.
  const match = useRouterState({
    select: (state) => state.matches.at(-1),
  });
  const params = match?.params;
  if (
    spec === undefined &&
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

  const draft =
    match?.context && "newPipeline" in match.context
      ? match.context.newPipeline
      : undefined;
  if (spec === undefined && draft) {
    return (
      <RemotePipelineEditor
        pipeline={{
          source: "draft",
          ...draft,
        }}
      />
    );
  }

  return <EditorDocument document={spec ? { spec } : undefined} />;
}

function EditorDocument({
  pipelineRef,
  document,
}: {
  pipelineRef?: EditorPipelineRef;
  document?: EditorDocument;
}) {
  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <EditorSessionProvider>
          <AiChatStoreProvider
            createWorker={createEditorAgentWorker}
            context={{ mode: "editor" }}
          >
            <DialogProvider>
              <EditorContent pipelineRef={pipelineRef} document={document} />
            </DialogProvider>
          </AiChatStoreProvider>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </div>
  );
}

function useChatDocumentLifecycle(file: PipelineFile | undefined) {
  const chat = useAiChatStore();
  useEffect(
    () => () => {
      // Stop in-flight tools before the stable local editor stores load another
      // document. Keep the conversation and its bindings to those live stores.
      for (const thread of chat.threads) thread.abort();
    },
    [chat, file],
  );
}
