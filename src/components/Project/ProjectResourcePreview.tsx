import yaml from "js-yaml";
import type { ReactNode } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading } from "@/components/ui/typography";
import type { ProjectResource } from "@/services/projects/types";
import { useProjectResource } from "@/services/projects/useProjectResources";
import { usePipelineSpec } from "@/services/usePipelineSpec";
import { componentSpecToText } from "@/utils/yaml";

import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { UNTITLED } from "./ResourceRow";

const PLAIN_TEXT = "plaintext";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  md: "markdown",
  markdown: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  py: "python",
  sh: "shell",
  sql: "sql",
  ts: "typescript",
  js: "javascript",
};

function languageFor(name: string | null) {
  const extension = name?.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXTENSION[extension] ?? PLAIN_TEXT;
}

const CONTENT_KEY = "content";

interface ProjectResourcePreviewProps {
  projectId: string;
  resourceId: string | null;
}

export function ProjectResourcePreview({
  projectId,
  resourceId,
}: ProjectResourcePreviewProps) {
  return (
    <BlockStack gap="4">
      <ColumnHeadingRow>
        <Heading level={2}>Resource preview</Heading>
      </ColumnHeadingRow>

      {resourceId ? (
        <SelectedResource projectId={projectId} resourceId={resourceId} />
      ) : (
        <Placeholder>
          <EmptyState
            icon="Eye"
            title="Nothing selected"
            description="Select a resource to preview it here."
          />
        </Placeholder>
      )}
    </BlockStack>
  );
}

const PREVIEW_HEIGHT = "h-[32rem]";

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-lg border border-border bg-card ${PREVIEW_HEIGHT}`}
    >
      {children}
    </div>
  );
}

const Loading = () => (
  <Placeholder>
    <InlineStack gap="2" blockAlign="center">
      <Spinner /> Loading...
    </InlineStack>
  </Placeholder>
);

function Code({
  code,
  language,
  filename,
}: {
  code: string;
  language: string;
  filename: string;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-lg border border-border ${PREVIEW_HEIGHT}`}
    >
      <CodeViewer code={code} language={language} filename={filename} />
    </div>
  );
}

interface SelectedResourceProps {
  projectId: string;
  resourceId: string;
}

function SelectedResource({ projectId, resourceId }: SelectedResourceProps) {
  const {
    data: resource,
    isPending,
    error,
  } = useProjectResource(projectId, resourceId);

  if (isPending) {
    return <Loading />;
  }

  if (error) {
    return (
      <InfoBox title="Error loading preview" variant="error">
        {error.message}
      </InfoBox>
    );
  }

  if (resource.entity === "pipeline" && resource.entityId) {
    return (
      <PipelinePreview resource={resource} pipelineId={resource.entityId} />
    );
  }

  return <PayloadPreview resource={resource} />;
}

interface PipelinePreviewProps {
  resource: ProjectResource;
  pipelineId: string;
}

function PipelinePreview({ resource, pipelineId }: PipelinePreviewProps) {
  const { data: spec, isPending, error } = usePipelineSpec(pipelineId);

  if (isPending) {
    return <Loading />;
  }

  if (error) {
    return (
      <InfoBox title="Cannot show this pipeline" variant="warning">
        {error.message}
      </InfoBox>
    );
  }

  return (
    <Code
      code={componentSpecToText(spec)}
      language="yaml"
      filename={resource.name ?? UNTITLED}
    />
  );
}

function PayloadPreview({ resource }: { resource: ProjectResource }) {
  const body = resource.payload?.[CONTENT_KEY];

  if (typeof body === "string") {
    return (
      <Code
        code={body}
        language={languageFor(resource.name)}
        filename={resource.name ?? UNTITLED}
      />
    );
  }

  if (!resource.payload) {
    return (
      <Placeholder>
        <EmptyState
          icon="FileQuestionMark"
          title="Nothing to preview"
          description="This item holds no content of its own."
        />
      </Placeholder>
    );
  }

  return (
    <Code
      code={yaml.dump(resource.payload, { lineWidth: -1, noRefs: true })}
      language="yaml"
      filename={resource.name ?? UNTITLED}
    />
  );
}
