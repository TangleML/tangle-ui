import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

import type { ProductionMethod } from "../../../types/production";

interface ProductionDurationProps {
  productionMethod: ProductionMethod;
}

export const ProductionDuration = ({
  productionMethod,
}: ProductionDurationProps) => {
  return (
    <InlineStack gap="2">
      <Icon name="Clock" size="sm" />
      <Text size="sm">{`${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}</Text>
    </InlineStack>
  );
};
