import type { DragEvent } from "react";

import ComponentDetailsDialog from "@/components/shared/Dialogs/ComponentDetailsDialog";
import type { ComponentRefData } from "@/routes/v2/pages/Editor/components/AiChat/types";
import type { ComponentReference } from "@/utils/componentSpec";

import { ChatEntityChip } from "./ChatEntityChip";

interface ComponentChipProps {
  componentRef: ComponentRefData;
  label: string;
}

export function ComponentChip({ componentRef, label }: ComponentChipProps) {
  const reference: ComponentReference = {
    text: componentRef.yamlText,
    name: componentRef.name,
  };

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
        <ChatEntityChip
          icon="Puzzle"
          label={label}
          draggable
          onDragStart={onDragStart}
        />
      }
    />
  );
}
