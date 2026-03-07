import { useSnapshot } from "valtio";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import { focusModeStore, toggleFocusMode } from "../../../hooks/useFocusMode";
import { formatShortcut } from "../../../shortcuts/shortcutUtils";
import { MenuTriggerButton } from "./MenuTriggerButton";

const FOCUS_MODE_SHORTCUT = formatShortcut({ mod: true, key: "/" });

export function ViewMenu() {
  const { active: focusModeActive } = useSnapshot(focusModeStore);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>View</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuItem disabled>
          <Icon name="LayoutDashboard" size="sm" />
          Auto-layout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={focusModeActive}
          onCheckedChange={() => toggleFocusMode()}
        >
          Focus mode
          <DropdownMenuShortcut>{FOCUS_MODE_SHORTCUT}</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
