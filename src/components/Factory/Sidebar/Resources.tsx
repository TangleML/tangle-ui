import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { RESOURCES } from "../data/resources";

interface ResourcesProps {
  coins: number;
  knowledge: number;
}

const Resources = ({ coins, knowledge }: ResourcesProps) => {
  return (
    <BlockStack gap="1">
      <Text>
        {RESOURCES.coins.icon} {coins}
      </Text>
      <Text>
        {RESOURCES.knowledge.icon} {knowledge}
      </Text>
    </BlockStack>
  );
};

export default Resources;
