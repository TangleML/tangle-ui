import { type KeyboardEvent, useState } from "react";

import { languageFor } from "@/components/shared/CodeViewer";
import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { UNTITLED } from "@/services/projects/placeholderNames";
import { resourceMeta } from "@/services/projects/resourceMeta";
import type { ProjectResource } from "@/services/projects/types";
import { useUpdateProjectResource } from "@/services/projects/useProjectResources";
import { tracking } from "@/utils/tracking";

const CONTENT_KEY = "content";

export function documentBody(
  resource: Pick<ProjectResource, "payload">,
): string {
  const body = resource.payload?.[CONTENT_KEY];
  return typeof body === "string" ? body : "";
}

interface Edit {
  startedFrom: string;
  draft: string;
}

interface DocumentEditorProps {
  projectId: string;
  resource: ProjectResource;
}

export function DocumentEditor({ projectId, resource }: DocumentEditorProps) {
  const saved = documentBody(resource);
  const [edit, setEdit] = useState<Edit | null>(null);
  const update = useUpdateProjectResource(projectId);

  const content = edit?.draft ?? saved;
  const isDirty = edit !== null && edit.draft !== saved;
  const changedElsewhere = edit !== null && edit.startedFrom !== saved;
  const canSave = isDirty && !update.isPending;
  const name = resource.name ?? UNTITLED;

  const handleChange = (value: string) => {
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
        input: { payload: { ...resource.payload, [CONTENT_KEY]: draft } },
      },
      {
        onSuccess: () =>
          setEdit((current) => {
            if (!current || current.draft === draft) return null;
            return { startedFrom: draft, draft: current.draft };
          }),
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
      <InlineStack
        gap="2"
        wrap="nowrap"
        className="w-full shrink-0 border-b border-border px-3 py-1.5"
      >
        <Icon
          name={resourceMeta("document").icon}
          size="xs"
          className="shrink-0 text-muted-foreground"
        />
        <Text size="sm" weight="medium" className="truncate">
          {name}
        </Text>
        {isDirty && (
          <Text size="xs" tone="subdued" className="shrink-0">
            Unsaved changes
          </Text>
        )}
        <InlineStack gap="1" wrap="nowrap" className="ml-auto shrink-0">
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
        </InlineStack>
      </InlineStack>

      {changedElsewhere && (
        <Alert className="rounded-none border-x-0 border-t-0">
          <Icon name="CircleAlert" />
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
