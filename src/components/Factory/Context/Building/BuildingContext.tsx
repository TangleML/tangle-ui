import { useReactFlow, useUpdateNodeInternals } from "@xyflow/react";

import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";

import { getBuildingDefinition } from "../../data/buildings";
import { configureBuildingInstanceForMethod } from "../../objects/production/configureBuildingInstanceForMethod";
import { type BuildingInstance } from "../../types/buildings";
import type { ProductionMethod } from "../../types/production";
import { ContextHeader } from "../shared/ContextHeader";
import { BuildingDescription } from "./BuildingDescription";
import { ConnectionsSection } from "./ConnectionsSection";
import { ProductionMethodSection } from "./Production/ProductionMethodSection";
import { StockpileSection } from "./StockpileSection";

interface BuildingContextProps {
  building: BuildingInstance;
  nodeId: string;
}

const BuildingContext = ({ building, nodeId }: BuildingContextProps) => {
  const { updateNodeData, getEdges, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const buildingClass = getBuildingDefinition(building.type);
  const availableMethods = buildingClass.productionMethods;

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

  const handleMethodChange = (method: ProductionMethod) => {
    const configuration = configureBuildingInstanceForMethod(method, building);

    const updatedBuilding: BuildingInstance = {
      ...building,
      ...configuration,
    };

    updateNodeData(nodeId, { buildingInstance: updatedBuilding });
    updateNodeInternals(nodeId);

    const currentEdges = getEdges();
    const filteredEdges = currentEdges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId,
    );
    setEdges(filteredEdges);
  };

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
        buildingType={building.type}
        productionMethod={productionMethod}
        productionState={productionState}
        availableMethods={availableMethods}
        onMethodChange={handleMethodChange}
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
