import "@xyflow/react/dist/style.css";

import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { registerRootStore } from "mobx-keystone";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import {
  ExecutionDataProvider,
  useExecutionData,
} from "@/providers/ExecutionDataProvider";
import { useDockAreaAccordion } from "@/routes/v2/shared/hooks/useDockAreaAccordion";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { TaskPanel } from "@/routes/v2/shared/windows/TaskPanel";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import { useWindowPersistence } from "@/routes/v2/shared/windows/windowPersistence";
import { getBackendStatusString } from "@/utils/backend";
import type { ComponentSpec as LegacyComponentSpec } from "@/utils/componentSpec";

import { RunViewFlowCanvas } from "./components/RunViewFlowCanvas";
import { RunViewMenuBar } from "./components/RunViewMenuBar/RunViewMenuBar";
import { useFocusTaskFromUrl } from "./hooks/useFocusTaskFromUrl";
import { useRunViewSelectionSync } from "./hooks/useRunViewSelectionSync";
import { useRunViewSpecLifecycle } from "./hooks/useRunViewSpecLifecycle";
import { useRunViewWindows } from "./hooks/useRunViewWindows";
import { runViewRegistry } from "./nodes";

function deserializeRunSpec(data: unknown): ComponentSpec {
  const generator = new IncrementingIdGenerator();
  const deserializer = new YamlDeserializer(generator);
  const spec = deserializer.deserialize(data);
  registerRootStore(spec);
  return spec;
}

const RunViewContent = observer(function RunViewContent() {
  const { setComponentSpec, clearComponentSpec } = useComponentSpec();
  const { configured, available, ready } = useBackend();

  const { details, state, rootDetails, isLoading, error } = useExecutionData();

  const specRef = useRef<ComponentSpec | null>(null);

  useEffect(() => {
    if (rootDetails?.task_spec.componentRef.spec) {
      setComponentSpec(
        rootDetails.task_spec.componentRef.spec as LegacyComponentSpec,
      );
    }

    return () => {
      clearComponentSpec();
    };
  }, [rootDetails, setComponentSpec, clearComponentSpec]);

  useEffect(() => {
    if (rootDetails?.task_spec.componentRef.spec && !specRef.current) {
      specRef.current = deserializeRunSpec(
        rootDetails.task_spec.componentRef.spec,
      );
    }
  }, [rootDetails]);

  const csomSpec = specRef.current;

  if (csomSpec) {
    return <RunViewLayout spec={csomSpec} />;
  }

  if (isLoading || !ready) {
    return <LoadingScreen message="Loading Pipeline Run" />;
  }

  if (!configured) {
    return (
      <BlockStack fill>
        <InfoBox title="Backend not configured" variant="warning">
          Configure a backend to view this pipeline run.
        </InfoBox>
      </BlockStack>
    );
  }

  if (!available) {
    return (
      <BlockStack fill>
        <InfoBox title="Backend not available" variant="error">
          The configured backend is not available.
        </InfoBox>
      </BlockStack>
    );
  }

  if (error) {
    const backendStatusString = getBackendStatusString(configured, available);
    return (
      <BlockStack fill>
        <InfoBox title="Error loading pipeline run" variant="error">
          <Paragraph className="mb-2">{error.message}</Paragraph>
          <Paragraph className="italic">{backendStatusString}</Paragraph>
        </InfoBox>
      </BlockStack>
    );
  }

  if (!details || !state) {
    return <LoadingScreen message="Loading Pipeline Run" />;
  }

  return null;
});

interface RunViewLayoutProps {
  spec: ComponentSpec;
}

const RunViewLayout = observer(function RunViewLayout({
  spec,
}: RunViewLayoutProps) {
  useRunViewSpecLifecycle(spec);
  useShortcutListener();
  useWindowPersistence("runview");
  useDockAreaAccordion();
  useRunViewWindows();
  useRunViewSelectionSync();
  useFocusTaskFromUrl(spec);

  const { navigation } = useSharedStores();
  const activeSpec = navigation.activeSpec;

  if (!activeSpec) return null;

  return (
    <NodeRegistryProvider registry={runViewRegistry}>
      <SpecProvider spec={activeSpec}>
        <RunViewMenuBar />
        <TaskPanel />
        <InlineStack
          className="flex-1 min-h-0 w-full"
          gap="0"
          blockAlign="stretch"
          wrap="nowrap"
          data-testid="run-view-v2"
        >
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
    <div className="h-full w-full flex flex-col bg-slate-100">
      <SharedStoreProvider>
        <ReactFlowProvider>
          <ContextPanelProvider /** TODO: remove ContextPanelProvider */>
            <ExecutionDataProvider
              pipelineRunId={id}
              subgraphExecutionId={subgraphExecutionId}
            >
              <RunViewContent />
            </ExecutionDataProvider>
          </ContextPanelProvider>
        </ReactFlowProvider>
      </SharedStoreProvider>
    </div>
  );
}
