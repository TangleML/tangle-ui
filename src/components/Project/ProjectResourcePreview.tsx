import { Link } from "@tanstack/react-router";
import yaml from "js-yaml";
import type { ReactNode } from "react";

import { CodeViewer, languageFor } from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { PROJECT_ID_SEARCH_PARAM } from "@/routes/projectRunSearch";
import type { LocalPipelinePointer } from "@/services/localPipelines/types";
import { useLocalPipeline } from "@/services/localPipelines/useLocalPipelines";
import {
  describeResource,
  localPipelinePointerOf,
  PIPELINE_RUN,
} from "@/services/projects/resourceDescriptor";
import type { ProjectResource } from "@/services/projects/types";
import { useProjectResource } from "@/services/projects/useProjectResources";
import { usePipelineSpec } from "@/services/usePipelineSpec";
import { tracking } from "@/utils/tracking";
import { componentSpecToText } from "@/utils/yaml";

import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { type PipelineValidity, pipelineValidity } from "./pipelineValidity";
import { UNTITLED } from "./ResourceRow";
import { RunPipelineButton } from "./RunPipelineButton";

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

  const pointer = localPipelinePointerOf(resource);
  if (pointer) {
    return (
      <LocalPipelinePreview
        projectId={projectId}
        resource={resource}
        pointer={pointer}
      />
    );
  }

  if (resource.entity === "pipeline" && resource.entityId) {
    return (
      <PipelinePreview
        projectId={projectId}
        resource={resource}
        pipelineId={resource.entityId}
      />
    );
  }

  const described = describeResource(resource);
  if (described?.type === PIPELINE_RUN) {
    return <RunPreview url={described.url} />;
  }

  return <PayloadPreview resource={resource} />;
}

/**
 * A run row carries no content of its own — it points at a run whose own page
 * shows the graph, logs and artifacts. Dumping its empty payload as yaml, which
 * is what an unrecognised row used to fall through to, said nothing at all.
 */
function RunPreview({ url }: { url: string | undefined }) {
  return (
    <Placeholder>
      <BlockStack gap="3" align="center" inlineAlign="center">
        <EmptyState
          icon="Play"
          title="Pipeline run"
          description="A run is shown on its own page, with its graph, logs and artifacts."
        />
        {url && (
          <Button variant="outline" size="sm" asChild>
            <a href={url} {...tracking("projects.open_pipeline_run")}>
              <Icon name="ExternalLink" size="xs" />
              Open the run
            </a>
          </Button>
        )}
      </BlockStack>
    </Placeholder>
  );
}

interface LocalPipelinePreviewProps {
  projectId: string;
  resource: ProjectResource;
  pointer: LocalPipelinePointer;
}

function LocalPipelinePreview({
  projectId,
  resource,
  pointer,
}: LocalPipelinePreviewProps) {
  const { data: pipeline, isPending } = useLocalPipeline(pointer);

  if (isPending) {
    return <Loading />;
  }

  if (!pipeline) {
    return (
      <Placeholder>
        <EmptyState
          icon="MonitorOff"
          title="Not in this browser"
          description={`A pipeline lives in the browser it was made in, and this one is not in this browser. ${resource.createdBy ?? "Whoever added it"} added it to the project.`}
        />
      </Placeholder>
    );
  }

  return (
    <BlockStack gap="2">
      <Code code={pipeline.yaml} language="yaml" filename={pipeline.name} />
      <InlineStack gap="3" blockAlign="center" className="w-full">
        <RunPipelineButton
          projectId={projectId}
          spec={pipeline.spec}
          heldInThisBrowser
        />
        <Button variant="outline" size="sm" asChild>
          <Link
            to={getDefaultEditorPath(pipeline.name)}
            search={{ [PROJECT_ID_SEARCH_PARAM]: projectId }}
            {...tracking("projects.open_local_pipeline")}
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

interface PipelinePreviewProps {
  projectId: string;
  resource: ProjectResource;
  pipelineId: string;
}

function PipelinePreview({
  projectId,
  resource,
  pipelineId,
}: PipelinePreviewProps) {
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
        <RunPipelineButton projectId={projectId} spec={pipeline.spec} />
        {/* The editor opens a pipeline by name out of browser storage, so it
            cannot reach one held on the backend, and a local pipeline that
            merely shares the name is a different pipeline. */}
        <Text size="xs" tone="subdued">
          Stored on the backend, which the editor cannot open yet.
        </Text>
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

  // A row that points at something elsewhere is sent with an empty payload,
  // because the api requires one. Dumping that as yaml showed `{}`.
  if (!resource.payload || Object.keys(resource.payload).length === 0) {
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
