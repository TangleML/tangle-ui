import type { StepType } from "@reactour/tour";
import { reaction } from "mobx";
import type { Dispatch, SetStateAction } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import type { ComponentSpec } from "@/models/componentSpec";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

// reactour types `steps` as the base StepType, but our tours always carry the
// richer TourStep shape. Centralize the cast here, with its rationale, so call
// sites stay free of bare assertions.
export function asTourStep(step: StepType | undefined): TourStep | undefined {
  return step as TourStep | undefined;
}

export type CountInteraction =
  "add-task" | "add-input" | "add-output" | "connect-edge";

export function isCountInteraction(
  interaction: TourStep["interaction"],
): interaction is CountInteraction {
  return (
    interaction === "add-task" ||
    interaction === "add-input" ||
    interaction === "add-output" ||
    interaction === "connect-edge"
  );
}

export function countForInteraction(
  spec: ComponentSpec | null,
  interaction: CountInteraction,
): number {
  if (!spec) return 0;
  switch (interaction) {
    case "add-task":
      return spec.tasks.length;
    case "add-input":
      return spec.inputs.length;
    case "add-output":
      return spec.outputs.length;
    case "connect-edge":
      return spec.bindings.length;
  }
}

export function countSubgraphTasks(spec: ComponentSpec | null): number {
  if (!spec) return 0;
  return spec.tasks.filter((t) => t.subgraphSpec !== undefined).length;
}

export function elementFromEvent(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

export function watchValue(
  predicate: () => boolean,
  complete: () => void,
  stopFollow: () => void,
): () => void {
  if (predicate()) {
    complete();
    return stopFollow;
  }
  const dispose = reaction(predicate, (matches) => {
    if (matches) {
      dispose();
      complete();
    }
  });
  return () => {
    stopFollow();
    dispose();
  };
}

export function watchSelector(
  selector: string,
  complete: () => void,
  stopFollow: () => void,
  attributeFilter?: string[],
): () => void {
  const present = () => !!document.querySelector(selector);
  if (present()) {
    complete();
    return stopFollow;
  }
  const observer = new MutationObserver(() => {
    if (present()) {
      observer.disconnect();
      complete();
    }
  });
  observer.observe(
    document.body,
    attributeFilter
      ? { attributes: true, attributeFilter, subtree: true }
      : { childList: true, subtree: true },
  );
  return () => {
    stopFollow();
    observer.disconnect();
  };
}

export function pollForSelectorThenRefreshSteps(
  wantSelector: string | null,
  fallbackSelector: string,
  setSteps: Dispatch<SetStateAction<StepType[]>> | undefined,
  budgetMs = 1500,
  intervalMs = 50,
): () => void {
  let cancelled = false;
  const start = Date.now();
  const poll = () => {
    if (cancelled) return;
    if (
      document.querySelector(wantSelector ?? fallbackSelector) ||
      Date.now() - start > budgetMs
    ) {
      setSteps?.((prev) => [...prev]);
      return;
    }
    window.setTimeout(poll, intervalMs);
  };
  window.setTimeout(poll, intervalMs);
  return () => {
    cancelled = true;
  };
}

export function followWindowPosition(
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

export function trackDockStateTransition(
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
