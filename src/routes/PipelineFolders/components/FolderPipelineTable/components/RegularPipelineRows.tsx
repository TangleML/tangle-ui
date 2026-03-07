import PipelineRow from "@/components/Home/PipelineSection/PipelineRow";
import { Icon } from "@/components/ui/icon";
import type { ComponentFileEntry } from "@/utils/componentStore";

import { useFolderNavigation } from "../../../context/FolderNavigationContext";
import type { DragItem } from "../../../types";

type PipelineEntry = [string, ComponentFileEntry];

interface RegularPipelineRowsProps {
  pipelines: PipelineEntry[];
  selectedPipelines: Set<string>;
  draggingIds: Set<string>;
  getDragItems: (item: DragItem) => DragItem[];
  onSelectPipeline: (name: string, checked: boolean) => void;
  onDragStateChange: (items: DragItem[], isDragging: boolean) => void;
  onDelete: () => void;
}

export function RegularPipelineRows({
  pipelines,
  selectedPipelines,
  draggingIds,
  getDragItems,
  onSelectPipeline,
  onDragStateChange,
  onDelete,
}: RegularPipelineRowsProps) {
  const folderNav = useFolderNavigation();

  return (
    <>
      {pipelines.map(([name, fileEntry]) => {
        const pipelineItem: DragItem = { type: "pipeline", id: name };
        const items = getDragItems(pipelineItem);
        return (
          <PipelineRow
            key={fileEntry.componentRef.digest}
            name={name}
            modificationTime={fileEntry.modificationTime}
            onDelete={onDelete}
            isSelected={selectedPipelines.has(name)}
            onSelect={(checked) => onSelectPipeline(name, checked)}
            onPipelineClick={folderNav?.onPipelineClick}
            icon={
              <Icon
                name="FileSpreadsheet"
                fill="currentColor"
                stroke="#2563eb"
                size="lg"
                className="shrink-0 text-blue-500"
              />
            }
            dragData={JSON.stringify(items)}
            isDragging={draggingIds.has(name)}
            dragItemCount={items.length}
            onDragStateChange={(dragging) => onDragStateChange(items, dragging)}
          />
        );
      })}
    </>
  );
}
