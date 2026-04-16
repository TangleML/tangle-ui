import { useNavigate } from "@tanstack/react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";

export function RunMenu() {
  const navigate = useNavigate();
  const actions = useRunViewActions();

  if (!actions.ready) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton disabled>Run</MenuTriggerButton>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );
  }

  const {
    canAccessEditorSpec,
    isRunCreator,
    isInProgress,
    isComplete,
    pipelineName,
  } = actions;

  const handleInspect = () => {
    if (pipelineName) {
      navigate({ to: `/editor/${encodeURIComponent(pipelineName)}` });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Run</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        {canAccessEditorSpec && pipelineName && (
          <DropdownMenuItem onSelect={handleInspect}>
            <Icon name="ExternalLink" size="sm" />
            Inspect Pipeline
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {isInProgress && isRunCreator && (
          <DropdownMenuItem className="text-destructive" disabled>
            <Icon name="CircleX" size="sm" />
            Cancel Run
          </DropdownMenuItem>
        )}

        {isComplete && (
          <DropdownMenuItem disabled>
            <Icon name="RefreshCcw" size="sm" />
            Rerun Pipeline
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
