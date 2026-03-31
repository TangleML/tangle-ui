import { useReactFlow, useUpdateNodeInternals } from "@xyflow/react";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { useContextPanel } from "@/providers/ContextPanelProvider";

import { getBuildingDefinition } from "../../data/buildings";
import { RESOURCES } from "../../data/resources";
import { configureBuildingInstanceForMethod } from "../../objects/production/configureBuildingInstanceForMethod";
import { useGlobalResources } from "../../providers/GlobalResourcesProvider";
import { useStatistics } from "../../providers/StatisticsProvider";
import {
  type BuildingInstance,
  getBuildingInstance,
} from "../../types/buildings";
import type { ProductionMethod } from "../../types/production";
import { calculateRefund } from "../../utils/sellBuilding";
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
  const { updateNodeData, getNodes, setNodes, getEdges, setEdges } =
    useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { currentDay } = useStatistics();
  const { addResource } = useGlobalResources();
  const { clearContent } = useContextPanel();

  const buildingClass = getBuildingDefinition(building.type);
  const availableMethods = buildingClass.productionMethods;

  const {
    icon,
    name,
    description,
    cost,
    builtOnDay = 0,
    productionMethod,
    inputs = [],
    outputs = [],
    stockpile = [],
    productionState,
  } = building;

  const refundAmount = calculateRefund(cost, builtOnDay, currentDay);

  const isProtected = buildingClass.protected ?? false;
  const sameTypeCount = isProtected
    ? getNodes().filter((n) => getBuildingInstance(n)?.type === building.type)
        .length
    : 0;
  const canSell = !isProtected || sameTypeCount > 1;

  const handleSell = () => {
    addResource("money", refundAmount);
    setNodes((nodes) => nodes.filter((n) => n.id !== nodeId));
    setEdges((edges) =>
      edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    );
    clearContent();
  };

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

      <Separator />

      <BlockStack gap="2">
        <InlineStack gap="1" align="center">
          <Text size="sm" tone="subdued">
            Sale value:
          </Text>
          <Text size="sm" weight="semibold">
            {RESOURCES.money.icon} {refundAmount}
          </Text>
          {refundAmount < cost && (
            <Text size="xs" tone="subdued">
              ({Math.round((refundAmount / cost) * 100)}%)
            </Text>
          )}
        </InlineStack>

        {canSell ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={!canSell}
            onClick={handleSell}
          >
            {`Sell for ${RESOURCES.money.icon} ${refundAmount}`}
          </Button>
        ) : (
          <Text size="xs" tone="subdued">
            The {building.name} is critical to survival! The last one cannot be
            sold.
          </Text>
        )}
      </BlockStack>
    </BlockStack>
  );
};

export default BuildingContext;
