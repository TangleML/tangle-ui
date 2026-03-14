import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import { restoreWindow } from "../../../windows/windows.actions";
import { MenuTriggerButton } from "./MenuTriggerButton";

export function ComponentsLibraryMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Components</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuItem onClick={() => restoreWindow("component-library")}>
          <Icon name="Library" size="sm" />
          Explore library
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => restoreWindow("component-library")}>
          <Icon name="User" size="sm" />
          My components
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Icon name="Plus" size="sm" />
          New component
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
