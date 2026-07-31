import { BlockStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { TaskDiff } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

import { TaskDiffDetail } from "./TaskDiffDetail";

interface TaskDiffRowProps {
  diff: TaskDiff;
  labelA: string;
  labelB: string;
  nameA: string;
  nameB: string;
}

export function TaskDiffRow({
  diff,
  labelA,
  labelB,
  nameA,
  nameB,
}: TaskDiffRowProps) {
  return (
    <BlockStack
      className={cn(
        "rounded-lg border p-4",
        diff.outcomeChanged ? "border-amber-300" : "border-border",
      )}
    >
      <TaskDiffDetail
        diff={diff}
        labelA={labelA}
        labelB={labelB}
        nameA={nameA}
        nameB={nameB}
      />
    </BlockStack>
  );
}
