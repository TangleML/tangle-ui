import type { Node } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InputDialog } from "@/components/shared/Dialogs/InputDialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import { BlockStack } from "@/components/ui/layout";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { getUniqueTaskName, validateTaskName } from "@/utils/unique";

import { checkExternalInputConnections } from "./checkExternalInputConnections";
import { checkForOrphanedNodes } from "./checkForOrphanedNodes";
import { ExternalInputConnectionsList } from "./ExternalInputConnectionsList";
import { NodesList } from "./NodesList";
import { OrphanedNodeList } from "./OrphanedNodeList";
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

  const [excludedNodeIds, setExcludedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [defaultName, setDefaultName] = useState("");

  const excludeNode = useCallback((nodeId: string) => {
    setExcludedNodeIds((prev) => new Set(prev).add(nodeId));
  }, []);

  const includeNode = useCallback((nodeId: string) => {
    setExcludedNodeIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  const activeNodes = selectedNodes.filter(
    (node) => !excludedNodeIds.has(node.id),
  );

  // Orphans in the original selection
  const orphanedNodes = useMemo(
    () => checkForOrphanedNodes(selectedNodes, currentSubgraphSpec),
    [selectedNodes, currentSubgraphSpec],
  );

  // Orphans in the current active selection (after user exclusions)
  const activeOrphanedNodes = useMemo(
    () => checkForOrphanedNodes(activeNodes, currentSubgraphSpec),
    [activeNodes, currentSubgraphSpec],
  );

  // Inputs with external connections in the current active selection (after user exclusions)
  const inputsWithExternalConnections = useMemo(
    () => checkExternalInputConnections(activeNodes, currentSubgraphSpec),
    [activeNodes, currentSubgraphSpec],
  );

  const hasActiveOrphans = activeOrphanedNodes.length > 0;

  const { canGroup, errorMessage } = canGroupNodes(
    activeNodes,
    isSubgraphNavigationEnabled,
  );

  const dialogContent = useMemo(() => {
    const allOrphans = orphanedNodes
      .concat(activeOrphanedNodes)
      .filter(
        (node, index, self) =>
          index === self.findIndex((n) => n.id === node.id),
      );

    const allOrphanedNodeIds = new Set(allOrphans.map((node) => node.id));

    return (
      <BlockStack gap="4" className="max-h-9/10">
        <NodesList
          title={`Nodes being grouped (${activeNodes.length} of ${selectedNodes.length})`}
          nodes={selectedNodes}
          excludedNodeIds={excludedNodeIds}
          orphanedNodeIds={allOrphanedNodeIds}
          onExcludeNode={excludeNode}
          onIncludeNode={includeNode}
        />

        {canGroup && hasActiveOrphans && (
          <OrphanedNodeList
            nodes={activeOrphanedNodes}
            excludedNodeIds={excludedNodeIds}
            onExcludeNode={excludeNode}
            onIncludeNode={includeNode}
          />
        )}

        {canGroup && inputsWithExternalConnections.length > 0 && (
          <ExternalInputConnectionsList
            nodes={inputsWithExternalConnections}
            excludedNodeIds={excludedNodeIds}
            onExcludeNode={excludeNode}
            onIncludeNode={includeNode}
          />
        )}

        {!canGroup && errorMessage && (
          <InfoBox title="Cannot Create Subgraph" variant="error" width="full">
            {errorMessage}
          </InfoBox>
        )}
      </BlockStack>
    );
  }, [
    selectedNodes,
    activeNodes,
    orphanedNodes,
    activeOrphanedNodes,
    inputsWithExternalConnections,
    hasActiveOrphans,
    canGroup,
    errorMessage,
    excludedNodeIds,
    excludeNode,
    includeNode,
  ]);

  const handleConfirm = useCallback(
    (name: string) => {
      const submittedNodes = selectedNodes.filter(
        (node) => !excludedNodeIds.has(node.id),
      );
      onCreateSubgraph(submittedNodes, name.trim());
      onClose();
    },
    [selectedNodes, excludedNodeIds, onCreateSubgraph, onClose],
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
      setExcludedNodeIds(new Set());

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

  const disabled = hasActiveOrphans || !canGroup;

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
