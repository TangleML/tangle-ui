import type { Node } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InputDialog } from "@/components/shared/Dialogs/InputDialog";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { getUniqueTaskName, validateTaskName } from "@/utils/unique";

import { NodesList } from "./NodesList";
import { canGroupNodes } from "./utils";

interface NewSubgraphDialogProps {
  open: boolean;
  selectedNodes: Node[];
  currentSubgraphSpec: ComponentSpec;
  onClose: () => void;
  onCreateSubgraph: (filteredNodes: Node[], name: string) => void;
}

const DEFAULT_SUBGRAPH_NAME = "New Subgraph";

export const NewSubgraphDialog = ({
  open,
  selectedNodes,
  currentSubgraphSpec,
  onClose,
  onCreateSubgraph,
}: NewSubgraphDialogProps) => {
  const isSubgraphNavigationEnabled = useBetaFlagValue("subgraph-navigation");

  const [defaultName, setDefaultName] = useState("");

  const canGroup = canGroupNodes(selectedNodes, isSubgraphNavigationEnabled);

  const dialogContent = useMemo(
    () => (
      <NodesList
        nodes={selectedNodes}
        title={`Nodes being grouped (${selectedNodes.length})`}
      />
    ),
    [selectedNodes],
  );

  const handleConfirm = useCallback(
    (name: string) => {
      onCreateSubgraph(selectedNodes, name.trim());
      onClose();
    },
    [selectedNodes, onCreateSubgraph, onClose],
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const validate = useCallback(
    (value: string) => {
      if (isGraphImplementation(currentSubgraphSpec.implementation)) {
        return validateTaskName(
          value.trim(),
          currentSubgraphSpec.implementation.graph,
          true,
        );
      }
      return null;
    },
    [currentSubgraphSpec],
  );

  useEffect(() => {
    if (open) {
      let name = DEFAULT_SUBGRAPH_NAME;
      if (isGraphImplementation(currentSubgraphSpec.implementation)) {
        name = getUniqueTaskName(
          currentSubgraphSpec.implementation.graph,
          DEFAULT_SUBGRAPH_NAME,
        );
      }
      setDefaultName(name);
    }
  }, [open, currentSubgraphSpec]);

  const disabled = !canGroup;

  return (
    <InputDialog
      isOpen={open}
      title="Create Subgraph"
      description="Enter subgraph name"
      placeholder="Enter subgraph name"
      defaultValue={defaultName}
      content={dialogContent}
      disabled={disabled}
      validate={validate}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
};
