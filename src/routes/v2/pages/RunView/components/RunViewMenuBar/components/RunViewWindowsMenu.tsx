import { RUN_VIEW_PRESETS } from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { WindowManagementMenu } from "@/routes/v2/shared/windows/WindowManagementMenu";

export const RunViewWindowsMenu = () => (
  <WindowManagementMenu
    presets={RUN_VIEW_PRESETS}
    trackingPrefix="v2.run_view.windows_menu"
  />
);
