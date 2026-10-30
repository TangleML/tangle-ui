import { useId, useState } from "react";

import { PaginationControls } from "@/components/shared/PaginationControls";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Text } from "@/components/ui/typography";
import { useDebouncedSearchValue } from "@/hooks/useDebouncedSearchValue";
import { useRemotePipelinesPage } from "@/hooks/useRemotePipelinesPage";
import { useBackend } from "@/providers/BackendProvider";
import { pipelinePickerQuery } from "@/routes/v2/pages/Tangent/services/pipelinePickerQuery";
import { PipelineSpecApiError } from "@/services/pipelineSpecService";
import { remotePipelineResourceInput } from "@/services/projects/pipelineResource";
import type { CreateResourceInput } from "@/services/projects/types";
import type { RemotePipeline } from "@/services/remotePipelinesService";
import { formatDate } from "@/utils/date";

const UNTITLED_PIPELINE = "Untitled Pipeline";
const COLUMN_NAMES = ["Name", "ID", "Owner", "Updated"];

interface PickerPages {
  filterQuery?: string;
  tokens: string[];
}

interface ListState {
  ready: boolean;
  configured: boolean;
  available: boolean;
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  search: string;
  onlyMine: boolean;
}

function listMessage(state: ListState): string | undefined {
  if (!state.ready) return "Loading pipelines…";
  if (!state.configured) return "Configure a backend to browse pipelines.";
  if (!state.available) return "Pipelines are unavailable.";
  if (state.isLoading) return "Loading pipelines…";
  if (state.error) {
    return state.error instanceof PipelineSpecApiError
      ? state.error.message
      : "Failed to load pipelines.";
  }
  if (!state.isEmpty) return undefined;
  if (state.search) return `No pipelines match "${state.search}".`;
  return state.onlyMine
    ? "You have no saved pipelines yet."
    : "No pipelines found.";
}

interface RemotePipelinePickerProps {
  onChoose: (resource: CreateResourceInput) => void;
}

export function RemotePipelinePicker({ onChoose }: RemotePipelinePickerProps) {
  const { backendUrl, configured, available, ready } = useBackend();
  const onlyMineId = useId();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useDebouncedSearchValue(setSearch);
  const [onlyMine, setOnlyMine] = useState(true);

  const filterQuery = pipelinePickerQuery(search, onlyMine);
  const [pages, setPages] = useState<PickerPages>({ filterQuery, tokens: [] });
  if (pages.filterQuery !== filterQuery) {
    setPages({ filterQuery, tokens: [] });
  }
  const tokens = pages.filterQuery === filterQuery ? pages.tokens : [];

  const canFetch = ready && configured && available;
  const { data, isLoading, isFetching, error } = useRemotePipelinesPage(
    backendUrl,
    tokens.at(-1),
    canFetch,
    filterQuery,
  );
  const pipelines = data?.pipelines ?? [];
  const nextPageToken = data?.nextPageToken;

  const message = listMessage({
    ready,
    configured,
    available,
    isLoading,
    error,
    isEmpty: pipelines.length === 0,
    search: search.trim(),
    onlyMine,
  });

  function choose(pipeline: RemotePipeline) {
    onChoose(
      remotePipelineResourceInput(
        pipeline.id,
        pipeline.pipeline_name ?? UNTITLED_PIPELINE,
      ),
    );
  }

  function changePage(nextTokens: string[]) {
    setPages({ filterQuery, tokens: nextTokens });
  }

  return (
    <BlockStack gap="4" className="h-full w-full">
      <InlineStack gap="4" blockAlign="center" className="w-full">
        <div role="search" className="relative w-full max-w-md">
          <Icon
            name="Search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search by name or ID"
            placeholder="Search by name or ID..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <InlineStack gap="2" blockAlign="center">
          <Switch
            id={onlyMineId}
            checked={onlyMine}
            onCheckedChange={setOnlyMine}
          />
          <Label htmlFor={onlyMineId} className="font-normal">
            Only my pipelines
          </Label>
        </InlineStack>
      </InlineStack>
      <BlockStack className="min-h-0 w-full flex-1 overflow-y-auto">
        <Table aria-label="Pipelines" aria-busy={isFetching}>
          <TableHeader>
            <TableRow className="text-xs">
              {COLUMN_NAMES.map((name) => (
                <TableHead key={name} scope="col">
                  {name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {message ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_NAMES.length}
                  className="whitespace-normal text-center"
                >
                  <Text size="sm" tone="subdued">
                    {message}
                  </Text>
                </TableCell>
              </TableRow>
            ) : (
              pipelines.map((pipeline) => (
                <PipelineRow
                  key={pipeline.id}
                  pipeline={pipeline}
                  onChoose={choose}
                />
              ))
            )}
          </TableBody>
        </Table>
      </BlockStack>
      <PaginationControls
        currentPage={tokens.length + 1}
        hasPreviousPage={tokens.length > 0}
        hasNextPage={Boolean(nextPageToken)}
        disabled={!canFetch || isFetching}
        onPreviousPage={() => changePage(tokens.slice(0, -1))}
        onNextPage={() => {
          if (nextPageToken) changePage([...tokens, nextPageToken]);
        }}
        onReset={() => changePage([])}
      />
    </BlockStack>
  );
}

interface PipelineRowProps {
  pipeline: RemotePipeline;
  onChoose: (pipeline: RemotePipeline) => void;
}

function PipelineRow({ pipeline, onChoose }: PipelineRowProps) {
  const name = pipeline.pipeline_name ?? UNTITLED_PIPELINE;

  return (
    <TableRow className="cursor-pointer" onClick={() => onChoose(pipeline)}>
      <TableCell className="max-w-0 w-2/5">
        <Button
          variant="link"
          className="h-auto max-w-full justify-start p-0 text-foreground"
          title={name}
          onClick={(event) => {
            event.stopPropagation();
            onChoose(pipeline);
          }}
        >
          <Text size="sm" className="truncate">
            {name}
          </Text>
        </Button>
      </TableCell>
      <TableCell className="max-w-0">
        <Text
          size="xs"
          font="mono"
          tone="subdued"
          className="block truncate"
          title={pipeline.id}
        >
          {pipeline.id}
        </Text>
      </TableCell>
      <TableCell className="max-w-0">
        <Text size="sm" className="block truncate" title={pipeline.user_id}>
          {pipeline.user_id}
        </Text>
      </TableCell>
      <TableCell>
        <Text size="sm" tone="subdued" title={pipeline.updated_at}>
          {formatDate(pipeline.updated_at)}
        </Text>
      </TableCell>
    </TableRow>
  );
}
