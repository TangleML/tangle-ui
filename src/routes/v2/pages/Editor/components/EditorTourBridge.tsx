import { useTour } from "@reactour/tour";
import { useViewport } from "@xyflow/react";
import { reaction } from "mobx";
import { useEffect } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import type { ComponentSpec } from "@/models/componentSpec";
import { useTourProgress } from "@/providers/TourProvider/TourProgressContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";
import { isSecretArgument } from "@/utils/componentSpec";

type CountInteraction =
  "add-task" | "add-input" | "add-output" | "connect-edge";

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
  const { windows, navigation, editor } = useSharedStores();
  const { markStepComplete, isStepComplete } = useTourProgress();
  const { x: viewportX, y: viewportY, zoom: viewportZoom } = useViewport();

  useEffect(() => {
    if (!isOpen) return;
    const rafId = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, viewportX, viewportY, viewportZoom]);

  const step = steps[currentStep] as TourStep | undefined;
  const interaction = step?.interaction;
  const targetWindowId = step?.targetWindowId;
  const ringSelectors = step?.ringSelectors;
  const resetLibrarySearchFlag = step?.resetLibrarySearch ?? false;
  const ensureWindowRestoredId = step?.ensureWindowRestored;
  const requiresTaskSelected = step?.requiresTaskSelected;
  const libraryDragAllow = step?.targetComponentName ?? step?.targetTaskName;
  const stepSelector = step?.selector;

  useEffect(() => {
    if (!isOpen) return;
    if (!ensureWindowRestoredId) return;
    const w = windows.getWindowById(ensureWindowRestoredId);
    const wasHidden = !!w && (w.state === "hidden" || w.isMinimized);
    if (wasHidden) {
      w.restore();
    }
    if (!w) return;

    let cancelled = false;
    const start = Date.now();
    const wantSelector = typeof stepSelector === "string" ? stepSelector : null;
    const waitForDom = () => {
      if (cancelled) return;
      const found = wantSelector
        ? document.querySelector(wantSelector)
        : document.querySelector(
            `[data-dock-window="${ensureWindowRestoredId}"]`,
          );
      if (found || Date.now() - start > 1500) {
        setSteps?.((prev) => [...prev]);
        return;
      }
      window.setTimeout(waitForDom, 50);
    };
    window.setTimeout(waitForDom, 50);

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    ensureWindowRestoredId,
    currentStep,
    windows,
    stepSelector,
    setSteps,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!requiresTaskSelected) return undefined;

    const requiredName = requiresTaskSelected.toLowerCase();
    const findSelectStep = (): number | null => {
      for (let i = currentStep - 1; i >= 0; i--) {
        const s = steps[i] as TourStep | undefined;
        if (
          s?.interaction === "select-task" &&
          s.targetTaskName?.toLowerCase() === requiredName
        ) {
          return i;
        }
      }
      return null;
    };

    const findRequiredTask = () =>
      navigation.activeSpec?.tasks.find(
        (t) => t.name.toLowerCase() === requiredName,
      );

    const isRequiredTaskSelected = () => {
      if (editor.selectedNodeType !== "task") return false;
      const spec = navigation.activeSpec;
      if (!spec) return false;
      const task = spec.tasks.find((t) => t.$id === editor.selectedNodeId);
      return task?.name.toLowerCase() === requiredName;
    };

    const dispose = reaction(
      () => isRequiredTaskSelected(),
      (matches) => {
        if (matches) return;
        const task = findRequiredTask();
        if (task) {
          editor.selectNode(task.$id, "task");
          return;
        }
        const target = findSelectStep();
        if (target !== null && !isStepComplete(target)) {
          setCurrentStep(target);
        }
      },
      { fireImmediately: true },
    );

    return () => dispose();
  }, [
    isOpen,
    requiresTaskSelected,
    currentStep,
    steps,
    editor,
    navigation,
    isStepComplete,
    setCurrentStep,
  ]);

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

    if (interaction === "assign-secret-argument") {
      const targetArgumentName = step?.targetArgumentName;

      const hasSecretArgument = () => {
        const spec = navigation.activeSpec;
        if (!spec) return false;
        return spec.tasks.some((task) =>
          task.arguments.some(
            (arg) =>
              (!targetArgumentName || arg.name === targetArgumentName) &&
              isSecretArgument(arg.value),
          ),
        );
      };

      if (hasSecretArgument()) {
        skip();
        return stopFollow;
      }

      const dispose = reaction(
        () => hasSecretArgument(),
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

    if (interaction === "open-secret-dialog") {
      const dialogSelector = '[data-testid="select-secret-dialog"]';
      const isDialogOpen = () => !!document.querySelector(dialogSelector);

      if (isDialogOpen()) {
        skip();
        return stopFollow;
      }

      const observer = new MutationObserver(() => {
        if (isDialogOpen()) {
          observer.disconnect();
          advance();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        stopFollow();
        observer.disconnect();
      };
    }

    if (interaction === "open-settings-panel") {
      const panelSelector = '[data-tour="tour-settings-dialog"]';
      const isPanelOpen = () => !!document.querySelector(panelSelector);

      if (isPanelOpen()) {
        skip();
        return stopFollow;
      }

      const observer = new MutationObserver(() => {
        if (isPanelOpen()) {
          observer.disconnect();
          advance();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        stopFollow();
        observer.disconnect();
      };
    }

    if (interaction === "open-submit-dialog") {
      const dialogSelector = '[data-tour="submit-arguments-dialog"]';
      const isDialogOpen = () => !!document.querySelector(dialogSelector);

      if (isDialogOpen()) {
        skip();
        return stopFollow;
      }

      const observer = new MutationObserver(() => {
        if (isDialogOpen()) {
          observer.disconnect();
          advance();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        stopFollow();
        observer.disconnect();
      };
    }

    if (interaction === "assign-secret-submit") {
      const secretSelector =
        '[data-tour="submit-arguments-dialog"] [data-testid="dynamic-data-argument-input"]';
      const hasSecret = () => !!document.querySelector(secretSelector);

      if (hasSecret()) {
        skip();
        return stopFollow;
      }

      const observer = new MutationObserver(() => {
        if (hasSecret()) {
          observer.disconnect();
          advance();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        stopFollow();
        observer.disconnect();
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

    if (interaction === "navigate-into-subgraph") {
      const targetName = step?.targetTaskName?.toLowerCase();
      const baselineDepth = navigation.navigationDepth;

      const matches = () => {
        if (navigation.navigationDepth <= baselineDepth) return false;
        if (!targetName) return true;
        const last =
          navigation.navigationPath[navigation.navigationPath.length - 1];
        return last?.displayName.toLowerCase() === targetName;
      };

      if (matches()) {
        skip();
        return stopFollow;
      }

      const dispose = reaction(
        () => matches(),
        (m) => {
          if (m) {
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

    if (interaction === "navigate-to-root") {
      const isAtRoot = () => navigation.navigationDepth === 0;

      if (isAtRoot()) {
        skip();
        return stopFollow;
      }

      const dispose = reaction(
        () => isAtRoot(),
        (m) => {
          if (m) {
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

    if (interaction === "unpack-subgraph") {
      const countSubgraphTasks = () => {
        const spec = navigation.activeSpec;
        if (!spec) return 0;
        return spec.tasks.filter((t) => t.subgraphSpec !== undefined).length;
      };
      const baseline = countSubgraphTasks();

      const dispose = reaction(
        () => countSubgraphTasks(),
        (current) => {
          if (current < baseline) {
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

    if (interaction === "multi-select-tasks") {
      const minCount = step?.targetMinCount ?? 2;

      const taskSelectionCount = () =>
        editor.multiSelection.filter((n) => n.type === "task").length;

      if (taskSelectionCount() >= minCount) {
        skip();
        return stopFollow;
      }

      const dispose = reaction(
        () => taskSelectionCount(),
        (current) => {
          if (current >= minCount) {
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

    if (interaction === "create-subgraph") {
      const countSubgraphTasks = () => {
        const spec = navigation.activeSpec;
        if (!spec) return 0;
        return spec.tasks.filter((t) => t.subgraphSpec !== undefined).length;
      };
      const baseline = countSubgraphTasks();

      const dispose = reaction(
        () => countSubgraphTasks(),
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
    step,
    steps,
    windows,
    navigation,
    markStepComplete,
    currentStep,
  ]);

  return null;
}
