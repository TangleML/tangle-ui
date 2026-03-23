import { NodeToolbar } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { copyNodesToClipboard } from "@/routes/v2/shared/clipboard/copyNodesToClipboard";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const RunViewSelectionToolbar = observer(
  function RunViewSelectionToolbar({ spec }: { spec: ComponentSpec | null }) {
    const registry = useNodeRegistry();
    const { editor } = useSharedStores();
    const { multiSelection } = editor;

    if (multiSelection.length <= 1) return null;

    const nodeIds = multiSelection.map((n) => n.id);

    const handleCopy = () => {
      if (!spec) return;
      copyNodesToClipboard(registry, spec, multiSelection);
    };

    return (
      <NodeToolbar
        nodeId={nodeIds}
        isVisible
        offset={0}
        align="end"
        className="z-50"
      >
        <InlineStack
          gap="1"
          className="rounded-md border border-blue-200 bg-white px-1 py-1 shadow-lg"
          data-testid="runview-selection-toolbar"
        >
          <TooltipButton
            tooltip="Copy"
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            onClick={handleCopy}
            data-testid="runview-selection-copy"
          >
            <Icon name="ClipboardCopy" size="sm" />
            <Text size="xs" weight="semibold">
              Copy
            </Text>
          </TooltipButton>
        </InlineStack>
      </NodeToolbar>
    );
  },
);
