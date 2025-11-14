import "@/styles/editor.css";

import { Background, MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useCallback, useState } from "react";

import { CollapsibleContextPanel } from "@/components/shared/ContextPanel/CollapsibleContextPanel";
import {
  FlowCanvas,
  FlowControls,
  FlowSidebar,
} from "@/components/shared/ReactFlow";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { AutoSaveProvider } from "@/providers/AutoSaveProvider";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import {
  EMPTY_GRAPH_COMPONENT_SPEC,
  useComponentSpec,
} from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { PipelineRunsProvider } from "@/providers/PipelineRunsProvider";

import { NodesOverlayProvider } from "../shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
import EditorToolbar from "../shared/ReactFlow/Toolbar/EditorToolbar";
import PipelineDetails from "./PipelineDetails";

const GRID_SIZE = 10;

const PipelineEditor = () => {
  const { componentSpec, isLoading } = useComponentSpec();

  const [isCommenting, setIsCommenting] = useState(false);
  const toggleCommentMode = useCallback(() => {
    setIsCommenting((prev) => !prev);
  }, []);

  const [flowConfig, setFlowConfig] = useState<ReactFlowProps>({
    snapGrid: [GRID_SIZE, GRID_SIZE],
    snapToGrid: true,
    panOnDrag: true,
    selectionOnDrag: false,
    nodesDraggable: true,
  });

  const updateFlowConfig = useCallback(
    (updatedConfig: Partial<ReactFlowProps>) => {
      setFlowConfig((prevConfig) => ({
        ...prevConfig,
        ...updatedConfig,
      }));
    },
    [],
  );

  // If the pipeline is loading or the component spec is empty, show a loading spinner
  if (isLoading || componentSpec === EMPTY_GRAPH_COMPONENT_SPEC) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Spinner className="mr-2 w-10 h-10" />
        <p className="text-secondary-foreground">Loading pipeline...</p>
      </div>
    );
  }

  return (
    <AutoSaveProvider>
      <PipelineRunsProvider pipelineName={componentSpec.name || ""}>
        <NodesOverlayProvider>
          <ContextPanelProvider defaultContent={<PipelineDetails />}>
            <ForcedSearchProvider>
              <ComponentLibraryProvider>
                <FlowSidebar />

                <InlineStack className="w-full h-full" align="start">
                  <BlockStack className="flex-1 h-full">
                    <div className="reactflow-wrapper relative">
                      <FlowCanvas {...flowConfig} isCommenting={isCommenting}>
                        <MiniMap position="bottom-left" pannable />
                        <FlowControls
                          className="ml-[224px]! mb-[24px]!"
                          config={flowConfig}
                          updateConfig={updateFlowConfig}
                          showInteractive={false}
                        />
                        <Background gap={GRID_SIZE} className="bg-slate-50!" />
                      </FlowCanvas>

                      <EditorToolbar
                        position="bottom-right"
                        isCommenting={isCommenting}
                        toggleCommentMode={toggleCommentMode}
                      />
                    </div>
                  </BlockStack>
                  <CollapsibleContextPanel />
                </InlineStack>
              </ComponentLibraryProvider>
            </ForcedSearchProvider>
          </ContextPanelProvider>
        </NodesOverlayProvider>
      </PipelineRunsProvider>
    </AutoSaveProvider>
  );
};

export default PipelineEditor;
