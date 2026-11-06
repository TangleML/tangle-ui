import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  MIN_CHAT_WIDTH,
  snapsWorkareaShut,
} from "@/routes/v2/pages/Tangent/layout";

interface WorkareaDividerProps {
  rowMeasured: boolean;
  maxChatWidth: number;
  onResize: (chatWidth: number) => void;
  onCollapsePreview: (snapping: boolean) => void;
}

export function WorkareaDivider({
  rowMeasured,
  maxChatWidth,
  onResize,
  onCollapsePreview,
}: WorkareaDividerProps) {
  const store = useTangentProject();
  const snapsShut = (attempted: number) =>
    snapsWorkareaShut(rowMeasured, maxChatWidth, attempted);

  return (
    <VerticalResizeHandle
      side="right"
      label="Resize workarea"
      minWidth={MIN_CHAT_WIDTH}
      maxWidth={maxChatWidth}
      onDoubleClick={() => store.hideWorkarea()}
      onResize={(width) => onCollapsePreview(snapsShut(width))}
      onResizeEnd={(width) => {
        onCollapsePreview(false);
        if (snapsShut(width)) store.hideWorkarea();
        else onResize(width);
      }}
    />
  );
}
