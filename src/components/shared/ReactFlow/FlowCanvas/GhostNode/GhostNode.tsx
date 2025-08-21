import { type NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";
import type { ComponentReference } from "@/utils/componentSpec";
import { generateTaskSpec } from "@/utils/nodes/generateTaskSpec";

import { TaskNodeCard } from "../TaskNode/TaskNodeCard";

const GhostNode = memo(({ data }: NodeProps) => {
  const baseOffsetX = 12;
  const baseOffsetY = -24;

  const side = data.side === "left" ? "left" : "right";
  const transformOrigin = side === "left" ? "center right" : "center left";
  const offsetX = side === "left" ? -baseOffsetX : baseOffsetX;
  const offsetY = baseOffsetY;

  const componentRef = data.componentRef as ComponentReference;

  const ghostTaskData = useMemo(() => {
    return generateGhostTaskNodeData(componentRef);
  }, [componentRef]);

  return (
    <div
      className={cn(
        "opacity-60 pointer-events-none",
        data.side === "left" ? "-translate-x-full" : "",
      )}
      style={{
        filter: "brightness(0.9) saturate(0.7)",
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        transformOrigin,
      }}
    >
      <div
        className="
          border-2 
          border-dashed 
          border-blue-400/60 
          rounded-lg 
          p-1
        "
      >
        <TaskNodeProvider data={ghostTaskData} selected={false}>
          <TaskNodeCard />
        </TaskNodeProvider>
      </div>
    </div>
  );
});

GhostNode.displayName = "GhostNode";

export default GhostNode;

const generateGhostTaskNodeData = (
  componentRef: ComponentReference,
  taskId?: string,
): TaskNodeData => {
  const ghostTaskId =
    taskId ||
    `ghost-${componentRef.name ?? componentRef.spec?.name ?? "unknown"}`;
  const taskSpec = generateTaskSpec(componentRef);

  return {
    taskSpec,
    taskId: ghostTaskId,
    isGhost: true,
  };
};
