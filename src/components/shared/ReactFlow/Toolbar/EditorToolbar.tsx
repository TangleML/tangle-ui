import type { PanelPosition } from "@xyflow/react";

import { UndoRedo } from "@/components/shared/UndoRedo";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import CommentToggle from "./CommentToggle";

interface EditorToolbarProps {
  position: PanelPosition;
  className?: string;
  isCommenting: boolean;
  toggleCommentMode: () => void;
}

const EditorToolbar = ({
  className,
  position,
  isCommenting,
  toggleCommentMode,
}: EditorToolbarProps) => {
  const positionClasses = getPositionClasses(position);
  return (
    <div className={cn("absolute p-4", className, positionClasses)}>
      <InlineStack gap="2">
        <UndoRedo />
        <CommentToggle
          isCommenting={isCommenting}
          toggleCommentMode={toggleCommentMode}
        />
      </InlineStack>
    </div>
  );
};

export default EditorToolbar;

function getPositionClasses(position: PanelPosition) {
  switch (position) {
    case "top-left":
      return "top-0 left-0";
    case "top-right":
      return "top-0 right-0";
    case "top-center":
      return "top-0 left-1/2 transform -translate-x-1/2";
    case "bottom-left":
      return "bottom-0 left-0";
    case "bottom-right":
      return "bottom-0 right-0";
    case "bottom-center":
      return "bottom-0 left-1/2 transform -translate-x-1/2";
    case "center-left":
      return "top-1/2 left-0 transform -translate-y-1/2";
    case "center-right":
      return "top-1/2 right-0 transform -translate-y-1/2";
    default:
      return "top-0 right-0";
  }
}
