import { autorun } from "mobx";
import { useEffect, useState } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { KeyConstant } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const PressedKeysList = function PressedKeysList() {
  const { keyboard } = useSharedStores();
  const [pressedKeys, setPressedKeys] = useState<KeyConstant[]>([]);
  useEffect(() => {
    return autorun(() => {
      setPressedKeys(keyboard.pressedKeys);
    });
  }, [keyboard]);

  return (
    <BlockStack>
      <Text
        size="xs"
        weight="semibold"
        className="uppercase tracking-wider text-blue-600"
      >
        Pressed Keys ({pressedKeys.length})
      </Text>
      <InlineStack gap="2" blockAlign="center">
        {pressedKeys.map((key) => (
          <Text key={key}>{key}</Text>
        ))}
      </InlineStack>
    </BlockStack>
  );
};
