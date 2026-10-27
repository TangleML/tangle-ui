import { cva } from "class-variance-authority";
import { observer } from "mobx-react-lite";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { useRunProjectContext } from "@/components/Project/useRunProjectContext";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { runAsFor } from "@/components/shared/SecretsManagement/runIdentity";
import { useRunIdentity } from "@/components/shared/SecretsManagement/useRunIdentity";
import TangleSubmitter from "@/components/shared/Submitters/Tangle/TangleSubmitter";
import { TeamName } from "@/components/shared/Teams/TeamName";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useQuickRunSubmitter } from "@/routes/v2/pages/Editor/components/QuickRunSubmitterContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { TeamResolution, TeamSummary } from "@/services/teams/types";
import { useTeamForSubmission } from "@/services/teams/useTeamForSubmission";
import { deepClone } from "@/utils/deepClone";
import { tracking } from "@/utils/tracking";

const quickRunIconVariants = cva("transition-colors", {
  variants: {
    variant: { menubar: "", mini: "" },
    hasErrors: { true: "", false: "" },
    onlyWarnings: { true: "", false: "" },
  },
  compoundVariants: [
    {
      hasErrors: false,
      onlyWarnings: false,
      className: "text-green-400 hover:text-green-300",
    },
    {
      hasErrors: false,
      onlyWarnings: true,
      className: "text-amber-400 hover:text-amber-300",
    },
    {
      hasErrors: true,
      className: "text-red-400 hover:text-red-300",
    },
  ],
  defaultVariants: {
    variant: "menubar",
    hasErrors: false,
    onlyWarnings: false,
  },
});

function unsettledReason(
  team: TeamResolution,
  isCheckingSecrets: boolean,
): string | undefined {
  if (team.status === "resolving") return "Checking this project's workspace";
  if (team.status === "conflict") {
    return "This run's projects belong to different workspaces";
  }
  if (isCheckingSecrets) return "Checking the run's secrets";
  return undefined;
}

function tooltipLabel(
  hasErrors: boolean,
  onlyWarnings: boolean,
  waitingFor: string | undefined,
) {
  if (hasErrors) return "Pipeline has validation errors";
  if (waitingFor) return waitingFor;
  if (onlyWarnings) return "Pipeline has validation warnings";
  return "Submit Run";
}

function submitAsTeamTooltip(team: TeamSummary): ReactNode {
  return (
    <>
      {"Submit run as "}
      <TeamName team={team} />
    </>
  );
}

interface QuickRunButtonProps {
  variant?: "menubar" | "mini";
  renderSubmitter?: boolean;
  trackingKey?: string;
}

export const QuickRunButton = observer(function QuickRunButton({
  variant = "menubar",
  renderSubmitter = true,
  trackingKey = "v2.pipeline_editor.quick_run",
  ...tooltipButtonProps
}: QuickRunButtonProps &
  Omit<ComponentProps<typeof TooltipButton>, "tooltip" | "variant" | "size">) {
  const { navigation } = useSharedStores();
  const { isAuthorized } = useAwaitAuthorization();
  const { registerSubmitter, submitRun, submitWithArguments } =
    useQuickRunSubmitter();
  const { projectIds } = useRunProjectContext();
  const pageTeam = useTeamForSubmission(projectIds);
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;
  const onlyWarnings = allIssues.length > 0 && errorCount === 0;
  const hasConfigurableInputs = (rootSpec?.inputs?.length ?? 0) > 0;

  let serializedPipelineSpec:
    ReturnType<typeof serializeComponentSpec> | undefined;
  try {
    serializedPipelineSpec = rootSpec
      ? deepClone(serializeComponentSpec(rootSpec))
      : undefined;
  } catch {
    serializedPipelineSpec = undefined;
  }

  const pageIdentity = useRunIdentity(pageTeam, [serializedPipelineSpec]);
  const actingTeam =
    runAsFor(pageIdentity) === "team" && !hasErrors
      ? pageIdentity.team
      : undefined;
  const waitingFor = unsettledReason(pageTeam, pageIdentity.isChecking);
  const statusLabel = tooltipLabel(hasErrors, onlyWarnings, waitingFor);
  const announcedTeam = onlyWarnings ? undefined : actingTeam;
  const tooltip = announcedTeam
    ? submitAsTeamTooltip(announcedTeam)
    : statusLabel;
  const ariaLabel = announcedTeam
    ? `Submit run as the ${announcedTeam.label} workspace`
    : statusLabel;
  const isMini = variant === "mini";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isMini) event.stopPropagation();
    submitRun();
  };

  const handleSubmitWithArgumentsClick = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    submitWithArguments();
  };

  const showMiniArgumentsButton = isMini && hasConfigurableInputs && !hasErrors;

  return (
    <>
      {!showMiniArgumentsButton && (
        <TooltipButton
          {...tooltipButtonProps}
          tooltip={tooltip}
          variant={isMini ? "outline" : "header"}
          size={isMini ? "icon" : undefined}
          className={cn("relative", isMini && "size-8 shrink-0 rounded-md")}
          aria-label={isMini ? ariaLabel : undefined}
          disabled={hasErrors || waitingFor !== undefined}
          onClick={handleClick}
          {...tracking(trackingKey)}
        >
          <Icon
            name="Play"
            size={isMini ? "sm" : undefined}
            className={quickRunIconVariants({
              variant,
              hasErrors,
              onlyWarnings,
            })}
          />
          {actingTeam && (
            <Icon
              name="Shapes"
              size="xs"
              aria-hidden="true"
              data-testid="quick-run-team-badge"
              className={cn(
                "absolute",
                isMini ? "right-0.5 bottom-0.5" : "right-1 bottom-1",
              )}
            />
          )}
        </TooltipButton>
      )}
      {showMiniArgumentsButton && (
        <TooltipButton
          {...tooltipButtonProps}
          tooltip="Submit run with arguments"
          variant="outline"
          size="icon"
          className="relative size-8 shrink-0 rounded-md"
          aria-label="Submit run with arguments"
          onClick={handleSubmitWithArgumentsClick}
          {...tracking(`${trackingKey}_with_arguments`)}
        >
          <Icon name="Split" size="sm" className="rotate-90" />
        </TooltipButton>
      )}
      {renderSubmitter && serializedPipelineSpec && isAuthorized && (
        <div ref={registerSubmitter} className="sr-only">
          <TangleSubmitter
            componentSpec={serializedPipelineSpec}
            isComponentTreeValid={rootSpec?.isValid}
            onlyFixableIssues={!hasErrors && allIssues.length > 0}
          />
        </div>
      )}
    </>
  );
});
