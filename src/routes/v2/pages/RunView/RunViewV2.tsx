import "@xyflow/react/dist/style.css";

import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { InlineStack } from "@/components/ui/layout";
import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { AiChatStoreProvider } from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import { useCanvasControlsWindow } from "@/routes/v2/shared/components/MiniMap/useCanvasControlsWindow";
import { useDockAreaAccordion } from "@/routes/v2/shared/hooks/useDockAreaAccordion";
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

import { RunViewFlowCanvas } from "./components/RunViewFlowCanvas";
import { RunViewLoadStateFallback } from "./components/RunViewLoadStateFallback";
import { RunViewMenuBar } from "./components/RunViewMenuBar/RunViewMenuBar";
import { useAiChatWindow } from "./hooks/useAiChatWindow";
import { useFocusTaskFromUrl } from "./hooks/useFocusTaskFromUrl";
import { useRunViewLoadState } from "./hooks/useRunViewLoadState";
import { useRunViewSelectionSync } from "./hooks/useRunViewSelectionSync";
import { useRunViewSpecLifecycle } from "./hooks/useRunViewSpecLifecycle";
import { useRunViewSubgraphUrlSync } from "./hooks/useRunViewSubgraphUrlSync";
import { useRunViewWindows } from "./hooks/useRunViewWindows";
import { runViewRegistry } from "./nodes";
import { createRunViewAgentWorker } from "./toolBridge/runViewAgentWorker";

interface RunViewContentProps {
  runId: string;
}

const RunViewContent = observer(function RunViewContent({
  runId,
}: RunViewContentProps) {
  const loadState = useRunViewLoadState(runId);

  if (loadState.status === "spec") {
    return <RunViewLayout spec={loadState.spec} />;
  }

  return <RunViewLoadStateFallback state={loadState} />;
});

interface RunViewLayoutProps {
  spec: ComponentSpec;
}

const RunViewLayout = observer(function RunViewLayout({
  spec,
}: RunViewLayoutProps) {
  useRunViewSpecLifecycle(spec);
  useShortcutListener();
  useWindowPersistence("runview-v2");
  useDockAreaAccordion();
  useRunViewWindows();
  useRunViewSelectionSync();
  useRunViewSubgraphUrlSync();
  useFocusTaskFromUrl(spec);
  useCanvasControlsWindow("v2.run_view");

  const aiEnabled = useFlagValue("ai-assistant");
  useAiChatWindow(aiEnabled);

  const { navigation } = useSharedStores();
  const activeSpec = navigation.activeSpec;

  if (!activeSpec) return null;

  return (
    <NodeRegistryProvider registry={runViewRegistry}>
      <SpecProvider spec={activeSpec}>
        <RunViewMenuBar />
        <InlineStack
          className="flex-1 min-h-0 w-full"
          blockAlign="stretch"
          wrap="nowrap"
          data-testid="run-view-v2"
        >
          <DockArea side="left" />
          <div className="relative flex-1 min-w-0 h-full">
            <RunViewFlowCanvas
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
});

export function RunViewV2() {
  const params = useParams({ strict: false });

  if (!("id" in params) || typeof params.id !== "string") {
    throw new Error("Missing required id parameter");
  }

  const id = params.id;
  const subgraphExecutionId =
    "subgraphExecutionId" in params &&
    typeof params.subgraphExecutionId === "string"
      ? params.subgraphExecutionId
      : undefined;

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <AiChatStoreProvider
          createWorker={createRunViewAgentWorker}
          context={{ mode: "runView", runId: id, subgraphExecutionId }}
        >
          <ReactFlowProvider>
            <ContextPanelProvider /** TODO: remove ContextPanelProvider */>
              <ExecutionDataProvider
                pipelineRunId={id}
                subgraphExecutionId={subgraphExecutionId}
              >
                <ComponentLibraryProvider>
                  <RunViewContent runId={id} />
                </ComponentLibraryProvider>
              </ExecutionDataProvider>
            </ContextPanelProvider>
          </ReactFlowProvider>
        </AiChatStoreProvider>
      </SharedStoreProvider>
    </div>
  );
}
