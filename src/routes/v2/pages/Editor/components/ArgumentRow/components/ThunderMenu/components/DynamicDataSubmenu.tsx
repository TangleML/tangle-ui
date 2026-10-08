import type { getDynamicDataGroups } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/dynamicDataUtils";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

type DynamicDataGroup = ReturnType<typeof getDynamicDataGroups>[number];

interface DynamicDataSubmenuProps {
  groups: DynamicDataGroup[];
  secretsOwner?: string;
  onOpenSecretDialog: () => void;
  onSelectSystemData: (key: string) => void;
}

export function DynamicDataSubmenu({
  groups,
  secretsOwner,
  onOpenSecretDialog,
  onSelectSystemData,
}: DynamicDataSubmenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon name="Zap" size="sm" className="text-purple-600" />
        Dynamic Data
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-52 z-[9999]"
        data-tour="thunder-menu-submenu-content"
      >
        {groups.map((group, index) => (
          <DropdownMenuGroup key={group.id}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>
              <InlineStack gap="2" blockAlign="center">
                <Icon name={group.icon} size="sm" />
                {group.title}
              </InlineStack>
            </DropdownMenuLabel>
            {group.requiresDialog && secretsOwner ? (
              <BlockStack gap="1" className="px-2 py-1.5">
                <InlineStack gap="2" blockAlign="center">
                  <Icon name="Lock" size="sm" className="text-info" />
                  <Text size="sm" tone="subdued">
                    Select Secret...
                  </Text>
                </InlineStack>
                <Text size="xs" tone="subdued">
                  Ask {secretsOwner} to add secrets.
                </Text>
              </BlockStack>
            ) : group.requiresDialog ? (
              <DropdownMenuItem
                {...tracking(
                  "v2.pipeline_editor.task_arguments.thunder_menu.dynamic_data.secret_dialog_open",
                )}
                onClick={onOpenSecretDialog}
              >
                <Icon name="Lock" size="sm" className="text-amber-600" />
                Select Secret...
              </DropdownMenuItem>
            ) : (
              group.options.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  {...tracking(
                    "v2.pipeline_editor.task_arguments.thunder_menu.dynamic_data.system_option",
                  )}
                  onClick={() => onSelectSystemData(option.key)}
                >
                  <Icon name={group.icon} size="sm" className="text-blue-600" />
                  {option.title}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
