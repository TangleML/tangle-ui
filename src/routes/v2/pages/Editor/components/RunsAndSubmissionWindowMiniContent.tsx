import { observer } from "mobx-react-lite";

import { QuickRunButton } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/QuickRunButton";

interface RunsAndSubmissionWindowMiniContentProps {
  renderSubmitter?: boolean;
}

export const RunsAndSubmissionWindowMiniContent = observer(
  function RunsAndSubmissionWindowMiniContent({
    renderSubmitter = false,
  }: RunsAndSubmissionWindowMiniContentProps) {
    return (
      <QuickRunButton
        variant="mini"
        tooltipSide="right"
        renderSubmitter={renderSubmitter}
        trackingKey="v2.pipeline_editor.quick_run_mini"
        onPointerDown={(event) => event.stopPropagation()}
      />
    );
  },
);
