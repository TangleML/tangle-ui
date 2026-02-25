import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import { getDynamicDataGroups, type TaskAnnotations } from "./dynamicDataUtils";

interface DynamicDataDropdownProps {
  disabled: boolean;
  isTaskLevel: boolean;
  taskAnnotations?: TaskAnnotations;
  triggerClassName?: string;
  onOpenSecretDialog: () => void;
  onSelectSystemData: (key: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export const DynamicDataDropdown = ({
  disabled,
  isTaskLevel,
  taskAnnotations,
  triggerClassName,
  onOpenSecretDialog,
  onSelectSystemData,
  onOpenChange,
}: DynamicDataDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const dynamicDataGroups = getDynamicDataGroups(isTaskLevel, taskAnnotations);

  const isSecretsOnly =
    dynamicDataGroups.length === 1 && dynamicDataGroups[0].requiresDialog;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const handleSecretDialogOpen = () => {
    setIsOpen(false);
    onOpenChange?.(false);
    onOpenSecretDialog();
  };

  if (isSecretsOnly) {
    return (
      <Button
        className={triggerClassName}
        disabled={disabled}
        variant="ghost"
        size="xs"
        title="Use Dynamic Data"
        data-testid="open-secret-dialog-button"
        onClick={handleSecretDialogOpen}
      >
        <Icon name="Lock" />
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(triggerClassName, isOpen && "flex")}
          disabled={disabled}
          variant="ghost"
          size="xs"
          title="Use Dynamic Data"
          data-testid="dynamic-data-dropdown-trigger"
        >
          <Icon name="Zap" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-56 z-[9999] data-[state=closed]:!hidden"
      >
        {dynamicDataGroups.map((group, index) => (
          <DropdownMenuGroup key={group.id}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>
              <InlineStack gap="2" blockAlign="center">
                <Icon name={group.icon} size="sm" />
                {group.title}
              </InlineStack>
            </DropdownMenuLabel>
            {group.requiresDialog ? (
              <DropdownMenuItem onClick={handleSecretDialogOpen}>
                <Icon name="Lock" size="sm" className="text-amber-600" />
                Select Secret...
              </DropdownMenuItem>
            ) : (
              group.options.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onClick={() => onSelectSystemData(option.key)}
                >
                  <Icon name={group.icon} size="sm" className="text-blue-600" />
                  {option.title}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
