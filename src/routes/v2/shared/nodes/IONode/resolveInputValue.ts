import type { TaskSpecOutput } from "@/api/types.gen";
import type { Input } from "@/models/componentSpec/entities/input";
import { getArgumentValue } from "@/utils/nodes/taskArguments";

export function resolveInputValue(
  input: Input,
  taskArguments?: TaskSpecOutput["arguments"] | null,
): string | undefined {
  return (
    getArgumentValue(taskArguments ?? undefined, input.name) ??
    input.value ??
    input.defaultValue
  );
}
