import MonacoEditor from "@monaco-editor/react";
import { useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack, InlineStack } from "@/components/ui/layout";

import { DEFAULT_MONACO_OPTIONS } from "../constants";
import { useComponentSpecValidator } from "../useComponentSpecValidator";
import { ComponentSpecErrorsList } from "./ComponentSpecErrorsList";
import { PreviewTaskNodeCard } from "./PreviewTaskNodeCard";

export const YamlComponentEditor = withSuspenseWrapper(
  ({
    text,
    onComponentTextChange,
    onErrorsChange,
  }: {
    text: string;
    onComponentTextChange: (yaml: string) => void;
    onErrorsChange: (errors: string[]) => void;
  }) => {
    const [componentText, setComponentText] = useState(text);
    const validateComponentSpec = useComponentSpecValidator();
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const handleComponentTextChange = (value: string | undefined) => {
      const validationResult = validateComponentSpec(value ?? "");

      if (!validationResult.valid) {
        const errors = validationResult.errors ?? ["Invalid component spec"];
        setValidationErrors(errors);
        onErrorsChange(errors);
        return;
      }

      setComponentText(value ?? "");
      onComponentTextChange(value ?? "");
      setValidationErrors([]);
      onErrorsChange([]);
    };

    return (
      <InlineStack className="w-full h-full" gap="4">
        <BlockStack className="flex-1 h-full pt-7" data-testid="yaml-editor">
          <BlockStack className="flex-1 relative">
            <div className="absolute inset-0">
              <MonacoEditor
                defaultLanguage={"yaml"}
                theme="vs-dark"
                value={componentText}
                onChange={handleComponentTextChange}
                options={DEFAULT_MONACO_OPTIONS}
              />
            </div>
          </BlockStack>
          <ComponentSpecErrorsList validationErrors={validationErrors} />
        </BlockStack>

        <BlockStack
          className="flex-1 h-full"
          data-testid="yaml-editor-preview"
          align="center"
          inlineAlign="center"
        >
          <PreviewTaskNodeCard componentText={componentText} />
        </BlockStack>
      </InlineStack>
    );
  },
);
