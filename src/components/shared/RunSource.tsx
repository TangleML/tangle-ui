import { Icon, type IconName } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type RunSourceBucket = "web-app" | "programmatic" | "unknown";

interface SourceConfig {
  icon: IconName;
  label: string;
  tooltip: string;
}

const SOURCE_BUCKETS: Record<RunSourceBucket, SourceConfig> = {
  "web-app": {
    icon: "AppWindow",
    label: "Web app",
    tooltip: "Submitted via Tangle web app",
  },
  programmatic: {
    icon: "Bot",
    label: "Programmatic",
    tooltip: "Submitted by AI or via CLI",
  },
  unknown: {
    icon: "CircleQuestionMark",
    label: "Unknown",
    tooltip: "Source unknown",
  },
};

const getRunSourceBucket = (source?: string | null): RunSourceBucket => {
  if (!source) return "unknown";
  if (source === "web-app") return "web-app";
  return "programmatic";
};

const getRunSourceConfig = (source?: string | null): SourceConfig =>
  SOURCE_BUCKETS[getRunSourceBucket(source)];

interface RunSourceIconProps {
  source?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export const RunSourceIcon = ({
  source,
  size = "sm",
  className,
}: RunSourceIconProps) => {
  const { icon, tooltip } = getRunSourceConfig(source);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <Icon name={icon} size={size} className="text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span>{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  );
};
