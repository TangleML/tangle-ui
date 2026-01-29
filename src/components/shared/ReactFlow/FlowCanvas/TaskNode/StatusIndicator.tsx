import {
  CheckCircleIcon,
  CircleDashedIcon,
  ClockIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { QuickTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  EXECUTION_STATUS_BG_COLORS,
  getExecutionStatusLabel,
} from "@/utils/executionStatus";

type StatusIndicatorProps = {
  status: string;
  disabledCache?: boolean;
};

export const StatusIndicator = ({
  status,
  disabledCache = false,
}: StatusIndicatorProps) => {
  const { style, text, icon } = getStatusMetadata(status);

  return (
    <div className="absolute -z-1 -top-5 left-0 flex items-start">
      <div
        className={cn("h-8.75 rounded-t-md px-2.5 py-1 text-[10px]", style, {
          "rounded-tr-none": disabledCache,
        })}
      >
        <div className="flex items-center gap-1 font-mono text-white">
          {icon}
          {text}
        </div>
      </div>
      {disabledCache && (
        <div className="h-5.5 bg-orange-400 rounded-tr-md flex items-center px-1.5">
          <QuickTooltip content="Cache Disabled" className="whitespace-nowrap">
            <Icon name="ZapOff" size="xs" className="text-white" />
          </QuickTooltip>
        </div>
      )}
    </div>
  );
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "SUCCEEDED":
      return <CheckCircleIcon className="w-2 h-2" />;
    case "FAILED":
    case "SYSTEM_ERROR":
    case "INVALID":
      return <XCircleIcon className="w-2 h-2" />;
    case "RUNNING":
      return <Loader2Icon className="w-2 h-2 animate-spin" />;
    case "PENDING":
    case "QUEUED":
    case "UNINITIALIZED":
    case "WAITING_FOR_UPSTREAM":
      return <ClockIcon className="w-2 h-2 animate-spin duration-2000" />;
    case "CANCELLING":
    case "CANCELLED":
    case "SKIPPED":
      return <XCircleIcon className="w-2 h-2" />;
    default:
      return <CircleDashedIcon className="w-2 h-2" />;
  }
};

const getStatusMetadata = (status: string) => {
  return {
    style: EXECUTION_STATUS_BG_COLORS[status] ?? "bg-slate-300",
    text: getExecutionStatusLabel(status),
    icon: getStatusIcon(status),
  };
};
