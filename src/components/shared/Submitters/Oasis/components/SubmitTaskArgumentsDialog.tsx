import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, type KeyboardEvent, useRef, useState } from "react";

import type { TaskSpecOutput } from "@/api/types.gen";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { DynamicDataArgumentInput } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/DynamicDataArgumentInput";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { getArgumentsFromInputs } from "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs";
import { SelectSecretDialog } from "@/components/shared/SecretsManagement/SelectSecretDialog";
import {
  createSecretArgument,
  extractSecretName,
} from "@/components/shared/SecretsManagement/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchExecutionDetails,
  fetchPipelineRun,
} from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import { getBulkRunCount, parseBulkValues } from "@/utils/bulkSubmission";
import {
  type ArgumentType,
  type ComponentSpec,
  type InputSpec,
  isSecretArgument,
} from "@/utils/componentSpec";
import { generateCsvTemplate } from "@/utils/csvBulkArgumentExport";
import { mapCsvToArguments } from "@/utils/csvBulkArgumentImport";
import { mapJsonToArguments } from "@/utils/jsonBulkArgumentImport";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";
import { validateArguments } from "@/utils/validations";

type TaskArguments = TaskSpecOutput["arguments"];

interface SubmitTaskArgumentsDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (
    args: Record<string, ArgumentType>,
    notes: string,
    bulkInputNames: Set<string>,
  ) => void;
  componentSpec: ComponentSpec;
}

export const SubmitTaskArgumentsDialog = ({
  open,
  onCancel,
  onConfirm,
  componentSpec,
}: SubmitTaskArgumentsDialogProps) => {
  const notify = useToastNotification();
  const initialArgs = getArgumentsFromInputs(componentSpec);

  const [runNotes, setRunNotes] = useState<string>("");
  const [taskArguments, setTaskArguments] =
    useState<Record<string, ArgumentType>>(initialArgs);

  // Track highlighted args with a version key to re-trigger CSS animation
  const [highlightedArgs, setHighlightedArgs] = useState<Map<string, number>>(
    new Map(),
  );

  const [bulkInputNames, setBulkInputNames] = useState<Set<string>>(new Set());

  const inputs = componentSpec.inputs ?? [];

  const bulkRunCount = getBulkRunCount(taskArguments, bulkInputNames);
  const hasBulkMismatch = bulkRunCount === -1;
  const isBulkMode = bulkInputNames.size > 0;
  const effectiveRunCount = isBulkMode ? Math.max(bulkRunCount, 0) : 1;

  const isValidToSubmit =
    validateArguments(inputs, taskArguments) &&
    !hasBulkMismatch &&
    bulkRunCount > 0;

  const handleCopyFromRun = (args: Record<string, string>) => {
    const diff = Object.entries(args).filter(
      ([key, value]) => taskArguments[key] !== value,
    );

    setTaskArguments((prev) => ({
      ...prev,
      ...args,
    }));

    const version = Date.now();
    setHighlightedArgs(new Map(diff.map(([key]) => [key, version])));

    notify(`Copied ${diff.length} arguments`, "success");
  };

  const handleValueChange = (name: string, value: ArgumentType) => {
    setTaskArguments((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBulkToggle = (name: string, enabled: boolean) => {
    setBulkInputNames((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  };

  const handleFileImport = (fileText: string, fileExtension: string) => {
    const isJson = fileExtension === ".json";

    const result = isJson
      ? mapJsonToArguments(fileText, inputs, taskArguments)
      : mapCsvToArguments(fileText, inputs, taskArguments);

    if (result.rowCount === 0 && result.changedInputNames.length === 0) {
      notify(
        isJson
          ? "JSON file is empty or contains invalid data"
          : "CSV file is empty or contains only headers",
        "warning",
      );
      return;
    }

    setTaskArguments((prev) => ({ ...prev, ...result.values }));

    if (result.enableBulk) {
      setBulkInputNames((prev) => {
        const next = new Set(prev);
        for (const name of Object.keys(result.values)) {
          next.add(name);
        }
        return next;
      });
    }

    const version = Date.now();
    setHighlightedArgs(
      new Map(result.changedInputNames.map((name) => [name, version])),
    );

    const inputCount = result.changedInputNames.length;
    const hasWarnings =
      result.unmatchedColumns.length > 0 ||
      result.skippedSecretInputs.length > 0;

    let message = result.enableBulk
      ? `Imported ${result.rowCount} rows across ${inputCount} input${inputCount !== 1 ? "s" : ""}`
      : `Imported ${inputCount} input${inputCount !== 1 ? "s" : ""} from ${isJson ? "JSON" : "CSV"}`;

    if (result.unmatchedColumns.length > 0) {
      const keyLabel = isJson ? "keys" : "columns";
      message += `. Ignored ${keyLabel}: ${result.unmatchedColumns.join(", ")}`;
    }

    if (result.skippedSecretInputs.length > 0) {
      message += `. Skipped secrets: ${result.skippedSecretInputs.join(", ")}`;
    }

    notify(message, hasWarnings ? "warning" : "success");
  };

  const handleConfirm = () =>
    onConfirm(taskArguments, runNotes, bulkInputNames);

  const handleCancel = () => {
    setTaskArguments(initialArgs);
    setRunNotes("");
    setHighlightedArgs(new Map());
    setBulkInputNames(new Set());
    onCancel();
  };

  const hasInputs = inputs.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Run with Arguments</DialogTitle>
          <DialogDescription className="hidden">
            {hasInputs
              ? "Customize the pipeline input values before submitting."
              : "This pipeline has no configurable inputs."}
          </DialogDescription>

          {hasInputs ? (
            <BlockStack gap="2">
              <Paragraph tone="subdued" size="sm">
                Customize the pipeline input values before submitting.
              </Paragraph>
              <InlineStack align="end" gap="1" className="w-full">
                <DownloadCsvTemplateButton
                  inputs={inputs}
                  taskArguments={taskArguments}
                  bulkInputNames={bulkInputNames}
                  pipelineName={componentSpec.name}
                />
                <ImportFileButton onImport={handleFileImport} />
                <CopyFromRunPopover
                  componentSpec={componentSpec}
                  onCopy={handleCopyFromRun}
                />
              </InlineStack>
            </BlockStack>
          ) : (
            <Paragraph tone="subdued">
              This pipeline has no configurable inputs.
            </Paragraph>
          )}
        </DialogHeader>

        {isBulkMode && (
          <BlockStack
            gap="1"
            className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
          >
            <Paragraph size="xs" weight="semibold">
              Bulk mode
            </Paragraph>
            <Paragraph size="xs">
              Enter comma-separated values for bulk inputs (e.g.{" "}
              <Paragraph as="span" size="xs" className="font-mono">
                A, B, C
              </Paragraph>
              ). Each value creates a separate run. Non-bulk inputs reuse their
              single value across all runs. If multiple inputs are set to bulk,
              they must have the same number of values. You can also import a
              CSV or JSON file to populate values automatically.
            </Paragraph>
          </BlockStack>
        )}

        {hasInputs && (
          <ScrollArea className="max-h-[60vh] pr-4 w-full">
            <BlockStack gap="4" className="p-1">
              {inputs.map((input) => {
                const highlightVersion = highlightedArgs.get(input.name);
                const isBulkEnabled = bulkInputNames.has(input.name);
                const currentValue = taskArguments[input.name];
                const bulkValueCount =
                  isBulkEnabled && typeof currentValue === "string"
                    ? parseBulkValues(currentValue).length
                    : 0;

                return (
                  <ArgumentField
                    key={`${input.name}-${highlightVersion ?? "static"}`}
                    input={input}
                    value={currentValue}
                    onChange={handleValueChange}
                    isHighlighted={highlightVersion !== undefined}
                    isBulkEnabled={isBulkEnabled}
                    onBulkToggle={handleBulkToggle}
                    bulkValueCount={bulkValueCount}
                  />
                );
              })}
            </BlockStack>
          </ScrollArea>
        )}

        <BlockStack gap="2">
          <Paragraph tone="subdued" size="sm">
            Run Notes
          </Paragraph>
          <Textarea
            value={runNotes}
            onChange={(e) => setRunNotes(e.target.value)}
            placeholder="Share context about this pipeline run..."
            className="text-xs!"
          />
        </BlockStack>

        {isBulkMode && (
          <InlineStack gap="2" align="start" className="px-1">
            {hasBulkMismatch ? (
              <Paragraph size="xs" tone="critical">
                Bulk inputs have different numbers of values. All bulk inputs
                must have the same count.
              </Paragraph>
            ) : (
              <Paragraph size="xs" tone="subdued">
                This will submit{" "}
                <Paragraph as="span" size="xs" weight="semibold">
                  {effectiveRunCount}
                </Paragraph>{" "}
                {effectiveRunCount === 1 ? "run" : "runs"}.
              </Paragraph>
            )}
          </InlineStack>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValidToSubmit}>
            {isBulkMode && effectiveRunCount > 1
              ? `Submit ${effectiveRunCount} Runs`
              : "Submit Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CopyFromRunPopover = ({
  componentSpec,
  onCopy,
}: {
  componentSpec: ComponentSpec;
  onCopy: (args: Record<string, string>) => void;
}) => {
  const { backendUrl } = useBackend();
  const pipelineName = componentSpec.name;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customRunId, setCustomRunId] = useState("");

  const {
    mutate: copyFromRunMutation,
    isPending: isCopyingFromRun,
    isError,
  } = useMutation({
    /**
     * @param run - The run to copy arguments from. Can be a run ID or a run object.
     * @returns
     */
    mutationFn: async (run: PipelineRun | string) => {
      const executionId =
        typeof run === "string"
          ? (await fetchPipelineRun(run, backendUrl)).root_execution_id
          : String(run.root_execution_id);

      const executionDetails = await fetchExecutionDetails(
        executionId,
        backendUrl,
      );
      return executionDetails.task_spec.arguments;
    },
    onSuccess: (runArguments: TaskArguments) => {
      if (runArguments) {
        const newArgs = extractTaskArguments(runArguments, componentSpec);
        onCopy(newArgs);
      }
      setPopoverOpen(false);
      setCustomRunId("");
    },
    onError: (error) => {
      console.error("Failed to fetch run arguments:", error);
    },
  });

  const handleCustomRunIdSubmit = () => {
    const trimmedId = customRunId.trim();
    if (trimmedId) {
      copyFromRunMutation(trimmedId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCustomRunIdSubmit();
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Icon name="Copy" />
          Copy from recent run
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100" align="end">
        <BlockStack gap="4">
          <BlockStack gap="2">
            <Paragraph size="sm" weight="semibold">
              Enter run ID
            </Paragraph>
            <InlineStack gap="2" fill>
              <Input
                placeholder="Run ID"
                value={customRunId}
                onChange={(e) => setCustomRunId(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isCopyingFromRun}
                className={cn(isError && "border-red-300", "flex-1")}
              />
              <Button
                size="sm"
                onClick={handleCustomRunIdSubmit}
                disabled={isCopyingFromRun || !customRunId.trim()}
              >
                {isCopyingFromRun ? <Spinner /> : <Icon name="ArrowRight" />}
              </Button>
            </InlineStack>
            {isError && (
              <Paragraph size="xs" tone="critical">
                Failed to fetch run. Please check the run ID.
              </Paragraph>
            )}
          </BlockStack>

          <BlockStack gap="2">
            <Paragraph size="sm" weight="semibold">
              Or select from recent runs
            </Paragraph>
            <PipelineRunsList
              pipelineName={pipelineName}
              onRunClick={copyFromRunMutation}
              showTitle={false}
              showMoreButton={true}
              overviewConfig={{
                showName: false,
                showDescription: true,
                showTaskStatusBar: false,
              }}
              disabled={isCopyingFromRun}
            />
          </BlockStack>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
};

interface ArgumentFieldProps {
  input: InputSpec;
  value: ArgumentType | undefined;
  onChange: (name: string, value: ArgumentType) => void;
  isHighlighted?: boolean;
  isBulkEnabled?: boolean;
  onBulkToggle?: (name: string, enabled: boolean) => void;
  bulkValueCount?: number;
}

const ArgumentField = ({
  input,
  value,
  onChange,
  isHighlighted,
  isBulkEnabled = false,
  onBulkToggle,
  bulkValueCount = 0,
}: ArgumentFieldProps) => {
  const [isSelectSecretDialogOpen, setIsSelectSecretDialogOpen] =
    useState(false);

  const isValueSecret = isSecretArgument(value);
  const secretName = isValueSecret ? extractSecretName(value) : null;
  const stringValue = typeof value === "string" ? value : "";
  const canBeBulk = !isValueSecret;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(input.name, e.target.value);
  };

  const handleSecretSelect = (selectedSecretName: string) => {
    onChange(input.name, createSecretArgument(selectedSecretName));
    setIsSelectSecretDialogOpen(false);
  };

  const handleClearSecret = () => {
    onChange(input.name, "");
  };

  const typeLabel = typeSpecToString(input.type);
  const isRequired = !input.optional;
  const placeholder = isBulkEnabled
    ? "value1, value2, value3"
    : (input.default ?? "");
  const hasValidValue =
    isValueSecret || Boolean(stringValue) || Boolean(placeholder);

  return (
    <>
      <BlockStack
        gap="1"
        className={cn(
          "rounded-md px-1 py-1",
          isHighlighted && "animate-highlight-fade",
        )}
      >
        <InlineStack gap="2" align="start" className="w-full">
          <Paragraph size="sm" className="wrap-break-word">
            {input.name}
          </Paragraph>
          <Paragraph size="xs" tone="subdued" className="truncate">
            ({typeLabel}
            {isRequired ? "*" : ""})
          </Paragraph>
          <div className="flex-1" />
          {canBeBulk && (
            <InlineStack gap="1" align="center">
              <Label
                htmlFor={`bulk-${input.name}`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Bulk
              </Label>
              <Switch
                id={`bulk-${input.name}`}
                checked={isBulkEnabled}
                onCheckedChange={(checked) =>
                  onBulkToggle?.(input.name, checked)
                }
                className="scale-75"
              />
              {isBulkEnabled && bulkValueCount > 0 && (
                <Badge variant="secondary" size="xs" shape="rounded">
                  {bulkValueCount}
                </Badge>
              )}
            </InlineStack>
          )}
        </InlineStack>

        {input.description && (
          <Paragraph size="xs" tone="subdued" className="italic">
            {input.description}
          </Paragraph>
        )}

        <div className="relative group w-full">
          {isValueSecret && secretName ? (
            <DynamicDataArgumentInput
              displayValue={secretName}
              icon="Lock"
              onClear={handleClearSecret}
            />
          ) : (
            <>
              <Input
                id={input.name}
                value={stringValue}
                onChange={handleChange}
                placeholder={placeholder}
                className={cn(
                  isRequired && !hasValidValue && "border-red-300",
                  "group-hover:pr-8",
                  "bg-white!",
                )}
              />
              <InlineStack className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 px-1 bg-white">
                <TooltipButton
                  onClick={() => setIsSelectSecretDialogOpen(true)}
                  className="hover:bg-transparent hover:text-blue-500 hidden group-hover:flex"
                  variant="ghost"
                  size="xs"
                  tooltip="Use Secret"
                >
                  <Icon name="Lock" />
                </TooltipButton>
              </InlineStack>
            </>
          )}
        </div>
      </BlockStack>

      <SelectSecretDialog
        open={isSelectSecretDialogOpen}
        onOpenChange={setIsSelectSecretDialogOpen}
        onSelect={handleSecretSelect}
      />
    </>
  );
};

const DownloadCsvTemplateButton = ({
  inputs,
  taskArguments,
  bulkInputNames,
  pipelineName,
}: {
  inputs: InputSpec[];
  taskArguments: Record<string, ArgumentType>;
  bulkInputNames: Set<string>;
  pipelineName?: string;
}) => {
  const handleDownload = () => {
    const csv = generateCsvTemplate(inputs, taskArguments, bulkInputNames);
    if (!csv) return;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pipelineName ?? "pipeline"}-arguments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleDownload}>
      <Icon name="Download" />
      Template
    </Button>
  );
};

const ImportFileButton = ({
  onImport,
}: {
  onImport: (fileText: string, fileExtension: string) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.includes(".")
      ? `.${file.name.split(".").pop()?.toLowerCase()}`
      : "";

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        onImport(text, extension);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Icon name="Upload" />
        Import
      </Button>
    </>
  );
};
