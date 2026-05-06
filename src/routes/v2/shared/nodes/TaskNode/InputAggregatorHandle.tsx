import { Handle, Position } from "@xyflow/react";

import { InlineStack } from "@/components/ui/layout";
import { AGGREGATOR_ADD_INPUT_HANDLE_ID } from "@/utils/aggregatorInputs";

/**
 * The aggregator's "+ Add Input" target handle. Connecting to it (or cmd-
 * dropping from it) mints a fresh `agg_N` input on the aggregator task — see
 * `aggregator.actions.ts`.
 */
export function InputAggregatorHandle() {
  return (
    <div
      className="relative w-full h-fit"
      data-testid={`input-connection-${AGGREGATOR_ADD_INPUT_HANDLE_ID}`}
    >
      <div className="absolute -translate-x-6 flex items-center h-3 w-3">
        <Handle
          type="target"
          id={AGGREGATOR_ADD_INPUT_HANDLE_ID}
          position={Position.Left}
          isConnectable
          className="border-0! h-full! w-full! transform-none! bg-blue-400!"
        />
      </div>
      <InlineStack blockAlign="center" className="rounded-md relative">
        <div className="text-xs text-blue-600! rounded-md px-2 py-1 bg-blue-50 border border-blue-200 border-dashed">
          + Add Input
        </div>
      </InlineStack>
    </div>
  );
}
