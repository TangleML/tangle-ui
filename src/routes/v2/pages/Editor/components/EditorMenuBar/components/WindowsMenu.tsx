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
import {
  VIEW_PRESETS,
  type ViewPreset,
} from "@/routes/v2/shared/windows/viewPresets";
import { tracking } from "@/utils/tracking";

export const WindowsMenu = observer(function WindowsMenu() {
  const { track } = useAnalytics();
  const { windows } = useSharedStores();
  const sortedWindows = [...windows.getAllWindows()]
    .filter((window) => window.persisted)
    .sort((a, b) => a.title.localeCompare(b.title));

  const applyPreset = (preset: ViewPreset) => {
    track("v2.pipeline_editor.windows_menu.view_preset.click", {
      preset_label: preset.label,
    });
    windows.applyViewPreset(preset);
  };

  const notifyOpenStateChange = (open: boolean) => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    if (!open) {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 250);
    }
  };

  return (
    <DropdownMenu onOpenChange={notifyOpenStateChange}>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton {...tracking("v2.pipeline_editor.windows_menu")}>
          Windows
        </MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        data-tour="windows-menu-content"
      >
        {sortedWindows.map((win) => (
          <DropdownMenuCheckboxItem
            key={win.id}
            checked={win.state !== "hidden"}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              track(
                "v2.pipeline_editor.windows_menu.window_visibility.toggle",
                {
                  window_id: win.id,
                  visible: checked,
                },
              );
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
        <DropdownMenuSub onOpenChange={notifyOpenStateChange}>
          <DropdownMenuSubTrigger>
            <Icon name="LayoutDashboard" size="sm" />
            Views
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent data-tour="windows-menu-submenu-content">
            {VIEW_PRESETS.map((preset) => (
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
