import { type RefObject, useEffect, useRef } from "react";

import { InlineStack } from "@/components/ui/layout";

import { RESOURCES } from "../data/resources";
import { useAnchoredToast } from "../providers/AnchoredToastProvider";
import type { BuildingStatistics } from "../types/statistics";

interface ProductionFeedbackProps {
  buildingRef: RefObject<HTMLElement | null>;
  statistics?: BuildingStatistics;
  day: number;
}

export const ProductionFeedback = ({
  buildingRef,
  statistics,
  day,
}: ProductionFeedbackProps) => {
  const { addToast } = useAnchoredToast();
  const previousDay = useRef(day);

  useEffect(() => {
    if (day === previousDay.current) return;
    previousDay.current = day;

    const hasProduction =
      statistics?.produced &&
      Object.keys(statistics.produced).length > 0 &&
      Object.values(statistics.produced).some((amount) => amount > 0);

    if (!hasProduction) return;

    const content = (
      <InlineStack gap="1" wrap="nowrap">
        {Object.entries(statistics.produced!).map(([resource, amount]) => {
          const resourceData = RESOURCES[resource as keyof typeof RESOURCES];
          return (
            <p
              key={resource}
              className="text-xs"
              style={{ color: resourceData?.color || "black" }}
            >
              +{amount} {resourceData?.icon || ""}
            </p>
          );
        })}
      </InlineStack>
    );

    // Add toast anchored to the building
    addToast(buildingRef, content);
  }, [day, statistics, buildingRef, addToast]);

  return null;
};
