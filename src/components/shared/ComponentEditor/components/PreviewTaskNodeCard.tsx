import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Skeleton } from "@/components/ui/skeleton";
import { TaskNodeProvider } from "@/providers/TaskNodeProvider";
import type { TaskNodeData } from "@/types/taskNode";

import { TaskNodeCard } from "../../ReactFlow/FlowCanvas/TaskNode/TaskNodeCard";
import { usePreviewTaskNodeData } from "../usePreviewTaskNodeData";
import { PointersEventBlock } from "./PointersEventBlock";

export const PreviewTaskNodeCard = ({
  componentText,
}: {
  componentText: string;
}) => {
  const previewNodeData = usePreviewTaskNodeData(componentText);
  const lastValidDataRef = useRef<TaskNodeData | null>(null);

  if (previewNodeData) {
    lastValidDataRef.current = previewNodeData;
  }

  const displayData = previewNodeData || lastValidDataRef.current;

  if (!displayData) {
    return <Skeleton size="lg" shape="square" />;
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} fallbackRender={() => null}>
          <Suspense fallback={null}>
            <PointersEventBlock>
              <TaskNodeProvider data={displayData} selected={false}>
                <TaskNodeCard />
              </TaskNodeProvider>
            </PointersEventBlock>
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};
