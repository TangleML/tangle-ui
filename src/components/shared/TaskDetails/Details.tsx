import { type ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import { useGuaranteedHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference } from "@/utils/componentSpec";
import { getExecutionStatusLabel } from "@/utils/executionStatus";
import { buildComponentSourceUrl } from "@/utils/URL";

import { ContentBlock } from "../ContextPanel/Blocks/ContentBlock";
import { TextBlock } from "../ContextPanel/Blocks/TextBlock";
import { withSuspenseWrapper } from "../SuspenseWrapper";
import { ExecutionDetails } from "./ExecutionDetails";
import { GithubDetails } from "./GithubDetails";

interface TaskDetailsProps {
  componentRef: ComponentReference;
  executionId?: string;
  status?: string;
  options?: {
    descriptionExpanded?: boolean;
  };
  additionalSection?: {
    title: string;
    component: ReactNode;
    isCollapsed?: boolean;
  }[];
}

const BASE_BLOCK_CLASS = "px-3 py-2";

const TaskDetailsInternal = ({
  componentRef,
  executionId,
  status,
  options,
  additionalSection = [],
}: TaskDetailsProps) => {
  const hydratedComponentRef =
    useGuaranteedHydrateComponentReference(componentRef);

  const { url, digest } = hydratedComponentRef;

  const canonicalUrl =
    hydratedComponentRef.spec.metadata?.annotations?.canonical_location;

  // Try reconstruct URLs from componentSpec.metadata.annotations
  const annotations = hydratedComponentRef.spec.metadata?.annotations || {};
  const {
    git_remote_url,
    git_remote_branch,
    git_relative_dir,
    component_yaml_path,
    documentation_path,
  } = annotations;

  let reconstructedUrl;
  let documentationUrl;

  if (
    typeof git_remote_url === "string" &&
    typeof git_remote_branch === "string" &&
    typeof git_relative_dir === "string"
  ) {
    if (!url && typeof component_yaml_path === "string") {
      reconstructedUrl = buildComponentSourceUrl({
        remoteUrl: git_remote_url,
        branch: git_remote_branch,
        relativeDir: git_relative_dir,
        filePath: component_yaml_path,
      });
    }

    if (typeof documentation_path === "string") {
      documentationUrl = buildComponentSourceUrl({
        remoteUrl: git_remote_url,
        branch: git_remote_branch,
        relativeDir: git_relative_dir,
        filePath: documentation_path,
      });
    }
  }

  const author = hydratedComponentRef.spec.metadata?.annotations?.author;
  const description = hydratedComponentRef.spec.description;

  return (
    <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
      {status && (
        <TextBlock
          title="Execution Status"
          text={getExecutionStatusLabel(status)}
          className={BASE_BLOCK_CLASS}
        />
      )}

      {executionId && (
        <ExecutionDetails
          executionId={executionId}
          componentSpec={hydratedComponentRef.spec}
          status={status}
          className={BASE_BLOCK_CLASS}
        />
      )}

      <TextBlock title="Author" text={author} className={BASE_BLOCK_CLASS} />

      <GithubDetails
        url={url && url.length > 0 ? url : reconstructedUrl}
        canonicalUrl={canonicalUrl}
        documentationUrl={documentationUrl}
        className={BASE_BLOCK_CLASS}
      />

      <TextBlock
        title="Description"
        text={description}
        collapsible
        defaultCollapsed={!options?.descriptionExpanded}
        className={BASE_BLOCK_CLASS}
        wrap
      />

      <TextBlock
        title="Digest"
        text={digest}
        copyable
        className={BASE_BLOCK_CLASS}
      />

      {additionalSection.map((section) => (
        <ContentBlock
          key={section.title}
          title={section.title}
          collapsible
          defaultOpen={!section.isCollapsed}
          className={BASE_BLOCK_CLASS}
        >
          {section.component}
        </ContentBlock>
      ))}
    </BlockStack>
  );
};

const TaskDetails = withSuspenseWrapper(TaskDetailsInternal);

export default TaskDetails;
