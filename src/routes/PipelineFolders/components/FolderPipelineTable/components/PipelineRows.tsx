import PipelineRow from "@/components/Home/PipelineSection/PipelineRow";
import { Icon } from "@/components/ui/icon";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { useFolderNavigation } from "../../../context/FolderNavigationContext";
import type { DragItem } from "../../../types";

interface PipelineRowsProps {
  pipelines: PipelineFile[];
  selectedPipelines: Set<string>;
  draggingIds: Set<string>;
  canDrag?: boolean;
  getDragItems: (item: DragItem) => DragItem[];
  onSelectPipeline: (id: string, checked: boolean) => void;
  onDragStateChange: (items: DragItem[], isDragging: boolean) => void;
  onDelete: () => void;
}

const pipelineIcon = (
  <Icon
    name="FileSpreadsheet"
    fill="currentColor"
    stroke="#2563eb"
    size="lg"
    className="shrink-0 text-blue-500"
  />
);

export function PipelineRows({
  pipelines,
  selectedPipelines,
  draggingIds,
  canDrag = true,
  getDragItems,
  onSelectPipeline,
  onDragStateChange,
  onDelete,
}: PipelineRowsProps) {
  const folderNav = useFolderNavigation();

  return (
    <>
      {pipelines.map((file) => {
        const name = file.storageKey;
        const pipelineItem: DragItem = { type: "pipeline", id: file.id };
        const items = getDragItems(pipelineItem);

        return (
          <PipelineRow
            key={file.id}
            name={name}
            modificationTime={file.modifiedAt}
            onDelete={onDelete}
            isSelected={selectedPipelines.has(file.id)}
            onSelect={(checked) => onSelectPipeline(file.id, checked)}
            onPipelineClick={(clickedName: string) =>
              folderNav?.onPipelineClick!({
                name: clickedName,
                fileId: file.id,
              })
            }
            icon={pipelineIcon}
            dragData={canDrag ? JSON.stringify(items) : undefined}
            isDragging={draggingIds.has(file.id)}
            dragItemCount={items.length}
            onDragStateChange={(dragging) => onDragStateChange(items, dragging)}
          />
        );
      })}
    </>
  );
}
