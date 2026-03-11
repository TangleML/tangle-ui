import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../../../providers/SpecContext";
import {
  getConduits,
  unassignEdgeFromConduit,
  updateConduitColor,
} from "../hooks/useConduits";

interface ConduitDetailsProps {
  entityId: string;
}

function edgeLabel(
  sourceEntityId: string,
  sourcePortName: string,
  targetEntityId: string,
  targetPortName: string,
): string {
  const srcName = sourceEntityId.replace(/^(input_|task_|output_)/, "");
  const tgtName = targetEntityId.replace(/^(input_|task_|output_)/, "");
  return `${srcName}.${sourcePortName} → ${tgtName}.${targetPortName}`;
}

export const ConduitDetails = observer(function ConduitDetails({
  entityId,
}: ConduitDetailsProps) {
  const spec = useSpec();
  const conduitId = entityId;
  const conduit = spec
    ? getConduits(spec).find((c) => c.id === conduitId)
    : undefined;

  if (!spec || !conduit) return null;

  const orientation =
    conduit.size.width >= conduit.size.height ? "Horizontal" : "Vertical";

  const handleColorChange = (color: string) => {
    updateConduitColor(spec, conduitId, color);
  };

  const handleUnassign = (bindingId: string) => {
    unassignEdgeFromConduit(spec, conduitId, bindingId);
  };

  const assignedBindings = spec.bindings.filter((b) =>
    conduit.edgeIds.includes(b.$id),
  );

  return (
    <BlockStack>
      <BlockStack gap="4" className="p-3">
        <InlineStack gap="2" blockAlign="center">
          <div
            className="w-4 h-4 rounded border border-gray-300 shrink-0"
            style={{ backgroundColor: conduit.color }}
          />
          <Text size="sm" weight="semibold">
            Conduit
          </Text>
          <Text size="xs" tone="subdued">
            ({orientation})
          </Text>
        </InlineStack>

        <BlockStack gap="2">
          <Label className="text-gray-600">Color</Label>
          <ColorPicker
            title="Conduit Color"
            color={conduit.color}
            setColor={handleColorChange}
          />
        </BlockStack>

        <BlockStack gap="2">
          <Label className="text-gray-600">
            Assigned Edges ({assignedBindings.length})
          </Label>

          {assignedBindings.length === 0 ? (
            <Text size="xs" tone="subdued">
              No edges assigned. Click a conduit then click edges to assign.
            </Text>
          ) : (
            <BlockStack gap="1">
              {assignedBindings.map((binding) => (
                <InlineStack
                  key={binding.$id}
                  gap="2"
                  blockAlign="center"
                  className="py-1 px-2 rounded bg-gray-50 group"
                >
                  <Text size="xs" className="truncate flex-1 font-mono">
                    {edgeLabel(
                      binding.sourceEntityId,
                      binding.sourcePortName,
                      binding.targetEntityId,
                      binding.targetPortName,
                    )}
                  </Text>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleUnassign(binding.$id)}
                  >
                    <Icon name="X" size="xs" />
                  </Button>
                </InlineStack>
              ))}
            </BlockStack>
          )}
        </BlockStack>

        <Text size="xs" tone="subdued">
          Click the conduit, then click edges on the canvas to assign/unassign.
        </Text>
      </BlockStack>
    </BlockStack>
  );
});
