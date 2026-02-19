import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { subscribe, useSnapshot } from "valtio";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { YamlLoader } from "@/providers/ComponentSpec/yamlLoader";

import { ComponentLibraryContent } from "./components/ComponentLibraryContent";
import { ContextPanelContent } from "./components/ContextPanel";
import { DebugPanel } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas";
import { HistoryContent } from "./components/HistoryContent";
import { PinnedTaskContent } from "./components/PinnedTaskContent";
import { PipelineDetailsContent } from "./components/PipelineDetailsContent";
import { PipelineTreeContent } from "./components/PipelineTreeContent";
import { clearCommandHistory, redo, undo } from "./store/commandManager";
import { editorStore, initializeStore } from "./store/editorStore";
import {
  addHistoryEntry,
  captureInitialState,
  clearHistory,
} from "./store/historyStore";
import {
  clearNavigation,
  getCurrentSpec,
  initNavigation,
  isTaskSubgraph,
  navigateToSubgraph,
  navigationStore,
} from "./store/navigationStore";
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
  const [yamlLoader] = useState(() => new YamlLoader());

  // Parse the YAML into a ComponentSpecEntity
  const { data: testSpec } = useSuspenseQuery({
    queryKey: ["test-spec-entity-v2"],
    queryFn: async () => {
      const testSpecText = await getSpecByName("test-spec");
      return yamlLoader.loadFromText(testSpecText);
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

/** Generate a unique ID for pinned windows */
function generatePinnedWindowId(): string {
  return `pinned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Get task name from entity ID */
function getTaskNameByEntityId(entityId: string): string | null {
  const spec = editorStore.spec;
  if (
    !spec?.implementation ||
    !(spec.implementation instanceof GraphImplementation)
  ) {
    return null;
  }
  const task = spec.implementation.tasks.entities[entityId];
  return task?.name ?? null;
}

const PipelineEditor = withSuspenseWrapper(() => {
  const spec = useLoadSpec();
  // Track previous task entity IDs to detect deletions
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to navigation store for re-renders when current spec changes
  const navSnapshot = useSnapshot(navigationStore);
  const currentSpec = getCurrentSpec();

  // Initialize window persistence (subscribe to store changes for auto-save)
  useEffect(() => {
    const cleanup = initPersistence();
    return cleanup;
  }, []);

  // Initialize the valtio store and navigation with the loaded spec
  useEffect(() => {
    if (spec) {
      initializeStore(spec);
      initNavigation(spec);

      // Capture initial state for history
      captureInitialState();

      // Subscribe to the proxied spec AFTER initializeStore has wrapped it
      // editorStore.spec is now the proxied version
      const unsubscribe = subscribe(editorStore.spec!, (ops) => {
        console.log(
          `%c Spec changed`,
          "color: orange; font-weight: bold;",
          ops,
        );

        // Add history entry for this change
        addHistoryEntry(ops);

        // Check for deleted tasks and close their windows
        const currentSpec = editorStore.spec;
        if (currentSpec?.implementation instanceof GraphImplementation) {
          const currentTaskIds = new Set(
            Object.keys(currentSpec.implementation.tasks.entities),
          );

          // Find deleted tasks (were in prev, not in current)
          for (const prevId of prevTaskEntityIdsRef.current) {
            if (!currentTaskIds.has(prevId)) {
              // Task was deleted - close any windows linked to it
              closeWindowsByLinkedEntity(prevId);
            }
          }

          // Update the ref with current task IDs
          prevTaskEntityIdsRef.current = currentTaskIds;
        }
      });

      // Initialize the task entity IDs ref
      if (spec.implementation instanceof GraphImplementation) {
        prevTaskEntityIdsRef.current = new Set(
          Object.keys(spec.implementation.tasks.entities),
        );
      }

      return () => {
        unsubscribe();
        // Clear stores on unmount
        editorStore.spec = null;
        editorStore.selectedNodeId = null;
        editorStore.selectedNodeType = null;
        clearNavigation();
        clearHistory();
        clearCommandHistory();
      };
    }
  }, [spec]);

  // Handle node selection changes and window management
  useEffect(() => {
    const unsubscribe = subscribe(editorStore, () => {
      const {
        selectedNodeId,
        selectedNodeType,
        lastSelectionWasShiftClick,
        lastShiftClickEntityId,
        multiSelection,
      } = editorStore;

      // Handle shift-click: create a pinned window for the task
      if (lastSelectionWasShiftClick && lastShiftClickEntityId) {
        const taskName = getTaskNameByEntityId(lastShiftClickEntityId);
        if (taskName) {
          openWindow(<PinnedTaskContent entityId={lastShiftClickEntityId} />, {
            id: generatePinnedWindowId(),
            title: taskName,
            linkedEntityId: lastShiftClickEntityId,
          });
        }
        // Clear the shift-click state after processing
        editorStore.lastSelectionWasShiftClick = false;
        editorStore.lastShiftClickEntityId = null;
        return;
      }

      // Handle multi-selection
      if (multiSelection.length > 1) {
        const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);

        if (existingWindow) {
          // If window exists but is hidden, restore it
          if (existingWindow.state === "hidden") {
            restoreWindow(CONTEXT_PANEL_WINDOW_ID);
          }
          // Window exists and is visible - ContextPanelContent reads from store
        } else {
          // Open new properties window for multi-selection
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

      // Handle regular single selection
      if (selectedNodeId && selectedNodeType) {
        const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);

        if (existingWindow) {
          // If window exists but is hidden, restore it
          if (existingWindow.state === "hidden") {
            restoreWindow(CONTEXT_PANEL_WINDOW_ID);
          }
          // Window exists and is visible - no need to do anything
          // ContextPanelContent reads from editorStore.selectedNodeId directly
        } else {
          // Open new properties window
          openWindow(<ContextPanelContent />, {
            id: CONTEXT_PANEL_WINDOW_ID,
            title: "Properties",
            position: { x: window.innerWidth - 340, y: 80 },
            size: { width: 300, height: 400 },
            startVisible: true,
          });
        }
      } else {
        // No selection - close the properties window (state is preserved in persistence)
        const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
        if (existingWindow) {
          closeWindow(CONTEXT_PANEL_WINDOW_ID);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Cleanup pinned windows for deleted tasks
  useEffect(() => {
    // This effect runs once to set up cleanup logic
    // The actual cleanup happens in the spec subscription above
    return () => {
      // On unmount, close all windows linked to entities
      const windows = getAllWindows();
      for (const win of windows) {
        if (win.linkedEntityId) {
          closeWindow(win.id);
        }
      }
    };
  }, []);

  // Open component library window on mount
  useEffect(() => {
    const existingWindow = getWindowById(COMPONENT_LIBRARY_WINDOW_ID);
    if (!existingWindow) {
      openWindow(<ComponentLibraryContent />, {
        id: COMPONENT_LIBRARY_WINDOW_ID,
        title: "Components",
        position: { x: 0, y: 100 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
      });
    }
  }, []);

  // Open pipeline details window on mount
  useEffect(() => {
    const existingWindow = getWindowById(PIPELINE_DETAILS_WINDOW_ID);
    if (!existingWindow) {
      openWindow(<PipelineDetailsContent />, {
        id: PIPELINE_DETAILS_WINDOW_ID,
        title: "Pipeline Details",
        position: { x: 0, y: 460 },
        size: { width: 280, height: 350 },
        disabledActions: ["close"],
      });
    }
  }, []);

  // Open pipeline tree window on mount
  // Note: If persisted as hidden, windowStore will auto-hide it.
  // Otherwise it starts visible (first-time default).
  useEffect(() => {
    const existingWindow = getWindowById(PIPELINE_TREE_WINDOW_ID);
    if (!existingWindow) {
      openWindow(<PipelineTreeContent />, {
        id: PIPELINE_TREE_WINDOW_ID,
        title: "Pipeline Structure",
        position: { x: 300, y: 100 },
        size: { width: 280, height: 400 },
        disabledActions: ["close"],
      });
    }
  }, []);

  // Open history window on mount
  // Note: If persisted as hidden, windowStore will auto-hide it.
  // Otherwise it starts visible (first-time default).
  useEffect(() => {
    const existingWindow = getWindowById(HISTORY_WINDOW_ID);
    if (!existingWindow) {
      openWindow(<HistoryContent />, {
        id: HISTORY_WINDOW_ID,
        title: "History",
        position: { x: window.innerWidth - 620, y: 80 },
        size: { width: 260, height: 350 },
        disabledActions: ["close"],
      });
    }
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd/Ctrl+Z (undo) or Cmd/Ctrl+Shift+Z (redo)
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        // Don't intercept if user is typing in an input field
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      // Also support Cmd/Ctrl+Y for redo (Windows convention)
      if ((event.metaKey || event.ctrlKey) && event.key === "y") {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /**
   * Handle double-click on task nodes for subgraph navigation.
   * If the task is a subgraph, navigate into it.
   */
  const handleTaskDoubleClick = (taskEntityId: string) => {
    // Check if the task is a subgraph
    if (isTaskSubgraph(taskEntityId)) {
      const success = navigateToSubgraph(taskEntityId);
      if (success) {
        // Clear selection when navigating into a subgraph
        editorStore.selectedNodeId = null;
        editorStore.selectedNodeType = null;

        // Show the Pipeline Structure window to help with navigation
        restoreWindow(PIPELINE_TREE_WINDOW_ID);
      }
    }
  };

  // Access navSnapshot.navigationPath to trigger re-renders when navigation changes
  // This ensures currentSpec updates when navigating into/out of subgraphs
  if (navSnapshot.navigationPath.length === 0) {
    return null;
  }

  return (
    <>
      <DebugPanel />
      <FlowCanvas
        key={currentSpec?.$id ?? "root"}
        spec={currentSpec}
        onTaskDoubleClick={handleTaskDoubleClick}
        className="h-full"
      />
      <WindowContainer />
      <TaskPanel />
    </>
  );
});

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
