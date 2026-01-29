import { type ControlProps } from "@xyflow/react";
import { useEffect } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { KEYBOARD_SHORTCUTS } from "@/utils/constants";

import TooltipButton from "../../Buttons/TooltipButton";

interface CommentToggleProps extends ControlProps {
  isCommenting: boolean;
  toggleCommentMode: () => void;
}

export default function CommentToggle({
  isCommenting,
  toggleCommentMode,
}: CommentToggleProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === KEYBOARD_SHORTCUTS.COMMENT) {
          event.preventDefault();
          toggleCommentMode();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleCommentMode]);

  const metaKey = navigator.userAgent.includes("Mac")
    ? KEYBOARD_SHORTCUTS.MAC_META
    : KEYBOARD_SHORTCUTS.WINDOWS_META;

  return (
    <TooltipButton
      variant="outline"
      size="sm"
      onClick={() => toggleCommentMode()}
      className={cn("h-8 w-8 p-0", { "bg-gray-100!": isCommenting })}
      tooltip={`Comment (${metaKey}+${KEYBOARD_SHORTCUTS.COMMENT.toUpperCase()})`}
    >
      <Icon name="MessageSquareText" />
    </TooltipButton>
  );
}
