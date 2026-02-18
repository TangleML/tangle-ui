import { useState } from "react";
import type { DateRange } from "react-day-picker";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import { AnnotationFilterInput } from "@/components/shared/AnnotationFilterInput/AnnotationFilterInput";
import { PipelineRunFiltersBar } from "@/components/shared/PipelineRunFiltersBar/PipelineRunFiltersBar";
import { StatusFilterSelect } from "@/components/shared/StatusFilterSelect/StatusFilterSelect";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useRunSearchParams } from "@/hooks/useRunSearchParams";
import type { AnnotationFilter } from "@/types/pipelineRunFilters";

const FilterTest = () => {
  const { filters } = useRunSearchParams();

  // Local state for individual component demos
  const [demoAnnotations, setDemoAnnotations] = useState<AnnotationFilter[]>([
    { key: "team", value: "ml" },
  ]);
  const [demoDateRange, setDemoDateRange] = useState<DateRange | undefined>();
  const [demoStatus, setDemoStatus] = useState<
    ContainerExecutionStatus | undefined
  >();

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <BlockStack gap="8">
        <BlockStack gap="2">
          <Text as="h1" size="xl" weight="bold">
            Filter Test Page
          </Text>
          <Text tone="subdued">
            Testing filter components and URL synchronization
          </Text>
        </BlockStack>

        {/* Section 1: Full Filter Bar */}
        <BlockStack gap="3">
          <Text as="h2" size="lg" weight="semibold">
            Full Filter Bar
          </Text>
          <Text size="sm" tone="subdued">
            Integrated component with all filters and URL sync
          </Text>
          <PipelineRunFiltersBar totalCount={128} filteredCount={42} />
        </BlockStack>

        {/* Debug: Current URL State */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <BlockStack gap="2">
            <Text size="sm" weight="semibold">
              Current URL Filter State
            </Text>
            <pre className="text-xs break-all whitespace-pre-wrap bg-background p-2 rounded">
              {JSON.stringify(filters, null, 2)}
            </pre>
          </BlockStack>
        </div>

        {/* Section 2: Individual Components */}
        <BlockStack gap="6">
          <BlockStack gap="2">
            <Text as="h2" size="lg" weight="semibold">
              Individual Components
            </Text>
            <Text size="sm" tone="subdued">
              Standalone components with local state (not synced to URL)
            </Text>
          </BlockStack>

          {/* Status Filter Select */}
          <div className="rounded-lg border p-4">
            <BlockStack gap="3">
              <BlockStack gap="1">
                <Text weight="semibold">StatusFilterSelect</Text>
                <Text size="sm" tone="subdued">
                  Filter by pipeline run execution status
                </Text>
              </BlockStack>
              <StatusFilterSelect value={demoStatus} onChange={setDemoStatus} />
              <div className="bg-muted/50 p-2 rounded">
                <Text size="xs" tone="subdued">
                  State: {demoStatus ?? "undefined"}
                </Text>
              </div>
            </BlockStack>
          </div>

          {/* Date Picker */}
          <div className="rounded-lg border p-4">
            <BlockStack gap="3">
              <BlockStack gap="1">
                <Text weight="semibold">DatePickerWithRange</Text>
                <Text size="sm" tone="subdued">
                  Select a date range with two-month calendar
                </Text>
              </BlockStack>
              <DatePickerWithRange
                value={demoDateRange}
                onChange={setDemoDateRange}
                placeholder="Select date range"
              />
              <div className="bg-muted/50 p-2 rounded">
                <Text size="xs" tone="subdued">
                  State:{" "}
                  {demoDateRange
                    ? JSON.stringify({
                        from: demoDateRange.from?.toISOString(),
                        to: demoDateRange.to?.toISOString(),
                      })
                    : "undefined"}
                </Text>
              </div>
            </BlockStack>
          </div>

          {/* Annotation Filter Input */}
          <div className="rounded-lg border p-4">
            <BlockStack gap="3">
              <BlockStack gap="1">
                <Text weight="semibold">AnnotationFilterInput</Text>
                <Text size="sm" tone="subdued">
                  Add/remove key-value annotation filters
                </Text>
              </BlockStack>
              <AnnotationFilterInput
                filters={demoAnnotations}
                onChange={setDemoAnnotations}
              />
              <div className="bg-muted/50 p-2 rounded">
                <Text size="xs" tone="subdued">
                  State: {JSON.stringify(demoAnnotations)}
                </Text>
              </div>
            </BlockStack>
          </div>
        </BlockStack>
      </BlockStack>
    </div>
  );
};

export default FilterTest;
