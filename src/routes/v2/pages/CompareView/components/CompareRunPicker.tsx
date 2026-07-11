import { useQuery } from "@tanstack/react-query";

import type { ListPipelineJobsResponse } from "@/api/types.gen";
import { InfoBox } from "@/components/shared/InfoBox";
import { StatusIcon } from "@/components/shared/Status";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { formatDate } from "@/utils/date";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import { tracking } from "@/utils/tracking";

const PIPELINE_RUNS_QUERY_URL = "/api/pipeline_runs/";

interface CompareRunPickerProps {
  title: string;
  excludeRunId?: string;
  onSelect: (runId: string) => void;
}

export function CompareRunPicker({
  title,
  excludeRunId,
  onSelect,
}: CompareRunPickerProps) {
  const { backendUrl, configured, available } = useBackend();

  const { data, isLoading, error } = useQuery<ListPipelineJobsResponse>({
    queryKey: ["compare-run-picker", backendUrl],
    refetchOnWindowFocus: false,
    enabled: configured && available,
    queryFn: async () => {
      const url = new URL(PIPELINE_RUNS_QUERY_URL, backendUrl);
      url.searchParams.set("include_pipeline_names", "true");
      url.searchParams.set("include_execution_stats", "true");
      return fetchWithErrorHandling(url.toString());
    },
  });

  return (
    <BlockStack gap="3" className="w-full">
      <Heading level={3}>{title}</Heading>

      {isLoading && (
        <InlineStack gap="2" blockAlign="center">
          <Spinner /> <Text>Loading runs…</Text>
        </InlineStack>
      )}

      {error && (
        <InfoBox title="Error loading runs" variant="error" width="full">
          {error.message}
        </InfoBox>
      )}

      {data && (
        <BlockStack as="ul" gap="1">
          {(data.pipeline_runs ?? [])
            .filter((run) => `${run.id}` !== excludeRunId)
            .map((run) => {
              const runId = `${run.id}`;
              const status = getOverallExecutionStatusFromStats(
                run.execution_status_stats ?? undefined,
              );

              return (
                <InlineStack as="li" key={runId} className="w-full">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => onSelect(runId)}
                    {...tracking("compare_runs.run_picker.select_run")}
                  >
                    <InlineStack
                      gap="2"
                      blockAlign="center"
                      wrap="nowrap"
                      className="w-full"
                    >
                      <StatusIcon status={status} />
                      <Text as="span" size="sm" className="truncate">
                        {run.pipeline_name ?? "Unknown pipeline"}
                      </Text>
                      <Text as="span" size="xs" tone="subdued">
                        #{runId}
                      </Text>
                      <Text as="span" size="xs" tone="subdued">
                        {run.created_at ? formatDate(run.created_at) : ""}
                      </Text>
                    </InlineStack>
                  </Button>
                </InlineStack>
              );
            })}
        </BlockStack>
      )}
    </BlockStack>
  );
}
