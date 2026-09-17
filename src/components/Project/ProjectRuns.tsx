import { Link } from "@tanstack/react-router";

import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heading, Text } from "@/components/ui/typography";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatDate } from "@/utils/date";
import { tracking } from "@/utils/tracking";

const UNNAMED_PIPELINE = "Unnamed pipeline";

interface ProjectRunsProps {
  projectId: string;
}

export function ProjectRuns({ projectId }: ProjectRunsProps) {
  const { data, isPending, error } = useProjectRuns(projectId);

  return (
    <BlockStack gap="2">
      <Heading level={2}>
        {data && data.items.length > 0 ? `Runs (${data.items.length})` : "Runs"}
      </Heading>

      {isPending && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> Loading...
        </InlineStack>
      )}

      {error && (
        <InfoBox title="Error loading runs" variant="error">
          {error.message}
        </InfoBox>
      )}

      {data && data.items.length === 0 && (
        <Text size="sm" tone="subdued">
          Nothing in this project has been run yet
        </Text>
      )}

      {data && data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pipeline</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Started by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <Link
                    to={getDefaultRunPath(run.id)}
                    className="underline"
                    {...tracking("projects.project_runs.open_run")}
                  >
                    {run.pipelineName ?? UNNAMED_PIPELINE}
                  </Link>
                </TableCell>
                <TableCell>
                  <Text tone="subdued">{formatDate(run.createdAt)}</Text>
                </TableCell>
                <TableCell>
                  <Text tone="subdued">{run.createdBy ?? "Unknown"}</Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data?.nextPageToken && (
        <Text size="sm" tone="subdued">
          {`Showing the ${data.items.length} most recent runs.`}
        </Text>
      )}
    </BlockStack>
  );
}
