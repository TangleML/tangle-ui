import { VIEW_PRESETS } from "@/routes/v2/shared/windows/viewPresets";
import { WindowManagementMenu } from "@/routes/v2/shared/windows/WindowManagementMenu";

export const WindowsMenu = () => {
  return (
    <WindowManagementMenu
      presets={VIEW_PRESETS}
      trackingPrefix="v2.pipeline_editor.windows_menu"
    />
  );
};
