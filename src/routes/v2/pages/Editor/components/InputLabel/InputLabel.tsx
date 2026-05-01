import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { CopyValueButton } from "./components/CopyValueButton";

export function InputLabel({
  children,
  onCopy,
  className,
  ...rest
}: ComponentProps<typeof Label> & { onCopy?: () => string | undefined }) {
  return (
    <Label
      {...rest}
      className={cn("text-xs! text-muted-foreground group", className)}
    >
      {children}
      {Boolean(onCopy) && (
        <CopyValueButton
          valueFn={() => onCopy?.()}
          className={
            "group-hover:opacity-100 transition-opacity duration-150 opacity-0"
          }
        />
      )}
    </Label>
  );
}
