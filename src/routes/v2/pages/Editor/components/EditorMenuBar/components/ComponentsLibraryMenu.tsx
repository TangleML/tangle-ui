import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { restoreWindow } from "@/routes/v2/shared/windows/windows.actions";

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
