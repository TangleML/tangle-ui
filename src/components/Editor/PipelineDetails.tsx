import { Frown } from "lucide-react";
import { useEffect, useState } from "react";

import { PipelineValidationList } from "@/components/Editor/components/PipelineValidationList/PipelineValidationList";
import { useValidationIssueNavigation } from "@/components/Editor/hooks/useValidationIssueNavigation";
import { ArtifactsList } from "@/components/shared/ArtifactsList/ArtifactsList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
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
    digest,
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

  const handleDigestCopy = () => {
    navigator.clipboard.writeText(digest);
    notify("Digest copied to clipboard", "success");
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
    <BlockStack
      gap="6"
      className="p-2 h-full"
      data-context-panel="pipeline-details"
    >
      <CopyText className="text-lg font-semibold">
        {componentSpec.name ?? "Unnamed Pipeline"}
      </CopyText>
      <InlineStack gap="2">
        <RenamePipeline />
        <TaskImplementation
          displayName={componentSpec.name ?? "Pipeline"}
          componentSpec={componentSpec}
          showInlineContent={false}
        />
      </InlineStack>

      {(fileMeta.createdBy ||
        fileMeta.creationTime ||
        fileMeta.modificationTime) && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Pipeline Info
          </Text>
          <dl className="flex flex-col gap-1 text-xs text-secondary-foreground">
            {fileMeta.createdBy && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold">
                  Created by:
                </Text>
                <dd>{fileMeta.createdBy}</dd>
              </InlineStack>
            )}
            {fileMeta.creationTime && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold">
                  Created at:
                </Text>
                <dd>{new Date(fileMeta.creationTime).toLocaleString()}</dd>
              </InlineStack>
            )}
            {fileMeta.modificationTime && (
              <InlineStack as="div" gap="1" blockAlign="center">
                <Text as="dt" weight="semibold">
                  Last updated:
                </Text>
                <dd>{new Date(fileMeta.modificationTime).toLocaleString()}</dd>
              </InlineStack>
            )}
          </dl>
        </BlockStack>
      )}

      {componentSpec.description && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Description
          </Text>
          <Text as="p" size="sm" className="whitespace-pre-line">
            {componentSpec.description}
          </Text>
        </BlockStack>
      )}

      {/* Component Digest */}
      {digest && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Digest
          </Text>
          <Button
            className="bg-gray-100 border border-gray-300 rounded p-2 h-fit text-xs w-full text-left hover:bg-gray-200 active:bg-gray-300 transition cursor-pointer"
            onClick={handleDigestCopy}
            variant="ghost"
          >
            <Text as="span" font="mono" className="break-all w-full text-wrap">
              {digest}
            </Text>
          </Button>
        </BlockStack>
      )}

      {/* Annotations */}
      {Object.keys(annotations).length > 0 && (
        <BlockStack>
          <Text as="h3" size="md" weight="semibold" className="mb-1">
            Annotations
          </Text>
          <ul className="text-xs text-secondary-foreground">
            {Object.entries(annotations).map(([key, value]) => (
              <li key={key}>
                <Text as="span" weight="semibold">
                  {key}:
                </Text>{" "}
                <Text as="span" className="break-all">
                  {String(value)}
                </Text>
              </li>
            ))}
          </ul>
        </BlockStack>
      )}

      <ArtifactsList
        inputs={(componentSpec.inputs ?? []).map((input) => ({
          name: input.name,
          type: typeSpecToString(input?.type),
          value: input.value || input.default,
          actions: (
            <Button
              type="button"
              variant="ghost"
              size="min"
              onClick={() => handleInputEdit(input)}
              className="text-muted-foreground hover:text-foreground h-4 w-4"
            >
              <Icon name="Pencil" className="size-2.5" />
            </Button>
          ),
        }))}
        outputs={(componentSpec.outputs ?? []).map((output) => {
          const connectedDetails = getOutputConnectedDetails(
            graphSpec,
            output.name,
          );
          return {
            name: output.name,
            type: typeSpecToString(connectedDetails.outputType),
            value: connectedDetails.outputName,
            actions: (
              <Button
                type="button"
                variant="ghost"
                size="min"
                onClick={() => handleOutputEdit(output)}
                className="text-muted-foreground hover:text-foreground h-4 w-4"
              >
                <Icon name="Pencil" className="size-2.5" />
              </Button>
            ),
          };
        })}
      />

      {/* Validations */}
      <BlockStack>
        <Text as="h3" size="md" weight="semibold" className="mb-1">
          Validations
        </Text>
        <PipelineValidationList
          isComponentTreeValid={isComponentTreeValid}
          groupedIssues={groupedIssues}
          totalIssueCount={globalValidationIssues.length}
          onIssueSelect={handleIssueClick}
        />
      </BlockStack>
    </BlockStack>
  );
};

export default PipelineDetails;
