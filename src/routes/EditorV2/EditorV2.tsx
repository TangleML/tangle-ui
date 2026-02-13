import "@xyflow/react/dist/style.css";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { subscribe } from "valtio";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { InlineStack } from "@/components/ui/layout";
import { YamlLoader } from "@/providers/ComponentSpec/yamlLoader";

import { ContextPanelContent } from "./components/ContextPanel";
import { DebugPanel } from "./components/DebugPanel";
import { FlowCanvas } from "./components/FlowCanvas";
import { Sidebar } from "./components/Sidebar";
import { editorStore, initializeStore } from "./store/editorStore";
import { TaskPanel } from "./windows/TaskPanel";
import { WindowContainer } from "./windows/WindowContainer";
import {
  getWindowById,
  openWindow,
  updateWindowContent,
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

const PipelineEditor = withSuspenseWrapper(() => {
  const spec = useLoadSpec();

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
      });

      return () => {
        unsubscribe();
        // Clear store on unmount
        editorStore.spec = null;
        editorStore.selectedNodeId = null;
        editorStore.selectedNodeType = null;
      };
    }
  }, [spec]);

  // Open/close context panel window based on node selection
  useEffect(() => {
    const unsubscribe = subscribe(editorStore, () => {
      const { selectedNodeId, selectedNodeType } = editorStore;

      if (selectedNodeId && selectedNodeType) {
        const existingWindow = getWindowById(CONTEXT_PANEL_WINDOW_ID);
        const content = <ContextPanelContent />;

        if (existingWindow) {
          // Update content if window exists
          updateWindowContent(CONTEXT_PANEL_WINDOW_ID, content);
        } else {
          // Open new window
          openWindow(content, {
            id: CONTEXT_PANEL_WINDOW_ID,
            title: "Properties",
            position: { x: window.innerWidth - 340, y: 80 },
            size: { width: 300, height: 400 },
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <DebugPanel />
      <InlineStack fill className="h-full">
        <Sidebar />
        <FlowCanvas className="flex-1" />
      </InlineStack>
      <WindowContainer />
      <TaskPanel />
    </>
  );
});

export function EditorV2() {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100">
      <ReactFlowProvider>
        <PipelineEditor />
      </ReactFlowProvider>
    </div>
  );
}
