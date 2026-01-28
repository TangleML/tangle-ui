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
} from "@/utils/executionStatus";

function isValidStatus(value: string): value is ContainerExecutionStatus {
  return value in EXECUTION_STATUS_LABELS;
}

const STATUS_OPTIONS = Object.keys(EXECUTION_STATUS_LABELS).filter(
  isValidStatus,
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
    } else if (isValidStatus(newValue)) {
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
          <SelectItem key={status} value={status}>
            {getExecutionStatusLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
