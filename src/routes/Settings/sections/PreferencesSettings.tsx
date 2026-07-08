import { Settings } from "@/components/shared/Settings/Settings";
import { BlockStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";

import { useSettingsFlags } from "../SettingsFlagsContext";
import { ThemeSetting } from "./ThemeSetting";

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

  return (
    <BlockStack gap="6">
      <ThemeSetting />
      <Settings settings={settings} onChange={handleChange} />
    </BlockStack>
  );
}
