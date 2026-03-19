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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ComponentSpec,
  ComponentSpecJson,
  TypeSpecType,
} from "@/models/componentSpec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { DynamicDataArgument } from "@/utils/componentSpec";

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

function isTypeCompatible(
  sourceType: TypeSpecType | undefined,
  targetType: TypeSpecType | undefined,
): boolean {
  if (!sourceType || !targetType) return true;
  if (typeof sourceType === "string" && sourceType.toLowerCase() === "any")
    return true;
  if (typeof targetType === "string" && targetType.toLowerCase() === "any")
    return true;
  if (typeof sourceType === "string" && typeof targetType === "string") {
    return sourceType.toLowerCase() === targetType.toLowerCase();
  }
  return JSON.stringify(sourceType) === JSON.stringify(targetType);
}

interface QuickConnectPort {
  entityId: string;
  portName: string;
  portType?: TypeSpecType;
}

interface QuickConnectGroup {
  key: string;
  label: string;
  icon: "Download" | "Workflow";
  ports: QuickConnectPort[];
}

function getQuickConnectGroups(
  spec: ComponentSpec | null,
  inputType: TypeSpecType | undefined,
  excludeEntityIds: string[],
): QuickConnectGroup[] {
  if (!spec) return [];

  const excludeSet = new Set(excludeEntityIds);
  const groups: QuickConnectGroup[] = [];

  const compatibleInputs = spec.inputs.filter(
    (input) =>
      !excludeSet.has(input.$id) && isTypeCompatible(input.type, inputType),
  );
  if (compatibleInputs.length > 0) {
    groups.push({
      key: "__graph_inputs__",
      label: "Graph Inputs",
      icon: "Download",
      ports: compatibleInputs.map((input) => ({
        entityId: input.$id,
        portName: input.name,
        portType: input.type,
      })),
    });
  }

  for (const task of spec.tasks) {
    if (excludeSet.has(task.$id)) continue;

    const componentSpec = task.componentRef.spec as
      | ComponentSpecJson
      | undefined;
    const outputs = componentSpec?.outputs ?? [];

    const compatibleOutputs = outputs.filter((output) =>
      isTypeCompatible(output.type, inputType),
    );

    if (compatibleOutputs.length > 0) {
      groups.push({
        key: task.$id,
        label: task.name,
        icon: "Workflow",
        ports: compatibleOutputs.map((output) => ({
          entityId: task.$id,
          portName: output.name,
          portType: output.type,
        })),
      });
    }
  }

  return groups;
}

function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
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
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Icon name="Zap" size="sm" className="text-purple-600" />
                  Dynamic Data
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52 z-[9999]">
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
                        <DropdownMenuItem onClick={handleOpenSecretDialog}>
                          <Icon
                            name="Lock"
                            size="sm"
                            className="text-amber-600"
                          />
                          Select Secret...
                        </DropdownMenuItem>
                      ) : (
                        group.options.map((option) => (
                          <DropdownMenuItem
                            key={option.key}
                            onClick={() => handleSelectSystemData(option.key)}
                          >
                            <Icon
                              name={group.icon}
                              size="sm"
                              className="text-blue-600"
                            />
                            {option.title}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}

          {hasQuickConnect && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Icon name="Cable" size="sm" className="text-blue-600" />
                  Connect to...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto z-[9999]">
                  {quickConnectGroups.map((group, groupIndex) => (
                    <DropdownMenuGroup key={group.key}>
                      {groupIndex > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>
                        <InlineStack
                          gap="2"
                          blockAlign="center"
                          className="shrink-0"
                          wrap="nowrap"
                        >
                          <Icon
                            name={group.icon}
                            size="sm"
                            className="shrink-0"
                          />
                          <Text
                            size="xs"
                            weight="semibold"
                            className="truncate"
                          >
                            {group.label}
                          </Text>
                        </InlineStack>
                      </DropdownMenuLabel>
                      {group.ports.map((port) => {
                        const typeLabel = typeSpecToString(port.portType);
                        return (
                          <DropdownMenuItem
                            key={`${port.entityId}::${port.portName}`}
                            onClick={() =>
                              onQuickConnect(port.entityId, port.portName)
                            }
                          >
                            <Text size="xs" className="truncate flex-1">
                              {port.portName}
                            </Text>
                            {typeLabel && (
                              <Text
                                size="xs"
                                className="text-gray-400 shrink-0 ml-auto"
                              >
                                {typeLabel}
                              </Text>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
