import { useCancelPipelineRun } from "@/routes/v2/pages/RunView/hooks/useCancelPipelineRun";
import { useClonePipelineRun } from "@/routes/v2/pages/RunView/hooks/useClonePipelineRun";
import { useExportPipelineYaml } from "@/routes/v2/pages/RunView/hooks/useExportPipelineYaml";
import { useInspectPipeline } from "@/routes/v2/pages/RunView/hooks/useInspectPipeline";
import { useRerunPipelineRun } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { useYamlViewer } from "@/routes/v2/pages/RunView/hooks/useYamlViewer";

export function useRunMenuActions() {
  const actions = useRunViewActions();
  const componentSpec = actions.ready ? actions.componentSpec : undefined;
  const runId = actions.ready ? actions.runId : undefined;
  const pipelineName = actions.ready ? actions.pipelineName : undefined;

  const { yamlViewerOpen, openYamlViewer, closeYamlViewer } = useYamlViewer();
  const { clone, isCloning } = useClonePipelineRun(componentSpec, runId);
  const { rerun, isRerunning } = useRerunPipelineRun(componentSpec);
  const {
    cancelDialogOpen,
    isCancelling,
    requestCancel,
    confirmCancel,
    dismissCancel,
  } = useCancelPipelineRun(runId);
  const { inspect } = useInspectPipeline(pipelineName);
  const { exportYaml } = useExportPipelineYaml(componentSpec, pipelineName);

  return {
    actions,
    yamlViewerOpen,
    cancelDialogOpen,
    isCloning,
    isCancelling,
    isRerunning,
    openYamlViewer,
    closeYamlViewer,
    requestCancel,
    dismissCancel,
    handleInspect: inspect,
    handleClone: clone,
    confirmCancel,
    handleRerun: rerun,
    handleExportYaml: exportYaml,
  };
}
