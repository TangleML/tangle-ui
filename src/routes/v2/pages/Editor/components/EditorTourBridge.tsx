import { useTour } from "@reactour/tour";
import { reaction } from "mobx";
import { useEffect } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

/**
 * Keep reactour's highlight glued to a specific window as the user drags it.
 * Returns a disposer; safe to call with `targetWindowId === undefined` (no-op).
 */
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

/**
 * Watches the windows store for a dock-state transition. If `targetWindowId`
 * is set, only that window's transitions count. Otherwise we fall back to
 * tracking every window whose initial state matches `matchInitial`, so any
 * eligible window can satisfy the step.
 *
 * Position-following is handled separately by `followWindowPosition` — this
 * function only reports the transition.
 */
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
  const { steps, currentStep, setCurrentStep, setSteps, isOpen } = useTour();
  const { windows } = useSharedStores();

  const step = steps[currentStep] as TourStep | undefined;
  const interaction = step?.interaction;
  const targetWindowId = step?.targetWindowId;

  useEffect(() => {
    if (!isOpen) return undefined;

    // Position-follow runs whenever the step targets a specific window,
    // regardless of whether the step is interactive. That way the highlight
    // tracks a floating panel during step 11 (informational) and step 12's
    // fallback (no interaction) just as it does during the drag step itself.
    const stopFollow = followWindowPosition(windows, targetWindowId);

    if (!interaction) return stopFollow;

    const advance = () => {
      setCurrentStep((s: number) =>
        Math.min(s + 1, Math.max(0, steps.length - 1)),
      );
    };

    const skipWithFallback = (currentStepData: TourStep) => {
      if (currentStepData.fallbackContent) {
        const replaced: TourStep = {
          ...currentStepData,
          content: currentStepData.fallbackContent,
          interaction: undefined,
          stepInteraction: false,
        };
        const next = steps.map((s, i) => (i === currentStep ? replaced : s));
        setSteps?.(next);
      } else {
        advance();
      }
    };

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
          else advance();
          return stopFollow;
        }
      }

      const tracker = trackDockStateTransition(
        windows,
        matchInitial,
        matchTransition,
        targetWindowId,
      );

      // The window's drag handler attaches its own mouseup on mousedown, so
      // it runs *after* this one (later attachment = later fire). For redock
      // the transition happens inside *that* handler (`model.dock(side)`), so
      // checking synchronously here would miss it. Defer to the next task
      // (setTimeout 0) so the full mouseup dispatch has finished and MobX
      // has reacted to the dock state change.
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
        if (target?.closest(".react-flow__node")) {
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
    setCurrentStep,
    setSteps,
    step,
    steps,
    windows,
  ]);

  return null;
}
