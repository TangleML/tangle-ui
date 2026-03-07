import { Badge } from "@/components/ui/badge";
import type { ValidationIssue } from "@/models/componentSpec";

import { countErrors, countWarnings } from "../../ValidationSummary";

interface IssueBadgeProps {
  issues: ValidationIssue[];
}

export function IssueBadge({ issues }: IssueBadgeProps) {
  const errorCount = countErrors(issues);
  const warningCount = countWarnings(issues);

  if (errorCount === 0 && warningCount === 0) return null;

  if (errorCount > 0) {
    return (
      <Badge
        variant="destructive"
        size="xs"
        shape="rounded"
        className="shrink-0"
      >
        {errorCount + warningCount}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      size="xs"
      shape="rounded"
      className="shrink-0 border-amber-400 text-amber-600"
    >
      {warningCount}
    </Badge>
  );
}
