import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";

import type { BuildingInstance } from "../types/buildings";
import { BuildingDescription } from "./Building/BuildingDescription";
import { ConnectionsSection } from "./Building/ConnectionsSection";
import { ProductionMethodSection } from "./Building/ProductionMethodSection";
import { StockpileSection } from "./Building/StockpileSection";
import { ContextHeader } from "./shared/ContextHeader";

interface BuildingContextProps {
  building: BuildingInstance;
  nodeId: string;
}

const BuildingContext = ({ building, nodeId }: BuildingContextProps) => {
  const {
    icon,
    name,
    description,
    cost,
    productionMethod,
    inputs = [],
    outputs = [],
    stockpile = [],
    productionState,
  } = building;

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="building-overview"
    >
      <ContextHeader icon={icon} name={name} />

      <BuildingDescription description={description} cost={cost} />

      <Separator />

      <ProductionMethodSection
        productionMethod={productionMethod}
        productionState={productionState}
      />

      <Separator />

      <StockpileSection
        nodeId={nodeId}
        stockpile={stockpile}
        building={building}
      />

      <Separator />

      <ConnectionsSection
        inputCount={inputs.length}
        outputCount={outputs.length}
      />
    </BlockStack>
  );
};

export default BuildingContext;
