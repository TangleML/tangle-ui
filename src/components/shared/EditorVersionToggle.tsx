import { useLocation } from "@tanstack/react-router";

import { VersionToggle } from "@/components/shared/VersionToggle";
import {
  hasSeenEditorV2Welcome,
  markEditorV2WelcomeSeen,
} from "@/components/shared/WelcomeSpotlight";
import { APP_ROUTES, EDITOR_PATH } from "@/routes/router";

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

  return (
    <VersionToggle
      flagName="v2_editor"
      targetVersion={targetVersion}
      targetPath={targetPath}
      tooltip={tooltip}
      showWelcomeSpotlight={showWelcomeSpotlight && version === "v2"}
      welcome={{
        hasSeen: hasSeenEditorV2Welcome,
        markSeen: markEditorV2WelcomeSeen,
        title: "Welcome to the new editor",
        description:
          "You can easily switch between the new and old editor here.",
        titleId: "editor-v2-welcome-title",
        dismissLabel: "Dismiss new editor welcome",
      }}
    />
  );
};
