import { type ReactNode, useEffect, useEffectEvent, useState } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { API_URL } from "@/utils/constants";
import {
  getUseEnv,
  getUserBackendUrl,
  getUseRelativePath,
  setUseEnv as setUseEnvInLocalStorage,
  setUserBackendUrl as setUserBackendUrlInLocalStorage,
  setUseRelativePath as setUseRelativePathInLocalStorage,
} from "@/utils/localforage";
import { normalizeUrl } from "@/utils/URL";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";

type BackendContextType = {
  configured: boolean;
  available: boolean;
  ready: boolean;
  backendUrl: string;
  isConfiguredFromEnv: boolean;
  isConfiguredFromRelativePath: boolean;
  setEnvConfig: (useEnv: boolean) => void;
  setRelativePathConfig: (useRelativePath: boolean) => void;
  setBackendUrl: (url: string) => void;
  ping: (args: {
    url?: string;
    notifyResult?: boolean;
    saveAvailability?: boolean;
  }) => Promise<boolean>;
};

const BackendContext =
  createRequiredContext<BackendContextType>("BackendProvider");

export const BackendProvider = ({ children }: { children: ReactNode }) => {
  const notify = useToastNotification();

  const backendUrlFromEnv = API_URL;

  const [userBackendUrl, setUserBackendUrl] = useState("");
  const [useEnv, setUseEnv] = useState(true);
  const [useRelativePath, setUseRelativePath] = useState(false);
  const [available, setAvailable] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  let backendUrl = "";
  if (useEnv && backendUrlFromEnv) {
    backendUrl = backendUrlFromEnv;
  } else if (useRelativePath) {
    backendUrl = window.location.origin;
  } else {
    backendUrl = userBackendUrl;
  }

  const configured = !!backendUrl.trim() || useRelativePath;

  const setBackendUrl = async (url: string) => {
    const normalized = normalizeUrl(url);
    setUserBackendUrl(normalized);
    await setUserBackendUrlInLocalStorage(normalized);
  };

  const setEnvConfig = async (flag: boolean) => {
    await setUseEnvInLocalStorage(flag);
    setUseEnv(flag);
    if (flag) {
      setUseRelativePath(false);
      await setUseRelativePathInLocalStorage(false);
    }
  };

  const setRelativePathConfig = async (flag: boolean) => {
    await setUseRelativePathInLocalStorage(flag);
    setUseRelativePath(flag);
    if (flag) {
      setUseEnv(false);
      await setUseEnvInLocalStorage(false);
    }
  };

  const ping = ({
    url = backendUrl,
    notifyResult = true,
    saveAvailability = true,
  }: {
    url?: string;
    notifyResult?: boolean;
    saveAvailability?: boolean;
  }) => {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      if (notifyResult) notify("Backend is not configured", "error");
      if (saveAvailability) setAvailable(false);
      return Promise.resolve(false);
    }
    return fetch(`${normalizedUrl}/services/ping`)
      .then((res) => {
        if (notifyResult) {
          if (res.ok) notify("Backend available", "success");
          else notify(`Backend unavailable: ${res.statusText}`, "error");
        }
        if (saveAvailability) setAvailable(res.ok);

        setReady(true);

        return res.ok;
      })
      .catch(() => {
        if (notifyResult) notify("Backend unavailable", "error");
        if (saveAvailability) setAvailable(false);
        return false;
      });
  };

  const checkBackendAvailability = useEffectEvent(() => {
    ping({ notifyResult: false });
  });

  useEffect(() => {
    if (settingsLoaded) {
      checkBackendAvailability();
    }
  }, [backendUrl, settingsLoaded]);

  useEffect(() => {
    const getSettings = async () => {
      const url = await getUserBackendUrl();
      setUserBackendUrl(url);

      const envFlag = await getUseEnv();
      const relativeFlag = await getUseRelativePath();

      setUseEnv(envFlag === true);
      setUseRelativePath(relativeFlag === true && !backendUrlFromEnv);

      setSettingsLoaded(true);
    };
    getSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = {
    configured,
    available,
    ready,
    backendUrl,
    isConfiguredFromEnv: useEnv && !!backendUrlFromEnv,
    isConfiguredFromRelativePath: useRelativePath,
    setEnvConfig,
    setRelativePathConfig,
    setBackendUrl,
    ping,
  };

  return (
    <BackendContext.Provider value={contextValue}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => {
  return useRequiredContext(BackendContext);
};
