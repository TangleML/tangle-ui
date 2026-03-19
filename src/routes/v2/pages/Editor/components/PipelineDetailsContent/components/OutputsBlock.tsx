import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, Output } from "@/models/componentSpec";
import type { TypeSpecType } from "@/models/componentSpec/entities/types";
import {
  selectNode,
  setPendingFocusNode,
} from "@/routes/v2/shared/store/editorStore";
import { navigateToPath } from "@/routes/v2/shared/store/navigationStore";

function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "Any";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}

export function OutputsBlock({ spec }: { spec: ComponentSpec }) {
  const handleClick = (output: Output) => {
    navigateToPath([spec.name]);
    setPendingFocusNode(output.$id);
    selectNode(output.$id, "output");
  };

  return (
    <ContentBlock title="Outputs">
      {spec.outputs.length > 0 ? (
        <BlockStack>
          {spec.outputs.map((output) => (
            <InlineStack
              key={output.$id}
              gap="1"
              align="space-between"
              blockAlign="center"
              className="even:bg-white odd:bg-secondary px-2 py-0.5 rounded-xs w-full"
              wrap="nowrap"
            >
              <Button
                variant="ghost"
                size="xs"
                className="truncate"
                onClick={() => handleClick(output)}
              >
                {output.name}
              </Button>
              <Text size="xs" tone="subdued" className="shrink-0">
                ({typeSpecToString(output.type)})
              </Text>
            </InlineStack>
          ))}
        </BlockStack>
      ) : (
        <Text size="xs" tone="subdued">
          No outputs
        </Text>
      )}
    </ContentBlock>
  );
}
