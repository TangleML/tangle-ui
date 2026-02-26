import { Background, MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

import { FlowCanvas, FlowControls } from "@/components/shared/ReactFlow";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";

import { CollapsibleContextPanel } from "../shared/ContextPanel/CollapsibleContextPanel";
import type { FlowCanvasRef } from "../shared/ReactFlow/FlowCanvas/FlowCanvas";
import type { LayoutAlgorithm } from "../shared/ReactFlow/FlowCanvas/utils/autolayout";
import { RunDetails } from "./RunDetails";
import { RunToolbar } from "./RunToolbar";

const GRID_SIZE = 10;

const PipelineRunPage = () => {
  const flowCanvasRef = useRef<FlowCanvasRef>(null);

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

  const handleAutoLayout = (algorithm: LayoutAlgorithm) => {
    flowCanvasRef.current?.autoLayout(algorithm);
  };

  return (
    <ContextPanelProvider defaultContent={<RunDetails />}>
      <ComponentLibraryProvider>
        <InlineStack fill>
          <BlockStack fill className="flex-1">
            <FlowCanvas ref={flowCanvasRef} {...flowConfig} readOnly>
              <MiniMap position="bottom-left" pannable />
              <RunToolbar />
              <FlowControls
                className="ml-56! mb-3!"
                config={flowConfig}
                updateConfig={updateFlowConfig}
                onAutoLayout={handleAutoLayout}
                showInteractive={false}
              />
              <Background gap={GRID_SIZE} className="bg-slate-50!" />
            </FlowCanvas>
          </BlockStack>
          <CollapsibleContextPanel />
        </InlineStack>
      </ComponentLibraryProvider>
    </ContextPanelProvider>
  );
};

export default PipelineRunPage;
