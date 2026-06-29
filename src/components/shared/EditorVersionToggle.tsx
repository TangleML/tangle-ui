import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import {
  EditorV2WelcomeSpotlight,
  hasSeenEditorV2Welcome,
  markEditorV2WelcomeSeen,
} from "@/components/shared/EditorV2WelcomeSpotlight";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { APP_ROUTES, EDITOR_PATH } from "@/routes/router";

import { useFlagValue } from "./Settings/useFlags";

type EditorVersion = "v1" | "v2";

const detectEditorVersion = (pathname: string): EditorVersion | null => {
  if (pathname.startsWith(`${APP_ROUTES.EDITOR_V2}/`)) return "v2";
  if (pathname.startsWith(`${EDITOR_PATH}/`)) return "v1";
  return null;
};

interface EditorVersionToggleProps {
  showWelcomeSpotlight?: boolean;
}

export const EditorVersionToggle = ({
  showWelcomeSpotlight = false,
}: EditorVersionToggleProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isEnabled = useFlagValue("v2_editor");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [welcomeSeen, setWelcomeSeen] = useState(hasSeenEditorV2Welcome);

  const dismissWelcome = useCallback(() => {
    markEditorV2WelcomeSeen();
    setWelcomeSeen(true);
  }, []);

  if (!isEnabled) return null;

  const version = detectEditorVersion(location.pathname);
  if (!version) return null;

  const lastSegment = location.pathname.split("/").pop() ?? "";
  const pipelineName = decodeURIComponent(lastSegment);
  if (!pipelineName) return null;

  const targetVersion = version === "v1" ? "v2" : "v1";
  const targetPath =
    targetVersion === "v2"
      ? `${APP_ROUTES.EDITOR_V2}/${encodeURIComponent(pipelineName)}`
      : `${EDITOR_PATH}/${encodeURIComponent(pipelineName)}`;
  const tooltip =
    targetVersion === "v2" ? "Switch to new editor" : "Switch to legacy editor";
  const showWelcome = showWelcomeSpotlight && version === "v2" && !welcomeSeen;

  return (
    <>
      <TooltipButton
        ref={toggleRef}
        tooltip={tooltip}
        className={cn(showWelcome && "relative z-[1001]")}
        onClick={() => {
          if (showWelcome) dismissWelcome();
          navigate({ to: targetPath });
        }}
        aria-label={tooltip}
      >
        <Icon name={targetVersion === "v2" ? "Zap" : "Snail"} />
      </TooltipButton>
      {showWelcome && (
        <EditorV2WelcomeSpotlight
          targetRef={toggleRef}
          onDismiss={dismissWelcome}
        />
      )}
    </>
  );
};
