import "@/styles/editor.css";

import { Background, MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useRef, useState } from "react";

import { CollapsibleContextPanel } from "@/components/shared/ContextPanel/CollapsibleContextPanel";
import {
  FlowCanvas,
  FlowControls,
  FlowSidebar,
} from "@/components/shared/ReactFlow";
import { UndoRedo } from "@/components/shared/UndoRedo";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { AutoSaveProvider } from "@/providers/AutoSaveProvider";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import {
  EMPTY_GRAPH_COMPONENT_SPEC,
  useComponentSpec,
} from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";

import { LoadingScreen } from "../shared/LoadingScreen";
import type { FlowCanvasRef } from "../shared/ReactFlow/FlowCanvas/FlowCanvas";
import type { LayoutAlgorithm } from "../shared/ReactFlow/FlowCanvas/utils/autolayout";
import { NodesOverlayProvider } from "../shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
import PipelineDetails from "./Context/PipelineDetails";

const GRID_SIZE = 10;

const PipelineEditor = () => {
  const flowCanvasRef = useRef<FlowCanvasRef>(null);

  const { componentSpec, isLoading } = useComponentSpec();

  const [flowConfig, setFlowConfig] = useState<ReactFlowProps>({
    snapGrid: [GRID_SIZE, GRID_SIZE],
    snapToGrid: true,
    panOnDrag: true,
    selectionOnDrag: false,
    nodesDraggable: true,
  });

  const updateFlowConfig = (updatedConfig: Partial<ReactFlowProps>) => {
    setFlowConfig((prevConfig) => ({
      ...prevConfig,
      ...updatedConfig,
    }));
  };

  const handleAutoLayout = (algorithm: LayoutAlgorithm) => {
    flowCanvasRef.current?.autoLayout(algorithm);
  };

  // If the pipeline is loading or the component spec is empty, show a loading spinner
  if (isLoading || componentSpec === EMPTY_GRAPH_COMPONENT_SPEC) {
    return <LoadingScreen message="Loading Pipeline" />;
  }

  return (
    <AutoSaveProvider>
      <NodesOverlayProvider>
        <ContextPanelProvider defaultContent={<PipelineDetails />}>
          <ForcedSearchProvider>
            <ComponentLibraryProvider>
              <InlineStack fill>
                <FlowSidebar />
                <BlockStack fill className="flex-1 relative">
                  <FlowCanvas ref={flowCanvasRef} {...flowConfig}>
                    <MiniMap position="bottom-left" pannable />
                    <FlowControls
                      className="ml-56! mb-3!"
                      config={flowConfig}
                      updateConfig={updateFlowConfig}
                      onAutoLayout={handleAutoLayout}
                      showInteractive={false}
                    />
                    <Background gap={GRID_SIZE} className="bg-slate-50!" />
                  </FlowCanvas>

                  <div className="absolute bottom-0 right-0 p-4">
                    <UndoRedo />
                  </div>
                </BlockStack>
                <CollapsibleContextPanel />
              </InlineStack>
            </ComponentLibraryProvider>
          </ForcedSearchProvider>
        </ContextPanelProvider>
      </NodesOverlayProvider>
    </AutoSaveProvider>
  );
};

export default PipelineEditor;
