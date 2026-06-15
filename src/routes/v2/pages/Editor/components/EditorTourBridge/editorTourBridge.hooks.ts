import type { StepType } from "@reactour/tour";
import { reaction } from "mobx";
import { type Dispatch, type SetStateAction, useEffect } from "react";

import type { TourStep } from "@/components/Learn/tours/registry";
import type { TourInteraction } from "@/providers/TourProvider/tourActions";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import { INTERACTION_HANDLERS } from "./editorTourBridge.interactions";
import {
  asTourStep,
  elementFromEvent,
  followWindowPosition,
  pollForSelectorThenRefreshSteps,
} from "./editorTourBridge.utils";

type SetSteps = Dispatch<SetStateAction<StepType[]>> | undefined;

interface ViewportResizeArgs {
  isOpen: boolean;
  viewportX: number;
  viewportY: number;
  viewportZoom: number;
}

/** Nudge floating windows/popovers to re-measure as the canvas pans or zooms. */
export function useViewportResizeDispatch({
  isOpen,
  viewportX,
  viewportY,
  viewportZoom,
}: ViewportResizeArgs): void {
  useEffect(() => {
    if (!isOpen) return;
    const rafId = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, viewportX, viewportY, viewportZoom]);
}

interface EnsureWindowRestoredArgs {
  isOpen: boolean;
  ensureWindowRestoredId: string | undefined;
  currentStep: number;
  windows: WindowStoreImpl;
  stepSelector: TourStep["selector"] | undefined;
  setSteps: SetSteps;
}

/** Restore a hidden/minimized window a step targets, then refresh once it mounts. */
export function useEnsureWindowRestored({
  isOpen,
  ensureWindowRestoredId,
  currentStep,
  windows,
  stepSelector,
  setSteps,
}: EnsureWindowRestoredArgs): void {
  useEffect(() => {
    if (!isOpen) return;
    if (!ensureWindowRestoredId) return;
    const w = windows.getWindowById(ensureWindowRestoredId);
    const wasHidden = !!w && (w.state === "hidden" || w.isMinimized);
    if (wasHidden) {
      w.restore();
    }
    if (!w) return;

    const wantSelector = typeof stepSelector === "string" ? stepSelector : null;
    return pollForSelectorThenRefreshSteps(
      wantSelector,
      `[data-dock-window="${ensureWindowRestoredId}"]`,
      setSteps,
    );
  }, [
    isOpen,
    ensureWindowRestoredId,
    currentStep,
    windows,
    stepSelector,
    setSteps,
  ]);
}

interface RequiresTaskSelectedArgs {
  isOpen: boolean;
  requiresTaskSelected: string | undefined;
  currentStep: number;
  steps: StepType[];
  editor: EditorStore;
  navigation: NavigationStore;
  isStepComplete: (step: number) => boolean;
  setCurrentStep: Dispatch<SetStateAction<number>>;
}

/**
 * Keep the task a step depends on selected: re-select it if the user clicks
 * away, or rewind to the earlier select-task step if it no longer exists.
 */
export function useRequiresTaskSelected({
  isOpen,
  requiresTaskSelected,
  currentStep,
  steps,
  editor,
  navigation,
  isStepComplete,
  setCurrentStep,
}: RequiresTaskSelectedArgs): void {
  useEffect(() => {
    if (!isOpen) return undefined;
    if (!requiresTaskSelected) return undefined;

    const requiredName = requiresTaskSelected.toLowerCase();
    const findSelectStep = (): number | null => {
      for (let i = currentStep - 1; i >= 0; i--) {
        const s = asTourStep(steps[i]);
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
}

interface LibraryDragGateArgs {
  isOpen: boolean;
  libraryDragAllow: string | undefined;
}

/** Block dragging library components other than the one the step calls for. */
export function useLibraryDragGate({
  isOpen,
  libraryDragAllow,
}: LibraryDragGateArgs): void {
  useEffect(() => {
    if (!isOpen) return undefined;
    if (!libraryDragAllow) return undefined;
    const allow = libraryDragAllow.toLowerCase();
    const handleDragStart = (event: DragEvent) => {
      const target = elementFromEvent(event);
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
}

interface ResetLibrarySearchArgs {
  isOpen: boolean;
  currentStep: number;
  resetLibrarySearchFlag: boolean;
  setSteps: SetSteps;
  stepSelector: TourStep["selector"] | undefined;
}

/** Clear the component-library search box when a step asks for a clean slate. */
export function useResetLibrarySearch({
  isOpen,
  currentStep,
  resetLibrarySearchFlag,
  setSteps,
  stepSelector,
}: ResetLibrarySearchArgs): void {
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

    const wantSelector = typeof stepSelector === "string" ? stepSelector : null;
    return pollForSelectorThenRefreshSteps(
      wantSelector,
      "[data-folder-name]",
      setSteps,
    );
  }, [isOpen, currentStep, resetLibrarySearchFlag, setSteps, stepSelector]);
}

interface RingSelectorsArgs {
  isOpen: boolean;
  ringSelectors: string[] | undefined;
}

/** Maintain the `.tour-ring` highlight on the elements a step points at. */
export function useRingSelectors({
  isOpen,
  ringSelectors,
}: RingSelectorsArgs): void {
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

    // Coalesce mutation bursts (ReactFlow churns node DOM on pan/zoom/edit) into
    // at most one re-query per frame.
    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };

    update();
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      for (const el of ringed) el.classList.remove("tour-ring");
    };
  }, [isOpen, ringSelectors]);
}

interface InteractionGateArgs {
  isOpen: boolean;
  interaction: TourInteraction | undefined;
  step: TourStep | undefined;
  targetWindowId: string | undefined;
  windows: WindowStoreImpl;
  navigation: NavigationStore;
  editor: EditorStore;
  markStepComplete: (step: number) => void;
  currentStep: number;
}

/**
 * Dispatch the active step's interaction to its handler. Window-position
 * following runs even for informational (non-interaction) steps so a popover
 * anchored to a floating window keeps tracking it.
 */
export function useInteractionGate({
  isOpen,
  interaction,
  step,
  targetWindowId,
  windows,
  navigation,
  editor,
  markStepComplete,
  currentStep,
}: InteractionGateArgs): void {
  useEffect(() => {
    if (!isOpen) return undefined;

    const stopFollow = followWindowPosition(windows, targetWindowId);
    if (!interaction || !step) return stopFollow;

    // Gated progression: completing the interaction (or finding it already
    // satisfied on entry) marks the step done so "Next" enables. Advancing is
    // the user's click, handled by the popover.
    const complete = () => markStepComplete(currentStep);
    const handler = INTERACTION_HANDLERS[interaction];
    if (!handler) return stopFollow;

    return handler({
      step,
      windows,
      navigation,
      editor,
      targetWindowId,
      complete,
      stopFollow,
    });
  }, [
    isOpen,
    interaction,
    step,
    targetWindowId,
    windows,
    navigation,
    editor,
    markStepComplete,
    currentStep,
  ]);
}
