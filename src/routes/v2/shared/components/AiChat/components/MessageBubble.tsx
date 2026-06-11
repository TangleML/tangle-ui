import { cva, type VariantProps } from "class-variance-authority";
import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

const messageBubbleVariants = cva(
  "flex w-fit rounded-lg px-3 py-2 max-w-[85%] min-w-0",
  {
    variants: {
      variant: {
        user: "self-end bg-info/10 text-foreground",
        assistant: "self-start bg-muted",
      },
      tone: {
        default: "",
        muted: "bg-muted/60",
      },
      direction: {
        block: "flex-col",
        inline: "flex-row items-center",
      },
      gap: {
        "1": "gap-1",
        "2": "gap-2",
      },
    },
    defaultVariants: {
      tone: "default",
      direction: "block",
      gap: "1",
    },
  },
);

interface MessageBubbleProps
  extends PropsWithChildren, VariantProps<typeof messageBubbleVariants> {
  variant: "user" | "assistant";
  className?: string;
}

export function MessageBubble({
  variant,
  tone,
  direction,
  gap,
  className,
  children,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        messageBubbleVariants({ variant, tone, direction, gap }),
        className,
      )}
    >
      {children}
    </div>
  );
}
