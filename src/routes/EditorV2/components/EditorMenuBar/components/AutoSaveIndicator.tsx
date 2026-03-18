import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { autoSaveStore } from "@/routes/EditorV2/store/autoSaveStore";

function getTooltipText(isSaving: boolean, lastSavedAt: Date | null): string {
  if (isSaving) return "Saving...";
  if (lastSavedAt) {
    return `Last saved at ${lastSavedAt.toLocaleTimeString()}`;
  }
  return "Auto-save enabled";
}

export const AutoSaveIndicator = observer(function AutoSaveIndicator() {
  const { isSaving, lastSavedAt, showSavedMessage } = autoSaveStore;
  const tooltipText = getTooltipText(isSaving, lastSavedAt);

  return (
    <InlineStack gap="1" blockAlign="center" wrap="nowrap">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-fit">
            <Button
              variant="ghost"
              size="icon"
              disabled={isSaving}
              data-testid="auto-save-button"
            >
              {isSaving ? (
                <Spinner size={16} className="text-stone-400" />
              ) : (
                <Icon name="CloudCheck" size="sm" className="text-stone-400" />
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipText}</TooltipContent>
      </Tooltip>
      <Text
        as="span"
        size="xs"
        className={cn(
          "text-gray-400 whitespace-nowrap transition-[opacity,display] duration-400 [transition-behavior:allow-discrete]",
          showSavedMessage ? "starting:opacity-0" : "hidden opacity-0",
        )}
        data-testid="auto-save-message"
      >
        All changes saved
      </Text>
    </InlineStack>
  );
});
