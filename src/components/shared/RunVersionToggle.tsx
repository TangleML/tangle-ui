import { useLocation, useParams } from "@tanstack/react-router";

import { VersionToggle } from "@/components/shared/VersionToggle";
import {
  hasSeenRunV2Welcome,
  markRunV2WelcomeSeen,
} from "@/components/shared/WelcomeSpotlight";
import { APP_ROUTES } from "@/routes/appRoutes";
import { getRunPath, type RunViewVersion } from "@/routes/runRoutes";

function detectRunViewVersion(pathname: string): RunViewVersion | null {
  if (pathname.startsWith(`${APP_ROUTES.RUNS_V2}/`)) return "v2";
  if (pathname.startsWith(`${APP_ROUTES.RUNS}/`)) return "v1";
  return null;
}

interface RunVersionToggleProps {
  showWelcomeSpotlight?: boolean;
}

export function RunVersionToggle({
  showWelcomeSpotlight = false,
}: RunVersionToggleProps) {
  const location = useLocation();
  const params = useParams({ strict: false });
  const version = detectRunViewVersion(location.pathname);
  const runId =
    "id" in params && typeof params.id === "string" ? params.id : undefined;
  if (!version || !runId) return null;

  const subgraphExecutionId =
    "subgraphExecutionId" in params &&
    typeof params.subgraphExecutionId === "string"
      ? params.subgraphExecutionId
      : undefined;
  const targetVersion = version === "v1" ? "v2" : "v1";
  const label = `Switch to ${targetVersion.toUpperCase()} run view`;

  return (
    <VersionToggle
      flagName="v2_editor"
      targetVersion={targetVersion}
      targetPath={getRunPath(runId, targetVersion, subgraphExecutionId)}
      tooltip={label}
      showWelcomeSpotlight={showWelcomeSpotlight && version === "v2"}
      trackingId="run_view.version_toggle"
      welcome={{
        hasSeen: hasSeenRunV2Welcome,
        markSeen: markRunV2WelcomeSeen,
        title: "Welcome to the new run view",
        description:
          "You can easily switch between the new and old run views here.",
        titleId: "run-v2-welcome-title",
        dismissLabel: "Dismiss new run view welcome",
      }}
    />
  );
}
