import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, Input } from "@/models/componentSpec";
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

export function InputsBlock({ spec }: { spec: ComponentSpec }) {
  const handleClick = (input: Input) => {
    navigateToPath([spec.name]);
    setPendingFocusNode(input.$id);
    selectNode(input.$id, "input");
  };

  return (
    <ContentBlock title="Inputs">
      {spec.inputs.length > 0 ? (
        <BlockStack data-testid="pipeline-inputs">
          {spec.inputs.map((input) => (
            <InlineStack
              key={input.$id}
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
                onClick={() => handleClick(input)}
              >
                {input.name}
              </Button>
              <InlineStack gap="1" className="shrink-0" blockAlign="center">
                <Text size="xs" tone="subdued">
                  ({typeSpecToString(input.type)})
                </Text>
                {input.optional && (
                  <Badge size="sm" variant="outline">
                    optional
                  </Badge>
                )}
              </InlineStack>
            </InlineStack>
          ))}
        </BlockStack>
      ) : (
        <Text size="xs" tone="subdued">
          No inputs
        </Text>
      )}
    </ContentBlock>
  );
}
