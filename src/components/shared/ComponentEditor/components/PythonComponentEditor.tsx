import MonacoEditor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DEFAULT_MONACO_OPTIONS } from "../constants";
import { usePythonYamlGenerator } from "../generators/python";
import type { YamlGeneratorOptions } from "../types";
import { preserveComponentName } from "../utils/preserveComponentName";
import { ComponentSpecErrorsList } from "./ComponentSpecErrorsList";
import { PreviewTaskNodeCard } from "./PreviewTaskNodeCard";
import { TogglePreview } from "./TogglePreview";
import { YamlGeneratorOptionsEditor } from "./YamlGeneratorOptionsEditor";

const PythonComponentEditorSkeleton = () => {
  return (
    <BlockStack className="h-full w-full p-2 bg-white" align="start" gap="2">
      <InlineStack
        className="w-full h-full flex-1"
        gap="4"
        blockAlign="start"
        align="space-between"
        wrap="nowrap"
      >
        <BlockStack gap="2" align="start" className="flex-1">
          <Skeleton size="full" />
          <Skeleton size="half" />
          <Skeleton size="full" />
        </BlockStack>
        <BlockStack gap="2" align="start" className="flex-1">
          <Skeleton size="full" />
          <Skeleton size="half" />
          <Skeleton size="full" />
        </BlockStack>
      </InlineStack>
    </BlockStack>
  );
};

/**
 * A dialog for editing a Python function.
 */
export const PythonComponentEditor = withSuspenseWrapper(
  ({
    text,
    options,
    onComponentTextChange,
    onErrorsChange,
    preserveComponentName: initialComponentName,
  }: {
    text: string;
    options: YamlGeneratorOptions;
    onComponentTextChange: (yaml: string) => void;
    onErrorsChange: (errors: string[]) => void;
    preserveComponentName?: string;
  }) => {
    const [pythonCode, setPythonCode] = useState(text);
    const [componentText, setComponentText] = useState("");
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [showPreview, setShowPreview] = useState(true);
    const [yamlGeneratorOptions, setYamlGeneratorOptions] = useState(options);

    const yamlGenerator = usePythonYamlGenerator();
    const preservedNameRef = useRef(initialComponentName);

    useEffect(() => {
      handleFunctionTextChange(text);
    }, []);

    // Sync ref with prop
    preservedNameRef.current = initialComponentName;

    const handleFunctionTextChange = async (value: string | undefined) => {
      const code = value ?? "";
      setPythonCode(code);
      try {
        const yaml = await yamlGenerator(code, yamlGeneratorOptions);
        const yamlWithPreservedName = preserveComponentName(
          yaml,
          preservedNameRef.current,
        );
        setComponentText(yamlWithPreservedName);
        onComponentTextChange(yamlWithPreservedName);
        setValidationErrors([]);
        onErrorsChange([]);
      } catch (error) {
        const errors = [error instanceof Error ? error.message : String(error)];
        onErrorsChange(errors);
        setValidationErrors(errors);
      }
    };

    const handleOptionsChange = (options: YamlGeneratorOptions) => {
      setYamlGeneratorOptions(options);
      handleFunctionTextChange(pythonCode);
    };

    return (
      <InlineStack className="w-full h-full" gap="4">
        <BlockStack className="flex-1 h-full" data-testid="python-editor">
          <Tabs defaultValue="python" className="w-full flex-1 pt-1">
            <TabsList>
              <TabsTrigger value="python">Python Code</TabsTrigger>
              <TabsTrigger value="metadata">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent
              value="python"
              className="flex flex-col flex-1 relative"
            >
              <BlockStack className="flex-1 relative">
                <div className="absolute inset-0">
                  <MonacoEditor
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={pythonCode}
                    onChange={handleFunctionTextChange}
                    options={DEFAULT_MONACO_OPTIONS}
                  />
                </div>
              </BlockStack>
              <ComponentSpecErrorsList validationErrors={validationErrors} />
            </TabsContent>

            <TabsContent
              value="metadata"
              className="flex flex-col flex-1 relative"
            >
              <YamlGeneratorOptionsEditor
                initialOptions={yamlGeneratorOptions}
                onChange={handleOptionsChange}
              />
            </TabsContent>
          </Tabs>
        </BlockStack>

        <BlockStack className="flex-1 h-full">
          <BlockStack className="w-full h-full">
            <InlineStack className="h-10 py-1">
              <TogglePreview
                showPreview={showPreview}
                setShowPreview={setShowPreview}
              />
            </InlineStack>
            <BlockStack
              className="w-full h-full"
              align="center"
              inlineAlign="center"
              data-testid="python-editor-preview"
            >
              {showPreview ? (
                <PreviewTaskNodeCard componentText={componentText} />
              ) : (
                <MonacoEditor
                  defaultLanguage="yaml"
                  theme="vs-dark"
                  value={componentText}
                  options={{
                    ...DEFAULT_MONACO_OPTIONS,
                    readOnly: true,
                  }}
                />
              )}
            </BlockStack>
          </BlockStack>
        </BlockStack>
      </InlineStack>
    );
  },
  PythonComponentEditorSkeleton,
);
