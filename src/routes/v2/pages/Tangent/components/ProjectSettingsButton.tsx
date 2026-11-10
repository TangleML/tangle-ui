import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { tracking } from "@/utils/tracking";

import { LocalEnvStatus } from "./LocalEnvIndicator";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

/**
 * A folder cog, so it reads apart from the app-wide settings gear, led by a
 * plug while an editor is connected.
 */
export function ProjectSettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <InlineStack gap="1" wrap="nowrap">
      <LocalEnvStatus onOpen={() => setOpen(true)} />
      <TooltipButton
        tooltip="Project settings"
        tooltipSide="bottom"
        tooltipAlign="end"
        aria-label="Project settings"
        variant="subtle"
        size="icon-sm"
        onClick={() => setOpen(true)}
        {...tracking("projects.settings.open")}
      >
        <Icon name="FolderCog" size="sm" />
      </TooltipButton>
      <ProjectSettingsDialog open={open} onOpenChange={setOpen} />
    </InlineStack>
  );
}
