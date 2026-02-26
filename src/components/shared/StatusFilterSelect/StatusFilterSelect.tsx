import type { ContainerExecutionStatus } from "@/api/types.gen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EXECUTION_STATUS_LABELS,
  getExecutionStatusLabel,
  isValidExecutionStatus,
} from "@/utils/executionStatus";

const STATUS_OPTIONS = Object.keys(EXECUTION_STATUS_LABELS).filter(
  (s): s is ContainerExecutionStatus => isValidExecutionStatus(s),
);

interface StatusFilterSelectProps {
  value: ContainerExecutionStatus | undefined;
  onChange: (value: ContainerExecutionStatus | undefined) => void;
  className?: string;
}

export function StatusFilterSelect({
  value,
  onChange,
  className,
}: StatusFilterSelectProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === "all") {
      onChange(undefined);
    } else if (isValidExecutionStatus(newValue)) {
      onChange(newValue);
    }
  };

  const hasActiveFilter = value !== undefined;

  return (
    <Select value={value ?? "all"} onValueChange={handleValueChange}>
      <SelectTrigger
        className={cn(
          "w-40",
          hasActiveFilter && "ring-2 ring-primary/20",
          className,
        )}
      >
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {STATUS_OPTIONS.map((status) => (
          <StatusOption key={status} status={status} />
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusOption({ status }: { status: ContainerExecutionStatus }) {
  const label = getExecutionStatusLabel(status);
  return <SelectItem value={status}>{label}</SelectItem>;
}
