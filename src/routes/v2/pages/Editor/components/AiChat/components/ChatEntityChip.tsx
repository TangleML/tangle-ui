import { type ButtonHTMLAttributes, forwardRef } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface ChatEntityChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  icon: IconName;
  label: string;
}

export const ChatEntityChip = forwardRef<
  HTMLButtonElement,
  ChatEntityChipProps
>(function ChatEntityChip(
  { icon, label, draggable, className, ...buttonProps },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      draggable={draggable}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-accent transition-colors align-middle",
        draggable ? "cursor-grab" : "cursor-pointer",
        className,
      )}
      {...buttonProps}
    >
      <Icon name={icon} className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[160px]">{label}</span>
    </button>
  );
});
