import { MlExperimentPlannerContent } from "@/routes/v2/shared/components/MlExperimentPlanner/MlExperimentPlannerContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const ML_EXPERIMENT_WINDOW_ID = "ml-experiment-planner";

/**
 * Returns an opener that shows the ML Experiment planner window for a run,
 * optionally expanding a specific scenario. Reuses a stable window id so
 * repeated calls update the content and focus the existing window.
 */
export function useMlExperimentPlannerWindow() {
  const { windows } = useSharedStores();

  return (runId: string, selectedScenarioId?: string) =>
    windows.openWindow(
      <MlExperimentPlannerContent
        runId={runId}
        selectedScenarioId={selectedScenarioId}
      />,
      {
        id: ML_EXPERIMENT_WINDOW_ID,
        title: "ML Experiment",
        size: { width: 480, height: 600 },
        startVisible: true,
        persisted: true,
        defaultDockState: "right",
      },
    );
}
