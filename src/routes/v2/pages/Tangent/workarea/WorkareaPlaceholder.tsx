import type { ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";

function WorkareaPlaceholder({ children }: { children: ReactNode }) {
  return (
    <BlockStack
      gap="1"
      align="center"
      className="min-h-0 flex-1 justify-center p-6 text-center"
    >
      {children}
    </BlockStack>
  );
}

export function WorkareaLoading() {
  return (
    <WorkareaPlaceholder>
      <Spinner />
    </WorkareaPlaceholder>
  );
}

export function WorkareaMessage({ children }: { children: ReactNode }) {
  return (
    <WorkareaPlaceholder>
      <Text size="sm" tone="subdued">
        {children}
      </Text>
    </WorkareaPlaceholder>
  );
}
