import { type TaskNodeContextType } from "@/providers/TaskNodeProvider";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { isSubgraph } from "@/utils/subgraphUtils";

import { ViewYamlButton } from "../Buttons/ViewYamlButton";
import { ActionBlock } from "../ContextPanel/Blocks/ActionBlock";
import { useBetaFlagValue } from "../Settings/useBetaFlags";
import { CopyYamlButton } from "./Actions/CopyYamlButton";
import { DeleteComponentButton } from "./Actions/DeleteComponentButton";
import { DownloadPythonButton } from "./Actions/DownloadPythonButton";
import { DownloadYamlButton } from "./Actions/DownloadYamlButton";
import { DuplicateTaskButton } from "./Actions/DuplicateTaskButton";
import { EditComponentButton } from "./Actions/EditComponentButton";
import { NavigateToSubgraphButton } from "./Actions/NavigateToSubgraphButton";
import { UpgradeTaskButton } from "./Actions/UpgradeTaskButton";

interface TaskActionsProps {
  componentRef: HydratedComponentReference;
  taskNode?: TaskNodeContextType;
  readOnly?: boolean;
  className?: string;
}

const TaskActions = ({
  componentRef,
  taskNode,
  readOnly = false,
  className,
}: TaskActionsProps) => {
  const isInAppEditorEnabled = useBetaFlagValue("in-app-component-editor");

  const { taskId, taskSpec, state, callbacks } = taskNode || {};
  const { onDuplicate, onUpgrade, onDelete } = callbacks || {};
  const isCustomComponent = state?.isCustomComponent;

  const isSubgraphNode = taskSpec ? isSubgraph(taskSpec) : false;

  const pythonOriginalCode =
    componentRef.spec.metadata?.annotations?.python_original_code;

  // Task Actions
  const downloadYaml = <DownloadYamlButton componentRef={componentRef} />;
  const downloadPython = pythonOriginalCode && (
    <DownloadPythonButton componentRef={componentRef} />
  );
  const copyYaml = <CopyYamlButton componentRef={componentRef} />;
  const viewYaml = <ViewYamlButton componentRef={componentRef} />;
  const editComponent = isInAppEditorEnabled && !readOnly && (
    <EditComponentButton componentRef={componentRef} />
  );

  // Canvas Actions
  const duplicateTask = onDuplicate && !readOnly && (
    <DuplicateTaskButton onDuplicate={onDuplicate} />
  );
  const upgradeTask = onUpgrade && !isCustomComponent && !readOnly && (
    <UpgradeTaskButton onUpgrade={onUpgrade} />
  );
  const navigateToSubgraph = isSubgraphNode && taskId && !readOnly && (
    <NavigateToSubgraphButton taskId={taskId} />
  );
  const deleteComponent = onDelete && !readOnly && (
    <DeleteComponentButton onDelete={onDelete} />
  );

  const actions = [
    downloadYaml,
    downloadPython,
    copyYaml,
    viewYaml,
    editComponent,
    duplicateTask,
    upgradeTask,
    navigateToSubgraph,
    deleteComponent,
  ].filter(Boolean);

  return <ActionBlock actions={actions} className={className} />;
};

export default TaskActions;
