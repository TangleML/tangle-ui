import { useTour } from "@reactour/tour";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import type { ComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

type CountInteraction =
  | "add-task"
  | "add-input"
  | "add-output"
  | "connect-edge";

function isCountInteraction(
  interaction: TourStep["interaction"],
): interaction is CountInteraction {
  return (
    interaction === "add-task" ||
    interaction === "add-input" ||
    interaction === "add-output" ||
    interaction === "connect-edge"
  );
}

function countForInteraction(
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
  const { steps, currentStep, setCurrentStep, setSteps, isOpen } = useTour();
  const { windows, navigation } = useSharedStores();

  const prevStepRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);

  const step = steps[currentStep] as TourStep | undefined;
  const interaction = step?.interaction;
  const targetWindowId = step?.targetWindowId;
  const ringSelectors = step?.ringSelectors;
  const resetLibrarySearchFlag = step?.resetLibrarySearch ?? false;
  const libraryDragAllow = step?.targetComponentName ?? step?.targetTaskName;

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!libraryDragAllow) return undefined;
    const allow = libraryDragAllow.toLowerCase();
    const handleDragStart = (event: DragEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('[data-dock-window-content="component-library"]')) {
        return;
      }
      const item =
        target.querySelector("[data-component-name]") ??
        target.closest("[data-component-name]");
      if (!item) return;
      const name = (
        item.getAttribute("data-component-name") ?? ""
      ).toLowerCase();
      if (!name.includes(allow)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("dragstart", handleDragStart, true);
    return () => {
      document.removeEventListener("dragstart", handleDragStart, true);
    };
  }, [isOpen, libraryDragAllow]);

  const stepSelector = step?.selector;
  useEffect(() => {
    if (!isOpen) return;
    if (!resetLibrarySearchFlag) return;

    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="search-input"]',
    );
    if (input?.value) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      if (setter) {
        setter.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    let cancelled = false;
    const start = Date.now();
    const wantSelector = typeof stepSelector === "string" ? stepSelector : null;
    const tryRefresh = () => {
      if (cancelled) return;
      const found = wantSelector
        ? document.querySelector(wantSelector)
        : document.querySelector("[data-folder-name]");
      if (found || Date.now() - start > 1500) {
        // Force a re-render in reactour so step.selector is re-queried.
        setSteps?.((prev) => [...prev]);
        return;
      }
      window.setTimeout(tryRefresh, 50);
    };
    window.setTimeout(tryRefresh, 50);

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentStep, resetLibrarySearchFlag, setSteps, stepSelector]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!ringSelectors?.length) return undefined;

    const ringed = new Set<Element>();

    const update = () => {
      const current = new Set<Element>();
      for (const sel of ringSelectors) {
        document.querySelectorAll(sel).forEach((el) => current.add(el));
      }
      for (const el of ringed) {
        if (!current.has(el)) el.classList.remove("tour-ring");
      }
      for (const el of current) {
        el.classList.add("tour-ring");
        ringed.add(el);
      }
      for (const el of ringed) {
        if (!current.has(el)) ringed.delete(el);
      }
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      for (const el of ringed) el.classList.remove("tour-ring");
    };
  }, [isOpen, ringSelectors]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prev = prevStepRef.current;
    if (prev !== null && currentStep !== prev) {
      directionRef.current = currentStep < prev ? -1 : 1;
    }
    prevStepRef.current = currentStep;
    const direction = directionRef.current;

    // Run outside the interaction branch so informational/fallback steps that
    // target a floating window still track its position.
    const stopFollow = followWindowPosition(windows, targetWindowId);

    if (!interaction) return stopFollow;

    const advance = () => {
      setCurrentStep((s: number) =>
        Math.min(s + 1, Math.max(0, steps.length - 1)),
      );
    };

    const skip = () => {
      setCurrentStep((s: number) => {
        if (direction === -1) return Math.max(s - 1, 0);
        return Math.min(s + 1, Math.max(0, steps.length - 1));
      });
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
        skip();
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
      const targetName = step?.targetTaskName?.toLowerCase();
      const handleClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        const node = target?.closest('[data-tour-node="task"]');
        if (!node) return;
        if (targetName) {
          const name = (
            node.getAttribute("data-task-name") ?? ""
          ).toLowerCase();
          if (!name.includes(targetName)) return;
        }
        advance();
      };
      document.addEventListener("click", handleClick);
      return () => {
        stopFollow();
        document.removeEventListener("click", handleClick);
      };
    }

    if (interaction === "expand-folder") {
      const targetFolderName = step?.targetFolderName;
      if (!targetFolderName) return stopFollow;

      const expandedSelector = `[data-folder-name="${targetFolderName}"] [aria-expanded="true"]`;
      const isExpanded = () => !!document.querySelector(expandedSelector);

      if (isExpanded()) {
        skip();
        return stopFollow;
      }

      const observer = new MutationObserver(() => {
        if (isExpanded()) advance();
      });
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["aria-expanded"],
        subtree: true,
      });

      return () => {
        stopFollow();
        observer.disconnect();
      };
    }

    if (interaction === "library-search") {
      const sel = '[data-testid="search-input"]';
      const targetTerm = step?.targetSearchTerm?.toLowerCase();
      const matches = () => {
        const el = document.querySelector<HTMLInputElement>(sel);
        if (!el) return false;
        const value = el.value.trim().toLowerCase();
        if (targetTerm) return value.includes(targetTerm);
        return value.length > 0;
      };

      let advanceTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleStep = (move: () => void) => {
        if (advanceTimer !== null) return;
        advanceTimer = setTimeout(() => {
          advanceTimer = null;
          move();
        }, 600);
      };

      if (matches()) {
        scheduleStep(skip);
      }

      const handleInput = (event: Event) => {
        const target = event.target as Element | null;
        if (target?.matches(sel) && matches()) scheduleStep(advance);
      };
      document.addEventListener("input", handleInput, true);

      return () => {
        stopFollow();
        document.removeEventListener("input", handleInput, true);
        if (advanceTimer !== null) clearTimeout(advanceTimer);
      };
    }

    if (interaction === "set-argument") {
      const targetArgumentName = step?.targetArgumentName;
      if (!targetArgumentName) return stopFollow;

      const hasArgumentValue = () => {
        const spec = navigation.activeSpec;
        if (!spec) return false;
        return spec.tasks.some((task) =>
          task.arguments.some(
            (arg) =>
              arg.name === targetArgumentName &&
              typeof arg.value === "string" &&
              arg.value.trim() !== "",
          ),
        );
      };

      if (hasArgumentValue()) {
        skip();
        return stopFollow;
      }

      const dispose = reaction(
        () => hasArgumentValue(),
        (matches) => {
          if (matches) {
            dispose();
            advance();
          }
        },
      );

      return () => {
        stopFollow();
        dispose();
      };
    }

    if (interaction === "connect-edge" && step?.targetEdge) {
      const target = step.targetEdge;
      const hasTargetEdge = () => {
        const spec = navigation.activeSpec;
        if (!spec) return false;
        const sourceTask = spec.tasks.find(
          (t) => t.name === target.sourceTaskName,
        );
        if (!sourceTask) return false;

        if (!target.targetTaskName) {
          return spec.bindings.some(
            (b) =>
              b.sourceEntityId === sourceTask.$id &&
              b.sourcePortName === target.sourcePortName,
          );
        }

        const targetTask = spec.tasks.find(
          (t) => t.name === target.targetTaskName,
        );
        if (!targetTask) return false;
        return spec.bindings.some(
          (b) =>
            b.sourceEntityId === sourceTask.$id &&
            b.targetEntityId === targetTask.$id &&
            b.sourcePortName === target.sourcePortName &&
            b.targetPortName === target.targetPortName,
        );
      };

      if (hasTargetEdge()) {
        skip();
        return stopFollow;
      }

      const dispose = reaction(
        () => hasTargetEdge(),
        (matches) => {
          if (matches) {
            dispose();
            advance();
          }
        },
      );

      return () => {
        stopFollow();
        dispose();
      };
    }

    if (interaction === "add-task" && step?.targetTaskName) {
      const targetName = step.targetTaskName.toLowerCase();

      const countMatches = () => {
        const spec = navigation.activeSpec;
        if (!spec) return 0;
        return spec.tasks.filter((t) =>
          t.name.toLowerCase().includes(targetName),
        ).length;
      };
      const baseline = countMatches();

      const dispose = reaction(
        () => countMatches(),
        (current) => {
          if (current > baseline) {
            dispose();
            advance();
          }
        },
      );

      return () => {
        stopFollow();
        dispose();
      };
    }

    if (isCountInteraction(interaction)) {
      const baseline = countForInteraction(navigation.activeSpec, interaction);

      const dispose = reaction(
        () => countForInteraction(navigation.activeSpec, interaction),
        (current) => {
          if (current > baseline) {
            dispose();
            advance();
          }
        },
      );

      return () => {
        stopFollow();
        dispose();
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
    navigation,
  ]);

  return null;
}
