import { useNavigate } from "@tanstack/react-router";
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
import { APP_ROUTES } from "@/routes/router";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";

export function ComponentsLibraryMenu() {
  const navigate = useNavigate();
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton>Components</MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem
            onClick={() =>
              void navigate({ to: APP_ROUTES.DASHBOARD_COMPONENTS })
            }
          >
            <Icon name="Library" size="sm" />
            Explore library
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
