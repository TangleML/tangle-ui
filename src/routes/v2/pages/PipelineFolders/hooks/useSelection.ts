import { useState } from "react";

export function useSelection() {
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(
    new Set(),
  );
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );

  const totalSelected = selectedPipelines.size + selectedFolders.size;

  const selectPipeline = (pipelineId: string, checked: boolean) => {
    setSelectedPipelines((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pipelineId);
      else next.delete(pipelineId);
      return next;
    });
  };

  const selectFolder = (id: string, checked: boolean) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPipelines(new Set());
    setSelectedFolders(new Set());
  };

  const selectAll = ({
    pipelineIds,
    folderIds,
  }: {
    pipelineIds: string[];
    folderIds: string[];
  }) => {
    setSelectedPipelines(new Set(pipelineIds));
    setSelectedFolders(new Set(folderIds));
  };

  return {
    selectedPipelines,
    selectedFolders,
    totalSelected,
    selectPipeline,
    selectFolder,
    selectAll,
    clearSelection,
  };
}
