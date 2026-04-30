import type { ReactNode } from "react";

import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface WindowHeaderProps {
  title: string;
  isDragging?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  leadingIcon?: ReactNode;
  actions: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** When true, actions are hidden until the parent group/window is hovered. */
  actionsOnHover?: boolean;
  /** Color tone of the header content; affects title text color. */
  tone?: "light" | "dark";
}

export function WindowHeader({
  title,
  isDragging = false,
  onMouseDown,
  leadingIcon,
  actions,
  className,
  style,
  actionsOnHover = false,
  tone = "light",
}: WindowHeaderProps) {
  return (
    <div
      className={cn(
        "group/header flex items-center justify-between px-2 py-2.5 shrink-0 transition-all duration-300 group-hover/window:bg-purple-500/10",
        onMouseDown && "cursor-grab",
        onMouseDown && isDragging && "cursor-grabbing",
        className,
      )}
      style={style}
      onMouseDown={onMouseDown}
    >
      <InlineStack
        gap="1"
        blockAlign="center"
        wrap="nowrap"
        className="min-w-0 flex-1 overflow-hidden"
      >
        {leadingIcon}
        <Text
          size="xs"
          weight="semibold"
          className={cn(
            "truncate",
            tone === "dark" ? "text-gray-100" : "text-gray-700",
          )}
        >
          {title}
        </Text>
      </InlineStack>
      <div
        className={cn(
          actionsOnHover &&
            "opacity-0 group-hover/window:opacity-100 transition-opacity duration-200",
        )}
      >
        {actions}
      </div>
    </div>
  );
}
