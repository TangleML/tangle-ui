import { Badge } from "@/components/ui/badge";
import type { ComponentMatchStrength } from "@/services/componentSearchRelevance";

const MATCH_LABELS = {
  strong: {
    label: "Strong match",
    description: "Directly supports the requested task.",
  },
  partial: {
    label: "Partial match",
    description:
      "Supports part of the requested task; additional components may be needed.",
  },
  related: {
    label: "Related",
    description:
      "Related to the topic, but may not perform the requested task.",
  },
  weak: {
    label: "Weak match",
    description:
      "Little evidence that this component supports the requested task.",
  },
};

export function ComponentSearchMatchBadge({
  strength,
}: {
  strength: ComponentMatchStrength;
}) {
  const { label, description } = MATCH_LABELS[strength];
  return (
    <Badge
      variant="secondary"
      size="sm"
      shape="rounded"
      className={
        strength === "strong"
          ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30"
          : strength === "partial"
            ? "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/15 dark:border-sky-500/30"
            : "text-muted-foreground bg-muted border-border"
      }
      title={description}
      aria-label={label}
    >
      {label}
    </Badge>
  );
}
