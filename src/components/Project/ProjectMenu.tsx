import { useNavigate } from "@tanstack/react-router";

import { useProjectPin } from "@/components/Project/useProjectPin";
import { useShareProjectAction } from "@/components/Project/useShareProjectAction";
import { useTangentEnabled } from "@/components/shared/Settings/useFlags";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

interface ProjectMenuProps {
  project: ProjectSummary;
  onDelete: () => void;
  onRename?: () => void;
  disabled?: boolean;
  triggerClassName?: string;
  // A small, quiet trigger, for a menu among a list row's actions.
  compact?: boolean;
  triggerTrackingId: string;
}

/**
 * A project's "⋮" menu, shared by its card and the Tangent sidebar so both
 * offer the same things. Deleting is the caller's, which owns the confirmation
 * and whatever it dims while the delete runs.
 */
export function ProjectMenu({
  project,
  onDelete,
  onRename,
  disabled,
  triggerClassName,
  compact = false,
  triggerTrackingId,
}: ProjectMenuProps) {
  const navigate = useNavigate();
  const share = useShareProjectAction(project.id);
  const { pinned, isPinning, togglePin } = useProjectPin(project);
  const tangentEnabled = useTangentEnabled();

  const openDetails = () => {
    void navigate({
      to: APP_ROUTES.PROJECT_DETAIL,
      params: { projectId: project.id },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? "subtle" : "ghost"}
          size={compact ? "icon-xs" : "icon"}
          className={triggerClassName}
          disabled={disabled}
          aria-label={`Project actions: ${project.name}`}
          {...tracking(triggerTrackingId)}
        >
          <Icon name="EllipsisVertical" size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isPinning}
          onSelect={() => void togglePin()}
          {...tracking("projects.pin_project", { new_value: !pinned })}
        >
          <Icon name={pinned ? "PinOff" : "Pin"} size="sm" />
          {pinned ? "Unpin project" : "Pin project"}
        </DropdownMenuItem>
        {onRename && (
          <DropdownMenuItem
            onSelect={onRename}
            {...tracking("projects.rename_project_open")}
          >
            <Icon name="Pencil" size="sm" />
            Rename project
          </DropdownMenuItem>
        )}
        {tangentEnabled && (
          <DropdownMenuItem
            onSelect={openDetails}
            {...tracking("projects.open_project_details")}
          >
            <Icon name="Info" size="sm" />
            Details
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={share}
          {...tracking("projects.share_project")}
        >
          <Icon name="Share2" size="sm" />
          Share project
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onSelect={onDelete}
          {...tracking("projects.delete_project_open")}
        >
          <Icon name="Trash" size="sm" />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
