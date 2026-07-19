import { observer } from "mobx-react-lite";

import { CancelPipelineRunButton } from "@/components/PipelineRun/components/CancelPipelineRunButton";
import { ClonePipelineButton } from "@/components/PipelineRun/components/ClonePipelineButton";
import { InspectPipelineButton } from "@/components/PipelineRun/components/InspectPipelineButton";
import { RerunPipelineButton } from "@/components/PipelineRun/components/RerunPipelineButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useRunViewActions } from "@/routes/v2/pages/RunView/hooks/useRunViewActions";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { tracking } from "@/utils/tracking";

const RUN_TOOL_CLASS_NAME =
  "h-10 w-full justify-start gap-3 border-transparent bg-transparent px-3 shadow-none hover:border-border hover:bg-muted";
const RUN_TOOL_WRAPPER_CLASS_NAME = "w-full";

const ROW_TOOL_CLASS_NAME =
  "h-10 justify-start gap-3 px-3 shadow-none hover:border-border hover:bg-muted";
const ROW_TOOL_WRAPPER_CLASS_NAME = "shrink-0";

export const RunToolsContent = observer(function RunToolsContent() {
  const actions = useRunViewActions();
  const windowContext = useOptionalWindowContext();
  const isFloatingPanel =
    windowContext?.model.variant === "panel" &&
    windowContext.model.dockState === "none";

  if (!actions.ready) return null;

  const {
    componentSpec,
    runId,
    canAccessEditorSpec,
    isRunCreator,
    isInProgress,
    isComplete,
    pipelineName,
  } = actions;

  const toolClassName = isFloatingPanel
    ? ROW_TOOL_CLASS_NAME
    : RUN_TOOL_CLASS_NAME;
  const wrapperClassName = isFloatingPanel
    ? ROW_TOOL_WRAPPER_CLASS_NAME
    : RUN_TOOL_WRAPPER_CLASS_NAME;

  const tools = (
    <>
      <ViewYamlButton
        componentSpec={componentSpec}
        displayLabel="View YAML"
        showTooltip={false}
        className={toolClassName}
        wrapperClassName={wrapperClassName}
        {...tracking("v2.run_view.tools.view_yaml")}
      />

      {canAccessEditorSpec && pipelineName && (
        <InspectPipelineButton
          pipelineName={pipelineName}
          displayLabel="Inspect pipeline"
          showTooltip={false}
          className={toolClassName}
          wrapperClassName={wrapperClassName}
          {...tracking("v2.run_view.tools.inspect_pipeline")}
        />
      )}

      <ClonePipelineButton
        componentSpec={componentSpec}
        runId={runId}
        displayLabel="Clone pipeline"
        showTooltip={false}
        className={toolClassName}
        wrapperClassName={wrapperClassName}
        {...tracking("v2.run_view.tools.clone_pipeline")}
      />

      {isInProgress && isRunCreator && (
        <CancelPipelineRunButton
          runId={runId}
          displayLabel="Cancel run"
          showTooltip={false}
          className={`${toolClassName} text-destructive hover:text-destructive`}
          wrapperClassName={wrapperClassName}
          {...tracking("v2.run_view.tools.cancel_run")}
        />
      )}

      {isComplete && (
        <RerunPipelineButton
          componentSpec={componentSpec}
          displayLabel="Rerun pipeline"
          showTooltip={false}
          className={toolClassName}
          wrapperClassName={wrapperClassName}
          {...tracking("v2.run_view.tools.rerun_pipeline")}
        />
      )}
    </>
  );

  if (isFloatingPanel) {
    return (
      <InlineStack
        gap="1"
        wrap="nowrap"
        blockAlign="center"
        className="p-2 bg-background rounded-md border"
      >
        {tools}
      </InlineStack>
    );
  }

  return (
    <BlockStack gap="1" className="p-2">
      {tools}
    </BlockStack>
  );
});
