import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { RecentLinkItem } from "../types";

export const RecentItemLink = ({
  item,
  isPinned,
  onTogglePinned,
  showPinControls = true,
}: {
  item: RecentLinkItem;
  isPinned: boolean;
  onTogglePinned: (item: RecentLinkItem) => void;
  showPinControls?: boolean;
}) => {
  const isRun = item.type === "run";
  const surfaceClass = isRun
    ? "border-violet-500/20 bg-violet-500/6 hover:bg-violet-500/12"
    : "border-border/40 bg-transparent hover:bg-violet-500/6";

  return (
    <InlineStack
      gap="1"
      blockAlign="center"
      className={cn(
        "group/chip rounded-lg border px-1.5 py-1 transition-all duration-200 ease-out",
        surfaceClass,
        "hover:shadow-[0_8px_20px_-12px_rgba(124,58,237,0.3)]",
      )}
    >
      <Link
        to={item.url}
        className="group/link flex min-w-0 items-center gap-2 px-1.5 py-0.5"
      >
        <Icon
          name={isRun ? "Play" : "Workflow"}
          size="xs"
          className={cn(
            "shrink-0",
            isRun ? "text-violet-600 dark:text-violet-400" : "text-primary",
          )}
        />
        <Text
          as="span"
          size="sm"
          className="max-w-48 truncate"
          title={item.title}
        >
          {item.title}
        </Text>
        <Icon
          name="ArrowRight"
          size="xs"
          className="shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover/link:translate-x-0.5 group-hover/link:opacity-100"
        />
      </Link>
      {showPinControls && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 opacity-0 transition-opacity group-hover/chip:opacity-100 group-focus-within/chip:opacity-100 focus-visible:opacity-100",
            isPinned && "text-violet-500",
          )}
          aria-label={isPinned ? "Unpin item" : "Pin item"}
          onClick={() => onTogglePinned(item)}
        >
          <Icon name={isPinned ? "Pin" : "PinOff"} size="sm" />
        </Button>
      )}
    </InlineStack>
  );
};
