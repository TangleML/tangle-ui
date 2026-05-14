import { NodeToolbar, useReactFlow } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import type { ComponentSpec } from "@/models/componentSpec";
import { getSelectedEdgesFromInstance } from "@/routes/v2/pages/Editor/components/FlowCanvas/canvasDeleteSelection";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { SelectionToolbar } from "./SelectionToolbar";

export const FloatingSelectionToolbar = observer(
  function FloatingSelectionToolbar({ spec }: { spec: ComponentSpec | null }) {
    const { editor } = useSharedStores();
    const { duplicateSelectedNodes, copySelectedNodes } = useTaskActions();
    const { createSubgraph } = usePipelineActions();
    const { multiSelection } = editor;
    const reactFlow = useReactFlow();

    if (multiSelection.length <= 1) return null;

    const nodeIds = multiSelection.map((n) => n.id);

    const handleDuplicate = () => {
      if (!spec) return;
      duplicateSelectedNodes(spec, multiSelection);
    };

    const handleCopy = () => {
      if (!spec) return;
      copySelectedNodes(spec, multiSelection);
    };

    const handleDelete = () => {
      if (!spec || !reactFlow.viewportInitialized) return;
      const selectedEdges = getSelectedEdgesFromInstance(reactFlow);
      void reactFlow.deleteElements({
        nodes: multiSelection.map((n) => ({ id: n.id })),
        edges: selectedEdges.map((e) => ({ id: e.id })),
      });
    };

    const selectedTasks = multiSelection.filter((n) => n.type === "task");

    const handleCreateSubgraph = (name: string) => {
      if (!spec || selectedTasks.length === 0) return;
      const taskIds = selectedTasks.map((n) => n.id);
      const centerX =
        selectedTasks.reduce((sum, n) => sum + n.position.x, 0) /
        selectedTasks.length;
      const centerY =
        selectedTasks.reduce((sum, n) => sum + n.position.y, 0) /
        selectedTasks.length;
      createSubgraph(spec, taskIds, name, { x: centerX, y: centerY });
    };

    return (
      <NodeToolbar
        nodeId={nodeIds}
        isVisible
        offset={0}
        align="end"
        className="z-50"
      >
        <SelectionToolbar
          onDuplicate={handleDuplicate}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onCreateSubgraph={handleCreateSubgraph}
          selectedTaskCount={selectedTasks.length}
        />
      </NodeToolbar>
    );
  },
);
