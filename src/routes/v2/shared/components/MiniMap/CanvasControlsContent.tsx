import { Controls, MiniMap } from "@xyflow/react";

import { BlockStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";

import styles from "./CanvasControlsContent.module.css";

export function CanvasControlsContent({
  trackingSpace = "v2.pipeline_canvas",
}: {
  trackingSpace: string;
}) {
  const { track } = useAnalytics();

  return (
    <BlockStack
      fill
      className={styles.container}
      data-testid="canvas-controls-window"
    >
      <BlockStack fill align="stretch" className={styles.layout}>
        <MiniMap
          pannable
          zoomable
          onClick={() => track(`${trackingSpace}.minimap.click`)}
          onNodeClick={() => track(`${trackingSpace}.minimap.node.click`)}
          className={styles.minimap}
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
          className={styles.controls}
        />
      </BlockStack>
    </BlockStack>
  );
}
