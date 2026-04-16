import { NodeToolbar, useReactFlow } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import type { ComponentSpec } from "@/models/componentSpec";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { SelectionToolbar } from "./SelectionToolbar";

export const FloatingSelectionToolbar = observer(
  function FloatingSelectionToolbar({ spec }: { spec: ComponentSpec | null }) {
    const { editor } = useSharedStores();
    const {
      duplicateSelectedNodes,
      copySelectedNodes,
      pasteNodes,
      deleteSelectedNodes,
    } = useTaskActions();
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

    const handlePaste = () => {
      if (!spec) return;
      const viewport = reactFlow.getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      void pasteNodes(spec, { x: centerX, y: centerY });
    };

    const handleDelete = () => {
      if (!spec) return;
      deleteSelectedNodes(spec, multiSelection);
    };

    const selectedTasks = multiSelection.filter((n) => n.type === "task");

    const handleCreateSubgraph = (name: string) => {
      if (!spec) return;
      const taskIds = selectedTasks.map((n) => n.id);
      if (taskIds.length === 0) return;
      const viewport = reactFlow.getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
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
          onPaste={handlePaste}
          onDelete={handleDelete}
          onCreateSubgraph={handleCreateSubgraph}
          selectedTaskCount={selectedTasks.length}
        />
      </NodeToolbar>
    );
  },
);
