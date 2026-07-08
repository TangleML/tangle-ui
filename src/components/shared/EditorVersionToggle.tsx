import { useLocation, useNavigate } from "@tanstack/react-router";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { APP_ROUTES, EDITOR_PATH } from "@/routes/appRoutes";

import { useFlagValue } from "./Settings/useFlags";

type EditorVersion = "v1" | "v2";

const ROUTE_BASE_PAIRS: { v1: string; v2: string; noun: string }[] = [
  { v1: EDITOR_PATH, v2: APP_ROUTES.EDITOR_V2, noun: "editor" },
  { v1: APP_ROUTES.RUNS, v2: APP_ROUTES.RUNS_V2, noun: "view" },
];

type ToggleTarget = {
  to: string;
  tooltip: string;
  targetVersion: EditorVersion;
};

const getToggleTarget = (pathname: string): ToggleTarget | null => {
  for (const { v1, v2, noun } of ROUTE_BASE_PAIRS) {
    if (pathname.startsWith(`${v2}/`)) {
      const rest = pathname.slice(v2.length + 1);
      if (!rest) return null;
      return {
        to: `${v1}/${rest}`,
        tooltip: `Switch to legacy ${noun}`,
        targetVersion: "v1",
      };
    }
    if (pathname.startsWith(`${v1}/`)) {
      const rest = pathname.slice(v1.length + 1);
      if (!rest) return null;
      return {
        to: `${v2}/${rest}`,
        tooltip: `Switch to new ${noun}`,
        targetVersion: "v2",
      };
    }
  }
  return null;
};

export const EditorVersionToggle = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isEnabled = useFlagValue("v2_editor");

  if (!isEnabled) return null;

  const target = getToggleTarget(location.pathname);
  if (!target) return null;

  return (
    <TooltipButton
      tooltip={target.tooltip}
      onClick={() => navigate({ to: target.to })}
      aria-label={target.tooltip}
    >
      <Icon name={target.targetVersion === "v2" ? "Sparkles" : "History"} />
    </TooltipButton>
  );
};
