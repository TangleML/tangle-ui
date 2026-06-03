import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import faqItems from "./faq.json";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS = faqItems as FaqItem[];

function FaqRow({ item }: { item: FaqItem }) {
  return (
    <Collapsible className="w-full border-b border-border">
      <CollapsibleTrigger
        className="group w-full flex items-start justify-between gap-3 py-3 text-left cursor-pointer"
        {...tracking("learning_hub.documentation.faq_toggle", {
          faq_id: item.id,
        })}
      >
        <Text size="sm" weight="semibold" className="flex-1 min-w-0">
          {item.question}
        </Text>
        <Icon
          name="ChevronDown"
          size="sm"
          className="text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Paragraph size="sm" tone="subdued" className="pb-3 pr-6">
          {item.answer}
        </Paragraph>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FaqPanel() {
  return (
    <BlockStack gap="4" align="stretch">
      <InlineStack gap="3" blockAlign="center">
        <Icon
          name="MessageCircleQuestionMark"
          size="md"
          className="text-primary"
          aria-hidden="true"
        />
        <Heading level={2}>Frequently asked</Heading>
      </InlineStack>

      <BlockStack align="stretch">
        {FAQ_ITEMS.map((item) => (
          <FaqRow key={item.id} item={item} />
        ))}
      </BlockStack>
    </BlockStack>
  );
}
