import { observer } from "mobx-react-lite";
import { useState } from "react";

import {
  createSystemDataArgument,
  getDynamicDataGroups,
  type TaskAnnotations,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/dynamicDataUtils";
import { SelectSecretDialog } from "@/components/shared/SecretsManagement/SelectSecretDialog";
import { createSecretArgument } from "@/components/shared/SecretsManagement/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { TypeSpecType } from "@/models/componentSpec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { DynamicDataArgument } from "@/utils/componentSpec";

import { DynamicDataSubmenu } from "./components/DynamicDataSubmenu";
import { QuickConnectSubmenu } from "./components/QuickConnectSubmenu";
import { getQuickConnectGroups } from "./thunderMenu.utils";

interface ThunderMenuProps {
  inputName: string;
  inputType?: TypeSpecType;
  canReset: boolean;
  canUnset: boolean;
  disabled?: boolean;
  excludeEntityIds: string[];
  taskAnnotations?: TaskAnnotations;
  onResetToDefault: () => void;
  onUnset: () => void;
  onSelectDynamicData: (value: DynamicDataArgument) => void;
  onQuickConnect: (sourceEntityId: string, sourcePortName: string) => void;
  onCreateInputAndConnect?: () => void;
}

export const ThunderMenu = observer(function ThunderMenu({
  inputType,
  canReset,
  canUnset,
  disabled = false,
  excludeEntityIds,
  taskAnnotations,
  onResetToDefault,
  onUnset,
  onSelectDynamicData,
  onQuickConnect,
  onCreateInputAndConnect,
}: ThunderMenuProps) {
  const spec = useSpec();
  const [isOpen, setIsOpen] = useState(false);
  const [isSecretDialogOpen, setIsSecretDialogOpen] = useState(false);

  const dynamicDataGroups = getDynamicDataGroups(true, taskAnnotations);
  const quickConnectGroups = getQuickConnectGroups(
    spec,
    inputType,
    excludeEntityIds,
  );

  const hasDynamicData = dynamicDataGroups.length > 0;
  const hasQuickConnect = quickConnectGroups.length > 0;

  const handleOpenSecretDialog = () => {
    setIsOpen(false);
    setIsSecretDialogOpen(true);
  };

  const handleSecretSelect = (secretName: string) => {
    setIsSecretDialogOpen(false);
    onSelectDynamicData(createSecretArgument(secretName));
  };

  const handleSelectSystemData = (key: string) => {
    onSelectDynamicData(createSystemDataArgument(key));
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            className={cn(
              "h-5 w-5 p-0 shrink-0",
              isOpen ? "visible" : "invisible group-hover:visible",
            )}
            data-testid="thunder-menu-trigger"
          >
            <Icon
              name="Zap"
              size="xs"
              className={isOpen ? "text-amber-500" : ""}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={4}
          className="w-56 z-[9999]"
        >
          <DropdownMenuItem disabled={!canReset} onClick={onResetToDefault}>
            <Icon name="RotateCcw" size="sm" />
            Reset to Default
          </DropdownMenuItem>

          <DropdownMenuItem disabled={!canUnset} onClick={onUnset}>
            <Icon name="Trash2" size="sm" />
            Unset Argument
          </DropdownMenuItem>

          {hasDynamicData && (
            <>
              <DropdownMenuSeparator />
              <DynamicDataSubmenu
                groups={dynamicDataGroups}
                onOpenSecretDialog={handleOpenSecretDialog}
                onSelectSystemData={handleSelectSystemData}
              />
            </>
          )}

          {hasQuickConnect && (
            <>
              <DropdownMenuSeparator />
              <QuickConnectSubmenu
                groups={quickConnectGroups}
                onQuickConnect={onQuickConnect}
              />
            </>
          )}

          {onCreateInputAndConnect && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCreateInputAndConnect}>
                <Icon name="Plus" size="sm" className="text-green-600" />
                Create Input
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SelectSecretDialog
        open={isSecretDialogOpen}
        onOpenChange={setIsSecretDialogOpen}
        onSelect={handleSecretSelect}
      />
    </>
  );
});
