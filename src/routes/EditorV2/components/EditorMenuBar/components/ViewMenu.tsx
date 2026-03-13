import { observer } from "mobx-react-lite";

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
import { ShorcutBadge } from "../../ShorcutBadge";
import { MenuTriggerButton } from "./MenuTriggerButton";

export const ViewMenu = observer(function ViewMenu() {
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
          checked={focusModeStore.active}
          onCheckedChange={() => toggleFocusMode()}
        >
          Focus mode
          <DropdownMenuShortcut>
            <ShorcutBadge id="focus-mode" />
          </DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
