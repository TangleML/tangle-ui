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
    const tooltipText = `${capitalizedLabel} ${status?.toLowerCase() ?? "unknown"}`;
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
      return <CircleCheck className="w-4 h-4 text-green-500" />;
    case "FAILED":
    case "SYSTEM_ERROR":
    case "INVALID":
    case "UPSTREAM_FAILED":
    case "UPSTREAM_FAILED_OR_SKIPPED":
      return <CircleAlert className="w-4 h-4 text-red-500" />;
    case "RUNNING":
    case "STARTING":
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    case "PENDING":
    case "QUEUED":
      return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
    case "CANCELLING":
      return <CircleX className="w-4 h-4 text-orange-500 animate-pulse" />;
    case "WAITING":
    case "UNINITIALIZED":
      return <CircleEllipsis className="w-4 h-4 text-yellow-500" />;
    case "WAITING_FOR_UPSTREAM":
      return <CircleEllipsis className="w-4 h-4 text-gray-500" />;
    case "SKIPPED":
      return <CircleMinus className="w-4 h-4 text-gray-500" />;
    case "CANCELLED":
      return <CircleX className="w-4 h-4 text-gray-800" />;
    default:
      return <CircleHelp className="w-4 h-4 text-orange-500" />;
  }
};

export default StatusIcon;
