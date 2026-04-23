import { useEffect } from "react";

import { useAnalytics } from "@/providers/AnalyticsProvider";

const INTERACTIVE_ELEMENTS: Set<string> = new Set(["a", "button", "summary"]);

const TRACKING_ATTR = "data-tracking-id";

function findTrackedInteractiveElement(
  target: EventTarget | null,
): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;

  while (node && node !== document.documentElement) {
    const tag = node.tagName.toLowerCase();
    const role = node.getAttribute("role");

    const isInteractive =
      INTERACTIVE_ELEMENTS.has(tag) || role === "button" || role === "link";

    if (isInteractive && node.hasAttribute(TRACKING_ATTR)) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

/** @public */
export function getTrackingAttributes(domElement: HTMLElement) {
  const actionType = domElement.getAttribute("data-tracking-id");
  const metadata = domElement.dataset["trackingMetadata"]
    ? JSON.parse(domElement.dataset["trackingMetadata"])
    : undefined;

  return {
    actionType,
    metadata,
  };
}

/**
 * Listens for click events on `document` and automatically emits an analytics
 * event when the click originates from an interactive element that carries a
 * `data-tracking-id` attribute. The attribute value is used as the `action_type`,
 * with `.click` automatically appended (e.g. `data-tracking-id="header.settings"`
 * fires as `header.settings.click`).
 */
export function useClickTracking() {
  const { track } = useAnalytics();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const element = findTrackedInteractiveElement(event.target);
      if (!element) return;

      const { actionType, metadata } = getTrackingAttributes(element);

      if (!actionType) return;

      track(`${actionType}.click`, metadata);
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [track]);
}
