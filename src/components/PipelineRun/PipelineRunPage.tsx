import { Background, MiniMap, type ReactFlowProps } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { FlowCanvas, FlowControls } from "@/components/shared/ReactFlow";
import { useNodesOverlay } from "@/components/shared/ReactFlow/NodesOverlay/NodesOverlayProvider";
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
  const { fitNodeIntoView, selectNode, notifyNode } = useNodesOverlay();

  useEffect(() => {
    const nodeId = new URLSearchParams(window.location.search).get("nodeId");
    if (!nodeId) return;

    let timeoutId: NodeJS.Timeout;
    let isHighlighted = false;

    const clearHighlight = () => {
      if (!isHighlighted) return;

      isHighlighted = false;

      notifyNode(nodeId, { type: "clear" });

      const url = new URL(window.location.href);
      url.searchParams.delete("nodeId");

      history.replaceState(null, "", url.toString());
      document.removeEventListener("pointerdown", clearHighlight);
    };

    const focus = async () => {
      const success = await fitNodeIntoView(nodeId);
      if (!success) return;

      isHighlighted = true;

      selectNode(nodeId);
      notifyNode(nodeId, { type: "highlight" });

      timeoutId = setTimeout(() => {
        document.addEventListener("pointerdown", clearHighlight);
      }, 500);
    };

    // Double-RAF to allow for Canvas to first render
    const frameId = requestAnimationFrame(() => requestAnimationFrame(focus));

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      clearHighlight();
    };
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
