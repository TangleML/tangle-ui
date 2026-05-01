import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, Output } from "@/models/componentSpec";
import type { TypeSpecType } from "@/models/componentSpec/entities/types";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "Any";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}

interface OutputsBlockProps {
  spec: ComponentSpec;
  /** When true, render only the list (no ContentBlock); use with an outer section title. */
  embedded?: boolean;
}

export function OutputsBlock({ spec, embedded = false }: OutputsBlockProps) {
  const { navigateToEntity } = useFocusActions();
  const handleClick = (output: Output) => {
    navigateToEntity([spec.name], output.$id, "output");
  };

  const list =
    spec.outputs.length > 0 ? (
      <BlockStack>
        {spec.outputs.map((output) => (
          <InlineStack
            key={output.$id}
            gap="1"
            align="space-between"
            blockAlign="center"
            className="w-full rounded-xs px-2 py-0.5 even:bg-white odd:bg-secondary"
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
    );

  if (embedded) {
    return list;
  }

  return <ContentBlock title="Outputs">{list}</ContentBlock>;
}
