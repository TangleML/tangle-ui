import { useEffect } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";

export function AuthorizationResultScreen() {
  useEffect(() => {
    setTimeout(() => {
      window.close();
    }, 1000);
  }, []);

  return (
    <BlockStack
      className="min-h-screen bg-white"
      align="center"
      inlineAlign="center"
      gap="4"
    >
      <Text size="lg" weight="bold">
        Authorization successful!
      </Text>
      <Spinner size={40} />
    </BlockStack>
  );
}
