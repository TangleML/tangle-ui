import { observer } from "mobx-react-lite";

import { QuickRunButton } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/QuickRunButton";

export const RunsAndSubmissionWindowMiniContent = observer(
  function RunsAndSubmissionWindowMiniContent() {
    return (
      <QuickRunButton
        variant="mini"
        tooltipSide="right"
        trackingKey="v2.pipeline_editor.quick_run_mini"
        onPointerDown={(event) => event.stopPropagation()}
      />
    );
  },
);
