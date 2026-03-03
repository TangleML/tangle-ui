import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import yaml from "js-yaml";
import { autorun, reaction } from "mobx";
import { registerRootStore } from "mobx-keystone";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";

import { ComponentLibraryContent } from "./components/ComponentLibraryContent";
import { ContextPanelContent } from "./components/ContextPanel";
import { DebugPanel } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas";
import { HistoryContent } from "./components/HistoryContent";
import { PinnedTaskContent } from "./components/PinnedTaskContent";
import { PipelineDetailsContent } from "./components/PipelineDetailsContent";
import { PipelineTreeContent } from "./components/PipelineTreeContent";
import { SpecProvider } from "./providers/SpecContext";
import { clearSpec, editorStore, initializeStore } from "./store/editorStore";
import { historyStore } from "./store/historyStore";
import {
  clearNavigation,
  initNavigation,
  isTaskSubgraph,
  navigateToSubgraph,
  navigationStore,
} from "./store/navigationStore";
import { undoStore } from "./store/undoStore";
import { TaskPanel } from "./windows/TaskPanel";
import { WindowContainer } from "./windows/WindowContainer";
import { initPersistence } from "./windows/windowPersistence";
import {
  closeWindow,
  closeWindowsByLinkedEntity,
  getAllWindows,
  getWindowById,
  openWindow,
  restoreWindow,
} from "./windows/windowStore";

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

const CONTEXT_PANEL_WINDOW_ID = "context-panel";
const COMPONENT_LIBRARY_WINDOW_ID = "component-library";
const PIPELINE_DETAILS_WINDOW_ID = "pipeline-details";
const PIPELINE_TREE_WINDOW_ID = "pipeline-tree";
const HISTORY_WINDOW_ID = "history";

function generatePinnedWindowId(): string {
  return `pinned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getTaskNameByEntityId(entityId: string): string | null {
  const spec = editorStore.spec;
  if (!spec) return null;
  const task = spec.tasks.find((t) => t.$id === entityId);
  return task?.name ?? null;
}

const PipelineEditor = withSuspenseWrapper(
  observer(() => {
    const rootSpec = useLoadSpec();
    const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());
    const [activeSpec, setActiveSpec] = useState<ComponentSpec | null>(null);

    useEffect(() => {
      const cleanup = initPersistence();
      return cleanup;
    }, []);

    useEffect(() => {
      if (rootSpec) {
        initializeStore(rootSpec);
        initNavigation(rootSpec);
        undoStore.init(rootSpec);
        setActiveSpec(rootSpec);

        prevTaskEntityIdsRef.current = new Set(
          rootSpec.tasks.map((t) => t.$id),
        );

        const disposeTaskWatcher = autorun(() => {
          const currentTaskIds = new Set(rootSpec.tasks.map((t) => t.$id));

          for (const prevId of prevTaskEntityIdsRef.current) {
            if (!currentTaskIds.has(prevId)) {
              closeWindowsByLinkedEntity(prevId);
            }
          }

          prevTaskEntityIdsRef.current = currentTaskIds;
        });

        return () => {
          disposeTaskWatcher();
          clearSpec();
          editorStore.clearSelection();
          clearNavigation();
          historyStore.clear();
          undoStore.dispose();
        };
      }
    }, [rootSpec]);

    useEffect(() => {
      const disposeSelectionWatcher = reaction(
        () => ({
          selectedNodeId: editorStore.selectedNodeId,
          selectedNodeType: editorStore.selectedNodeType,
          lastSelectionWasShiftClick: editorStore.lastSelectionWasShiftClick,
          lastShiftClickEntityId: editorStore.lastShiftClickEntityId,
          multiSelectionLength: editorStore.multiSelection.length,
        }),
        ({
          selectedNodeId,
          selectedNodeType,
          lastSelectionWasShiftClick,
          lastShiftClickEntityId,
          multiSelectionLength,
        }) => {
          if (lastSelectionWasShiftClick && lastShiftClickEntityId) {
            const taskName = getTaskNameByEntityId(lastShiftClickEntityId);
            if (taskName) {
              openWindow(
                <PinnedTaskContent entityId={lastShiftClickEntityId} />,
                {
                  id: generatePinnedWindowId(),
                  title: taskName,
                  linkedEntityId: lastShiftClickEntityId,
                },
              );
            }
            editorStore.selectNode(null, null);
            return;
          }

          if (multiSelectionLength > 1) {
            const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
            if (existingWindow) {
              if (existingWindow.state === "hidden")
                restoreWindow(CONTEXT_PANEL_WINDOW_ID);
            } else {
              openWindow(<ContextPanelContent />, {
                id: CONTEXT_PANEL_WINDOW_ID,
                title: "Properties",
                position: { x: window.innerWidth - 340, y: 80 },
                size: { width: 300, height: 400 },
                startVisible: true,
              });
            }
            return;
          }

          if (selectedNodeId && selectedNodeType) {
            const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
            if (existingWindow) {
              if (existingWindow.state === "hidden")
                restoreWindow(CONTEXT_PANEL_WINDOW_ID);
            } else {
              openWindow(<ContextPanelContent />, {
                id: CONTEXT_PANEL_WINDOW_ID,
                title: "Properties",
                position: { x: window.innerWidth - 340, y: 80 },
                size: { width: 300, height: 400 },
                startVisible: true,
              });
            }
          } else {
            const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
            if (existingWindow) closeWindow(CONTEXT_PANEL_WINDOW_ID);
          }
        },
      );

      return disposeSelectionWatcher;
    }, []);

    useEffect(() => {
      return () => {
        const windows = getAllWindows();
        for (const win of windows) {
          if (win.linkedEntityId) closeWindow(win.id);
        }
      };
    }, []);

    useEffect(() => {
      if (!getWindowById(COMPONENT_LIBRARY_WINDOW_ID)) {
        openWindow(<ComponentLibraryContent />, {
          id: COMPONENT_LIBRARY_WINDOW_ID,
          title: "Components",
          position: { x: 0, y: 100 },
          size: { width: 280, height: 350 },
          disabledActions: ["close"],
        });
      }
    }, []);

    useEffect(() => {
      if (!getWindowById(PIPELINE_DETAILS_WINDOW_ID)) {
        openWindow(<PipelineDetailsContent />, {
          id: PIPELINE_DETAILS_WINDOW_ID,
          title: "Pipeline Details",
          position: { x: 0, y: 460 },
          size: { width: 280, height: 350 },
          disabledActions: ["close"],
        });
      }
    }, []);

    useEffect(() => {
      if (!getWindowById(PIPELINE_TREE_WINDOW_ID)) {
        openWindow(<PipelineTreeContent />, {
          id: PIPELINE_TREE_WINDOW_ID,
          title: "Pipeline Structure",
          position: { x: 300, y: 100 },
          size: { width: 280, height: 400 },
          disabledActions: ["close"],
        });
      }
    }, []);

    useEffect(() => {
      if (!getWindowById(HISTORY_WINDOW_ID)) {
        openWindow(<HistoryContent />, {
          id: HISTORY_WINDOW_ID,
          title: "History",
          position: { x: window.innerWidth - 620, y: 80 },
          size: { width: 260, height: 350 },
          disabledActions: ["close"],
        });
      }
    }, []);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "z") {
          const target = event.target as HTMLElement;
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          )
            return;
          event.preventDefault();
          if (event.shiftKey) undoStore.redo();
          else undoStore.undo();
        }

        if ((event.metaKey || event.ctrlKey) && event.key === "y") {
          const target = event.target as HTMLElement;
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          )
            return;
          event.preventDefault();
          undoStore.redo();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleTaskDoubleClick = (taskEntityId: string) => {
      if (!activeSpec) return;
      if (isTaskSubgraph(activeSpec, taskEntityId)) {
        const newSpec = navigateToSubgraph(activeSpec, taskEntityId);
        if (newSpec) {
          setActiveSpec(newSpec);
          editorStore.clearSelection();
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
