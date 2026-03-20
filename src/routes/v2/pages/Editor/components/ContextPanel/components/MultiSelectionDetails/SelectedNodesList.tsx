import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";

import { getNodeDisplayName, getNodeIcon, getNodeIconColor } from "./utils";

interface SelectedNodesListProps {
  spec: ComponentSpec | null;
  nodes: SelectedNode[];
}

export function SelectedNodesList({ nodes, spec }: SelectedNodesListProps) {
  const registry = useNodeRegistry();

  return (
    <BlockStack gap="2">
      <Label className="text-gray-600">Selected Nodes</Label>
      <BlockStack gap="1" className="max-h-48 overflow-y-auto">
        {nodes.map((node) => (
          <InlineStack
            key={node.id}
            gap="2"
            blockAlign="center"
            className="text-xs py-1.5 px-2 bg-slate-50 rounded border border-slate-100"
          >
            <Icon
              name={getNodeIcon(registry, node.type) as any}
              size="xs"
              className={`shrink-0 ${getNodeIconColor(registry, node.type)}`}
            />
            <Text size="xs" className="text-slate-700 truncate flex-1">
              {getNodeDisplayName(registry, node, spec)}
            </Text>
            <Text size="xs" className="text-slate-400 capitalize">
              {node.type}
            </Text>
          </InlineStack>
        ))}
      </BlockStack>
    </BlockStack>
  );
}
