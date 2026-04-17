import { observer } from "mobx-react-lite";

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
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { ShortcutBadge } from "@/routes/v2/shared/components/ShortcutBadge";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  VIEW_PRESETS,
  type ViewPreset,
} from "@/routes/v2/shared/windows/viewPresets";

const PRESET_SHORTCUT_IDS: Record<string, string> = {
  Default: "layout-default",
  Minimal: "layout-minimal",
  All: "layout-all",
};

export const WindowsMenu = observer(function WindowsMenu() {
  const { windows } = useSharedStores();
  const allWindows = windows.getAllWindows();

  const applyPreset = (preset: ViewPreset) => {
    windows.applyViewPreset(preset);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Windows</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        {allWindows.map((win) => (
          <DropdownMenuCheckboxItem
            key={win.id}
            checked={win.state !== "hidden"}
            onCheckedChange={(checked) => {
              if (checked) {
                win.restore();
              } else {
                win.hide();
              }
            }}
          >
            {win.title}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon name="LayoutDashboard" size="sm" />
            Views
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {VIEW_PRESETS.map((preset) => (
              <DropdownMenuItem
                key={preset.label}
                onSelect={() => applyPreset(preset)}
              >
                {preset.label}
                {PRESET_SHORTCUT_IDS[preset.label] && (
                  <DropdownMenuShortcut>
                    <ShortcutBadge id={PRESET_SHORTCUT_IDS[preset.label]} />
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
