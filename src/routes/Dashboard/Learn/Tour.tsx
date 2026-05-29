import { useTour } from "@reactour/tour";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  getTour,
  type TourDefinition,
} from "@/components/Learn/tours/registry";
import { TourContent } from "@/providers/TourProvider/TourContent";
import { TourModeProvider } from "@/providers/TourProvider/TourModeContext";
import {
  buildTourPipelineYaml,
  TOUR_PIPELINE_PREFIX,
} from "@/providers/TourProvider/tourPipelineLifecycle";
import { TourPipelineStorageProvider } from "@/providers/TourProvider/tourPipelineStorage/TourPipelineStorageProvider";
import { TourCompletionActions } from "@/providers/TourProvider/TourPopover";
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

function tourPipelineName(tour: TourDefinition): string {
  return `${TOUR_PIPELINE_PREFIX}${tour.id}`;
}

async function findOrCreateTourPipeline(
  tour: TourDefinition,
  storage: PipelineStorageService,
): Promise<ResolvedPipeline> {
  const name = tourPipelineName(tour);
  const existing = await storage.resolvePipelineByName(name);

  if (existing) {
    return { name, fileId: existing.id };
  }

  const yamlContent = await buildTourPipelineYaml(tour, name);
  const file = await storage.rootFolder.addFile(name, yamlContent);

  return { name, fileId: file.id };
}

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

  // Reactour silently no-ops if step selectors aren't in the DOM at open time.
  useEffect(() => {
    if (initializedRef.current) return;
    let cancelled = false;
    void waitForSelector('[data-testid="editor-v2"]').then(() => {
      if (cancelled || initializedRef.current) return;
      initializedRef.current = true;

      const lastIdx = tour.steps.length - 1;
      const stepsWithMarkdown = tour.steps.map((step, idx) => {
        const normalized =
          typeof step.content === "string"
            ? { ...step, content: <TourContent text={step.content} /> }
            : step;
        if (idx !== lastIdx || typeof normalized.content === "function") {
          return normalized;
        }
        return {
          ...normalized,
          content: (
            <>
              {normalized.content}
              <br />
              <TourCompletionActions />
            </>
          ),
        };
      });
      setSteps?.(stepsWithMarkdown);

      const clamped = Math.min(Math.max(0, urlStep), tour.steps.length - 1);
      setCurrentStep(clamped);
      lastSyncRef.current = clamped;
      setIsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tour, urlStep, setSteps, setCurrentStep, setIsOpen]);

  useEffect(() => {
    return () => {
      setIsOpen(false);
    };
  }, [setIsOpen]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (urlStep === lastSyncRef.current) return;
    lastSyncRef.current = urlStep;
    const clamped = Math.min(Math.max(0, urlStep), tour.steps.length - 1);
    setCurrentStep(clamped);
  }, [urlStep, tour.steps.length, setCurrentStep]);

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
  const tourId =
    "tourId" in params && typeof params.tourId === "string"
      ? params.tourId
      : "";
  const tour = getTour(tourId);

  if (!tour) {
    return <Navigate to={APP_ROUTES.LEARN_TOURS} replace />;
  }

  return (
    <TourPipelineStorageProvider>
      <TourPageBody tour={tour} tourId={tourId} />
    </TourPipelineStorageProvider>
  );
}

function TourPageBody({
  tour,
  tourId,
}: {
  tour: TourDefinition;
  tourId: string;
}) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const storage = usePipelineStorage();
  const [resolved, setResolved] = useState<ResolvedPipeline | null>(null);

  useEffect(() => {
    snapshotLayout(EDITOR_LAYOUT_ID);
    return () => {
      restoreLayout(EDITOR_LAYOUT_ID);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await findOrCreateTourPipeline(tour, storage);
        if (cancelled) return;
        setResolved(result);
      } catch (error) {
        console.warn("Failed to resolve tour pipeline:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tour, storage]);

  const handleUrlStepChange = (step: number) => {
    void navigate({
      to: APP_ROUTES.TOUR_DETAIL,
      params: { tourId },
      search: { step },
      replace: true,
    });
  };

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
        tempPipelineName: resolved?.name ?? tourPipelineName(tour),
      }}
    >
      {resolved && (
        <TourReactourBridge
          tour={tour}
          urlStep={urlStep}
          onUrlStepChange={handleUrlStepChange}
        />
      )}
      <EditorV2
        pipelineRef={
          resolved ? { name: resolved.name, fileId: resolved.fileId } : null
        }
      />
    </TourModeProvider>
  );
}
