import { cn } from "@/lib/utils";
import type { TaskStatusCounts } from "@/types/pipelineRun";

const STATUS_COLORS: Record<string, string> = {
  succeeded: "text-green-500",
  failed: "text-red-500",
  running: "text-blue-500",
  skipped: "text-gray-800",
  waiting: "text-yellow-600",
  cancelled: "text-gray-800",
};

const STATUS_DISPLAY_NAMES: Record<string, string> = {
  waiting: "pending",
};

const StatusText = ({
  statusCounts,
  shorthand,
}: {
  statusCounts: TaskStatusCounts;
  shorthand?: boolean;
}) => {
  return (
    <div
      className={cn(
        "text-xs text-gray-500 items-center",
        !shorthand && "flex gap-2",
      )}
    >
      {Object.entries(statusCounts).map(([key, count]) => {
        if (key === "total" || count === 0) return null;

        const displayKey = STATUS_DISPLAY_NAMES[key] ?? key;
        const statusText = shorthand
          ? `${displayKey[0]}`
          : `${displayKey}${count > 1 ? " " : ""}`;

        const statusColor = STATUS_COLORS[key];

        if (shorthand) {
          return (
            <span key={key} className="group">
              <span className={statusColor}>
                {count}
                {statusText}
              </span>
              <span className="group-last:hidden"> • </span>
            </span>
          );
        }
        return (
          <span key={key} className="flex items-center">
            <span className={statusColor}>
              {count} {statusText.trim()}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export default StatusText;
