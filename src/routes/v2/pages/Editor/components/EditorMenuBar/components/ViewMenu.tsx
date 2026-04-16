import { observer } from "mobx-react-lite";
import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import type { LayoutAlgorithm } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import {
  DropdownMenu,
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
import { serializeComponentSpecToText } from "@/models/componentSpec";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const LAYOUT_ALGORITHMS: { key: LayoutAlgorithm; label: string }[] = [
  { key: "sugiyama", label: "Sugiyama" },
  { key: "sugiyama_centered", label: "Sugiyama Centered" },
  { key: "digco", label: "Compact" },
  { key: "dwyer", label: "Spread" },
];

export const ViewMenu = observer(function ViewMenu() {
  const { keyboard, navigation } = useSharedStores();
  const autoLayoutShortcut = keyboard.getShortcut("auto-layout");
  const [showYaml, setShowYaml] = useState(false);

  const spec = navigation.rootSpec;

  return (
    <>
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
                      <ShortcutBadge id="auto-layout" />
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!spec} onSelect={() => setShowYaml(true)}>
            <Icon name="FileCode" size="sm" />
            View YAML
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showYaml && spec && (
        <CodeViewer
          code={serializeComponentSpecToText(spec)}
          language="yaml"
          filename={spec.name}
          fullscreen
          onClose={() => setShowYaml(false)}
        />
      )}
    </>
  );
});
