import { ReactFlowProvider } from "@xyflow/react";
import { useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Skeleton } from "@/components/ui/skeleton";
import type { TaskNodeViewProps } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import { TaskNodeCard } from "@/routes/v2/shared/nodes/TaskNode/TaskNodeCard";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";

import { buildPreviewTaskNodeViewProps } from "../utils/buildPreviewTaskNodeViewProps";
import { PointersEventBlock } from "./PointersEventBlock";

export const PreviewTaskNodeCard = ({
  componentText,
}: {
  componentText: string;
}) => {
  const viewProps = buildPreviewTaskNodeViewProps(componentText);
  const lastValidPropsRef = useRef<TaskNodeViewProps | null>(null);

  if (viewProps) {
    lastValidPropsRef.current = viewProps;
  }

  const displayProps = viewProps ?? lastValidPropsRef.current;

  if (!displayProps) {
    return <Skeleton size="lg" shape="square" />;
  }

  return (
    <ErrorBoundary resetKeys={[componentText]} fallbackRender={() => null}>
      <ReactFlowProvider>
        <SpecProvider spec={null}>
          <PointersEventBlock>
            <TaskNodeCard {...displayProps} />
          </PointersEventBlock>
        </SpecProvider>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
};
