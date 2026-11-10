import type { CSSProperties, MouseEvent, ReactNode } from "react";

import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface WindowHeaderProps {
  title: string;
  isDragging?: boolean;
  onMouseDown?: (e: MouseEvent) => void;
  leadingIcon?: ReactNode;
  actions: ReactNode;
  className?: string;
  style?: CSSProperties;
  actionsOnHover?: boolean;
  tone?: "light" | "dark";
  // Reads as a section label: no hover tint, and the leading icon only on
  // hover, in the margin, so the title lines up with the content below it.
  quiet?: boolean;
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
  quiet = false,
}: WindowHeaderProps) {
  return (
    <div
      className={cn(
        "group/header flex items-center justify-between py-2.5 shrink-0 transition-all duration-300",
        quiet
          ? "relative ps-4 pe-2"
          : "px-2 group-hover/window:bg-purple-500/10",
        onMouseDown && "cursor-grab",
        onMouseDown && isDragging && "cursor-grabbing",
        className,
      )}
      style={style}
      onMouseDown={onMouseDown}
    >
      {quiet && leadingIcon && (
        <span className="absolute inset-y-0 start-0.5 flex items-center opacity-0 transition-opacity group-hover/window:opacity-100">
          {leadingIcon}
        </span>
      )}
      <InlineStack
        gap="1"
        blockAlign="center"
        wrap="nowrap"
        className="min-w-0 flex-1 overflow-hidden"
      >
        {!quiet && leadingIcon}
        <Text
          size="xs"
          weight="semibold"
          className={cn(
            "truncate",
            tone === "dark" ? "text-gray-100" : "text-foreground",
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
