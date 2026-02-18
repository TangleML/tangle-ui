import { InlineStack } from "@/components/ui/layout";

import { RESOURCES } from "../data/resources";
import type { EdgeStatistics } from "../types/statistics";

interface TransportationFeedbackProps {
  transfers: EdgeStatistics[];
}

export const TransportationFeedback = ({
  transfers,
}: TransportationFeedbackProps) => {
  if (!transfers || transfers.length === 0) {
    return null;
  }

  return (
    <InlineStack wrap="nowrap" gap="1">
      {transfers.map((transfer, index) => (
        <p
          key={index}
          className="text-[8px] font-light whitespace-nowrap opacity-60"
          style={{ color: RESOURCES[transfer.resource].color }}
        >{`${RESOURCES[transfer.resource].icon} ${transfer.transferred}`}</p>
      ))}
    </InlineStack>
  );
};
