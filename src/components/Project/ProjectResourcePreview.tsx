import { Link } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import type { ReactNode } from "react";

import { CodeViewer, languageFor } from "@/components/shared/CodeViewer";
import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { getDefaultRemoteEditorPath } from "@/routes/editorRoutes";
import { PROJECT_ID_SEARCH_PARAM } from "@/routes/projectRunSearch";
import { getRunPath } from "@/routes/runRoutes";
import { UNTITLED } from "@/services/projects/placeholderNames";
import {
  describeResource,
  PIPELINE_RUN,
} from "@/services/projects/resourceDescriptor";
import { resourceMeta } from "@/services/projects/resourceMeta";
import { parseIdentity } from "@/services/projects/resourceTarget";
import type { ProjectResource } from "@/services/projects/types";
import { useProjectResource } from "@/services/projects/useProjectResources";
import { usePipelineSpec } from "@/services/usePipelineSpec";
import { tracking } from "@/utils/tracking";
import { componentSpecToText } from "@/utils/yaml";

import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { type PipelineValidity, pipelineValidity } from "./pipelineValidity";
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
    const target = described.target;
    return (
      <RunPreview
        runId={
          target?.type === "run" ? parseIdentity(target.identity).value : null
        }
      />
    );
  }

  return <PayloadPreview resource={resource} />;
}

/**
 * A run row carries no content of its own, so as an unrecognised row it used to
 * fall through to a yaml dump of its empty payload.
 */
function RunPreview({ runId }: { runId: string | null }) {
  return (
    <Placeholder>
      <BlockStack gap="3" align="center" inlineAlign="center">
        <EmptyState
          icon="Play"
          title="Pipeline run"
          description="A run is shown on its own page, with its graph, logs and artifacts."
        />
        {runId && (
          <Button variant="outline" size="sm" asChild>
            <Link
              to={getRunPath(runId)}
              {...tracking("projects.open_pipeline_run")}
            >
              <Icon name={resourceMeta("run").icon} size="xs" />
              Open the run
            </Link>
          </Button>
        )}
      </BlockStack>
    </Placeholder>
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
        <Button variant="outline" size="sm" asChild>
          <Link
            to={getDefaultRemoteEditorPath(pipelineId)}
            search={{ [PROJECT_ID_SEARCH_PARAM]: projectId }}
            {...tracking("projects.open_remote_pipeline")}
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
