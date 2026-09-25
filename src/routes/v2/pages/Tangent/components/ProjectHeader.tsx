import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useUpdateProject } from "@/services/projects/useProjects";

export function ProjectHeader() {
  const { project } = useTangentProject();
  const { mutate: updateProject } = useUpdateProject();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (!project) return null;

  function beginEdit() {
    setDraftName(project?.name ?? "");
    setIsEditing(true);
  }

  function commit() {
    const trimmed = draftName.trim();
    if (project && trimmed && trimmed !== project.name) {
      updateProject({ id: project.id, input: { name: trimmed } });
    }
    setIsEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setIsEditing(false);
  }

  return (
    <InlineStack
      align="space-between"
      blockAlign="center"
      gap="3"
      className="shrink-0 border-b border-border px-4 py-2"
    >
      {isEditing ? (
        <Input
          value={draftName}
          autoFocus
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="h-8 w-64"
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={beginEdit}
          title="Rename project"
          className="min-w-0 justify-start"
        >
          <Heading level={2} size="sm" className="truncate">
            {project.name}
          </Heading>
        </Button>
      )}
    </InlineStack>
  );
}
