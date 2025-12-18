import { type ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import type { ComponentSpec } from "@/utils/componentSpec";

import { ContentBlock } from "../ContextPanel/Blocks/ContentBlock";
import { TextBlock } from "../ContextPanel/Blocks/TextBlock";
import TaskActions from "./Actions";
import { ExecutionDetails } from "./ExecutionDetails";
import { GithubDetails } from "./GithubDetails";

interface TaskDetailsProps {
  displayName: string;
  componentSpec: ComponentSpec;
  executionId?: string;
  taskId?: string;
  componentDigest?: string;
  url?: string;
  actions?: ReactNode[];
  onDelete?: () => void;
  status?: string;
  readOnly?: boolean;
  additionalSection?: {
    title: string;
    component: ReactNode;
    isCollapsed?: boolean;
  }[];
}

const BASE_BLOCK_CLASS = "px-3 py-2";

const TaskDetails = ({
  displayName,
  componentSpec,
  executionId,
  taskId,
  componentDigest,
  url,
  actions = [],
  onDelete,
  status,
  readOnly = false,
  additionalSection = [],
}: TaskDetailsProps) => {
  const canonicalUrl = componentSpec?.metadata?.annotations?.canonical_location;
  let reconstructedUrl;
  if (!url) {
    // Try reconstruct the url from componentSpec.metadata.annotations
    const annotations = componentSpec?.metadata?.annotations || {};
    const {
      git_remote_url,
      git_remote_branch,
      git_relative_dir,
      component_yaml_path,
    } = annotations;

    if (
      git_remote_url &&
      git_remote_branch &&
      git_relative_dir &&
      component_yaml_path
    ) {
      reconstructedUrl = `https://github.com/${(git_remote_url as string)
        .replace(/^https:\/\/github\.com\//, "")
        .replace(
          /\.git$/,
          "",
        )}/blob/${git_remote_branch}/${git_relative_dir}/${component_yaml_path}`;
    }
  }

  const author = componentSpec?.metadata?.annotations?.author;
  const description = componentSpec?.description;

  return (
    <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
      <TextBlock title="Task ID" text={taskId} className={BASE_BLOCK_CLASS} />

      <TextBlock
        title="Run Status"
        text={status}
        className={BASE_BLOCK_CLASS}
      />

      {executionId && (
        <ExecutionDetails
          executionId={executionId}
          componentSpec={componentSpec}
          className={BASE_BLOCK_CLASS}
        />
      )}

      <TextBlock title="Author" text={author} className={BASE_BLOCK_CLASS} />

      <GithubDetails
        url={url && url.length > 0 ? url : reconstructedUrl}
        canonicalUrl={canonicalUrl}
        className={BASE_BLOCK_CLASS}
      />

      <TextBlock
        title="Description"
        text={description}
        collapsible
        className={BASE_BLOCK_CLASS}
        wrap
      />

      <TextBlock
        title="Digest"
        text={componentDigest}
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

      <TaskActions
        displayName={displayName}
        componentSpec={componentSpec}
        actions={actions}
        onDelete={onDelete}
        readOnly={readOnly}
        className={BASE_BLOCK_CLASS}
      />
    </BlockStack>
  );
};

export default TaskDetails;
