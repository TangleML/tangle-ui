import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

type TrackingPayload = {
  from?: string;
  to: string;
  search: Record<string, unknown>;
  hash: string;
  href: string;
  leafRoute: string;
};

export function useRouteChangeTracking(
  onRouteChange: (payload: TrackingPayload) => void,
) {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = router.subscribe(
      "onResolved",
      ({ fromLocation, toLocation }) => {
        if (fromLocation?.href === toLocation.href) return;

        const currentMatches = router.state.matches;
        const leafMatch = currentMatches[currentMatches.length - 1];
        const leafRoute = leafMatch
          ? (router.routesById[leafMatch.routeId]?.fullPath ??
            leafMatch.routeId)
          : toLocation.pathname;

        onRouteChange({
          from: fromLocation?.pathname,
          to: toLocation.pathname,
          search: toLocation.search as Record<string, unknown>,
          hash: toLocation.hash,
          href: toLocation.href,
          leafRoute,
        });
      },
    );

    return unsubscribe;
  }, [router, onRouteChange]);
}
