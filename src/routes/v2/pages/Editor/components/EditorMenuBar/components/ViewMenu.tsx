import { observer } from "mobx-react-lite";
import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
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
import { serializeComponentSpecToText } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { focusModeStore } from "@/routes/v2/shared/hooks/useFocusMode";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

const LAYOUT_ALGORITHMS: { key: LayoutAlgorithm; label: string }[] = [
  { key: "sugiyama", label: "Sugiyama" },
  { key: "sugiyama_centered", label: "Sugiyama Centered" },
  { key: "digco", label: "Compact" },
  { key: "dwyer", label: "Spread" },
];

export const ViewMenu = observer(function ViewMenu() {
  const { track } = useAnalytics();
  const { keyboard, navigation } = useSharedStores();
  const autoLayoutShortcut = keyboard.getShortcut("auto-layout");
  const [showYaml, setShowYaml] = useState(false);

  const spec = navigation.rootSpec;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton {...tracking("v2.pipeline_editor.view_menu")}>
            View
          </MenuTriggerButton>
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
                  onSelect={() => {
                    track("v2.pipeline_editor.view_menu.auto_layout.click", {
                      layout_algorithm: algo.key,
                    });
                    keyboard.invokeShortcut("auto-layout", {
                      algorithm: algo.key,
                    });
                  }}
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

          <DropdownMenuItem
            disabled={!spec}
            onSelect={() => {
              track("v2.pipeline_editor.view_menu.view_yaml.click");
              setShowYaml(true);
            }}
          >
            <Icon name="FileCode" size="sm" />
            View YAML
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={focusModeStore.active}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              track("v2.pipeline_editor.view_menu.focus_mode.toggle", {
                enabled: checked,
              });
              focusModeStore.toggle();
            }}
          >
            Focus mode
            <DropdownMenuShortcut>
              <ShortcutBadge id="focus-mode" />
            </DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showYaml && spec && (
        <CodeViewer
          code={serializeComponentSpecToText(spec)}
          language="yaml"
          filename={spec.name}
          fullscreen
          onClose={() => {
            track("v2.pipeline_editor.view_menu.view_yaml.close.click");
            setShowYaml(false);
          }}
        />
      )}
    </>
  );
});
