import {
  CircleAlert,
  CircleCheck,
  CircleEllipsis,
  CircleHelp,
  CircleMinus,
  CircleX,
  RefreshCw,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getExecutionStatusLabel } from "@/utils/executionStatus";

const StatusIcon = ({
  status,
  tooltip = false,
  label = "run",
}: {
  status?: string;
  tooltip?: boolean;
  label?: "run" | "task" | "pipeline";
}) => {
  if (tooltip) {
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
    const displayStatus = getExecutionStatusLabel(status);
    const tooltipText = `${capitalizedLabel} ${displayStatus}`;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Icon status={status} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span>{tooltipText}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <Icon status={status} />;
};

const Icon = ({ status }: { status?: string }) => {
  switch (status) {
    case "SUCCEEDED":
      return <CircleCheck className="w-4 h-4 text-status-succeeded" />;
    case "FAILED":
    case "UPSTREAM_FAILED":
    case "UPSTREAM_FAILED_OR_SKIPPED":
      return <CircleAlert className="w-4 h-4 text-status-failed" />;
    case "SYSTEM_ERROR":
      return <CircleAlert className="w-4 h-4 text-status-system-error" />;
    case "INVALID":
      return <CircleAlert className="w-4 h-4 text-status-invalid" />;
    case "RUNNING":
    case "STARTING":
      return <RefreshCw className="w-4 h-4 text-status-running animate-spin" />;
    case "PENDING":
      return <RefreshCw className="w-4 h-4 text-status-pending animate-spin" />;
    case "QUEUED":
      return <RefreshCw className="w-4 h-4 text-status-queued animate-spin" />;
    case "CANCELLING":
      return (
        <CircleX className="w-4 h-4 text-status-cancelling animate-pulse" />
      );
    case "UNINITIALIZED":
      return <CircleEllipsis className="w-4 h-4 text-status-uninitialized" />;
    case "WAITING_FOR_UPSTREAM":
      return <CircleEllipsis className="w-4 h-4 text-status-waiting" />;
    case "SKIPPED":
      return <CircleMinus className="w-4 h-4 text-status-skipped" />;
    case "CANCELLED":
      return <CircleX className="w-4 h-4 text-status-cancelled" />;
    default:
      return <CircleHelp className="w-4 h-4 text-muted-foreground" />;
  }
};

export default StatusIcon;
