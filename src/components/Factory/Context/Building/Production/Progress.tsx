import { BlockStack } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/typography";
import { pluralize } from "@/utils/string";

import type {
  ProductionMethod,
  ProductionState,
} from "../../../types/production";

interface ProductionProgressSectionProps {
  productionMethod: ProductionMethod;
  productionState?: ProductionState;
}

export const ProductionProgress = ({
  productionMethod,
  productionState,
}: ProductionProgressSectionProps) => {
  if (!productionState) return null;

  const progressPercentage =
    (productionState.progress / productionMethod.days) * 100;

  return (
    <BlockStack gap="1">
      <Text size="xs" tone="subdued">
        {productionState.status === "idle" && "Idle"}
        {productionState.status === "active" &&
          `Progress: ${productionState.progress} / ${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}
        {productionState.status === "paused" &&
          `Paused: ${productionState.progress} / ${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}
        {productionState.status === "complete" &&
          `Complete: ${productionState.progress} / ${productionMethod.days} ${pluralize(productionMethod.days, "day")}`}
      </Text>
      <Progress value={progressPercentage} className="h-2" />
    </BlockStack>
  );
};
