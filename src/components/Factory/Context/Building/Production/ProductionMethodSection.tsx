import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import type {
  ProductionMethod,
  ProductionState,
} from "../../../types/production";
import { ProductionDuration } from "./Duration";
import { ProductionInputs } from "./Inputs";
import { ProductionOutputs } from "./Outputs";
import { ProductionMethodSwitcher } from "./ProductionMethodSwitcher";
import { ProductionProgress } from "./Progress";

interface ProductionMethodSectionProps {
  productionMethod?: ProductionMethod;
  productionState?: ProductionState;
  availableMethods?: ProductionMethod[];
  onMethodChange?: (method: ProductionMethod) => void;
}

export const ProductionMethodSection = ({
  productionMethod,
  productionState,
  availableMethods = [],
  onMethodChange,
}: ProductionMethodSectionProps) => {
  if (!productionMethod) {
    return (
      <BlockStack gap="2">
        <Text size="sm" weight="semibold">
          Production Method
        </Text>
        <Text size="sm" tone="subdued">
          No production method defined
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="3">
      <Text size="sm" weight="semibold">
        Production Method
      </Text>

      <InlineStack gap="8" blockAlign="center">
        <InlineStack gap="2" blockAlign="center">
          <Icon name="Bookmark" size="sm" />
          <Text size="sm">{productionMethod.name}</Text>
        </InlineStack>
        {availableMethods.length > 1 && onMethodChange && (
          <ProductionMethodSwitcher
            currentMethod={productionMethod}
            availableMethods={availableMethods}
            onMethodChange={onMethodChange}
          />
        )}
      </InlineStack>

      <BlockStack gap="2">
        <ProductionInputs productionMethod={productionMethod} />
        <ProductionOutputs productionMethod={productionMethod} />
        <ProductionDuration productionMethod={productionMethod} />
        <ProductionProgress
          productionMethod={productionMethod}
          productionState={productionState}
        />
      </BlockStack>
    </BlockStack>
  );
};
