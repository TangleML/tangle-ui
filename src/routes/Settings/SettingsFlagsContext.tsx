import type { ReactNode } from "react";

import { useFlagsReducer } from "@/components/shared/Settings/useFlagsReducer";
import { ExistingFlags } from "@/flags";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import type { Flag } from "@/types/configuration";

interface SettingsFlagsContextValue {
  betaFlags: Flag[];
  settings: Flag[];
  handleSetFlag: (flag: string, enabled: boolean) => void;
}

const SettingsFlagsContext = createRequiredContext<SettingsFlagsContextValue>(
  "SettingsFlagsContext",
);

export function SettingsFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, dispatch] = useFlagsReducer(ExistingFlags);

  const handleSetFlag = (flag: string, enabled: boolean) => {
    dispatch({ type: "setFlag", payload: { key: flag, enabled } });
  };

  const betaFlags = Object.values(flags).filter(
    (flag) => flag.category === "beta",
  );
  const settings = Object.values(flags).filter(
    (flag) => flag.category === "setting",
  );

  return (
    <SettingsFlagsContext value={{ betaFlags, settings, handleSetFlag }}>
      {children}
    </SettingsFlagsContext>
  );
}

export function useSettingsFlags() {
  return useRequiredContext(SettingsFlagsContext);
}
