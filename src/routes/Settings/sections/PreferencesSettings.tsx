import { Settings } from "@/components/shared/Settings/Settings";

import { useSettingsFlags } from "../SettingsFlagsContext";

export function PreferencesSettings() {
  const { settings, handleSetFlag } = useSettingsFlags();

  return <Settings settings={settings} onChange={handleSetFlag} />;
}
