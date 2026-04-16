import type { DragEvent } from "react";
import { useMemo } from "react";

import ComponentDetailsDialog from "@/components/shared/Dialogs/ComponentDetailsDialog";
import { Icon } from "@/components/ui/icon";
import type { ComponentReference } from "@/utils/componentSpec";

import type { ComponentRefData } from "../aiChat.types";

interface ComponentChipProps {
  componentRef: ComponentRefData;
  label: string;
}

export function ComponentChip({ componentRef, label }: ComponentChipProps) {
  const reference: ComponentReference = useMemo(
    () => ({ text: componentRef.yamlText, name: componentRef.name }),
    [componentRef.yamlText, componentRef.name],
  );

  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ task: { componentRef: reference } }),
    );
    event.dataTransfer.setData(
      "DragStart.offset",
      JSON.stringify({
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <ComponentDetailsDialog
      component={reference}
      displayName={label}
      readOnly
      trigger={
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-grab align-middle"
        >
          <Icon
            name="Puzzle"
            className="size-3 shrink-0 text-muted-foreground"
          />
          <span className="truncate max-w-[160px]">{label}</span>
        </button>
      }
    />
  );
}
