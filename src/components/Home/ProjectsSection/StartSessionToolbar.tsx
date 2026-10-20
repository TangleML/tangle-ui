import type { ThinkingLevel } from "@tangent/shared/contracts.ts";
import {
  AVAILABLE_MODELS,
  THINKING_LEVELS,
} from "@tangent/shared/contracts.ts";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tracking } from "@/utils/tracking";

import type { WorkspaceChoice } from "./useWorkspaceChoice";

const THINKING_LABELS: Partial<Record<ThinkingLevel, string>> = {
  xhigh: "Extra high",
};

const thinkingLabel = (level: ThinkingLevel) =>
  THINKING_LABELS[level] ?? level.charAt(0).toUpperCase() + level.slice(1);

interface StartSessionToolbarProps {
  model: string;
  onModelChange: (model: string) => void;
  thinkingDepth: ThinkingLevel;
  onThinkingDepthChange: (level: ThinkingLevel) => void;
  workspaceChoice: WorkspaceChoice;
  disabled: boolean;
  canStart: boolean;
  onStart: () => void;
}

export function StartSessionToolbar({
  model,
  onModelChange,
  thinkingDepth,
  onThinkingDepthChange,
  workspaceChoice,
  disabled,
  canStart,
  onStart,
}: StartSessionToolbarProps) {
  return (
    <InlineStack gap="2" blockAlign="center" className="w-full pt-2">
      <Select value={model} onValueChange={onModelChange} disabled={disabled}>
        <SelectTrigger aria-label="Model" className="h-8 w-auto text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_MODELS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={thinkingDepth}
        onValueChange={(value) => {
          const level = THINKING_LEVELS.find(
            (candidate) => candidate === value,
          );
          if (level) onThinkingDepthChange(level);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Thinking" className="h-8 w-auto text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THINKING_LEVELS.map((level) => (
            <SelectItem key={level} value={level}>
              {thinkingLabel(level)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {workspaceChoice.offersChoice && (
        <Select
          value={workspaceChoice.selected?.id ?? ""}
          onValueChange={workspaceChoice.choose}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label="Workspace"
            className="h-8 w-auto max-w-48 text-xs"
          >
            <SelectValue placeholder="Workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaceChoice.workspaces.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
