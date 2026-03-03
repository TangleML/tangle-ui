import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import yaml from "js-yaml";
import { registerRootStore } from "mobx-keystone";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";

import { DebugPanel } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas";
import { useComponentLibraryWindow } from "./hooks/useComponentLibraryWindow";
import { useHistoryWindow } from "./hooks/useHistoryWindow";
import { useLinkedWindowCleanup } from "./hooks/useLinkedWindowCleanup";
import { useNavigationSync } from "./hooks/useNavigationSync";
import { usePipelineDetailsWindow } from "./hooks/usePipelineDetailsWindow";
import {
  PIPELINE_TREE_WINDOW_ID,
  usePipelineTreeWindow,
} from "./hooks/usePipelineTreeWindow";
import { useSelectionWindowSync } from "./hooks/useSelectionWindowSync";
import { useSpecLifecycle } from "./hooks/useSpecLifecycle";
import { useUndoRedoKeyboard } from "./hooks/useUndoRedoKeyboard";
import { useWindowPersistence } from "./hooks/useWindowPersistence";
import { SpecProvider } from "./providers/SpecContext";
import {
  isTaskSubgraph,
  navigateToSubgraph,
  navigationStore,
} from "./store/navigationStore";
import { TaskPanel } from "./windows/TaskPanel";
import { WindowContainer } from "./windows/WindowContainer";
import { restoreWindow } from "./windows/windowStore";

const availableTemplates = import.meta.glob<string>("./assets/*.yaml", {
  query: "?raw",
  import: "default",
});

async function getSpecByName(name: "test-spec") {
  return availableTemplates[`./assets/${name}.yaml`]();
}

function useLoadSpec() {
  const { data: testSpec } = useSuspenseQuery({
    queryKey: ["test-spec-entity-v2-keystone"],
    queryFn: async () => {
      const testSpecText = await getSpecByName("test-spec");
      const idGen = new IncrementingIdGenerator();
      const deserializer = new YamlDeserializer(idGen);
      const yamlData = yaml.load(testSpecText);
      const spec = deserializer.deserialize(yamlData);
      registerRootStore(spec);
      return spec;
    },
    staleTime: Infinity,
    retry: false,
  });

  return testSpec;
}

const PipelineEditor = withSuspenseWrapper(
  observer(() => {
    const rootSpec = useLoadSpec();
    const [activeSpec, setActiveSpec] = useState<ComponentSpec | null>(null);

    useWindowPersistence();
    useSpecLifecycle(rootSpec, setActiveSpec);
    useSelectionWindowSync();
    useLinkedWindowCleanup();
    useComponentLibraryWindow();
    usePipelineDetailsWindow();
    usePipelineTreeWindow();
    useHistoryWindow();
    useUndoRedoKeyboard();
    useNavigationSync(setActiveSpec);

    const handleTaskDoubleClick = (taskEntityId: string) => {
      if (!activeSpec) return;
      if (isTaskSubgraph(activeSpec, taskEntityId)) {
        const newSpec = navigateToSubgraph(activeSpec, taskEntityId);
        if (newSpec) {
          restoreWindow(PIPELINE_TREE_WINDOW_ID);
        }
      }
    };

    const navPath = navigationStore.navigationPath;
    if (navPath.length === 0) return null;

    return (
      <SpecProvider spec={activeSpec}>
        <DebugPanel />
        <FlowCanvas
          key={activeSpec?.$id ?? "root"}
          spec={activeSpec}
          onTaskDoubleClick={handleTaskDoubleClick}
          className="h-full"
        />
        <WindowContainer />
        <TaskPanel />
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
