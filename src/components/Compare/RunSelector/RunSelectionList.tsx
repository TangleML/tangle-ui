import { usePipelineRuns } from "@/components/shared/PipelineRunDisplay/usePipelineRuns";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineStack } from "@/components/ui/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { PipelineRun } from "@/types/pipelineRun";
import { formatDate } from "@/utils/date";

import { PipelineRunStatus } from "../../shared/PipelineRunDisplay/components/PipelineRunStatus";

interface RunSelectionListProps {
  pipelineName: string;
  selectedRuns: PipelineRun[];
  onRunSelect: (run: PipelineRun, selected: boolean) => void;
  maxSelections: number;
}

export const RunSelectionList = ({
  pipelineName,
  selectedRuns,
  onRunSelect,
  maxSelections,
}: RunSelectionListProps) => {
  const { data: runs } = usePipelineRuns(pipelineName);

  if (!runs || runs.length === 0) {
    return (
      <InlineStack
        className="border border-dashed border-border rounded-md p-8"
        align="center"
      >
        <Text tone="subdued">No runs found for this pipeline.</Text>
      </InlineStack>
    );
  }

  const isRunSelected = (run: PipelineRun) =>
    selectedRuns.some((r) => r.id === run.id);

  const isMaxSelected = selectedRuns.length >= maxSelections;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Run ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const selected = isRunSelected(run);
          const disabled = !selected && isMaxSelected;

          return (
            <TableRow
              key={run.id}
              className={cn(
                "cursor-pointer",
                selected && "bg-accent/50",
                disabled && "opacity-50",
              )}
              onClick={() => !disabled && onRunSelect(run, !selected)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onRunSelect(run, checked === true)
                  }
                />
              </TableCell>
              <TableCell>
                <Text weight="semibold">#{run.id}</Text>
              </TableCell>
              <TableCell>
                <PipelineRunStatus run={run} />
              </TableCell>
              <TableCell>
                <Text size="sm" tone="subdued">
                  {run.created_at ? formatDate(run.created_at) : "N/A"}
                </Text>
              </TableCell>
              <TableCell>
                <Text size="sm" tone="subdued" className="max-w-32 truncate">
                  {run.created_by || "Unknown"}
                </Text>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

