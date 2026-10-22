import type { HydratedComponentReference } from "@/utils/componentSpec";
import { tracking } from "@/utils/tracking";

import { LinkNodeButton } from "../Buttons/LinkNodeButton";
import { ViewYamlButton } from "../Buttons/ViewYamlButton";
import { ActionBlock } from "../ContextPanel/Blocks/ActionBlock";
import { CopyYamlButton } from "./Actions/CopyYamlButton";
import { DownloadPythonButton } from "./Actions/DownloadPythonButton";
import { DownloadYamlButton } from "./Actions/DownloadYamlButton";
import { EditComponentButton } from "./Actions/EditComponentButton";

interface TaskActionsProps {
  componentRef: HydratedComponentReference;
  nodeId?: string;
  readOnly?: boolean;
  className?: string;
}

const TaskActions = ({
  componentRef,
  nodeId,
  readOnly = false,
  className,
}: TaskActionsProps) => {
  const pythonOriginalCode =
    componentRef.spec.metadata?.annotations?.python_original_code;

  // Task Actions
  const downloadYaml = <DownloadYamlButton componentRef={componentRef} />;
  const downloadPython = pythonOriginalCode && (
    <DownloadPythonButton componentRef={componentRef} />
  );
  const copyYaml = <CopyYamlButton componentRef={componentRef} />;
  const viewYaml = (
    <ViewYamlButton
      componentRef={componentRef}
      {...tracking("pipeline_editor.task_node.yaml_action", {
        action: "view",
      })}
    />
  );
  const editComponent = !readOnly && (
    <EditComponentButton componentRef={componentRef} />
  );

  // Canvas Actions
  const linkTask = readOnly && nodeId && <LinkNodeButton nodeId={nodeId} />;
  const actions = [
    downloadYaml,
    downloadPython,
    copyYaml,
    viewYaml,
    editComponent,
    linkTask,
  ].filter(Boolean);

  return (
    <ActionBlock
      actions={actions}
      className={className}
      data-testid="task-actions"
    />
  );
};

export default TaskActions;
