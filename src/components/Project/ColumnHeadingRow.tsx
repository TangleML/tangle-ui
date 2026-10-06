import type { ReactNode } from "react";

import { InlineStack } from "@/components/ui/layout";

/**
 * The resources column's heading sits beside a small button, which makes that
 * row taller than a bare heading. Every column uses this so all three start
 * their content on the same line.
 */
export function ColumnHeadingRow({ children }: { children: ReactNode }) {
  return (
    <InlineStack gap="3" blockAlign="center" className="min-h-8">
      {children}
    </InlineStack>
  );
}
