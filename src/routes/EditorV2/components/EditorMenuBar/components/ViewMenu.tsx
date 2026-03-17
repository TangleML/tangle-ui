import { observer } from "mobx-react-lite";

import type { LayoutAlgorithm } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import { focusModeStore, toggleFocusMode } from "../../../hooks/useFocusMode";
import { invokeShortcut, keyboardStore } from "../../../store/keyboardStore";
import { ShorcutBadge } from "../../ShorcutBadge";
import { MenuTriggerButton } from "./MenuTriggerButton";

const LAYOUT_ALGORITHMS: { key: LayoutAlgorithm; label: string }[] = [
  { key: "sugiyama", label: "Sugiyama" },
  { key: "sugiyama_centered", label: "Sugiyama Centered" },
  { key: "digco", label: "Compact" },
  { key: "dwyer", label: "Spread" },
];

export const ViewMenu = observer(function ViewMenu() {
  const autoLayoutShortcut = keyboardStore.getShortcut("auto-layout");

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
                  invokeShortcut("auto-layout", { algorithm: algo.key })
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
