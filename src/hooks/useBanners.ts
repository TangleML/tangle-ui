import { useEffect, useSyncExternalStore } from "react";

import {
  getBannersSnapshot,
  refreshBanners,
  subscribeToBanners,
  type TangleBanner,
} from "@/config/banners";

export function useBanners(): readonly TangleBanner[] {
  const banners = useSyncExternalStore(subscribeToBanners, getBannersSnapshot);

  useEffect(() => {
    refreshBanners();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshBanners();
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, []);

  return banners;
}
