import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { WelcomeSpotlight } from "@/components/shared/WelcomeSpotlight";
import { Icon } from "@/components/ui/icon";
import { ExistingFlags } from "@/flags";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

type Version = "v1" | "v2";

interface VersionToggleWelcome {
  hasSeen: () => boolean;
  markSeen: () => void;
  title: string;
  description: string;
  titleId: string;
  dismissLabel: string;
}

interface VersionToggleProps {
  flagName: keyof typeof ExistingFlags;
  targetVersion: Version;
  targetPath: string;
  tooltip: string;
  welcome: VersionToggleWelcome;
  showWelcomeSpotlight?: boolean;
  trackingId?: string;
}

export function VersionToggle({
  flagName,
  targetVersion,
  targetPath,
  tooltip,
  welcome,
  showWelcomeSpotlight = false,
  trackingId,
}: VersionToggleProps) {
  const navigate = useNavigate();
  const isEnabled = useFlagValue(flagName);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [welcomeSeen, setWelcomeSeen] = useState(welcome.hasSeen);

  const dismissWelcome = () => {
    welcome.markSeen();
    setWelcomeSeen(true);
  };

  if (!isEnabled) return null;

  const showWelcome = showWelcomeSpotlight && !welcomeSeen;

  return (
    <>
      <TooltipButton
        ref={toggleRef}
        tooltip={tooltip}
        className={cn(showWelcome && "relative z-1001")}
        onClick={() => {
          if (showWelcome) dismissWelcome();
          navigate({ to: targetPath });
        }}
        variant="headerOutline"
        size="icon"
        aria-label={tooltip}
        {...(trackingId
          ? tracking(trackingId, { target_version: targetVersion })
          : {})}
      >
        <Icon name={targetVersion === "v2" ? "Zap" : "Snail"} />
      </TooltipButton>
      {showWelcome && (
        <WelcomeSpotlight
          targetRef={toggleRef}
          onDismiss={dismissWelcome}
          title={welcome.title}
          description={welcome.description}
          titleId={welcome.titleId}
          dismissLabel={welcome.dismissLabel}
        />
      )}
    </>
  );
}
