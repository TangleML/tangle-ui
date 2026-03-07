import { LinkBlock } from "@/components/shared/ContextPanel/Blocks/LinkBlock";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import {
  type BlockDescriptor,
  type BlockRegistry,
  BlockType,
  type ComposerSchema,
  type SectionDescriptor,
} from "@/types/composerSchema";

const defaultRegistry: BlockRegistry = {
  [BlockType.TextBlock]: TextBlock,
  [BlockType.LinkBlock]: LinkBlock,
};

interface ComposerBlockProps {
  block: BlockDescriptor;
}

interface ComposerSectionProps {
  section: SectionDescriptor;
}

interface ComposerProps {
  schema: ComposerSchema;
}

function ComposerBlock({ block }: ComposerBlockProps) {
  const { blockType } = block;
  switch (blockType) {
    case BlockType.TextBlock: {
      const Component = defaultRegistry[BlockType.TextBlock];
      return <Component {...block.properties} />;
    }
    case BlockType.LinkBlock: {
      const Component = defaultRegistry[BlockType.LinkBlock];
      return <Component {...block.properties} />;
    }
    default: {
      const unhandledType: string = blockType;
      console.warn(`Unknown block type: "${unhandledType}"`);
      return null;
    }
  }
}

function ComposerSection({ section }: ComposerSectionProps) {
  return (
    <BlockStack gap="3">
      <Heading level={2}>{section.title}</Heading>
      <BlockStack gap="2">
        {section.blocks.map((block) => (
          <ComposerBlock key={block.id} block={block} />
        ))}
      </BlockStack>
    </BlockStack>
  );
}

export function Composer({ schema }: ComposerProps) {
  if (schema.sections.length === 0) {
    return null;
  }

  return (
    <BlockStack gap="4">
      {schema.sections.map((section) => (
        <ComposerSection key={section.id} section={section} />
      ))}
    </BlockStack>
  );
}
