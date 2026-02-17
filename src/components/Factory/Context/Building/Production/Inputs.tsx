import { SPECIAL_BUILDINGS } from "@/components/Factory/data/buildings";
import {
  getResourceTypeFoodValue,
  isGlobalResource,
  RESOURCES,
} from "@/components/Factory/data/resources";
import type { BuildingType } from "@/components/Factory/types/buildings";
import type { ProductionMethod } from "@/components/Factory/types/production";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ProductionInputsProps {
  productionMethod: ProductionMethod;
  buildingType: BuildingType;
}

export const ProductionInputs = ({
  productionMethod,
  buildingType,
}: ProductionInputsProps) => {
  if (productionMethod.inputs.length === 0) return null;

  const isSpecialBuilding = SPECIAL_BUILDINGS.includes(buildingType);

  // Determine which global resource this special building outputs
  const globalOutput = isSpecialBuilding
    ? productionMethod.outputs.find((o) => isGlobalResource(o.resource))
        ?.resource
    : null;

  return (
    <BlockStack gap="1">
      <Text size="xs" tone="subdued">
        Inputs:
      </Text>
      {productionMethod.inputs.map((input, idx) => (
        <InlineStack key={idx} gap="2">
          {input.resource === "any" ? (
            <Text size="sm">• any</Text>
          ) : (
            <>
              <Text size="sm">
                {`• ${!isSpecialBuilding ? input.amount + "x " : ""}${input.resource}`}
              </Text>
              {isSpecialBuilding ? (
                <Text size="xs" tone="subdued">
                  (
                  {globalOutput === "money" && (
                    <>
                      {RESOURCES.money.icon} {RESOURCES[input.resource].value}
                    </>
                  )}
                  {globalOutput === "food" && (
                    <>
                      {RESOURCES.food.icon}{" "}
                      {getResourceTypeFoodValue(input.resource)}
                    </>
                  )}
                  {globalOutput === "knowledge" && (
                    <>
                      {RESOURCES.knowledge.icon}{" "}
                      {/* Knowledge buildings might have custom logic */}
                    </>
                  )}
                  )
                </Text>
              ) : (
                // For regular buildings, show money value and food value (if applicable)
                <Text size="xs" tone="subdued">
                  ({RESOURCES.money.icon}{" "}
                  {input.amount * RESOURCES[input.resource].value}{" "}
                  {getResourceTypeFoodValue(input.resource) > 0 &&
                    `/ ${RESOURCES.food.icon} ${getResourceTypeFoodValue(input.resource) * input.amount}`}
                  )
                </Text>
              )}
            </>
          )}
        </InlineStack>
      ))}
    </BlockStack>
  );
};
