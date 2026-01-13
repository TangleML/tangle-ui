import { type ChangeEvent, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, InputSpec } from "@/utils/componentSpec";

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
  const initialArgs = getArgumentsFromInputs(componentSpec);

  const [taskArguments, setTaskArguments] =
    useState<Record<string, string>>(initialArgs);

  const inputs = componentSpec.inputs ?? [];

  const handleValueChange = (name: string, value: string) => {
    setTaskArguments((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleConfirm = () => onConfirm(taskArguments);

  const handleCancel = () => {
    setTaskArguments(initialArgs);
    onCancel();
  };

  const hasInputs = inputs.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Run with Arguments</DialogTitle>
          <DialogDescription>
            {hasInputs
              ? "Customize the pipeline input values before submitting."
              : "This pipeline has no configurable inputs."}
          </DialogDescription>
        </DialogHeader>

        {hasInputs && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <BlockStack gap="4" className="p-1">
              {inputs.map((input) => (
                <ArgumentField
                  key={input.name}
                  input={input}
                  value={taskArguments[input.name] ?? ""}
                  onChange={handleValueChange}
                />
              ))}
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

interface ArgumentFieldProps {
  input: InputSpec;
  value: string;
  onChange: (name: string, value: string) => void;
}

const ArgumentField = ({ input, value, onChange }: ArgumentFieldProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(input.name, e.target.value);
  };

  const typeLabel = typeSpecToString(input.type);
  const isRequired = !input.optional;
  const placeholder = input.default ?? "";

  return (
    <BlockStack gap="1">
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
        className={cn(isRequired && !value && !placeholder && "border-red-300")}
      />
    </BlockStack>
  );
};
