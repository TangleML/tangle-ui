import { useRef } from "react";

import { ImportComponent } from "@/components/shared/ReactFlow/FlowSidebar/components";
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
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
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
          <DropdownMenuItem onClick={() => importTriggerRef.current?.click()}>
            <Icon name="PackagePlus" size="sm" />
            Add component
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportComponent
        triggerComponent={
          <button
            ref={importTriggerRef}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        }
      />
    </>
  );
}
