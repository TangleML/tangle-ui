import { BlockStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Paragraph, Text } from "@/components/ui/typography";
import type { ArgumentType } from "@/utils/componentSpec";

const MAX_PREVIEW_ROWS = 50;

interface SweepPreviewTableProps {
  combinations: Record<string, ArgumentType>[];
  sweepParamNames: string[];
  totalCount: number;
}

export const SweepPreviewTable = ({
  combinations,
  sweepParamNames,
  totalCount,
}: SweepPreviewTableProps) => {
  if (combinations.length === 0) {
    return (
      <BlockStack fill className="py-8">
        <Paragraph tone="subdued" size="sm">
          Add values to parameters to preview the run matrix.
        </Paragraph>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="2">
      <ScrollArea className="max-h-[50vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Text size="xs" weight="semibold">
                  #
                </Text>
              </TableHead>
              {sweepParamNames.map((name) => (
                <TableHead key={name}>
                  <Text size="xs" weight="semibold">
                    {name}
                  </Text>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinations.map((combo, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Text size="xs" tone="subdued">
                    {index + 1}
                  </Text>
                </TableCell>
                {sweepParamNames.map((name) => (
                  <TableCell key={name}>
                    <Text
                      size="xs"
                      font="mono"
                      className="max-w-48 truncate inline-block"
                    >
                      {String(combo[name] ?? "")}
                    </Text>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      {totalCount > MAX_PREVIEW_ROWS && (
        <Paragraph size="xs" tone="subdued">
          Showing {MAX_PREVIEW_ROWS} of {totalCount} runs.
        </Paragraph>
      )}
    </BlockStack>
  );
};

export { MAX_PREVIEW_ROWS };
