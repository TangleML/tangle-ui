import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import type { ResultsCase, TangentResults } from "@/routes/tangent/types";

interface ResultsSectionProps {
  results: TangentResults;
}

function CaseTable({ title, cases }: { title: string; cases: ResultsCase[] }) {
  return (
    <BlockStack gap="2" className="flex-1">
      <Text size="sm" weight="semibold">
        {title}
      </Text>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Example</TableHead>
            <TableHead>Baseline</TableHead>
            <TableHead>Best</TableHead>
            <TableHead>Δ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((row) => (
            <TableRow key={row.example}>
              <TableCell>{row.example}</TableCell>
              <TableCell>{row.baseline}</TableCell>
              <TableCell>{row.best}</TableCell>
              <TableCell>{row.delta}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlockStack>
  );
}

export function ResultsSection({ results }: ResultsSectionProps) {
  return (
    <BlockStack gap="3">
      <Heading level={2}>Previous Tangent Results</Heading>
      <Paragraph
        size="sm"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3"
      >
        ✓ Optimization complete — {results.metricDelta}
      </Paragraph>

      <InlineStack gap="6" wrap="wrap">
        <BlockStack gap="1">
          <Text size="xs" tone="subdued">
            Best delta
          </Text>
          <Text size="sm" weight="semibold">
            {results.bestDelta}
          </Text>
        </BlockStack>
        <BlockStack gap="1">
          <Text size="xs" tone="subdued">
            Best run
          </Text>
          <Text size="sm" font="mono">
            {results.bestRunId}
          </Text>
        </BlockStack>
      </InlineStack>

      <BlockStack gap="1">
        <Text size="xs" tone="subdued">
          Config changes
        </Text>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs font-mono whitespace-pre">
          {results.configChanges}
        </pre>
      </BlockStack>

      <InlineStack gap="6" wrap="wrap" blockAlign="start">
        <CaseTable title="Top winning cases" cases={results.topWinningCases} />
        <CaseTable title="Top losing cases" cases={results.topLosingCases} />
      </InlineStack>
    </BlockStack>
  );
}
