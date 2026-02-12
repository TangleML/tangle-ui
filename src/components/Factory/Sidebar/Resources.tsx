import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { RESOURCES } from "../data/resources";

const Resources = () => {
  return (
    <BlockStack gap="1">
      <Text>{RESOURCES.coins.icon} 0</Text>
      <Text>{RESOURCES.knowledge.icon} 0</Text>
    </BlockStack>
  );
};

export default Resources;
