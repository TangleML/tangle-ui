import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson, Task } from "@/models/componentSpec";

import { useSpec } from "../../../../../providers/SpecContext";
import { ArgumentRow } from "../../../../ArgumentRow";

interface TaskArgumentsEditorProps {
  task: Task;
}

export const TaskArgumentsEditor = observer(function TaskArgumentsEditor({
  task,
}: TaskArgumentsEditorProps) {
  const spec = useSpec();
  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  const inputs = componentSpec?.inputs ?? [];

  if (!spec || inputs.length === 0) {
    return (
      <Text size="xs" tone="subdued" className="px-3 py-2">
        No inputs defined
      </Text>
    );
  }

  const taskBindings = spec.bindings.filter(
    (b) => b.targetEntityId === task.$id,
  );

  return (
    <BlockStack gap="1" className="min-w-0 overflow-hidden">
      {inputs.map((inputSpec) => {
        const arg = task.arguments.find((a) => a.name === inputSpec.name);
        const binding = taskBindings.find(
          (b) => b.targetPortName === inputSpec.name,
        );
        return (
          <ArgumentRow
            key={inputSpec.name}
            inputSpec={inputSpec}
            currentValue={arg?.value}
            isSet={arg !== undefined}
            binding={binding}
            task={task}
            spec={spec}
          />
        );
      })}
    </BlockStack>
  );
});
