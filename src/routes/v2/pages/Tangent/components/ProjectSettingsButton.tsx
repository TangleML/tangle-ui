import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { tracking } from "@/utils/tracking";

import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

/** A folder cog, so it reads apart from the app-wide settings gear. */
export function ProjectSettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipButton
        tooltip="Project settings"
        tooltipSide="bottom"
        tooltipAlign="end"
        aria-label="Project settings"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        {...tracking("projects.settings.open")}
      >
        <Icon name="FolderCog" size="sm" />
      </TooltipButton>
      <ProjectSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
