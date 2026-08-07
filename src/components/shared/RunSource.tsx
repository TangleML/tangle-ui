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
  message: string;
}

const SOURCE_BUCKETS: Record<RunSourceBucket, SourceConfig> = {
  "web-app": {
    icon: "AppWindow",
    label: "Web app",
    tooltip: "Submitted via Tangle web app",
    message: "Generated via Tangle UI",
  },
  programmatic: {
    icon: "Bot",
    label: "Programmatic",
    tooltip: "Submitted by AI or via CLI",
    message: "Submitted via AI or CLI",
  },
  unknown: {
    icon: "CircleQuestionMark",
    label: "Unknown",
    tooltip: "Source unknown",
    message: "Source unknown",
  },
};

export const getRunSourceBucket = (source?: string | null): RunSourceBucket => {
  if (!source) return "unknown";
  if (source === "web-app") return "web-app";
  return "programmatic";
};

const getRunSourceConfig = (source?: string | null): SourceConfig =>
  SOURCE_BUCKETS[getRunSourceBucket(source)];

/** Human-readable message describing how a run was submitted. */
export const getRunSourceMessage = (source?: string | null): string =>
  getRunSourceConfig(source).message;

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
