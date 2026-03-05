import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import yaml from "js-yaml";
import { registerRootStore } from "mobx-keystone";
import { observer } from "mobx-react-lite";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { loadPipelineByName } from "@/services/pipelineService";

import { DebugPanel } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas/FlowCanvas";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import { usePipelineTreeWindow } from "./hooks/usePipelineTreeWindow";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { useWindowPersistence } from "./hooks/useWindowPersistence";
import { SpecProvider } from "./providers/SpecContext";
import { navigationStore } from "./store/navigationStore";
import { DockArea } from "./windows/DockArea";
import { TaskPanel } from "./windows/TaskPanel";
import { WindowContainer } from "./windows/WindowContainer";

const availableTemplates = import.meta.glob<string>("./assets/*.yaml", {
  query: "?raw",
  import: "default",
});

async function getSpecByName(name: "test-spec") {
  return availableTemplates[`./assets/${name}.yaml`]();
}

function deserializeSpec(data: unknown) {
  const idGen = new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(idGen);
  const spec = deserializer.deserialize(data);
  registerRootStore(spec);
  return spec;
}

function useLoadSpec(pipelineName: string | null) {
  const { data: spec } = useSuspenseQuery({
    queryKey: ["editor-v2-spec", pipelineName],
    queryFn: async () => {
      if (pipelineName) {
        const result = await loadPipelineByName(pipelineName);
        if (!result.experiment?.componentRef?.spec) {
          throw new Error(`Pipeline "${pipelineName}" not found`);
        }
        return deserializeSpec(result.experiment.componentRef.spec);
      }

      const testSpecText = await getSpecByName("test-spec");
      return deserializeSpec(yaml.load(testSpecText));
    },
    staleTime: Infinity,
    retry: false,
  });

  return spec;
}

const PipelineEditor = withSuspenseWrapper(
  observer(() => {
    const pipelineName = navigationStore.requestedPipelineName;
    const rootSpec = useLoadSpec(pipelineName);

    useWindowPersistence();
    useSpecLifecycle(rootSpec);
    useSelectionWindowSync();
    useLinkedWindowCleanup();
    useComponentLibraryWindow();
    usePipelineDetailsWindow();
    usePipelineTreeWindow();
    useHistoryWindow();
    useUndoRedoKeyboard();

    const activeSpec = navigationStore.activeSpec;

    if (!activeSpec) return null;

    return (
      <SpecProvider spec={activeSpec}>
        <DebugPanel />
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
);

export function EditorV2() {
  return (
    <div className="h-full w-full flex flex-col bg-slate-100">
      <ReactFlowProvider>
        <ForcedSearchProvider>
          <ComponentLibraryProvider>
            <PipelineEditor />
          </ComponentLibraryProvider>
        </ForcedSearchProvider>
      </ReactFlowProvider>
    </div>
  );
}
