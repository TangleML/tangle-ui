import { useState } from "react";

import { InputDialog } from "@/components/shared/Dialogs/InputDialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { isGraphImplementation } from "@/utils/componentSpec";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";
import { validateTaskName } from "@/utils/unique";

interface RenameTaskProps {
  taskId: string;
}

const RenameTask = ({ taskId }: RenameTaskProps) => {
  const { currentSubgraphSpec, currentSubgraphPath, setComponentSpec } =
    useComponentSpec();
  const [isOpen, setIsOpen] = useState(false);

  if (!isGraphImplementation(currentSubgraphSpec.implementation)) {
    return null;
  }

  const currentSubgraphGraphSpec = currentSubgraphSpec.implementation.graph;
  const task = currentSubgraphGraphSpec.tasks[taskId];
  const name = task?.componentRef.spec?.name || "";

  const componentSpec = task?.componentRef.spec;

  const isSubgraph = componentSpec?.implementation
    ? isGraphImplementation(componentSpec?.implementation)
    : false;

  const onConfirm = (newName: string) => {
    const updatedSubgraphSpec = { ...currentSubgraphSpec };

    if (isGraphImplementation(updatedSubgraphSpec.implementation)) {
      const task = updatedSubgraphSpec.implementation.graph.tasks[taskId];

      if (!task?.componentRef.spec) return;

      task.componentRef.spec.name = newName;

      const updatedRootSpec = updateSubgraphSpec(
        currentSubgraphSpec,
        currentSubgraphPath,
        updatedSubgraphSpec,
      );

      setComponentSpec(updatedRootSpec);
    }
    setIsOpen(false);
  };

  const onCancel = () => {
    setIsOpen(false);
  };

  const inputDialogProps = {
    title: isSubgraph ? "Rename Subgraph" : "Rename Task",
    description: `Enter a new name for the ${isSubgraph ? "subgraph" : "task"}: "${taskId}".`,
    placeholder: isSubgraph ? "Subgraph Name" : "Task Name",
    defaultValue: name,
    validate: (value: string) =>
      validateTaskName(value, currentSubgraphGraphSpec),
    onConfirm,
    onCancel,
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="w-fit h-fit p-1 text-gray-500/50"
        variant="ghost"
        size="icon"
      >
        <Icon name="PencilLine" />
      </Button>
      <InputDialog isOpen={isOpen} {...inputDialogProps} />
    </>
  );
};

export default RenameTask;
