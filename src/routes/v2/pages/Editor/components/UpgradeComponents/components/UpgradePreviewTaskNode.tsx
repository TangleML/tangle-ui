import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { buildFlatDiffList } from "@/routes/v2/pages/Editor/store/actions/task.utils";
import type { TaskNodeViewProps } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";

import type { UpgradeCandidate } from "../types";
import { DiffInputRow } from "./DiffInputRow";
import { DiffOutputRow } from "./DiffOutputRow";
import { IssuesBanner } from "./IssuesBanner";

interface UpgradePreviewTaskNodeProps extends TaskNodeViewProps {
  candidate: UpgradeCandidate;
}

export function UpgradePreviewTaskNode({
  taskName,
  isSubgraph,
  inputs,
  outputs,
  candidate,
  onNodeClick,
}: UpgradePreviewTaskNodeProps) {
  const hasIssues = candidate.predictedIssues.length > 0;

  const diffInputs = buildFlatDiffList(inputs, candidate.inputDiff, (e) => ({
    name: e.name,
    type: e.type,
    optional: e.optional,
  }));
  const diffOutputs = buildFlatDiffList(outputs, candidate.outputDiff, (e) => ({
    name: e.name,
    type: e.type,
  }));

  const hasInputChanges = diffInputs.some((d) => d.status !== "unchanged");
  const hasOutputChanges = diffOutputs.some((d) => d.status !== "unchanged");

  return (
    <Card
      className={cn(
        "min-w-[300px] w-[325px] max-w-[350px] rounded-2xl border-2 p-0 drop-shadow-none cursor-pointer gap-2",
        hasIssues ? "border-amber-400" : "border-blue-300",
      )}
      onClick={onNodeClick}
    >
      <CardHeader className="border-b border-slate-200 px-2 py-2.5">
        <BlockStack>
          <InlineStack gap="2" wrap="nowrap" blockAlign="center">
            {isSubgraph && (
              <Icon name="Workflow" size="sm" className="text-blue-600" />
            )}
            <CardTitle className="wrap-anywhere max-w-full text-left text-xs text-slate-900 flex-1">
              {taskName}
            </CardTitle>
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0 text-[10px] px-1.5 py-0",
                hasIssues
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700",
              )}
            >
              <Icon
                name={hasIssues ? "TriangleAlert" : "CircleArrowUp"}
                size="xs"
                className="mr-0.5"
              />
              {hasIssues ? "Issues" : "Upgrade"}
            </Badge>
          </InlineStack>
        </BlockStack>
      </CardHeader>

      <CardContent className="p-2 flex flex-col gap-2">
        {diffInputs.length > 0 && (
          <BlockStack
            gap="3"
            className={cn(
              "p-2 border rounded-lg",
              hasInputChanges
                ? "bg-gray-50 border-blue-200"
                : "bg-gray-100 border-gray-200",
            )}
          >
            {diffInputs.map(({ entry, status }) => (
              <DiffInputRow
                key={`${status}-${entry.name}`}
                entry={entry}
                status={status}
              />
            ))}
          </BlockStack>
        )}

        {diffOutputs.length > 0 && (
          <BlockStack
            gap="3"
            className={cn(
              "p-2 border rounded-lg",
              hasOutputChanges
                ? "bg-gray-50 border-blue-200"
                : "bg-gray-100 border-gray-200",
            )}
          >
            {diffOutputs.map(({ entry, status }) => (
              <DiffOutputRow
                key={`${status}-${entry.name}`}
                entry={entry}
                status={status}
              />
            ))}
          </BlockStack>
        )}

        {hasIssues && <IssuesBanner count={candidate.predictedIssues.length} />}
      </CardContent>
    </Card>
  );
}
