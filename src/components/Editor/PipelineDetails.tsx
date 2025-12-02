import { Frown, Network } from "lucide-react";
import { useEffect, useState } from "react";

import { PipelineValidationList } from "@/components/Editor/components/PipelineValidationList/PipelineValidationList";
import { useValidationIssueNavigation } from "@/components/Editor/hooks/useValidationIssueNavigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import {
  type InputSpec,
  type OutputSpec,
  type TypeSpecType,
} from "@/utils/componentSpec";
import { getComponentFileFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { TaskImplementation } from "../shared/TaskDetails";
import { InputValueEditor } from "./IOEditor/InputValueEditor";
import { OutputNameEditor } from "./IOEditor/OutputNameEditor";
import RenamePipeline from "./RenamePipeline";
import { getOutputConnectedDetails } from "./utils/getOutputConnectedDetails";

const PipelineDetails = () => {
  const { setContent } = useContextPanel();
  const {
    componentSpec,
    graphSpec,
    isComponentTreeValid,
    globalValidationIssues,
  } = useComponentSpec();

  const notify = useToastNotification();

  const { handleIssueClick, groupedIssues } = useValidationIssueNavigation(
    globalValidationIssues,
  );

  // Utility function to convert TypeSpecType to string
  const typeSpecToString = (typeSpec?: TypeSpecType): string => {
    if (typeSpec === undefined) {
      return "Any";
    }
    if (typeof typeSpec === "string") {
      return typeSpec;
    }
    return JSON.stringify(typeSpec);
  };

  // State for file metadata
  const [fileMeta, setFileMeta] = useState<{
    creationTime?: Date;
    modificationTime?: Date;
    createdBy?: string;
    digest?: string;
  }>({});

  // Fetch file metadata on mount or when componentSpec.name changes
  useEffect(() => {
    const fetchMeta = async () => {
      if (!componentSpec?.name) return;
      const file = await getComponentFileFromList(
        USER_PIPELINES_LIST_NAME,
        componentSpec.name,
      );
      if (file) {
        setFileMeta({
          creationTime: file.creationTime,
          modificationTime: file.modificationTime,
          createdBy: file.componentRef.spec.metadata?.annotations?.author as
            | string
            | undefined,
          digest: file.componentRef.digest,
        });
      }
    };
    fetchMeta();
  }, [componentSpec?.name]);

  const handleInputEdit = (input: InputSpec) => {
    setContent(<InputValueEditor key={input.name} input={input} />);
  };

  const handleOutputEdit = (output: OutputSpec) => {
    const outputConnectedDetails = getOutputConnectedDetails(
      graphSpec,
      output.name,
    );
    setContent(
      <OutputNameEditor
        connectedDetails={outputConnectedDetails}
        key={output.name}
        output={output}
      />,
    );
  };

  const handleInputCopy = (input: InputSpec) => {
    const value = input.value ?? input.default;

    if (!value) {
      notify("Copy failed: Input has no value", "error");
      return;
    }

    void navigator.clipboard.writeText(value);
    notify("Input value copied to clipboard", "success");
  };

  if (!componentSpec) {
    return (
      <div className="flex flex-col gap-8 items-center justify-center h-full">
        <Frown className="w-12 h-12 text-secondary-foreground" />
        <div className="text-secondary-foreground">
          Error loading pipeline details.
        </div>
      </div>
    );
  }

  const annotations = componentSpec.metadata?.annotations || {};

  return (
    <div
      className="p-2 flex flex-col gap-6 h-full"
      data-context-panel="pipeline-details"
    >
      {/* Header */}
      <div className="flex items-center gap-2 max-w-[90%]">
        <Network className="w-6 h-6 text-secondary-foreground rotate-270 min-w-6 min-h-6" />
        <h2 className="text-lg font-semibold" data-testid="pipeline-name">
          {componentSpec.name ?? "Unnamed Pipeline"}
        </h2>
        <RenamePipeline />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <TaskImplementation
          displayName={componentSpec.name ?? "Pipeline"}
          componentSpec={componentSpec}
          showInlineContent={false}
        />
      </div>

      {/* General Metadata */}
      <div className="flex flex-col gap-2 text-xs text-secondary-foreground mb-2">
        <div className="flex flex-wrap gap-6">
          {fileMeta.createdBy && (
            <div>
              <span className="font-semibold">Created by:</span>{" "}
              {fileMeta.createdBy}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6">
          {fileMeta.creationTime && (
            <div>
              <span className="font-semibold">Created at:</span>{" "}
              {new Date(fileMeta.creationTime).toLocaleString()}
            </div>
          )}
          {fileMeta.modificationTime && (
            <div>
              <span className="font-semibold">Last updated:</span>{" "}
              {new Date(fileMeta.modificationTime).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {componentSpec.description && (
        <div>
          <h3 className="text-md font-medium mb-1">Description</h3>
          <div className="text-sm whitespace-pre-line">
            {componentSpec.description}
          </div>
        </div>
      )}

      {/* Component Digest */}
      {fileMeta.digest && (
        <div className="mb-2">
          <h3 className="text-md font-medium mb-1">Digest</h3>
          <Button
            className="bg-gray-100 border border-gray-300 rounded p-2 h-fit text-xs w-full text-left hover:bg-gray-200 active:bg-gray-300 transition cursor-pointer"
            onClick={() => {
              if (fileMeta.digest) {
                navigator.clipboard.writeText(fileMeta.digest);
                notify("Digest copied to clipboard", "success");
              }
            }}
            variant="ghost"
          >
            <span className="font-mono break-all w-full text-wrap">
              {fileMeta.digest}
            </span>
          </Button>
        </div>
      )}

      {/* Annotations */}
      {Object.keys(annotations).length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-1">Annotations</h3>
          <ul className="text-xs text-secondary-foreground">
            {Object.entries(annotations).map(([key, value]) => (
              <li key={key}>
                <span className="font-semibold">{key}:</span>{" "}
                <span className="break-all">{String(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Artifacts (Inputs & Outputs) */}
      <div>
        <h3 className="text-md font-medium mb-1">Artifacts</h3>
        <div className="flex gap-4 flex-col">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">Inputs</h4>
            {componentSpec.inputs && componentSpec.inputs.length > 0 ? (
              <div className="flex flex-col">
                {componentSpec.inputs.map((input) => {
                  return (
                    <div
                      className="flex flex-row justify-between even:bg-white odd:bg-gray-100 gap-1 px-2 py-0 rounded-xs items-center"
                      key={input.name}
                    >
                      <div className="text-xs flex-1 truncate max-w-[200px]">
                        <span className="font-semibold">{input.name}:</span>{" "}
                        {input.value || input.default || "No value"}
                      </div>

                      <div className="text-xs flex-1 font-mono truncate max-w-[100px]">
                        <span className="font-semibold">Type:</span>{" "}
                        {typeSpecToString(input?.type)}
                      </div>
                      <InlineStack
                        className="min-w-24"
                        align="end"
                        blockAlign="center"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="min"
                          onClick={() => handleInputCopy(input)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Icon name="Copy" className="size-3" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-muted-foreground cursor-pointer hover:bg-transparent"
                          size="sm"
                          onClick={() => handleInputEdit(input)}
                        >
                          Edit
                        </Button>
                      </InlineStack>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No inputs</div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">Outputs</h4>
            {componentSpec.outputs && componentSpec.outputs.length > 0 ? (
              <div className="flex flex-col">
                {componentSpec.outputs.map((output) => (
                  <div
                    className="flex flex-row justify-between even:bg-white odd:bg-gray-100 gap-1 px-2 py-0 rounded-xs items-center"
                    key={output.name}
                  >
                    <div className="text-xs flex-1 truncate max-w-[200px]">
                      <span className="font-semibold">{output.name}:</span>{" "}
                      {
                        getOutputConnectedDetails(graphSpec, output.name)
                          .outputName
                      }
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold">Type:</span>{" "}
                      {typeSpecToString(
                        getOutputConnectedDetails(graphSpec, output.name)
                          .outputType,
                      )}
                    </div>

                    <InlineStack className="min-w-24" align={"end"}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-muted-foreground cursor-pointer hover:bg-transparent"
                        size="sm"
                        onClick={() => handleOutputEdit(output)}
                      >
                        Edit
                      </Button>
                    </InlineStack>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No outputs</div>
            )}
          </div>
        </div>
      </div>

      {/* Validations */}
      <div className="mt-2">
        <h3 className="text-md font-medium mb-1">Validations</h3>
        <PipelineValidationList
          isComponentTreeValid={isComponentTreeValid}
          groupedIssues={groupedIssues}
          totalIssueCount={globalValidationIssues.length}
          onIssueSelect={handleIssueClick}
        />
      </div>
    </div>
  );
};

export default PipelineDetails;
