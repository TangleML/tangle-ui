import { MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useCallback, useState } from "react";

import { FlowCanvas, FlowControls } from "@/components/shared/ReactFlow";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";

import { CollapsibleContextPanel } from "../shared/ContextPanel/CollapsibleContextPanel";
import { RunDetails } from "./RunDetails";

const GRID_SIZE = 10;

const PipelineRunPage = () => {
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

  return (
    <ContextPanelProvider defaultContent={<RunDetails />}>
      <ComponentLibraryProvider>
        <InlineStack fill>
          <BlockStack fill className="flex-1 relative">
            <FlowCanvas
              {...flowConfig}
              readOnly
              style={{ backgroundColor: "#dbdbdb" }}
            >
              <MiniMap position="bottom-left" pannable />
              <FlowControls
                className="ml-56! mb-6!"
                config={flowConfig}
                updateConfig={updateFlowConfig}
                showInteractive={false}
              />
            </FlowCanvas>
          </BlockStack>
          <CollapsibleContextPanel />
        </InlineStack>
      </ComponentLibraryProvider>
    </ContextPanelProvider>
  );
};

export default PipelineRunPage;
