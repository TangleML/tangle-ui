import { type ReactNode } from "react";

import { BlockStack } from "@/components/ui/layout";
import { useGuaranteedHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { TaskNodeContextType } from "@/providers/TaskNodeProvider";
import type { ComponentReference } from "@/utils/componentSpec";
import { getExecutionStatusLabel } from "@/utils/executionStatus";

import { ContentBlock } from "../ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "../ContextPanel/Blocks/KeyValueList";
import { TextBlock } from "../ContextPanel/Blocks/TextBlock";
import { InlineEditor } from "../InlineEditor/InlineEditor";
import { withSuspenseWrapper } from "../SuspenseWrapper";
import TaskActions from "./Actions";
import { DisplayNameEditor } from "./DisplayNameEditor";
import { ExecutionDetails } from "./ExecutionDetails";
import { GithubDetails } from "./GithubDetails";

interface TaskDetailsProps {
  taskNode?: TaskNodeContextType;
  componentRef: ComponentReference;
  executionId?: string;
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
  taskNode,
  componentRef,
  executionId,
  status,
  readOnly = false,
  additionalSection = [],
}: TaskDetailsProps) => {
  const hydratedComponentRef =
    useGuaranteedHydrateComponentReference(componentRef);

  const { url, digest } = hydratedComponentRef;

  const { displayName, taskSpec, taskId } = taskNode || {};

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
    const repoPath = git_remote_url
      .replace(/^https:\/\/github\.com\//, "")
      .replace(/\.git$/, "");

    const buildGitHubUrl = (filePath: string) => {
      const url = new URL(`https://github.com`);
      url.pathname = [
        repoPath,
        "blob",
        git_remote_branch,
        git_relative_dir,
        filePath,
      ].join("/");
      return url.toString();
    };

    if (!url && typeof component_yaml_path === "string") {
      reconstructedUrl = buildGitHubUrl(component_yaml_path);
    }

    if (typeof documentation_path === "string") {
      documentationUrl = buildGitHubUrl(documentation_path);
    }
  }

  const author = hydratedComponentRef.spec.metadata?.annotations?.author;
  const description = hydratedComponentRef.spec.description;

  return (
    <BlockStack className="border rounded-md divide-y overflow-auto hide-scrollbar">
      {taskId && (
        <TextBlock title="Task ID" text={taskId} className={BASE_BLOCK_CLASS} />
      )}

      {!readOnly && taskId && (
        <ContentBlock title="Display Name" className={BASE_BLOCK_CLASS}>
          <InlineEditor
            value={displayName}
            editor={<DisplayNameEditor taskId={taskId} />}
          />
        </ContentBlock>
      )}

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

      {Object.keys(taskSpec?.annotations || {}).length > 0 && (
        <ContentBlock
          key="annotations"
          title="Task Annotations"
          collapsible
          defaultOpen={false}
          className={BASE_BLOCK_CLASS}
        >
          <KeyValueList
            items={Object.entries(taskSpec?.annotations || {}).map(
              ([key, value]) => ({
                label: key,
                value: String(value),
              }),
            )}
          />
        </ContentBlock>
      )}

      <TaskActions
        componentRef={hydratedComponentRef}
        taskNode={taskNode}
        readOnly={readOnly}
        className={BASE_BLOCK_CLASS}
      />
    </BlockStack>
  );
};

const TaskDetails = withSuspenseWrapper(TaskDetailsInternal);

export default TaskDetails;
