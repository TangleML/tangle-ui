import type { Node } from "@xyflow/react";
import { useState } from "react";
import { useSnapshot } from "valtio";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";

import { createSubgraph } from "../store/actions";
import { editorStore } from "../store/editorStore";

interface SelectionToolbarProps {
  selectedNodes: Node[];
  onSubgraphCreated?: () => void;
}

export function SelectionToolbar({
  selectedNodes,
  onSubgraphCreated,
}: SelectionToolbarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [subgraphName, setSubgraphName] = useState("");

  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  // Filter to only task nodes
  const selectedTaskNodes = selectedNodes.filter(
    (node) => node.type === "task",
  );

  // Only show toolbar if multiple task nodes are selected
  if (selectedTaskNodes.length < 2) {
    return null;
  }

  // Get task names from entity IDs (for display and createSubgraph)
  const getTaskName = (entityId: string): string => {
    if (
      !spec?.implementation ||
      !(spec.implementation instanceof GraphImplementation)
    ) {
      return entityId;
    }
    const task = spec.implementation.tasks.entities[entityId];
    return task?.name ?? entityId;
  };

  const handleOpenDialog = () => {
    setSubgraphName(`Subgraph (${selectedTaskNodes.length} tasks)`);
    setIsDialogOpen(true);
  };

  const handleCreateSubgraph = () => {
    if (!subgraphName.trim()) return;

    // Get task names from entity IDs
    const taskNames = selectedTaskNodes.map((node) => getTaskName(node.id));

    // Calculate center position of selected nodes
    const positions = selectedTaskNodes.map((node) => node.position);
    const centerX =
      positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
    const centerY =
      positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;

    const result = createSubgraph(taskNames, subgraphName.trim(), {
      x: centerX,
      y: centerY,
    });

    if (result) {
      setIsDialogOpen(false);
      setSubgraphName("");
      onSubgraphCreated?.();
    }
  };

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <InlineStack
          gap="3"
          className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-2.5"
        >
          <InlineStack gap="2" blockAlign="center">
            <Icon name="Airplay" size="sm" className="text-blue-500" />
            <Text size="sm" weight="semibold" className="text-slate-700">
              {selectedTaskNodes.length} tasks selected
            </Text>
          </InlineStack>

          <div className="w-px h-6 bg-slate-200" />

          <Button
            variant="default"
            size="sm"
            onClick={handleOpenDialog}
            className="gap-1.5"
          >
            <Icon name="FolderInput" size="sm" />
            Create Subgraph
          </Button>
        </InlineStack>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Subgraph</DialogTitle>
            <DialogDescription>
              Group {selectedTaskNodes.length} selected tasks into a reusable
              subgraph component.
            </DialogDescription>
          </DialogHeader>

          <BlockStack gap="4" className="py-4">
            <BlockStack gap="2">
              <Label htmlFor="subgraph-name">Subgraph Name</Label>
              <Input
                id="subgraph-name"
                value={subgraphName}
                onChange={(e) => setSubgraphName(e.target.value)}
                placeholder="Enter subgraph name..."
                autoFocus
              />
            </BlockStack>

            <BlockStack gap="2">
              <Label>Tasks to Include</Label>
              <BlockStack gap="1" className="max-h-40 overflow-y-auto">
                {selectedTaskNodes.map((node) => (
                  <InlineStack
                    key={node.id}
                    gap="2"
                    className="text-xs py-1.5 px-2 bg-slate-50 rounded"
                  >
                    <Icon
                      name="Workflow"
                      size="xs"
                      className="text-blue-500 shrink-0"
                    />
                    <Text size="xs" className="text-slate-700 truncate">
                      {getTaskName(node.id)}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </BlockStack>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubgraph}
              disabled={!subgraphName.trim()}
            >
              Create Subgraph
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
