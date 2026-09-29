import { Icon, type IconName } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TANGENT_AGENT_RUN_SOURCE,
  TANGENT_UI_RUN_SOURCE,
  TANGLE_CLI_RUN_SOURCE,
  WEB_APP_RUN_SOURCE,
} from "@/utils/annotationKeys";

interface SourceConfig {
  icon: IconName;
  message: string;
}

/**
 * Most of these are submitted by something other than this app, so the map is
 * a reader's vocabulary rather than a writer's: a submitter is free to send a
 * source nobody here has heard of, and gets `UNRECOGNIZED` rather than an
 * error.
 */
const RUN_SOURCES: Record<string, SourceConfig> = {
  [WEB_APP_RUN_SOURCE]: {
    icon: "AppWindow",
    message: "Submitted via the Tangle web app",
  },
  [TANGENT_UI_RUN_SOURCE]: {
    icon: "Bot",
    message: "Submitted by an agent in the Tangle web app",
  },
  [TANGLE_CLI_RUN_SOURCE]: {
    icon: "Terminal",
    message: "Submitted via the Tangle CLI",
  },
  [TANGENT_AGENT_RUN_SOURCE]: {
    icon: "Sparkles",
    message: "Submitted by a Tangent agent",
  },
};

const UNRECOGNIZED: SourceConfig = {
  icon: "Earth",
  message: "Submitted by other means",
};

const ABSENT: SourceConfig = {
  icon: "CircleQuestionMark",
  message: "Source unknown",
};

const getRunSourceConfig = (source?: string | null): SourceConfig => {
  if (!source) return ABSENT;
  return RUN_SOURCES[source] ?? UNRECOGNIZED;
};

/** Whether the run says where it came from at all. */
export const hasRunSource = (source?: string | null): boolean =>
  Boolean(source);

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
  const { icon, message } = getRunSourceConfig(source);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <Icon name={icon} size={size} className="text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span>{message}</span>
      </TooltipContent>
    </Tooltip>
  );
};
