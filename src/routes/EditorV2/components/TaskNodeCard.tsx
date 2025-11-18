import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export function TaskNodeCard({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-gray-200 border-2 wrap-break-word p-0 drop-shadow-none gap-2",
        "border-gray-500",
      )}
    >
      <CardHeader className="border-b border-slate-200 px-2 py-2.5 flex flex-row justify-between items-start">
        <BlockStack>
          <InlineStack gap="2" wrap="nowrap">
            <Icon name="Workflow" size="sm" className="text-blue-600" />
            <CardTitle className="wrap-break-word text-left text-xs text-slate-900">
              {name}
            </CardTitle>
          </InlineStack>
          <Text size="xs" tone="subdued" className="font-light">
            {description}
          </Text>
        </BlockStack>
      </CardHeader>
      <CardContent className="p-2 flex flex-col gap-2">
        <div>Inputs / Outputs</div>
      </CardContent>
    </Card>
  );
}
