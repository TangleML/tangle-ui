import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { registerRootStore } from "mobx-keystone";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import type { IdGenerator } from "@/models/componentSpec";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  ReplayIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { PipelineFolders } from "@/routes/PipelineFolders/PipelineFolders";
import { APP_ROUTES } from "@/routes/router";
import { loadPipelineByName } from "@/services/pipelineService";
import {
  createUndoStoreWithEvents,
  loadUndoHistory,
} from "@/services/undoHistoryStorage";

import { useDebugPanelWindow } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useDockAreaAccordion } from "./hooks/useDockAreaAccordion";
import { useFocusMode } from "./hooks/useFocusMode";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import { usePipelineTreeWindow } from "./hooks/usePipelineTreeWindow";
import { usePropertiesWindowPositioning } from "./hooks/usePropertiesWindowPositioning";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { useWindowPersistence } from "./hooks/useWindowPersistence";
import { SpecProvider } from "./providers/SpecContext";
import { useEditorShortcuts } from "./shortcuts/useEditorShortcuts";
import {
  navigationStore,
  setRequestedPipelineName,
} from "./store/navigationStore";
import { DockArea } from "./windows/DockArea";
import { TaskPanel } from "./windows/TaskPanel";
import { WindowContainer } from "./windows/WindowContainer";

interface LoadedSpec {
  spec: ComponentSpec;
  restoredUndoStore?: MobxUndoStore;
}

function deserializeSpec(data: unknown, idGen?: IdGenerator): ComponentSpec {
  const generator = idGen ?? new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(generator);
  const spec = deserializer.deserialize(data);
  registerRootStore(spec);
  return spec;
}

function useLoadSpec(pipelineName: string) {
  const { data } = useSuspenseQuery({
    queryKey: ["editor-v2-spec", pipelineName],
    queryFn: async (): Promise<LoadedSpec> => {
      const [result, undoHistory] = await Promise.all([
        loadPipelineByName(pipelineName),
        loadUndoHistory(pipelineName).catch(() => null),
      ]);

      if (!result.experiment?.componentRef?.spec) {
        throw new Error(`Pipeline "${pipelineName}" not found`);
      }

      if (undoHistory) {
        try {
          const replayIdGen = new ReplayIdGenerator(undoHistory.idStack);
          const spec = deserializeSpec(
            result.experiment.componentRef.spec,
            replayIdGen,
          );
          const restoredUndoStore = createUndoStoreWithEvents(
            undoHistory.undoEvents,
          );
          return { spec, restoredUndoStore };
        } catch (error) {
          console.warn("Failed to restore undo history, loading fresh:", error);
        }
      }

      return { spec: deserializeSpec(result.experiment.componentRef.spec) };
    },
    staleTime: Infinity,
    retry: false,
  });

  return data;
}

interface PipelineEditorProps {
  pipelineName: string;
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
  observer(({ pipelineName }: PipelineEditorProps) => {
    const { spec: rootSpec, restoredUndoStore } = useLoadSpec(pipelineName);

    useWindowPersistence();
    useDockAreaAccordion();
    useSpecLifecycle(rootSpec, pipelineName, restoredUndoStore);
    useSelectionWindowSync();
    usePropertiesWindowPositioning();
    useLinkedWindowCleanup();
    useComponentLibraryWindow();
    usePipelineDetailsWindow();
    usePipelineTreeWindow();
    useHistoryWindow();
    useUndoRedoKeyboard();
    useFocusMode();
    useEditorShortcuts();
    useDebugPanelWindow();

    const activeSpec = navigationStore.activeSpec;

    if (!activeSpec) return null;

    return (
      <SpecProvider spec={activeSpec}>
        <TaskPanel />
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
    );
  }),
  PipelineEditorSkeleton,
);

function EmptyEditorState() {
  const navigate = useNavigate();

  const handlePipelineClick = (name: string) => {
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: name },
    });
  };

  return (
    <BlockStack
      className="flex-1 min-h-0 w-full overflow-auto p-8"
      align="center"
    >
      <BlockStack className="w-full max-w-5xl mx-auto" gap="4">
        <InlineStack gap="2" blockAlign="center">
          <Icon name="FolderOpen" size="md" className="text-stone-500" />
          <Text as="h2" size="lg" weight="semibold">
            Open Pipeline
          </Text>
        </InlineStack>
        <PipelineFolders onPipelineClick={handlePipelineClick} />
      </BlockStack>
    </BlockStack>
  );
}

/**
 * Shell component for the Editor V2 route.
 * @returns
 */
export function EditorV2() {
  const params = useParams({ strict: false });
  const pipelineName =
    "pipelineName" in params && typeof params.pipelineName === "string"
      ? params.pipelineName
      : null;

  useEffect(() => {
    setRequestedPipelineName(pipelineName);
  }, [pipelineName]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-100">
      <ReactFlowProvider>
        <ForcedSearchProvider>
          <ComponentLibraryProvider>
            {pipelineName ? (
              <PipelineEditor pipelineName={pipelineName} />
            ) : (
              <EmptyEditorState />
            )}
          </ComponentLibraryProvider>
        </ForcedSearchProvider>
      </ReactFlowProvider>
    </div>
  );
}
