import { useBlocker, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import type { AutoSaveStore } from "@/routes/v2/pages/Editor/store/autoSaveStore";

type PendingAutoSave = Pick<
  AutoSaveStore,
  "flushPending" | "hasUnsavedChanges" | "isSaving" | "error"
>;

export function useAutoSaveOnLeave(autoSave: PendingAutoSave, isActive = true) {
  const notify = useToastNotification();
  const href = useLocation({ select: (location) => location.href });
  const navigationPending = useRef(false);

  useEffect(() => {
    navigationPending.current = false;
  }, [href]);

  useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: async () => {
      navigationPending.current = true;
      if (await autoSave.flushPending()) return false;
      navigationPending.current = false;
      notify(
        autoSave.error ?? "Could not save the pipeline. Retry before leaving.",
        "error",
      );
      return true;
    },
  });

  useEffect(() => {
    if (!isActive) void autoSave.flushPending();
  }, [autoSave, isActive]);

  useEffect(() => {
    const flush = () => {
      void autoSave.flushPending();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!autoSave.hasUnsavedChanges && !autoSave.isSaving) return;
      flush();
      // Browsers cannot await a cloud write after the document closes.
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", flush);
    };
  }, [autoSave]);

  return navigationPending;
}
