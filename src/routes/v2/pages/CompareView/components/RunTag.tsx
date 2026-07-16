import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DiffStatus } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

const RUN_TONE: Record<"a" | "b", string> = {
  a: "border-blue-300 bg-blue-50 text-blue-700",
  b: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

const STATUS_RUNS: Record<DiffStatus, ("a" | "b")[]> = {
  lost: ["a"],
  new: ["b"],
  changed: ["a", "b"],
  unchanged: ["a", "b"],
};

interface RunTagProps {
  run: "a" | "b";
  label: string;
}

export function RunTag({ run, label }: RunTagProps) {
  return (
    <Text
      as="span"
      size="xs"
      weight="semibold"
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono leading-none",
        RUN_TONE[run],
      )}
      title={`In run ${label}`}
    >
      {label}
    </Text>
  );
}

interface RunTagsProps {
  status: DiffStatus;
  labelA: string;
  labelB: string;
}

export function RunTags({ status, labelA, labelB }: RunTagsProps) {
  const labels: Record<"a" | "b", string> = { a: labelA, b: labelB };

  return (
    <InlineStack gap="1" blockAlign="center" wrap="nowrap">
      {STATUS_RUNS[status].map((run) => (
        <RunTag key={run} run={run} label={labels[run]} />
      ))}
    </InlineStack>
  );
}
