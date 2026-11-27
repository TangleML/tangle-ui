import { type KeyboardEvent, useState } from "react";

import { languageFor } from "@/components/shared/CodeViewer";
import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { UNTITLED } from "@/services/projects/placeholderNames";
import {
  documentBody,
  documentPayload,
} from "@/services/projects/resourceDescriptor";
import { resourceMeta } from "@/services/projects/resourceMeta";
import type { ProjectResource } from "@/services/projects/types";
import { useUpdateProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

import { ResourceHeader } from "./ResourceHeader";

interface Edit {
  startedFrom: string;
  draft: string;
}

interface DocumentEditorProps {
  projectId: string;
  resource: ProjectResource;
}

export function DocumentEditor({ projectId, resource }: DocumentEditorProps) {
  const saved = documentBody(resource) ?? "";
  const [edit, setEdit] = useState<Edit | null>(null);
  const update = useUpdateProjectResource(projectId);
  const { track } = useAnalytics();

  if (edit !== null && edit.draft === saved && !update.isPending) {
    setEdit(null);
  }

  const content = edit?.draft ?? saved;
  const isDirty = edit !== null && edit.draft !== saved;
  const changedElsewhere = isDirty && edit.startedFrom !== saved;
  const canSave = isDirty && !update.isPending;
  const name = resource.name ?? UNTITLED;

  const handleChange = (value: string) => {
    if (value === saved && !update.isPending) {
      setEdit(null);
      return;
    }
    setEdit((current) => ({
      startedFrom: current?.startedFrom ?? saved,
      draft: value,
    }));
  };

  const discard = () => setEdit(null);

  const save = () => {
    if (!canSave) return;
    const draft = content;
    update.mutate(
      {
        resourceId: resource.id,
        input: { payload: documentPayload(draft, resource.payload) },
      },
      {
        onSuccess: () => {
          track("projects.save_document_completed");
          setEdit((current) => {
            if (!current || current.draft === draft) return null;
            return { startedFrom: draft, draft: current.draft };
          });
        },
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "s") return;
    event.preventDefault();
    save();
  };

  return (
    <BlockStack className="min-h-0 w-full flex-1">
      <ResourceHeader
        icon={resourceMeta("document").icon}
        title={name}
        status={isDirty ? "Unsaved changes" : undefined}
      >
        <Button
          variant="ghost"
          size="xs"
          disabled={edit === null || update.isPending}
          onClick={discard}
          {...tracking("projects.discard_document_edits")}
        >
          Discard
        </Button>
        <Button
          size="xs"
          disabled={!canSave}
          onClick={save}
          {...tracking("projects.save_document")}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </ResourceHeader>

      {changedElsewhere && (
        <Alert className="rounded-none border-x-0 border-t-0">
          <Icon name="CircleExclamationPoint" />
          <AlertDescription>
            This document was changed elsewhere since you started editing. Save
            replaces that version with yours; Discard loads it.
          </AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 w-full flex-1" onKeyDown={handleKeyDown}>
        <CodeEditor
          value={content}
          language={languageFor(resource.name)}
          onChange={handleChange}
          options={{ ariaLabel: name }}
        />
      </div>
    </BlockStack>
  );
}
