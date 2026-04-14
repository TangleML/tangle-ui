import "@xyflow/react/dist/style.css";

import { useParams, useSearch } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
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

import { useDebugPanelWindow } from "./components/DebugPanel";
import { DriverPermissionGate } from "./components/DriverPermissionGate";
import { EditorMenuBar } from "./components/EditorMenuBar/EditorMenuBar";
import { EmptyEditorState } from "./components/EmptyEditorState";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { useLoadSpec } from "./hooks/useLoadSpec";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import { usePipelineTreeWindow } from "./hooks/usePipelineTreeWindow";
import { usePropertiesWindowPositioning } from "./hooks/usePropertiesWindowPositioning";
import { useRecentRunsWindow } from "./hooks/useRecentRunsWindow";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { editorRegistry } from "./nodes";
import { EditorSessionProvider } from "./store/EditorSessionContext";

interface PipelineEditorProps {
  pipelineRef: PipelineRef;
}

const PipelineEditorSkeleton = () => {
  return (
    <BlockStack fill>
      <InlineStack gap="2">
        <Spinner />
        <Text>Loading pipeline... </Text>
      </InlineStack>
    </BlockStack>
  );
};

const PipelineEditor = withSuspenseWrapper(
  observer(({ pipelineRef }: PipelineEditorProps) => {
    const {
      data: { spec: rootSpec, restoredUndoStore },
    } = useLoadSpec(pipelineRef);
    const { navigation } = useSharedStores();

    useWindowPersistence("editor");
    useDockAreaAccordion();
    useSpecLifecycle(rootSpec, pipelineRef, restoredUndoStore);
    useSelectionWindowSync();
    usePropertiesWindowPositioning();
    useLinkedWindowCleanup();
    useComponentLibraryWindow();
    usePipelineDetailsWindow();
    usePipelineTreeWindow();
    useHistoryWindow();
    useRecentRunsWindow();
    useUndoRedoKeyboard();
    useFocusMode();
    useShortcutListener();
    useDebugPanelWindow();

    const activeSpec = navigation.activeSpec;

    if (!activeSpec) return null;

    return (
      <NodeRegistryProvider registry={editorRegistry}>
        <SpecProvider spec={activeSpec}>
          <InlineStack
            className="flex-1 min-h-0 w-full"
            gap="0"
            blockAlign="stretch"
            wrap="nowrap"
            data-testid="editor-v2"
          >
            <DockArea side="left" />
            <div className="relative flex-1 min-w-0 h-full">
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

function EditorV2Content({ pipelineRef }: { pipelineRef: PipelineRef | null }) {
  const { navigation } = useSharedStores();

  useEffect(() => {
    navigation.setRequestedPipelineName(pipelineRef?.name ?? null);
  }, [navigation, pipelineRef?.name]);

  return (
    <ComponentLibraryProvider>
      <EditorMenuBar />
      <ReactFlowProvider>
        <ForcedSearchProvider>
          {pipelineRef ? (
            <DriverPermissionGate pipelineRef={pipelineRef}>
              <PipelineEditor pipelineRef={pipelineRef} />
            </DriverPermissionGate>
          ) : (
            <EmptyEditorState />
          )}
        </ForcedSearchProvider>
      </ReactFlowProvider>
    </ComponentLibraryProvider>
  );
}

/**
 * Shell component for the Editor V2 route.
 */
export function EditorV2() {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const fileId =
    "fileId" in search && typeof search.fileId === "string"
      ? search.fileId
      : undefined;

  const pipelineName =
    "pipelineName" in params && typeof params.pipelineName === "string"
      ? params.pipelineName
      : null;

  const pipelineRef: PipelineRef | null = pipelineName
    ? { name: pipelineName, fileId }
    : null;

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 select-none">
      <SharedStoreProvider>
        <EditorSessionProvider>
          <DialogProvider>
            <EditorV2Content pipelineRef={pipelineRef} />
          </DialogProvider>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </div>
  );
}
