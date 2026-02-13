import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { subscribe } from "valtio";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { YamlLoader } from "@/providers/ComponentSpec/yamlLoader";

import { ComponentLibraryContent } from "./components/ComponentLibraryContent";
import { ContextPanelContent } from "./components/ContextPanel";
import { DebugPanel } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas";
import { PinnedTaskContent } from "./components/PinnedTaskContent";
import { editorStore, initializeStore } from "./store/editorStore";
import { TaskPanel } from "./windows/TaskPanel";
import { WindowContainer } from "./windows/WindowContainer";
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

/** Generate a unique ID for pinned windows */
function generatePinnedWindowId(): string {
  return `pinned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Get task name from entity ID */
function getTaskNameByEntityId(entityId: string): string | null {
  const spec = editorStore.spec;
  if (!spec?.implementation || !(spec.implementation instanceof GraphImplementation)) {
    return null;
  }
  const task = spec.implementation.tasks.entities[entityId];
  return task?.name ?? null;
}

const PipelineEditor = withSuspenseWrapper(() => {
  const spec = useLoadSpec();
  // Track previous task entity IDs to detect deletions
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  // Initialize the valtio store with the loaded spec
  // The spec is wrapped in proxy() inside initializeStore for deep reactivity
  useEffect(() => {
    if (spec) {
      initializeStore(spec);

      // Subscribe to the proxied spec AFTER initializeStore has wrapped it
      // editorStore.spec is now the proxied version
      const unsubscribe = subscribe(editorStore.spec!, (ops) => {
        console.log(
          `%c Spec changed`,
          "color: orange; font-weight: bold;",
          ops,
        );

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
        // Clear store on unmount
        editorStore.spec = null;
        editorStore.selectedNodeId = null;
        editorStore.selectedNodeType = null;
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

      // Handle regular selection
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
          });
        }
      } else {
        // No selection - close the properties window (not pinned windows)
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
        size: { width: 280, height: 500 },
        disabledActions: ["close"],
      });
    }
  }, []);

  return (
    <>
      <DebugPanel />
      <FlowCanvas className="h-full" />
      <WindowContainer />
      <TaskPanel />
    </>
  );
});

export function EditorV2() {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100">
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
