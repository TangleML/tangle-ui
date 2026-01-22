import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ValueDiff } from "@/utils/diff/types";

import { ArgumentRow, ArgumentsTable } from "./ArgumentsTable";

interface ArgumentsDiffProps {
  arguments: ValueDiff[];
  runLabels: string[];
}

export const ArgumentsDiff = ({
  arguments: args,
  runLabels,
}: ArgumentsDiffProps) => {
  const changedArgs = args.filter((a) => a.changeType !== "unchanged");
  const unchangedArgs = args.filter((a) => a.changeType === "unchanged");

  if (args.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-4">
        <Text tone="subdued">No pipeline arguments to compare.</Text>
      </div>
    );
  }

  return (
    <BlockStack gap="4">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" size="lg" weight="semibold">
          Pipeline Arguments
        </Text>
        <Text size="sm" tone="subdued">
          {changedArgs.length} changed, {unchangedArgs.length} unchanged
        </Text>
      </InlineStack>

      {/* Changed arguments */}
      {changedArgs.length > 0 && (
        <ArgumentsTable runLabels={runLabels}>
          {changedArgs.map((diff) => (
            <ArgumentRow key={diff.key} diff={diff} />
          ))}
        </ArgumentsTable>
      )}

      {/* Unchanged arguments (collapsible) */}
      {unchangedArgs.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="unchanged">
            <AccordionTrigger>
              <Text size="sm" tone="subdued">
                {unchangedArgs.length} unchanged arguments
              </Text>
            </AccordionTrigger>
            <AccordionContent>
              <ArgumentsTable runLabels={runLabels} compact>
                {unchangedArgs.map((diff) => (
                  <ArgumentRow key={diff.key} diff={diff} compact />
                ))}
              </ArgumentsTable>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </BlockStack>
  );
};
