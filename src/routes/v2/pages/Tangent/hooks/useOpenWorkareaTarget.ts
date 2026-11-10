import type { MouseEvent } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  parseIdentity,
  type WorkareaTarget,
} from "@/services/projects/resourceTarget";
import { hasNewTabModifier } from "@/utils/dom";
import { getErrorMessage } from "@/utils/string";

/**
 * Opens a workarea target beside the chat, or says in a toast why it can't. A
 * run Cmd/Ctrl-clicked opens on its own page in a new tab instead.
 */
export function useOpenWorkareaTarget() {
  const store = useTangentProject();
  const notify = useToastNotification();

  return async (target: WorkareaTarget, title: string, event?: MouseEvent) => {
    if (target.type === "run" && event && hasNewTabModifier(event)) {
      const runId = parseIdentity(target.identity).value;
      window.open(getDefaultRunPath(runId), "_blank");
      return;
    }
    try {
      await store.openWorkareaTarget(target, title);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  };
}
