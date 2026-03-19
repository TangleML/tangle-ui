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
import { InlineStack } from "@/components/ui/layout";

type DynamicDataGroup = ReturnType<typeof getDynamicDataGroups>[number];

interface DynamicDataSubmenuProps {
  groups: DynamicDataGroup[];
  onOpenSecretDialog: () => void;
  onSelectSystemData: (key: string) => void;
}

export function DynamicDataSubmenu({
  groups,
  onOpenSecretDialog,
  onSelectSystemData,
}: DynamicDataSubmenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon name="Zap" size="sm" className="text-purple-600" />
        Dynamic Data
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52 z-[9999]">
        {groups.map((group, index) => (
          <DropdownMenuGroup key={group.id}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>
              <InlineStack gap="2" blockAlign="center">
                <Icon name={group.icon} size="sm" />
                {group.title}
              </InlineStack>
            </DropdownMenuLabel>
            {group.requiresDialog ? (
              <DropdownMenuItem onClick={onOpenSecretDialog}>
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
                  onClick={() => onSelectSystemData(option.key)}
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
  );
}
