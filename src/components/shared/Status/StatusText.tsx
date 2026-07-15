import { cn } from "@/lib/utils";
import type { TaskStatusCounts } from "@/types/pipelineRun";

const STATUS_COLORS: Record<string, string> = {
  succeeded: "text-status-succeeded",
  failed: "text-status-failed",
  running: "text-status-running",
  pending: "text-status-pending",
  waiting: "text-status-waiting",
  skipped: "text-status-skipped",
  cancelled: "text-status-cancelled",
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
        "text-xs text-muted-foreground items-center",
        !shorthand && "flex gap-2",
      )}
    >
      {Object.entries(statusCounts).map(([key, count]) => {
        if (key === "total" || count === 0) return null;

        const statusText = shorthand
          ? `${key[0]}`
          : `${key}${count > 1 ? " " : ""}`;

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
