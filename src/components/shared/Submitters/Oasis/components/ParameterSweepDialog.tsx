import { useState } from "react";

import { getArgumentsFromInputs } from "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paragraph, Text } from "@/components/ui/typography";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import {
  expandSweep,
  getSweepRunCount,
  parseRange,
  type SweepParameter,
  validateSweep,
} from "@/utils/parameterSweep";

import { SweepParameterField } from "./SweepParameterField";
import { MAX_PREVIEW_ROWS, SweepPreviewTable } from "./SweepPreviewTable";

interface ParameterSweepDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (argSets: Record<string, ArgumentType>[]) => void;
  componentSpec: ComponentSpec;
}

export const ParameterSweepDialog = ({
  open,
  onCancel,
  onConfirm,
  componentSpec,
}: ParameterSweepDialogProps) => {
  const inputs = componentSpec.inputs ?? [];
  const baseArgs = getArgumentsFromInputs(componentSpec);

  const [sweepParams, setSweepParams] = useState<SweepParameter[]>(() =>
    inputs.map((input) => ({ name: input.name, values: [] })),
  );

  const activeParams = sweepParams.filter((p) => p.values.length > 0);
  const runCount = getSweepRunCount(sweepParams);
  const validationError = validateSweep(sweepParams);
  const hasActiveParams = activeParams.length > 0;

  const updateParam = (
    paramName: string,
    updater: (p: SweepParameter) => SweepParameter,
  ) => {
    setSweepParams((prev) =>
      prev.map((p) => (p.name === paramName ? updater(p) : p)),
    );
  };

  const handleAddValues = (paramName: string, raw: string) => {
    const newValues = raw
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (newValues.length === 0) return;
    updateParam(paramName, (p) => ({
      ...p,
      values: [...p.values, ...newValues],
    }));
  };

  const handleRemoveValue = (paramName: string, index: number) => {
    updateParam(paramName, (p) => ({
      ...p,
      values: p.values.filter((_, i) => i !== index),
    }));
  };

  const handleApplyRange = (paramName: string, rangeStr: string) => {
    const values = parseRange(rangeStr);
    if (values) {
      updateParam(paramName, (p) => ({ ...p, values }));
    }
  };

  const handleConfirm = () => {
    onConfirm(expandSweep(baseArgs, sweepParams));
  };

  const handleCancel = () => {
    setSweepParams(inputs.map((input) => ({ name: input.name, values: [] })));
    onCancel();
  };

  const previewCombinations = hasActiveParams
    ? expandSweep(baseArgs, sweepParams).slice(0, MAX_PREVIEW_ROWS)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parameter Sweep</DialogTitle>
          <DialogDescription className="hidden">
            Define multiple values per parameter to explore combinations.
          </DialogDescription>
          <Paragraph tone="subdued" size="sm">
            Add multiple values to parameters and run all combinations
            automatically.
          </Paragraph>
        </DialogHeader>

        <Tabs defaultValue="parameters">
          <TabsList>
            <TabsTrigger value="parameters">
              <Icon name="SlidersHorizontal" size="sm" />
              Parameters
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!hasActiveParams}>
              <Icon name="Table" size="sm" />
              Preview
              {hasActiveParams && runCount > 0 && (
                <Badge
                  variant="secondary"
                  size="xs"
                  shape="rounded"
                  className="w-auto min-w-4 px-1"
                >
                  {runCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parameters">
            <div className="max-h-[40vh] overflow-y-auto pr-2">
              <BlockStack gap="3" className="p-1">
                {inputs.map((input) => {
                  const sweepParam = sweepParams.find(
                    (p) => p.name === input.name,
                  );
                  return (
                    <SweepParameterField
                      key={input.name}
                      input={input}
                      values={sweepParam?.values ?? []}
                      onAddValue={(value) => handleAddValues(input.name, value)}
                      onRemoveValue={(index) =>
                        handleRemoveValue(input.name, index)
                      }
                      onApplyRange={(rangeStr) =>
                        handleApplyRange(input.name, rangeStr)
                      }
                      onClear={() =>
                        updateParam(input.name, (p) => ({ ...p, values: [] }))
                      }
                    />
                  );
                })}
                {inputs.length === 0 && (
                  <Paragraph tone="subdued" size="sm">
                    This pipeline has no configurable inputs.
                  </Paragraph>
                )}
              </BlockStack>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <SweepPreviewTable
              combinations={previewCombinations}
              sweepParamNames={activeParams.map((p) => p.name)}
              totalCount={runCount}
            />
          </TabsContent>
        </Tabs>

        <BlockStack gap="1">
          {hasActiveParams && (
            <Paragraph size="xs" tone="subdued">
              {activeParams.map((p) => p.values.length).join(" x ")} ={" "}
              <Text as="span" size="xs" weight="semibold">
                {runCount} {runCount === 1 ? "run" : "runs"}
              </Text>
            </Paragraph>
          )}
          {validationError && (
            <Paragraph size="xs" tone="critical">
              {validationError}
            </Paragraph>
          )}
        </BlockStack>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={validationError !== null || !hasActiveParams}
            data-testid="sweep-submit-button"
          >
            {hasActiveParams && runCount > 0
              ? `Submit ${runCount} Runs`
              : "Submit Sweep"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
