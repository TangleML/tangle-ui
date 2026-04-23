import { BetaFeatures } from "@/components/shared/Settings/BetaFeatures";
import { useAnalytics } from "@/providers/AnalyticsProvider";

import { useSettingsFlags } from "../SettingsFlagsContext";

export function BetaFeaturesSettings() {
  const { betaFlags, handleSetFlag } = useSettingsFlags();
  const { track } = useAnalytics();

  const handleChange = (key: string, enabled: boolean) => {
    track("settings.toggle_changed", {
      section: "beta_features",
      flag_name: key,
      new_value: enabled,
    });
    handleSetFlag(key, enabled);
  };

  return <BetaFeatures betaFlags={betaFlags} onChange={handleChange} />;
}
