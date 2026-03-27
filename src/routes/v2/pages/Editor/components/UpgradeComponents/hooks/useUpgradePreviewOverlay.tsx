import type { ComponentType } from "react";

import { useCanvasOverlay } from "@/routes/v2/shared/hooks/useCanvasOverlay";
import type { TaskNodeViewProps } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { CanvasOverlayConfig } from "@/routes/v2/shared/store/canvasOverlay.types";

import { UpgradePreviewTaskNode } from "../components/UpgradePreviewTaskNode";
import type { UpgradeCandidate } from "../types";

const OVERLAY_ID = "upgrade-preview";

export function useUpgradePreviewOverlay(candidates: UpgradeCandidate[]): void {
  const wrapperMap = new Map<string, ComponentType<TaskNodeViewProps>>();
  const issueIds = new Set<string>();

  for (const candidate of candidates) {
    const Wrapper = (props: TaskNodeViewProps) => (
      <UpgradePreviewTaskNode {...props} candidate={candidate} />
    );
    wrapperMap.set(candidate.taskId, Wrapper);
    if (candidate.predictedIssues.length > 0) issueIds.add(candidate.taskId);
  }

  const config: CanvasOverlayConfig | null =
    candidates.length > 0
      ? {
          id: OVERLAY_ID,
          resolveNodeEffect: (nodeId) => {
            const wrapper = wrapperMap.get(nodeId);
            if (!wrapper) return { opacity: 0.3 };
            return {
              componentOverride: wrapper,
              className: issueIds.has(nodeId)
                ? "ring-2 ring-amber-400 rounded-xl"
                : undefined,
            };
          },
        }
      : null;

  useCanvasOverlay(config);
}
