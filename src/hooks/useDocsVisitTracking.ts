import { useEffect } from "react";

import { DOCUMENTATION_URL, PRIVACY_POLICY_URL } from "@/utils/constants";

export function useDocsVisitTracking(onVisit: () => void): void {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!anchor) return;
      const { href } = anchor;
      if (
        href.startsWith(DOCUMENTATION_URL) &&
        !href.startsWith(PRIVACY_POLICY_URL)
      ) {
        onVisit();
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [onVisit]);
}
