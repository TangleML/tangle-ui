import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useSpec } from "@/routes/EditorV2/providers/SpecContext";

interface InputValidationIndicatorProps {
  entityId: string;
  inputName: string;
  className?: string;
}

export const InputValidationIndicator = observer(
  function InputValidationIndicator({
    entityId,
    inputName,
    className,
  }: InputValidationIndicatorProps) {
    const spec = useSpec();
    const issues = spec?.issuesByEntityId.get(entityId);
    if (!issues) return null;

    let severity: "error" | "warning" | null = null;
    for (const issue of issues) {
      if (issue.argumentName === inputName) {
        if (issue.severity === "error") {
          severity = "error";
          break;
        }
        severity = "warning";
      }
    }

    if (!severity) return null;

    return (
      <Icon
        name="CircleAlert"
        size="xs"
        className={cn(
          "shrink-0 size-3",
          severity === "error" ? "text-red-400" : "text-amber-400",
          className,
        )}
      />
    );
  },
);
