import { Controls, MiniMap } from "@xyflow/react";

import { BlockStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";

export function CanvasControlsContent({
  trackingSpace = "v2.pipeline_canvas",
}: {
  trackingSpace: string;
}) {
  const { track } = useAnalytics();

  return (
    <BlockStack
      fill
      className="@container relative bg-background [--xy-minimap-mask-background-color-props:#f0f0f0] [--xy-minimap-node-background-color-props:grey] dark:[--xy-minimap-mask-background-color-props:black]"
      data-testid="canvas-controls-window"
    >
      <BlockStack fill align="stretch" className="relative @[220px]:flex-row">
        <MiniMap
          pannable
          zoomable
          onClick={() => track(`${trackingSpace}.minimap.click`)}
          onNodeClick={() => track(`${trackingSpace}.minimap.node.click`)}
          className="dark:rounded-md dark:border dark:border-border flex-1 !relative !inset-auto !m-0 !w-full !h-full [&_.react-flow__minimap-svg]:!w-full [&_.react-flow__minimap-svg]:!h-full [&_.react-flow__minimap-svg]:!block"
        />
        <Controls
          showZoom
          showFitView
          showInteractive
          onZoomIn={() => track(`${trackingSpace}.controls.zoom_in.click`)}
          onZoomOut={() => track(`${trackingSpace}.controls.zoom_out.click`)}
          onFitView={() => track(`${trackingSpace}.controls.fit_view.click`)}
          onInteractiveChange={(interactive) =>
            track(`${trackingSpace}.controls.interactive.toggle`, {
              interactive,
            })
          }
          className="!relative !inset-auto !m-0 !shadow-none flex !flex-row justify-around @[220px]:h-full @[220px]:!flex-col"
        />
      </BlockStack>
    </BlockStack>
  );
}
