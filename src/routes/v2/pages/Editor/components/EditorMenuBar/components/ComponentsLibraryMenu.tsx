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
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/router";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { tracking } from "@/utils/tracking";

export function ComponentsLibraryMenu() {
  const { track } = useAnalytics();
  const navigate = useNavigate();
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton
            {...tracking("v2.pipeline_editor.components_library_menu")}
          >
            Components
          </MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem
            onClick={() => {
              track(
                "v2.pipeline_editor.components_library_menu.explore_library.click",
              );
              void navigate({ to: APP_ROUTES.DASHBOARD_COMPONENTS });
            }}
          >
            <Icon name="Library" size="sm" />
            Explore library
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              track(
                "v2.pipeline_editor.components_library_menu.add_component.click",
              );
              importTriggerRef.current?.click();
            }}
          >
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
