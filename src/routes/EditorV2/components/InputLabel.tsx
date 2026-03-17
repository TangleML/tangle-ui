import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";

import { CopyValueButton } from "./CopyValueButton";

export function InputLabel({
  children,
  onCopy,
  ...rest
}: ComponentProps<typeof Label> & { onCopy?: () => string | undefined }) {
  return (
    <Label {...rest} className="text-muted-foreground group">
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
