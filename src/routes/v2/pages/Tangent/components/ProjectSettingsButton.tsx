import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { tracking } from "@/utils/tracking";

import { LocalEnvStatus, useLocalEnv } from "./LocalEnvIndicator";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

/**
 * A folder cog, so it reads apart from the app-wide settings gear, led by a
 * plug while an editor is connected.
 */
export function ProjectSettingsButton() {
  const [open, setOpen] = useState(false);
  const { projectId } = useTangentProject();
  const localEnv = useLocalEnv(projectId);

  return (
    <InlineStack gap="1" wrap="nowrap">
      <LocalEnvStatus onOpen={() => setOpen(true)} localEnv={localEnv} />
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
      <ProjectSettingsDialog
        open={open}
        onOpenChange={setOpen}
        localEnv={localEnv}
      />
    </InlineStack>
  );
}
