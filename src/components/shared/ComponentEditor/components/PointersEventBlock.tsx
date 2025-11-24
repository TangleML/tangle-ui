import type { PropsWithChildren } from "react";

import { BlockStack } from "@/components/ui/layout";

export const PointersEventBlock = ({ children }: PropsWithChildren) => {
  /**
   * protects the children from being clicked
   */
  return (
    <BlockStack
      className="pointer-events-none! isolate select-none relative before:absolute before:inset-0 before:content-[''] before:pointer-events-auto before:z-10"
      align="center"
      inlineAlign="center"
    >
      {children}
    </BlockStack>
  );
};
