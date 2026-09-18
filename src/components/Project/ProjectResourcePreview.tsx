import { Link } from "@tanstack/react-router";
import yaml from "js-yaml";
import type { ReactNode } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import type { ProjectResource } from "@/services/projects/types";
import { useProjectResource } from "@/services/projects/useProjectResources";
import { usePipelineSpec } from "@/services/usePipelineSpec";
import { tracking } from "@/utils/tracking";
import { componentSpecToText } from "@/utils/yaml";

import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { type PipelineValidity, pipelineValidity } from "./pipelineValidity";
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
  const { data: pipeline, isPending, error } = usePipelineSpec(pipelineId);

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
    <BlockStack gap="2">
      <Code
        code={componentSpecToText(pipeline.spec)}
        language="yaml"
        filename={resource.name ?? UNTITLED}
      />
      <InlineStack gap="3" blockAlign="center" className="w-full">
        <Button variant="outline" size="sm" asChild>
          <Link
            to={getDefaultEditorPath(pipeline.editorName)}
            {...tracking("projects.open_pipeline")}
          >
            <Icon name="PencilRuler" size="xs" />
            Open in the editor
          </Link>
        </Button>
        <ValidityBadge validity={pipelineValidity(pipeline.spec)} />
      </InlineStack>
    </BlockStack>
  );
}

function ValidityBadge({ validity }: { validity: PipelineValidity }) {
  if (validity === "unknown") {
    return null;
  }

  const valid = validity === "valid";

  return (
    <InlineStack gap="1" blockAlign="center" wrap="nowrap">
      <Icon
        name={valid ? "CircleCheck" : "CircleAlert"}
        size="xs"
        className={valid ? "text-status-succeeded" : "text-status-failed"}
        aria-hidden="true"
      />
      <Text size="xs" tone="subdued">
        {valid ? "Valid" : "Not valid"}
      </Text>
    </InlineStack>
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
