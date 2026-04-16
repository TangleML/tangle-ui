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
}

export function WindowHeader({
  title,
  isDragging = false,
  onMouseDown,
  leadingIcon,
  actions,
  className,
}: WindowHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-2 border-b shrink-0",
        onMouseDown && "cursor-grab",
        onMouseDown && isDragging && "cursor-grabbing",
        className,
      )}
      onMouseDown={onMouseDown}
    >
      <InlineStack
        gap="1"
        blockAlign="center"
        wrap="nowrap"
        className="min-w-0 flex-1 overflow-hidden"
      >
        {leadingIcon}
        <Text size="xs" weight="semibold" className="text-gray-700 truncate">
          {title}
        </Text>
      </InlineStack>
      {actions}
    </div>
  );
}
