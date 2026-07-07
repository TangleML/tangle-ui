import type { TourStep } from "@/components/Learn/tours/registry";

export const LEGACY_COMPONENT_WINDOW_ID = "component-library";
export const COMPONENT_SEARCH_V2_WINDOW_ID = "component-search-v2";

export function componentWindowIdForFlag(
  componentSearchV2Enabled: boolean,
): string {
  return componentSearchV2Enabled
    ? COMPONENT_SEARCH_V2_WINDOW_ID
    : LEGACY_COMPONENT_WINDOW_ID;
}

export function resolveComponentWindowSteps(
  steps: TourStep[],
  activeWindowId: string,
): TourStep[] {
  if (activeWindowId === LEGACY_COMPONENT_WINDOW_ID) return steps;

  const rewrite = (value: string) =>
    value.replaceAll(LEGACY_COMPONENT_WINDOW_ID, activeWindowId);
  const rewriteList = (list: string[] | undefined) => list?.map(rewrite);

  return steps.map((step) => {
    const next: TourStep = { ...step };
    if (typeof next.selector === "string") {
      next.selector = rewrite(next.selector);
    }
    if (next.highlightedSelectors) {
      next.highlightedSelectors = rewriteList(next.highlightedSelectors);
    }
    if (next.mutationObservables) {
      next.mutationObservables = rewriteList(next.mutationObservables);
    }
    if (next.resizeObservables) {
      next.resizeObservables = rewriteList(next.resizeObservables);
    }
    if (next.ringSelectors) {
      next.ringSelectors = rewriteList(next.ringSelectors);
    }
    if (next.ensureWindowRestored) {
      next.ensureWindowRestored = rewrite(next.ensureWindowRestored);
    }
    if (typeof next.targetWindowId === "string") {
      next.targetWindowId = rewrite(next.targetWindowId);
    }
    return next;
  });
}
