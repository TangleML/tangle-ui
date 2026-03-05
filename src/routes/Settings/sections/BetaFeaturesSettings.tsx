import { BetaFeatures } from "@/components/shared/Settings/BetaFeatures";

import { useSettingsFlags } from "../SettingsFlagsContext";

export function BetaFeaturesSettings() {
  const { betaFlags, handleSetFlag } = useSettingsFlags();

  return <BetaFeatures betaFlags={betaFlags} onChange={handleSetFlag} />;
}
