import { useTour } from "@reactour/tour";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import * as yaml from "js-yaml";
import { useEffect, useRef, useState } from "react";

import { tours } from "@/components/Learn/tours";
import {
  getTour,
  type TourDefinition,
} from "@/components/Learn/tours/registry";
import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import {
  type ComponentSpec,
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { TourContent } from "@/providers/TourProvider/TourContent";
import { setTourMockActive } from "@/providers/TourProvider/tourMockBackend";
import {
  TourModeProvider,
  type TourModeValue,
  useTourMode,
} from "@/providers/TourProvider/TourModeContext";
import { buildTourPipelineYaml } from "@/providers/TourProvider/tourPipelineLifecycle";
import { TourCompletionActions } from "@/providers/TourProvider/TourPopover";
import { TourTelemetryBridge } from "@/providers/TourProvider/TourTelemetryBridge";
import { APP_ROUTES } from "@/routes/router";
import { Editor } from "@/routes/v2/pages/Editor/Editor";
import {
  clearLayout,
  TOUR_WINDOW_LAYOUT_ID,
} from "@/routes/v2/shared/windows/windowPersistence";
import { createPipelineFromSpec } from "@/services/pipelineStorage/pipelineCreation";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { isRecord } from "@/utils/typeGuards";
import { waitForSelector } from "@/utils/waitForSelector";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

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

  // Reactour silently no-ops if step selectors aren't in the DOM at open time,
  // so wait for the editor to mount (data-editor-ready) before opening.
  useEffect(() => {
    if (initializedRef.current) return undefined;
    const controller = new AbortController();
    void waitForSelector("[data-editor-ready]", {
      signal: controller.signal,
    }).then((found) => {
      if (controller.signal.aborted || initializedRef.current) return;
      if (!found) {
        console.warn("Editor did not become ready in time; tour not opened.");
        return;
      }
      initializedRef.current = true;

      const resolvedSteps = tour.steps;
      const lastIdx = resolvedSteps.length - 1;
      const stepsWithMarkdown = resolvedSteps.map((step, idx) => {
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
    return () => controller.abort();
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
  const navigate = useNavigate();
  const storage = usePipelineStorage();

  const promoteToPipeline: TourModeValue["promoteToPipeline"] = async (
    newName,
    spec,
  ) => {
    const file = await createPipelineFromSpec(storage, newName, spec);
    await navigate({
      to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
      params: { pipelineId: file.id },
    });
  };

  if (!tour) {
    return <Navigate to={APP_ROUTES.LEARN_TOURS} replace />;
  }

  return (
    <TourPageBody
      key={tour.id}
      tour={tour}
      tourId={tourId}
      promoteToPipeline={promoteToPipeline}
    />
  );
}

function TourPageBody({
  tour,
  tourId,
  promoteToPipeline,
}: {
  tour: TourDefinition;
  tourId: string;
  promoteToPipeline: TourModeValue["promoteToPipeline"];
}) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const [resolved, setResolved] = useState<ComponentSpec | null>(null);

  useEffect(() => {
    clearLayout(TOUR_WINDOW_LAYOUT_ID);
    return () => {
      clearLayout(TOUR_WINDOW_LAYOUT_ID);
    };
  }, []);

  useEffect(() => {
    addRecentlyViewed({
      type: "tour",
      id: tourId,
      name:
        tours.find((t) => t.id === tourId)?.title ?? tour.displayName ?? tourId,
    });
  }, [tourId, tour]);

  useEffect(() => {
    setResolved(null);
    let cancelled = false;
    void (async () => {
      try {
        const content = await buildTourPipelineYaml(tour, tour.id);
        const result = new YamlDeserializer(
          new IncrementingIdGenerator(),
        ).deserialize(yaml.load(content, PIPELINE_YAML_LOAD_OPTIONS));
        if (cancelled) return;
        setResolved(result);
      } catch (error) {
        console.warn("Failed to resolve tour pipeline:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tour]);

  const handleUrlStepChange = (step: number) => {
    void navigate({
      to: APP_ROUTES.TOUR_DETAIL,
      params: { tourId },
      search: { step },
      replace: true,
    });
  };

  const rawStep = isRecord(search) ? search.step : undefined;
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
        promoteToPipeline,
      }}
    >
      <TourMockBackendController />
      {resolved && (
        <>
          <TourReactourBridge
            key={`reactour-${tour.id}`}
            tour={tour}
            urlStep={urlStep}
            onUrlStepChange={handleUrlStepChange}
          />
          <TourTelemetryBridge key={`telemetry-${tour.id}`} />
        </>
      )}
      <Editor spec={resolved ?? undefined} />
    </TourModeProvider>
  );
}

function TourMockBackendController() {
  const tourMode = useTourMode();
  const { available } = useBackend();
  const shouldMock = !!tourMode?.tour.mockBackend && !available;

  useEffect(() => {
    setTourMockActive(shouldMock);
  }, [shouldMock]);

  useEffect(() => () => setTourMockActive(false), []);

  return null;
}
