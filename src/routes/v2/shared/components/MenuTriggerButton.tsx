import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export const MenuTriggerButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 px-1.5 text-xs text-white/80 hover:text-white hover:bg-stone-700 rounded-sm font-normal"
    {...props}
  >
    {children}
  </Button>
);
