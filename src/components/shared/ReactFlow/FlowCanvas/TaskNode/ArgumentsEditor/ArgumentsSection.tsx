import { ScrollArea } from "@/components/ui/scroll-area";
import { Paragraph } from "@/components/ui/typography";
import type { ArgumentType, TaskSpec } from "@/utils/componentSpec";

import { ArgumentsEditor } from "../ArgumentsEditor";

interface ArgumentsSectionProps {
  taskSpec: TaskSpec;
  setArguments: (args: Record<string, ArgumentType>) => void;
  disabled?: boolean;
}

const ArgumentsSection = ({
  taskSpec,
  setArguments,
  disabled = false,
}: ArgumentsSectionProps) => {
  return (
    <ScrollArea className="w-full">
      <Paragraph size="sm" tone="subdued" className="mb-4">
        Configure the arguments for this task node.
      </Paragraph>
      <ArgumentsEditor
        taskSpec={taskSpec}
        setArguments={setArguments}
        disabled={disabled}
      />
    </ScrollArea>
  );
};

export default ArgumentsSection;
