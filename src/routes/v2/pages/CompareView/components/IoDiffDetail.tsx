import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { IoDiff } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

import { DiffStatusBadge } from "./DiffStatusBadge";
import { FieldDiffRow } from "./FieldDiffRow";
import { RunTags } from "./RunTag";

interface IoDiffDetailProps {
  diff: IoDiff;
  labelA: string;
  labelB: string;
}

export function IoDiffDetail({ diff, labelA, labelB }: IoDiffDetailProps) {
  const isInput = diff.kind === "input";
  const wholeChange = diff.status === "new" || diff.status === "lost";
  const changedFields = diff.fieldDiffs.filter(
    (entry) => entry.status !== "unchanged",
  );

  return (
    <BlockStack gap="4">
      <BlockStack gap="2">
        <InlineStack gap="2" blockAlign="center" wrap="wrap">
          <Icon
            name={isInput ? "ArrowRightToLine" : "ArrowRightFromLine"}
            size="xs"
            className="text-muted-foreground"
          />
          <Text as="span" size="sm" weight="semibold" className="font-mono">
            {diff.name}
          </Text>
          <DiffStatusBadge status={diff.status} />
          <RunTags status={diff.status} labelA={labelA} labelB={labelB} />
        </InlineStack>
        <Text as="span" size="xs" tone="subdued" className="uppercase">
          {isInput ? "Pipeline input" : "Pipeline output"}
        </Text>
      </BlockStack>

      {!wholeChange &&
        (changedFields.length > 0 ? (
          <BlockStack gap="1">
            {changedFields.map((entry) => (
              <FieldDiffRow
                key={entry.key}
                entry={entry}
                labelA={labelA}
                labelB={labelB}
              />
            ))}
          </BlockStack>
        ) : (
          <Text as="span" size="sm" tone="subdued">
            No differences in this {isInput ? "input" : "output"}.
          </Text>
        ))}
    </BlockStack>
  );
}
