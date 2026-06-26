import { BetaFeatures } from "@/components/shared/Settings/BetaFeatures";
import { useAnalytics } from "@/providers/AnalyticsProvider";

import { useSettingsFlags } from "../SettingsFlagsContext";

export function BetaFeaturesSettings() {
  const { betaFlags, handleSetFlag } = useSettingsFlags();
  const { track } = useAnalytics();
  const componentSearchV2Enabled = betaFlags.some(
    (flag) => flag.key === "component-search-v2" && flag.enabled,
  );
  const componentSearchChildFlags = new Set([
    "component-search-v2-ai-descriptions",
  ]);
  const visibleBetaFlags = componentSearchV2Enabled
    ? betaFlags
    : betaFlags.filter((flag) => !componentSearchChildFlags.has(flag.key));

  const handleChange = (key: string, enabled: boolean) => {
    track("settings.toggle_changed", {
      section: "beta_features",
      flag_name: key,
      new_value: enabled,
    });
    handleSetFlag(key, enabled);
  };

  return <BetaFeatures betaFlags={visibleBetaFlags} onChange={handleChange} />;
}
