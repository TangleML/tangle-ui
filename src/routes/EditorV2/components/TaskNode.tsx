import type { NodeProps } from "@xyflow/react";

import { TaskNodeCard } from "./TaskNodeCard";

interface TaskNodeProps extends NodeProps {
  data: {
    name: string;
    description: string;
  }
}

export function TaskNode({ data, selected }: TaskNodeProps) {
  console.log(`TaskNode:`, data);
  return <TaskNodeCard name={data.name} description={data.description} />;
}
