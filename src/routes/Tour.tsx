import { useTour } from "@reactour/tour";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { generate } from "random-words";
import { useEffect, useRef, useState } from "react";

import {
  getTour,
  type TourDefinition,
} from "@/components/Learn/tours/registry";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { TourModeProvider } from "@/providers/TourProvider/TourModeContext";
import {
  buildTourPipelineYaml,
  cleanupOrphanTourPipelines,
  deleteTourPipelineByName,
  TOUR_PIPELINE_PREFIX,
} from "@/providers/TourProvider/tourPipelineLifecycle";
import { waitForSelector } from "@/providers/TourProvider/waitForSelector";
import { APP_ROUTES } from "@/routes/router";
import { EditorV2 } from "@/routes/v2/pages/Editor/EditorV2";
import {
  restoreLayout,
  snapshotLayout,
} from "@/routes/v2/shared/windows/windowPersistence";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

const EDITOR_LAYOUT_ID = "editor";

interface ResolvedPipeline {
  name: string;
  fileId: string;
}

/**
 * Always creates a fresh temp pipeline for the tour. Any pre-existing
 * `__tour__*` pipelines are deleted first — tours have no save state, so
 * leftover ones (from closed tabs, crashes, or strict-mode double-mounts)
 * are always orphans.
 */
async function createTourPipeline(
  tour: TourDefinition,
  storage: PipelineStorageService,
): Promise<ResolvedPipeline> {
  await cleanupOrphanTourPipelines(storage);

  const slug = (generate(3) as string[]).join("-");
  const name = `${TOUR_PIPELINE_PREFIX}${slug}`;
  const yamlContent = await buildTourPipelineYaml(tour, name);
  const file = await storage.rootFolder.addFile(name, yamlContent);

  return { name, fileId: file.id };
}

function LoadingState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 select-none min-h-[50vh]">
      <InlineStack gap="2" blockAlign="center">
        <Spinner />
        <Text>Preparing tour…</Text>
      </InlineStack>
    </div>
  );
}

/**
 * Bridges the URL's `?step=N` and reactour's internal `currentStep` so
 * either side can drive the other. Mounted only after the temp pipeline
 * is ready so reactour doesn't try to highlight elements before the
 * editor has mounted.
 */
function TourReactourBridge({
  tour,
  urlStep,
  onUrlStepChange,
}: {
  tour: TourDefinition;
  urlStep: number;
  onUrlStepChange: (step: number) => void;
}) {
  const { setSteps, setCurrentStep, setIsOpen, currentStep } = useTour();

  const lastSyncRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Defer reactour activation until the editor has actually mounted —
  // step selectors target editor DOM, and reactour silently no-ops when
  // they're missing at open time.
  useEffect(() => {
    if (initializedRef.current) return;
    let cancelled = false;
    void waitForSelector('[data-testid="editor-v2"]').then(() => {
      if (cancelled || initializedRef.current) return;
      initializedRef.current = true;

      setSteps?.(tour.steps);
      const clamped = Math.min(Math.max(0, urlStep), tour.steps.length - 1);
      setCurrentStep(clamped);
      lastSyncRef.current = clamped;
      setIsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tour, urlStep, setSteps, setCurrentStep, setIsOpen]);

  // Close reactour when the route unmounts so the popover doesn't strand
  // over whatever page the user navigated to.
  useEffect(() => {
    return () => {
      setIsOpen(false);
    };
  }, [setIsOpen]);

  // URL → reactour: browser back/forward, deep-link tweaks. Guarded so it
  // doesn't fight the reactour-driven update below.
  useEffect(() => {
    if (!initializedRef.current) return;
    if (urlStep === lastSyncRef.current) return;
    lastSyncRef.current = urlStep;
    const clamped = Math.min(Math.max(0, urlStep), tour.steps.length - 1);
    setCurrentStep(clamped);
  }, [urlStep, tour.steps.length, setCurrentStep]);

  // Reactour → URL: Next / Previous clicks. `replace: true` keeps history
  // tidy (no entry per step click).
  useEffect(() => {
    if (!initializedRef.current) return;
    if (currentStep === lastSyncRef.current) return;
    lastSyncRef.current = currentStep;
    onUrlStepChange(currentStep);
  }, [currentStep, onUrlStepChange]);

  return null;
}

export function TourPage() {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const storage = usePipelineStorage();

  const tourId =
    "tourId" in params && typeof params.tourId === "string"
      ? params.tourId
      : "";

  const tour = getTour(tourId);

  const [resolved, setResolved] = useState<ResolvedPipeline | null>(null);

  // Tracked via ref (not state) so the unmount cleanup closure can always
  // read the latest pipeline name — even when state updates are batched or
  // when strict-mode mounts the component twice.
  const tempPipelineRef = useRef<string | null>(null);
  const promotedRef = useRef(false);

  // Snapshot the editor's saved layout so the tour boots with defaults.
  // Restored on unmount regardless of how the user leaves.
  useEffect(() => {
    if (!tour) return;
    snapshotLayout(EDITOR_LAYOUT_ID);
    return () => {
      restoreLayout(EDITOR_LAYOUT_ID);
    };
  }, [tour]);

  // Create the temp pipeline. Always fresh — tours have no save state.
  // The async flow is structured so that if the effect is cancelled
  // mid-flight (strict-mode unmount, navigation away) we delete the
  // pipeline we just created instead of orphaning it.
  useEffect(() => {
    if (!tour) return undefined;
    let cancelled = false;
    void (async () => {
      let created: ResolvedPipeline | null = null;
      try {
        created = await createTourPipeline(tour, storage);
      } catch (error) {
        console.warn("Failed to create tour pipeline:", error);
        return;
      }
      if (cancelled) {
        await deleteTourPipelineByName(storage, created.name);
        return;
      }
      tempPipelineRef.current = created.name;
      setResolved(created);
    })();
    return () => {
      cancelled = true;
    };
  }, [tour, storage]);

  // Delete the temp pipeline on unmount unless it was promoted to a real
  // pipeline via "Save as new pipeline".
  useEffect(() => {
    return () => {
      if (promotedRef.current) return;
      const name = tempPipelineRef.current;
      if (!name) return;
      tempPipelineRef.current = null;
      void deleteTourPipelineByName(storage, name);
    };
  }, [storage]);

  const handleUrlStepChange = (step: number) => {
    void navigate({
      to: APP_ROUTES.TOUR_DETAIL,
      params: { tourId },
      search: { step },
      replace: true,
    });
  };

  const markPipelinePromoted = () => {
    promotedRef.current = true;
  };

  if (!tour) {
    return <Navigate to={APP_ROUTES.LEARN_TOURS} replace />;
  }

  if (!resolved) {
    return <LoadingState />;
  }

  const rawStep = (search as { step?: unknown }).step;
  const parsedStep =
    typeof rawStep === "number"
      ? rawStep
      : typeof rawStep === "string"
        ? Number.parseInt(rawStep, 10)
        : 0;
  const urlStep = Number.isFinite(parsedStep) ? parsedStep : 0;

  return (
    <TourModeProvider
      value={{
        tour,
        tempPipelineName: resolved.name,
        markPipelinePromoted,
      }}
    >
      <TourReactourBridge
        tour={tour}
        urlStep={urlStep}
        onUrlStepChange={handleUrlStepChange}
      />
      <EditorV2
        pipelineRef={{ name: resolved.name, fileId: resolved.fileId }}
      />
    </TourModeProvider>
  );
}
