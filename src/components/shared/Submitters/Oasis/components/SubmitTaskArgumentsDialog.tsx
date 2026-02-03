import { useMutation } from "@tanstack/react-query";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";

import type { TaskSpecOutput } from "@/api/types.gen";
import { PipelineRunsList } from "@/components/shared/PipelineRunDisplay/PipelineRunsList";
import { typeSpecToString } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/ArgumentsEditor/utils";
import { getArgumentsFromInputs } from "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs";
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
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchExecutionDetails,
  fetchPipelineRun,
} from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec, InputSpec } from "@/utils/componentSpec";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";
import { validateArguments } from "@/utils/validations";

type TaskArguments = TaskSpecOutput["arguments"];

interface SubmitTaskArgumentsDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (args: Record<string, string>) => void;
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

  const [taskArguments, setTaskArguments] =
    useState<Record<string, string>>(initialArgs);

  // Track highlighted args with a version key to re-trigger CSS animation
  const [highlightedArgs, setHighlightedArgs] = useState<Map<string, number>>(
    new Map(),
  );

  const inputs = componentSpec.inputs ?? [];

  const [isValidToSubmit, setIsValidToSubmit] = useState(
    validateArguments(inputs, taskArguments),
  );

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

  const handleValueChange = (name: string, value: string) => {
    setTaskArguments((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
    setIsValidToSubmit(validateArguments(inputs, taskArguments));
  }, [inputs, taskArguments]);

  const handleConfirm = () => onConfirm(taskArguments);

  const handleCancel = () => {
    setTaskArguments(initialArgs);
    setHighlightedArgs(new Map());
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
              <InlineStack align="end" className="w-full">
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

        {hasInputs && (
          <ScrollArea className="max-h-[60vh] pr-4 w-full">
            <BlockStack gap="4" className="p-1">
              {inputs.map((input) => {
                const highlightVersion = highlightedArgs.get(input.name);
                return (
                  <ArgumentField
                    key={`${input.name}-${highlightVersion ?? "static"}`}
                    input={input}
                    value={taskArguments[input.name] ?? ""}
                    onChange={handleValueChange}
                    isHighlighted={highlightVersion !== undefined}
                  />
                );
              })}
            </BlockStack>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValidToSubmit}>
            Submit Run
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
  value: string;
  onChange: (name: string, value: string) => void;
  isHighlighted?: boolean;
}

const ArgumentField = ({
  input,
  value,
  onChange,
  isHighlighted,
}: ArgumentFieldProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(input.name, e.target.value);
  };

  const typeLabel = typeSpecToString(input.type);
  const isRequired = !input.optional;
  const placeholder = input.default ?? "";

  return (
    <BlockStack
      gap="1"
      className={cn(
        "rounded-md px-1 py-1",
        isHighlighted && "animate-highlight-fade",
      )}
    >
      <InlineStack gap="2" align="start">
        <Paragraph size="sm" className="wrap-break-word">
          {input.name}
        </Paragraph>
        <Paragraph size="xs" tone="subdued" className="truncate">
          ({typeLabel}
          {isRequired ? "*" : ""})
        </Paragraph>
      </InlineStack>

      {input.description && (
        <Paragraph size="xs" tone="subdued" className="italic">
          {input.description}
        </Paragraph>
      )}

      <Input
        id={input.name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          isRequired && !value && !placeholder && "border-red-300",
          // todo: remove this once we have a proper style in Input component
          "bg-white!",
        )}
      />
    </BlockStack>
  );
};
