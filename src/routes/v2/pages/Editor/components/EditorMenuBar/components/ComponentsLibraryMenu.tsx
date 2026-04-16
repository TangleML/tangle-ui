import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function ComponentsLibraryMenu() {
  const { windows } = useSharedStores();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Components</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuItem
          onClick={() => windows.restoreWindow("component-library")}
        >
          <Icon name="Library" size="sm" />
          Explore library
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => windows.restoreWindow("component-library")}
        >
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
