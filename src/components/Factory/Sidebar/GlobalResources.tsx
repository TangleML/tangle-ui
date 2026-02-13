import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { RESOURCES } from "../data/resources";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import { isResourceType } from "../types/resources";

const GlobalResources = () => {
  const { resources } = useGlobalResources();
  return (
    <BlockStack gap="1">
      {Object.entries(resources).map(
        ([key, amount]) =>
          isResourceType(key) && (
            <Text key={key}>
              {RESOURCES[key].icon || key} {amount}
            </Text>
          ),
      )}
    </BlockStack>
  );
};

export default GlobalResources;
