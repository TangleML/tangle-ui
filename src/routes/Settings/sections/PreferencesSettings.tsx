import { Settings } from "@/components/shared/Settings/Settings";
import { useAnalytics } from "@/providers/AnalyticsProvider";

import { useSettingsFlags } from "../SettingsFlagsContext";

export function PreferencesSettings() {
  const { settings, handleSetFlag } = useSettingsFlags();
  const { track } = useAnalytics();

  const handleChange = (key: string, enabled: boolean) => {
    track("settings.toggle_changed", {
      section: "preferences",
      flag_name: key,
      new_value: enabled,
    });
    handleSetFlag(key, enabled);
  };

  return <Settings settings={settings} onChange={handleChange} />;
}
