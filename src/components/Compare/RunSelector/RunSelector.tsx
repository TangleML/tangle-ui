import { Suspense, useEffect, useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import type { PipelineRun } from "@/types/pipelineRun";
import {
  type ComponentFileEntry,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { RunSelectionList } from "./RunSelectionList";
import { SelectionBar } from "./SelectionBar";

const MAX_SELECTIONS = 3;

interface RunSelectorProps {
  onCompare: (runs: PipelineRun[]) => void;
  /** Pre-select a pipeline from URL */
  initialPipelineName?: string;
}

type Pipelines = Map<string, ComponentFileEntry>;

const PipelineSelectorSkeleton = () => (
  <BlockStack gap="2">
    <Skeleton size="lg" shape="button" />
    <Skeleton size="full" />
  </BlockStack>
);

export const RunSelector = withSuspenseWrapper(
  ({ onCompare, initialPipelineName }: RunSelectorProps) => {
    const [pipelines, setPipelines] = useState<Pipelines>(new Map());
    const [selectedPipeline, setSelectedPipeline] = useState<string>(
      initialPipelineName ?? "",
    );
    const [selectedRuns, setSelectedRuns] = useState<PipelineRun[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      const fetchPipelines = async () => {
        setIsLoading(true);
        try {
          const result = await getAllComponentFilesFromList(
            USER_PIPELINES_LIST_NAME,
          );
          const sortedPipelines = new Map(
            [...result.entries()].sort((a, b) => {
              return (
                new Date(b[1].modificationTime).getTime() -
                new Date(a[1].modificationTime).getTime()
              );
            }),
          );
          setPipelines(sortedPipelines);

          // If initialPipelineName was provided but not valid, clear selection
          if (initialPipelineName && !result.has(initialPipelineName)) {
            setSelectedPipeline("");
          }
        } catch (error) {
          console.error("Failed to load pipelines:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchPipelines();
    }, [initialPipelineName]);

    const handlePipelineSelect = (value: string) => {
      setSelectedPipeline(value);
      setSelectedRuns([]);
    };

    const handleRunSelect = (run: PipelineRun, selected: boolean) => {
      if (selected) {
        if (selectedRuns.length < MAX_SELECTIONS) {
          setSelectedRuns([...selectedRuns, run]);
        }
      } else {
        setSelectedRuns(selectedRuns.filter((r) => r.id !== run.id));
      }
    };

    const handleCompare = () => {
      if (selectedRuns.length >= 2) {
        onCompare(selectedRuns);
      }
    };

    const handleClearSelection = () => {
      setSelectedRuns([]);
    };

    if (isLoading) {
      return <PipelineSelectorSkeleton />;
    }

    const pipelineNames = Array.from(pipelines.keys());

    return (
      <BlockStack gap="4" className="w-full">
        <BlockStack gap="2">
          <Label htmlFor="pipeline-select">Select Pipeline</Label>
          <Select value={selectedPipeline} onValueChange={handlePipelineSelect}>
            <SelectTrigger id="pipeline-select" className="w-full max-w-md">
              <SelectValue placeholder="Choose a pipeline..." />
            </SelectTrigger>
            <SelectContent>
              {pipelineNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </BlockStack>

        {selectedPipeline && (
          <BlockStack gap="2">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" size="lg" weight="semibold">
                Select Runs to Compare
              </Text>
              <Text size="sm" tone="subdued">
                Select 2-{MAX_SELECTIONS} runs
              </Text>
            </InlineStack>

            <Suspense fallback={<Skeleton size="full" />}>
              <RunSelectionList
                pipelineName={selectedPipeline}
                selectedRuns={selectedRuns}
                onRunSelect={handleRunSelect}
                maxSelections={MAX_SELECTIONS}
              />
            </Suspense>
          </BlockStack>
        )}

        {selectedRuns.length > 0 && (
          <SelectionBar
            selectedRuns={selectedRuns}
            onCompare={handleCompare}
            onClearSelection={handleClearSelection}
          />
        )}
      </BlockStack>
    );
  },
  PipelineSelectorSkeleton,
);

