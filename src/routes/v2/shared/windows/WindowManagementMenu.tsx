import { observer } from "mobx-react-lite";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { ViewPreset } from "@/routes/v2/shared/windows/viewPresets";
import { tracking } from "@/utils/tracking";

interface WindowManagementMenuProps {
  presets: readonly ViewPreset[];
  trackingPrefix: string;
}

export const WindowManagementMenu = observer(function WindowManagementMenu({
  presets,
  trackingPrefix,
}: WindowManagementMenuProps) {
  const { track } = useAnalytics();
  const { windows } = useSharedStores();
  const sortedWindows = [...windows.getAllWindows()]
    .filter((window) => window.persisted)
    .sort((a, b) => a.title.localeCompare(b.title));

  const applyPreset = (preset: ViewPreset) => {
    track(`${trackingPrefix}.view_preset.click`, {
      preset_label: preset.label,
    });
    windows.applyViewPreset(preset);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton {...tracking(trackingPrefix)}>
          Windows
        </MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        data-tour="windows-menu-content"
      >
        {sortedWindows.map((window) => (
          <DropdownMenuCheckboxItem
            key={window.id}
            checked={window.state !== "hidden"}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(visible) => {
              track(`${trackingPrefix}.window_visibility.toggle`, {
                window_id: window.id,
                visible,
              });
              if (visible) {
                window.restore();
              } else {
                window.hide();
              }
            }}
          >
            {window.title}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon name="LayoutDashboard" size="sm" />
            Views
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent data-tour="windows-menu-submenu-content">
            {presets.map((preset) => (
              <DropdownMenuItem
                key={preset.label}
                onSelect={() => applyPreset(preset)}
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
