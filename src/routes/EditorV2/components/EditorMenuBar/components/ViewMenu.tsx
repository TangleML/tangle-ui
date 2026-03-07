import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import { MenuTriggerButton } from "./MenuTriggerButton";

export function ViewMenu() {
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
