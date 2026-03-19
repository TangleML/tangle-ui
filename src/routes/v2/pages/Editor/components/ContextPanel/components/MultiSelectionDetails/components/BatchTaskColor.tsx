import { observer } from "mobx-react-lite";

import { ColorPicker } from "@/components/ui/color";
import { InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";
import { batchSetTaskColor } from "@/routes/v2/pages/Editor/store/actions";

const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";

export const BatchTaskColor = observer(function BatchTaskColor({
  tasks,
}: {
  tasks: Task[];
}) {
  if (tasks.length === 0) return null;

  const colors = tasks.map(
    (t) =>
      (t.annotations.get(TASK_COLOR_ANNOTATION) as string) || "transparent",
  );
  const allSame = colors.every((c) => c === colors[0]);
  const displayColor = allSame ? colors[0] : "transparent";

  return (
    <>
      <Separator />
      <InlineStack align="space-between" gap="2" className="w-full">
        <InlineStack gap="2" blockAlign="center">
          <Text size="xs" className="text-gray-600">
            Task color
          </Text>
          {!allSame && (
            <Text size="xs" className="text-amber-500 italic">
              mixed
            </Text>
          )}
        </InlineStack>
        <ColorPicker
          title="Task color"
          color={displayColor}
          setColor={(color) => batchSetTaskColor(tasks, color)}
        />
      </InlineStack>
    </>
  );
});
