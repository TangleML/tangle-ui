import { InlineStack } from "@/components/ui/layout";

import { RESOURCES } from "../data/resources";
import type { StockpileChange } from "../types/statistics";

interface TransportationFeedbackProps {
  resourcesTransferred?: StockpileChange[];
}

export const TransportationFeedback = ({
  resourcesTransferred,
}: TransportationFeedbackProps) => {
  if (!resourcesTransferred || resourcesTransferred.length === 0) {
    return null;
  }

  return (
    <InlineStack wrap="nowrap" gap="1">
      {resourcesTransferred.map((c, index) => (
        <p
          key={index}
          className="text-[8px] font-light whitespace-nowrap opacity-60"
          style={{ color: RESOURCES[c.resource].color }}
        >{`${RESOURCES[c.resource].icon} ${c.removed}`}</p>
      ))}
    </InlineStack>
  );
};
