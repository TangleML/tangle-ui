import { useTour } from "@reactour/tour";
import { reaction } from "mobx";
import { useEffect } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import { useTourProgress } from "@/providers/TourProvider/TourProgressContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

function followWindowPosition(
  windows: WindowStoreImpl,
  targetWindowId: string | undefined,
): () => void {
  if (!targetWindowId) return () => undefined;

  let rafId: number | null = null;
  const dispose = reaction(
    () => {
      const w = windows.getWindowById(targetWindowId);
      return w ? `${w.position.x},${w.position.y}` : "";
    },
    () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        window.dispatchEvent(new Event("resize"));
      });
    },
  );

  return () => {
    dispose();
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

function trackDockStateTransition(
  windows: WindowStoreImpl,
  matchInitial: (w: { dockState: string }) => boolean,
  matchTransition: (w: { dockState: string }) => boolean,
  targetWindowId?: string,
): { didTransition: () => boolean; dispose: () => void } {
  const baseline = new Set<string>();
  for (const w of windows.getAllWindows()) {
    if (targetWindowId ? w.id === targetWindowId : matchInitial(w)) {
      baseline.add(w.id);
    }
  }
  let fired = false;

  const stateReaction = reaction(
    () =>
      windows
        .getAllWindows()
        .map((w) => `${w.id}:${w.dockState}`)
        .join("|"),
    () => {
      for (const w of windows.getAllWindows()) {
        if (targetWindowId) {
          if (w.id === targetWindowId && matchTransition(w)) {
            fired = true;
          }
          continue;
        }
        if (matchInitial(w)) {
          baseline.add(w.id);
        } else if (baseline.has(w.id) && matchTransition(w)) {
          fired = true;
        }
      }
    },
  );

  return {
    didTransition: () => fired,
    dispose: stateReaction,
  };
}

export function EditorTourBridge() {
  const { steps, currentStep, isOpen } = useTour();
  const { windows } = useSharedStores();
  const { markStepComplete } = useTourProgress();

  const step = steps[currentStep] as TourStep | undefined;
  const interaction = step?.interaction;
  const targetWindowId = step?.targetWindowId;

  useEffect(() => {
    if (!isOpen) return undefined;

    // Run outside the interaction branch so informational/fallback steps that
    // target a floating window still track its position.
    const stopFollow = followWindowPosition(windows, targetWindowId);

    if (!interaction) return stopFollow;

    // Gated progression: completing the interaction (or finding it already
    // satisfied on entry) marks the step done so "Next" enables. Advancing is
    // the user's click, handled by the popover.
    const advance = () => markStepComplete(currentStep);
    const skip = () => markStepComplete(currentStep);
    const skipWithFallback = (_step: TourStep) => markStepComplete(currentStep);

    if (interaction === "undock-window" || interaction === "redock-window") {
      const isDocked = (w: { dockState: string }) => w.dockState !== "none";
      const isUndocked = (w: { dockState: string }) => w.dockState === "none";
      const matchInitial =
        interaction === "undock-window" ? isDocked : isUndocked;
      const matchTransition =
        interaction === "undock-window" ? isUndocked : isDocked;

      if (targetWindowId) {
        const target = windows.getWindowById(targetWindowId);
        if (!target || matchTransition(target)) {
          skipWithFallback(step);
          return stopFollow;
        }
      } else {
        const hasSourceWindow = windows
          .getAllWindows()
          .some((w) => w.state !== "hidden" && matchInitial(w));
        if (!hasSourceWindow) {
          if (step) skipWithFallback(step);
          else skip();
          return stopFollow;
        }
      }

      const tracker = trackDockStateTransition(
        windows,
        matchInitial,
        matchTransition,
        targetWindowId,
      );

      let pendingCheck: ReturnType<typeof setTimeout> | null = null;
      const handleMouseUp = () => {
        if (pendingCheck !== null) clearTimeout(pendingCheck);
        pendingCheck = setTimeout(() => {
          pendingCheck = null;
          if (tracker.didTransition()) advance();
        }, 0);
      };
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        stopFollow();
        tracker.dispose();
        if (pendingCheck !== null) clearTimeout(pendingCheck);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }

    if (interaction === "select-task") {
      const handleClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (target?.closest('[data-tour-node="task"]')) {
          advance();
        }
      };
      document.addEventListener("click", handleClick);
      return () => {
        stopFollow();
        document.removeEventListener("click", handleClick);
      };
    }

    return stopFollow;
  }, [
    isOpen,
    interaction,
    targetWindowId,
    step,
    windows,
    markStepComplete,
    currentStep,
  ]);

  return null;
}
