import { useAnalytics } from "@/providers/AnalyticsProvider";

import { useRouteChangeTracking } from "./useRouteChangeTracking";

/**
 * Tracks a `page_view` analytics event whenever the route changes.
 *
 * Delegates to `useRouteChangeTracking` for navigation detection and maps the
 * full payload into an analytics event with route metadata.
 *
 * Must be rendered inside the AnalyticsProvider.
 */
export function usePageViewTracking(): void {
  const { track } = useAnalytics();

  useRouteChangeTracking((payload) => {
    track("page_view", {
      from: payload.from,
      to: payload.to,
      search: payload.search,
      hash: payload.hash,
      href: payload.href,
      route_pattern: payload.leafRoute,
    });
  });
}
