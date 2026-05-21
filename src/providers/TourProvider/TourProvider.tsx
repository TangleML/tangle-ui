import {
  TourProvider as ReactourProvider,
  useTour,
} from "@reactour/tour";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { generate } from "random-words";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getTour } from "@/components/Learn/tours/registry";
import { APP_ROUTES } from "@/routes/router";
import {
  restoreLayout,
  snapshotLayout,
} from "@/routes/v2/shared/windows/windowPersistence";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import { finishingSignal } from "./finishingSignal";
import {
  type PausedTourState,
  readPausedTour,
  writePausedTour,
} from "./pausedTourStorage";
import {
  buildTourPipelineYaml,
  cleanupOrphanTourPipelines,
  deleteTourPipelineByName,
  promoteTourPipelineName,
  TOUR_PIPELINE_PREFIX,
} from "./tourPipelineLifecycle";
import {
  computeDefaultPopoverPosition,
  POPOVER_STYLES,
  PopoverClampBridge,
  renderNextButton,
} from "./tourPopover";
import { waitForSelector } from "./waitForSelector";

const EDITOR_LAYOUT_ID = "editor";

interface TourContextValue {
  startTour: (tourId: string) => Promise<void>;
  resumeTour: () => Promise<void>;
  dismissPausedTour: () => Promise<void>;
  pausedTour: PausedTourState | null;
}

const TourContext = createContext<TourContextValue | null>(null);

function TourOrchestrator({ children }: { children: ReactNode }) {
  const { setSteps, setCurrentStep, setIsOpen, currentStep, isOpen } =
    useTour();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const storage = usePipelineStorage();

  const activeTourIdRef = useRef<string | null>(null);
  const tempPipelineNameRef = useRef<string | null>(null);
  const tempPipelineFileIdRef = useRef<string | null>(null);
  const lastStepRef = useRef(0);

  const [pausedTour, setPausedTour] = useState<PausedTourState | null>(() =>
    readPausedTour(),
  );

  // Track current step so we can save it if the tour is interrupted.
  useEffect(() => {
    lastStepRef.current = currentStep;
  }, [currentStep]);

  // If the user navigates away from the page the tour expects to be on
  // (e.g. hits the browser back button while the editor tour is running),
  // close the tour so the popover doesn't strand on the new route.
  // `TourCloseListener` then runs `handleBeforeClose`, which saves the paused
  // state so the user can resume from the floating button later.
  useEffect(() => {
    if (!isOpen) return;
    const tourId = activeTourIdRef.current;
    if (!tourId) return;
    const tour = getTour(tourId);
    if (!tour) return;
    if (tour.requiresEditor && !pathname.startsWith(APP_ROUTES.EDITOR_V2)) {
      setIsOpen(false);
    }
  }, [pathname, isOpen, setIsOpen]);

  useEffect(() => {
    const paused = readPausedTour();
    setPausedTour(paused);
    cleanupOrphanTourPipelines(storage, paused?.pipelineName ?? null);
    restoreLayout(EDITOR_LAYOUT_ID);
  }, [storage]);

  const startTour = async (tourId: string) => {
    const tour = getTour(tourId);
    if (!tour) {
      console.warn(`Unknown tour: ${tourId}`);
      return;
    }

    // Starting a new tour discards any previous paused state and its
    // associated pipeline.
    const previousPaused = readPausedTour();
    if (previousPaused?.pipelineName) {
      await deleteTourPipelineByName(storage, previousPaused.pipelineName);
    }
    writePausedTour(null);
    setPausedTour(null);

    activeTourIdRef.current = tourId;
    finishingSignal.reset();

    if (tour.requiresEditor && !pathname.startsWith(APP_ROUTES.EDITOR_V2)) {
      if (tempPipelineNameRef.current) {
        await deleteTourPipelineByName(storage, tempPipelineNameRef.current);
        tempPipelineNameRef.current = null;
        tempPipelineFileIdRef.current = null;
      }

      const words = (generate(3) as string[]).join("-");
      const name = `${TOUR_PIPELINE_PREFIX}${words}`;
      const yamlContent = await buildTourPipelineYaml(tour, name);
      const file = await storage.rootFolder.addFile(name, yamlContent);
      tempPipelineNameRef.current = name;
      tempPipelineFileIdRef.current = file.id;

      snapshotLayout(EDITOR_LAYOUT_ID);

      await navigate({
        to: APP_ROUTES.EDITOR_V2_PIPELINE,
        params: { pipelineName: name },
        search: { fileId: file.id },
      });
    }

    if (tour.requiresEditor) {
      await waitForSelector('[data-testid="editor-v2"]');
    } else {
      const firstSelector = tour.steps[0]?.selector;
      if (typeof firstSelector === "string") {
        await waitForSelector(firstSelector);
      }
    }

    setSteps?.(tour.steps);
    setCurrentStep(0);
    setIsOpen(true);
  };

  const resumeTour = async () => {
    const paused = readPausedTour();
    if (!paused) return;
    const tour = getTour(paused.tourId);
    if (!tour) {
      writePausedTour(null);
      setPausedTour(null);
      return;
    }

    activeTourIdRef.current = paused.tourId;
    finishingSignal.reset();
    tempPipelineNameRef.current = paused.pipelineName ?? null;
    tempPipelineFileIdRef.current = paused.fileId ?? null;

    if (
      tour.requiresEditor &&
      paused.pipelineName &&
      (!pathname.startsWith(APP_ROUTES.EDITOR_V2) ||
        !pathname.includes(paused.pipelineName))
    ) {
      snapshotLayout(EDITOR_LAYOUT_ID);
      await navigate({
        to: APP_ROUTES.EDITOR_V2_PIPELINE,
        params: { pipelineName: paused.pipelineName },
        search: paused.fileId ? { fileId: paused.fileId } : {},
      });
    }

    if (tour.requiresEditor) {
      await waitForSelector('[data-testid="editor-v2"]');
    }

    setSteps?.(tour.steps);
    const safeStep = Math.min(
      Math.max(0, paused.step),
      Math.max(0, tour.steps.length - 1),
    );
    setCurrentStep(safeStep);
    setIsOpen(true);
  };

  const dismissPausedTour = async () => {
    const paused = readPausedTour();
    writePausedTour(null);
    setPausedTour(null);
    if (paused?.pipelineName) {
      await deleteTourPipelineByName(storage, paused.pipelineName);
    }
    tempPipelineNameRef.current = null;
    tempPipelineFileIdRef.current = null;
  };

  const handleBeforeClose = () => {
    restoreLayout(EDITOR_LAYOUT_ID);

    const wasFinishing = finishingSignal.consume();

    const tourId = activeTourIdRef.current;
    const pipelineName = tempPipelineNameRef.current;
    const fileId = tempPipelineFileIdRef.current;
    const step = lastStepRef.current;

    if (wasFinishing) {
      tempPipelineNameRef.current = null;
      tempPipelineFileIdRef.current = null;
      activeTourIdRef.current = null;
      if (pipelineName) deleteTourPipelineByName(storage, pipelineName);
      writePausedTour(null);
      setPausedTour(null);
      return;
    }

    // X / ESC: preserve the pipeline and remember where we left off so the
    // user can resume from the floating button. Promote the `__tour__*` slug
    // to the tour's displayName so the pipeline shows up in lists with a
    // human-readable name. Keep `__tour__` if the user has renamed it
    // themselves during the tour.
    if (tourId) {
      const tour = getTour(tourId);
      const desired = tour?.displayName ?? pipelineName ?? "";

      void (async () => {
        let finalName = pipelineName;

        if (pipelineName && desired) {
          const { newName, renamed } = await promoteTourPipelineName(
            storage,
            pipelineName,
            desired,
          );
          finalName = newName;
          tempPipelineNameRef.current = newName;

          // Update the URL only if the user is still sitting on the tour
          // pipeline's route at this moment — they may have navigated away
          // while the rename was running.
          const livePath = window.location.pathname;
          const stillOnTourPipeline =
            renamed &&
            livePath.startsWith(APP_ROUTES.EDITOR_V2) &&
            livePath.includes(pipelineName);

          if (stillOnTourPipeline) {
            await navigate({
              to: APP_ROUTES.EDITOR_V2_PIPELINE,
              params: { pipelineName: newName },
              search: fileId ? { fileId } : {},
              replace: true,
            });
          }
        }

        const next: PausedTourState = {
          tourId,
          step,
          pipelineName: finalName ?? undefined,
          fileId: fileId ?? undefined,
        };
        writePausedTour(next);
        setPausedTour(next);
      })();
    }
  };

  return (
    <TourContext.Provider
      value={{ startTour, resumeTour, dismissPausedTour, pausedTour }}
    >
      <TourCloseListener onClose={handleBeforeClose} />
      <PopoverClampBridge />
      {children}
    </TourContext.Provider>
  );
}

function TourCloseListener({ onClose }: { onClose: () => void }) {
  const { isOpen } = useTour();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      onClose();
    }
    wasOpen.current = isOpen;
  }, [isOpen, onClose]);

  return null;
}

export function TourProvider({ children }: { children: ReactNode }) {
  return (
    <ReactourProvider
      steps={[]}
      styles={POPOVER_STYLES}
      scrollSmooth
      showBadge
      showCloseButton
      showNavigation
      showPrevNextButtons
      padding={{ mask: 0, popover: 10 }}
      position={computeDefaultPopoverPosition}
      nextButton={renderNextButton}
      onClickMask={() => undefined}
    >
      <TourOrchestrator>{children}</TourOrchestrator>
    </ReactourProvider>
  );
}

export function useTours(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTours must be used within TourProvider");
  }
  return ctx;
}
