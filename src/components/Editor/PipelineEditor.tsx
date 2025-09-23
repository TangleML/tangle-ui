import "@/styles/editor.css";

import { Background, MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useState } from "react";

import { CollapsibleContextPanel } from "@/components/shared/ContextPanel/CollapsibleContextPanel";
import {
  FlowCanvas,
  FlowControls,
  FlowSidebar,
} from "@/components/shared/ReactFlow";
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
import { NodesOverlayProvider } from "../shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
import EditorToolbar from "../shared/ReactFlow/Toolbar/EditorToolbar";
import PipelineDetails from "./Context/PipelineDetails";

const GRID_SIZE = 10;

const PipelineEditor = () => {
  const { componentSpec, isLoading } = useComponentSpec();

  const [isCommenting, setIsCommenting] = useState(false);
  const toggleCommentMode = () => {
    setIsCommenting((prev) => !prev);
  };

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
                  <FlowCanvas {...flowConfig}>
                    <MiniMap position="bottom-left" pannable />
                    <FlowControls
                      className="ml-56! mb-6!"
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
