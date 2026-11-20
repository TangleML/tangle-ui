import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

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
  children?: ReactNode;
  onDelete: () => void;
  onRename?: () => void;
  disabled?: boolean;
  triggerClassName?: string;
  inListRow?: boolean;
  triggerTrackingId: string;
}

/**
 * Project actions shared by the card and the Tangent sidebar. Each surface can
 * place its own action before the shared items.
 */
export function ProjectMenu({
  project,
  children,
  onDelete,
  onRename,
  disabled,
  triggerClassName,
  inListRow = false,
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
          variant={inListRow ? "subtle" : "ghost"}
          size={inListRow ? "icon-xs" : "icon"}
          className={triggerClassName}
          disabled={disabled}
          aria-label={`Project actions: ${project.name}`}
          {...tracking(triggerTrackingId)}
        >
          <Icon name="EllipsisVertical" size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {children}
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
