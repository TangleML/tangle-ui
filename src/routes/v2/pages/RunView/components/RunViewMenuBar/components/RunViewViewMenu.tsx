import { observer } from "mobx-react-lite";

import type { LayoutAlgorithm } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

const LAYOUT_ALGORITHMS: { key: LayoutAlgorithm; label: string }[] = [
  { key: "sugiyama", label: "Sugiyama" },
  { key: "sugiyama_centered", label: "Sugiyama Centered" },
  { key: "digco", label: "Compact" },
  { key: "dwyer", label: "Spread" },
];

export const RunViewViewMenu = observer(function RunViewViewMenu() {
  const { keyboard } = useSharedStores();
  const autoLayoutShortcut = keyboard.getShortcut("auto-layout");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton {...tracking("v2.run_view.menu_bar.view_menu")}>
          View
        </MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            disabled={!autoLayoutShortcut}
            {...tracking("v2.run_view.menu_bar.auto_layout_submenu")}
          >
            <Icon name="LayoutDashboard" size="sm" />
            Auto-layout
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LAYOUT_ALGORITHMS.map((algo) => (
              <DropdownMenuItem
                key={algo.key}
                onSelect={() =>
                  keyboard.invokeShortcut("auto-layout", {
                    algorithm: algo.key,
                  })
                }
                {...tracking("v2.run_view.menu_bar.auto_layout", {
                  selected_layout: algo.key,
                })}
              >
                {algo.label}
                {algo.key === "sugiyama" && (
                  <DropdownMenuShortcut>
                    <ShortcutBadge id="auto-layout" />
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
