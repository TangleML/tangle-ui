import { Controls, MiniMap } from "@xyflow/react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";

export function CanvasControlsContent() {
  const { track } = useAnalytics();

  return (
    <BlockStack
      fill
      className="relative bg-white [--xy-minimap-mask-background-color-props:#f0f0f0] [--xy-minimap-node-background-color-props:grey]"
      data-testid="canvas-controls-window"
    >
      <InlineStack fill blockAlign="start" className="relative">
        <MiniMap
          pannable
          zoomable
          onClick={() => track("v2.pipeline_canvas.minimap.click")}
          onNodeClick={() => track("v2.pipeline_canvas.minimap.node.click")}
          className="flex-1 !relative !inset-auto !m-0 !w-full !h-full [&_.react-flow__minimap-svg]:!w-full [&_.react-flow__minimap-svg]:!h-full [&_.react-flow__minimap-svg]:!block"
        />
        <Controls
          showZoom
          showFitView
          showInteractive
          onZoomIn={() => track("v2.pipeline_canvas.controls.zoom_in.click")}
          onZoomOut={() => track("v2.pipeline_canvas.controls.zoom_out.click")}
          onFitView={() => track("v2.pipeline_canvas.controls.fit_view.click")}
          onInteractiveChange={(interactive) =>
            track("v2.pipeline_canvas.controls.interactive.toggle", {
              interactive,
            })
          }
          className="h-full !relative !inset-auto !m-0 !shadow-none flex justify-around"
        />
      </InlineStack>
    </BlockStack>
  );
}
