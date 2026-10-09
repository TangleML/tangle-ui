import type { MouseEvent } from "react";

import { getDefaultRunPath } from "@/routes/runRoutes";

export function requestsNewTab(event: MouseEvent) {
  return event.ctrlKey || event.metaKey;
}

export function openRunPageInNewTab(runId: string) {
  window.open(getDefaultRunPath(runId), "_blank");
}
