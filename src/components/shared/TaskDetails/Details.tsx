import { type ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import { useGuaranteedHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference, TaskSpec } from "@/utils/componentSpec";
import { getExecutionStatusLabel } from "@/utils/executionStatus";

import type { Action } from "../ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "../ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "../ContextPanel/Blocks/ListBlock";
import { TextBlock } from "../ContextPanel/Blocks/TextBlock";
import { withSuspenseWrapper } from "../SuspenseWrapper";
import TaskActions from "./Actions";
import { ExecutionDetails } from "./ExecutionDetails";
import { GithubDetails } from "./GithubDetails";

interface TaskDetailsProps {
  displayName: string;
  componentRef: ComponentReference;
  executionId?: string;
  taskId?: string;
  taskSpec?: TaskSpec;
  componentDigest?: string;
  url?: string;
  customActions?: Action[];
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

const TaskDetailsInternal = ({
  displayName,
  componentRef,
  executionId,
  taskId,
  taskSpec,
  componentDigest,
  url,
  customActions = [],
  onDelete,
  status,
  readOnly = false,
  additionalSection = [],
}: TaskDetailsProps) => {
  const hydratedComponentRef =
    useGuaranteedHydrateComponentReference(componentRef);

  const canonicalUrl =
    hydratedComponentRef.spec.metadata?.annotations?.canonical_location;
  let reconstructedUrl;
  if (!url) {
    // Try reconstruct the url from componentSpec.metadata.annotations
    const annotations = hydratedComponentRef.spec.metadata?.annotations || {};
    const {
      git_remote_url,
      git_remote_branch,
      git_relative_dir,
      component_yaml_path,
    } = annotations;

    if (
      typeof git_remote_url === "string" &&
      typeof git_remote_branch === "string" &&
      typeof git_relative_dir === "string" &&
      typeof component_yaml_path === "string"
    ) {
      reconstructedUrl = `https://github.com/${git_remote_url
        .replace(/^https:\/\/github\.com\//, "")
        .replace(
          /\.git$/,
          "",
        )}/blob/${git_remote_branch}/${git_relative_dir}/${component_yaml_path}`;
    }
  }

  const author = hydratedComponentRef.spec.metadata?.annotations?.author;
  const description = hydratedComponentRef.spec.description;

  return (
    <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
      {taskId && (
        <TextBlock title="Task ID" text={taskId} className={BASE_BLOCK_CLASS} />
      )}

      {status && (
        <TextBlock
          title="Run Status"
          text={getExecutionStatusLabel(status)}
          className={BASE_BLOCK_CLASS}
        />
      )}

      {executionId && (
        <ExecutionDetails
          executionId={executionId}
          componentSpec={hydratedComponentRef.spec}
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

      {Object.keys(taskSpec?.annotations || {}).length > 0 && (
        <ContentBlock
          key="annotations"
          title="Task Annotations"
          collapsible
          defaultOpen={false}
          className={BASE_BLOCK_CLASS}
        >
          <ListBlock
            items={Object.entries(taskSpec?.annotations || {}).map(
              ([key, value]) => ({
                label: key,
                value: String(value),
                copyable: true,
              }),
            )}
            marker="none"
          />
        </ContentBlock>
      )}

      <TaskActions
        displayName={displayName}
        componentRef={hydratedComponentRef}
        customActions={customActions}
        onDelete={onDelete}
        readOnly={readOnly}
        className={BASE_BLOCK_CLASS}
      />
    </BlockStack>
  );
};

const TaskDetails = withSuspenseWrapper(TaskDetailsInternal);

export default TaskDetails;
