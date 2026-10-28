import { WorkspaceSelect } from "@/components/Project/WorkspaceSelect";
import { AiModelPicker } from "@/components/shared/Settings/AiModelPicker";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { STARTING_SESSION_REASONING_EFFORTS } from "@/services/projects/startingSession";
import type { WorkspaceChoice } from "@/services/projects/useWorkspaceChoice";
import { tracking } from "@/utils/tracking";

interface StartSessionToolbarProps {
  workspaceChoice: WorkspaceChoice;
  disabled: boolean;
  canStart: boolean;
  onStart: () => void;
}

export function StartSessionToolbar({
  workspaceChoice,
  disabled,
  canStart,
  onStart,
}: StartSessionToolbarProps) {
  return (
    <InlineStack gap="2" blockAlign="center" className="w-full pt-2">
      <AiModelPicker
        variant="compact"
        disabled={disabled}
        supportedReasoningEfforts={STARTING_SESSION_REASONING_EFFORTS}
      />

      <WorkspaceSelect
        choice={workspaceChoice}
        aria-label="Workspace"
        placeholder="Workspace"
        disabled={disabled}
        className="h-8 w-auto max-w-48 text-xs"
      />

      <div className="flex-1" />

      <Button
        size="icon"
        className="bg-brand-accent text-white hover:bg-brand-accent/90 disabled:opacity-40 dark:text-slate-950"
        aria-label="Start session"
        disabled={disabled || !canStart}
        onClick={onStart}
        {...tracking("projects.start_session_submit")}
      >
        <Icon name="ArrowUp" size="sm" />
      </Button>
    </InlineStack>
  );
}
