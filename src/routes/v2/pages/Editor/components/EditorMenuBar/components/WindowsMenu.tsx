import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { viewPresetsForComponentSearchMode } from "@/routes/v2/shared/windows/viewPresets";
import { WindowManagementMenu } from "@/routes/v2/shared/windows/WindowManagementMenu";

export const WindowsMenu = () => {
  const componentSearchV2Enabled = useFlagValue("component-search-v2");

  return (
    <WindowManagementMenu
      presets={viewPresetsForComponentSearchMode(componentSearchV2Enabled)}
      trackingPrefix="v2.pipeline_editor.windows_menu"
    />
  );
};
