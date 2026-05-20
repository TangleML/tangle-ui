import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export const MenuTriggerButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button variant="menubar-light" size="xs" {...props}>
    {children}
  </Button>
);
