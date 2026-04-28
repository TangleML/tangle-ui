import { useLocation, useNavigate } from "@tanstack/react-router";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { APP_ROUTES, EDITOR_PATH } from "@/routes/router";

const isEnabled = import.meta.env.VITE_ENABLE_V2_EDITOR_TOGGLE === "true";

type EditorVersion = "v1" | "v2";

const detectEditorVersion = (pathname: string): EditorVersion | null => {
  if (pathname.startsWith(`${APP_ROUTES.EDITOR_V2}/`)) return "v2";
  if (pathname.startsWith(`${EDITOR_PATH}/`)) return "v1";
  return null;
};

export const EditorVersionToggle = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <TooltipButton
      tooltip={tooltip}
      onClick={() => navigate({ to: targetPath })}
      aria-label={tooltip}
    >
      <Icon name={targetVersion === "v2" ? "Sparkles" : "History"} />
    </TooltipButton>
  );
};
