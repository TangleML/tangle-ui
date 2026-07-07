import { useTour } from "@reactour/tour";
import { useViewport } from "@xyflow/react";

import { useTourProgress } from "@/providers/TourProvider/TourProgressContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import {
  useEnsureWindowRestored,
  useInteractionGate,
  useLibraryDragGate,
  useRequiresTaskSelected,
  useResetLibrarySearch,
  useRingSelectors,
  useViewportResizeDispatch,
} from "./editorTourBridge.hooks";
import { asTourStep } from "./editorTourBridge.utils";

/**
 * Render-null bridge between the active guided tour and editor state. It watches
 * DOM/store changes and marks the current step complete when its interaction is
 * satisfied. Each concern lives in its own hook; the per-interaction completion
 * logic lives in the INTERACTION_HANDLERS registry.
 */
export function EditorTourBridge() {
  const { steps, currentStep, setCurrentStep, setSteps, isOpen } = useTour();
  const { windows, navigation, editor } = useSharedStores();
  const { markStepComplete, isStepComplete } = useTourProgress();
  const { x: viewportX, y: viewportY, zoom: viewportZoom } = useViewport();

  const step = asTourStep(steps[currentStep]);

  useViewportResizeDispatch({ isOpen, viewportX, viewportY, viewportZoom });

  useEnsureWindowRestored({
    isOpen,
    ensureWindowRestoredId: step?.ensureWindowRestored,
    currentStep,
    windows,
    stepSelector: step?.selector,
    setSteps,
  });

  useRequiresTaskSelected({
    isOpen,
    requiresTaskSelected: step?.requiresTaskSelected,
    currentStep,
    steps,
    editor,
    navigation,
    isStepComplete,
    setCurrentStep,
  });

  useLibraryDragGate({
    isOpen,
    libraryDragAllow: step?.targetComponentName ?? step?.targetTaskName,
  });

  useResetLibrarySearch({
    isOpen,
    currentStep,
    resetLibrarySearchFlag: step?.resetLibrarySearch ?? false,
    setSteps,
    stepSelector: step?.selector,
  });

  useRingSelectors({ isOpen, ringSelectors: step?.ringSelectors });

  useInteractionGate({
    isOpen,
    interaction: step?.interaction,
    step,
    targetWindowId: step?.targetWindowId,
    windows,
    navigation,
    editor,
    markStepComplete,
    currentStep,
  });

  return null;
}
