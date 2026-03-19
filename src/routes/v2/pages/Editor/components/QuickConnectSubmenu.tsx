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
import { Text } from "@/components/ui/typography";

import { type QuickConnectGroup, typeSpecToString } from "./thunderMenu.utils";

interface QuickConnectSubmenuProps {
  groups: QuickConnectGroup[];
  onQuickConnect: (sourceEntityId: string, sourcePortName: string) => void;
}

export function QuickConnectSubmenu({
  groups,
  onQuickConnect,
}: QuickConnectSubmenuProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon name="Cable" size="sm" className="text-blue-600" />
        Connect to...
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto z-[9999]">
        {groups.map((group, groupIndex) => (
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
  );
}
