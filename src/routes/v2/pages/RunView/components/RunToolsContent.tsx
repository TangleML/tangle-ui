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
  "h-10 w-48 justify-start gap-3 border-transparent bg-transparent px-3 shadow-none hover:border-border hover:bg-muted";
const RUN_TOOL_WRAPPER_CLASS_NAME = "w-fit";

const CANCEL_TOOL_CLASS_NAME =
  "text-destructive hover:text-destructive dark:text-red-400 dark:hover:text-red-400 border-destructive/50 dark:border-red-400/30 hover:bg-destructive/10 dark:hover:bg-red-400/10";

const ROW_TOOL_CLASS_NAME =
  "h-10 justify-start gap-3 px-3 shadow-none hover:border-border hover:bg-muted border";
const ROW_TOOL_WRAPPER_CLASS_NAME = "shrink-0";

const RAIL_TOOL_CLASS_NAME = "size-8 shrink-0 p-0";

interface RunToolsContentProps {
  /**
   * "rail" renders a compact vertical strip of icon-only actions, used when the
   * dock area is collapsed. Defaults to the labelled panel/stack layout.
   */
  layout?: "rail";
}

export const RunToolsContent = observer(function RunToolsContent({
  layout,
}: RunToolsContentProps) {
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

  if (layout === "rail") {
    return (
      <BlockStack gap="1" align="center" className="w-full">
        <ViewYamlButton
          componentSpec={componentSpec}
          aria-label="View YAML"
          className={RAIL_TOOL_CLASS_NAME}
          tooltipSide="right"
          {...tracking("v2.run_view.tools.view_yaml")}
        />

        {canAccessEditorSpec && pipelineName && (
          <InspectPipelineButton
            pipelineName={pipelineName}
            aria-label="Inspect pipeline"
            className={RAIL_TOOL_CLASS_NAME}
            tooltipSide="right"
            {...tracking("v2.run_view.tools.inspect_pipeline")}
          />
        )}

        <ClonePipelineButton
          componentSpec={componentSpec}
          runId={runId}
          aria-label="Clone pipeline"
          className={RAIL_TOOL_CLASS_NAME}
          tooltipSide="right"
          {...tracking("v2.run_view.tools.clone_pipeline")}
        />

        {isInProgress && isRunCreator && (
          <CancelPipelineRunButton
            runId={runId}
            aria-label="Cancel run"
            className={`${RAIL_TOOL_CLASS_NAME} bg-transparent ${CANCEL_TOOL_CLASS_NAME}`}
            tooltipSide="right"
            {...tracking("v2.run_view.tools.cancel_run")}
          />
        )}

        {isComplete && (
          <RerunPipelineButton
            componentSpec={componentSpec}
            aria-label="Rerun pipeline"
            className={RAIL_TOOL_CLASS_NAME}
            tooltipSide="right"
            {...tracking("v2.run_view.tools.rerun_pipeline")}
          />
        )}
      </BlockStack>
    );
  }

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
          className={`${toolClassName} bg-transparent ${CANCEL_TOOL_CLASS_NAME}`}
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
