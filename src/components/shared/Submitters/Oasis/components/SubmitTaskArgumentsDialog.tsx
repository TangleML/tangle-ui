import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useState } from "react";

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
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { fetchExecutionDetails } from "@/services/executionService";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec, InputSpec } from "@/utils/componentSpec";
import { getArgumentValue } from "@/utils/nodes/taskArguments";

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
          <Button onClick={handleConfirm}>Submit Run</Button>
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

  const { mutate: copyFromRunMutation, isPending: isCopyingFromRun } =
    useMutation({
      mutationFn: async (run: PipelineRun) => {
        const executionDetails = await fetchExecutionDetails(
          String(run.root_execution_id),
          backendUrl,
        );
        return executionDetails.task_spec.arguments;
      },
      onSuccess: (runArguments) => {
        if (runArguments) {
          const newArgs = Object.fromEntries(
            Object.entries(runArguments)
              .map(([name, _]) => [name, getArgumentValue(runArguments, name)])
              .filter(
                (entry): entry is [string, string] => entry[1] !== undefined,
              ),
          );
          onCopy(newArgs);
        }
        setPopoverOpen(false);
      },
      onError: (error) => {
        console.error("Failed to fetch run arguments:", error);
        setPopoverOpen(false);
      },
    });

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Icon name="Copy" />
          Copy from recent run
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100" align="end">
        <PipelineRunsList
          pipelineName={pipelineName}
          onRunClick={copyFromRunMutation}
          showTitle={false}
          showMoreButton={true}
          overviewConfig={{
            showName: false,
            showTaskStatusBar: false,
          }}
          disabled={isCopyingFromRun}
        />
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
