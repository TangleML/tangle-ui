import "@xyflow/react/dist/style.css";

import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { AiChatStoreProvider } from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import { useCanvasControlsWindow } from "@/routes/v2/shared/components/MiniMap/useCanvasControlsWindow";
import { useDockAreaAccordion } from "@/routes/v2/shared/hooks/useDockAreaAccordion";
import { useReadOnlySpecLifecycle } from "@/routes/v2/shared/hooks/useReadOnlySpecLifecycle";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { useWindowPersistence } from "@/routes/v2/shared/windows/windowPersistence";

import { RunViewLoadStateFallback } from "./components/RunViewLoadStateFallback";
import { RunViewMenuBar } from "./components/RunViewMenuBar/RunViewMenuBar";
import { RunViewViewport } from "./components/RunViewViewport";
import { useAiChatWindow } from "./hooks/useAiChatWindow";
import { useFocusTaskFromUrl } from "./hooks/useFocusTaskFromUrl";
import { useRunViewLoadState } from "./hooks/useRunViewLoadState";
import { useRunViewSelectionSync } from "./hooks/useRunViewSelectionSync";
import { useRunViewSubgraphUrlSync } from "./hooks/useRunViewSubgraphUrlSync";
import { useRunViewWindows } from "./hooks/useRunViewWindows";
import { createRunViewAgentWorker } from "./toolBridge/runViewAgentWorker";

interface RunViewContentProps {
  runId: string;
}

function RunViewContent({ runId }: RunViewContentProps) {
  const loadState = useRunViewLoadState(runId);

  if (loadState.status === "spec") {
    return <RunViewLayout spec={loadState.spec} />;
  }

  return <RunViewLoadStateFallback state={loadState} />;
}

interface RunViewLayoutProps {
  spec: ComponentSpec;
}

function RunViewLayout({ spec }: RunViewLayoutProps) {
  useReadOnlySpecLifecycle(spec);
  useShortcutListener();
  useWindowPersistence("runview-v2");
  useDockAreaAccordion();
  useRunViewWindows({ offersTangentHandoff: true });
  useRunViewSelectionSync();
  useRunViewSubgraphUrlSync();
  useFocusTaskFromUrl(spec);
  useCanvasControlsWindow("v2.run_view");

  const aiEnabled = useFlagValue("ai-assistant");
  useAiChatWindow(aiEnabled);

  return (
    <RunViewViewport
      header={<RunViewMenuBar />}
      leftDock={<DockArea side="left" />}
    />
  );
}

export function RunView() {
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
            <ExecutionDataProvider
              pipelineRunId={id}
              subgraphExecutionId={subgraphExecutionId}
            >
              <ComponentLibraryProvider>
                <RunViewContent runId={id} />
              </ComponentLibraryProvider>
            </ExecutionDataProvider>
          </ReactFlowProvider>
        </AiChatStoreProvider>
      </SharedStoreProvider>
    </div>
  );
}
