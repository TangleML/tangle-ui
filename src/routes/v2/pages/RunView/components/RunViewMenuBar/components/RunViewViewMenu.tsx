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
import { ShorcutBadge } from "@/routes/v2/shared/components/ShorcutBadge";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

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
        <MenuTriggerButton>View</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!autoLayoutShortcut}>
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
              >
                {algo.label}
                {algo.key === "sugiyama" && (
                  <DropdownMenuShortcut>
                    <ShorcutBadge id="auto-layout" />
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
