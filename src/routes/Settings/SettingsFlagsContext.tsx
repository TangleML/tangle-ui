import type { ReactNode } from "react";

import { useFlagsReducer } from "@/components/shared/Settings/useFlagsReducer";
import { ExistingFlags } from "@/flags";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { useBackend } from "@/providers/BackendProvider";
import type { Flag } from "@/types/configuration";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

const USER_SETTINGS_URL = "/api/users/me/settings";

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
  const { backendUrl, available } = useBackend();

  const handleSetFlag = (flag: string, enabled: boolean) => {
    dispatch({ type: "setFlag", payload: { key: flag, enabled } });

    if (available) {
      const url = new URL(USER_SETTINGS_URL, backendUrl);
      fetchWithErrorHandling(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [`flag_${flag}`]: enabled } }),
      }).catch(() => {
        // fire-and-forget — telemetry only, never surface to user
      });
    }
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
