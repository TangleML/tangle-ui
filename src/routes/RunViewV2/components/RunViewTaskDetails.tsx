import { observer } from "mobx-react-lite";

import TaskDetails from "@/components/shared/TaskDetails/Details";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import type { ComponentReference } from "@/utils/componentSpec";

import { useSpec } from "../../EditorV2/providers/SpecContext";

interface RunViewTaskDetailsProps {
  entityId: string;
}

export const RunViewTaskDetails = observer(function RunViewTaskDetails({
  entityId,
}: RunViewTaskDetailsProps) {
  const spec = useSpec();
  const executionData = useExecutionDataOptional();

  const task = spec?.tasks.find((t) => t.$id === entityId);

  if (!task) {
    return (
      <BlockStack className="p-4">
        <Text size="sm" tone="subdued">
          Task not found
        </Text>
      </BlockStack>
    );
  }

  const status = executionData?.taskExecutionStatusMap.get(task.name);
  const executionId =
    executionData?.details?.child_task_execution_ids?.[task.name];

  const componentRef =
    task.componentRef as unknown as ComponentReference;

  return (
    <BlockStack className="w-full overflow-auto">
      <TaskDetails
        componentRef={componentRef}
        executionId={executionId}
        status={status}
        readOnly
        options={{ descriptionExpanded: true }}
      />
    </BlockStack>
  );
});
